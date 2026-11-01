import { useContext, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text as RNText, View, type StyleProp, type TextStyle } from 'react-native'
import { useLook } from '../look'
import { SceneView, Label, row, type NativeProps } from '../native'
import { useTween } from '../animate'
import { clock } from '../clock'
import { MotionContext, useReducedMotion } from '../reduced-motion'
import { bezier } from '../ease'
import { Probe } from './layout'

export interface CountProps extends Omit<NativeProps, 'style'> {
  value: number
  format?: (n: number) => string
  duration?: number
  stagger?: number
  style?: StyleProp<TextStyle>
}
function Digit({
  value,
  rising,
  duration,
  delay,
  style,
}: {
  value: number
  rising: boolean
  duration: number
  delay: number
  style: TextStyle
}) {
  const reduced = useReducedMotion(),
    { speed } = useContext(MotionContext)
  const position = useRef(new Animated.Value(10 + value)).current,
    current = useRef(10 + value),
    previous = useRef(value)
  const height = style.lineHeight ?? (style.fontSize ?? 12) * 1.2,
    [width, setWidth] = useState((style.fontSize ?? 12) * 0.65)
  useEffect(() => {
    if (previous.current === value && !reduced) return
    previous.current = value
    if (reduced || duration <= 0) {
      current.current = 10 + value
      position.setValue(current.current)
      return
    }
    // Equivalent turns have identical pixels. Normalize before retargeting an interrupted roll.
    const from = 10 + (((current.current % 10) + 10) % 10)
    const delta = rising ? (value - (from % 10) + 10) % 10 : -(((from % 10) - value + 10) % 10)
    const to = from + delta,
      start = clock.now() + delay / speed,
      curve = bezier([0.22, 1, 0.36, 1])
    current.current = from
    position.setValue(from)
    let frame = 0
    const step = (time: number) => {
      const t = Math.max(0, Math.min(1, (time - start) / (duration / speed)))
      current.current = from + (to - from) * curve(t)
      position.setValue(current.current)
      if (t < 1) frame = clock.raf(step)
      else {
        current.current = 10 + value
        position.setValue(current.current)
      }
    }
    frame = clock.raf(step)
    return () => clock.cancelRaf(frame)
  }, [value, rising, duration, delay, reduced, speed, position])
  return (
    <View accessibilityElementsHidden style={{ width, height, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', opacity: 0, width: 1000 }}>
        <RNText
          onLayout={(event) => {
            const w = event.nativeEvent.layout.width
            if (w > 0 && Math.abs(w - width) > 0.01) setWidth(w)
          }}
          style={[style, { alignSelf: 'flex-start', fontVariant: ['tabular-nums'], includeFontPadding: false }]}
        >
          0
        </RNText>
      </View>
      <Animated.View style={{ transform: [{ translateY: Animated.multiply(position, -height) }] }}>
        {Array.from({ length: 30 }, (_, i) => (
          <RNText
            key={i}
            style={[
              style,
              {
                height,
                lineHeight: height,
                textAlign: 'center',
                includeFontPadding: false,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {i % 10}
          </RNText>
        ))}
      </Animated.View>
    </View>
  )
}
export function Count({
  value,
  format = (n) => Math.round(n).toLocaleString('en-US'),
  duration = 700,
  stagger = 45,
  style,
  ...rest
}: CountProps) {
  const { tokens } = useLook(),
    prior = useRef(value),
    rising = value >= prior.current
  useEffect(() => {
    prior.current = value
  }, [value])
  const text = format(value),
    match = /^(.*\d)(\s*)([^\d\s.,]+)$/.exec(text)
  const head = match?.[1] ?? text,
    unit = match?.[3],
    spacing = !!match?.[2]
  const styles: TextStyle = {
    color: tokens.text,
    fontSize: tokens.fontSize,
    fontFamily: tokens.fontFamily,
    ...StyleSheet.flatten(style),
  }
  let column = [...head].filter((char) => /\d/.test(char)).length
  return (
    <SceneView {...rest} accessibilityLabel={text} style={[row, { alignSelf: 'flex-start' }]}>
      {[...head].map((char, i) =>
        /\d/.test(char) ? (
          <Digit
            key={`d${--column}`}
            value={Number(char)}
            rising={rising}
            duration={duration}
            delay={column * stagger}
            style={styles}
          />
        ) : (
          <RNText key={`s${i}`} style={styles}>
            {char}
          </RNText>
        ),
      )}
      {unit && <RNText style={[styles, { marginLeft: spacing ? styles.fontSize! * 0.3 : 1 }]}>{unit}</RNText>}
    </SceneView>
  )
}
export function changedText(before: string, after: string) {
  let head = 0,
    tail = 0
  while (head < before.length && head < after.length && before[head] === after[head]) head++
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  )
    tail++
  const numeric = /^[\d.,$€£%+\-−\s]*$/.test(
    before.slice(head, before.length - tail) + after.slice(head, after.length - tail),
  )
  if (!numeric) {
    const space = (char?: string) => char === undefined || /\s/.test(char)
    while (head > 0 && !space(after[head - 1]) && !space(after[head])) head--
    while (tail > 0 && !space(after[after.length - tail - 1]) && !space(after[after.length - tail])) tail--
  }
  return { head, tail, numeric }
}
function RollingUnit({
  text,
  index,
  stagger,
  style,
  outgoing,
}: {
  text: string
  index: number
  stagger: number
  style?: StyleProp<TextStyle>
  outgoing?: boolean
}) {
  const p = useTween(outgoing ? 0 : 1, 450, { from: outgoing ? 1 : 0, delay: outgoing ? 0 : 110 + index * stagger })
  return (
    <Animated.Text
      style={[
        style,
        {
          opacity: p,
          transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [outgoing ? -14 : 14, 0] }) }],
        },
      ]}
    >
      {text}
    </Animated.Text>
  )
}
function RollChange({
  before,
  after,
  numeric,
  stagger,
  variant,
  style,
}: {
  before: string
  after: string
  numeric: boolean
  stagger: number
  variant: 'roll' | 'fade'
  style: StyleProp<TextStyle>
}) {
  const [oldSize, setOldSize] = useState<{ width: number; height: number } | null>(null)
  const [newSize, setNewSize] = useState<{ width: number; height: number } | null>(null)
  const ready = oldSize !== null && newSize !== null
  const p = useTween(ready ? 1 : 0, variant === 'fade' ? 300 : 500, { from: 0 })
  const units = numeric ? [...after] : after.split(/(?<=\s)/)
  const measure = (setter: typeof setOldSize) => (size: { width: number; height: number }) =>
    setter((old) => (old?.width === size.width && old?.height === size.height ? old : size))
  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        width: ready ? p.interpolate({ inputRange: [0, 1], outputRange: [oldSize.width, newSize.width] }) : undefined,
        height: ready ? Math.max(oldSize.height, newSize.height) : undefined,
      }}
    >
      <Probe onSize={measure(setOldSize)}>
        <RNText style={style}>{before}</RNText>
      </Probe>
      <Probe onSize={measure(setNewSize)}>
        <RNText style={style}>{after}</RNText>
      </Probe>
      <Animated.Text
        accessibilityElementsHidden
        style={[
          style,
          {
            position: ready ? 'absolute' : 'relative',
            width: oldSize?.width,
            opacity: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }),
            transform:
              variant === 'roll' ? [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }] : [],
          },
        ]}
      >
        {before}
      </Animated.Text>
      {ready && (
        <Animated.View style={[row, { position: 'absolute', width: newSize.width, opacity: p }]}>
          {variant === 'fade' ? (
            <RNText style={style}>{after}</RNText>
          ) : (
            units.map((unit, i) => <RollingUnit key={i} text={unit} index={i} stagger={stagger} style={style} />)
          )}
        </Animated.View>
      )}
    </Animated.View>
  )
}
export function Roll({
  children,
  delay = 0,
  stagger = 45,
  variant = 'roll',
  align = 'start',
  style,
}: {
  children: string
  delay?: number
  stagger?: number
  variant?: 'roll' | 'fade'
  align?: 'start' | 'end'
  style?: StyleProp<TextStyle>
}) {
  const reduced = useReducedMotion(),
    { tokens } = useLook()
  const [held, setHeld] = useState(children),
    [view, setView] = useState({ text: children, before: children, serial: 0 })
  useEffect(() => {
    if (!delay || reduced) {
      setHeld(children)
      return
    }
    const id = clock.timeout(() => setHeld(children), delay)
    return () => clock.clearTimeout(id)
  }, [children, delay, reduced])
  if (held !== view.text) setView((v) => ({ text: held, before: v.text, serial: v.serial + 1 }))
  const textStyle: StyleProp<TextStyle> = [
    { fontSize: tokens.fontSize, color: tokens.text, fontFamily: tokens.fontFamily },
    style,
  ]
  if (reduced) return <RNText style={textStyle}>{children}</RNText>
  const { head, tail, numeric } = changedText(view.before, view.text),
    middle = view.text.slice(head, view.text.length - tail)
  return (
    <View style={[row, { justifyContent: align === 'end' ? 'flex-end' : 'flex-start', overflow: 'hidden' }]}>
      <RNText style={textStyle}>{view.text.slice(0, head)}</RNText>
      <RollChange
        key={view.serial}
        before={view.before.slice(head, view.before.length - tail)}
        after={middle}
        numeric={numeric}
        stagger={stagger}
        variant={variant}
        style={textStyle}
      />
      <RNText style={textStyle}>{tail ? view.text.slice(-tail) : ''}</RNText>
    </View>
  )
}

function StreamWord({
  word,
  show,
  marked,
  style,
}: {
  word: string
  show: boolean
  marked: boolean
  style?: StyleProp<TextStyle>
}) {
  const { tokens } = useLook(),
    opacity = useTween(show ? 1 : 0, 220)
  return (
    <Animated.Text
      style={[
        {
          color: tokens.text,
          fontSize: tokens.fontSize,
          opacity,
          backgroundColor: marked ? tokens.accentSoft : 'transparent',
        },
        style,
      ]}
    >
      {word}
    </Animated.Text>
  )
}
export function Stream({
  text,
  count,
  mark,
  style,
  ...rest
}: Omit<NativeProps, 'style'> & {
  text: string
  count: number
  mark?: (word: string, i: number) => boolean
  style?: StyleProp<TextStyle>
}) {
  const words = text.split(' ')
  return (
    <SceneView {...rest} accessibilityLabel={words.slice(0, count).join(' ')}>
      <RNText style={style}>
        {words.map((word, i) => (
          <StreamWord
            key={i}
            word={word + (i < words.length - 1 ? ' ' : '')}
            show={i < count}
            marked={!!mark?.(word, i)}
            style={style}
          />
        ))}
      </RNText>
    </SceneView>
  )
}
