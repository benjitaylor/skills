import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Animated, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { SceneView, Label, row, useScene, type NativeProps } from './native'
import { useLook } from './look'
import { useCycle, useTween, useNumber } from './animate'
import { useReducedMotion } from './reduced-motion'
import { bezier } from './ease'
import { MotionContext } from './reduced-motion'
import { clock } from './clock'
import { Bar } from './window'
import { Collapse, Swap, Roll } from './motion'

const ThreadContext = createContext<{ app: 'imessage' | 'sms' | 'chat'; ready: { current: boolean } }>({
  app: 'imessage',
  ready: { current: false },
})
export interface ThreadProps extends NativeProps {
  app?: 'imessage' | 'sms' | 'chat'
}
function ThreadRow({ children }: { children: ReactNode }) {
  const previous = useRef<number | null>(null),
    current = useRef(0),
    value = useRef(new Animated.Value(0)).current
  const frame = useRef(0),
    reduced = useReducedMotion(),
    { speed } = useContext(MotionContext)
  useEffect(() => () => clock.cancelRaf(frame.current), [])
  useEffect(() => {
    if (reduced) {
      clock.cancelRaf(frame.current)
      current.current = 0
      value.setValue(0)
    }
  }, [reduced, value])
  return (
    <Animated.View
      onLayout={(event) => {
        const y = event.nativeEvent.layout.y,
          delta = previous.current === null ? 0 : previous.current - y
        previous.current = y
        if (reduced || Math.abs(delta) < 0.5) return
        clock.cancelRaf(frame.current)
        const from = current.current + delta,
          start = clock.now(),
          ease = bezier('settle')
        current.current = from
        value.setValue(from)
        const step = (time: number) => {
          const t = Math.min(1, ((time - start) * speed) / 420)
          current.current = from * (1 - ease(t))
          value.setValue(current.current)
          if (t < 1) frame.current = clock.raf(step)
        }
        frame.current = clock.raf(step)
      }}
      style={{ transform: [{ translateY: value }] }}
    >
      {children}
    </Animated.View>
  )
}
export function Thread({ app = 'imessage', children, style, ...rest }: ThreadProps) {
  const ready = useRef(false)
  useEffect(() => {
    ready.current = true
  }, [])
  const list = Children.toArray(children).filter(isValidElement) as ReactElement<BubbleProps>[]
  return (
    <ThreadContext.Provider value={{ app, ready }}>
      <SceneView {...rest} style={[{ flex: 1, justifyContent: 'flex-end', overflow: 'hidden', gap: 6 }, style]}>
        {list.map((child, index) => {
          let item = child
          if (child.type === Bubble && child.props.tail === undefined) {
            const next = list.slice(index + 1).find((candidate) => candidate.type === Bubble)
            item = cloneElement(child, { tail: !next || next.props.from !== child.props.from })
          }
          return <ThreadRow key={child.key ?? index}>{item}</ThreadRow>
        })}
      </SceneView>
    </ThreadContext.Provider>
  )
}
export interface BubbleProps extends NativeProps {
  from: 'me' | 'them'
  typing?: boolean
  tail?: boolean
  source?: string
  tapback?: { emoji: ReactNode; show?: boolean }
  avatar?: ReactNode
}
function TypingDot({ index }: { index: number }) {
  const phase = useCycle(1200)
  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#8b8b90',
        opacity: phase.interpolate({
          inputRange: [0, 0.2 + index * 0.08, 0.4 + index * 0.08, 0.65 + index * 0.08, 1],
          outputRange: [0.45, 0.45, 1, 0.45, 0.45],
        }),
        transform: [
          {
            translateY: phase.interpolate({
              inputRange: [0, 0.2 + index * 0.08, 0.4 + index * 0.08, 0.65 + index * 0.08, 1],
              outputRange: [0, 0, -3, 0, 0],
            }),
          },
        ],
      }}
    />
  )
}
export function Bubble({
  from,
  typing = false,
  tail,
  source,
  tapback,
  avatar,
  children,
  style,
  target,
  'data-target': alias,
  ...rest
}: BubbleProps) {
  const { app, ready } = useContext(ThreadContext),
    arrived = useRef(ready.current).current
  const { fidelity, tokens, theme } = useLook(),
    reduced = useReducedMotion(),
    scene = useScene(),
    id = useId()
  const ownName = target ?? alias ?? `bubble-${id}`,
    [travel, setTravel] = useState({ x: 0, y: 0 }),
    [launched, setLaunched] = useState(false)
  const p = useTween(1, 500, { from: arrived ? 0 : 1 }),
    tap = useTween(tapback && tapback.show !== false ? 1 : 0, 300)
  useEffect(() => {
    if (!arrived || !source || !scene || reduced) return
    let live = true
    const frame = clock.layoutRaf(() => {
      void scene.registry.measure().then(() => {
        if (!live) return
        const start = scene.registry.rect(source),
          end = scene.registry.rect(ownName)
        if (!start.width || !end.width) return
        const scale = end.width / (scene.registry.rect(ownName, true).width || end.width) || 1
        setTravel({ x: (start.x - end.x) / scale, y: (start.y - end.y) / scale })
        setLaunched(true)
      })
    })
    return () => {
      live = false
      clock.cancelLayoutRaf(frame)
    }
  }, [])
  const fly = useTween(launched ? 1 : 0, 500),
    tailProgress = useTween(tail ? 1 : 0, 240)
  const fill =
    app === 'chat'
      ? from === 'me'
        ? tokens.well
        : 'transparent'
      : from === 'me'
        ? app === 'sms'
          ? '#34c759'
          : '#0b84ff'
        : theme === 'dark' || theme === 'blueprint'
          ? '#343438'
          : '#e9e9eb'
  const color = from === 'me' && app !== 'chat' ? '#fff' : tokens.text
  const content = typing ? (
    <View accessibilityLabel="Typing" style={[row, { gap: 4, paddingVertical: 5 }]}>
      {[0, 1, 2].map((i) => (
        <TypingDot key={i} index={i} />
      ))}
    </View>
  ) : fidelity === 'minimal' && typeof children === 'string' ? (
    <Bar w={Math.min(180, children.length * 5.5)} />
  ) : (
    <Label style={{ fontSize: 15, lineHeight: 20, color }}>{children}</Label>
  )
  return (
    <SceneView
      style={[
        {
          alignSelf: from === 'me' ? 'flex-end' : 'flex-start',
          maxWidth: '86%',
          marginBottom: Animated.multiply(tap, 16),
        },
        style,
      ]}
    >
      <View style={[row, { alignItems: 'flex-end', gap: 6 }]}>
        {avatar && from !== 'me' && avatar}
        <SceneView
          {...rest}
          target={ownName}
          style={{
            backgroundColor: fill,
            borderRadius: 18,
            paddingVertical: 9,
            paddingHorizontal: 13,
            opacity: p,
            transform: [
              { translateX: Animated.multiply(Animated.subtract(1, fly), travel.x) },
              {
                translateY: source
                  ? Animated.multiply(Animated.subtract(1, fly), travel.y)
                  : p.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              },
            ],
          }}
        >
          <Swap id={typing ? 'typing' : String(typeof children === 'string' ? children : 'message')} duration={400}>
            {content}
          </Swap>
          {app !== 'chat' && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 0,
                left: from === 'me' ? undefined : -4,
                right: from === 'me' ? -4 : undefined,
                opacity: tailProgress,
                transform: [{ scaleX: tailProgress }],
              }}
            >
              <Svg width={18} height={16} viewBox="0 0 18 16">
                <Path
                  fill={fill}
                  d={
                    from === 'me'
                      ? 'M0 0H12V8.5C12 12.6 14 15 17.5 16C15 16.7 12.2 16.5 9.8 15.3L0 15Z'
                      : 'M18 0H6V8.5C6 12.6 4 15 .5 16C3 16.7 5.8 16.5 8.2 15.3L18 15Z'
                  }
                />
              </Svg>
            </Animated.View>
          )}
          {tapback && (
            <Animated.View
              style={{
                position: 'absolute',
                bottom: -16,
                right: from === 'me' ? undefined : -4,
                left: from === 'me' ? -4 : undefined,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: tokens.surface,
                borderWidth: 1,
                borderColor: tokens.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: tap,
                transform: [{ scale: tap }],
              }}
            >
              <Label>{tapback.emoji}</Label>
            </Animated.View>
          )}
        </SceneView>
      </View>
    </SceneView>
  )
}
export function Stamp({ children, style, ...rest }: NativeProps) {
  const { tokens } = useLook()
  return (
    <SceneView {...rest} style={[{ alignItems: 'center', paddingVertical: 10 }, style]}>
      <Label style={{ color: tokens.muted, fontSize: 10 }}>{children}</Label>
    </SceneView>
  )
}
export function Receipt({
  show = true,
  children,
  style,
  ...rest
}: Omit<NativeProps, 'children'> & { show?: boolean; children: string }) {
  const { tokens } = useLook()
  return (
    <Collapse {...rest} open={show} style={style}>
      <View style={{ alignSelf: 'flex-end', paddingTop: 3, paddingRight: 4 }}>
        <Roll variant="fade" style={{ color: tokens.muted, fontSize: 10 }}>
          {children}
        </Roll>
      </View>
    </Collapse>
  )
}
