import { KeyboardGlyph } from './keyboard-glyphs'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { Glass } from './glass'
import { SceneView, Label, row, absolute, type NativeProps } from './native'
import { clock } from './clock'
import { useReducedMotion } from './reduced-motion'

export interface KeyboardProps extends NativeProps {
  typed?: string
  shift?: boolean
  suggestions?: [string, string, string]
  pressed?: string | null
  dark?: boolean
}
export function Keyboard({
  typed = '',
  shift,
  suggestions = ['I', 'The', 'I’m'],
  pressed,
  dark,
  style,
  ...rest
}: KeyboardProps) {
  const [pop, setPop] = useState<string | null>(null),
    last = useRef(typed),
    reduced = useReducedMotion()
  useEffect(() => {
    const previous = last.current
    last.current = typed
    if (typed.length <= previous.length || !typed.startsWith(previous) || reduced) return
    setPop(typed[typed.length - 1].toLowerCase())
    const timer = clock.timeout(() => setPop(null), 140)
    return () => clock.clearTimeout(timer)
  }, [typed, reduced])
  const upper = shift ?? (typed === '' || /[.!?]\s$/.test(typed)),
    color = dark ? '#fff' : '#121317'
  const key = (name: string, text: ReactNode, flex = 1) => (
    <View
      key={name}
      style={{
        flex,
        height: 44,
        borderRadius: 8,
        backgroundColor:
          pressed === name || pop === name || (name === 'space' && (pressed === ' ' || pop === ' '))
            ? dark
              ? '#82848b'
              : '#fff'
            : dark
              ? '#505259'
              : '#f7f8fa',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 1px rgba(0,0,0,.12)',
        zIndex: pop === name ? 5 : 0,
      }}
    >
      <Label style={{ color, fontSize: typeof text === 'string' && text.length > 1 ? 15 : 23 }}>{text}</Label>
      {pop === name && name.length === 1 && (
        <View
          style={{
            position: 'absolute',
            bottom: 28,
            width: 50,
            height: 62,
            borderRadius: 10,
            backgroundColor: dark ? '#71737b' : '#fff',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 5px rgba(0,0,0,.16)',
          }}
        >
          <Label style={{ color, fontSize: 30 }}>{text}</Label>
        </View>
      )}
    </View>
  )
  return (
    <SceneView
      {...rest}
      style={[
        {
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          overflow: 'hidden',
          paddingHorizontal: 6,
          paddingBottom: 10,
          gap: 10,
          backgroundColor: dark ? '#303238' : '#dce0e7',
        },
        style,
      ]}
    >
      <Glass tint={dark ? 'dark' : 'light'} intensity={35} style={absolute} />
      <View style={[row, { height: 38 }]}>
        {suggestions.map((word, i) => (
          <View
            key={i}
            style={{ flex: 1, alignItems: 'center', borderRightWidth: i < 2 ? 0.5 : 0, borderRightColor: '#aaa' }}
          >
            <Label style={{ color, fontSize: 15 }}>{word}</Label>
          </View>
        ))}
      </View>
      {['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((letters, i) => (
        <View key={i} style={[row, { gap: 5, paddingHorizontal: i === 1 ? 17 : 0 }]}>
          {i === 2 && key('shift', <KeyboardGlyph name={upper ? 'shift-on' : 'shift'} dark={dark} />, 1.35)}
          {[...letters].map((char) => key(char, upper ? char.toUpperCase() : char))}
          {i === 2 && key('delete', <KeyboardGlyph name="delete" dark={dark} />, 1.35)}
        </View>
      ))}
      <View style={[row, { gap: 6 }]}>
        {key('123', '123', 1.5)}
        {key('space', '', 5)}
        {key('return', <KeyboardGlyph name="return" dark={dark} />, 1.5)}
      </View>
      <View style={[row, { justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8 }]}>
        <KeyboardGlyph name="emoji" dark={dark} />
        <KeyboardGlyph name="mic" dark={dark} />
      </View>
    </SceneView>
  )
}
