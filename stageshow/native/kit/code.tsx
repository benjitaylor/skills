import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useLook } from './look'
import { SceneView, row, type NativeProps } from './native'

export interface CodeLine {
  text: string
  kind?: 'add' | 'del'
  number?: boolean
}
const KEYWORDS =
  /^(const|let|var|function|return|if|else|await|async|import|from|export|default|new|true|false|null|undefined|for|of|in|while|try|catch|throw|class|extends|type|interface|def|self|None|True|False)$/
function tokenize(line: string) {
  const result: ReactNode[] = [],
    regex =
      /(\/\/.*$|#.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d[\d._]*\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g
  let last = 0,
    match: RegExpExecArray | null
  while ((match = regex.exec(line))) {
    if (match.index > last) result.push(line.slice(last, match.index))
    const [text, comment, string, number, call, word] = match
    const color = comment
      ? '#89919f'
      : string
        ? '#528e68'
        : number
          ? '#b18349'
          : call
            ? KEYWORDS.test(call)
              ? '#9b73be'
              : '#5b8aad'
            : word && KEYWORDS.test(word)
              ? '#9b73be'
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
  const { tokens } = useLook()
  let n = start
  return (
    <SceneView {...rest} style={[{ overflow: 'hidden' }, style]}>
      {lines.map((raw, i) => {
        const line = typeof raw === 'string' ? { text: raw } : raw,
          number = line.kind === 'del' || line.number === false ? n : n++
        return (
          <View
            key={i}
            style={[
              row,
              {
                height: 20,
                opacity: count === undefined || i < count ? 1 : 0,
                backgroundColor: line.kind === 'add' ? '#32966a15' : line.kind === 'del' ? '#d7545415' : 'transparent',
              },
            ]}
          >
            {numbers && (
              <Text
                style={{
                  width: 30,
                  textAlign: 'right',
                  paddingRight: 8,
                  color: tokens.muted,
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
              >
                {line.kind === 'del' || line.number === false ? '' : number}
              </Text>
            )}
            <Text style={{ width: 14, color: line.kind === 'add' ? tokens.success : tokens.danger }}>
              {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ''}
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="clip"
              style={{ color: tokens.text, fontSize: 11, fontFamily: 'monospace', flexShrink: 1 }}
            >
              {highlight ? tokenize(line.text) : line.text}
            </Text>
          </View>
        )
      })}
    </SceneView>
  )
}
