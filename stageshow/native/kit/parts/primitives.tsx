import { useContext, useId, useMemo, useState, type ReactNode } from 'react'
import {
  Animated,
  Image,
  Platform,
  View,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Svg, { Circle, Path, SvgXml, SvgUri, Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { Mask } from '../mask'
import { useLook } from '../look'
import { SceneView, Label, row, absolute, type NativeProps } from '../native'
import { curves, useCycle, useTween, useNumber } from '../animate'
import { brandMarks, type BrandName, type BrandAsset } from '../brands'
import { Bar } from '../window'
import { PhoneContext } from '../phone'
import { InkContext } from './Icon'
import { greyscaleXml } from './paint'
import { InkLabel, useColor, useFade, useFill, useHover, useLinger, useTargetName } from './transitions'

// The mono palette's `img { filter: grayscale(1) }`, for raster artwork. A view carries it: image styles
// have no filter.
const GREY: ViewStyle = { filter: [{ grayscale: 1 }] }
function Grey({ on, style, children }: { on: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return on ? <View style={[style, GREY]}>{children}</View> : children
}

const PEOPLE = ['#c98f6e', '#6f9b7d', '#7b86c7', '#c47a9e', '#8c9ab0', '#c2a35a']
export function personColor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 9973
  return PEOPLE[hash % PEOPLE.length]
}
export interface AvatarProps extends NativeProps {
  /** Native text styles do not inherit from the avatar's view. */
  textStyle?: StyleProp<TextStyle>
  /** Artwork behind initials, clipped by the kit's circular face. */
  background?: ReactNode
  name?: string
  plain?: boolean
  size?: number
  tone?: 'accent' | 'ink' | 'success' | 'person' | 'ios'
  src?: string
  ring?: 'pending' | 'waiting' | 'confirmed' | 'declined'
  /** The gap cut between the face and its ring (the web's `--ss-ring-bg`): the colour the avatar sits on. */
  ringBg?: string
}
// The iOS contact monogram's face, and its type: Apple's rounded system face on iOS.
const IOS = { top: '#a5abb8', bottom: '#858a96', mid: '#959aa7' }
const ROUNDED = Platform.select({
  ios: 'ui-rounded',
  web: "ui-rounded, 'SF Pro Rounded', -apple-system, system-ui, sans-serif",
  default: undefined,
})
// The waiting ring's comet: the web's conic gradient, transparent to 62% of the turn and then rising to the
// accent at the top, drawn as nested arcs that all end at the head. Each layer starts a step further round,
// so the overlaps build the ramp with no seams between pieces.
const COMET = 16
function Comet({ size, color }: { size: number; color: string }) {
  const c = size / 2 + 3,
    r = size / 2 + 2.25
  const at = (turn: number) => [c + r * Math.sin(turn * 2 * Math.PI), c - r * Math.cos(turn * 2 * Math.PI)]
  const [hx, hy] = at(1)
  return (
    <Svg width={size + 6} height={size + 6}>
      {Array.from({ length: COMET }, (_, i) => {
        const [x, y] = at(0.62 + (0.38 * i) / COMET)
        // Composited, the coverage over piece i is (i + 0.5) / COMET: the gradient's value at its middle.
        const opacity = i ? 1 / (COMET - i + 0.5) : 0.5 / COMET
        return (
          <Path
            key={i}
            d={`M${x} ${y}A${r} ${r} 0 0 1 ${hx} ${hy}`}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={opacity}
          />
        )
      })}
    </Svg>
  )
}
export function Avatar({
  name = '',
  plain,
  size = 24,
  tone = name ? 'person' : 'ink',
  src,
  ring,
  ringBg,
  textStyle,
  background,
  style,
  ...rest
}: AvatarProps) {
  const { fidelity, palette, tokens: t } = useLook(),
    gradient = useId().replace(/[^a-zA-Z0-9]/g, '')
  const disc = plain || fidelity === 'minimal',
    words = name.trim().split(/\s+/).filter(Boolean)
  const initial =
    tone === 'ios'
      ? (words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')
      : (name.trim()[0] ?? '')
  // Opaque, so faces in a pile never onion-skin: a person's own colour, a status, or ink-3 flattened (fill)
  const fill =
    tone === 'person' && !disc
      ? personColor(name)
      : tone === 'accent'
        ? t.accent
        : tone === 'success'
          ? t.success
          : tone === 'ios'
            ? IOS.mid
            : t.fill
  const own = (StyleSheet.flatten(style) as ViewStyle | undefined)?.backgroundColor
  const face = useColor(typeof own === 'string' ? own : fill, 300),
    ink = tone === 'ink' ? t.text : '#fff',
    color = useColor(ink, 300)
  const ringColor = useColor(ring === 'confirmed' ? t.success : ring === 'declined' ? t.danger : t.ink[2], 350)
  const waiting = ring === 'waiting',
    arc = useFade(waiting, 300),
    turning = useLinger(waiting, 300),
    spin = useCycle(1100, turning && !!ring)
  const fontSize = Math.round(size * (tone === 'ios' ? 0.4 : size < 24 ? 0.5 : 0.42))
  return (
    <SceneView
      {...rest}
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {ring && (
        <>
          {/* The web's two ring shadows: 3px of ring colour under 1.5px of the ground it sits on */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -3,
              top: -3,
              width: size + 6,
              height: size + 6,
              borderRadius: (size + 6) / 2,
              borderWidth: 3,
              borderColor: ringColor,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -1.5,
              top: -1.5,
              width: size + 3,
              height: size + 3,
              borderRadius: (size + 3) / 2,
              borderWidth: 1.5,
              borderColor: ringBg ?? t.surface,
            }}
          />
        </>
      )}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: own != null && typeof own !== 'string' ? own : face,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {tone === 'ios' && own == null && (
          <Svg style={absolute} width={size} height={size}>
            <Defs>
              <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={IOS.top} />
                <Stop offset="1" stopColor={IOS.bottom} />
              </LinearGradient>
            </Defs>
            <Rect width={size} height={size} fill={`url(#${gradient})`} />
          </Svg>
        )}
        {background && !disc && <View style={{ position: 'absolute', inset: 0 }}>{background}</View>}
        {src && !disc ? (
          <Grey on={palette === 'mono'}>
            <Image source={{ uri: src }} style={{ width: size, height: size }} />
          </Grey>
        ) : (
          !disc && (
            <InkLabel
              color={color}
              ink={ink}
              style={[
                { fontWeight: '600', fontSize },
                tone === 'ios' && { fontFamily: ROUNDED, letterSpacing: fontSize * 0.01 },
                textStyle,
              ]}
            >
              {initial.toUpperCase()}
            </InkLabel>
          )
        )}
      </Animated.View>
      {ring && turning && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -3,
            top: -3,
            opacity: arc,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }}
        >
          <Comet size={size} color={t.accent} />
        </Animated.View>
      )}
    </SceneView>
  )
}
// The tick's path length, for drawing it with a dash: M4.5 8.2 7 10.6l4.6-5.
const TICK = Math.hypot(2.5, 2.4) + Math.hypot(4.6, 5)
export function Check({
  on,
  pending,
  size = 16,
  style,
  ...rest
}: NativeProps & { on: boolean; pending?: boolean; size?: number }) {
  const { tokens, theme, palette } = useLook()
  const fill = useNumber(useTween(on ? 1 : 0, on ? 400 : 200, { ease: on ? [0.22, 1, 0.36, 1] : curves.ease }))
  const ring = useNumber(useFade(!on, 200))
  // The tick is opaque at 160ms and then draws. Turned off it goes at once: on the web its dash offset
  // jumps back with no transition, so the fade the opacity starts never shows.
  const shown = useNumber(useTween(on ? 1 : 0, on ? 10 : 0, { delay: on ? 160 : 0, ease: curves.ease }))
  const tick = useNumber(useTween(on ? 1 : 0, on ? 320 : 0, { delay: on ? 160 : 0, ease: [0.65, 0, 0.35, 1] }))
  const spinning = !!pending && !on,
    arc = useFade(spinning, 180, on ? 80 : 180),
    turning = useLinger(spinning, on ? 80 : 180),
    spin = useCycle(800, turning)
  const layer = { position: 'absolute', left: 0, top: 0 } as const
  return (
    <SceneView {...rest} style={[{ width: size, height: size, flexShrink: 0 }, style]}>
      <Svg viewBox="0 0 16 16" width={size} height={size} style={layer}>
        <Circle cx={8} cy={8} r={7.25} stroke={tokens.ink[3]} strokeWidth={1.5} fill="none" opacity={ring} />
      </Svg>
      {/* Pending: an arc turning inside the ring, under the disc that grows over it */}
      {turning && (
        <Animated.View
          style={{
            ...layer,
            opacity: arc,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }}
        >
          <Svg width={size} height={size} viewBox="0 0 16 16">
            <Circle
              cx={8}
              cy={8}
              r={7.25}
              fill="none"
              stroke={tokens.text}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={[12.75, 45.55]}
            />
          </Svg>
        </Animated.View>
      )}
      <Svg viewBox="0 0 16 16" width={size} height={size} style={layer}>
        <Circle cx={8} cy={8} r={8 * (0.35 + 0.65 * fill)} fill={tokens.success} opacity={on ? 1 : fill} />
        <Path
          d="M4.5 8.2 7 10.6l4.6-5"
          fill="none"
          stroke={theme === 'blueprint' ? tokens.well : theme === 'dark' && palette === 'mono' ? '#111' : '#fff'}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[TICK, TICK]}
          strokeDashoffset={TICK * (1 - tick)}
          opacity={shown}
        />
      </Svg>
    </SceneView>
  )
}
/** A thin arc turning, in `color` or the colour around it (native has no currentColor). */
export function Spinner({ size = 14, color, style, ...rest }: NativeProps & { size?: number; color?: string }) {
  const { tokens } = useLook(),
    inherited = useContext(InkContext),
    ink = color ?? inherited ?? tokens.text,
    p = useCycle(800)
  return (
    <SceneView
      {...rest}
      accessibilityLabel={rest.accessibilityLabel ?? 'Loading'}
      style={[
        {
          width: size,
          height: size,
          flexShrink: 0,
          transform: [{ rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Circle cx={8} cy={8} r={6.25} stroke={ink} strokeOpacity={0.18} strokeWidth={1.5} fill="none" />
        <Path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" stroke={ink} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      </Svg>
    </SceneView>
  )
}
export interface PinProps extends NativeProps {
  name?: string
  src?: string
  size?: number
  corner?: 'bl' | 'br' | 'tl' | 'tr'
  tone?: 'accent' | 'ink'
  selected?: boolean
}
export function Pin({ name = '', src, size = 24, corner = 'bl', tone = 'accent', selected, style, ...rest }: PinProps) {
  const { fidelity, palette, tokens: t } = useLook(),
    plain = fidelity === 'minimal'
  // The rim and the face share one shape, the pointed corner square, nested at any size
  const shape = (s: number) => ({
    borderTopLeftRadius: corner === 'tl' ? 0 : s / 2,
    borderTopRightRadius: corner === 'tr' ? 0 : s / 2,
    borderBottomLeftRadius: corner === 'bl' ? 0 : s / 2,
    borderBottomRightRadius: corner === 'br' ? 0 : s / 2,
  })
  // The open pin trades its hairline for a ring in its own colour with the surface between (box-shadow 0.3s)
  const open = useFade(!!selected, 300),
    closed = useMemo(() => Animated.subtract(1, open), [open])
  const accent = tone === 'accent'
  return (
    <SceneView
      {...rest}
      style={[
        {
          width: size,
          height: size,
          padding: 2,
          flexShrink: 0,
          ...shape(size),
          backgroundColor: t.surface,
          boxShadow: '0 2px 6px -1px rgba(0,0,0,0.25)',
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[absolute, shape(size), { boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', opacity: closed }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          absolute,
          shape(size),
          { boxShadow: `0 0 0 1.5px ${t.surface}, 0 0 0 3px ${accent ? t.accent : t.ink[4]}`, opacity: open },
        ]}
      />
      <View
        style={[
          {
            flex: 1,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent ? t.accent : t.ink[2],
          },
          shape(size - 4),
        ]}
      >
        {src && !plain ? (
          <Grey on={palette === 'mono'} style={{ width: '100%', height: '100%' }}>
            <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} />
          </Grey>
        ) : (
          !plain && (
            <Label style={{ color: accent ? '#fff' : t.text, fontWeight: '600', fontSize: Math.round(size * 0.42) }}>
              {name.trim()[0]?.toUpperCase()}
            </Label>
          )
        )}
      </View>
    </SceneView>
  )
}
export type BrandMarkProps = NativeProps & {
  src?: string
  size?: number
  width?: number
  tile?: boolean
  surface?: 'light' | 'dark'
} & ({ brand: BrandName; name?: string } | { brand?: undefined; name: string })
export function BrandMark({
  brand,
  name,
  src,
  size = 28,
  width,
  tile = true,
  surface,
  style,
  ...rest
}: BrandMarkProps) {
  const { fidelity, theme, palette, tokens } = useLook(),
    asset: BrandAsset | undefined = brand ? brandMarks[brand] : undefined
  const dark = (surface ?? (theme === 'dark' || theme === 'blueprint' ? 'dark' : 'light')) === 'dark'
  const label = name ?? asset?.name ?? '',
    artwork = src ?? (tile && asset?.tileArtwork ? asset.tileArtwork : dark ? asset?.dark : asset?.light)
  // A bundled mark sizes itself; a supplied src is a plain logo at the tile's 62%
  const sized = asset && !src ? asset : undefined
  // Full-colour marks with no dark variant keep their own artwork on a light tile; bare marks leave it to the caller
  const lightTile = tile && dark && !!sized && sized.dark === sized.light
  const w = width ?? (sized ? Math.round(size * sized.proportion) : size),
    scale = !tile ? 1 : (sized?.scale ?? 0.62)
  const mono = palette === 'mono'
  const xml = useMemo(() => {
    if (!artwork?.trim().startsWith('<')) return undefined
    // SVG permits leading-dot offsets; react-native-svg's stop parser needs the zero.
    const fixed = artwork.replace(/(\boffset\s*=\s*["'])\.(\d)/g, (_, prefix, digit) => `${prefix}0.${digit}`)
    return mono ? greyscaleXml(fixed) : fixed
  }, [artwork, mono])
  return (
    <SceneView
      {...rest}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        {
          width: w,
          height: size,
          flexShrink: 0,
          borderRadius: Math.round(size * 0.24),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: tile ? sized?.tileBackground || (lightTile ? '#fff' : tokens.surface) : 'transparent',
          boxShadow: tile ? `inset 0 0 0 1px ${lightTile ? 'rgba(0,0,0,0.08)' : tokens.border}` : undefined,
        },
        style,
      ]}
    >
      {artwork && fidelity !== 'minimal' ? (
        xml ? (
          <SvgXml xml={xml} width={w * scale} height={size * scale} />
        ) : /\.svg(?:\?|$)/i.test(artwork) ? (
          <Grey on={mono}>
            <SvgUri uri={artwork} width={w * scale} height={size * scale} />
          </Grey>
        ) : (
          <Grey on={mono}>
            <Image source={{ uri: artwork }} resizeMode="contain" style={{ width: w * scale, height: size * scale }} />
          </Grey>
        )
      ) : (
        <Label style={{ fontSize: Math.round(size * (size < 24 ? 0.5 : 0.42)), fontWeight: '600', color: tokens.text }}>
          {fidelity === 'minimal' ? '' : label.trim()[0]?.toUpperCase()}
        </Label>
      )}
    </SceneView>
  )
}
export function Facepile({
  names,
  size = 22,
  overlap = 6,
  gap = 2,
  tones,
  avatars,
  style,
  ...rest
}: NativeProps & {
  names: string[]
  size?: number
  overlap?: number
  gap?: number
  tones?: AvatarProps['tone'][]
  avatars?: ReactNode[]
}) {
  const r = size / 2
  return (
    <SceneView {...rest} style={[row, style]}>
      {names.map((name, i) => {
        const path = `M0 0H${size}V${size}H0Z${i < names.length - 1 ? `M${size - overlap - gap} ${r}a${r + gap} ${r + gap} 0 1 0 ${2 * (r + gap)} 0a${r + gap} ${r + gap} 0 1 0 ${-2 * (r + gap)} 0` : ''}`
        const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path d="${path}" fill="black" fill-rule="evenodd"/></svg>`
        return (
          <Mask key={i} xml={xml} style={{ width: size, height: size, marginLeft: i ? -overlap : 0 }}>
            {avatars?.[i] ?? <Avatar name={name} size={size} tone={tones?.[i] ?? 'person'} />}
          </Mask>
        )
      })}
    </SceneView>
  )
}
export interface RowProps extends NativeProps {
  lead?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  preview?: number[] | ReactNode
  unread?: boolean
  selected?: boolean
  pad?: number
}
// The type scale: desktop sizes, and an iOS list row's on a phone screen (17pt name, 15pt lines, a 10pt dot)
const DESKTOP = { title: 12, subtitle: 11.5, meta: 11, line: 16, line2: 16, gap: 2, dot: 6 }
const IPHONE = { title: 17, subtitle: 15, meta: 15, line: 22, line2: 20, gap: 0, dot: 10 }
export function Row({
  lead,
  title,
  subtitle,
  meta,
  preview,
  unread,
  selected,
  pad = 12,
  children,
  style,
  ...rest
}: RowProps) {
  const { tokens: t } = useLook(),
    m = useContext(PhoneContext) ? IPHONE : DESKTOP
  const name = useTargetName(rest),
    hover = useHover(name),
    background = useFill(!!selected || hover, t.ink[0], 200)
  const [trail, setTrail] = useState(0)
  const bars = Array.isArray(preview) && preview.every((n) => typeof n === 'number'),
    trailing = children != null && children !== false
  // With preview lines the lead and the dot centre on the name, the subtitle and the first preview line
  const leadH = m.line + m.line2 * 2 + m.gap
  // The dot hangs 7px clear of the first cell, centred on it: the row never moves
  const dot = unread && (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -7 - m.dot,
        top: preview ? leadH / 2 - m.dot / 2 : '50%',
        marginTop: preview ? 0 : -m.dot / 2,
        width: m.dot,
        height: m.dot,
        borderRadius: m.dot / 2,
        backgroundColor: t.accent,
      }}
    />
  )
  // A bar standing in for a line keeps the line's pitch: each cell is a line box, its content centred
  const cell = (height: number, grow?: boolean): ViewStyle => ({
    minHeight: height,
    justifyContent: 'center',
    ...(grow ? { flex: 1, minWidth: 0 } : { flexShrink: 0 }),
  })
  return (
    <SceneView
      {...rest}
      target={name}
      style={[{ padding: pad, borderRadius: t.radii.lg, backgroundColor: background }, style]}
    >
      <View style={[row, { gap: 10, alignItems: preview ? 'flex-start' : 'center' }]}>
        {lead && (
          <View style={[{ justifyContent: 'center' }, preview ? { height: leadH } : { alignSelf: 'stretch' }]}>
            {lead}
            {dot}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {!lead && dot}
          <View style={[row, { gap: 10 }]}>
            <View
              style={{
                flex: 1,
                minWidth: 0,
                gap: m.gap,
                justifyContent: 'center',
                minHeight: subtitle || preview ? m.line + m.line2 + m.gap : undefined,
              }}
            >
              <View style={[row, { gap: 8, minHeight: m.line }]}>
                <View style={cell(m.line, true)}>
                  <Label lines={1} style={{ fontSize: m.title, fontWeight: '600', lineHeight: m.line, color: t.text }}>
                    {title}
                  </Label>
                </View>
                {meta && (
                  <View style={cell(m.line)}>
                    <Label lines={1} style={{ fontSize: m.meta, lineHeight: m.line, color: t.textFaint }}>
                      {meta}
                    </Label>
                  </View>
                )}
              </View>
              {subtitle && (
                <View style={cell(m.line2)}>
                  <Label lines={1} style={{ fontSize: m.subtitle, lineHeight: m.line2, color: t.muted }}>
                    {subtitle}
                  </Label>
                </View>
              )}
            </View>
            {trailing && (
              <View style={[row, { gap: 10 }]} onLayout={(event) => setTrail(event.nativeEvent.layout.width)}>
                {children}
              </View>
            )}
          </View>
          {/* Preview lines: under the subtitle, in the text column, at its pitch */}
          {preview && (
            <View style={{ paddingRight: trailing && trail ? trail + 10 : 0 }}>
              {bars ? (
                <View style={{ alignItems: 'flex-start', gap: m.line2 - 6, paddingTop: (m.line2 - 6) / 2 }}>
                  {(preview as number[]).map((w, i) => (
                    <Bar key={i} w={w} h={6} tone={2} />
                  ))}
                </View>
              ) : (
                <Label lines={2} style={{ fontSize: m.subtitle, lineHeight: m.line2, color: t.muted }}>
                  {preview}
                </Label>
              )}
            </View>
          )}
        </View>
      </View>
    </SceneView>
  )
}
