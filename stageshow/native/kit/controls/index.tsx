import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, View } from 'react-native'
import { SceneView, Label, row, type NativeProps } from '../native'
import { useLook } from '../look'
import { useTween, useCycle } from '../animate'
import { clock } from '../clock'
import { Icon } from '../parts/Icon'
import type { CursorKind } from '../cursor-types'

function FieldCaret({ color }: { color: string }) {
  const blink = useCycle(1000)
  return (
    <Animated.View
      style={{
        width: 1,
        height: 14,
        marginLeft: 1,
        backgroundColor: color,
        opacity: blink.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] }),
      }}
    />
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
  style,
  ...rest
}: FieldProps) {
  const { tokens: t } = useLook(),
    held = useRef(''),
    [leaving, setLeaving] = useState(false)
  if (chip && value) held.current = value
  useLayoutEffect(() => {
    if (chip || value || !held.current) {
      setLeaving(false)
      return
    }
    setLeaving(true)
    const id = clock.timeout(() => {
      held.current = ''
      setLeaving(false)
    }, 220)
    return () => clock.clearTimeout(id)
  }, [chip, value])
  const shown = value || (leaving ? held.current : '')
  const opacity = useTween(leaving ? 0 : 1, 200)
  const borderColor = status === 'error' ? t.danger : status === 'valid' ? t.success : focused ? t.accent : t.border
  return (
    <SceneView {...rest} style={[{ gap: 6 }, style]}>
      {label && <Label style={{ fontSize: 11, color: t.muted }}>{label}</Label>}
      <SceneView
        cursor="ibeam"
        {...box}
        style={[
          row,
          {
            minHeight: 36,
            gap: 7,
            borderWidth: 1,
            borderColor,
            borderRadius: 7,
            paddingHorizontal: 10,
            backgroundColor: t.surface,
            boxShadow: focused ? `0 0 0 2px ${t.accentSoft}` : undefined,
          },
          box?.style,
        ]}
      >
        {leading}
        <View style={[row, { flex: 1, minWidth: 0, minHeight: 20, overflow: 'hidden' }]}>
          {!shown && (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0 }}>
              <Label lines={1} style={{ color: t.muted }}>
                {placeholder}
              </Label>
            </View>
          )}
          {!!shown && (
            <Animated.View
              style={[
                row,
                {
                  gap: 4,
                  borderRadius: 4,
                  paddingHorizontal: chip || leaving ? 5 : 0,
                  paddingVertical: chip || leaving ? 3 : 0,
                  backgroundColor: chip || leaving ? t.well : 'transparent',
                  opacity,
                },
              ]}
            >
              <Label lines={1}>{password ? '•'.repeat(shown.length) : shown}</Label>
              {remove !== undefined && (chip || leaving) && (
                <SceneView target={remove || undefined} cursor="hand">
                  <Icon name="close" size={10} />
                </SceneView>
              )}
            </Animated.View>
          )}
          {focused && !chip && <FieldCaret key={value} color={t.accent} />}
        </View>
        {status === 'valid' && <Icon name="check" size={14} color={t.success} />}
        {trailing}
      </SceneView>
    </SceneView>
  )
}
export function Segmented({
  items,
  value,
  targets,
  cursor,
  style,
  ...rest
}: NativeProps & { items: ReactNode[]; value: number; targets?: (string | undefined)[]; cursor?: CursorKind }) {
  const { tokens } = useLook(),
    [width, setWidth] = useState(0),
    x = useTween(
      (Math.max(0, Math.min(value, items.length - 1)) * Math.max(0, width - 4)) / Math.max(1, items.length),
      280,
    )
  return (
    <SceneView
      {...rest}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[row, { padding: 2, backgroundColor: tokens.well, borderRadius: 7, height: 30 }, style]}
    >
      {!!items.length && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            bottom: 2,
            width: Math.max(0, width - 4) / items.length,
            borderRadius: 5,
            backgroundColor: tokens.surface,
            boxShadow: '0 1px 3px rgba(0,0,0,.1)',
            transform: [{ translateX: x }],
          }}
        />
      )}
      {items.map((item, i) => (
        <SceneView
          key={i}
          target={targets?.[i]}
          cursor={cursor}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === i }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 26 }}
        >
          <Label style={{ color: value === i ? tokens.text : tokens.muted, fontSize: 11 }}>{item}</Label>
        </SceneView>
      ))}
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
  const { tokens } = useLook(),
    [rects, setRects] = useState<Record<number, { x: number; width: number }>>({})
  const rect = rects[value] ?? { x: 0, width: 0 },
    x = useTween(rect.x, 300),
    width = useTween(rect.width, 300)
  return (
    <SceneView {...rest} style={[row, { gap: 16, borderBottomWidth: 1, borderBottomColor: tokens.border }, style]}>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: -1,
          left: 0,
          height: 2,
          backgroundColor: tokens.accent,
          borderRadius: 1,
          width,
          transform: [{ translateX: x }],
        }}
      />
      {items.map((item, i) => (
        <SceneView
          key={i}
          target={targets?.[i]}
          cursor="hand"
          accessibilityRole="tab"
          accessibilityState={{ selected: i === value }}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout
            setRects((r) => (r[i]?.x === x && r[i]?.width === width ? r : { ...r, [i]: { x, width } }))
          }}
          style={{ paddingVertical: 10 }}
        >
          <Label style={{ color: i === value ? tokens.text : tokens.muted }}>{item}</Label>
        </SceneView>
      ))}
    </SceneView>
  )
}
export function Toggle({ on, style, ...rest }: NativeProps & { on: boolean }) {
  const { tokens } = useLook(),
    p = useTween(on ? 1 : 0, 250)
  return (
    <SceneView
      {...rest}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[
        {
          width: 30,
          height: 18,
          borderRadius: 9,
          padding: 2,
          backgroundColor: p.interpolate({ inputRange: [0, 1], outputRange: [tokens.ink[2], tokens.accent] }),
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#fff',
          transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }],
          boxShadow: '0 1px 2px rgba(0,0,0,.15)',
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
  const { tokens } = useLook(),
    color = tone === 'neutral' ? tokens.muted : tokens[tone]
  return (
    <SceneView
      {...rest}
      style={[
        row,
        {
          alignSelf: 'flex-start',
          gap: 4,
          paddingHorizontal: 7,
          paddingVertical: 4,
          borderRadius: 5,
          backgroundColor: tone === 'accent' ? tokens.accentSoft : tokens.well,
        },
        style,
      ]}
    >
      {dot && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />}
      {icon}
      <Label style={{ fontSize: 10, fontWeight: '500', color }}>{children}</Label>
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
  const { tokens } = useLook(),
    p = useTween(open ? 1 : 0, 400)
  return (
    <SceneView
      {...rest}
      hidden={!open}
      style={[
        {
          height: Animated.multiply(p, height),
          marginTop: p.interpolate({ inputRange: [0, 1], outputRange: [-gap, 0] }),
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          height,
          borderWidth: dashed ? 1 : 0,
          borderStyle: 'dashed',
          borderColor: tokens.border,
          borderRadius: 8,
        }}
      >
        {children}
      </View>
    </SceneView>
  )
}
