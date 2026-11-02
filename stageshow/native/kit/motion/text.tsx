import { Fragment, useContext, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text as RNText, View, type StyleProp, type TextStyle } from 'react-native'
import { useLook } from '../look'
import { SceneView, row, type NativeProps } from '../native'
import { useTween, curves } from '../animate'
import { clock } from '../clock'
import { MotionContext, useReducedMotion } from '../reduced-motion'
import { bezier } from '../ease'
import { Mask, edgeMask } from '../mask'
import { Probe } from './layout'

export interface CountProps extends Omit<NativeProps, 'style'> {
  value: number
  format?: (n: number) => string
  duration?: number
  stagger?: number
  style?: StyleProp<TextStyle>
}
const rolling = bezier([0.3, 0.75, 0.1, 1])
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
  // A window one em tall over cells one em apart. As with CSS line-height 1, each figure's natural
  // line is centred on its cell and bleeds evenly past it. The cells are fixed boxes, so the pitch never
  // depends on a measured (and on the web, rounded) line height
  const height = style.fontSize ?? 12,
    [glyph, setGlyph] = useState({ width: height * 0.65, height: height * 1.2 }),
    width = glyph.width
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
      start = clock.now() + delay / speed
    current.current = from
    position.setValue(from)
    let frame = 0
    const step = (time: number) => {
      const t = Math.max(0, Math.min(1, (time - start) / (duration / speed)))
      current.current = from + (to - from) * rolling(t)
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
    <View accessibilityElementsHidden style={{ width, height }}>
      <View pointerEvents="none" style={{ position: 'absolute', opacity: 0, width: 1000 }}>
        <RNText
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout
            if (w > 0 && (Math.abs(w - glyph.width) > 0.01 || Math.abs(h - glyph.height) > 0.01))
              setGlyph({ width: w, height: h })
          }}
          style={[
            style,
            {
              alignSelf: 'flex-start',
              lineHeight: undefined,
              fontVariant: ['tabular-nums'],
              includeFontPadding: false,
            },
          ]}
        >
          0
        </RNText>
      </View>
      {/* The window's edges soften a touch, so a figure passing them is never sliced */}
      <Mask
        xml={edgeMask(Math.max(1, width), Math.max(1, height), height * 0.08, false)}
        style={{ width, height, overflow: 'hidden' }}
      >
        <Animated.View style={{ transform: [{ translateY: Animated.multiply(position, -height) }] }}>
          {Array.from({ length: 30 }, (_, i) => (
            <View key={i} style={{ height, justifyContent: 'center', alignItems: 'flex-start' }}>
              <RNText
                style={[
                  style,
                  {
                    // Set on the cell's left like type; centered, a leading 1 drifts off the column
                    textAlign: 'left',
                    includeFontPadding: false,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {i % 10}
              </RNText>
            </View>
          ))}
        </Animated.View>
      </Mask>
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
    <SceneView
      {...rest}
      accessibilityLabel={text}
      style={{ flexDirection: 'row', alignItems: 'baseline', alignSelf: 'flex-start' }}
    >
      {[...head].map((char, i) => {
        if (!/\d/.test(char))
          return (
            <RNText key={`s${i}`} style={styles}>
              {char}
            </RNText>
          )
        // Columns count from the right, so the last digit starts first. Taken before the JSX:
        // the props are built before the key, so a decrement in the key would lag the delay
        const at = --column
        return (
          <Digit
            key={`d${at}`}
            value={Number(char)}
            rising={rising}
            duration={duration}
            delay={at * stagger}
            style={styles}
          />
        )
      })}
      {/* A hair from the last digit, or a word space when the format writes one */}
      {unit && <RNText style={[styles, { marginLeft: styles.fontSize! * (spacing ? 0.28 : 0.08) }]}>{unit}</RNText>}
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
const rise = [0.22, 1, 0.36, 1] as const,
  sink = [0.55, 0, 1, 0.45] as const
/** Sideways room for a changing part's layers, which lay out at their own width. */
const SPILL = 1000
function RollingUnit({
  text,
  index,
  stagger,
  height,
  fade,
  style,
}: {
  text: string
  index: number
  stagger: number
  height: number
  fade: boolean
  style?: StyleProp<TextStyle>
}) {
  // Each unit rises a full line, one after another; a control's label lifts 3pt in place (Roll.css)
  const p = useTween(1, fade ? 350 : 550, { from: 0, delay: fade ? 120 : 110 + index * stagger, ease: rise })
  return (
    <Animated.Text
      style={[
        style,
        {
          opacity: p,
          transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [fade ? 3 : height, 0] }) }],
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
  align,
  style,
}: {
  before: string
  after: string
  numeric: boolean
  stagger: number
  variant: 'roll' | 'fade'
  align: 'start' | 'end'
  style: StyleProp<TextStyle>
}) {
  const [oldSize, setOldSize] = useState<{ width: number; height: number } | null>(null)
  const [newSize, setNewSize] = useState<{ width: number; height: number } | null>(null)
  const ready = oldSize !== null && newSize !== null,
    fade = variant === 'fade'
  // The old text leaves a full line up (a control's label lifts 3pt), mostly gone before the new rises
  const out = useTween(ready ? 1 : 0, fade ? 160 : 280, { from: 0, ease: sink })
  // Rolling, the box opens to the wider text at once and narrows only once the new has risen
  const narrowing = !fade && ready && newSize.width < oldSize.width
  const grow = useTween(ready ? 1 : 0, fade ? 400 : 500, { from: 0, delay: narrowing ? 360 : 0, ease: rise })
  const units = numeric ? [...after] : after.split(/(?<=\s)/)
  const measure = (setter: typeof setOldSize) => (size: { width: number; height: number }) =>
    setter((old) => (old?.width === size.width && old?.height === size.height ? old : size))
  const side = align === 'end' ? { right: fade ? 0 : SPILL } : { left: fade ? 0 : SPILL }
  return (
    <Animated.View
      style={{
        // A roll clips only its vertical travel; a label's crossfade clips both ways
        overflow: fade ? 'hidden' : 'visible',
        width: ready
          ? grow.interpolate({ inputRange: [0, 1], outputRange: [oldSize.width, newSize.width] })
          : undefined,
        height: ready ? Math.max(oldSize.height, newSize.height) : undefined,
      }}
    >
      <Probe exact onSize={measure(setOldSize)}>
        <RNText style={style}>{before}</RNText>
      </Probe>
      <Probe exact onSize={measure(setNewSize)}>
        <RNText style={style}>{after}</RNText>
      </Probe>
      {!ready ? (
        <RNText accessibilityElementsHidden style={style}>
          {before}
        </RNText>
      ) : (
        // Layers lay out at their own width, wider than the box, and pin to its start or end
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: fade && align !== 'end' ? 0 : -SPILL,
            right: fade && align === 'end' ? 0 : -SPILL,
            overflow: 'hidden',
          }}
        >
          <Animated.Text
            accessibilityElementsHidden
            style={[
              style,
              {
                position: 'absolute',
                top: 0,
                ...side,
                opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  {
                    translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, fade ? -3 : -oldSize.height] }),
                  },
                ],
              },
            ]}
          >
            {before}
          </Animated.Text>
          <View style={[row, { position: 'absolute', top: 0, ...side }]}>
            {fade ? (
              <RollingUnit text={after} index={0} stagger={stagger} height={newSize.height} fade style={style} />
            ) : (
              units.map((unit, i) => (
                <RollingUnit
                  key={i}
                  text={unit}
                  index={i}
                  stagger={stagger}
                  height={newSize.height}
                  fade={false}
                  style={style}
                />
              ))
            )}
          </View>
        </View>
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
    <View style={[row, { justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }]}>
      <RNText style={textStyle}>{view.text.slice(0, head)}</RNText>
      <RollChange
        key={view.serial}
        before={view.before.slice(head, view.before.length - tail)}
        after={middle}
        numeric={numeric}
        stagger={stagger}
        variant={variant}
        align={align}
        style={textStyle}
      />
      <RNText style={textStyle}>{tail ? view.text.slice(-tail) : ''}</RNText>
    </View>
  )
}

/** The same color, fully clear, so a fade from nothing doesn't pass through gray. */
function clear(color: string) {
  const rgb = /^rgba?\(([^)]*)\)$/i.exec(color.trim())?.[1].split(/[\s,/]+/)
  if (rgb && rgb.length >= 3) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim())?.[1]
  if (!hex) return 'transparent'
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return `rgba(${[0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(',')},0)`
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
    opacity = useTween(show ? 1 : 0, 350, { ease: curves.ease }),
    mark = useTween(marked ? 1 : 0, 300, { ease: curves.ease })
  return (
    <Animated.Text
      style={[
        {
          color: tokens.text,
          fontSize: tokens.fontSize,
          opacity,
          backgroundColor: mark.interpolate({
            inputRange: [0, 1],
            outputRange: [clear(tokens.successSoft), tokens.successSoft],
          }),
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
  const words = text.split(' '),
    marked = words.map((word, i) => !!mark?.(word, i))
  return (
    <SceneView {...rest} accessibilityLabel={words.slice(0, count).join(' ')}>
      <RNText style={style}>
        {words.map((word, i) => {
          // Marked neighbours join into one run; a run's last word keeps its space outside the mark
          const join = marked[i] && marked[i + 1]
          return (
            <Fragment key={i}>
              <StreamWord word={word + (join ? ' ' : '')} show={i < count} marked={marked[i]} style={style} />
              {!join && i < words.length - 1 ? ' ' : ''}
            </Fragment>
          )
        })}
      </RNText>
    </SceneView>
  )
}
