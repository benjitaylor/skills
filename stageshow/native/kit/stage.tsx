import { RadialGradient } from './radial-gradient'
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Animated, AppState, Platform, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, Pattern, Path, Stop, Rect as SvgRect } from 'react-native-svg'
import { BlurTargetView } from 'expo-blur'
import { BlurBackground } from './glass'
import { createAct, Stopped, type Script } from './act'
import { clock } from './clock'
import { Cursor, Ripple, Keycaps } from './cursor'
import type { CursorKind, CursorStyle, Keys, KeysAt } from './cursor-types'
import type { Rect, Target } from './geometry'
import {
  LookContext,
  resolveTokens,
  type Theme,
  type Palette,
  type Fidelity,
  type Layout,
  type LookTokens,
} from './look'
import { SceneContext } from './native'
import { Registry } from './registry'
import { MotionContext, useSystemReducedMotion } from './reduced-motion'

export type { LookTokens } from './look'
export type Play = 'loop' | 'once' | 'hover'
export interface StageProps<S> {
  width: number
  height: number
  initial?: S
  script?: Script<S>
  poster?: S
  cursor?: {
    at: Target
    kind?: CursorKind
    style?: CursorStyle
    still?: boolean
    ripple?: boolean
    idle?: number | false
  }
  play?: Play
  compact?: { below: number; width: number; height: number }
  keys?: KeysAt | { wide: KeysAt; compact: KeysAt }
  hover?: string[]
  theme?: Theme
  palette?: Palette
  fidelity?: Fidelity
  greys?: 'warm' | 'cool'
  tokens?: LookTokens
  fill?: boolean
  accent?: string
  ground?: 'orbs' | [string, string] | [string, string, string]
  speed?: number
  specimen?: boolean
  unframed?: boolean
  style?: StyleProp<ViewStyle>
  /** Feed list viewability/navigation focus here. Native has no IntersectionObserver. */
  visible?: boolean
  /** Forces the poster for a preview; the OS reduction preference always wins. */
  reducedMotion?: boolean
  /** Changes restart the scene, including play='once'. */
  replay?: number
  onError?: (error: unknown) => void
  onMark?: (name: string) => void
  accessibilityLabel?: string
  children: (s: S, rect: (name: string) => Rect, layout: Layout) => ReactNode
}
const EMPTY = {}
export function Stage<S extends object>({
  width,
  height,
  initial = EMPTY as S,
  script,
  poster,
  cursor,
  play = 'loop',
  compact,
  keys = 'bottom',
  hover,
  theme = 'light',
  palette = 'accent',
  fidelity = 'standard',
  greys,
  tokens,
  fill,
  accent,
  ground,
  speed = 1,
  specimen,
  unframed,
  style,
  visible = true,
  reducedMotion,
  replay = 0,
  onError,
  onMark,
  accessibilityLabel,
  children,
}: StageProps<S>) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height)))
    throw new RangeError('Stage dimensions must be positive and finite')
  if (!(speed > 0 && Number.isFinite(speed))) throw new RangeError('Stage speed must be positive and finite')
  const groundId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [available, setAvailable] = useState(width)
  const layout: Layout = compact && available < compact.below ? 'compact' : 'wide'
  const designW = layout === 'compact' ? compact!.width : width,
    designH = layout === 'compact' ? compact!.height : height
  const scale = Math.min(fill ? 2 : 1, available / designW)
  const background = useRef<View>(null)
  const root = useRef<View>(null),
    registry = useRef(new Registry()).current
  const [appActive, setAppActive] = useState(AppState.currentState === 'active' || AppState.currentState === null)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'))
    return () => sub.remove()
  }, [])
  const [hovered, setHovered] = useState(false),
    [activation, setActivation] = useState(0)
  const armed = play !== 'hover' || (Platform.OS === 'web' ? hovered : activation > 0)
  const systemReduced = useSystemReducedMotion()
  const still = !script || !armed || specimen === true || systemReduced || reducedMotion === true
  const active = visible && appActive
  const [state, setState] = useState(poster ?? initial),
    [kind, setKind] = useState<CursorKind>(cursor?.kind ?? 'pointer')
  const position = useRef({ x: 0, y: 0 }),
    animatedPosition = useRef(new Animated.ValueXY()).current
  const kindRef = useRef(kind)
  kindRef.current = kind
  const [pressed, setPressed] = useState(false),
    [touching, setTouching] = useState(false)
  const [instant, setInstant] = useState(false),
    [instantScope, setInstantScope] = useState<string | undefined>()
  const [caps, setCaps] = useState<Keys[]>([]),
    [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const [cursorVisible, setCursorVisible] = useState(true),
    [running, setRunning] = useState(false)
  const latest = useRef({ initial, poster, script, cursor, onError, onMark, hover })
  latest.current = { initial, poster, script, cursor, onError, onMark, hover }
  const completed = useRef(false),
    lastMotion = useRef(0),
    rippleId = useRef(0)
  const resetKey = `${layout}:${replay}:${still}:${activation}`
  useEffect(() => {
    completed.current = false
  }, [resetKey, script])
  useSyncExternalStore(
    registry.subscribe,
    () => registry.version,
    () => registry.version,
  )
  useEffect(() => {
    const values = latest.current
    if (still) {
      setState(values.poster ?? values.initial)
      registry.reset()
      setPressed(false)
      setTouching(false)
      setCaps([])
      setRipples([])
      for (const name of values.hover ?? []) registry.update(name, { hover: true })
      return
    }
    if (!active || completed.current || !values.script) return
    const controller = new AbortController(),
      signal = controller.signal
    const timers = new Set<number>()
    setRunning(true)
    kindRef.current = values.cursor?.kind ?? 'pointer'
    setState(values.initial)
    registry.reset()
    setKind(values.cursor?.kind ?? 'pointer')
    setCaps([])
    setRipples([])
    const place = (point: { x: number; y: number }) => {
      position.current = point
      animatedPosition.setValue(point)
      lastMotion.current = clock.now()
      setCursorVisible(true)
    }
    const env = {
      registry,
      layout,
      speed,
      width: designW,
      height: designH,
      position,
      kind: kindRef,
      setState: (patch: Partial<S> | ((s: S) => Partial<S>)) =>
        setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })),
      place,
      setKind,
      press: setPressed,
      touching: setTouching,
      ripple: (point: { x: number; y: number }) => {
        if (!values.cursor?.ripple) return
        const id = ++rippleId.current
        setRipples((r) => [...r, { id, ...point }])
        const timer = clock.timeout(() => {
          timers.delete(timer)
          setRipples((r) => r.filter((v) => v.id !== id))
        }, 600 / speed)
        timers.add(timer)
      },
      keys: (value: Keys) =>
        setCaps((rows) => [
          ...rows
            .filter((row) => row.id !== value.id)
            .slice(-1)
            .map((row) => ({ ...row, show: false, down: false })),
          value,
        ]),
      instant: (value: boolean, scope?: string) => {
        if (scope) setInstantScope(value ? scope : undefined)
        else setInstant(value)
      },
      mark: (name: string) => values.onMark?.(name),
      touch: values.cursor?.style === 'touch',
    }
    const act = createAct(signal, env)
    void (async () => {
      try {
        await act.wait(32)
        await registry.measure()
        if (signal.aborted) return
        if (values.cursor) place(registry.resolve(values.cursor.at, layout))
        do {
          await values.script!(act)
          if (play !== 'loop') {
            completed.current = true
            setRunning(false)
            break
          }
          // Prevent an empty script from creating an unbounded microtask loop.
          await act.wait(16)
        } while (!signal.aborted)
      } catch (error) {
        if (!(error instanceof Stopped)) {
          setRunning(false)
        }
        if (!(error instanceof Stopped)) {
          values.onError?.(error)
          if (!values.onError) console.error('[stageshow-native] script error', error)
        }
      }
    })()
    const idle = values.cursor?.idle ?? 4000
    const checkIdle = () => {
      if (signal.aborted || completed.current || idle === false) return
      const held = [...registry.entries.keys()].some((name) => {
        const i = registry.interaction(name)
        return i.pressed || i.hover
      })
      if (!held && clock.now() - lastMotion.current > idle) setCursorVisible(false)
      const timer = clock.timeout(() => {
        timers.delete(timer)
        checkIdle()
      }, 250)
      timers.add(timer)
    }
    checkIdle()
    return () => {
      controller.abort()
      timers.forEach(clock.clearTimeout)
      setPressed(false)
      setTouching(false)
      setInstant(false)
      setInstantScope(undefined)
    }
  }, [active, still, layout, replay, activation, script, play, speed, designW, designH, registry, animatedPosition])
  useEffect(() => {
    if (!still || !cursor) return
    let live = true
    void registry.measure().then(() => {
      if (live) {
        try {
          animatedPosition.setValue(registry.resolve(cursor.at, layout))
        } catch {}
      }
    })
    return () => {
      live = false
    }
  }, [still, cursor, layout, registry, animatedPosition])
  const look = useMemo(
    () => ({ theme, palette, fidelity, layout, tokens: resolveTokens(theme, palette, greys, accent, tokens) }),
    [theme, palette, fidelity, layout, greys, accent, tokens],
  )
  const scene = useMemo(
    () => ({ registry, root, scale, width: designW, height: designH, instantScope }),
    [registry, scale, designW, designH, instantScope],
  )
  const colors = Array.isArray(ground)
    ? ground
    : theme === 'glass'
      ? [look.tokens.accent, '#8b5cf6', '#ffa878']
      : ['#d5c9f4', '#f8d3b5', '#d2e8f5']
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={play === 'hover' ? 'button' : undefined}
      accessibilityActions={play === 'hover' ? [{ name: 'activate', label: 'Play illustration' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') setActivation((n) => n + 1)
      }}
      onTouchEnd={play === 'hover' && Platform.OS !== 'web' ? () => setActivation((n) => n + 1) : undefined}
      onPointerEnter={Platform.OS === 'web' ? () => setHovered(true) : undefined}
      onPointerLeave={Platform.OS === 'web' ? () => setHovered(false) : undefined}
      style={[{ width: '100%', height: designH * scale, overflow: 'hidden' }, style]}
      onLayout={(event) => {
        const w = event.nativeEvent.layout.width
        if (w > 0) setAvailable(w)
      }}
    >
      <View
        ref={root}
        collapsable={false}
        style={{
          position: 'absolute',
          left: Math.max(0, (available - designW * scale) / 2),
          top: 0,
          width: designW,
          height: designH,
          transform: [{ scale }],
          transformOrigin: 'top left',
          overflow: 'hidden',
          ...(Platform.OS === 'web' ? { WebkitFontSmoothing: 'antialiased' } : {}),
          backgroundColor: unframed ? 'transparent' : look.tokens.background,
        }}
      >
        <BlurTargetView
          ref={background}
          style={{ position: 'absolute', inset: 0, backgroundColor: unframed ? 'transparent' : look.tokens.background }}
        >
          {theme === 'blueprint' && !unframed && (
            <Svg style={{ position: 'absolute' }} width={designW} height={designH}>
              <Defs>
                <Pattern id={`${groundId}grid`} width={16} height={16} patternUnits="userSpaceOnUse">
                  <Path d="M16 0H0V16" fill="none" stroke="rgba(214,232,255,0.08)" strokeWidth={1} />
                </Pattern>
              </Defs>
              <SvgRect width="100%" height="100%" fill={`url(#${groundId}grid)`} />
            </Svg>
          )}
          {(ground || (theme === 'glass' && !unframed)) && (
            <Svg style={{ position: 'absolute' }} width={designW} height={designH}>
              <Defs>
                {colors.map((color, i) => (
                  <RadialGradient
                    key={i}
                    id={`${groundId}orb${i}`}
                    cx={theme === 'glass' ? ['12%', '88%', '58%'][i] : i === 0 ? '20%' : '80%'}
                    cy={theme === 'glass' ? ['18%', '28%', '100%'][i] : i === 1 ? '80%' : '20%'}
                    rx={theme === 'glass' ? ['55%', '50%', '60%'][i] : '80%'}
                    ry={theme === 'glass' ? ['65%', '60%', '55%'][i] : '80%'}
                  >
                    <Stop offset="0" stopColor={color} stopOpacity={theme === 'glass' ? (i === 1 ? 0.38 : 0.42) : 1} />
                    <Stop offset={theme === 'glass' ? 0.7 : 1} stopColor={color} stopOpacity={0} />
                  </RadialGradient>
                ))}
              </Defs>
              {colors.map((_, i) => (
                <SvgRect key={i} width="100%" height="100%" fill={`url(#${groundId}orb${i})`} />
              ))}
            </Svg>
          )}
        </BlurTargetView>
        <BlurBackground.Provider value={background}>
          <SceneContext.Provider value={scene}>
            <LookContext.Provider value={look}>
              <MotionContext.Provider value={{ still, active: active && running, speed, instant }}>
                {children(state, (name) => registry.rect(name), layout)}
                <Keycaps values={caps} at={typeof keys === 'string' ? keys : keys[layout]} />
                {ripples.map((ripple) => (
                  <Ripple key={ripple.id} {...ripple} />
                ))}
                {cursor && (!script || !still || cursor.still) && (
                  <Cursor
                    position={animatedPosition}
                    style={cursor.style}
                    kind={kind}
                    pressed={pressed}
                    touching={touching}
                    visible={cursorVisible}
                  />
                )}
              </MotionContext.Provider>
            </LookContext.Provider>
          </SceneContext.Provider>
        </BlurBackground.Provider>
      </View>
    </View>
  )
}
