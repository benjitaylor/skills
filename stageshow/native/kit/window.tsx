import { Children, isValidElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  StyleSheet,
  Text as RNText,
  View,
  type DimensionValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { useLook, LookContext, resolveTokens, type Look } from './look'
import { Label, SceneView, row, useScene, SuppressTargets, type NativeProps } from './native'
import { curves, useCycle, useTween } from './animate'
import { Glass, blurIntensity } from './glass'
import { absolute } from './native'
import type { CaretLine } from './registry'

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
type Chrome = NonNullable<WindowProps['chrome']>
/** Terminal colors (window.css, `--ss-term-*` on web): output, path, prompt mark, typed command, caret and the status colors. */
export const termColors = {
  background: '#17171a',
  text: '#9d9da6',
  path: '#6f8ccf',
  sigil: '#6ee7a8',
  command: '#f1f1f3',
  caret: '#e8e8ec',
  ok: '#6ee7a8',
  err: '#f87171',
  dim: '#63636b',
}
/** Terminal type: 11.5px mono on a 1.65 line. */
const TERM_SIZE = 11.5,
  TERM_LINE = TERM_SIZE * 1.65
const PANEL_SHADOW =
    '0 0 0 0.5px rgba(0,0,0,0.07), inset 0 0.5px 0 rgba(255,255,255,1), 0 3px 14px rgba(20,35,70,0.07)',
  PANEL_SHADOW_DARK = '0 0 0 1px rgba(255,255,255,0.08), 0 3px 14px rgba(0,0,0,0.3)'
const FRAMES: Record<'glass' | 'card' | 'hairline', ViewStyle> = {
  glass: {
    backgroundColor: 'rgba(248,250,253,0.45)',
    borderRadius: 12,
    boxShadow: '0 0 0 1px rgba(229,237,245,0.5), 0 15px 35px rgba(23,23,23,0.08)',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 50px 100px -20px rgba(50,50,93,0.25), 0 30px 60px -30px rgba(0,0,0,0.3)',
  },
  hairline: {
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 12px 28px -12px rgba(50,50,93,0.2)',
  },
}
/** The lights' fills, in window.css's cascade order: colored, drawn (blueprint), gray (mono), the quiet
 * `lights` modes, then a card or hairline's own pale dots. Glass, card and hairline take `color` and `white`
 * (glass defaults to grey); native and terminal take only `grey`. */
function lightFills({ theme, palette, tokens }: Look, chrome: Chrome, lights: WindowProps['lights']): ViewStyle[] {
  const framed = chrome === 'glass' || chrome === 'card' || chrome === 'hairline'
  const mode = framed
    ? lights === 'color' || lights === 'white'
      ? lights
      : chrome === 'glass'
        ? 'grey'
        : undefined
    : lights === 'grey'
      ? 'grey'
      : undefined
  const flat = (backgroundColor: string) => [0, 1, 2].map(() => ({ backgroundColor }))
  if ((chrome === 'card' || chrome === 'hairline') && mode !== 'color')
    return flat(chrome === 'card' ? '#ecf2f7' : '#e3e8ee')
  if (mode === 'white') return flat('rgba(255,255,255,0.5)')
  if (mode === 'grey') return flat(chrome === 'terminal' ? 'rgba(255,255,255,0.16)' : 'rgba(186,200,218,0.5)')
  if (palette === 'mono') return flat(tokens.ink[4])
  if (theme === 'blueprint')
    return [0, 1, 2].map(() => ({ backgroundColor: 'transparent', boxShadow: `inset 0 0 0 1px ${tokens.border}` }))
  return ['#ff5f57', '#febc2e', '#28c840'].map((backgroundColor) => ({
    backgroundColor,
    boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)',
  }))
}
function Lights({
  fills,
  size,
  gap,
  style,
}: {
  fills: ViewStyle[]
  size: number
  gap: number
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[row, { gap, flexShrink: 0 }, style]}>
      {fills.map((fill, i) => (
        <View key={i} style={[{ width: size, height: size, borderRadius: size / 2 }, fill]} />
      ))}
    </View>
  )
}
function Lock() {
  return (
    <Svg width={7} height={8} viewBox="0 0 7 8" style={{ flexShrink: 0 }}>
      <Path d="M1.5 3.3V2.4a2 2 0 0 1 4 0v.9" fill="none" stroke="#667691" strokeWidth={1.1} />
      <Rect x={0} y={3.3} width={7} height={4.7} rx={1.2} fill="#667691" />
    </Svg>
  )
}
function Chevron({ back, color }: { back?: boolean; color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10">
      <Path
        d={back ? 'M6.5 1.5 3 5l3.5 3.5' : 'M3.5 1.5 7 5 3.5 8.5'}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
/** CSS inheritance for a chrome slot: a string gets `style`; a node (a Roll in the address, a typed command)
 * reads the color, size and family from the look, as Label, Text and the motion text parts do. */
function Inherit({
  color,
  size,
  family,
  lines,
  style,
  children,
}: {
  color: string
  size: number
  family?: string
  lines?: number
  style?: StyleProp<TextStyle>
  children: ReactNode
}) {
  const look = useLook()
  const value = useMemo(
    () => ({
      ...look,
      tokens: { ...look.tokens, text: color, fontSize: size, ...(family && { fontFamily: family }) },
    }),
    [look, color, size, family],
  )
  return (
    <LookContext.Provider value={value}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Label lines={lines} style={style}>
          {children}
        </Label>
      ) : (
        children
      )}
    </LookContext.Provider>
  )
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
  const opacity = useTween(receded ? 0.4 : 1, 300, { ease: curves.ease })
  const terminal = chrome === 'terminal',
    framed = chrome === 'glass' || chrome === 'card' || chrome === 'hairline',
    native = !terminal && !framed
  const side = native && sidebar !== undefined,
    floating = side && sidebarStyle === 'floating',
    tabbed = native && !side && !!tabs?.length,
    tall = native && !tabbed && barSize === 'tall',
    large = !framed && lightsSize === 'large'
  // Where the lights sit: their center as far from the left edge as from the top (19, or 26 in a tall bar)
  const dot = chrome === 'glass' ? 8 : chrome === 'hairline' ? 5 : large ? 12 : 9,
    lightsY = tall ? 26 : 19,
    inset = floating ? 8 : 0,
    pad = lightsY - dot / 2
  const fills = lightFills(look, chrome, lights)
  const dots = (style?: StyleProp<ViewStyle>) => (
    <Lights
      fills={fills}
      size={dot}
      gap={chrome === 'glass' ? 4 : chrome === 'hairline' ? 3 : large ? 8 : 6}
      style={style}
    />
  )
  // A terminal is dark inside whatever the stage's theme, and keeps the stage's custom accent. Plain output takes
  // the terminal's type, as everything in .ss-term inherits it on web.
  const inner = useMemo<Look>(() => {
    if (!terminal) return look
    const accent = t.accent !== resolveTokens(theme, palette).accent ? t.accent : undefined
    return {
      ...look,
      theme: 'dark',
      tokens: {
        ...resolveTokens('dark', palette, undefined, accent),
        text: termColors.text,
        fontSize: TERM_SIZE,
        fontFamily: t.mono,
      },
    }
  }, [terminal, look, t.accent, t.mono, theme, palette])
  const frame: ViewStyle = terminal
    ? {
        backgroundColor: termColors.background,
        borderRadius: t.radii.window,
        // A hairline light edge keeps the frame from melting into a dark stage
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.07), ${t.shadow.hero}`,
      }
    : framed
      ? FRAMES[chrome]
      : {
          backgroundColor: floating ? t.surface : t.canvas,
          borderRadius: floating ? 24 : t.radii.window,
          boxShadow: t.shadow.window,
        }
  // Frosted: the glass chrome, and every window in the glass theme (blur 24 there). The tint sits over the blur,
  // as a CSS background sits over its backdrop-filter.
  const blur = chrome === 'glass' || (native && theme === 'glass') ? (theme === 'glass' ? 24 : 12) : 0
  const bodyView = (extra?: StyleProp<ViewStyle>) => (
    <SceneView {...body} style={[{ flex: 1, minHeight: 0 }, extra, body?.style]}>
      {children}
    </SceneView>
  )
  const address = url !== undefined && (
    <>
      {nav && (
        <View style={[row, { gap: 6, marginLeft: tabbed ? 0 : 10, flexShrink: 0 }]}>
          <Chevron back color={t.textFaint} />
          <Chevron color={t.textFaint} />
        </View>
      )}
      <View
        style={[
          {
            flex: 1,
            minWidth: 0,
            marginLeft: tabbed ? 0 : nav ? 4 : 8,
            marginTop: tall ? 5 : 0,
            paddingVertical: 4,
            paddingHorizontal: urlShape === 'pill' ? 12 : 10,
            overflow: 'hidden',
            borderRadius: urlShape === 'pill' ? t.radii.pill : 6,
            backgroundColor: theme === 'blueprint' ? 'transparent' : t.ink[0],
          },
          theme === 'blueprint' && { boxShadow: `inset 0 0 0 1px ${t.lineFaint}` },
        ]}
      >
        <Inherit color={t.textFaint} size={10.5} lines={1} style={{ lineHeight: 14.7 }}>
          {url}
        </Inherit>
      </View>
    </>
  )
  const bar: ViewStyle = {
    flexDirection: 'row',
    alignItems: tall ? 'flex-start' : 'center',
    flexShrink: 0,
    gap: 6,
    height: tall ? 64 : 38,
    paddingHorizontal: pad,
    paddingTop: tall ? 10 : 0,
    backgroundColor: tall ? 'transparent' : t.chrome,
    borderBottomWidth: tall ? 0 : 1,
    borderBottomColor: t.border,
  }
  let content: ReactNode
  if (terminal)
    content = (
      <>
        <View style={[row, { flexShrink: 0, gap: 6, height: 38, paddingHorizontal: pad }]}>
          {dots()}
          {title !== undefined && (
            <View pointerEvents="none" style={[absolute, { alignItems: 'center', justifyContent: 'center' }]}>
              <Label lines={1} style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.42)' }}>
                {title}
              </Label>
            </View>
          )}
        </View>
        <LookContext.Provider value={inner}>
          <SceneView
            {...body}
            style={[
              {
                flex: 1,
                minHeight: 0,
                gap: 3,
                paddingTop: 4,
                paddingHorizontal: 16,
                paddingBottom: 16,
                overflow: 'hidden',
              },
              body?.style,
            ]}
          >
            {/* Each line gets the 1.65 line box; a prompt after output stands 8px clear of it */}
            {Children.toArray(children).map((child, i) => (
              <View
                key={isValidElement(child) && child.key != null ? child.key : i}
                style={[
                  { minHeight: TERM_LINE, justifyContent: 'center' },
                  i > 0 && isValidElement(child) && child.type === Prompt && { marginTop: 8 },
                ]}
              >
                {typeof child === 'string' || typeof child === 'number' ? (
                  <Label style={{ lineHeight: TERM_LINE }}>{child}</Label>
                ) : (
                  child
                )}
              </View>
            ))}
          </SceneView>
        </LookContext.Provider>
      </>
    )
  else if (chrome === 'glass')
    // Three columns (1fr, at most 262, 1fr), so the address is centered on the window; the page is a white card inset in the frame
    content = (
      <>
        <View style={[row, { flexShrink: 0, gap: 12, height: 35, paddingHorizontal: 20 }]}>
          <View style={[row, { flex: 1, minWidth: 0 }]}>{dots()}</View>
          <View style={{ flexBasis: 262, flexShrink: 1, minWidth: 0 }}>
            {url !== undefined && (
              <View
                style={[
                  row,
                  {
                    justifyContent: 'center',
                    gap: 4,
                    height: 20,
                    paddingHorizontal: 8,
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255,255,255,0.38)',
                    borderRadius: 999,
                    boxShadow: 'inset 0 0 0 1px rgba(229,237,245,0.5)',
                  },
                ]}
              >
                <Lock />
                <Inherit color="#50617a" size={10} lines={1} style={{ flexShrink: 1, lineHeight: 14 }}>
                  {url}
                </Inherit>
              </View>
            )}
          </View>
          <View style={[row, { flex: 1, minWidth: 0, justifyContent: 'flex-end', gap: 6 }]}>{toolbar}</View>
        </View>
        {bodyView({
          marginHorizontal: 6,
          marginBottom: 6,
          overflow: 'hidden',
          backgroundColor: '#fff',
          borderRadius: 6,
          boxShadow: '0 3px 6px rgba(23,23,23,0.06)',
        })}
      </>
    )
  else if (chrome === 'card')
    content = (
      <>
        <View style={[row, { flexShrink: 0, gap: 14, height: 44, paddingHorizontal: 16 }]}>
          {dots()}
          {url !== undefined && (
            <View
              style={{
                flex: 1,
                minWidth: 0,
                height: 24,
                paddingHorizontal: 10,
                overflow: 'hidden',
                backgroundColor: '#ecf2f7',
                borderRadius: 4,
              }}
            >
              <Inherit color="#425466" size={12} lines={1} style={{ fontWeight: '300', lineHeight: 24 }}>
                {url}
              </Inherit>
            </View>
          )}
          {toolbar != null && toolbar !== false && <View style={row}>{toolbar}</View>}
        </View>
        {bodyView({ backgroundColor: '#fff' })}
      </>
    )
  else if (chrome === 'hairline')
    // Three columns (1fr, auto, 1fr): the address as bare text centered on the window
    content = (
      <>
        <View
          style={[
            row,
            {
              flexShrink: 0,
              gap: 6,
              height: 20,
              paddingHorizontal: 8,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <View style={[row, { flex: 1, minWidth: 0 }]}>{dots()}</View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            {url !== undefined && (
              <Inherit color="#8792a2" size={9} lines={1} style={{ lineHeight: 12.6 }}>
                {url}
              </Inherit>
            )}
          </View>
          <View style={[row, { flex: 1, minWidth: 0, justifyContent: 'flex-end' }]}>{toolbar}</View>
        </View>
        {bodyView()}
      </>
    )
  else if (side)
    // The sidebar runs the full height and holds the lights, centered as far down and in as on every other
    // chrome (inside a floating panel too); the content column has its own bar
    content = (
      <>
        <View
          style={[
            { width: sidebarWidth, flexShrink: 0, backgroundColor: t.canvas },
            floating
              ? {
                  zIndex: 1,
                  marginTop: inset,
                  marginBottom: inset,
                  marginLeft: inset,
                  borderRadius: 16,
                  boxShadow: theme === 'dark' ? PANEL_SHADOW_DARK : PANEL_SHADOW,
                  backgroundColor: theme === 'dark' ? t.raised : t.canvas,
                }
              : { borderRightWidth: 1, borderRightColor: t.border },
          ]}
        >
          <View
            style={[
              row,
              { flexShrink: 0, height: (lightsY - inset) * 2, paddingHorizontal: lightsY - inset - dot / 2 },
            ]}
          >
            {dots()}
          </View>
          {sidebar}
        </View>
        <View style={{ flex: 1, minWidth: 0, backgroundColor: t.surface }}>
          <View style={[bar, { paddingHorizontal: 16 }]}>
            {title !== undefined && (
              <Label lines={1} style={[{ fontSize: 13, fontWeight: '600', color: t.text }, tall && { lineHeight: 32 }]}>
                {title}
              </Label>
            )}
            {lead}
            {address}
            <View style={{ flex: 1 }} />
            {toolbar}
          </View>
          {bodyView()}
        </View>
      </>
    )
  else if (tabbed)
    // The strip holds the lights at the same 38px; the active tab is the toolbar's color and joins it
    content = (
      <>
        <View
          style={[
            row,
            {
              flexShrink: 0,
              alignItems: 'flex-end',
              gap: 2,
              height: 38,
              paddingHorizontal: pad,
              backgroundColor: t.canvas,
            },
          ]}
        >
          {dots({ alignSelf: 'center', marginRight: 14 })}
          {tabs!.map((tab, i) => (
            <View
              key={i}
              style={[
                row,
                {
                  gap: 7,
                  width: 140,
                  minWidth: 0,
                  flexShrink: 1,
                  height: 30,
                  paddingHorizontal: 12,
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  backgroundColor: i === 0 ? t.chrome : 'transparent',
                },
              ]}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  flexShrink: 0,
                  borderRadius: 3,
                  backgroundColor: i === 0 ? t.accent : t.ink[3],
                }}
              />
              <Inherit color={i === 0 ? t.text : t.textFaint} size={11} lines={1} style={{ flexShrink: 1 }}>
                {tab}
              </Inherit>
            </View>
          ))}
        </View>
        <View style={bar}>
          {address}
          {toolbar}
        </View>
        {bodyView()}
      </>
    )
  else
    content = (
      <>
        <View style={bar}>
          {dots(tall && { marginTop: 16 - dot / 2 })}
          {address}
          {title !== undefined && (
            <Label
              lines={1}
              style={[
                { flex: 1, fontSize: 13, fontWeight: '600', color: t.text },
                // With a toolbar the bar is a unified toolbar, the title left beside the lights; alone it is
                // centered, offset for the lights on the left
                toolbar ? { marginLeft: 14, textAlign: 'left' } : { marginRight: 36, textAlign: 'center' },
                tall && { lineHeight: 32 },
              ]}
            >
              {title}
            </Label>
          )}
          {lead}
          {url === undefined && title === undefined && <View style={{ flex: 1 }} />}
          {toolbar}
        </View>
        {bodyView()}
      </>
    )
  return (
    <SceneView
      {...rest}
      style={[
        { overflow: 'hidden', opacity, flexDirection: side ? 'row' : 'column' },
        frame,
        blur > 0 && { backgroundColor: 'transparent' },
        style,
      ]}
    >
      {blur > 0 && <Glass tint="light" intensity={blurIntensity(blur)} style={absolute} />}
      {blur > 0 && <View pointerEvents="none" style={[absolute, { backgroundColor: frame.backgroundColor }]} />}
      {content}
    </SceneView>
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
  // A line gives way in a row too narrow for it, never past its container; an icon slot or a dot keeps its size
  const gives = shrink ?? (typeof w === 'number' && w > h * 3)
  return (
    <SceneView
      {...rest}
      style={[
        {
          width: w as DimensionValue,
          height: h,
          borderRadius: r,
          backgroundColor: tokens.ink[tone - 1],
          flexShrink: gives ? 1 : 0,
        },
        gives && { minWidth: 0, maxWidth: '100%' },
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
/** A terminal command line: a dim path, the prompt mark, and the command bright. A command node (a typed
 * string, a Caret after it) reads the command's color and type from the look. */
export function Prompt({ path = '~', children, style, ...rest }: PromptProps) {
  const { tokens } = useLook()
  const type = { fontFamily: tokens.mono, fontSize: TERM_SIZE, lineHeight: TERM_LINE }
  return (
    <SceneView {...rest} style={[row, { minHeight: TERM_LINE }, style]}>
      <Label style={[type, { color: termColors.path }]}>{path}</Label>
      <Label style={[type, { color: termColors.sigil, marginHorizontal: 7 }]}>❯</Label>
      <Inherit color={termColors.command} size={TERM_SIZE} family={tokens.mono} style={{ lineHeight: TERM_LINE }}>
        {children}
      </Inherit>
    </SceneView>
  )
}
/** A terminal's block cursor, 0.6em by 1.2em. Blinks (1.06s, a hard on and off) unless `still`. */
export function Caret({ still }: { still?: boolean }) {
  const blink = useCycle(1060, !still)
  return (
    <Animated.View
      accessibilityElementsHidden
      style={{
        width: TERM_SIZE * 0.6,
        height: TERM_SIZE * 1.2,
        marginLeft: 1,
        backgroundColor: termColors.caret,
        opacity: still ? 1 : blink.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [1, 1, 0, 0] }),
      }}
    />
  )
}
