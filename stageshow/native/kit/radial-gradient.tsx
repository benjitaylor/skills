import { Platform } from 'react-native'
import { RadialGradient as SVGGradient, type RadialGradientProps } from 'react-native-svg'

/** react-native-svg uses rx/ry natively; SVG in a browser uses r plus a transform. */
export function RadialGradient({ rx, ry, cx = '50%', cy = '50%', ...props }: RadialGradientProps) {
  if (Platform.OS !== 'web' || !rx || !ry || props.gradientUnits === 'userSpaceOnUse')
    return <SVGGradient {...props} cx={cx} cy={cy} rx={rx} ry={ry} />
  const fraction = (value: string | number) =>
    typeof value === 'string' && value.endsWith('%') ? parseFloat(value) / 100 : Number(value)
  const x = fraction(cx),
    y = fraction(cy),
    ratio = fraction(ry) / fraction(rx)
  return (
    <SVGGradient
      {...props}
      cx={cx}
      cy={cy}
      r={rx}
      gradientTransform={`translate(${x} ${y}) scale(1 ${ratio}) translate(${-x} ${-y})`}
    />
  )
}
