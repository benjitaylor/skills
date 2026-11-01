import { useId, type ReactNode } from 'react'
import { Animated, Image, View, type StyleProp, type TextStyle } from 'react-native'
import Svg, { Circle, Path, SvgXml, SvgUri, Defs, LinearGradient, Stop } from 'react-native-svg'
import { Mask } from '../mask'
import { useLook } from '../look'
import { SceneView, Label, row, type NativeProps } from '../native'
import { useCycle, useTween, useNumber } from '../animate'
import { brandMarks, type BrandName, type BrandAsset } from '../brands'
import { Bar } from '../window'

const PEOPLE = ['#c98f6e', '#6f9b7d', '#7b86c7', '#c47a9e', '#8c9ab0', '#c2a35a']
export function personColor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 9973
  return PEOPLE[hash % PEOPLE.length]
}
export interface AvatarProps extends NativeProps {
  name?: string
  plain?: boolean
  size?: number
  tone?: 'accent' | 'ink' | 'success' | 'person' | 'ios'
  src?: string
  ring?: 'pending' | 'waiting' | 'confirmed' | 'declined'
}
export function Avatar({
  name = '',
  plain,
  size = 24,
  tone = name ? 'person' : 'ink',
  src,
  ring,
  style,
  ...rest
}: AvatarProps) {
  const { fidelity, tokens: t } = useLook(),
    spin = useCycle(1300, ring === 'waiting')
  const disc = plain || fidelity === 'minimal',
    words = name.trim().split(/\s+/).filter(Boolean)
  const initial =
    tone === 'ios'
      ? (words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')
      : (name.trim()[0] ?? '')
  const fill =
    tone === 'person' && !disc
      ? personColor(name)
      : tone === 'accent'
        ? t.accent
        : tone === 'success'
          ? t.success
          : tone === 'ios'
            ? '#929dab'
            : t.ink[2]
  const ringColor = ring === 'confirmed' ? t.success : ring === 'declined' ? t.danger : t.ink[3]
  return (
    <SceneView {...rest} style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {ring && (
        <View
          style={{
            position: 'absolute',
            left: -4,
            top: -4,
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderWidth: 1.5,
            borderColor: ringColor,
          }}
        />
      )}
      {ring === 'waiting' && (
        <Animated.View
          style={{
            position: 'absolute',
            left: -4,
            top: -4,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }}
        >
          <Svg width={size + 8} height={size + 8}>
            <Circle
              cx={(size + 8) / 2}
              cy={(size + 8) / 2}
              r={(size + 5) / 2}
              fill="none"
              stroke={t.accent}
              strokeWidth={1.5}
              strokeDasharray={[size * 0.5, size * 3]}
            />
          </Svg>
        </Animated.View>
      )}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {src && !disc ? (
          <Image source={{ uri: src }} style={{ width: size, height: size }} />
        ) : (
          !disc && (
            <Label
              style={{
                color: tone === 'ink' ? t.muted : '#fff',
                fontWeight: '500',
                fontSize: Math.round(size * (tone === 'ios' ? 0.4 : size < 24 ? 0.5 : 0.42)),
              }}
            >
              {initial.toUpperCase()}
            </Label>
          )
        )}
      </View>
    </SceneView>
  )
}
export function Check({
  on,
  pending,
  size = 16,
  style,
  ...rest
}: NativeProps & { on: boolean; pending?: boolean; size?: number }) {
  const { tokens, theme, palette } = useLook()
  const fill = useNumber(useTween(on ? 1 : 0, on ? 400 : 200, { ease: [0.22, 1, 0.36, 1] }))
  const tick = useNumber(useTween(on ? 1 : 0, on ? 320 : 200, { delay: on ? 160 : 0, ease: [0.65, 0, 0.35, 1] }))
  const spin = useCycle(800, !!pending && !on)
  return (
    <SceneView {...rest} style={[{ width: size, height: size }, style]}>
      <Svg viewBox="0 0 16 16" width={size} height={size}>
        <Circle cx={8} cy={8} r={7.25} stroke={tokens.ink[3]} strokeWidth={1.5} fill="none" opacity={1 - fill} />
        <Circle cx={8} cy={8} r={8 * (0.35 + 0.65 * fill)} fill={tokens.success} opacity={on ? 1 : fill} />
        <Path
          d="M4.5 8.2 7 10.6l4.6-5"
          fill="none"
          stroke={theme === 'blueprint' ? tokens.well : theme === 'dark' && palette === 'mono' ? '#111' : '#fff'}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[11, 11]}
          strokeDashoffset={on ? 11 * (1 - tick) : 0}
          opacity={tick}
        />
      </Svg>
      {pending && !on && (
        <Animated.View
          style={{
            position: 'absolute',
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
    </SceneView>
  )
}
export function Spinner({ size = 16, style, ...rest }: NativeProps & { size?: number }) {
  const { tokens } = useLook(),
    p = useCycle(900)
  return (
    <SceneView
      {...rest}
      accessibilityLabel={rest.accessibilityLabel ?? 'Loading'}
      style={[
        {
          width: size,
          height: size,
          transform: [{ rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Circle cx={10} cy={10} r={7} stroke={tokens.border} strokeWidth={2} fill="none" />
        <Path d="M10 3a7 7 0 0 1 7 7" stroke={tokens.accent} strokeWidth={2} strokeLinecap="round" fill="none" />
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
  const { fidelity, tokens: t } = useLook(),
    color = tone === 'accent' ? t.accent : t.ink[3]
  const radii = {
    borderTopLeftRadius: corner === 'tl' ? 0 : size / 2,
    borderTopRightRadius: corner === 'tr' ? 0 : size / 2,
    borderBottomLeftRadius: corner === 'bl' ? 0 : size / 2,
    borderBottomRightRadius: corner === 'br' ? 0 : size / 2,
  }
  return (
    <SceneView
      {...rest}
      style={[
        {
          width: size,
          height: size,
          ...radii,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected ? `0 0 0 3px ${color}` : undefined,
        },
        style,
      ]}
    >
      {src && fidelity !== 'minimal' ? (
        <Image source={{ uri: src }} style={{ width: size, height: size, ...radii }} />
      ) : (
        fidelity !== 'minimal' && (
          <Label style={{ color: '#fff', fontSize: Math.round(size * 0.42) }}>{name.trim()[0]?.toUpperCase()}</Label>
        )
      )}
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
  const { fidelity, theme, tokens } = useLook(),
    asset: BrandAsset | undefined = brand ? brandMarks[brand] : undefined
  const dark = (surface ?? (theme === 'dark' || theme === 'blueprint' ? 'dark' : 'light')) === 'dark'
  const label = name ?? asset?.name ?? '',
    artwork = src ?? (tile && asset?.tileArtwork ? asset.tileArtwork : dark ? asset?.dark : asset?.light)
  const w = width ?? (asset && !src ? Math.round(size * asset.proportion) : size),
    scale = tile ? (asset?.scale ?? 0.68) : 1
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
          borderRadius: Math.round(size * 0.24),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: tile
            ? (asset?.tileBackground ?? (dark && asset?.dark === asset?.light ? '#fff' : tokens.well))
            : 'transparent',
        },
        style,
      ]}
    >
      {artwork && fidelity !== 'minimal' ? (
        artwork.trim().startsWith('<') ? (
          <SvgXml
            // SVG permits leading-dot offsets; react-native-svg's stop parser needs the zero.
            xml={artwork.replace(/(\boffset\s*=\s*["'])\.(\d)/g, (_, prefix, digit) => `${prefix}0.${digit}`)}
            width={w * scale}
            height={size * scale}
          />
        ) : /\.svg(?:\?|$)/i.test(artwork) ? (
          <SvgUri uri={artwork} width={w * scale} height={size * scale} />
        ) : (
          <Image source={{ uri: artwork }} resizeMode="contain" style={{ width: w * scale, height: size * scale }} />
        )
      ) : (
        <Label style={{ fontSize: Math.round(size * 0.42) }}>
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
  style,
  ...rest
}: NativeProps & { names: string[]; size?: number; overlap?: number; gap?: number; tones?: AvatarProps['tone'][] }) {
  const r = size / 2
  return (
    <SceneView {...rest} style={[row, style]}>
      {names.map((name, i) => {
        const path = `M0 0H${size}V${size}H0Z${i < names.length - 1 ? `M${size - overlap - gap} ${r}a${r + gap} ${r + gap} 0 1 0 ${2 * (r + gap)} 0a${r + gap} ${r + gap} 0 1 0 ${-2 * (r + gap)} 0` : ''}`
        const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path d="${path}" fill="black" fill-rule="evenodd"/></svg>`
        return (
          <Mask key={i} xml={xml} style={{ width: size, height: size, marginLeft: i ? -overlap : 0 }}>
            <Avatar name={name} size={size} tone={tones?.[i] ?? 'person'} />
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
  const { tokens: t } = useLook()
  return (
    <SceneView
      {...rest}
      hoverStyle={{ backgroundColor: t.well }}
      pressedStyle={{ opacity: 0.8 }}
      style={[{ padding: pad, borderRadius: 8, backgroundColor: selected ? t.accentSoft : 'transparent' }, style]}
    >
      {unread && (
        <View
          style={{
            position: 'absolute',
            left: 2,
            top: pad + 8,
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: t.accent,
          }}
        />
      )}
      <View style={[row, { gap: 10 }]}>
        {lead}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[row, { justifyContent: 'space-between', gap: 8 }]}>
            <Label style={{ flexShrink: 1, fontWeight: '500' }}>{title}</Label>
            {meta && <Label style={{ color: t.muted, fontSize: 10 }}>{meta}</Label>}
          </View>
          {subtitle && <Label style={{ color: t.muted, fontSize: 11 }}>{subtitle}</Label>}
        </View>
        {children}
      </View>
      {preview && (
        <View style={{ marginLeft: lead ? 34 : 0, marginTop: 6, gap: 5 }}>
          {Array.isArray(preview) && preview.every((n) => typeof n === 'number') ? (
            preview.map((w, i) => <Bar key={i} w={w} h={6} tone={2} />)
          ) : (
            <Label style={{ color: t.muted }}>{preview}</Label>
          )}
        </View>
      )}
    </SceneView>
  )
}
