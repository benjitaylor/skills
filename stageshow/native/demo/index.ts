import { registerRootComponent } from 'expo'
import { Platform } from 'react-native'
import { installVirtualClock } from '../kit'
import App from './App'

// Frame-accurate web/native comparisons step this clock from a recorder, as the
// web kit exposes its own at window.__stageshow.clock. Installed before any scene mounts.
const host = globalThis as unknown as { location?: { search: string }; __stageshow?: object }
if (Platform.OS === 'web' && new URLSearchParams(host.location?.search ?? '').get('clock') === 'virtual')
  host.__stageshow = {
    clock: installVirtualClock({
      onLayout: () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
    }),
  }
registerRootComponent(App)
