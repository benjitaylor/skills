import type { ReactNode } from 'react'
import MaskedView from '@react-native-masked-view/masked-view'
import { SvgXml } from 'react-native-svg'
import type { StyleProp, ViewStyle } from 'react-native'

/** SVG alpha masks are shared with the web preview; Android needs software rendering for animated masks. */
export function Mask({
  xml,
  children,
  style,
  animated = false,
}: {
  xml: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
  animated?: boolean
}) {
  return (
    <MaskedView
      style={style}
      androidRenderingMode={animated ? 'software' : 'hardware'}
      maskElement={<SvgXml xml={xml} width="100%" height="100%" />}
    >
      {children}
    </MaskedView>
  )
}
export { edgeMask } from './edge-mask'
