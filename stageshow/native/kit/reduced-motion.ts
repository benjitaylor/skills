import { createContext, useContext, useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

type Motion = { still: boolean; active: boolean; speed: number; instant: boolean }
const DEFAULT: Motion = { still: false, active: true, speed: 1, instant: false }
export const MotionContext = createContext<Motion>(DEFAULT)
/** The OS preference: the last value read, and whether it has been read since the stages subscribed. */
export type MotionPreference = { readonly reduced: boolean; readonly known: boolean }
// Reduced until the first answer. After that the last answer stands while the next mount
// asks again, so a new stage does not flash its poster before playing.
let preference: MotionPreference = { reduced: true, known: false }
const UNKNOWN: MotionPreference = { reduced: true, known: false }
const listeners = new Set<() => void>()
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined
let generation = 0
function set(next: MotionPreference) {
  if (next.reduced === preference.reduced && next.known === preference.known) return
  preference = next
  listeners.forEach((listener) => listener())
}
const update = (reduced: boolean) => set({ reduced, known: true })
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    const current = ++generation
    // It may have changed while nothing listened: hold off starting scripts until it is read.
    set({ reduced: preference.reduced, known: false })
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (current === generation) update(value)
      },
      () => {
        if (current === generation) set({ reduced: preference.reduced, known: true })
      },
    )
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      ++generation
      subscription?.remove()
      subscription = undefined
    }
  }
}
const noopSubscribe = () => () => {}
/** The OS preference and whether it has been read yet. One listener per mounted tree. */
export function useMotionPreference() {
  return useSyncExternalStore(
    subscribe,
    () => preference,
    () => UNKNOWN,
  )
}
/** Whether the OS asks for reduced motion (the last known answer; reduced before the first). */
export function useSystemReducedMotion() {
  return useMotionPreference().reduced
}
/**
 * Whether an entrance (a part's mount animation) is stopped. Only a still or the OS preference stops one:
 * as on web, where settling (`data-placing`) turns transitions off but entrance animations still play, and an
 * idle stage pauses them rather than skipping them.
 */
export function useEntranceReduced() {
  const context = useContext(MotionContext)
  const system = useSyncExternalStore(
    context === DEFAULT ? subscribe : noopSubscribe,
    () => preference.reduced,
    () => true,
  )
  return context.still || (context === DEFAULT && system)
}
export function useReducedMotion() {
  const context = useContext(MotionContext)
  const system = useSyncExternalStore(
    context === DEFAULT ? subscribe : noopSubscribe,
    () => preference.reduced,
    () => true,
  )
  return context.still || context.instant || !context.active || (context === DEFAULT && system)
}
