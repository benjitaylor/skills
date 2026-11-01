import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import Gallery from '../playground/App'
import Comparison from '../review/Comparison'
import Showcase from './Showcase'

export default function App() {
  const search =
    Platform.OS === 'web' ? ((globalThis as unknown as { location?: { search: string } }).location?.search ?? '') : ''
  const params = new URLSearchParams(search)
  const [tab, setTab] = useState('Examples')
  const capture = params.has('review') || params.has('gold')
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {capture ? (
          params.has('gold') ? (
            <Showcase search={search} />
          ) : (
            <Comparison search={search} />
          )
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 20,
                paddingVertical: 12,
                gap: 24,
                borderBottomWidth: 1,
                borderBottomColor: '#efeeec',
              }}
            >
              {['Examples', 'Components', 'Compare'].map((label) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === label }}
                  onPress={() => setTab(label)}
                >
                  <Text
                    style={{
                      color: tab === label ? '#262628' : '#7a7a7d',
                      fontSize: 13,
                      fontWeight: tab === label ? '600' : '400',
                      paddingVertical: 6,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {tab === 'Examples' ? <Showcase /> : tab === 'Compare' ? <Comparison /> : <Gallery />}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
