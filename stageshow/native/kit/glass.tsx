import { createContext, useContext, type RefObject } from 'react'
import type { View } from 'react-native'
import { BlurView, type BlurViewProps } from 'expo-blur'

export const BlurBackground = createContext<RefObject<View | null> | undefined>(undefined)
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
