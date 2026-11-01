import Messages from '../messages'
import Subscriptions from '../subscriptions'
import DarkBento from '../dark-bento'
// The reference renderers are the original gold components, without restyling.
export default function NativeGold() {
  const p = new URLSearchParams(location.search)
  const name = p.get('gold') || 'messages'
  const width = name === 'subscriptions' ? 720 : name === 'dark-bento' ? 360 : 420
  const Component = name === 'subscriptions' ? Subscriptions : name === 'dark-bento' ? DarkBento : Messages
  return <div style={{ padding: 16 }}><div data-testid="gold-scene" style={{ width: p.get('width') === '358' ? 358 : width, maxWidth: '100%', margin: 'auto' }}><Component /></div></div>
}
