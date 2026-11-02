import { useId, useRef, type ComponentType, type ReactNode } from 'react'
import { Animated, Platform, Text as RNText, View, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import {
  MacPointer,
  MacIbeam,
  MacCrosshair,
  MacPointingHand,
  MacOpenHand,
  MacGrab,
  MacWait,
  MacResizeNS,
  MacResizeEW,
  MacResizeNWSE,
  MacResizeNESW,
  type Ink,
} from './cursors'
import { useTween } from './animate'
import type { Bezier } from './ease'
import type { CursorKind, CursorStyle, Keys, KeysAt } from './cursor-types'
import { Glass, blurIntensity } from './glass'
import { useLook } from './look'
import { absolute } from './native'

export type { CursorKind, CursorStyle } from './cursor-types'

// The web kit's CSS curves. useTween's own default is not CSS `ease`.
const EASE: Bezier = [0.25, 0.1, 0.25, 1]
const EASE_OUT: Bezier = [0, 0, 0.58, 1]
const LINEAR: Bezier = [0, 0, 1, 1]
// Lets go softly, as a finger lifting
const SOFT: Bezier = [0.22, 1, 0.36, 1]
const RIPPLE: Bezier = [0.25, 0.8, 0.25, 1]

const GLYPHS: Record<CursorKind, ComponentType<Ink>> = {
  pointer: MacPointer,
  ibeam: MacIbeam,
  crosshair: MacCrosshair,
  hand: MacPointingHand,
  open: MacOpenHand,
  grab: MacGrab,
  wait: MacWait,
  'resize-ns': MacResizeNS,
  'resize-ew': MacResizeEW,
  'resize-nwse': MacResizeNWSE,
  'resize-nesw': MacResizeNESW,
}
const KINDS = Object.keys(GLYPHS) as CursorKind[]
// Where each glyph's hotspot sits inside its box, so the point is the click.
const HOTSPOT: Record<CursorKind, [number, number]> = {
  pointer: [7.5, 5.25],
  ibeam: [5, 8],
  crosshair: [8.5, 8.5],
  hand: [9.75, 3.25],
  open: [11.7, 10.4],
  grab: [12, 12],
  wait: [8, 8],
  'resize-ns': [10.5, 10.5],
  'resize-ew': [10.5, 10.5],
  'resize-nwse': [10.5, 10.5],
  'resize-nesw': [10.5, 10.5],
}
// The arrow style's pointer: one solid, rounded arrowhead, tip at the hotspot
const ARROW_HOTSPOT: [number, number] = [4, 3]
function SolidArrow({ ink }: { ink: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Path d="M4 3 18.5 9.6 11.8 11.8 9.6 18.5Z" fill={ink} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
    </Svg>
  )
}
// drop-shadow(0 1px 2px rgba(0,0,0,.3)) under every glyph. iOS takes a layer shadow from the
// glyph's own alpha; Android and the web preview take the CSS filter.
const SHADOW: ViewStyle =
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 1 }
    : { filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))' }

/** A color that crosses to the next over `duration`, as a CSS background transition does. */
function useBlend(color: string, duration: number) {
  const seq = useRef({ n: 0, from: color, to: color })
  if (seq.current.to !== color) seq.current = { n: seq.current.n + 1, from: seq.current.to, to: color }
  const { n, from, to } = seq.current
  const p = useTween(n, duration, { ease: EASE })
  return p.interpolate({ inputRange: [n - 1, n], outputRange: [from, to], extrapolate: 'clamp' })
}

const isHand = (k: CursorKind) => k === 'open' || k === 'grab'
// One glyph of the stack (cursor.css): the shown one grows in about its hotspot and the last
// shrinks away; resize shapes and the arrow cross over at 0.5-0.6x rather than pop; the open
// and closed hand are one hand, swapping in place.
function Layer({
  glyph,
  shown,
  size,
  hot,
  children,
}: {
  glyph: CursorKind
  shown: CursorKind
  size: number
  hot: [number, number]
  children: ReactNode
}) {
  const active = glyph === shown,
    resizing = shown.startsWith('resize'),
    resize = glyph.startsWith('resize'),
    hand = isHand(shown) && isHand(glyph),
    soft = resizing || resize
  const to = hand || active ? size : resizing ? size * 0.6 : resize ? size * 0.5 : 0
  const scale = useTween(to, hand ? 0 : soft ? 280 : 200, { ease: soft ? SOFT : EASE })
  // What it was leaves quickly, so no ghost of it trails the new shape
  const leaving = soft && (resizing ? !active : resize)
  const opacity = useTween(active ? 1 : 0, hand ? 80 : leaving ? 100 : 200, { ease: hand ? LINEAR : EASE })
  // A glyph that has never shown draws nothing; once shown it stays mounted to fade.
  const seen = useRef(false)
  seen.current ||= active
  if (!seen.current) return null
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: -hot[0],
        top: -hot[1],
        opacity,
        transformOrigin: [hot[0], hot[1], 0],
        transform: [{ scale }],
      }}
    >
      <View style={SHADOW}>{children}</View>
    </Animated.View>
  )
}

// The iPad's glass pointer: a tinted, blurred dot that narrows into a bar over text.
function Circle({ kind, pressed, dark }: { kind: CursorKind; pressed: boolean; dark: boolean }) {
  const bar = kind === 'ibeam'
  const morph = useTween(bar ? 1 : 0, 200, { ease: SOFT }),
    corner = useTween(bar ? 1 : 0, 200, { ease: EASE })
  const fill = useBlend(
    pressed
      ? dark
        ? 'rgba(255,255,255,0.18)'
        : 'rgba(118,118,128,0.4)'
      : kind === 'grab'
        ? 'rgba(118,118,128,0.4)'
        : bar
          ? 'rgba(60,60,67,0.55)'
          : dark
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(118,118,128,0.26)',
    150,
  )
  const span = (a: number, b: number) => morph.interpolate({ inputRange: [0, 1], outputRange: [a, b] })
  const radius = corner.interpolate({ inputRange: [0, 1], outputRange: [11, 2] })
  return (
    <Animated.View
      style={{
        width: span(22, 4),
        height: span(22, 20),
        marginLeft: span(-11, -2),
        marginTop: span(-11, -10),
        borderRadius: radius,
        boxShadow: dark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.1)',
      }}
    >
      <Animated.View style={[absolute, { borderRadius: radius, overflow: 'hidden' }]}>
        {/* The blur goes while pressed: the dot then sits on what it presses, and a blur smears it */}
        <Glass tint="default" intensity={pressed ? 0 : blurIntensity(5)} style={absolute} />
        <Animated.View
          style={[
            absolute,
            {
              backgroundColor: fill,
              boxShadow: dark
                ? 'inset 0 1px 1px rgba(255,255,255,0.3)'
                : 'inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 1px rgba(0,0,0,0.05)',
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  )
}

// A finger: nothing between taps. It lands just before a press, shrinks while pressed or
// swiping, and fades as it lifts.
function Finger({ touching, down }: { touching: boolean; down: boolean }) {
  const opacity = useTween(touching ? 1 : 0, touching ? 140 : 400, { ease: EASE })
  const scale = useTween(down ? 0.82 : touching ? 1 : 0.7, down ? 100 : touching ? 160 : 450, {
    ease: down ? EASE_OUT : SOFT,
  })
  const fill = useBlend(down ? 'rgba(118,118,128,0.22)' : 'rgba(118,118,128,0.14)', down ? 80 : 0)
  return (
    <Animated.View
      style={{
        width: 34,
        height: 34,
        marginLeft: -17,
        marginTop: -17,
        borderRadius: 17,
        backgroundColor: fill,
        opacity,
        transform: [{ scale }],
      }}
    />
  )
}

/** The swipe trail's length (px, up to 100) and heading (radians), set each frame by the act. */
export type Trail = { length: Animated.Value; angle: Animated.Value }
// One soft streak from where the finger was a few frames ago to where it is, fading toward its
// tail. Its right end is the finger; it turns about that end.
function Streak({ swiping, length, angle }: Trail & { swiping: boolean }) {
  const id = `ss-streak${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const opacity = useTween(swiping ? 1 : 0, swiping ? 0 : 160, { ease: EASE })
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: -13,
        height: 26,
        width: length,
        left: Animated.multiply(length, -1),
        borderRadius: 13,
        overflow: 'hidden',
        opacity,
        transformOrigin: 'right center',
        transform: [{ rotate: angle.interpolate({ inputRange: [0, 1], outputRange: ['0rad', '1rad'] }) }],
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 100,
          height: 26,
          transformOrigin: 'right center',
          transform: [{ scaleX: length.interpolate({ inputRange: [0, 100], outputRange: [0, 1] }) }],
        }}
      >
        <Svg width={100} height={26}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgb(118,118,128)" stopOpacity={0} />
              <Stop offset="1" stopColor="rgb(118,118,128)" stopOpacity={0.16} />
            </LinearGradient>
          </Defs>
          <Rect width={100} height={26} fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

export function Cursor({
  position,
  kind,
  style = 'real',
  pressed,
  touching,
  swiping = false,
  trail,
  visible = true,
}: {
  position: Animated.ValueXY
  kind: CursorKind
  style?: CursorStyle
  pressed: boolean
  touching: boolean
  swiping?: boolean
  trail?: Trail
  visible?: boolean
}) {
  const { theme } = useLook()
  // Line cursors and the arrow invert on a dark surface, as macOS's do
  const inverted = theme === 'dark' || theme === 'blueprint'
  // Steps out of the shot slowly when idle; back quickly as it moves
  const shown = useTween(visible ? 1 : 0, visible ? 250 : 600, { ease: EASE })
  // The press dips about the hotspot, so the point of contact never moves
  const press = useTween(pressed ? (style === 'circle' ? 0.8 : 0.9) : 1, pressed ? 80 : 260, {
    ease: pressed ? EASE_OUT : SOFT,
  })
  const arrow = style === 'arrow'
  // The arrow style has two glyphs: the arrow, and the I-beam over text
  const current = arrow && kind !== 'ibeam' ? 'pointer' : kind
  const ink: Ink | undefined = inverted ? { line: '#fff', edge: 'rgba(0,0,0,0.75)' } : undefined
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 10000,
        opacity: shown,
        transform: position.getTranslateTransform(),
      }}
    >
      {style === 'touch' && trail && <Streak swiping={swiping} {...trail} />}
      <Animated.View style={{ transformOrigin: 'top left', transform: [{ scale: press }] }}>
        {style === 'circle' ? (
          <Circle kind={kind} pressed={pressed} dark={theme === 'dark'} />
        ) : style === 'touch' ? (
          <Finger touching={touching} down={pressed || swiping} />
        ) : (
          (arrow ? (['pointer', 'ibeam'] as const) : KINDS).map((k) => {
            const Glyph = GLYPHS[k]
            return (
              <Layer
                key={k}
                glyph={k}
                shown={current}
                // The I-beam marks a text line, so the large style keeps it near the text's size
                size={style === 'large' ? (k === 'ibeam' ? 1.15 : 1.5) : 1}
                hot={arrow && k === 'pointer' ? ARROW_HOTSPOT : HOTSPOT[k]}
              >
                {arrow && k === 'pointer' ? <SolidArrow ink={inverted ? '#fff' : '#111'} /> : <Glyph {...ink} />}
              </Layer>
            )
          })
        )}
      </Animated.View>
    </Animated.View>
  )
}

/** A ring that spreads from the click point and fades, drawn under the cursor. */
export function Ripple({ x, y }: { x: number; y: number }) {
  const { tokens, palette } = useLook()
  const p = useTween(1, 550, { from: 0, ease: RIPPLE })
  const mono = palette === 'mono'
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        zIndex: 99,
        left: x - 18,
        top: y - 18,
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: mono ? tokens.text : tokens.accent,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
      }}
    >
      {!mono && <View style={[absolute, { borderRadius: 18, backgroundColor: tokens.accent, opacity: 0.1 }]} />}
    </Animated.View>
  )
}

const UP = 'inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.18)'
const DOWN = 'inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.18)'
function Key({ label, down }: { label: string; down: boolean }) {
  const { tokens } = useLook()
  const d = useTween(down ? 1 : 0, 80, { ease: EASE_OUT })
  return (
    <Animated.View
      style={{
        minWidth: 28,
        height: 28,
        paddingHorizontal: 8,
        borderRadius: 7,
        backgroundColor: 'rgba(24,24,27,0.88)',
        boxShadow: down ? DOWN : UP,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: d }, { scale: d.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) }],
      }}
    >
      <RNText
        style={{
          color: '#fff',
          fontSize: 13,
          lineHeight: 13,
          fontWeight: '500',
          fontFamily: tokens.fontFamily,
          includeFontPadding: false,
        }}
      >
        {label}
      </RNText>
    </Animated.View>
  )
}
// One keystroke's row of caps. It mounts hidden and rises in, so a stroke always fades up.
function KeyRow({ value, at }: { value: Keys; at: KeysAt }) {
  const opacity = useTween(value.show ? 1 : 0, 160, { ease: EASE }),
    lowered = useTween(value.show ? 0 : 1, 200, { ease: SOFT })
  const centered = at === 'bottom' || at === 'top'
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        zIndex: 99,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        top: at === 'top' ? 16 : undefined,
        bottom: at === 'top' ? undefined : 16,
        left: centered ? 0 : at === 'bottom-left' ? 16 : undefined,
        right: centered ? 0 : at === 'bottom-right' ? 16 : undefined,
        opacity,
        transform: [
          { translateY: lowered.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
          { scale: lowered.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) },
        ],
      }}
    >
      {value.caps.map((key, i) => (
        <Key key={i} label={key} down={value.down} />
      ))}
    </Animated.View>
  )
}
export function Keycaps({ values, at }: { values: Keys[]; at: KeysAt }) {
  return (
    <>
      {values.map((value) => (
        <KeyRow key={value.id} value={value} at={at} />
      ))}
    </>
  )
}
