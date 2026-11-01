import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import Gallery from '../playground/App'
import Comparison from '../review/Comparison'

/** The runnable demo: the gallery plus matching, controllable review scenes. */
export default function App() {
  const search =
    Platform.OS === 'web' ? ((globalThis as unknown as { location?: { search: string } }).location?.search ?? '') : ''
  const capture = new URLSearchParams(search).has('review')
  const [compare, setCompare] = useState(capture)
  if (capture)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f1ee' }}>
          <Comparison search={search} />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#f2f1ee' }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#243d33' }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 10, gap: 24 }}>
            {['Showcases', 'Compare scenes'].map((label, i) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: compare === (i === 1) }}
                onPress={() => setCompare(i === 1)}
              >
                <Text style={{ color: '#fff', fontWeight: compare === (i === 1) ? '700' : '400' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
        {compare ? <Comparison /> : <Gallery />}
      </View>
    </SafeAreaProvider>
  )
}
