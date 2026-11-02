import { RadialGradient } from './radial-gradient'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Animated, AppState, Platform, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, Pattern, Stop, Rect as SvgRect } from 'react-native-svg'
import { BlurTargetView } from 'expo-blur'
import { BlurBackground } from './glass'
import { checkSeam, createAct, Stopped, type ActEnv, type Script } from './act'
import { clock } from './clock'
import { isDev } from './dev'
import { Cursor, Ripple, Keycaps } from './cursor'
import type { CursorKind, CursorStyle, Keys, KeysAt } from './cursor-types'
import type { Point, Rect, Target } from './geometry'
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
import { MotionContext, useMotionPreference } from './reduced-motion'

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
    /** What the cursor shows over unmarked areas once the scene marks any: the pointer by default. */
    base?: CursorKind
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
  /** A specimen sheet of parts. Marks intent only, as on web; it never stills the scene. */
  specimen?: boolean
  /** No framing, for the web film's checks. The theme's own ground (glass field, blueprint grid) stays, as on web. */
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
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
// Before its first move a cursor that waits longer than this steps out of the shot.
const LEAD = 1200

type Spot = { cx: string; cy: string; rx: string; ry: string; color: string; alpha: number }
// Ground orbs (stage.css .ss-ground): huge, soft and mostly off the tile.
const ORBS = [
  { cx: '8%', cy: '4%', rx: '60%', ry: '75%' },
  { cx: '96%', cy: '92%', rx: '55%', ry: '70%' },
  { cx: '78%', cy: '8%', rx: '45%', ry: '55%' },
]
/** Radial color spots, each fading to nothing at 70%, as stage.css draws them. */
function GlassField({ id, width, height, spots }: { id: string; width: number; height: number; spots: Spot[] }) {
  return (
    <Svg style={{ position: 'absolute' }} width={width} height={height}>
      <Defs>
        {spots.map((s, i) => (
          <RadialGradient key={i} id={`${id}${i}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}>
            <Stop offset="0" stopColor={s.color} stopOpacity={s.alpha} />
            <Stop offset="0.7" stopColor={s.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {/* CSS paints its first gradient on top; SVG paints its last */}
      {spots.map((_, i) => <SvgRect key={i} width="100%" height="100%" fill={`url(#${id}${i})`} />).reverse()}
    </Svg>
  )
}

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
  style,
  visible = true,
  reducedMotion,
  replay = 0,
  onError,
  onMark,
  accessibilityLabel,
  // Markers, as on web: neither changes playback or framing here.
  specimen: _specimen,
  unframed: _unframed,
  children,
}: StageProps<S>) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height)))
    throw new RangeError('Stage dimensions must be positive and finite')
  if (!(speed > 0 && Number.isFinite(speed))) throw new RangeError('Stage speed must be positive and finite')
  const groundId = useId().replace(/[^a-zA-Z0-9]/g, '')
  // Until the container reports its width, guess from the screen and keep the scene out of
  // sight, so the first frame never shows a wrong scale that then jumps.
  const screen = useWindowDimensions().width
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  const available = measuredWidth ?? Math.min(width, screen || width)
  const layout: Layout = compact && available < compact.below ? 'compact' : 'wide'
  const designW = layout === 'compact' ? compact!.width : width,
    designH = layout === 'compact' ? compact!.height : height
  const scale = Math.min(fill ? 2 : 1, available / designW)
  const background = useRef<View>(null)
  const root = useRef<View>(null),
    registry = useRef(new Registry()).current
  // Only a real trip to the background stops the scene; Control Center or a banner
  // ('inactive') leaves it playing.
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state !== 'background'))
    return () => sub.remove()
  }, [])
  // Hover plays while the pointer is over it, in the web preview. A phone has no hover: there
  // it plays once when seen, and a tap replays it.
  const mode: Play = play === 'hover' && Platform.OS !== 'web' ? 'once' : play
  const [hovered, setHovered] = useState(false),
    [activation, setActivation] = useState(0)
  const leaving = useRef(false)
  const waiting = mode === 'hover' && !hovered
  const preference = useMotionPreference()
  const still = !script || preference.reduced || reducedMotion === true
  const active = visible && appActive
  const [state, setState] = useState<S>(() => (still && poster ? poster : initial)),
    [kind, setKind] = useState<CursorKind>(cursor?.kind ?? 'pointer')
  // The script's view of state, current before React commits, for the loop seam check.
  const scripted = useRef(state)
  const position = useRef<Point>({ x: 0, y: 0 }),
    animatedPosition = useRef(new Animated.ValueXY()).current
  const trail = useRef({ length: new Animated.Value(0), angle: new Animated.Value(0) }).current
  const kindRef = useRef(kind)
  kindRef.current = kind
  const [pressed, setPressed] = useState(false),
    [touching, setTouching] = useState(false),
    [swiping, setSwiping] = useState(false)
  const pressedRef = useRef(false)
  const [instant, setInstant] = useState(false),
    [instantScope, setInstantScope] = useState<string | undefined>()
  const [caps, setCaps] = useState<Keys[]>([]),
    [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const [cursorVisible, setCursorVisible] = useState(true),
    shownRef = useRef(true),
    [running, setRunning] = useState(false)
  const reveal = (shown: boolean) => {
    shownRef.current = shown
    setCursorVisible(shown)
  }
  const latest = useRef({ initial, poster, script, cursor, onError, onMark, hover })
  latest.current = { initial, poster, script, cursor, onError, onMark, hover }
  const completed = useRef(false),
    rippleId = useRef(0),
    glide = useRef(0)
  const autoRef = useRef<((at: Point) => void) | null>(null),
    dragging = useRef(false)
  // Idle: when the cursor last acted, when this loop began, whether it has moved yet, and
  // (learned on the first run) how long it waits before its first move.
  const lastActive = useRef(0),
    loopAt = useRef(0),
    moved = useRef(false),
    firstMove = useRef<number | null>(null),
    cursorAt = useRef<Point | null>(null)
  const resetKey = `${layout}:${replay}:${still}:${activation}`
  useEffect(() => {
    completed.current = false
  }, [resetKey, script])
  const version = useSyncExternalStore(
    registry.subscribe,
    () => registry.version,
    () => registry.version,
  )

  // Placing: a reset commits with transitions off (web's data-placing, and its instant
  // offscreen resets), so the viewer never sees the scene rewind. Each reset is an epoch; the
  // first beat waits for its commit.
  const [epoch, setEpoch] = useState(0),
    [placed, setPlaced] = useState(-1)
  const placing = epoch !== placed
  const epochs = useRef(0),
    waiters = useRef<{ epoch: number; done: () => void }[]>([])
  useLayoutEffect(() => {
    if (placed !== epoch) setPlaced(epoch)
    waiters.current = waiters.current.filter((w) => {
      if (w.epoch > epoch) return true
      w.done()
      return false
    })
  })
  const nextEpoch = () => {
    const e = ++epochs.current
    setEpoch(e)
    return new Promise<void>((done) => waiters.current.push({ epoch: e, done }))
  }

  // The cursor and whatever follows it move in one commit, as web's flushSync does: a
  // placement made while scene state is on its way waits for that state's commit.
  const pending = useRef<{ state: boolean; point: Point | null }>({ state: false, point: null })
  useLayoutEffect(() => {
    pending.current.state = false
    const point = pending.current.point
    pending.current.point = null
    if (point) animatedPosition.setValue(point)
  }, [state, animatedPosition])
  const place = (p: Point, quiet = false) => {
    const last = cursorAt.current
    if (!quiet && loopAt.current && !moved.current && last && Math.hypot(p.x - last.x, p.y - last.y) > 0.5) {
      moved.current = true
      firstMove.current ??= clock.now() - loopAt.current
    }
    cursorAt.current = p
    position.current = p
    lastActive.current = clock.now()
    if (pending.current.state) pending.current.point = p
    else animatedPosition.setValue(p)
    reveal(true)
  }
  const restPoint = (): Point | null => {
    const at = latest.current.cursor?.at
    if (!at) return null
    const t = typeof at === 'object' && 'wide' in at ? at[layout] : at
    const name = typeof t === 'string' ? t : 'at' in t ? t.at : undefined
    const r = name ? registry.rect(name) : null
    // Named but never measured: not known yet
    if (r && !(r.width || r.height)) return null
    try {
      return registry.resolve(t, layout)
    } catch {
      return null
    }
  }
  const reset = (glide = false) => {
    const values = latest.current
    scripted.current = values.initial
    setState(values.initial)
    registry.reset()
    kindRef.current = values.cursor?.kind ?? 'pointer'
    setKind(kindRef.current)
    setCaps(glide ? (rows) => rows.map((row) => ({ ...row, show: false, down: false })) : [])
    setRipples([])
    pressedRef.current = false
    setPressed(false)
    setTouching(false)
    setSwiping(false)
  }

  useEffect(() => {
    const values = latest.current
    if (still) {
      setState(values.poster ?? values.initial)
      registry.reset()
      setPressed(false)
      setTouching(false)
      setSwiping(false)
      setCaps([])
      setRipples([])
      for (const name of values.hover ?? []) registry.update(name, { hover: true })
      return
    }
    if (!preference.known || !active || completed.current || !values.script || waiting) return
    const script = values.script
    const controller = new AbortController(),
      signal = controller.signal
    const timers = new Set<number>()
    clock.cancelRaf(glide.current)
    leaving.current = false
    // A changed script, layout or motion preference starts a fresh scene, snapped back
    reset()
    setRunning(true)
    const committed = nextEpoch()

    // Idle: a cursor waiting to start reads as a stuck one, so before its first move it steps
    // out of the shot. Once it has acted, only a long stillness fades it, and never while it
    // holds a press or rests on what it hovers.
    const idle = values.cursor?.idle ?? 4000
    let idleTimer = 0,
      revealTimer = 0
    const held = () =>
      pressedRef.current || [...registry.entries.keys()].some((name) => registry.interaction(name).hover)
    const watchIdle = () => {
      if (!values.cursor || idle === false) return
      lastActive.current = clock.now()
      const tick = () => {
        idleTimer = clock.timeout(tick, 150)
        const now = clock.now()
        if (!moved.current) {
          // Later loops know when it moves and handle it in beginLoop
          if (firstMove.current === null && now - lastActive.current > LEAD) reveal(false)
          return
        }
        if (held()) lastActive.current = now
        else if (now - lastActive.current > idle) reveal(false)
      }
      idleTimer = clock.timeout(tick, 150)
    }
    const beginLoop = () => {
      loopAt.current = clock.now()
      moved.current = false
      clock.clearTimeout(revealTimer)
      const lead = firstMove.current
      if (!values.cursor || idle === false || lead === null || lead <= LEAD) return
      // A long opening wait: out now, back in just before the first move
      reveal(false)
      revealTimer = clock.timeout(() => reveal(true), lead - 400)
    }
    const unwatchIdle = () => {
      clock.clearTimeout(idleTimer)
      clock.clearTimeout(revealTimer)
      loopAt.current = 0
      reveal(true)
    }
    // A completed once scene cannot move again: finish its idle delay with one timeout
    // rather than polling the held ending forever.
    const finishIdle = () => {
      clock.clearTimeout(idleTimer)
      clock.clearTimeout(revealTimer)
      if (!values.cursor || idle === false || !shownRef.current || held()) return
      const delay = (moved.current ? idle : LEAD) - (clock.now() - lastActive.current)
      revealTimer = clock.timeout(
        () => {
          if (!held()) reveal(false)
        },
        Math.max(0, delay),
      )
    }

    const env: ActEnv<S> = {
      registry,
      layout,
      speed,
      width: designW,
      height: designH,
      position,
      kind: kindRef,
      setState: (patch) => {
        const s = scripted.current
        scripted.current = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }
        pending.current.state = true
        setState(scripted.current)
      },
      place: (p) => place(p),
      setKind,
      press: (down) => {
        pressedRef.current = down
        setPressed(down)
      },
      touching: setTouching,
      swiping: setSwiping,
      streak: (length, angle) => {
        trail.length.setValue(length)
        trail.angle.setValue(angle)
      },
      ripple: (point) => {
        if (!values.cursor?.ripple) return
        const id = ++rippleId.current
        setRipples((r) => [...r, { id, ...point }])
        const timer = clock.timeout(() => {
          timers.delete(timer)
          setRipples((r) => r.filter((v) => v.id !== id))
        }, 600 / speed)
        timers.add(timer)
      },
      keys: (value) =>
        setCaps((rows) => [
          ...rows
            .filter((row) => row.id !== value.id)
            .slice(-1)
            .map((row) => ({ ...row, show: false, down: false })),
          value,
        ]),
      instant: (value, scope) => {
        if (scope) setInstantScope(value ? scope : undefined)
        else setInstant(value)
      },
      mark: (name) => values.onMark?.(name),
      touch: values.cursor?.style === 'touch',
      cursor: !!values.cursor,
      base: values.cursor?.base,
      auto: autoRef,
      dragging,
    }
    void (async () => {
      try {
        await committed
        if (signal.aborted) return
        // Rest the cursor at once when its target is already measured; measure only when not
        let at = restPoint()
        const known = !!at
        if (values.cursor && !at) {
          await registry.measure()
          if (signal.aborted) return
          at = restPoint()
        }
        if (at) place(at)
        // Rects read before the reset committed can be stale: settle the rest point once
        // measured, unless the script has already moved the cursor
        if (at && known)
          void registry.measure().then(() => {
            const fresh = restPoint()
            if (!signal.aborted && fresh && cursorAt.current === at && Math.hypot(fresh.x - at.x, fresh.y - at.y) > 0.5)
              place(fresh, true)
          })
        watchIdle()
        const act = createAct(signal, env)
        do {
          beginLoop()
          const began = clock.now()
          await script(act)
          if (signal.aborted) return
          if (mode !== 'loop') break
          if (isDev()) checkSeam(scripted.current, values.initial, position.current, restPoint())
          // Loops run back to back, as on web; only a script that took no time at all yields,
          // so it can't spin forever in one task.
          if (clock.now() === began) await act.wait(0)
        } while (!signal.aborted)
        // Once holds its end state for good; hover holds it until the pointer leaves.
        if (mode === 'once') {
          completed.current = true
          finishIdle()
        }
      } catch (error) {
        if (error instanceof Stopped) return
        unwatchIdle()
        values.onError?.(error)
        if (!values.onError) console.error('[stageshow-native] script error', error)
      }
    })()
    return () => {
      controller.abort()
      timers.forEach(clock.clearTimeout)
      unwatchIdle()
      autoRef.current = null
      dragging.current = false
      setInstant(false)
      setInstantScope(undefined)
      if (pending.current.point) animatedPosition.setValue(pending.current.point)
      pending.current = { state: false, point: null }
      if (completed.current) {
        pressedRef.current = false
        setPressed(false)
        setTouching(false)
        setSwiping(false)
        return
      }
      if (leaving.current) {
        // The pointer left a hover scene: its own transitions carry it back and the cursor
        // walks home
        leaving.current = false
        reset(true)
        if (!values.cursor) return
        glide.current = clock.raf(() => {
          const from = { ...position.current },
            end = restPoint() ?? from
          const ms = clamp(320 + Math.hypot(end.x - from.x, end.y - from.y) * 0.7, 380, 700),
            start = clock.now()
          const step = () => {
            const t = Math.min(1, (clock.now() - start) / ms),
              e = easeInOut(t)
            place({ x: from.x + (end.x - from.x) * e, y: from.y + (end.y - from.y) * e }, true)
            if (t < 1) glide.current = clock.raf(step)
          }
          step()
        })
        return
      }
      // Stopped with nobody watching (offscreen, backgrounded, restarted): back to the start
      // at once, so a return never shows the scene rewinding
      setRunning(false)
      reset()
      void nextEpoch()
    }
  }, [
    active,
    still,
    preference.known,
    waiting,
    layout,
    replay,
    activation,
    script,
    mode,
    speed,
    designW,
    designH,
    registry,
    animatedPosition,
    trail,
  ])
  // The cursor rests at its start point while no script runs it (a still, a hover scene
  // waiting for the pointer), and follows a resize there.
  const atKey = JSON.stringify(cursor?.at ?? null)
  useEffect(() => {
    if (!atKey || loopAt.current) return
    let live = true
    const rest = () => {
      const at = restPoint()
      if (at && live && !loopAt.current) place(at, true)
    }
    rest()
    void registry.measure().then(rest)
    return () => {
      live = false
    }
  }, [still, atKey, layout, scale, registry]) // eslint-disable-line react-hooks/exhaustive-deps
  // The cursor's kind follows what's under it after every commit and measurement too, so a
  // hand doesn't linger when the link it was over slides away. Not mid-drag: the drag owns it.
  useLayoutEffect(() => {
    if (!still && !dragging.current) autoRef.current?.(position.current)
  }, [state, version, still])
  const look = useMemo(
    () => ({ theme, palette, fidelity, layout, tokens: resolveTokens(theme, palette, greys, accent, tokens) }),
    [theme, palette, fidelity, layout, greys, accent, tokens],
  )
  const scene = useMemo(
    () => ({ registry, root, scale, width: designW, height: designH, instantScope }),
    [registry, scale, designW, designH, instantScope],
  )
  const t = look.tokens
  // The orbs' strength: soft on light grounds, far fainter on dark
  const alphas = theme === 'dark' ? [0.3, 0.24, 0.18] : [0.85, 0.8, 0.55]
  const orbColors = Array.isArray(ground)
    ? [ground[0], ground[1], ground[2] ?? '#a9d8ff']
    : ['#c9b8ff', '#ffc59a', '#a9d8ff']
  // One element for assistive tech: the label describes the illustration, and the faux UI
  // inside is never read as real controls. Without a label or tap-to-play it is decorative.
  const tappable = play === 'hover' && Platform.OS !== 'web'
  const hoverable = play === 'hover' && Platform.OS === 'web'
  return (
    <View
      accessible={!!accessibilityLabel || tappable}
      accessibilityLabel={accessibilityLabel ?? (tappable ? 'Play illustration' : undefined)}
      accessibilityRole={tappable ? 'button' : accessibilityLabel ? 'image' : undefined}
      accessibilityActions={tappable ? [{ name: 'activate', label: 'Play illustration' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') setActivation((n) => n + 1)
      }}
      onTouchEnd={tappable ? () => setActivation((n) => n + 1) : undefined}
      onPointerEnter={hoverable ? () => setHovered(true) : undefined}
      onPointerLeave={
        hoverable
          ? () => {
              leaving.current = true
              setHovered(false)
            }
          : undefined
      }
      style={[{ width: '100%', height: designH * scale, overflow: 'hidden' }, style]}
      onLayout={(event) => {
        const w = event.nativeEvent.layout.width
        if (w > 0) setMeasuredWidth(w)
      }}
    >
      <View
        ref={root}
        collapsable={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: Math.max(0, (available - designW * scale) / 2),
          top: 0,
          width: designW,
          height: designH,
          transform: [{ scale }],
          transformOrigin: 'top left',
          overflow: 'hidden',
          opacity: measuredWidth === null ? 0 : 1,
          ...(Platform.OS === 'web' ? { WebkitFontSmoothing: 'antialiased' } : {}),
          backgroundColor: t.background,
        }}
      >
        <BlurTargetView ref={background} style={{ position: 'absolute', inset: 0, backgroundColor: t.background }}>
          {theme === 'blueprint' && (
            <Svg style={{ position: 'absolute' }} width={designW} height={designH}>
              <Defs>
                {/* One 1px line along the top and left of every 16px tile, as the CSS grid draws them */}
                <Pattern id={`${groundId}grid`} width={16} height={16} patternUnits="userSpaceOnUse">
                  <SvgRect width={16} height={1} fill="rgba(214,232,255,0.08)" />
                  <SvgRect width={1} height={16} fill="rgba(214,232,255,0.08)" />
                </Pattern>
              </Defs>
              <SvgRect width="100%" height="100%" fill={`url(#${groundId}grid)`} />
            </Svg>
          )}
          {theme === 'glass' && (
            <GlassField
              id={`${groundId}field`}
              width={designW}
              height={designH}
              spots={[
                { cx: '12%', cy: '18%', rx: '55%', ry: '65%', color: t.accent, alpha: 0.42 },
                { cx: '88%', cy: '28%', rx: '50%', ry: '60%', color: t.accent2, alpha: 0.38 },
                { cx: '58%', cy: '100%', rx: '60%', ry: '55%', color: '#ffa878', alpha: 0.42 },
              ]}
            />
          )}
          {ground && (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: t.canvas,
              }}
            >
              <GlassField
                id={`${groundId}orb`}
                width={designW}
                height={designH}
                spots={ORBS.map((orb, i) => ({ ...orb, color: orbColors[i], alpha: alphas[i] }))}
              />
            </View>
          )}
        </BlurTargetView>
        <BlurBackground.Provider value={background}>
          <SceneContext.Provider value={scene}>
            <LookContext.Provider value={look}>
              {/* Live while it plays, after a once scene ends, and while a hover scene waits, as
                  web's CSS keeps running; off for the one commit that resets it */}
              <MotionContext.Provider
                value={{
                  still,
                  active: active && (running || completed.current || waiting) && !placing,
                  speed,
                  instant,
                }}
              >
                {children(state, (name) => registry.targetRect(name), layout)}
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
                    swiping={swiping}
                    trail={trail}
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
