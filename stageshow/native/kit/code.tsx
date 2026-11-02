import { useState, type ReactNode } from 'react'
import { Animated, Text, View } from 'react-native'
import { useLook, type Look } from './look'
import { SceneView, row, type NativeProps } from './native'
import { curves, useTween } from './animate'
import { Mask } from './mask'

export interface CodeLine {
  text: string
  kind?: 'add' | 'del'
  number?: boolean
}
const KEYWORDS =
  /^(const|let|var|function|return|if|else|await|async|import|from|export|default|new|true|false|null|undefined|for|of|in|while|try|catch|throw|class|extends|type|interface|def|self|None|True|False)$/
// code.css: 11.5px on a 19px line; a line longer than the block fades over its last 14px.
const SIZE = 11.5,
  LINE = 19,
  FADE = 14
type Syntax = Record<'key' | 'str' | 'num' | 'fn' | 'com', string>
/** One set per theme, as code.css: mono and blueprint read by weight, not hue. */
function syntax({ theme, palette, tokens }: Look): Syntax {
  if (palette === 'mono' || theme === 'blueprint')
    return { key: tokens.text, str: tokens.muted, num: tokens.text, fn: tokens.text, com: tokens.textFaint }
  if (theme === 'dark') return { key: '#c4b5fd', str: '#86efac', num: '#fdba74', fn: '#93c5fd', com: tokens.textFaint }
  return { key: '#7c3aed', str: '#15803d', num: '#b45309', fn: '#2563eb', com: tokens.textFaint }
}
function tokenize(line: string, colors: Syntax) {
  const result: ReactNode[] = [],
    regex =
      /(\/\/.*$|#.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d[\d._]*\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g
  let last = 0,
    match: RegExpExecArray | null
  while ((match = regex.exec(line))) {
    if (match.index > last) result.push(line.slice(last, match.index))
    const [text, comment, string, number, call, word] = match
    const color = comment
      ? colors.com
      : string
        ? colors.str
        : number
          ? colors.num
          : call
            ? KEYWORDS.test(call)
              ? colors.key
              : colors.fn
            : word && KEYWORDS.test(word)
              ? colors.key
              : undefined
    result.push(
      <Text key={match.index} style={{ color }}>
        {text}
      </Text>,
    )
    last = match.index + text.length
  }
  if (last < line.length) result.push(line.slice(last))
  return result
}
/** An alpha mask that is opaque up to the last `FADE` px of the box, then fades out. */
const fadeRight = (width: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LINE}" viewBox="0 0 ${width} ${LINE}"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="white"/><stop offset="${Math.max(0, 1 - FADE / width)}" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`
function CodeRow({
  line,
  number,
  numbers,
  on,
  highlight,
  colors,
}: {
  line: CodeLine
  number: number | ''
  numbers: boolean
  on: boolean
  highlight: boolean
  colors: Syntax
}) {
  const { tokens } = useLook()
  const opacity = useTween(on ? 1 : 0, 300, { ease: curves.ease })
  // The text lays out at its natural width in a wide row, so a line that runs past the block can be measured and faded.
  const [box, setBox] = useState(0),
    [natural, setNatural] = useState(0)
  const font = { fontSize: SIZE, lineHeight: LINE, fontFamily: tokens.mono }
  const text = (
    <View style={{ position: 'absolute', left: 0, top: 0, width: 10000, flexDirection: 'row' }}>
      <Text
        numberOfLines={1}
        onLayout={(event) => setNatural(event.nativeEvent.layout.width)}
        style={[font, { color: tokens.text }]}
      >
        {highlight ? tokenize(line.text, colors) : line.text}
      </Text>
    </View>
  )
  return (
    <Animated.View
      style={[
        row,
        {
          height: LINE,
          paddingRight: 12,
          opacity,
          backgroundColor:
            line.kind === 'add' ? tokens.successSoft : line.kind === 'del' ? tokens.dangerSoft : 'transparent',
        },
      ]}
    >
      {numbers && (
        <Text
          style={[
            font,
            {
              width: 30,
              paddingRight: 10,
              textAlign: 'right',
              fontVariant: ['tabular-nums'],
              color: tokens.textFaint,
            },
          ]}
        >
          {number}
        </Text>
      )}
      <Text
        style={[
          font,
          {
            width: 16,
            color:
              line.kind === 'add' ? tokens.successText : line.kind === 'del' ? tokens.dangerText : tokens.textFaint,
          },
        ]}
      >
        {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ''}
      </Text>
      <View
        style={{ flex: 1, minWidth: 0, height: LINE, overflow: 'hidden' }}
        onLayout={(event) => setBox(event.nativeEvent.layout.width)}
      >
        {box > 0 && natural > box + 1 ? (
          <Mask xml={fadeRight(box)} style={{ width: box, height: LINE }}>
            {text}
          </Mask>
        ) : (
          text
        )}
      </View>
    </Animated.View>
  )
}
export function Code({
  lines,
  start = 1,
  numbers = true,
  count,
  highlight = true,
  style,
  ...rest
}: NativeProps & {
  lines: (CodeLine | string)[]
  start?: number
  numbers?: boolean
  count?: number
  highlight?: boolean
}) {
  const look = useLook(),
    colors = syntax(look)
  let n = start
  return (
    <SceneView {...rest} style={style}>
      {lines.map((raw, i) => {
        // A removed line keeps the old number; the line after it reuses it
        const line = typeof raw === 'string' ? { text: raw } : raw,
          number = line.kind === 'del' || line.number === false ? '' : n++
        return (
          <CodeRow
            key={i}
            line={line}
            number={number}
            numbers={numbers}
            on={count === undefined || i < count}
            highlight={highlight}
            colors={colors}
          />
        )
      })}
    </SceneView>
  )
}
