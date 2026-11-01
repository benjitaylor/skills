import type { Act } from '../kit'

type S = { draft: string; sent: boolean; delivered: boolean; read: boolean; typing: boolean; reply: boolean }
const initial: S = { draft: '', sent: false, delivered: false, read: false, typing: false, reply: false }
// Reduced motion shows the whole exchange
const poster: S = { ...initial, sent: true, delivered: true, read: true, reply: true }
const MINE = 'Yes! See you at 7'

async function script(a: Act<S>) {
  await a.wait(700)
  await a.click('compose')
  await a.type('draft', MINE, { interval: 60 })
  await a.wait(450)
  await a.click('send')
  // Clear the field in the same update that adds the bubble: the words lift out of it
  await a.set({ sent: true, draft: '' })
  await a.wait(600)
  await a.set({ delivered: true })
  await a.wait(900)
  await a.set({ read: true })
  await a.wait(700)
  await a.set({ typing: true })
  await a.wait(1600)
  await a.set({ typing: false, reply: true })
  await a.wait(2600)
}

export { initial, poster, script, MINE }
export type { S }
