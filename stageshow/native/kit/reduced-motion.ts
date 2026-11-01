import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

type Motion = { still: boolean; active: boolean; speed: number; instant: boolean }
const DEFAULT: Motion = { still: false, active: true, speed: 1, instant: false }
export const MotionContext = createContext<Motion>(DEFAULT)
let systemReduced = true
const listeners = new Set<() => void>()
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined
let generation = 0
function update(value: boolean) {
  if (systemReduced === value) return
  systemReduced = value
  listeners.forEach((listener) => listener())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    const current = ++generation
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (current === generation) update(value)
      },
      () => {},
    )
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      ++generation
      subscription?.remove()
      subscription = undefined
      systemReduced = true
    }
  }
}
const noopSubscribe = () => () => {}
/** Hold the poster until the asynchronous OS preference is known. One listener per mounted tree. */
export function useSystemReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => systemReduced,
    () => true,
  )
}
export function useReducedMotion() {
  const context = useContext(MotionContext)
  const system = useSyncExternalStore(
    context === DEFAULT ? subscribe : noopSubscribe,
    () => systemReduced,
    () => true,
  )
  return context.still || context.instant || !context.active || (context === DEFAULT && system)
}
