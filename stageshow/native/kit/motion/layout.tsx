import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, View, type LayoutRectangle } from 'react-native'
import { SceneView, Label, absolute, useScene, SuppressTargets, HiddenTargets, type NativeProps } from '../native'
import { useTween, useNumber } from '../animate'
import { useReducedMotion, MotionContext } from '../reduced-motion'
import { clock } from '../clock'
import { Mask, edgeMask } from '../mask'
import { useLook } from '../look'
import type { Rect } from '../geometry'
import type { EaseName, Bezier } from '../ease'

export function Collapse({
  open,
  reveal = 'clip',
  from = 'above',
  solid = false,
  children,
  style,
  ...rest
}: NativeProps & { open: boolean; reveal?: 'clip' | 'drop'; from?: 'above' | 'below'; solid?: boolean }) {
  const [height, setHeight] = useState(0),
    p = useTween(open ? 1 : 0, 500)
  return (
    <SceneView {...rest} hidden={!open} style={[{ height: Animated.multiply(p, height), overflow: 'hidden' }, style]}>
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
          opacity: solid ? 1 : p,
          transform:
            reveal === 'drop'
              ? [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [from === 'above' ? -12 : 12, 0] }) }]
              : [],
        }}
      >
        {children}
      </Animated.View>
    </SceneView>
  )
}
/** Measures intrinsic content separately so outgoing text never wraps during a resize. */
export function Probe({
  children,
  onSize,
}: {
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
          style={{ position: 'absolute', width: scene?.width ?? 1000, opacity: 0 }}
        >
          <View style={{ alignSelf: 'flex-start' }} onLayout={(event) => onSize(event.nativeEvent.layout)}>
            <Label>{children}</Label>
          </View>
        </View>
      </MotionContext.Provider>
    </SuppressTargets.Provider>
  )
}
function SwapLayer({
  children,
  outgoing,
  duration,
  width,
  initial,
}: {
  children: ReactNode
  outgoing?: boolean
  duration: number
  width?: number
  initial?: boolean
}) {
  const opacity = useTween(outgoing ? 0 : 1, duration * 0.6, {
    from: outgoing || initial ? 1 : 0,
    delay: outgoing ? 0 : duration * 0.3,
  })
  return (
    <SuppressTargets.Provider value={!!outgoing}>
      <Animated.View
        pointerEvents={outgoing ? 'none' : undefined}
        accessibilityElementsHidden={outgoing}
        style={{ position: outgoing ? 'absolute' : 'relative', width: width || undefined, opacity }}
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
  const last = useRef({ id, children, width: 0 }),
    first = useRef(id)
  const [outgoing, setOutgoing] = useState<{ id: string | number; children: ReactNode; width: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (last.current.id !== id) setOutgoing(reduced ? null : last.current)
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
  const w = useTween(size.width, duration, { delay: outgoing && size.width < outgoing.width ? duration / 2 : 0 }),
    h = useTween(size.height, duration)
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
      <SwapLayer key={`in-${id}`} initial={id === first.current} duration={duration} width={size.width}>
        {children}
      </SwapLayer>
    </SceneView>
  )
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
  const p = useTween(active ? 1 : 0, 240, { delay: active ? 120 : 0 })
  return (
    <>
      <Probe onSize={onSize}>{children}</Probe>
      <HiddenTargets.Provider value={!active}>
        <Animated.View
          accessibilityElementsHidden={!active}
          importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
            justifyContent: 'center',
            opacity: p,
          }}
        >
          <Label>{children}</Label>
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
    p = useTween(show ? 1 : 0, show ? 300 : 200)
  return (
    <SceneView
      {...rest}
      hidden={!show}
      style={[
        {
          position: 'absolute',
          opacity: p,
          zIndex: 100,
          borderRadius: 10,
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          borderWidth: 0.5,
          boxShadow: '0 8px 25px rgba(0,0,0,.14)',
          transformOrigin: displayed.origin,
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        },
        displayed.style,
      ]}
    >
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
  const current = useRef<Rect | null>(to),
    velocity = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const target = useRef(to)
  target.current = to
  const values = useRef({
    x: new Animated.Value(to?.x ?? 0),
    y: new Animated.Value(to?.y ?? 0),
    width: new Animated.Value(to?.width ?? 0),
    height: new Animated.Value(to?.height ?? 0),
  }).current
  useEffect(() => {
    let frame = 0,
      previous = clock.now(),
      remainder = 0
    const keys = ['x', 'y', 'width', 'height'] as const
    const step = (time: number) => {
      if (!target.current) {
        current.current = null
        velocity.current = { x: 0, y: 0, width: 0, height: 0 }
        return
      }
      if (!current.current || reduced) {
        current.current = { ...target.current }
        velocity.current = { x: 0, y: 0, width: 0, height: 0 }
      }
      remainder += Math.min(100, (time - previous) * speed)
      previous = time
      while (remainder >= 1000 / 60) {
        for (const key of keys) {
          velocity.current[key] +=
            (target.current[key] - current.current[key]) * stiffness -
            velocity.current[key] * 2 * Math.sqrt(stiffness) * 0.95
          current.current[key] += velocity.current[key]
        }
        remainder -= 1000 / 60
      }
      let settled = true
      for (const key of keys) {
        if (Math.abs(target.current[key] - current.current[key]) < 0.05 && Math.abs(velocity.current[key]) < 0.05) {
          current.current[key] = target.current[key]
          velocity.current[key] = 0
        } else settled = false
        values[key].setValue(current.current[key])
      }
      if (!settled && !reduced) frame = clock.raf(step)
    }
    step(clock.now())
    return () => clock.cancelRaf(frame)
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
          opacity: to ? 1 : 0,
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
export function Fly({ from, to, go, held = false, duration = 750, children, style, ...rest }: FlyProps) {
  const flight = useRef<{ from: Rect; to: Rect } | null>(null)
  if (!go) flight.current = null
  else if (!flight.current) flight.current = { from: { ...from }, to: { ...to } }
  const endpoints = flight.current ?? { from, to },
    start = endpoints.from.width
      ? endpoints.from
      : { ...endpoints.from, width: endpoints.to.width || 1, height: endpoints.to.height || 1 }
  const x = useTween(go ? endpoints.to.x - start.x : 0, duration, { ease: [0.35, 0, 0.2, 1] })
  const y = useTween(go ? endpoints.to.y - start.y : 0, duration, { ease: [0.3, 0.6, 0.15, 1] })
  const lift = useTween(go ? 1 : 0, duration),
    bud = useTween(go || held ? 1 : 0, 200, { from: 0 })
  const scale = useTween(go ? endpoints.to.width / start.width : 1, duration, { ease: [0.3, 0.6, 0.15, 1] })
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
          opacity: bud,
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
            transform: [{ scale: lift.interpolate({ inputRange: [0, 0.3, 0.85, 1], outputRange: [1, 1.12, 1, 1] }) }],
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
  children,
  style,
  ...rest
}: NativeProps & { open: boolean; from: Rect; radius?: number; duration?: number; face?: ReactNode }) {
  const inheritedHidden = useContext(HiddenTargets)
  const ms = duration ?? (face ? 640 : 520)
  const contentOpacity = useTween(open ? 1 : 0, ms * (open ? 0.4 : 0.25), { delay: ms * (open ? 0.3 : 0.6) })
  const faceOpacity = useTween(open ? 0 : 1, ms * (open ? 0.4 : 0.3), { delay: open ? 0 : ms * 0.65 })
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
  const p = useTween(open ? 1 : 0, duration ?? (face ? 640 : 520), {
    ease: face ? [0.25, 0.6, 0.2, 1] : [0.3, 0.75, 0.1, 1],
  })
  const x = (from.x - parent.x) / parent.scale,
    y = (from.y - parent.y) / parent.scale,
    w = from.width / parent.scale,
    h = from.height / parent.scale
  const left = p.interpolate({ inputRange: [0, 1], outputRange: [x, 0] }),
    top = p.interpolate({ inputRange: [0, 1], outputRange: [y, 0] })
  const width = p.interpolate({ inputRange: [0, 1], outputRange: [w, parent.width] }),
    height = p.interpolate({ inputRange: [0, 1], outputRange: [h, parent.height] })
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
            left,
            top,
            width,
            height,
            borderRadius: p.interpolate({ inputRange: [0, 1], outputRange: [radius, 0] }),
            overflow: 'hidden',
            backgroundColor: '#fff',
          },
          style,
        ]}
      >
        <Animated.View
          pointerEvents={face && !open ? 'none' : undefined}
          accessibilityElementsHidden={!!face && !open}
          importantForAccessibility={face && !open ? 'no-hide-descendants' : undefined}
          style={{
            width: parent.width,
            height: parent.height,
            opacity: face ? contentOpacity : 1,
            transformOrigin: 'top left',
            transform: face
              ? [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [w / (parent.width || 1), 1] }) }]
              : [],
          }}
        >
          <HiddenTargets.Provider value={inheritedHidden || (!!face && !open)}>{children}</HiddenTargets.Provider>
        </Animated.View>
        {face && (
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
              transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, parent.width / (w || 1)] }) }],
            }}
          >
            {face}
          </Animated.View>
        )}
      </SceneView>
    </View>
  )
}
