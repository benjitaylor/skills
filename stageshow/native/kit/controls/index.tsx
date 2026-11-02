import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { SceneView, Label, row, absolute, type NativeProps } from '../native'
import { useLook } from '../look'
import { curves, useTween, useCycle, useNumber } from '../animate'
import { clock } from '../clock'
import type { Bezier } from '../ease'
import { MotionContext, useReducedMotion } from '../reduced-motion'
import { Icon, InkContext } from '../parts/Icon'
import { clear } from '../parts/paint'
import { InkLabel, useColor, useFade, useFill, useHover } from '../parts/transitions'
import type { CursorKind } from '../cursor-types'

// The field's chip opens at this pace: its padding, the box's, the × and the caret move together.
const CHIP: Bezier = [0.45, 0, 0.1, 1]
// Thumbs, bars and knobs settle into place.
const SETTLE: Bezier = [0.22, 1, 0.36, 1]

/** Solid while typing (each keystroke remounts it), then blinking 0.53s on, 0.53s off once it rests. */
function FieldCaret({ color, chip }: { color: string; chip: boolean }) {
  const [resting, setResting] = useState(false),
    { speed } = useContext(MotionContext)
  useEffect(() => {
    const id = clock.timeout(() => setResting(true), 500 / speed)
    return () => clock.clearTimeout(id)
  }, [speed])
  const blink = useCycle(1060, resting),
    margin = useTween(chip ? 6 : 1, 350, { ease: CHIP })
  return (
    <Animated.View
      style={{
        width: 1.5,
        height: 16,
        marginLeft: margin,
        borderRadius: 1,
        flexShrink: 0,
        backgroundColor: color,
        opacity: blink.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [1, 1, 0, 0] }),
      }}
    />
  )
}
// The valid tick's length, for drawing it with a dash: M3.5 8.5 6.5 11.5 12.5 4.5.
const OK = Math.hypot(3, 3) + Math.hypot(6, 7)
/** Drawn in as it appears, and drawn at rest, so a still still shows it. */
function FieldTick({ color }: { color: string }) {
  const drawn = useNumber(useTween(1, 350, { from: 0, ease: [0.65, 0, 0.35, 1] }))
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <Path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[OK, OK]}
        strokeDashoffset={OK * (1 - drawn)}
      />
    </Svg>
  )
}
/** The chip's ×: whole at every frame, it slides out from under the text's end and fades in a beat later. */
function FieldX({ target, chip }: { target?: string; chip: boolean }) {
  const { tokens: t } = useLook(),
    hover = useHover(target)
  const opacity = useTween(hover ? 1 : chip ? 0.75 : 0, hover || !chip ? 0 : 250, {
      delay: hover || !chip ? 0 : 120,
      ease: curves.ease,
    }),
    margin = useTween(chip ? 4 : -16, hover || !chip ? 0 : 350, { ease: CHIP }),
    background = useFill(hover, t.ink[1], 0, 150)
  return (
    <SceneView
      target={target}
      cursor="hand"
      accessibilityRole="button"
      style={{
        width: 16,
        height: 16,
        flexShrink: 0,
        marginLeft: margin,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        backgroundColor: background,
      }}
    >
      <Icon name="close" size={10} stroke={1.8} />
    </SceneView>
  )
}
export interface FieldProps extends NativeProps {
  label?: ReactNode
  value: string
  placeholder?: string
  focused?: boolean
  password?: boolean
  status?: 'valid' | 'error'
  chip?: boolean
  remove?: string
  leading?: ReactNode
  trailing?: ReactNode
  box?: NativeProps
  /** The committed chip's surface and text (the web's `--ss-chip-bg` and `--ss-chip-text`). */
  chipBg?: string
  chipText?: string
}
export function Field({
  label,
  value,
  placeholder,
  focused,
  password,
  status,
  chip,
  remove,
  leading,
  trailing,
  box,
  chipBg,
  chipText,
  style,
  ...rest
}: FieldProps) {
  const { tokens: t } = useLook(),
    { speed } = useContext(MotionContext),
    reduced = useReducedMotion()
  // A cleared chip keeps its text while it fades, then lets go (decided while rendering, so no frame goes without it)
  const held = useRef(''),
    [, release] = useState(0)
  if (chip || value) held.current = chip ? value : ''
  const out = !chip && !value && !!held.current
  useEffect(() => {
    if (!out) return
    const id = clock.timeout(
      () => {
        held.current = ''
        release((n) => n + 1)
      },
      reduced ? 0 : 250 / speed,
    )
    return () => clock.clearTimeout(id)
  }, [out, reduced, speed])
  const shown = out ? held.current : value,
    chipped = !!chip || out
  // The ring is a shadow, so focusing never moves the text; an error ring wins over focus
  const focusRing = useFade(!!focused && status !== 'error', 200),
    errorRing = useFade(status === 'error', 200)
  // The chip sits as far from every edge of the box: the box gives up its left padding at the chip's pace
  const inset = useTween(chipped ? 5 : 11, 350, { ease: CHIP })
  // The surface fades in around the text and its padding opens it out; once released it all lets go at once
  const surface = useTween(chipped ? 1 : 0, chipped ? 300 : 0, { ease: curves.ease }),
    open = useTween(chipped ? 1 : 0, chipped ? 350 : 0, { ease: CHIP }),
    fade = useTween(out ? 0 : 1, out ? 250 : 0, { ease: curves.ease })
  // Leaves the moment the first character lands, and waits for a cleared chip to finish fading
  const hint = useTween(value || out ? 0 : 1, value || out ? 0 : 200, { ease: curves.ease })
  const chipFill = chipBg ?? t.accentSoft,
    ink = chipText ?? t.text
  const background = useMemo(
      () => surface.interpolate({ inputRange: [0, 1], outputRange: [clear(chipFill), chipFill] }),
      [surface, chipFill],
    ),
    color = useMemo(
      () => (ink === t.text ? t.text : surface.interpolate({ inputRange: [0, 1], outputRange: [t.text, ink] })),
      [surface, ink, t.text],
    )
  const removable = remove !== undefined
  return (
    <SceneView {...rest} style={[{ gap: 6 }, style]}>
      {label && <Label style={{ fontSize: 11.5, fontWeight: '500', color: t.text }}>{label}</Label>}
      <SceneView
        cursor="ibeam"
        {...box}
        style={[
          row,
          {
            height: t.control,
            gap: 8,
            paddingLeft: inset,
            paddingRight: 11,
            borderRadius: t.radii.md,
            backgroundColor: t.surface,
            boxShadow: `inset 0 0 0 1px ${t.ink[3]}`,
          },
          box?.style,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            absolute,
            {
              borderRadius: t.radii.md,
              boxShadow: `inset 0 0 0 1px ${t.accent}, 0 0 0 3px ${t.accentSoft}`,
              opacity: focusRing,
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            absolute,
            {
              borderRadius: t.radii.md,
              boxShadow: `inset 0 0 0 1px ${t.danger}, 0 0 0 3px ${t.dangerSoft}`,
              opacity: errorRing,
            },
          ]}
        />
        {leading}
        <View style={[row, { flex: 1, minWidth: 0, alignSelf: 'stretch', overflow: 'hidden' }]}>
          {!!placeholder && (
            <Animated.View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center', opacity: hint }}
            >
              <Label lines={1} style={{ fontSize: 13, color: t.textFaint }}>
                {placeholder}
              </Label>
            </Animated.View>
          )}
          <Animated.View
            style={[
              row,
              {
                height: 24,
                flexShrink: 0,
                borderRadius: t.radii.pill,
                paddingLeft: open.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }),
                paddingRight: open.interpolate({ inputRange: [0, 1], outputRange: [0, removable ? 4 : 6] }),
                backgroundColor: background,
                opacity: fade,
              },
            ]}
          >
            <Animated.Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                color,
                fontFamily: t.fontFamily,
                includeFontPadding: false,
                letterSpacing: password ? 1.5 : undefined,
              }}
            >
              {password ? '•'.repeat(shown.length) : shown}
            </Animated.Text>
            {removable && (
              <InkContext.Provider value={ink}>
                <FieldX target={remove || undefined} chip={chipped} />
              </InkContext.Provider>
            )}
          </Animated.View>
          {focused && <FieldCaret key={value.length} color={t.accent} chip={chipped} />}
        </View>
        {status === 'valid' && <FieldTick color={t.success} />}
        {trailing}
      </SceneView>
    </SceneView>
  )
}
function SegmentOption({
  item,
  on,
  target,
  cursor,
}: {
  item: ReactNode
  on: boolean
  target?: string
  cursor?: CursorKind
}) {
  const { tokens: t } = useLook(),
    ink = on ? t.text : t.muted,
    color = useColor(ink, 200)
  return (
    <SceneView
      target={target}
      cursor={cursor}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: t.row, paddingHorizontal: 10 }}
    >
      <InkLabel color={color} ink={ink} style={{ fontSize: 12, fontWeight: '500' }}>
        {item}
      </InkLabel>
    </SceneView>
  )
}
export function Segmented({
  items,
  value,
  targets,
  cursor,
  style,
  onLayout,
  ...rest
}: NativeProps & { items: ReactNode[]; value: number; targets?: (string | undefined)[]; cursor?: CursorKind }) {
  const { tokens: t } = useLook(),
    [width, setWidth] = useState(0),
    cell = Math.max(0, width - 4) / Math.max(1, items.length)
  // The thumb moves in segments, as the web's translateX(value * 100%): a first layout places it, never slides it
  const index = useTween(Math.max(0, Math.min(value, items.length - 1)), 300, { ease: SETTLE })
  return (
    <SceneView
      {...rest}
      onLayout={(event) => {
        onLayout?.(event)
        setWidth(event.nativeEvent.layout.width)
      }}
      style={[row, { padding: 2, backgroundColor: t.ink[1], borderRadius: t.radii.md }, style]}
    >
      {!!items.length && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            bottom: 2,
            width: cell,
            borderRadius: t.radii.sm,
            backgroundColor: t.raised,
            boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
            transform: [{ translateX: Animated.multiply(index, cell) }],
          }}
        />
      )}
      {items.map((item, i) => (
        <SegmentOption key={i} item={item} on={value === i} target={targets?.[i]} cursor={cursor} />
      ))}
    </SceneView>
  )
}
function Tab({
  item,
  on,
  target,
  onPlace,
}: {
  item: ReactNode
  on: boolean
  target?: string
  onPlace(rect: { x: number; width: number }): void
}) {
  const { tokens: t } = useLook(),
    ink = on ? t.text : t.muted,
    color = useColor(ink, 200)
  return (
    <SceneView
      target={target}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      onLayout={(event) => onPlace(event.nativeEvent.layout)}
      style={{ paddingBottom: 9 }}
    >
      <InkLabel color={color} ink={ink} style={{ fontSize: 12.5, fontWeight: '500' }}>
        {item}
      </InkLabel>
    </SceneView>
  )
}
export function Tabs({
  items,
  value,
  targets,
  style,
  ...rest
}: NativeProps & { items: ReactNode[]; value: number; targets?: (string | undefined)[] }) {
  const { tokens: t } = useLook(),
    [rects, setRects] = useState<Record<number, { x: number; width: number }>>({}),
    placed = useRef(false)
  const rect = rects[value] ?? { x: 0, width: 0 }
  // The first measurement places the bar; only a change of tab slides it
  const ms = placed.current ? 350 : 0,
    x = useTween(rect.x, ms, { ease: SETTLE }),
    width = useTween(rect.width, ms, { ease: SETTLE })
  useEffect(() => {
    if (rect.width > 0) placed.current = true
  })
  return (
    <SceneView {...rest} style={[row, { gap: 18, borderBottomWidth: 1, borderBottomColor: t.border }, style]}>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: -1,
          left: 0,
          height: 2,
          backgroundColor: t.text,
          width,
          transform: [{ translateX: x }],
        }}
      />
      {items.map((item, i) => (
        <Tab
          key={i}
          item={item}
          on={i === value}
          target={targets?.[i]}
          onPlace={({ x, width }) =>
            setRects((r) => (r[i]?.x === x && r[i]?.width === width ? r : { ...r, [i]: { x, width } }))
          }
        />
      ))}
    </SceneView>
  )
}
export function Toggle({ on, style, ...rest }: NativeProps & { on: boolean }) {
  const { tokens: t, theme, palette } = useLook()
  // The accent fades in over the off ink rather than mixing with it, which is CSS's own blend, without a muddy middle
  const track = useFade(on, 200),
    knob = useTween(on ? 12 : 0, 250, { ease: SETTLE })
  // On blueprint the accent is white, so the knob takes the ground; mono dark's light accent takes a dark knob
  const ground = on && theme === 'blueprint'
  return (
    <SceneView
      {...rest}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[{ width: 30, height: 18, borderRadius: 9, padding: 2, flexShrink: 0, backgroundColor: t.ink[4] }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[absolute, { borderRadius: 9, backgroundColor: t.accent, opacity: track }]}
      />
      <Animated.View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: ground ? t.well : on && palette === 'mono' && theme === 'dark' ? '#111' : '#fff',
          // Light and tight: a heavy shadow greys the track beside the knob
          boxShadow: ground ? undefined : '0 0.5px 1.5px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.04)',
          transform: [{ translateX: knob }],
        }}
      />
    </SceneView>
  )
}
export function Badge({
  tone = 'neutral',
  dot,
  icon,
  children,
  style,
  ...rest
}: NativeProps & { tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning'; dot?: boolean; icon?: ReactNode }) {
  const { tokens: t } = useLook()
  const [fill, ink] = {
    neutral: [t.ink[1], t.text],
    accent: [t.accentSoft, t.accentText],
    success: [t.successSoft, t.successText],
    danger: [t.dangerSoft, t.dangerText],
    warning: [t.warningSoft, t.warningText],
  }[tone]
  // A tone change (Working to Ready) eases on the same pill, no swap
  const background = useColor(fill, 350),
    color = useColor(ink, 350)
  return (
    <SceneView
      {...rest}
      style={[
        row,
        {
          alignSelf: 'flex-start',
          gap: 5,
          height: 20,
          // A round mark before the words reads as further in than text does, so that side is 2px tighter
          paddingLeft: dot || icon ? 7 : 9,
          paddingRight: 9,
          borderRadius: t.radii.pill,
          backgroundColor: background,
        },
        style,
      ]}
    >
      {dot && <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />}
      <InkContext.Provider value={ink}>{icon}</InkContext.Provider>
      <InkLabel color={color} ink={ink} style={{ fontSize: 11, fontWeight: '500' }}>
        {children}
      </InkLabel>
    </SceneView>
  )
}
export function Slot({
  open,
  height,
  gap = 0,
  dashed,
  children,
  style,
  ...rest
}: NativeProps & { open: boolean; height: number; gap?: number; dashed?: boolean }) {
  const { tokens: t } = useLook(),
    p = useTween(open ? 1 : 0, 450, { ease: [0.45, 0, 0.2, 1] })
  // The dashed mark is drawn at full height and only fades (dashes re-laid every frame flicker): in as the slot
  // finishes opening, out first as it closes. Only the mark is clipped; the slot's own children never are.
  const mark = useFade(open && !!dashed, 160, 150, { delay: 300, ease: curves.easeOut })
  return (
    <SceneView
      {...rest}
      hidden={!open}
      style={[
        {
          flexShrink: 0,
          borderRadius: t.radii.md,
          height: Animated.multiply(p, height),
          marginTop: p.interpolate({ inputRange: [0, 1], outputRange: [-gap, 0] }),
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={[absolute, { overflow: 'hidden', borderRadius: t.radii.md }]}>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.ink[4],
            borderRadius: t.radii.md,
            opacity: mark,
          }}
        />
      </View>
      {children}
    </SceneView>
  )
}
