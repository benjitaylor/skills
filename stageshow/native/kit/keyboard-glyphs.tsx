import Svg, { Path, Circle, Ellipse, Rect } from 'react-native-svg'
export function KeyboardGlyph({
  name,
  dark = false,
}: {
  dark?: boolean
  name: 'shift' | 'shift-on' | 'delete' | 'return' | 'emoji' | 'mic'
}) {
  const color = dark ? '#fff' : '#121317',
    sheet = dark ? '#303238' : '#dce0e7'
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.6,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
  switch (name) {
    case 'shift':
    case 'shift-on':
      return (
        <Svg viewBox="0 0 24 24" width="22" height="22">
          <Path d="M12 3.6 3.4 12.4H8v7.4h8v-7.4h4.6Z" {...common} fill={name === 'shift-on' ? color : 'none'} />
        </Svg>
      )
    case 'delete':
      return (
        <Svg viewBox="0 0 26 24" width="24" height="22">
          <Path d="M8.6 4.5h13.2a2.2 2.2 0 0 1 2.2 2.2v10.6a2.2 2.2 0 0 1-2.2 2.2H8.6L2 12Z" {...common} />
          <Path d="m11.4 8.6 6.8 6.8m0-6.8-6.8 6.8" {...common} />
        </Svg>
      )
    case 'return':
      return (
        <Svg viewBox="0 0 24 24" width="24" height="24">
          <Path d="M19.5 5.5v6.2a2.3 2.3 0 0 1-2.3 2.3H5" {...common} />
          <Path d="m9.2 9.6-4.4 4.4 4.4 4.4" {...common} />
        </Svg>
      )
    case 'emoji':
      return (
        <Svg viewBox="0 0 28 28" width="28" height="28">
          <Circle cx="14" cy="14" r="12.5" fill={color} />
          <Ellipse cx="10" cy="10.6" rx="1.5" ry="2.1" fill={sheet} />
          <Ellipse cx="18" cy="10.6" rx="1.5" ry="2.1" fill={sheet} />
          <Path d="M7.4 15.2c.9 3.6 3.6 5.8 6.6 5.8s5.7-2.2 6.6-5.8Z" fill={sheet} />
        </Svg>
      )
    case 'mic':
      return (
        <Svg viewBox="0 0 24 28" width="22" height="26">
          <Rect x="7.6" y="2" width="8.8" height="15" rx="4.4" fill={color} />
          <Path d="M4.2 12.8a7.8 7.8 0 0 0 15.6 0M12 20.6V26M8 26h8" {...common} strokeWidth={1.9} />
        </Svg>
      )
  }
}

/**
 * The iOS keyboard. Put it at the bottom of a Phone's screen, under the
 * composer; pass `typed` and it pops each key as the text grows.
 */
