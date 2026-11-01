import { createAct, Stopped, type ActEnv } from '../kit/act'
import { clock, installVirtualClock } from '../kit/clock'
import { Registry, type Entry } from '../kit/registry'

function fixture() {
  const registry = new Registry(),
    controller = new AbortController()
  const events: string[] = [],
    state = { text: '', count: 0 }
  const entry = (x: number, y: number): Entry => ({
    rect: { x, y, width: 50, height: 30 },
    layout: { x, y, width: 50, height: 30 },
    order: x,
    cursor: 'hand',
  })
  registry.entries.set('one', entry(10, 10))
  registry.entries.set('two', entry(200, 100))
  const env: ActEnv<typeof state> = {
    registry,
    layout: 'wide',
    width: 360,
    height: 640,
    speed: 1,
    touch: false,
    position: { current: { x: 0, y: 0 } },
    kind: { current: 'pointer' },
    setState: (patch) => {
      Object.assign(state, typeof patch === 'function' ? patch(state) : patch)
    },
    place: jest.fn(),
    setKind: jest.fn(),
    press: (down) => events.push(`press:${down}`),
    touching: jest.fn(),
    ripple: jest.fn(),
    keys: jest.fn(),
    instant: jest.fn(),
    mark: jest.fn(),
  }
  return { act: createAct(controller.signal, env), env, state, controller, events, clock: installVirtualClock() }
}
afterEach(() => clock.recording?.restore())
it('resolves targets in design coordinates and follows a custom path', async () => {
  const f = fixture(),
    samples: number[] = []
  f.act.place('one')
  expect(f.env.position.current).toEqual({ x: 35, y: 25 })
  const pending = f.act.move(
    { wide: { at: 'two', x: 1, y: 0 }, compact: 'one' },
    { duration: 100, path: (t, a, b) => ({ x: a.x + (b.x - a.x) * t, y: 20 }), onMove: (_, __, t) => samples.push(t) },
  )
  await f.clock.step(10)
  await pending
  expect(f.env.position.current).toEqual({ x: 250, y: 20 })
  expect(samples.at(-1)).toBe(1)
  expect(f.env.setKind).toHaveBeenLastCalledWith('pointer')
})
it('cleans up a cancelled press synchronously and never writes late', async () => {
  const f = fixture()
  f.act.place('one')
  const pending = f.act.click().catch((e) => e)
  expect(f.events).toEqual(['press:true'])
  f.controller.abort()
  expect(f.events.at(-1)).toBe('press:false')
  expect(f.env.registry.interaction('one').pressed).toBe(false)
  expect(await pending).toBeInstanceOf(Stopped)
  const after = f.events.length
  await f.clock.step(30)
  expect(f.events).toHaveLength(after)
  f.act.put({ count: 9 })
  expect(f.state.count).toBe(0)
})
it('cancels move, type, set, snap, key and stagger without leaking later mutations', async () => {
  for (const name of ['move', 'type', 'set', 'snap', 'key', 'stagger'] as const) {
    const f = fixture()
    const task =
      name === 'move'
        ? f.act.move('two')
        : name === 'type'
          ? f.act.type('text', 'hello')
          : name === 'set'
            ? f.act.set({ count: 1 })
            : name === 'snap'
              ? f.act.snap({ count: 1 })
              : name === 'key'
                ? f.act.key('cmd+k')
                : f.act.stagger([1, 2, 3], (n) => f.act.put({ count: n }), 100)
    const pending = task.catch((e) => e)
    f.controller.abort()
    const state = { ...f.state },
      placeCalls = (f.env.place as jest.Mock).mock.calls.length,
      keyCalls = (f.env.keys as jest.Mock).mock.calls.length
    expect(await pending).toBeInstanceOf(Stopped)
    await f.clock.step(90)
    expect(f.state).toEqual(state)
    expect(f.env.place).toHaveBeenCalledTimes(placeCalls)
    expect(f.env.keys).toHaveBeenCalledTimes(keyCalls)
    if (name === 'snap') expect(f.env.instant).toHaveBeenLastCalledWith(false, undefined)
    f.clock.restore()
  }
})
it('types code points without exposing half an emoji', async () => {
  const f = fixture(),
    seen: string[] = []
  f.env.setState = (patch) => {
    Object.assign(f.state, typeof patch === 'function' ? patch(f.state) : patch)
    seen.push(f.state.text)
  }
  const pending = f.act.type('text', 'A💚B', { interval: 20 })
  await f.clock.advance(200)
  await pending
  expect(seen).toEqual(['', 'A', 'A💚', 'A💚B'])
})
it('clamps scrolling and releases the scrolling marker on cancellation', async () => {
  const f = fixture(),
    set = jest.fn()
  f.env.registry.entries.get('one')!.scroll = { offset: 0, max: 100, set }
  f.act.place('one')
  const pending = f.act.scroll('one', 500, { duration: 100 })
  await f.clock.step(12)
  await pending
  expect(set).toHaveBeenLastCalledWith(100)
  expect(f.env.registry.interaction('one').scrolling).toBe(false)
  const stopped = f.act.scroll('one', 0).catch((e) => e)
  await f.clock.step(2)
  f.controller.abort()
  expect(await stopped).toBeInstanceOf(Stopped)
  expect(f.env.registry.interaction('one').scrolling).toBe(false)
})
it('restores a dragging cursor and pressed target when interrupted', async () => {
  const f = fixture()
  f.act.place('one')
  const pending = f.act.drag('two').catch((e) => e)
  await f.clock.step(15)
  expect(f.env.setKind).toHaveBeenLastCalledWith('grab')
  f.controller.abort()
  expect(await pending).toBeInstanceOf(Stopped)
  expect(f.env.registry.interaction('one').pressed).toBe(false)
  expect(f.env.setKind).toHaveBeenLastCalledWith('hand')
})

it('preserves a scripted cursor when the scene has no automatic cursor targets', async () => {
  const f = fixture()
  for (const entry of f.env.registry.entries.values()) delete entry.cursor
  const cursor = f.act.cursor('wait')
  await f.clock.step()
  await cursor
  const move = f.act.move('two', { duration: 50 })
  await f.clock.step(5)
  await move
  expect(f.env.setKind).toHaveBeenLastCalledWith('wait')
})
