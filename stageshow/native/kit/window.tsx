import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  StyleSheet,
  Text as RNText,
  View,
  type DimensionValue,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import { useLook, LookContext, resolveTokens } from './look'
import { Label, SceneView, row, useScene, SuppressTargets, type NativeProps } from './native'
import { useCycle, useTween } from './animate'
import { Glass } from './glass'
import { absolute } from './native'
import type { CaretLine } from './registry'
import { Icon } from './parts/Icon'

export interface WindowProps extends NativeProps {
  url?: ReactNode
  urlShape?: 'rounded' | 'pill'
  tabs?: ReactNode[]
  nav?: boolean
  title?: string
  sidebar?: ReactNode
  sidebarWidth?: number
  sidebarStyle?: 'flush' | 'floating'
  toolbar?: ReactNode
  lead?: ReactNode
  body?: NativeProps
  receded?: boolean
  chrome?: 'native' | 'glass' | 'terminal' | 'card' | 'hairline'
  lights?: 'color' | 'grey' | 'white'
  lightsSize?: 'standard' | 'large'
  barSize?: 'standard' | 'tall'
}
export function Window({
  url,
  urlShape,
  tabs,
  nav,
  title,
  sidebar,
  sidebarWidth = 180,
  sidebarStyle = 'flush',
  toolbar,
  lead,
  body,
  receded,
  chrome = 'native',
  lights,
  lightsSize,
  barSize,
  style,
  children,
  ...rest
}: WindowProps) {
  const look = useLook(),
    { tokens: t, palette, theme } = look
  const opacity = useTween(receded ? 0.4 : 1, 350)
  const terminal = chrome === 'terminal',
    floating = sidebarStyle === 'floating'
  const lightSize = lightsSize === 'large' ? 12 : chrome === 'hairline' ? 6 : 9
  const barHeight = barSize === 'tall' ? 64 : chrome === 'hairline' ? 28 : 38
  const lightColors =
    lights === 'white'
      ? ['#fff', '#fff', '#fff']
      : lights === 'grey' || chrome === 'glass' || palette === 'mono'
        ? [t.ink[4], t.ink[4], t.ink[4]]
        : ['#ff5f57', '#febc2e', '#28c840']
  const dots = (
    <View style={[row, { gap: lightsSize === 'large' ? 8 : 6, height: barHeight }]}>
      {lightColors.map((color, i) => (
        <View
          key={i}
          style={{
            width: lightSize,
            height: lightSize,
            borderRadius: lightSize / 2,
            backgroundColor: theme === 'blueprint' ? 'transparent' : color,
            borderWidth: 0.5,
            borderColor: theme === 'blueprint' ? t.border : 'rgba(0,0,0,.12)',
          }}
        />
      ))}
    </View>
  )
  const address = url !== undefined && (
    <>
      {nav && (
        <View style={[row, { gap: 10 }]}>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="chevron-right" size={12} />
          </View>
          <Icon name="chevron-right" size={12} />
        </View>
      )}
      <View
        style={[
          row,
          {
            flex: 1,
            minWidth: 0,
            marginLeft: 8,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: urlShape === 'pill' || chrome === 'glass' ? 99 : 6,
            backgroundColor: chrome === 'hairline' ? 'transparent' : t.well,
            justifyContent: 'center',
            gap: 5,
          },
        ]}
      >
        {chrome === 'glass' && <Icon name="lock" size={9} />}
        <Label lines={1} style={{ fontSize: 10.5, color: t.muted }}>
          {url}
        </Label>
      </View>
    </>
  )
  const bar = (
    <View
      style={[
        row,
        {
          height: barHeight,
          gap: 8,
          paddingHorizontal: 14,
          borderBottomWidth: terminal || chrome === 'card' ? 0 : 0.5,
          borderBottomColor: t.border,
          backgroundColor: terminal ? '#191b20' : t.well,
        },
      ]}
    >
      {sidebar === undefined && !tabs?.length && dots}
      {address}
      {title !== undefined && (
        <Label
          lines={1}
          style={{
            flex: 1,
            fontSize: 12,
            color: terminal ? '#a0a3aa' : t.text,
            fontWeight: '600',
            textAlign: sidebar !== undefined || toolbar ? 'left' : 'center',
          }}
        >
          {title}
        </Label>
      )}
      {lead}
      {url === undefined && title === undefined && <View style={{ flex: 1 }} />}
      {toolbar}
    </View>
  )
  return (
    <LookContext.Provider value={terminal ? { ...look, theme: 'dark', tokens: resolveTokens('dark', palette) } : look}>
      <SceneView
        {...rest}
        style={[
          {
            borderRadius: floating ? 24 : t.radius,
            borderWidth: 0.5,
            borderColor: t.border,
            backgroundColor: terminal ? '#191b20' : t.surface,
            overflow: 'hidden',
            opacity,
            boxShadow: '0 12px 35px rgba(0,0,0,0.12)',
          },
          style,
        ]}
      >
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {chrome === 'glass' && <Glass tint={theme === 'dark' ? 'dark' : 'light'} intensity={40} style={absolute} />}
          {sidebar !== undefined && (
            <View
              style={{
                width: sidebarWidth,
                margin: floating ? 8 : 0,
                marginRight: floating ? 0 : undefined,
                borderRadius: floating ? 16 : 0,
                backgroundColor: t.well,
                paddingHorizontal: 14,
                borderRightWidth: floating ? 0 : 0.5,
                borderRightColor: t.border,
              }}
            >
              {dots}
              {sidebar}
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            {!!tabs?.length && (
              <View style={[row, { height: 34, gap: 10, paddingHorizontal: 14, backgroundColor: t.well }]}>
                {dots}
                {tabs.map((tab, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      alignSelf: 'flex-end',
                      padding: 7,
                      backgroundColor: i === 0 ? t.surface : 'transparent',
                      borderTopLeftRadius: 7,
                      borderTopRightRadius: 7,
                    }}
                  >
                    <Label lines={1} style={{ fontSize: 10 }}>
                      {tab}
                    </Label>
                  </View>
                ))}
              </View>
            )}
            {bar}
            <SceneView
              {...body}
              style={[
                { flex: 1, minHeight: 0 },
                chrome === 'glass' && { margin: 8, borderRadius: 8, backgroundColor: t.surface },
                body?.style,
              ]}
            >
              {children}
            </SceneView>
          </View>
        </View>
      </SceneView>
    </LookContext.Provider>
  )
}
export interface BarProps extends NativeProps {
  w: number | string
  h?: number
  tone?: 1 | 2 | 3 | 4 | 5
  r?: number
  shrink?: boolean
}
export function Bar({ w, h = 6, tone = 3, r = 2, shrink, style, ...rest }: BarProps) {
  const { tokens } = useLook()
  return (
    <SceneView
      {...rest}
      style={[
        {
          width: w as DimensionValue,
          maxWidth: '100%',
          height: h,
          borderRadius: r,
          backgroundColor: tokens.ink[tone - 1],
          flexShrink: (shrink ?? (typeof w === 'number' && w > h * 3)) ? 1 : 0,
        },
        style,
      ]}
    />
  )
}
export interface TextProps extends Omit<NativeProps, 'style' | 'children'> {
  children: string
  filler?: boolean
  w?: number
  h?: number
  tone?: BarProps['tone']
  wrap?: boolean
  style?: StyleProp<TextStyle>
}
export function Text({
  children,
  filler,
  w,
  h = 6,
  tone = 3,
  wrap,
  style,
  target,
  'data-target': alias,
  ...rest
}: TextProps) {
  const { fidelity, tokens } = useLook(),
    scene = useScene(),
    suppressed = useContext(SuppressTargets),
    name = suppressed ? undefined : (target ?? alias)
  const textStyle = StyleSheet.flatten(style),
    linesRef = useRef<CaretLine[]>([]),
    [lines, setLines] = useState<CaretLine[]>([])
  const plain = fidelity === 'minimal' || (filler && fidelity !== 'realistic')
  useEffect(() => {
    if (name && scene?.registry.entries.get(name)) scene.registry.entries.get(name)!.lines = linesRef.current
  }, [name, children, scene])
  if (plain)
    return (
      <Bar
        {...rest}
        target={name}
        w={w ?? Math.round(children.length * (textStyle?.fontSize ?? 11) * 0.52)}
        h={h}
        tone={tone}
      />
    )
  return (
    <SceneView {...rest} target={name} style={{ flexShrink: 1 }}>
      <RNText
        numberOfLines={wrap ? undefined : 1}
        style={[
          { fontSize: tokens.fontSize, color: tokens.text, fontFamily: tokens.fontFamily, includeFontPadding: false },
          style,
        ]}
        onTextLayout={(event) => {
          let offset = 0
          const before = linesRef.current
          linesRef.current = event.nativeEvent.lines.map((line, i) => {
            const result = {
              ...line,
              offset,
              stops: before[i]?.text === line.text && before[i]?.width === line.width ? before[i].stops : undefined,
            }
            offset += line.text.length
            return result
          })
          if (name && scene?.registry.entries.get(name)) {
            scene.registry.entries.get(name)!.lines = linesRef.current
            setLines((old) =>
              JSON.stringify(old.map(({ stops, ...line }) => line)) ===
              JSON.stringify(linesRef.current.map(({ stops, ...line }) => line))
                ? old
                : linesRef.current,
            )
          }
        }}
      >
        {children}
      </RNText>
      {name &&
        lines.map((line, lineIndex) => (
          <View
            key={`${lineIndex}:${line.text}`}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', opacity: 0, width: 10000 }}
          >
            {Array.from({ length: line.text.length }, (_, index) => (
              <RNText
                key={index}
                numberOfLines={1}
                style={[
                  {
                    position: 'absolute',
                    fontSize: tokens.fontSize,
                    fontFamily: tokens.fontFamily,
                    includeFontPadding: false,
                  },
                  style,
                ]}
                onTextLayout={(event) => {
                  const current = linesRef.current[lineIndex]
                  if (!current || current.text !== line.text) return
                  current.stops ??= Array.from(
                    { length: current.text.length + 1 },
                    (_, i) => (i / current.text.length) * current.width,
                  )
                  current.stops[index + 1] = event.nativeEvent.lines[0]?.width ?? 0
                }}
              >
                {line.text.slice(0, index + 1)}
              </RNText>
            ))}
          </View>
        ))}
    </SceneView>
  )
}
export interface PromptProps extends NativeProps {
  path?: string
}
export function Prompt({ path = '~', children, style, ...rest }: PromptProps) {
  return (
    <SceneView {...rest} style={[row, { gap: 8 }, style]}>
      <Label style={{ color: '#9ca0ac', fontFamily: 'monospace' }}>{path}</Label>
      <Label style={{ color: '#8de4b1' }}>❯</Label>
      <Label style={{ color: '#f0f0f4', fontFamily: 'monospace' }}>{children}</Label>
    </SceneView>
  )
}
export function Caret({ still }: { still?: boolean }) {
  const blink = useCycle(1000, !still)
  return (
    <Animated.View
      accessibilityElementsHidden
      style={{
        width: 7,
        height: 13,
        backgroundColor: '#b5c0d0',
        opacity: still ? 1 : blink.interpolate({ inputRange: [0, 0.49, 0.5, 0.99, 1], outputRange: [1, 1, 0, 0, 1] }),
      }}
    />
  )
}
