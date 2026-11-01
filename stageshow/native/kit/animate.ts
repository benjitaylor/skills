import { useContext, useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { clock } from './clock'
import { bezier, type EaseName, type Bezier } from './ease'
import { MotionContext, useReducedMotion } from './reduced-motion'

export function useTween(
  to: number,
  duration = 350,
  options: { delay?: number; from?: number; ease?: EaseName | Bezier } = {},
) {
  const value = useRef(new Animated.Value(options.from ?? to)).current
  const current = useRef(options.from ?? to)
  const reduced = useReducedMotion()
  const { speed } = useContext(MotionContext)
  const easeKey = JSON.stringify(options.ease ?? [0.25, 0.8, 0.25, 1])
  useEffect(() => {
    if (reduced || duration <= 0) {
      current.current = to
      value.setValue(to)
      return
    }
    const from = current.current
    if (from === to) return
    const ease = bezier(JSON.parse(easeKey) as Bezier | EaseName)
    const start = clock.now() + (options.delay ?? 0) / speed
    let frame = 0
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / (duration / speed)))
      current.current = from + (to - from) * ease(t)
      value.setValue(current.current)
      if (t < 1) frame = clock.raf(step)
    }
    frame = clock.raf(step)
    return () => clock.cancelRaf(frame)
  }, [to, duration, options.delay, easeKey, reduced, speed, value])
  return value
}
export function useNumber(value: Animated.Value) {
  const [number, setNumber] = useState(() => (value as unknown as { __getValue(): number }).__getValue())
  useEffect(() => {
    setNumber((value as unknown as { __getValue(): number }).__getValue())
    const id = value.addListener(({ value: v }) => setNumber(v))
    return () => value.removeListener(id)
  }, [value])
  return number
}
export function useCycle(duration = 1000, enabled = true) {
  const value = useRef(new Animated.Value(0)).current
  const reduced = useReducedMotion()
  const { speed } = useContext(MotionContext)
  useEffect(() => {
    if (reduced || !enabled) {
      value.setValue(0)
      return
    }
    const start = clock.now()
    let frame = 0
    const step = (now: number) => {
      value.setValue((((now - start) * speed) % duration) / duration)
      frame = clock.raf(step)
    }
    frame = clock.raf(step)
    return () => clock.cancelRaf(frame)
  }, [duration, enabled, reduced, speed, value])
  return value
}
