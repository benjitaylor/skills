import {
  Children,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle, type LayoutRectangle } from 'react-native'
import {
  SceneView,
  Label,
  absolute,
  row,
  useScene,
  SuppressTargets,
  HiddenTargets,
  type NativeProps,
  type NativeStyle,
} from '../native'
import { useTween, useNumber, curves } from '../animate'
import { useEntranceReduced, useReducedMotion, MotionContext } from '../reduced-motion'
import { clock } from '../clock'
import { Mask, edgeMask } from '../mask'
import { useLook } from '../look'
import { PhoneContext } from '../phone'
import { bezier, type EaseName, type Bezier } from '../ease'
import type { Rect } from '../geometry'

/** Sideways room for layers that must lay out at their own width inside a narrower box. */
const SPILL = 1000

export function Collapse({
  open,
  reveal = 'clip',
  from = 'above',
  solid = false,
  children,
  style,
  ...rest
}: NativeProps & { open: boolean; reveal?: 'clip' | 'drop'; from?: 'above' | 'below'; solid?: boolean }) {
  const reduced = useReducedMotion(),
    { speed } = useContext(MotionContext)
  const [height, setHeight] = useState(0),
    drop = reveal === 'drop',
    // Taller than a row, a clip reveal opens from the top and fades in late
    tall = height > 44
  // The space and the fade each run their own curve, and differ by direction (Collapse.css)
  const space = useTween(open ? 1 : 0, open ? (drop ? 500 : 460) : 420, {
    delay: open ? 0 : 50,
    ease: open && drop ? [0.45, 0, 0.2, 1] : [0.4, 0, 0.2, 1],
  })
  const fade = useTween(open ? 1 : 0, open ? (drop ? 300 : 240) : 420, {
    delay: open ? (drop ? 240 : tall ? 300 : 150) : 0,
    ease: open ? (drop ? curves.ease : curves.easeOut) : [0, 0.8, 0.5, 1],
  })
  const glide = useTween(open ? 0 : from === 'below' ? 10 : -10, open ? 600 : 300, {
    delay: open ? 200 : 0,
    ease: open ? [0.22, 1, 0.36, 1] : curves.ease,
  })
  // Clipped while the height moves; settled open, a toolbar or popover can hang off it
  const [shown, setShown] = useState(open),
    [moving, setMoving] = useState(false)
  if (shown !== open) {
    setShown(open)
    setMoving(!reduced)
  }
  useEffect(() => {
    if (!moving) return
    const id = clock.timeout(() => setMoving(false), (open ? (drop ? 500 : 460) : 470) / speed)
    return () => clock.clearTimeout(id)
  }, [moving, open, drop, speed])
  return (
    <SceneView
      {...rest}
      hidden={!open}
      style={[
        { height: Animated.multiply(space, height), overflow: drop || (open && !moving) ? 'visible' : 'hidden' },
        style,
      ]}
    >
      <Animated.View
        onLayout={(event) => {
          const h = event.nativeEvent.layout.height
          if (h !== height) setHeight(h)
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          opacity: solid ? 1 : fade,
          // A row unfolds from its middle line, clipped equally above and below
          transform: drop
            ? [{ translateY: glide }]
            : tall
              ? []
              : [{ translateY: space.interpolate({ inputRange: [0, 1], outputRange: [-height / 2, 0] }) }],
        }}
      >
        {children}
      </Animated.View>
    </SceneView>
  )
}
/**
 * Measures intrinsic content separately so outgoing text never wraps during a resize. Sizes are
 * rounded up a pixel unless `exact`, for callers that give the text its own room.
 */
export function Probe({
  children,
  onSize,
  maxWidth,
  exact = false,
}: {
  maxWidth?: number
  exact?: boolean
  children: ReactNode
  onSize(size: { width: number; height: number }): void
}) {
  const scene = useScene(),
    motion = useContext(MotionContext)
  return (
    <SuppressTargets.Provider value>
      <MotionContext.Provider value={{ ...motion, instant: true }}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', width: maxWidth ?? scene?.width ?? 1000, opacity: 0 }}
        >
          <View
            style={{ alignSelf: 'flex-start', maxWidth: '100%' }}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout
              onSize(exact ? { width, height } : { width: Math.ceil(width) + 1, height: Math.ceil(height) })
            }}
          >
            <Label>{children}</Label>
          </View>
        </View>
      </MotionContext.Provider>
    </SuppressTargets.Provider>
  )
}
/** A text layer's width for an exact measured width: never narrower, so it can't rewrap. */
const room = (width: number) => Math.ceil(width) + 1
function SwapLayer({
  children,
  outgoing,
  duration,
  width,
}: {
  children: ReactNode
  outgoing?: boolean
  duration: number
  width?: number
}) {
  // The fade on first mount is an entrance: it plays through settling, as Swap.css's animation does
  const reduced = useEntranceReduced()
  // Out fades over half the swap; in holds clear for 30%, then rises (Swap.css), from its first mount
  const opacity = useTween(outgoing ? 0 : 1, outgoing ? duration * 0.5 : duration * 0.7, {
    from: outgoing || reduced ? 1 : 0,
    delay: outgoing ? 0 : duration * 0.3,
    ease: outgoing ? curves.ease : [0.25, 0.8, 0.25, 1],
  })
  return (
    <SuppressTargets.Provider value={!!outgoing}>
      <Animated.View
        pointerEvents={outgoing ? 'none' : undefined}
        accessibilityElementsHidden={outgoing}
        style={{ position: outgoing ? 'absolute' : 'relative', width: width ? room(width) : undefined, opacity }}
      >
        <Label>{children}</Label>
      </Animated.View>
    </SuppressTargets.Provider>
  )
}
export function Swap({
  id,
  duration = 450,
  children,
  style,
  ...rest
}: Omit<NativeProps, 'id'> & { id: string | number; duration?: number }) {
  const reduced = useReducedMotion(),
    { speed } = useContext(MotionContext)
  const last = useRef({ id, children, width: 0 })
  const [outgoing, setOutgoing] = useState<{ id: string | number; children: ReactNode; width: number } | null>(null)
  // The box's width as the last swap began. It outlives the fading copy, so a shrink keeps its delay to the end
  const [resize, setResize] = useState<{ from: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (last.current.id !== id) {
      setOutgoing(reduced ? null : last.current)
      setResize(reduced ? null : { from: last.current.width })
    }
    last.current = { id, children, width: size.width }
  }, [id, children, reduced, size.width])
  useEffect(() => {
    if (!outgoing) return
    if (reduced) {
      setOutgoing(null)
      return
    }
    const timer = clock.timeout(() => setOutgoing(null), duration / speed)
    return () => clock.clearTimeout(timer)
  }, [outgoing, duration, speed, reduced])
  useEffect(() => {
    if (!resize) return
    // A shrink ends at 1.5x the swap, plus a little for the new size to be measured
    const timer = clock.timeout(() => setResize(null), (duration * 1.5 + 100) / speed)
    return () => clock.clearTimeout(timer)
  }, [resize, duration, speed])
  const maxWidth = (StyleSheet.flatten(style) as ViewStyle | undefined)?.maxWidth
  // Only a swap eases the box; a first measure or a late font takes its size at once. Narrowing
  // waits while the old words fade, so they are never cut mid-word
  const shrink = !!resize && resize.from > 0 && size.width < resize.from
  const w = useTween(size.width, resize ? duration : 0, {
      delay: shrink ? duration / 2 : 0,
      ease: [0.25, 0.8, 0.25, 1],
    }),
    h = useTween(size.height, resize ? duration : 0, { ease: [0.25, 0.8, 0.25, 1] })
  return (
    <SceneView
      {...rest}
      style={[
        {
          width: size.width ? w : undefined,
          height: size.height ? h : undefined,
          alignSelf: 'flex-start',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Probe
        exact
        maxWidth={typeof maxWidth === 'number' ? maxWidth : undefined}
        key={id}
        onSize={(value) => setSize((old) => (old.width === value.width && old.height === value.height ? old : value))}
      >
        {children}
      </Probe>
      {outgoing && (
        <SwapLayer key={`out-${outgoing.id}`} outgoing duration={duration} width={outgoing.width}>
          {outgoing.children}
        </SwapLayer>
      )}
      <SwapLayer key={`in-${id}`} duration={duration} width={size.width}>
        {children}
      </SwapLayer>
    </SceneView>
  )
}
/** A state's content as the web lays it out: one row, 6pt gaps, runs of bare text in the kit's text style. */
function Inline({ children }: { children: ReactNode }) {
  const items: ReactNode[] = []
  let text = ''
  const flush = () => {
    const run = text.trim()
    if (run) items.push(<Label key={`t${items.length}`}>{run}</Label>)
    text = ''
  }
  const walk = (node: ReactNode) => {
    for (const child of Children.toArray(node)) {
      if (typeof child === 'string' || typeof child === 'number') text += child
      else if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) walk(child.props.children)
      else {
        flush()
        items.push(<Fragment key={`e${items.length}`}>{child}</Fragment>)
      }
    }
  }
  walk(children)
  flush()
  return <View style={[row, { gap: 6 }]}>{items}</View>
}
function StateItem({
  active,
  children,
  align,
  onSize,
}: {
  active: boolean
  children: ReactNode
  align: 'start' | 'center' | 'end'
  onSize: (size: { width: number; height: number }) => void
}) {
  // Out fades fast and drops back 4pt once gone; in rises 4pt as it fades in (States.css)
  const opacity = useTween(active ? 1 : 0, active ? 250 : 150, {
    delay: active ? 70 : 0,
    ease: active ? curves.easeOut : curves.ease,
  })
  const lift = useTween(active ? 0 : 4, active ? 300 : 0, { delay: active ? 70 : 150, ease: [0.22, 1, 0.36, 1] })
  const content = <Inline>{children}</Inline>
  return (
    <>
      <Probe exact onSize={onSize}>
        {content}
      </Probe>
      <HiddenTargets.Provider value={!active}>
        <Animated.View
          pointerEvents="box-none"
          accessibilityElementsHidden={!active}
          importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            // Wider than the box it's measured to, so a state never wraps in it
            left: align === 'start' ? 0 : -SPILL,
            right: align === 'end' ? 0 : -SPILL,
            alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
            justifyContent: 'center',
            opacity,
            transform: [{ translateY: lift }],
          }}
        >
          {content}
        </Animated.View>
      </HiddenTargets.Provider>
    </>
  )
}
export function States<K extends string>({
  value,
  states,
  align = 'center',
  style,
  ...rest
}: NativeProps & { value: K; states: Record<K, ReactNode>; align?: 'start' | 'center' | 'end' }) {
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({})
  return (
    <SceneView
      {...rest}
      style={[
        {
          width: Math.max(0, ...Object.values(sizes).map((s) => s.width)),
          height: Math.max(0, ...Object.values(sizes).map((s) => s.height)),
        },
        style,
      ]}
    >
      {Object.entries<ReactNode>(states).map(([key, node]) => (
        <StateItem
          key={key}
          active={key === value}
          align={align}
          onSize={(size) =>
            setSizes((s) =>
              s[key]?.width === size.width && s[key]?.height === size.height ? s : { ...s, [key]: size },
            )
          }
        >
          {node}
        </StateItem>
      ))}
    </SceneView>
  )
}
export type PopoverOrigin =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center'
  | `${'top' | 'bottom' | 'center'} ${'left' | 'right' | 'center'}`
  | `${'left' | 'right'} center`
export function Popover({
  show,
  origin = 'top left',
  style,
  children,
  ...rest
}: NativeProps & { show: boolean; origin?: PopoverOrigin }) {
  const { tokens } = useLook()
  const held = useRef({ children, style, origin }),
    [released, setReleased] = useState(!show)
  useLayoutEffect(() => {
    if (show) held.current = { children, style, origin }
  }, [show, children, style, origin])
  useEffect(() => {
    if (show) {
      setReleased(false)
      return
    }
    const id = clock.timeout(() => setReleased(true), 320)
    return () => clock.clearTimeout(id)
  }, [show])
  const displayed = show || released ? { children, style, origin } : held.current,
    closing = !show && !released
  // Opening, only the surface scales, under text that only fades. Closing, the whole popover
  // shrinks as it fades; once gone, the surface takes its opening scale again (Popover.css)
  const opacity = useTween(show ? 1 : 0, show ? 180 : 240, { ease: curves.ease })
  const whole = useTween(closing ? 0.96 : 1, closing ? 240 : 0, { ease: [0.4, 0, 1, 1] })
  const surface = useTween(show || closing ? 1 : 0.96, show ? 240 : closing ? 0 : 300, {
    ease: show ? [0.22, 1, 0.36, 1] : curves.ease,
  })
  // A background or shadow given in style paints the scaling surface, as --ss-popover-bg does
  const { backgroundColor, boxShadow, ...own } = (StyleSheet.flatten(displayed.style as StyleProp<ViewStyle>) ??
    {}) as ViewStyle
  return (
    <SceneView
      {...rest}
      hidden={!show}
      style={[
        {
          position: 'absolute',
          opacity,
          zIndex: 100,
          padding: 4,
          borderRadius: tokens.radii.lg,
          transformOrigin: displayed.origin,
          transform: [{ scale: whole }],
        },
        own as NativeStyle,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          absolute,
          {
            borderRadius: own.borderRadius ?? tokens.radii.lg,
            backgroundColor: backgroundColor ?? tokens.raised,
            boxShadow: boxShadow ?? tokens.shadow.float,
            transformOrigin: displayed.origin,
            transform: [{ scale: surface }],
          },
        ]}
      />
      {displayed.children}
    </SceneView>
  )
}
export interface FollowProps extends NativeProps {
  to: Rect | null
  stiffness?: number
}
export function Follow({ to, stiffness = 0.25, children, style, ...rest }: FollowProps) {
  const reduced = useReducedMotion(),
    { speed } = useContext(MotionContext)
  const current = useRef<Rect | null>(to ? { ...to } : null),
    velocity = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 })
  const target = useRef(to)
  target.current = to
  const values = useRef({
    x: new Animated.Value(to?.x ?? 0),
    y: new Animated.Value(to?.y ?? 0),
    width: new Animated.Value(to?.width ?? 0),
    height: new Animated.Value(to?.height ?? 0),
  }).current
  const opacity = useTween(to ? 1 : 0, 180, { ease: curves.ease })
  useEffect(() => {
    const keys = ['x', 'y', 'width', 'height'] as const,
      frame = 1000 / 60,
      damp = 2 * Math.sqrt(stiffness) * 0.95
    const integrate = (c: Rect, v: Rect, t: Rect) => {
      for (const key of keys) {
        v[key] += (t[key] - c[key]) * stiffness - v[key] * damp
        c[key] += v[key]
      }
    }
    // A new target springs on from the rendered position and velocity, so an interruption can't rewind
    let id = 0,
      previous = clock.now(),
      remainder = 0,
      simulation = current.current ? { ...current.current } : null,
      simulated = { ...velocity.current }
    const step = (time: number) => {
      const elapsed = Math.min(100, Math.max(0, time - previous) * speed)
      previous = time
      const t = target.current
      // Hidden, it forgets where it was, so it next appears on its target rather than sliding in
      if (!t || reduced) {
        current.current = t ? { ...t } : null
        velocity.current = { x: 0, y: 0, width: 0, height: 0 }
        simulation = current.current ? { ...current.current } : null
        simulated = { ...velocity.current }
        remainder = 0
      }
      if (!t) return
      if (!current.current || !simulation) {
        current.current = { ...t }
        simulation = { ...t }
      }
      const c = current.current,
        v = velocity.current
      // The spring keeps its 60Hz trajectory; between steps it is interpolated, not stepped faster
      remainder += elapsed
      while (remainder >= frame - 1e-6) {
        integrate(simulation, simulated, t)
        remainder = Math.max(0, remainder - frame)
      }
      const next = { ...simulation },
        nextVelocity = { ...simulated },
        part = remainder / frame
      integrate(next, nextVelocity, t)
      let settled = true
      for (const key of keys) {
        c[key] = simulation[key] + (next[key] - simulation[key]) * part
        v[key] = simulated[key] + (nextVelocity[key] - simulated[key]) * part
        if (Math.abs(t[key] - c[key]) < 0.05 && Math.abs(v[key]) < 0.05) {
          c[key] = t[key]
          v[key] = 0
        } else settled = false
        values[key].setValue(c[key])
      }
      if (!settled) id = clock.raf(step)
    }
    step(clock.now())
    return () => clock.cancelRaf(id)
  }, [to?.x, to?.y, to?.width, to?.height, !!to, stiffness, reduced, speed, values])
  return (
    <SceneView
      {...rest}
      hidden={!to}
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: values.width,
          height: values.height,
          opacity,
          transform: [{ translateX: values.x }, { translateY: values.y }],
        },
        style,
      ]}
    >
      {children}
    </SceneView>
  )
}
export function cellOf(value: number, size: number, prev: number | null, hysteresis = 0.2) {
  const raw = Math.floor(value / size)
  if (prev === null || raw === prev) return raw
  const edge = raw > prev ? (prev + 1) * size : prev * size
  return Math.abs(value - edge) > size * hysteresis ? raw : prev
}
export function Camera({
  focus,
  pad = 32,
  max = 2,
  duration = 1100,
  feather = 28,
  ease = 'camera',
  children,
  style,
  ...rest
}: NativeProps & {
  focus: Rect | null
  pad?: number
  max?: number
  duration?: number
  feather?: number
  ease?: EaseName | Bezier
}) {
  const scene = useScene(),
    [size, setSize] = useState({ width: scene?.width ?? 0, height: scene?.height ?? 0 })
  const scale =
    focus && size.width
      ? Math.max(1, Math.min(max, size.width / (focus.width + pad * 2), size.height / (focus.height + pad * 2)))
      : 1
  const tx = focus
    ? Math.min(0, Math.max(size.width - size.width * scale, size.width / 2 - (focus.x + focus.width / 2) * scale))
    : 0
  const ty = focus
    ? Math.min(0, Math.max(size.height - size.height * scale, size.height / 2 - (focus.y + focus.height / 2) * scale))
    : 0
  const edge = useNumber(useTween(focus ? feather : 0, duration, { ease }))
  const s = useTween(scale, duration, { ease }),
    x = useTween(tx, duration, { ease }),
    y = useTween(ty, duration, { ease })
  return (
    <SceneView
      {...rest}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={[{ flex: 1, overflow: 'hidden' }, style]}
    >
      <Mask animated xml={edgeMask(Math.max(1, size.width), Math.max(1, size.height), edge)} style={{ flex: 1 }}>
        <Animated.View
          style={{
            width: size.width,
            height: size.height,
            transformOrigin: 'top left',
            transform: [{ translateX: x }, { translateY: y }, { scale: s }],
          }}
        >
          {children}
        </Animated.View>
      </Mask>
    </SceneView>
  )
}
export interface FlyProps extends NativeProps {
  from: Rect
  to: Rect
  go: boolean
  held?: boolean
  duration?: number
}
// The lift's keyframes are eased one segment at a time, as CSS eases a keyframe animation
const lifting = bezier([0.33, 1, 0.68, 1])
export function Fly({ from, to, go, held = false, duration = 750, children, style, ...rest }: FlyProps) {
  const flight = useRef<{ from: Rect; to: Rect } | null>(null)
  if (!go) flight.current = null
  else if (!flight.current) flight.current = { from: { ...from }, to: { ...to } }
  const endpoints = flight.current ?? { from, to },
    start = endpoints.from.width
      ? endpoints.from
      : { ...endpoints.from, width: endpoints.to.width || 1, height: endpoints.to.height || 1 }
  // Shown whole the instant it takes off and hidden the instant it stops, so going back is a jump
  const ms = go ? duration : 0
  const x = useTween(go ? endpoints.to.x - start.x : 0, ms, { ease: [0.35, 0, 0.2, 1] })
  const y = useTween(go ? endpoints.to.y - start.y : 0, ms, { ease: [0.3, 0.6, 0.15, 1] })
  const scale = useTween(go ? endpoints.to.width / start.width : 1, ms, { ease: [0.3, 0.6, 0.15, 1] })
  const lift = useTween(go ? 1 : 0, ms, { ease: curves.linear })
  // Held at rest, it buds in where it sits (Fly.css ss-fly-bud)
  const bud = useTween(held && !go ? 1 : 0, held && !go ? 200 : 0, { from: 0, ease: curves.easeOut })
  return (
    <SceneView
      {...rest}
      hidden={!go && !held}
      style={[
        {
          position: 'absolute',
          left: start.x,
          top: start.y,
          width: start.width,
          height: start.height,
          opacity: go ? 1 : bud,
          transform: [{ translateX: x }],
          zIndex: 150,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: start.width,
          height: start.height,
          transformOrigin: 'top left',
          transform: [{ translateY: y }, { scale }],
        }}
      >
        <Animated.View
          style={{
            flex: 1,
            transform: [
              {
                scale: lift.interpolate({
                  inputRange: [0, 0.3, 0.85, 1],
                  outputRange: [1, 1.12, 1, 1],
                  easing: lifting,
                }),
              },
            ],
          }}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </SceneView>
  )
}
export function Expand({
  open,
  from,
  radius = 16,
  duration,
  face,
  background,
  children,
  style,
  ...rest
}: NativeProps & {
  open: boolean
  from: Rect
  radius?: number
  duration?: number
  face?: ReactNode
  /** The launched app's ground, which the window takes as it leaves the face (`--ss-expand-bg`). */
  background?: string
}) {
  const { tokens } = useLook(),
    inheritedHidden = useContext(HiddenTargets)
  // Inside a Phone it opens to the display's own corner, as the web reads --ss-screen-r
  const opened = useContext(PhoneContext)?.radius ?? 0
  const ms = duration ?? (face ? 640 : 520)
  const p = useTween(open ? 1 : 0, ms, { ease: face ? [0.25, 0.6, 0.2, 1] : [0.3, 0.75, 0.1, 1] })
  const contentOpacity = useTween(open ? 1 : 0, ms * (open ? 0.4 : 0.25), {
    delay: ms * (open ? 0.3 : 0.6),
    ease: curves.ease,
  })
  const faceOpacity = useTween(open ? 0 : 1, ms * (open ? 0.4 : 0.3), {
    delay: open ? 0 : ms * 0.65,
    ease: curves.ease,
  })
  const ground = useTween(open ? 1 : 0, ms * (open ? 0.4 : 0.25), { delay: open ? 0 : ms * 0.7, ease: curves.ease })
  const scene = useScene(),
    node = useRef<View>(null),
    [parent, setParent] = useState({ x: 0, y: 0, width: scene?.width ?? 0, height: scene?.height ?? 0, scale: 1 })
  const measure = (layout: LayoutRectangle) => {
    if (!node.current || !scene?.root.current) return
    scene.root.current.measureInWindow((sx, sy, sw) =>
      node.current?.measureInWindow((x, y, width) => {
        const scale = sw / scene.width || 1,
          k = width / layout.width || scale
        setParent({
          x: (x - sx) / scale,
          y: (y - sy) / scale,
          width: layout.width,
          height: layout.height,
          scale: k / scale,
        })
      }),
    )
  }
  const x = (from.x - parent.x) / parent.scale,
    y = (from.y - parent.y) / parent.scale,
    w = from.width / parent.scale,
    h = from.height / parent.scale
  const between = (a: number, b: number) => p.interpolate({ inputRange: [0, 1], outputRange: [a, b] })
  const content = (
    <HiddenTargets.Provider value={inheritedHidden || (!!face && !open)}>{children}</HiddenTargets.Provider>
  )
  if (face) {
    // The whole app, laid out full size, is scaled by the card's width onto the card and clipped
    // to its height in its own pixels; the face rides that scale, blown up to the app's width
    const s = parent.width && w ? w / parent.width : 1
    return (
      <View
        ref={node}
        collapsable={false}
        onLayout={(event) => measure(event.nativeEvent.layout)}
        style={absolute}
        pointerEvents="box-none"
      >
        <SceneView
          {...rest}
          hidden={!open && (!w || !h)}
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: parent.width,
              height: parent.height,
              transformOrigin: 'top left',
              transform: [{ translateX: between(x, 0) }, { translateY: between(y, 0) }, { scale: between(s, 1) }],
            },
            style,
          ]}
        >
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: between(Math.min(parent.height, h / s), parent.height),
              borderRadius: between(radius / s, opened),
              overflow: 'hidden',
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={[absolute, { backgroundColor: background ?? tokens.surface, opacity: ground }]}
            />
            <Animated.View
              pointerEvents={!open ? 'none' : undefined}
              accessibilityElementsHidden={!open}
              importantForAccessibility={!open ? 'no-hide-descendants' : undefined}
              style={{ width: parent.width, height: parent.height, opacity: contentOpacity }}
            >
              {content}
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: w,
                height: h,
                opacity: faceOpacity,
                transformOrigin: 'top left',
                transform: [{ scale: 1 / s }],
              }}
            >
              {face}
            </Animated.View>
          </Animated.View>
        </SceneView>
      </View>
    )
  }
  return (
    <View
      ref={node}
      collapsable={false}
      onLayout={(event) => measure(event.nativeEvent.layout)}
      style={absolute}
      pointerEvents="box-none"
    >
      <SceneView
        {...rest}
        hidden={!open && (!w || !h)}
        style={[
          {
            position: 'absolute',
            left: between(x, 0),
            top: between(y, 0),
            width: between(w, parent.width),
            height: between(h, parent.height),
            borderRadius: between(radius, opened),
            overflow: 'hidden',
          },
          style,
        ]}
      >
        {/* The content rides the card down and up only; sideways it stays where the open screen has it */}
        <Animated.View
          style={{ width: parent.width, height: parent.height, transform: [{ translateX: between(-x, 0) }] }}
        >
          {content}
        </Animated.View>
      </SceneView>
    </View>
  )
}
