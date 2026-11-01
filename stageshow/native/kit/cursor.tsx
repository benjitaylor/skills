import { Animated, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import {
  MacPointer,
  MacIbeam,
  MacCrosshair,
  MacPointingHand,
  MacOpenHand,
  MacGrab,
  MacWait,
  MacResizeNS,
  MacResizeEW,
  MacResizeNWSE,
  MacResizeNESW,
} from './cursors'
import { useTween, useCycle } from './animate'
import type { CursorKind, CursorStyle, Keys, KeysAt } from './cursor-types'
import { Label, row } from './native'

export type { CursorKind, CursorStyle } from './cursor-types'
const glyphs = {
  pointer: MacPointer,
  ibeam: MacIbeam,
  crosshair: MacCrosshair,
  hand: MacPointingHand,
  open: MacOpenHand,
  grab: MacGrab,
  wait: MacWait,
  'resize-ns': MacResizeNS,
  'resize-ew': MacResizeEW,
  'resize-nwse': MacResizeNWSE,
  'resize-nesw': MacResizeNESW,
}
const hotspot: Record<CursorKind, [number, number]> = {
  pointer: [7.5, 5.25],
  ibeam: [5, 8],
  crosshair: [8.5, 8.5],
  hand: [9.75, 3.25],
  open: [11.7, 10.4],
  grab: [12, 12],
  wait: [8, 8],
  'resize-ns': [10.5, 10.5],
  'resize-ew': [10.5, 10.5],
  'resize-nwse': [10.5, 10.5],
  'resize-nesw': [10.5, 10.5],
}
export function Cursor({
  position,
  kind,
  style = 'real',
  pressed,
  touching,
  visible = true,
}: {
  position: Animated.ValueXY
  kind: CursorKind
  style?: CursorStyle
  pressed: boolean
  touching: boolean
  visible?: boolean
}) {
  const shown = useTween(visible && (style !== 'touch' || touching) ? 1 : 0, 180)
  const scale = useTween(pressed ? 0.86 : 1, 100)
  const turn = useCycle(900, kind === 'wait')
  const chosen = style === 'arrow' && kind !== 'ibeam' ? 'pointer' : kind
  const Glyph = glyphs[chosen]
  const [x, y] = style === 'arrow' && chosen === 'pointer' ? [4, 3] : hotspot[chosen]
  const disc = style === 'touch' || style === 'circle'
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 10000,
        opacity: shown,
        transform: position.getTranslateTransform(),
      }}
    >
      <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, style === 'large' ? 1.5 : 1) }] }}>
        {disc ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              marginLeft: -14,
              marginTop: -14,
              backgroundColor: 'rgba(70,75,85,.28)',
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,.8)',
            }}
          />
        ) : (
          <Animated.View
            style={{
              marginLeft: -x,
              marginTop: -y,
              transform:
                kind === 'wait'
                  ? [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }]
                  : [],
            }}
          >
            {style === 'arrow' && chosen === 'pointer' ? (
              <Svg width={22} height={22} viewBox="0 0 22 22">
                <Path
                  d="M4 3 18.5 9.6 11.8 11.8 9.6 18.5Z"
                  fill="#202024"
                  stroke="#fff"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                />
              </Svg>
            ) : (
              <Glyph />
            )}
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  )
}
export function Ripple({ x, y }: { x: number; y: number }) {
  const p = useTween(1, 480, { from: 0 })
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 16,
        top: y - 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#888',
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
      }}
    />
  )
}
function KeyRow({ value, at }: { value: Keys; at: KeysAt }) {
  const opacity = useTween(value.show ? 1 : 0, 200),
    press = useTween(value.down ? 0.92 : 1, 100)
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        row,
        {
          position: 'absolute',
          top: at === 'top' ? 16 : undefined,
          bottom: at === 'top' ? undefined : 16,
          left: at === 'bottom-left' ? 16 : undefined,
          right: at === 'bottom-right' ? 16 : undefined,
          alignSelf: 'center',
          gap: 5,
          opacity,
          zIndex: 1000,
        },
      ]}
    >
      {value.caps.map((key, i) => (
        <Animated.View
          key={i}
          style={{
            paddingHorizontal: 10,
            height: 30,
            minWidth: 30,
            borderWidth: 1,
            borderColor: '#d6d6d8',
            backgroundColor: '#fff',
            borderRadius: 6,
            justifyContent: 'center',
            alignItems: 'center',
            transform: [{ scale: press }],
          }}
        >
          <Label style={{ color: '#333', fontSize: 15 }}>{key}</Label>
        </Animated.View>
      ))}
    </Animated.View>
  )
}
export function Keycaps({ values, at }: { values: Keys[]; at: KeysAt }) {
  return (
    <>
      {values.map((value) => (
        <KeyRow key={value.id} value={value} at={at} />
      ))}
    </>
  )
}
