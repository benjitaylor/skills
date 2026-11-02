import { useId, useState, type ReactNode } from 'react'
import { Animated, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect as SvgRect, Stop } from 'react-native-svg'
import { useLook } from '../look'
import { useTween } from '../animate'
import { SceneView, Label, row, absolute, type NativeProps } from '../native'
import type { Rect } from '../geometry'
import { Icon, InkContext } from './Icon'
import { Probe } from '../motion/layout'
import { Bar } from '../window'
import { useColor, useFade, useFill, useHover } from './transitions'

export function Meter({
  value,
  tone = 'accent',
  style,
  onLayout,
  ...rest
}: NativeProps & { value: number; tone?: 'accent' | 'danger' | 'warning' | 'success' | 'ink' }) {
  const { tokens: t } = useLook(),
    v = Math.max(0, Math.min(1, value)),
    [width, setWidth] = useState(0),
    gradient = useId().replace(/[^a-zA-Z0-9]/g, '')
  const p = useTween(v, 800, { ease: [0.45, 0, 0.2, 1] })
  // Tones are a flat layer over the accent gradient that fades in and out: a gradient can't ease to a flat colour
  const toned = useFade(tone !== 'accent', 400),
    toneColor = useColor(tone === 'ink' ? t.ink[4] : t[tone], 400)
  return (
    <SceneView
      {...rest}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      onLayout={(event) => {
        onLayout?.(event)
        setWidth(event.nativeEvent.layout.width)
      }}
      style={[{ height: 6, borderRadius: 3, backgroundColor: t.ink[0], overflow: 'hidden' }, style]}
    >
      {/* Revealed by a clip rather than drawn to width, so the gradient spans the track and the end stays round */}
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 3,
          overflow: 'hidden',
          width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      >
        <Svg width={width} height={6} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={t.accent} />
              <Stop offset="1" stopColor={t.accent2} />
            </LinearGradient>
          </Defs>
          <SvgRect width={width} height={6} fill={`url(#${gradient})`} />
        </Svg>
        <Animated.View style={[absolute, { backgroundColor: toneColor, opacity: toned }]} />
      </Animated.View>
    </SceneView>
  )
}
function MenuItem({ item, active, target }: { item: ReactNode; active: boolean; target?: string }) {
  const { tokens: t } = useLook()
  // The item under the cursor highlights at once and eases out, as in a real menu
  const hover = useHover(target),
    background = useFill(active || hover, t.ink[1], hover ? 0 : 150, 150)
  return (
    <SceneView
      target={target}
      accessibilityRole="menuitem"
      style={[
        row,
        { gap: 8, height: t.row, paddingHorizontal: 8, borderRadius: t.radii.sm, backgroundColor: background },
      ]}
    >
      <Label style={{ fontSize: 12, color: t.text }}>{item}</Label>
    </SceneView>
  )
}
/** Rows for a Popover, which gives the menu its inset. */
export function Menu({
  items,
  value,
  targets,
  style,
  ...rest
}: NativeProps & { items: ReactNode[]; value?: number; targets?: (string | undefined)[] }) {
  return (
    <SceneView {...rest} accessibilityRole="menu" style={style}>
      {items.map((item, i) => (
        <MenuItem key={i} item={item} active={value === i} target={targets?.[i]} />
      ))}
    </SceneView>
  )
}
export function Toast({
  show,
  icon,
  action,
  children,
  style,
  ...rest
}: NativeProps & { show: boolean; icon?: ReactNode; action?: ReactNode }) {
  const { tokens: t, theme, fidelity } = useLook()
  const opacity = useFade(show, 350),
    // It rises 10px as it shows; the web's equal and opposite margins move it without moving its neighbours
    rise = useTween(show ? 0 : 10, 600, { ease: [0.22, 1, 0.36, 1] })
  // A dark pill on light themes, the raised surface on dark
  const dark = theme === 'dark',
    ink = dark ? t.text : '#fff'
  return (
    <SceneView
      {...rest}
      hidden={!show}
      accessibilityLiveRegion="polite"
      style={[
        row,
        {
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: t.radii.lg,
          backgroundColor: dark ? t.raised : '#1c1c1f',
          boxShadow: t.shadow.satellite,
          opacity,
          transform: [{ translateY: rise }],
        },
        style,
      ]}
    >
      <InkContext.Provider value={ink}>
        {icon && <View style={{ opacity: 0.8 }}>{icon}</View>}
        {fidelity === 'minimal' && typeof children === 'string' ? (
          <Bar w={Math.min(160, children.length * 5.5)} r={3} />
        ) : (
          <Label style={{ color: ink, fontSize: 12 }}>{children}</Label>
        )}
        {action && (
          <View style={{ marginLeft: 6 }}>
            <InkContext.Provider value="rgba(255,255,255,0.6)">
              <Label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' }}>{action}</Label>
            </InkContext.Provider>
          </View>
        )}
      </InkContext.Provider>
    </SceneView>
  )
}
export function Tooltip({
  show,
  at,
  side = 'below',
  gap = 6,
  children,
  style,
  ...rest
}: NativeProps & { show: boolean; at: Rect; side?: 'below' | 'above'; gap?: number }) {
  const { tokens: t } = useLook(),
    below = side === 'below'
  // In fast a couple of px from the target's side, out faster
  const p = useFade(show && at.width > 0, 150, 100)
  return (
    <SceneView
      {...rest}
      hidden={!show}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: at.x + at.width / 2,
          top: below ? at.y + at.height + gap : at.y - gap,
          height: 22,
          justifyContent: 'center',
          paddingHorizontal: 8,
          borderRadius: t.radii.sm,
          backgroundColor: '#26262a',
          opacity: p,
          // Centred on the target by its own size, so no frame waits on a measurement
          transform: [
            { translateX: '-50%' },
            { translateY: below ? 0 : '-100%' },
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [below ? -2 : 2, 0] }) },
          ],
          zIndex: 500,
        },
        style,
      ]}
    >
      <Label lines={1} style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>
        {children}
      </Label>
    </SceneView>
  )
}
function ChipX({ target }: { target?: string }) {
  const { tokens: t } = useLook(),
    background = useFill(useHover(target), t.ink[1], 0, 150)
  return (
    <SceneView
      target={target}
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
      }}
    >
      <Icon name="close" size={10} stroke={1.8} color={t.muted} />
    </SceneView>
  )
}
export function Chip({
  show = true,
  remove,
  gap = 0,
  children,
  style,
  ...rest
}: NativeProps & { show?: boolean; remove?: string; gap?: number }) {
  const { tokens: t } = useLook(),
    [width, setWidth] = useState(0)
  // Opening, the slot widens and the chip shows once it is nearly its width; closing, it fades first and the
  // gap closes behind it. Either way the moving edge never slices a visible chip.
  const p = useTween(show ? 1 : 0, 400, { delay: show ? 0 : 100, ease: [0.25, 0.8, 0.25, 1] }),
    opacity = useFade(show, 220, 140, { delay: 160 })
  const content = (
    <View
      style={[
        row,
        {
          alignSelf: 'flex-start',
          height: 24,
          gap: 6,
          paddingLeft: 10,
          // The ×'s round hover sits as far from the end as the label from the start
          paddingRight: remove !== undefined ? 4 : 10,
          borderRadius: t.radii.pill,
          backgroundColor: t.accentSoft,
        },
      ]}
    >
      <Label lines={1} style={{ fontSize: 12, fontWeight: '500', color: t.text }}>
        {children}
      </Label>
      {remove !== undefined && <ChipX target={remove || undefined} />}
    </View>
  )
  return (
    <SceneView
      {...rest}
      hidden={!show}
      style={[
        {
          width: Animated.multiply(p, width),
          height: 24,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: t.radii.pill,
          marginRight: p.interpolate({ inputRange: [0, 1], outputRange: [-gap, 0] }),
          opacity,
        },
        style,
      ]}
    >
      <Probe onSize={(size) => setWidth(size.width)}>{content}</Probe>
      <View style={{ position: 'absolute', width: width || undefined }}>{content}</View>
    </SceneView>
  )
}
