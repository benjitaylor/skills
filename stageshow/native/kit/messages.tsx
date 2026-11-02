import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Animated, StyleSheet, Text as RNText, View, type TextStyle, type ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { SceneView, Label, useScene, type NativeProps } from './native'
import { useLook } from './look'
import { useCycle, useTween } from './animate'
import { useReducedMotion, MotionContext } from './reduced-motion'
import { bezier, type Bezier } from './ease'
import { clock } from './clock'
import { PhoneContext } from './phone'

// The web kit's curves: CSS ease and ease-in-out; a bubble growing in, its box
// easing, the flight out of the composer; one curve for everything that
// scrolls (--ss-scroll), the tail and the receipt; the tapback's overshoot
const EASE: Bezier = [0.25, 0.1, 0.25, 1]
const IN_OUT: Bezier = [0.42, 0, 0.58, 1]
const GROW: Bezier = [0.22, 1, 0.36, 1]
const SCROLL: Bezier = [0.25, 1, 0.5, 1]
const POP: Bezier = [0.22, 1.4, 0.36, 1]
// How far the thread's clip reaches past its sides and bottom (web: clip-path inset(0 -100vw -100vh -100vw))
const REACH = 1000

/** The thread's colours and the tapback's ground (web `--ss-me`, `--ss-me-text`, `--ss-them`, `--ss-them-text`,
 * `--ss-thread-ground`). On a Thread they set every bubble; on a Bubble, that one. */
export interface MessageColors {
  me?: string
  meText?: string
  them?: string
  themText?: string
  ground?: string
}
type App = 'imessage' | 'sms' | 'chat'
const ThreadContext = createContext<{
  app: App
  ready: { current: boolean }
  width: number
  size?: number
  colors: MessageColors
}>({ app: 'imessage', ready: { current: false }, width: 358, colors: {} })
export interface ThreadProps extends NativeProps, MessageColors {
  app?: App
  /** The messages' type size (web `--ss-thread-size`): 17 inside a Phone, 15 outside one. */
  size?: number
}
function ThreadRow({ children, gap = 0 }: { children: ReactNode; gap?: number }) {
  const previous = useRef<number | null>(null),
    current = useRef(0),
    value = useRef(new Animated.Value(0)).current,
    row = useRef<View>(null),
    committed = useRef(false)
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
  // Only a commit glides, as web's FLIP compares tops across one: a row that moves because a receipt or a
  // reply is still opening is already traveling, and gliding it again would make it lag.
  const glide = (delta: number) => {
    if (reduced || Math.abs(delta) < 0.5) return
    // Glide from where it is on screen, so a glide under way continues instead of jumping back
    clock.cancelRaf(frame.current)
    const from = current.current + delta,
      start = clock.now(),
      ease = bezier(SCROLL)
    current.current = from
    value.setValue(from)
    const step = (time: number) => {
      const t = Math.min(1, ((time - start) * speed) / 550)
      current.current = from * (1 - ease(t))
      value.setValue(current.current)
      if (t < 1) frame.current = clock.raf(step)
    }
    frame.current = clock.raf(step)
  }
  // As web's FLIP does, a row reads its top just before the commit (during render) and just after it. The layout
  // offset leaves out every transform, the glide's own included, so a glide under way never feeds back into it.
  // React Native Web and the new architecture both give elements a synchronous offsetTop; layout events are the
  // fallback (React Native Web sends them only on size changes).
  const top = () => {
    const el = row.current as unknown as { offsetTop?: unknown } | null
    return el && typeof el.offsetTop === 'number' ? el.offsetTop : null
  }
  const before = top()
  if (before !== null) previous.current = before
  useLayoutEffect(() => {
    const now = top()
    if (now === null) {
      committed.current = true
      return
    }
    if (previous.current !== null) glide(previous.current - now)
    previous.current = now
  })
  return (
    <Animated.View
      ref={row}
      onLayout={(event) => {
        if (top() !== null) return
        const y = event.nativeEvent.layout.y,
          was = previous.current
        previous.current = y
        if (committed.current && was !== null) glide(was - y)
        committed.current = false
      }}
      style={{ marginTop: gap, transform: [{ translateY: value }] }}
    >
      {children}
    </Animated.View>
  )
}
const side = (value: unknown) => (typeof value === 'number' ? value : 0)
export function Thread({
  app = 'imessage',
  size,
  me,
  meText,
  them,
  themText,
  ground,
  children,
  style,
  ...rest
}: ThreadProps) {
  const ready = useRef(false),
    [width, setWidth] = useState(358)
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined
  const padding =
    side(flat?.paddingLeft ?? flat?.paddingHorizontal ?? flat?.padding) +
    side(flat?.paddingRight ?? flat?.paddingHorizontal ?? flat?.padding)
  const top = side(flat?.paddingTop ?? flat?.paddingVertical ?? flat?.padding)
  useEffect(() => {
    ready.current = true
  }, [])
  const context = useMemo(
    () => ({ app, ready, width: width - padding, size, colors: { me, meText, them, themText, ground } }),
    [app, width, padding, size, me, meText, them, themText, ground],
  )
  const list = Children.toArray(children).filter(isValidElement) as ReactElement<BubbleProps>[]
  return (
    <ThreadContext.Provider value={context}>
      <SceneView
        {...rest}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width)
          rest.onLayout?.(e)
        }}
        style={[{ justifyContent: 'flex-end' }, style]}
      >
        {/* Pinned to the bottom, clipping only what scrolls off the top: a tail or tapback at the sides
            and a bubble forming out of the composer below stay visible */}
        <View
          pointerEvents="box-none"
          style={{
            flexGrow: 1,
            flexShrink: 1,
            justifyContent: 'flex-end',
            gap: typeof flat?.gap === 'number' ? flat.gap : app === 'chat' ? 18 : 3,
            overflow: 'hidden',
            marginTop: -top,
            paddingTop: top,
            marginHorizontal: -REACH,
            paddingHorizontal: REACH,
            marginBottom: -REACH,
            paddingBottom: REACH,
          }}
        >
          {list.map((child, index) => {
            let item = child
            // A tail closes each run: the last bubble before the sender changes
            if (child.type === Bubble && child.props.tail === undefined) {
              const next = list.slice(index + 1).find((candidate) => candidate.type === Bubble)
              item = cloneElement(child, { tail: !next || next.props.from !== child.props.from })
            }
            // A gap between runs, a hairline within one
            const turn =
              app !== 'chat' &&
              child.type === Bubble &&
              list[index - 1]?.type === Bubble &&
              list[index - 1].props.from !== child.props.from
            return (
              <ThreadRow key={child.key ?? index} gap={turn ? 8 : 0}>
                {item}
              </ThreadRow>
            )
          })}
        </View>
      </SceneView>
    </ThreadContext.Provider>
  )
}
export interface BubbleProps extends NativeProps, MessageColors {
  from: 'me' | 'them'
  typing?: boolean
  tail?: boolean
  source?: string
  tapback?: { emoji: ReactNode; show?: boolean }
  avatar?: ReactNode
}
// ss-typing: 0, 60 and 100% faint and at rest, 30% full and lifted, ease-in-out between, 1.2s; each dot 0.16s later
const TYPING = (() => {
  const inOut = bezier(IN_OUT),
    steps = 48
  const at = (t: number) => {
    const u = ((t % 1) + 1) % 1
    if (u < 0.3) return inOut(u / 0.3)
    if (u < 0.6) return 1 - inOut((u - 0.3) / 0.3)
    return 0
  }
  const input = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  return [0, 1, 2].map((dot) => {
    const lift = input.map((t) => at(t - (dot * 0.16) / 1.2))
    return { input, opacity: lift.map((v) => 0.4 + 0.6 * v), lift }
  })
})()
function TypingDot({ index, size }: { index: number; size: number }) {
  const phase = useCycle(1200),
    reduced = useReducedMotion(),
    curve = TYPING[index]
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#8e8e93',
        opacity: reduced ? 0.6 : phase.interpolate({ inputRange: curve.input, outputRange: curve.opacity }),
        transform: reduced
          ? []
          : [
              {
                translateY: phase.interpolate({
                  inputRange: curve.input,
                  outputRange: curve.lift.map((v) => -0.12 * (size / 0.46) * v),
                }),
              },
            ],
      }}
    />
  )
}
/** Words growing out of the typing dots fade in while the box grows, never after it (ss-fade-in). */
function BubbleText({
  children,
  fade,
  style,
}: {
  children: ReactNode
  fade: boolean
  style: Animated.WithAnimatedValue<TextStyle>
}) {
  const reduced = useReducedMotion()
  const p = useTween(1, 280, { from: fade && !reduced ? 0 : 1, ease: EASE })
  return (
    <Animated.View
      style={{ opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [3, 0] }) }] }}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Animated.Text style={style}>{children}</Animated.Text>
      ) : (
        children
      )}
    </Animated.View>
  )
}
export function Bubble({
  from,
  typing = false,
  tail,
  source,
  tapback,
  avatar,
  me,
  meText,
  them,
  themText,
  ground,
  children,
  style,
  target,
  'data-target': alias,
  onLayout,
  ...rest
}: BubbleProps) {
  const thread = useContext(ThreadContext),
    phone = useContext(PhoneContext),
    arrived = useRef(thread.ready.current).current
  const { fidelity, tokens, theme } = useLook(),
    reduced = useReducedMotion(),
    scene = useScene(),
    id = useId(),
    { speed } = useContext(MotionContext)
  const ownName = target ?? alias ?? `bubble-${id}`
  const { app, colors } = thread
  const chat = app === 'chat',
    mine = from === 'me',
    // The chat look's reply is plain text across the column, no bubble
    plain = chat && !mine
  const fs = thread.size ?? (phone ? 17 : 15),
    lh = fs * (chat ? 1.55 : 1.3)
  const padY = plain ? 0 : chat ? 0.5 * fs : typing ? 0.84 * fs : 0.42 * fs,
    padX = plain ? 0 : chat ? 0.9 * fs : typing ? 0.8 * fs : 0.76 * fs,
    radius = plain ? 0 : (chat ? 1.2 : 1.06) * fs
  // A dark stage or a dark phone darkens the received bubbles
  const themDark = theme === 'dark' || !!phone?.dark
  const fill = plain
    ? 'transparent'
    : mine
      ? (me ?? colors.me ?? (chat ? tokens.ink[0] : app === 'sms' ? '#34c759' : '#0a84ff'))
      : (them ?? colors.them ?? (themDark ? '#26252a' : '#e9e9eb'))
  const ink = plain
    ? tokens.muted
    : mine
      ? (meText ?? colors.meText ?? (chat ? tokens.text : '#fff'))
      : (themText ?? colors.themText ?? (themDark ? '#fff' : '#000'))

  // Only arrivals rise in; a bubble with a source forms out of the composer instead
  const rise = arrived && !source
  const arrive = useTween(1, 450, { from: rise && !reduced ? 0 : 1, ease: GROW })
  const [phase, setPhase] = useState<'wait' | 'fly' | 'rest'>(arrived && source && scene && !reduced ? 'wait' : 'rest')
  const [travel, setTravel] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (phase !== 'wait' || !scene || !source) return
    let live = true
    const frame = clock.layoutRaf(() => {
      void scene.registry.measure().then(() => {
        if (!live) return
        const start = scene.registry.rect(source),
          end = scene.registry.rect(ownName),
          k = end.width / (scene.registry.rect(ownName, true).width || end.width) || 1
        if (!start.width || !end.width) return setPhase('rest')
        // The words start on the field's words: left edges together, middles level
        setTravel({
          x: (start.x - (end.x + padX * k)) / k,
          y: (start.y + start.height / 2 - (end.y + end.height / 2)) / k,
        })
        setPhase('fly')
      })
    })
    return () => {
      live = false
      clock.cancelLayoutRaf(frame)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const flying = phase === 'fly',
    held = arrived && !!source && !!scene && !reduced
  const fly = useTween(phase === 'wait' ? 0 : 1, flying ? 500 : 0, { from: held ? 0 : 1, ease: GROW })
  // In flight the words keep the field's colour and the fill is hidden; both come in as it travels
  const fillIn = useTween(phase === 'wait' ? 0 : 1, flying ? 300 : 0, {
    from: held ? 0 : 1,
    delay: flying ? 60 : 0,
    ease: EASE,
  })

  // A tail closing its run grows out once the bubble has nearly landed, and retracts into the corner otherwise
  const tailArrival = useRef(arrived && !!tail && !reduced)
  if (!tail) tailArrival.current = false
  const entering = tailArrival.current,
    tailFrom = entering ? 0 : tail ? 1 : 0,
    tailDelay = entering ? (source ? 320 : 200) : 0
  const tailGrow = useTween(tail ? 1 : 0, entering ? 320 : 300, { from: tailFrom, delay: tailDelay, ease: SCROLL })
  const tailShow = useTween(tail ? 1 : 0, entering ? 320 : 180, {
    from: tailFrom,
    delay: tailDelay,
    ease: entering ? SCROLL : EASE,
  })

  // The tapback pops in from its corner; the bubble makes room below it
  const tapped = !!tapback && tapback.show !== false
  const tapScale = useTween(tapped ? 1 : 0.5, tapped ? 450 : 160, { from: tapped ? 1 : 0.5, ease: tapped ? POP : EASE })
  const tapFade = useTween(tapped ? 1 : 0, tapped ? 100 : 140, { from: tapped ? 1 : 0, ease: EASE })
  const room = useTween(tapped ? 21 : 0, tapped ? 450 : 300, {
    from: tapped ? 21 : 0,
    delay: tapped ? 0 : 120,
    ease: GROW,
  })
  const avatarRoom = useTween(tapped ? 21 : 0, 450, { from: tapped ? 21 : 0, ease: GROW })

  // Morph: when the content changes (the dots becoming the reply), the box eases from its old size to the
  // new while the words keep their final line breaks
  const key = typing ? '\u0000typing' : typeof children === 'string' ? children : '\u0000node'
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [morph, setMorph] = useState({ key, n: 0, active: false, grew: false })
  let m = morph
  if (morph.key !== key) {
    m = {
      key,
      n: morph.n + 1,
      active: !!size && !reduced && !plain,
      grew: morph.grew || morph.key === '\u0000typing',
    }
    setMorph(m)
  }
  const box = {
    w: useTween(size?.w ?? 0, m.active ? 350 : 0, { ease: GROW }),
    h: useTween(size?.h ?? 0, m.active ? 350 : 0, { ease: GROW }),
  }
  useEffect(() => {
    if (!m.active) return
    const n = m.n,
      timer = clock.timeout(() => setMorph((old) => (old.n === n ? { ...old, active: false } : old)), 350 / speed + 32)
    return () => clock.clearTimeout(timer)
  }, [m.n, m.active, size?.w, size?.h, speed])
  const resting = (w: number, h: number) =>
    setSize((old) => (old && Math.abs(old.w - w) < 0.01 && Math.abs(old.h - h) < 0.01 ? old : { w, h }))

  const text: Animated.WithAnimatedValue<TextStyle> = {
    fontSize: fs,
    lineHeight: lh,
    letterSpacing: -0.01 * fs,
    fontFamily: tokens.fontFamily,
    color:
      source && phase !== 'rest' ? fillIn.interpolate({ inputRange: [0, 1], outputRange: [tokens.text, ink] }) : ink,
  }
  const content = typing ? (
    <View accessibilityLabel="typing" style={{ flexDirection: 'row', gap: 0.24 * fs }}>
      {[0, 1, 2].map((i) => (
        <TypingDot key={i} index={i} size={0.46 * fs} />
      ))}
    </View>
  ) : fidelity === 'minimal' && typeof children === 'string' ? (
    // A placeholder bar in a full line, set a little below its middle as vertical-align: middle sets it
    <View style={{ height: lh }}>
      <View
        style={{
          marginTop: lh / 2 - 0.11 * fs,
          width: Math.min(180, children.length * 5.5),
          height: 0.4 * fs,
          borderRadius: 0.2 * fs,
          backgroundColor: ink,
          opacity: 0.35,
        }}
      />
    </View>
  ) : (
    <BubbleText fade={m.grew} style={text}>
      {children}
    </BubbleText>
  )
  const share = plain ? 1 : 0.75
  return (
    <SceneView
      style={[
        {
          flexDirection: 'row',
          justifyContent: mine ? 'flex-end' : 'flex-start',
          alignItems: avatar && !mine ? 'flex-end' : 'flex-start',
        },
        style,
      ]}
    >
      {avatar && !mine && (
        // Sat on the bubble's bottom edge, not on the room a reaction opens under it
        <Animated.View style={{ marginRight: 8, marginBottom: avatarRoom }}>{avatar}</Animated.View>
      )}
      <SceneView
        {...rest}
        target={ownName}
        onLayout={(event) => {
          if (!m.active) resting(event.nativeEvent.layout.width, event.nativeEvent.layout.height)
          onLayout?.(event)
        }}
        style={[
          {
            maxWidth: `${share * 100}%`,
            flexShrink: 1,
            paddingVertical: padY,
            paddingHorizontal: padX,
            borderRadius: radius,
            marginBottom: room,
            opacity: phase === 'wait' ? 0 : arrive,
            transform: [
              { translateX: Animated.multiply(Animated.subtract(1, fly), travel.x) },
              {
                translateY: Animated.add(
                  Animated.multiply(Animated.subtract(1, fly), travel.y),
                  Animated.multiply(Animated.subtract(1, arrive), 6),
                ),
              },
            ],
          },
          m.active && { width: box.w, height: box.h },
        ]}
      >
        {/* The fill is its own layer, so it grows from the tail corner while the words only rise */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: radius,
            backgroundColor: fill,
            opacity: fillIn,
            transformOrigin: mine ? 'right bottom' : 'left bottom',
            transform: [{ scale: arrive.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          }}
        />
        {!chat && (
          // Always drawn, so a tail grows out of the corner when its bubble becomes the last of a run
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              width: 1.06 * fs,
              height: 0.94 * fs,
              left: mine ? undefined : -0.36 * fs,
              right: mine ? -0.36 * fs : undefined,
              opacity: tailShow,
              transformOrigin: mine ? '15% 85%' : '85% 85%',
              transform: [{ scale: tailGrow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 18 16">
              <Path
                fill={fill}
                d={
                  mine
                    ? 'M0 0H12V8.5C12 12.6 14 15 17.5 16C15 16.7 12.2 16.5 9.8 15.3L0 15Z'
                    : 'M18 0H6V8.5C6 12.6 4 15 .5 16C3 16.7 5.8 16.5 8.2 15.3L18 15Z'
                }
              />
            </Svg>
          </Animated.View>
        )}
        {/* While the box eases, the words sit at their final width and the box clips them on the sides that
            grow; the tail's corner stays open */}
        <View
          pointerEvents="box-none"
          style={
            m.active
              ? {
                  position: 'absolute',
                  top: 0,
                  bottom: -fs,
                  left: mine ? 0 : -fs,
                  right: mine ? -fs : 0,
                  overflow: 'hidden',
                }
              : { alignItems: 'flex-start' }
          }
        >
          <View
            pointerEvents="box-none"
            style={
              m.active
                ? {
                    position: 'absolute',
                    top: padY,
                    left: padX + (mine ? 0 : fs),
                    width: Math.max(1, share * thread.width - padX * 2),
                    alignItems: 'flex-start',
                  }
                : undefined
            }
          >
            <View
              onLayout={(event) => {
                if (!m.active) return
                const { width, height } = event.nativeEvent.layout
                setSize({ w: width + padX * 2, h: height + padY * 2 })
              }}
            >
              {content}
            </View>
          </View>
        </View>
        {tapback && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -17,
              right: mine ? 8 : undefined,
              left: mine ? undefined : 8,
              zIndex: 1,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: ground ?? colors.ground ?? (theme === 'dark' ? '#2c2c2e' : '#fff'),
              boxShadow:
                theme === 'dark'
                  ? '0 1px 3px rgba(0,0,0,0.4)'
                  : '0 1px 2px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: tapFade,
              transform: [{ scale: tapScale }],
            }}
          >
            <Label style={{ fontSize: 13, textAlign: 'center' }}>{tapback.emoji}</Label>
          </Animated.View>
        )}
      </SceneView>
    </SceneView>
  )
}
/** Inside a phone stamps and receipts are 14pt, readable at phone scale; outside, they scale with the thread. */
function useSmallType(share: number) {
  const thread = useContext(ThreadContext),
    phone = useContext(PhoneContext)
  const base = thread.size ?? (phone ? 17 : 15),
    fs = phone ? 14 : share * base
  return {
    fontSize: fs,
    lineHeight: fs * (thread.app === 'chat' ? 1.55 : 1.3),
    letterSpacing: -0.01 * base,
    color: '#8e8e93',
    fontWeight: '500' as const,
  }
}
export function Stamp({ children, style, ...rest }: NativeProps) {
  const type = useSmallType(0.7)
  return (
    <SceneView {...rest} style={[{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }, style]}>
      <Label style={[type, { textAlign: 'center' }]}>{children}</Label>
    </SceneView>
  )
}
// Only the part that differs changes; a wordy change snaps out to whole words (as web Roll)
function changed(a: string, b: string) {
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  if (!/^[\d.,$€£%+\-−\s]*$/.test(a.slice(head, a.length - tail) + b.slice(head, b.length - tail))) {
    const space = (c: string | undefined) => c === undefined || /\s/.test(c)
    while (head > 0 && !space(b[head - 1]) && !space(b[head])) head--
    while (tail > 0 && !space(b[b.length - tail - 1]) && !space(b[b.length - tail])) tail--
  }
  return { head, tail }
}
/** Delivered to Read: the old word lifts out as the new one rises in, overlapping, while the box eases to the
 * new width (ss-receipt-out, ss-receipt-in). Each word keeps its natural width in a wide layer pinned to the right
 * edge, as web's end-pinned roll does, so it never wraps or truncates while the box grows or shrinks leftwards. */
function ReceiptChange({ before, after, style }: { before: string; after: string; style: TextStyle }) {
  const [wb, setWb] = useState<number | null>(before ? null : 0),
    [wa, setWa] = useState<number | null>(after ? null : 0)
  const ready = wb !== null && wa !== null
  const em = style.fontSize ?? 14
  const width = useTween(ready ? 1 : 0, 450, { from: 0, ease: GROW }),
    out = useTween(ready ? 1 : 0, 300, { from: 0, ease: EASE }),
    rise = useTween(ready ? 1 : 0, 400, { from: 0, delay: 80, ease: SCROLL })
  const layer = (text: string, onWidth: (w: number) => void, motion: object, hidden?: boolean) => (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : undefined}
      style={[{ position: 'absolute', right: 0, top: 0, width: 400, alignItems: 'flex-end' }, motion]}
    >
      <RNText onLayout={(event) => onWidth(event.nativeEvent.layout.width)} style={style}>
        {text}
      </RNText>
    </Animated.View>
  )
  return (
    <Animated.View
      style={{
        height: style.lineHeight,
        overflow: 'hidden',
        width: ready ? width.interpolate({ inputRange: [0, 1], outputRange: [wb, wa] }) : undefined,
      }}
    >
      {/* Until both words are measured the old one holds the place, in flow, so nothing blinks or resizes */}
      {!ready && !!before && <RNText style={style}>{before}</RNText>}
      {!!before &&
        layer(
          before,
          setWb,
          {
            opacity: ready ? out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 0,
            transform: [{ translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, -0.5 * em] }) }],
          },
          true,
        )}
      {!!after &&
        layer(after, setWa, {
          opacity: ready ? rise : 0,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0.5 * em, 0] }) }],
        })}
    </Animated.View>
  )
}
function ReceiptText({ children, style }: { children: string; style: TextStyle }) {
  const reduced = useReducedMotion()
  const [view, setView] = useState({ text: children, old: '', head: 0, tail: 0, n: 0 })
  if (view.text !== children) {
    const { head, tail } = changed(view.text, children)
    setView({ text: children, old: view.text.slice(head, view.text.length - tail), head, tail, n: view.n + 1 })
  }
  if (reduced || view.n === 0 || view.text !== children) return <RNText style={style}>{children}</RNText>
  return (
    <View style={{ flexDirection: 'row' }}>
      {view.head > 0 && <RNText style={style}>{view.text.slice(0, view.head)}</RNText>}
      <ReceiptChange
        key={view.n}
        before={view.old}
        after={view.text.slice(view.head, view.text.length - view.tail)}
        style={style}
      />
      {view.tail > 0 && <RNText style={style}>{view.text.slice(view.text.length - view.tail)}</RNText>}
    </View>
  )
}
/**
 * The small status under your last message. `children` rolls when it changes (Delivered to Read); `show` false
 * folds it away.
 */
export function Receipt({
  show = true,
  children,
  style,
  ...rest
}: Omit<NativeProps, 'children'> & { show?: boolean; children: string }) {
  const type = useSmallType(0.66)
  const open = useTween(show ? 1 : 0, 550, { ease: SCROLL }),
    fade = useTween(show ? 1 : 0, 250, { ease: EASE })
  const [height, setHeight] = useState(0)
  return (
    <SceneView
      {...rest}
      hidden={!show}
      style={[
        { height: height ? Animated.multiply(open, height) : show ? undefined : 0, overflow: 'hidden', opacity: fade },
        style,
      ]}
    >
      <View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={{ alignItems: 'flex-end', paddingRight: 0.3 * type.fontSize }}
      >
        <ReceiptText style={type}>{children}</ReceiptText>
      </View>
    </SceneView>
  )
}
