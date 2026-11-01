import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Messages from '../examples/Messages'
import Subscriptions from '../examples/Subscriptions'
import DarkBento from '../examples/DarkBento'
const examples = {
  messages: {
    title: 'A reply becomes a conversation',
    source: 'Messages',
    width: 420,
    Component: Messages,
    caption:
      'The words leave the composer, the receipt changes, and Maya replies. The phone runs off the top; the conversation owns the frame.',
  },
  subscriptions: {
    title: 'One subscription, two places',
    source: 'Subscriptions',
    width: 720,
    Component: Subscriptions,
    caption:
      'The price travels from checkout into its new row. Revenue follows. A second company gives the loop a visible reset.',
  },
  'dark-bento': {
    title: 'A shared playlist',
    source: 'Dark Bento',
    width: 360,
    Component: DarkBento,
    caption:
      'One added track, one explanation. Album sleeves preserve the product’s character; the raised card sits over the sidebar.',
  },
}
export type GoldName = keyof typeof examples
export default function Showcase({ search = '' }: { search?: string }) {
  const params = new URLSearchParams(search),
    asked = params.get('gold')
  const capture = !!asked
  const [name, setName] = useState<GoldName>(asked && Object.hasOwn(examples, asked) ? (asked as GoldName) : 'messages')
  const [poster, setPoster] = useState(params.get('poster') === '1')
  const [replay, setReplay] = useState(0)
  const [error, setError] = useState('')
  const { title, source, width, Component, caption } = examples[name]
  const requestedWidth = params.get('width') === '358' ? 358 : width
  const frame = (
    <View testID="gold-scene" style={{ width: Math.min(requestedWidth, width), maxWidth: '100%', alignSelf: 'center' }}>
      <Component key={name} poster={poster} replay={replay} onError={(e) => setError(String(e))} />
    </View>
  )
  if (capture)
    return (
      <View style={{ padding: 16 }}>
        {frame}
        {!!error && <Text testID="gold-error">{error}</Text>}
      </View>
    )
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 24, alignItems: 'center' }}>
      <View style={{ width: 720, maxWidth: '100%', gap: 8 }}>
        <Text style={{ fontSize: 28, letterSpacing: -0.8, fontWeight: '600', color: '#262628' }}>
          Small stories. Real detail.
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: '#7a7a7d' }}>
          Benji’s original compositions, rendered with native views.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, width: 720, maxWidth: '100%' }}>
        {Object.entries(examples).map(([id, e]) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: name === id }}
            onPress={() => {
              setName(id as GoldName)
              setError('')
            }}
            style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: id === name ? '#262628' : 'transparent' }}
          >
            <Text style={{ fontSize: 13, color: id === name ? '#262628' : '#7a7a7d' }}>{e.source}</Text>
          </Pressable>
        ))}
      </View>
      {frame}
      <View style={{ width: Math.min(width, 520), maxWidth: '100%', gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#262628' }}>{title}</Text>
        <Text style={{ fontSize: 13, lineHeight: 20, color: '#7a7a7d' }}>{caption}</Text>
        <View style={{ flexDirection: 'row', gap: 24, paddingTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setPoster(false)
              setReplay((x) => x + 1)
            }}
          >
            <Text style={{ fontSize: 13, color: '#262628', paddingVertical: 10 }}>Replay</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: poster }}
            onPress={() => setPoster(!poster)}
          >
            <Text style={{ fontSize: 13, color: '#262628', paddingVertical: 10 }}>
              {poster ? 'Play motion' : 'Show poster'}
            </Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 11, color: '#9a9a9d' }}>
          Reference: examples/{name === 'dark-bento' ? 'dark-bento' : name} · {source}
        </Text>
        {!!error && <Text testID="gold-error">{error}</Text>}
      </View>
    </ScrollView>
  )
}
