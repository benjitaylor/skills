import {
  Children,
  createContext,
  forwardRef,
  Fragment,
  isValidElement,
  useContext,
  useImperativeHandle,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  Animated,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native'
import { useLook } from './look'
import { Registry, type Entry } from './registry'
import type { CursorKind } from './cursor-types'
import type { Rect } from './geometry'
import { MotionContext } from './reduced-motion'

export type NativeStyle = Animated.WithAnimatedValue<StyleProp<ViewStyle>>
export interface NativeProps extends Omit<ViewProps, 'style'> {
  style?: NativeStyle
  target?: string
  cursor?: CursorKind
  'data-target'?: string
  'data-cursor'?: CursorKind
  hidden?: boolean
  hoverStyle?: NativeStyle
  pressedStyle?: NativeStyle
}
export interface Scene {
  registry: Registry
  root: RefObject<View | null>
  scale: number
  width: number
  height: number
  instantScope?: string
}
export const SceneContext = createContext<Scene | null>(null)
export const SuppressTargets = createContext(false)
export const HiddenTargets = createContext(false)
const ParentTarget = createContext<string | undefined>(undefined)
let order = 0
export function useScene() {
  return useContext(SceneContext)
}
export function useInteraction(name?: string) {
  const scene = useScene()
  return useSyncExternalStore(
    scene?.registry.subscribe ?? (() => () => {}),
    () => scene?.registry.interaction(name),
    () => scene?.registry.interaction(name),
  )
}
function measured(node: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    // A detached native ref may never call its callback. Bound the wait, and report no
    // measurement rather than a zero rect: a slow reply must not move a live target.
    const timeout = setTimeout(() => resolve(null), 250)
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(timeout)
      resolve({ x, y, width, height })
    })
  })
}
// Targets measured together share one measurement of the stage root.
const origins = new WeakMap<View, Promise<Rect | null>>()
function originOf(root: View) {
  let origin = origins.get(root)
  if (!origin) {
    origin = measured(root).finally(() => origins.delete(root))
    origins.set(root, origin)
  }
  return origin
}
const read = (v: unknown) => (typeof v === 'number' ? v : (v as { __getValue?: () => unknown } | null)?.__getValue?.())
// A target's box as rect() hands it to the scene: where it is drawn, without a scale of its
// own (a press, a hover lift), as on web. Anything placed from it would otherwise shift with
// every press. Only a plain scale about a known origin is taken off; anything else stays drawn.
function unscaled(r: Rect, style: unknown): Rect {
  const flat = StyleSheet.flatten(style as StyleProp<ViewStyle>) as ViewStyle | undefined
  if (!Array.isArray(flat?.transform)) return r
  let sx = 1,
    sy = 1
  for (const step of flat.transform as Record<string, unknown>[]) {
    const [key, raw] = Object.entries(step)[0] ?? []
    const v = read(raw)
    if (typeof v === 'number' && (key === 'scale' || key === 'scaleX')) sx *= v
    if (typeof v === 'number' && (key === 'scale' || key === 'scaleY')) sy *= v
    // A slide or turn moves it in a way a scale alone can't undo: keep the drawn box.
    if (!key?.startsWith('scale') && v !== 0 && !(typeof v === 'string' && parseFloat(v) === 0)) return r
  }
  if ((sx === 1 && sy === 1) || !sx || !sy) return r
  const origin = flat.transformOrigin ?? 'center',
    w = r.width / sx,
    h = r.height / sy
  const [ox, oy] =
    origin === 'center' || origin === 'center center'
      ? [w / 2, h / 2]
      : origin === 'top left' || origin === 'left top'
        ? [0, 0]
        : Array.isArray(origin) && typeof origin[0] === 'number' && typeof origin[1] === 'number'
          ? [origin[0], origin[1]]
          : [NaN, NaN]
  if (Number.isNaN(ox)) return r
  return { x: r.x - ox * (1 - sx), y: r.y - oy * (1 - sy), width: w, height: h }
}
export const SceneView = forwardRef<View, NativeProps>(function SceneView(
  {
    target,
    cursor,
    'data-target': alias,
    'data-cursor': cursorAlias,
    hidden,
    hoverStyle,
    pressedStyle,
    style,
    children,
    onLayout,
    ...rest
  },
  forwarded,
) {
  const autoName = useId()
  const suppressed = useContext(SuppressTargets),
    inheritedHidden = useContext(HiddenTargets)
  const name = suppressed
      ? undefined
      : (target ?? alias ?? ((cursor ?? cursorAlias) ? `cursor-${autoName}` : undefined)),
    scene = useScene(),
    parent = useContext(ParentTarget)
  hidden = hidden || inheritedHidden
  const motion = useContext(MotionContext)
  const node = useRef<View>(null)
  const entry = useRef<Entry>({
    rect: { x: 0, y: 0, width: 0, height: 0 },
    layout: { x: 0, y: 0, width: 0, height: 0 },
    order: ++order,
  }).current
  const laidOut = useRef(false)
  const interaction = useInteraction(name)
  const drawn = [style, interaction?.hover && hoverStyle, interaction?.pressed && pressedStyle]
  const current = useRef({ scene, hidden, cursor: cursor ?? cursorAlias, parent, drawn })
  current.current = { scene, hidden, cursor: cursor ?? cursorAlias, parent, drawn }
  useImperativeHandle(forwarded, () => node.current!, [])
  entry.cursor = cursor ?? cursorAlias
  entry.hidden = hidden
  entry.parent = parent
  entry.measure = async () => {
    const context = current.current.scene,
      element = node.current,
      root = context?.root.current
    if (!context || !element || !root) return
    const [r, origin] = await Promise.all([measured(element), originOf(root)])
    if (element !== node.current || !r || !origin) return
    const scale = origin.width / context.width || context.scale || 1
    const next = {
      x: (r.x - origin.x) / scale,
      y: (r.y - origin.y) / scale,
      width: r.width / scale,
      height: r.height / scale,
    }
    const changed = (Object.keys(next) as (keyof Rect)[]).some((key) => Math.abs(next[key] - entry.rect[key]) > 0.1)
    entry.rect = next
    entry.target = unscaled(next, current.current.drawn)
    if (!changed && laidOut.current) return
    laidOut.current = true
    // measureLayout reports layout positions without a target's own press scale.
    element.measureLayout(
      root,
      (x, y, width, height) => {
        entry.layout = { x, y, width, height }
      },
      () => {
        entry.layout = next
      },
    )
    if (changed) context.registry.notify()
  }
  useLayoutEffect(() => {
    if (!name || !scene) return
    if (scene.registry.entries.has(name)) throw new Error(`Duplicate Stageshow target: ${name}`)
    // The effect below measures it in this same commit.
    scene.registry.entries.set(name, entry)
    return () => {
      if (scene.registry.entries.get(name) === entry) {
        scene.registry.entries.delete(name)
        scene.registry.notify()
      }
    }
  }, [name, scene?.registry, entry])
  useLayoutEffect(() => {
    if (name) void entry.measure?.()
  })
  // Unnamed views never match: undefined === undefined would snap every tween beneath them.
  const scoped = !!name && scene?.instantScope === name
  return (
    <HiddenTargets.Provider value={!!hidden}>
      <ParentTarget.Provider value={name ?? parent}>
        <MotionContext.Provider value={scoped ? { ...motion, instant: true } : motion}>
          <Animated.View
            {...rest}
            ref={node}
            collapsable={false}
            testID={rest.testID ?? name}
            pointerEvents={hidden ? 'none' : rest.pointerEvents}
            accessibilityElementsHidden={hidden || rest.accessibilityElementsHidden}
            importantForAccessibility={hidden ? 'no-hide-descendants' : rest.importantForAccessibility}
            onLayout={(event) => {
              onLayout?.(event)
              if (name) void entry.measure?.()
            }}
            style={drawn}
          >
            {children}
          </Animated.View>
        </MotionContext.Provider>
      </ParentTarget.Provider>
    </HiddenTargets.Provider>
  )
})
export function Label({
  children,
  style,
  lines,
}: {
  children?: ReactNode
  style?: StyleProp<TextStyle>
  lines?: number
}) {
  const { tokens } = useLook()
  const text = (value: ReactNode, key?: number) => (
    <RNText
      key={key}
      numberOfLines={lines}
      style={[
        { fontSize: tokens.fontSize, color: tokens.text, fontFamily: tokens.fontFamily, includeFontPadding: false },
        style,
      ]}
    >
      {value}
    </RNText>
  )
  if (typeof children === 'string' || typeof children === 'number') return text(children)
  // Mixed content (`<><Spinner /> Deploying</>`, `{n} items`) reads inline, as it does in a
  // web label: runs of text are styled, elements sit beside them in one centered row.
  const items = Children.toArray(
    isValidElement<{ children?: ReactNode }>(children) && children.type === Fragment
      ? children.props.children
      : children,
  )
  const words = (n: ReactNode) => typeof n === 'string' || typeof n === 'number'
  if (!items.some(words)) return <>{children}</>
  if (items.every(words)) return text(items.join(''))
  const runs: ReactNode[] = []
  for (const item of items)
    if (words(item) && words(runs[runs.length - 1])) runs[runs.length - 1] = `${runs[runs.length - 1]}${item}`
    else runs.push(item)
  return <View style={row}>{runs.map((run, i) => (words(run) ? text(run, i) : run))}</View>
}
export const row: ViewStyle = { flexDirection: 'row', alignItems: 'center' }
export const absolute = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 }
