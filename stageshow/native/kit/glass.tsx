import { createContext, useContext, type RefObject } from 'react'
import type { View } from 'react-native'
import { BlurView, type BlurViewProps } from 'expo-blur'

export const BlurBackground = createContext<RefObject<View | null> | undefined>(undefined)
/** expo-blur's intensity for a CSS blur radius in px. Its web build draws blur(intensity × 0.2px), so this is
 * exact there; iOS and Android blur on their own material scale, so it is an approximation on device. */
export const blurIntensity = (radius: number) => Math.min(100, radius * 5)
/** Target only the background, never a view containing this blur surface itself. */
export function Glass(props: BlurViewProps) {
  const target = useContext(BlurBackground)
  return (
    <BlurView
      blurTarget={target}
      blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
      pointerEvents="none"
      {...props}
    />
  )
}
