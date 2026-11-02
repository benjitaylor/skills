import { useContext, useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { clock } from './clock'
import { bezier, type EaseName, type Bezier } from './ease'
import { MotionContext, useEntranceReduced, useReducedMotion } from './reduced-motion'

/** CSS's keyword curves, for porting the web kit's transitions as written. */
export const curves = {
  ease: [0.25, 0.1, 0.25, 1],
  easeOut: [0, 0, 0.58, 1],
  easeIn: [0.42, 0, 1, 1],
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, Bezier>

/**
 * Tweens to `to` on the kit clock. As in CSS, a zero duration with a delay
 * (`transition: x 0s 0.15s`) holds the old value and jumps at the delay.
 */
export function useTween(
  to: number,
  duration = 350,
  options: { delay?: number; from?: number; ease?: EaseName | Bezier } = {},
) {
  const value = useRef(new Animated.Value(options.from ?? to)).current
  const current = useRef(options.from ?? to)
  // A `from` that differs from the first target is an entrance: it plays through settling, as on web.
  const entrance = useRef(options.from !== undefined && options.from !== to)
  const running = useRef<{ from: number; to: number; start: number } | null>(null)
  const reduced = useReducedMotion(),
    entranceReduced = useEntranceReduced()
  const { speed } = useContext(MotionContext)
  const easeKey = JSON.stringify(options.ease ?? [0.25, 0.8, 0.25, 1])
  const delay = options.delay ?? 0
  useEffect(() => {
    const mounting = entrance.current
    if ((mounting ? entranceReduced : reduced) || (duration <= 0 && delay <= 0)) {
      entrance.current = false
      running.current = null
      current.current = to
      value.setValue(to)
      return
    }
    // Motion settings changed mid-tween with the same target: carry on, rather than restart from where it is.
    const resume = running.current?.to === to ? running.current : null
    if (!resume && current.current === to) return
    entrance.current = mounting && !!resume
    const run = resume ?? { from: current.current, to, start: clock.now() + delay / speed }
    running.current = run
    const ease = bezier(JSON.parse(easeKey) as Bezier | EaseName)
    let frame = 0
    const step = (now: number) => {
      const t =
        duration > 0
          ? Math.max(0, Math.min(1, (now - run.start) / (duration / speed)))
          : now >= run.start - 1e-6
            ? 1
            : 0
      current.current = t >= 1 ? to : run.from + (to - run.from) * ease(t)
      value.setValue(current.current)
      if (t < 1) frame = clock.raf(step)
      else {
        running.current = null
        entrance.current = false
      }
    }
    frame = clock.raf(step)
    return () => clock.cancelRaf(frame)
  }, [to, duration, delay, easeKey, reduced, entranceReduced, speed, value])
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
