import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ReviewScene } from './Scene'
import { phases, themes, reviewOptions, type Phase, type ReviewTheme, type SceneName } from './model'

export default function Comparison({ search = '' }: { search?: string }) {
  const initial = reviewOptions(search)
  const [scene, setScene] = useState<SceneName>(initial.scene)
  const [theme, setTheme] = useState<ReviewTheme>(initial.theme)
  const [phase, setPhase] = useState<Phase | 'live'>(initial.phase)
  const [width, setWidth] = useState(initial.width)
  const [reduced, setReduced] = useState(initial.reduced)
  const [replay, setReplay] = useState(0)
  const [focused, setFocused] = useState(false)
  const [mark, setMark] = useState(''),
    [error, setError] = useState('')
  const button = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      testID={`review-${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: active ? '#243d33' : '#e7ebe8',
      }}
    >
      <Text style={{ color: active ? '#fff' : '#243d33', fontSize: 12 }}>{label}</Text>
    </Pressable>
  )
  return (
    <ScrollView contentContainerStyle={{ gap: focused ? 8 : 12, padding: focused ? 8 : 16 }}>
      {focused && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {button('Back', true, () => setFocused(false))}
          {button('Replay', false, () => {
            setPhase('live')
            setReplay((x) => x + 1)
          })}
        </View>
      )}
      {!focused && (
        <>
          <Text style={{ fontSize: 22, fontWeight: '600', color: '#243d33' }}>Scene comparison</Text>
          <Text style={{ fontSize: 13, color: '#59665e' }}>
            The same content and states on native and web. Switch states quickly to interrupt a transition.
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['controls', 'phone'] as const).map((x) => button(x, scene === x, () => setScene(x)))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {themes.map((x) => button(x, theme === x, () => setTheme(x)))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {phases.map((x) => button(x, phase === x, () => setPhase(x)))}
            {button('Play', phase === 'live', () => {
              setPhase('live')
              setReplay((x) => x + 1)
              setMark('')
              setError('')
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {button('Compact', width === 358, () => setWidth(358))}
            {button('Wide', width === 720, () => setWidth(720))}
            {button('Reduce motion', reduced, () => setReduced(!reduced))}
            {button('Focus', false, () => setFocused(true))}
          </View>
          <Text
            testID="review-status"
            style={{ fontSize: 12, color: '#59665e' }}
          >{`${scene} · ${theme} · ${phase} · ${width} · ${reduced ? 'reduced' : 'motion'}${mark ? ` · ${mark}` : ''}`}</Text>
        </>
      )}
      {!!error && (
        <Text testID="review-error" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <View
        testID="review-scene"
        style={{ width, maxWidth: '100%', alignSelf: 'center', borderRadius: 20, overflow: 'hidden' }}
      >
        <ReviewScene
          scene={scene}
          theme={theme}
          phase={phase}
          reduced={reduced}
          replay={replay}
          onMark={setMark}
          onError={(e) => setError(String(e))}
        />
      </View>
    </ScrollView>
  )
}
