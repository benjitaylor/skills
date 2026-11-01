import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
export { edgeMask } from './edge-mask'

/** The masked-view package's web shim drops children; use the same SVG as a CSS mask. */
export function Mask({
  xml,
  children,
  style,
}: {
  xml: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
  animated?: boolean
}) {
  const image = `url("data:image/svg+xml,${encodeURIComponent(xml)}")`
  return (
    <View
      style={[
        style,
        { maskImage: image, maskSize: '100% 100%', WebkitMaskImage: image, WebkitMaskSize: '100% 100%' } as ViewStyle,
      ]}
    >
      {children}
    </View>
  )
}
