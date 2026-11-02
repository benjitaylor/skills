import { KeyboardGlyph } from './keyboard-glyphs'
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Text as RNText, View } from 'react-native'
import { SceneView, type NativeProps } from './native'
import { alpha } from './look'
import { clock } from './clock'
import { useTween } from './animate'
import { useReducedMotion } from './reduced-motion'
import { PhoneContext } from './phone'
import type { Bezier } from './ease'

// The iOS 27 keyboard, at true points inside a Phone. Measured from iOS 27
// screenshots: ten keys and nine 6pt gaps fill every row, 42.5 tall on a 53.5
// pitch, special keys the letters' colour, a 123 / space / return bottom row.

/** The keyboard's colours (web `--ss-kb-*`): the sheet, a key, a special key held down, the keys' ink and the
 * faint ink below them. */
export interface KeyboardColors {
  sheet?: string
  key?: string
  down?: string
  ink?: string
  faint?: string
}
const LIGHT: Required<KeyboardColors> = {
  sheet: '#e3e4e9',
  key: '#fff',
  down: '#c4c6cd',
  ink: '#000',
  faint: '#3c3c43',
}
const DARK: Required<KeyboardColors> = {
  sheet: '#2a2a2c',
  key: '#4a4a4c',
  down: '#6b6b6e',
  ink: '#fff',
  faint: '#ebebf5',
}
const EASE: Bezier = [0.25, 0.1, 0.25, 1]
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export interface KeyboardProps extends NativeProps {
  typed?: string
  shift?: boolean
  suggestions?: [string, string, string]
  pressed?: string | null
  dark?: boolean
  colors?: KeyboardColors
}
type Anchor = 'centre' | 'left' | 'right'
/** The magnified letter that rises out of a pressed key, joined to it by a stem over the balloon's shadow. */
function Callout({
  k,
  label,
  anchor,
  colors,
}: {
  k: number
  label: string
  anchor: Anchor
  colors: Required<KeyboardColors>
}) {
  const balloon = k * 1.45,
    stem = balloon * 0.69
  const place = (w: number) =>
    anchor === 'left' ? { left: 0 } : anchor === 'right' ? { right: 0 } : { left: (k - w) / 2 }
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 30,
        ...place(balloon),
        width: balloon,
        height: 54,
        paddingBottom: 6,
        borderRadius: 12,
        backgroundColor: colors.key,
        boxShadow: '0 1px 6px rgba(0,0,0,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RNText style={{ color: colors.ink, fontSize: 34, lineHeight: 34 }}>{label}</RNText>
      <View
        style={{
          position: 'absolute',
          top: 50,
          ...(anchor === 'left' ? { left: 0 } : anchor === 'right' ? { right: 0 } : { left: (balloon - stem) / 2 }),
          width: stem,
          height: 14,
          backgroundColor: colors.key,
        }}
      />
    </View>
  )
}
function Key({
  width,
  flex,
  down = false,
  special = false,
  pop,
  anchor = 'centre',
  colors,
  children,
  style,
}: {
  width?: number
  flex?: number
  down?: boolean
  special?: boolean
  pop?: string
  anchor?: Anchor
  colors: Required<KeyboardColors>
  children?: ReactNode
  style?: object
}) {
  // A special key darkens at once and returns over 0.12s; letters show their callout instead
  const held = special && down
  const press = useTween(held ? 1 : 0, held ? 0 : 120, { ease: EASE })
  return (
    <Animated.View
      style={[
        {
          width,
          flex,
          borderRadius: 8.5,
          backgroundColor: special
            ? press.interpolate({ inputRange: [0, 1], outputRange: [colors.key, colors.down] })
            : colors.key,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: pop ? 2 : 0,
        },
        style,
      ]}
    >
      {children}
      {pop && <Callout k={width ?? 0} label={pop} anchor={anchor} colors={colors} />}
    </Animated.View>
  )
}
export function Keyboard({
  typed = '',
  shift,
  suggestions = ['I', 'The', 'I’m'],
  pressed,
  dark,
  colors: custom,
  style,
  onLayout,
  ...rest
}: KeyboardProps) {
  const phone = useContext(PhoneContext)
  const [pop, setPop] = useState<string | null>(null),
    last = useRef(typed),
    reduced = useReducedMotion()
  // The sheet sits 3pt in from the screen's edges; measured, it sets the key width
  const [sheet, setSheet] = useState(phone ? phone.width - 6 : 396)
  useEffect(() => {
    const previous = last.current
    last.current = typed
    if (typed.length <= previous.length || !typed.startsWith(previous) || reduced) return
    setPop(typed[typed.length - 1].toLowerCase())
    const timer = clock.timeout(() => setPop(null), 140)
    return () => clock.clearTimeout(timer)
  }, [typed, reduced])
  const upper = shift ?? (typed === '' || /[.!?]\s$/.test(typed))
  const c = { ...(dark ? DARK : LIGHT), ...custom }
  // One key: ten keys and nine gaps fill the row, on every row
  const k = (sheet - 6 - 54) / 10
  const down = (name: string) => pressed === name || (name.length === 1 && pop === name)
  const letter = { color: c.ink, fontSize: 23, lineHeight: 23, fontWeight: '400' as const }
  const rowStyle = { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 6, height: 42.5 }
  return (
    <SceneView
      {...rest}
      onLayout={(event) => {
        setSheet(event.nativeEvent.layout.width)
        onLayout?.(event)
      }}
      style={[
        {
          marginHorizontal: 3,
          marginBottom: 4,
          paddingHorizontal: 3,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderBottomLeftRadius: 52,
          borderBottomRightRadius: 52,
          backgroundColor: alpha(c.sheet, 0.94),
          boxShadow: dark
            ? 'inset 0 0.5px 0 rgba(255,255,255,0.1)'
            : 'inset 0 0.5px 0 rgba(255,255,255,0.7), 0 -0.5px 0 rgba(0,0,0,0.06)',
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 50 }}>
        {suggestions.map((word, i) => (
          <View
            key={i}
            style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: alpha(c.faint, 0.22) }}
          >
            <RNText style={{ color: c.ink, fontSize: 17, letterSpacing: -0.17 }}>{word}</RNText>
          </View>
        ))}
      </View>
      {ROWS.map((letters, r) => (
        <View key={r} style={[rowStyle, { marginBottom: 11 }]}>
          {r === 2 && (
            <Key width={k * 1.36} special down={down('shift')} colors={c} style={{ marginRight: 7.2 }}>
              <KeyboardGlyph name={upper ? 'shift-on' : 'shift'} color={c.ink} />
            </Key>
          )}
          {[...letters].map((char, i) => (
            <Key
              key={char}
              width={k}
              pop={pop === char ? (upper ? char.toUpperCase() : char) : undefined}
              // The row's first and last letters keep their callouts inside the keyboard
              anchor={r === 0 && i === 0 ? 'left' : r === 0 && i === letters.length - 1 ? 'right' : 'centre'}
              colors={c}
            >
              <RNText style={letter}>{upper ? char.toUpperCase() : char}</RNText>
            </Key>
          ))}
          {r === 2 && (
            <Key width={k * 1.36} special down={down('delete')} colors={c} style={{ marginLeft: 7.2 }}>
              <KeyboardGlyph name="delete" color={c.ink} />
            </Key>
          )}
        </View>
      ))}
      <View style={rowStyle}>
        <Key width={k * 2.78} special down={down('123')} colors={c}>
          <RNText style={[letter, { fontSize: 17, lineHeight: 17 }]}>123</RNText>
        </Key>
        <Key flex={1} special down={down('space') || down(' ')} colors={c} />
        <Key width={k * 2.78} special down={down('return')} colors={c}>
          <KeyboardGlyph name="return" color={c.ink} />
        </Key>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 72,
          paddingHorizontal: 22,
          paddingBottom: 6,
        }}
      >
        <KeyboardGlyph name="emoji" color={c.faint} sheet={c.sheet} />
        <KeyboardGlyph name="mic" color={c.faint} />
      </View>
    </SceneView>
  )
}
