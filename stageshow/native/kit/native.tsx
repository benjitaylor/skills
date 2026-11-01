import {
  createContext,
  forwardRef,
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
function measured(node: View): Promise<Rect> {
  return new Promise((resolve) => {
    // A detached native ref may never call its callback. Bound the wait.
    const timeout = setTimeout(() => resolve({ x: 0, y: 0, width: 0, height: 0 }), 250)
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(timeout)
      resolve({ x, y, width, height })
    })
  })
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
  const current = useRef({ scene, hidden, cursor: cursor ?? cursorAlias, parent })
  current.current = { scene, hidden, cursor: cursor ?? cursorAlias, parent }
  useImperativeHandle(forwarded, () => node.current!, [])
  const interaction = useInteraction(name)
  entry.cursor = cursor ?? cursorAlias
  entry.hidden = hidden
  entry.parent = parent
  entry.measure = async () => {
    const context = current.current.scene,
      element = node.current,
      root = context?.root.current
    if (!context || !element || !root) return
    const [r, origin] = await Promise.all([measured(element), measured(root)])
    if (element !== node.current) return
    const scale = origin.width / context.width || context.scale || 1
    const next = {
      x: (r.x - origin.x) / scale,
      y: (r.y - origin.y) / scale,
      width: r.width / scale,
      height: r.height / scale,
    }
    const changed = (Object.keys(next) as (keyof Rect)[]).some((key) => Math.abs(next[key] - entry.rect[key]) > 0.1)
    entry.rect = next
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
    scene.registry.entries.set(name, entry)
    void entry.measure?.()
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
  const scoped = scene?.instantScope === name
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
            style={[style, interaction?.hover && hoverStyle, interaction?.pressed && pressedStyle]}
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
  if (typeof children !== 'string' && typeof children !== 'number') return <>{children}</>
  return (
    <RNText
      numberOfLines={lines}
      style={[
        { fontSize: tokens.fontSize, color: tokens.text, fontFamily: tokens.fontFamily, includeFontPadding: false },
        style,
      ]}
    >
      {children}
    </RNText>
  )
}
export const row: ViewStyle = { flexDirection: 'row', alignItems: 'center' }
export const absolute = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 }
