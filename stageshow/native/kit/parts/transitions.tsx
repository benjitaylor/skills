// The web kit's state transitions, ported: hover read from the cursor's
// registry (the web's data-hover), colours that ease rather than snap, and
// layers that stay mounted until they have faded. Everything runs on the kit
// clock, so a virtual clock steps it like any other tween.
import { useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, type StyleProp, type TextStyle } from 'react-native'
import { useLook } from '../look'
import { SuppressTargets, useInteraction, type NativeProps } from '../native'
import { curves, useTween } from '../animate'
import { clock } from '../clock'
import { MotionContext, useReducedMotion } from '../reduced-motion'
import type { Bezier } from '../ease'
import { clear, mixColor, parseColor } from './paint'
import { InkContext } from './Icon'

export type Color = string | Animated.AnimatedInterpolation<string>

/**
 * The name SceneView registers for these props, worked out by the part so it
 * can read its own hover. Pass it back as `target`; a cursor-only target gets
 * the same kind of generated name SceneView would give it.
 */
export function useTargetName({ target, 'data-target': alias, cursor, 'data-cursor': cursorAlias }: NativeProps) {
  const auto = useId()
  return target ?? alias ?? ((cursor ?? cursorAlias) ? `cursor-${auto}` : undefined)
}

/** Whether the cursor is over a named target: the web kit's `[data-hover]`. */
export function useHover(name?: string) {
  const suppressed = useContext(SuppressTargets)
  return useInteraction(suppressed ? undefined : name)?.hover ?? false
}

/** True while `on`, and for `ms` after it turns off: keeps a fading layer mounted, and turning, until it is gone. */
export function useLinger(on: boolean, ms: number) {
  const [held, setHeld] = useState(on)
  const { speed } = useContext(MotionContext),
    reduced = useReducedMotion()
  useEffect(() => {
    if (on || reduced) {
      setHeld(on)
      return
    }
    const id = clock.timeout(() => setHeld(false), ms / speed)
    return () => clock.clearTimeout(id)
  }, [on, ms, speed, reduced])
  return on || held
}

const STOPS = 8
const read = (value: Animated.Value) => (value as unknown as { __getValue(): number }).__getValue()

/**
 * A colour that eases to each new value as `transition: color` does: from
 * wherever it is now, mixed premultiplied, on the kit clock. Until the first
 * change it is the plain string.
 */
export function useColor(color: string, duration: number, ease: Bezier = curves.ease): Color {
  const s = useRef({ n: 0, start: 0, from: color, to: color, value: null as Animated.Value | null }).current
  if (color !== s.to) {
    const at = s.value ? read(s.value) : s.n
    s.from = s.start === s.n ? s.to : mixColor(s.from, s.to, Math.min(1, (at - s.start) / (s.n - s.start)))
    s.start = at
    s.n += 1
    s.to = color
  }
  const value = useTween(s.n, duration, { ease })
  s.value = value
  const { n, start, from, to } = s
  return useMemo(() => {
    if (start === n || from === to) return to
    // Unknown formats are left to React Native's own (straight) interpolation.
    if (!parseColor(from) || !parseColor(to))
      return value.interpolate({ inputRange: [start, n], outputRange: [from, to], extrapolate: 'clamp' })
    const steps = Array.from({ length: STOPS + 1 }, (_, i) => i / STOPS)
    return value.interpolate({
      inputRange: steps.map((t) => start + (n - start) * t),
      outputRange: steps.map((t) => mixColor(from, to, t)),
      extrapolate: 'clamp',
    })
  }, [value, n, start, from, to])
}

/** 0 to 1 as `on` turns on and off: a fill or a fade at the web's pace, CSS `ease` unless given. */
export function useFade(
  on: boolean,
  enter: number,
  exit = enter,
  options: { delay?: number; exitDelay?: number; ease?: Bezier } = {},
) {
  return useTween(on ? 1 : 0, on ? enter : exit, {
    delay: on ? options.delay : options.exitDelay,
    ease: options.ease ?? curves.ease,
  })
}

/**
 * A background that fades in and out as `on` turns: CSS's transition from
 * transparent, which keeps the colour's hue rather than fading through black.
 */
export function useFill(
  on: boolean,
  color: string,
  enter: number,
  exit = enter,
  options: { delay?: number; exitDelay?: number; ease?: Bezier } = {},
): Color {
  const p = useFade(on, enter, exit, options)
  return useMemo(() => p.interpolate({ inputRange: [0, 1], outputRange: [clear(color), color] }), [p, color])
}

/**
 * Label text in a colour that may be animated. Native text inherits no
 * colour, so non-text children (an icon) take `ink` through InkContext instead.
 */
export function InkLabel({
  children,
  color,
  ink,
  lines,
  style,
}: {
  children?: ReactNode
  color: Color
  ink: string
  lines?: number
  style?: StyleProp<TextStyle>
}) {
  const { tokens } = useLook()
  return (
    <InkContext.Provider value={ink}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Animated.Text
          numberOfLines={lines}
          style={[
            { fontSize: tokens.fontSize, fontFamily: tokens.fontFamily, includeFontPadding: false, color },
            style,
          ]}
        >
          {children}
        </Animated.Text>
      ) : (
        children
      )}
    </InkContext.Provider>
  )
}
