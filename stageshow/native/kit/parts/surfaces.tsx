import { useState, type ReactNode } from 'react'
import { Animated, View } from 'react-native'
import { useLook } from '../look'
import { useTween } from '../animate'
import { SceneView, Label, row, type NativeProps } from '../native'
import type { Rect } from '../geometry'
import { Icon } from './Icon'
import { Probe } from '../motion/layout'
import { Bar } from '../window'

export function Meter({
  value,
  tone = 'accent',
  style,
  ...rest
}: NativeProps & { value: number; tone?: 'accent' | 'danger' | 'warning' | 'success' | 'ink' }) {
  const { tokens } = useLook(),
    p = useTween(Math.max(0, Math.min(1, value)), 500)
  return (
    <SceneView
      {...rest}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(1, value)) * 100) }}
      style={[{ height: 6, borderRadius: 3, backgroundColor: tokens.well, overflow: 'hidden', minWidth: 60 }, style]}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 3,
          width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: tone === 'ink' ? tokens.ink[4] : tokens[tone],
        }}
      />
    </SceneView>
  )
}
export function Menu({
  items,
  value,
  targets,
  style,
  ...rest
}: NativeProps & { items: ReactNode[]; value?: number; targets?: (string | undefined)[] }) {
  const { tokens } = useLook()
  return (
    <SceneView {...rest} accessibilityRole="menu" style={[{ padding: 4, gap: 2 }, style]}>
      {items.map((item, i) => (
        <SceneView
          key={i}
          target={targets?.[i]}
          cursor="hand"
          accessibilityRole="menuitem"
          hoverStyle={{ backgroundColor: tokens.accentSoft }}
          style={[
            row,
            {
              gap: 8,
              paddingVertical: 7,
              paddingHorizontal: 10,
              borderRadius: 5,
              backgroundColor: value === i ? tokens.accentSoft : 'transparent',
            },
          ]}
        >
          <Label>{item}</Label>
        </SceneView>
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
  const { tokens, fidelity } = useLook(),
    p = useTween(show ? 1 : 0, show ? 350 : 200)
  return (
    <SceneView
      {...rest}
      hidden={!show}
      accessibilityLiveRegion="polite"
      style={[
        row,
        {
          gap: 9,
          alignSelf: 'center',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: '#28292d',
          opacity: p,
          transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
        style,
      ]}
    >
      {icon}
      {fidelity === 'minimal' && typeof children === 'string' ? (
        <Bar w={Math.min(160, children.length * 5.5)} />
      ) : (
        <Label style={{ color: '#fff' }}>{children}</Label>
      )}
      {action && <Label style={{ color: tokens.accent }}>{action}</Label>}
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
  const [size, setSize] = useState({ width: 0, height: 0 }),
    p = useTween(show && at.width > 0 ? 1 : 0, show ? 180 : 120)
  return (
    <SceneView
      {...rest}
      hidden={!show}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={[
        {
          position: 'absolute',
          left: at.x + at.width / 2 - size.width / 2,
          top: side === 'below' ? at.y + at.height + gap : at.y - gap - size.height,
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderRadius: 5,
          backgroundColor: '#28292d',
          opacity: p,
          transform: [
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [side === 'below' ? -3 : 3, 0] }) },
          ],
          zIndex: 500,
        },
        style,
      ]}
    >
      <Label style={{ color: '#fff', fontSize: 10 }}>{children}</Label>
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
    [width, setWidth] = useState(0),
    p = useTween(show ? 1 : 0, 300)
  const content = (
    <View
      style={[
        row,
        {
          alignSelf: 'flex-start',
          height: 24,
          gap: 5,
          paddingHorizontal: 8,
          borderRadius: 6,
          backgroundColor: t.well,
          borderWidth: 0.5,
          borderColor: t.border,
        },
      ]}
    >
      <Label lines={1} style={{ fontSize: 11 }}>
        {children}
      </Label>
      {remove !== undefined && (
        <SceneView target={remove || undefined} cursor="hand">
          <Icon name="close" size={10} stroke={1.8} />
        </SceneView>
      )}
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
          overflow: 'hidden',
          marginRight: p.interpolate({ inputRange: [0, 1], outputRange: [-gap, 0] }),
          opacity: p,
        },
        style,
      ]}
    >
      <Probe onSize={(size) => setWidth(size.width)}>{content}</Probe>
      <View style={{ position: 'absolute', width: width || undefined }}>{content}</View>
    </SceneView>
  )
}
