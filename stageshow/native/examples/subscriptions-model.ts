import type { Act, Rect } from '../kit'

type Pulse = { name: string; initial: string; plan: string; price: number }
type Scene = { org: string; tile: string; mrr: number; history: number[]; pulses: Pulse[] }

const SCENES: Scene[] = [
  {
    org: 'Northwind',
    tile: 'N',
    mrr: 48210,
    history: [31, 33, 32, 36, 38, 37, 41, 44, 43, 46, 48.2],
    pulses: [
      { name: 'Maya Lin', initial: 'M', plan: 'Pro', price: 49 },
      { name: 'Studio Kite', initial: 'S', plan: 'Team', price: 99 },
    ],
  },
  {
    org: 'Brightside',
    tile: 'B',
    mrr: 12480,
    history: [6, 6.4, 7.1, 7, 8.2, 8.8, 9.1, 10.4, 10.9, 11.6, 12.48],
    pulses: [{ name: 'Leo Park', initial: 'L', plan: 'Plus', price: 29 }],
  },
]

type Pay = 'idle' | 'busy' | 'paid' | 'done'
type S = {
  scene: number
  // per scene: rows opened, rows landed, which pulse the checkout shows, its button
  open: [number, number]
  landed: [number, number]
  k: [number, number]
  pay: [Pay, Pay]
  fly: null | { scene: number; i: number; from: Rect; to: Rect; go: boolean }
}

const START: S = { scene: 0, open: [0, 0], landed: [0, 0], k: [0, 0], pay: ['idle', 'idle'], fly: null }
const POSTER: S = { ...START, open: [2, 0], landed: [2, 0], k: [1, 0], pay: ['done', 'idle'] }

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const set2 = <T>(pair: [T, T], i: number, v: T): [T, T] => (i === 0 ? [v, pair[1]] : [pair[0], v])

async function pulse(a: Act<S>, sc: number, i: number) {
  await a.set((s) => ({ pay: set2(s.pay, sc, 'busy') }))
  await a.wait(700)
  // Paid: the chip lifts off the button at once and the new row's space opens
  // under it while it travels. Where it lands is the top of the list as it is
  // now (the new row opens there), at the right edge where amounts sit.
  const list = a.rect(`list-${sc}`, { layout: true })
  const row = a.rect(`row-${sc}-${i}`, { layout: true })
  const pill = a.rect(`pill-${sc}-${i}`, { layout: true })
  const b = a.rect(`pay-${sc}`, { layout: true })
  const size = { width: pill.width, height: pill.height }
  // The row keeps its full layout height inside Collapse. Measure the pill's
  // actual inset, including the row's border, so the handoff has no half-pixel hop.
  const to = { ...pill, y: list.y + pill.y - row.y }
  const from = { x: b.x + b.width / 2 - pill.width / 2, y: b.y + b.height / 2 - pill.height / 2, ...size }
  await a.set((s) => ({ pay: set2(s.pay, sc, 'paid'), fly: { scene: sc, i, from, to, go: false } }))
  // The chip buds off the button before it sets off
  await a.wait(200)
  await a.set((s) => ({ open: set2(s.open, sc, i + 1), fly: { ...s.fly!, go: true } }))
  await a.wait(900)
  // Landed: the real pill takes over in the same frame the chip goes
  await a.set((s) => ({ fly: null, landed: set2(s.landed, sc, i + 1), pay: set2(s.pay, sc, 'done') }))
}

async function script(a: Act<S>) {
  await a.wait(900)
  a.mark('first')
  await pulse(a, 0, 0)
  await a.wait(700)
  // The checkout moves on to the next customer: only the plan and price change
  await a.set((s) => ({ pay: set2(s.pay, 0, 'idle'), k: set2(s.k, 0, 1) }))
  await a.wait(1000)
  a.mark('second')
  await pulse(a, 0, 1)
  await a.wait(2000)

  a.mark('scene')
  await a.set({ scene: 1 })
  await a.wait(700)
  // Northwind resets while it's out of sight
  await a.snap((s) => ({
    open: set2(s.open, 0, 0),
    landed: set2(s.landed, 0, 0),
    k: set2(s.k, 0, 0),
    pay: set2(s.pay, 0, 'idle'),
  }))
  await a.wait(500)
  await pulse(a, 1, 0)
  await a.wait(2000)

  await a.set({ scene: 0 })
  await a.wait(700)
  await a.snap((s) => ({ open: set2(s.open, 1, 0), landed: set2(s.landed, 1, 0), pay: set2(s.pay, 1, 'idle') }))
  await a.wait(300)
}

export { SCENES, START, POSTER, script, money }
export type { S }
