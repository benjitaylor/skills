import { checkSeam, createAct, Stopped, type ActEnv } from '../kit/act'
import { clock, installVirtualClock } from '../kit/clock'
import { Registry, type Entry } from '../kit/registry'

function fixture(options: { marked?: boolean; touch?: boolean; cursor?: boolean } = {}) {
  const registry = new Registry(),
    controller = new AbortController()
  const events: string[] = [],
    state = { text: '', count: 0 }
  const entry = (x: number, y: number): Entry => ({
    rect: { x, y, width: 50, height: 30 },
    layout: { x, y, width: 50, height: 30 },
    order: x,
    cursor: options.marked === false ? undefined : 'hand',
  })
  registry.entries.set('one', entry(10, 10))
  registry.entries.set('two', entry(200, 100))
  const env: ActEnv<typeof state> = {
    registry,
    layout: 'wide',
    width: 360,
    height: 640,
    speed: 1,
    touch: options.touch ?? false,
    cursor: options.cursor,
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
  const f = fixture({ marked: false })
  const cursor = f.act.cursor('wait')
  await f.clock.step()
  await cursor
  const move = f.act.move('two', { duration: 50 })
  await f.clock.step(5)
  await move
  expect(f.env.setKind).toHaveBeenLastCalledWith('wait')
})

describe('authoring warnings', () => {
  let warnings: jest.SpyInstance
  beforeEach(() => {
    warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warnings.mockRestore())
  const warned = () => warnings.mock.calls.map(([message]) => String(message))

  it('names a missing target instead of measuring nothing silently', () => {
    const f = fixture()
    expect(f.act.rect('missing')).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(warned()).toEqual(['[stageshow-native] no target named "missing"'])
  })

  it('flags a selection drag that never reads the caret', async () => {
    const f = fixture()
    f.act.place('one')
    f.env.kind.current = 'ibeam'
    const drifting = f.act.drag('two', () => {}, { duration: 50 })
    await f.clock.step(30)
    await drifting
    expect(warned().some((m) => m.includes('selection drift'))).toBe(true)

    warnings.mockClear()
    f.act.place('one')
    const following = f.act.drag('two', (at) => void f.act.caret('two', at), { duration: 50 })
    await f.clock.step(30)
    await following
    expect(warned().some((m) => m.includes('selection drift'))).toBe(false)
  })

  it('reports a loop that ends away from its opening state or cursor', () => {
    checkSeam({ text: '', count: 0 }, { text: '', count: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 })
    expect(warned()).toEqual([])
    checkSeam({ text: 'hi', count: 0 }, { text: '', count: 0 }, { x: 40, y: 5 }, { x: 5, y: 5 })
    expect(warned()).toEqual([
      '[stageshow-native] loop seam: state still differs from initial at the end of the script (text)',
      '[stageshow-native] loop seam: cursor does not end where it starts',
    ])
  })
})

describe('choreography, as the web kit times it', () => {
  // Virtual ms since the clock was installed
  const at = (f: ReturnType<typeof fixture>) => Math.round(f.clock.now() - 1000)
  const hash = (i: number) => {
    const x = Math.sin(i * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  it('drags as a mouse does: dip, close at the bottom of it, let go of the dip, then carry', async () => {
    const f = fixture(),
      log: string[] = [],
      placed: number[] = []
    f.act.place('one')
    f.env.press = (down) => log.push(`${at(f)} press:${down}`)
    f.env.setKind = (kind) => log.push(`${at(f)} kind:${kind}`)
    f.env.place = () => placed.push(at(f))
    let done = -1
    const drag = f.act.drag('two').then(() => (done = at(f)))
    await f.clock.step(60)
    await drag
    // From (35, 25) to (225, 115): 210px, so clamp(360 + 1.1d, 450, 900) = 591ms of carry
    expect(log).toEqual(['0 press:true', '60 kind:grab', '130 press:false', '733 kind:hand', '733 press:false'])
    expect(placed[0]).toBe(130)
    // No pause after it lands: the drag resolves on the frame the carry ends
    expect(done).toBe(733)
    expect(f.env.position.current).toEqual({ x: 225, y: 115 })
  })

  it('carries a mouse drag in a flatter arc than a move', async () => {
    const f = fixture(),
      points: { x: number; y: number }[] = []
    f.env.position.current = { x: 0, y: 0 }
    const drag = f.act.drag({ x: 200, y: 0 }, (p) => points.push(p), { duration: 600 })
    await f.clock.step(60)
    await drag
    // bow = min(0.06d, 18) at the middle of the path
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(12, 0)
  })

  it('runs a selection straight and drops into its last line before sweeping along it', async () => {
    const f = fixture(),
      points: { x: number; y: number }[] = []
    f.env.position.current = { x: 20, y: 20 }
    f.env.kind.current = 'ibeam'
    const drag = f.act.drag({ x: 120, y: 60 }, (p) => {
      points.push(p)
      f.act.caret('one', p)
    })
    await f.clock.step(80)
    await drag
    expect(f.env.setKind).not.toHaveBeenCalledWith('grab')
    for (const p of points) {
      // ey = 1 - (1 - e)², ex = e²: one curve through (from.x, end.y), with no bow
      const e = 1 - Math.sqrt(1 - (p.y - 20) / 40)
      expect((p.x - 20) / 100).toBeCloseTo(e * e, 6)
    }
    const mid = points[Math.floor(points.length / 2)]
    expect((mid.y - 20) / 40).toBeGreaterThan((mid.x - 20) / 100)
  })

  it('swipes a finger: lands, presses, throws in a quarter second, and lifts after a beat', async () => {
    const f = fixture({ touch: true }),
      log: string[] = [],
      streaks: number[] = []
    f.act.place('one')
    f.env.press = (down) => log.push(`${at(f)} press:${down}`)
    f.env.touching = (down) => log.push(`${at(f)} touching:${down}`)
    f.env.swiping = (on) => log.push(`${at(f)} swiping:${on}`)
    f.env.streak = (length) => streaks.push(length)
    f.env.setKind = (kind) => log.push(`${at(f)} kind:${kind}`)
    const drag = f.act.drag('two')
    await f.clock.step(60)
    await drag
    // clamp(180 + 0.5d, 240, 300) = 285ms of throw from 310ms; the dot lingers 240ms
    expect(log).toEqual([
      '0 touching:true',
      '140 press:true',
      '310 swiping:true',
      '310 press:false',
      '600 press:false',
      '600 swiping:false',
      '840 touching:false',
    ])
    expect(streaks[0]).toBe(0)
    expect(Math.max(...streaks)).toBeLessThanOrEqual(100)
    expect(Math.max(...streaks)).toBeGreaterThan(50)
  })

  it('taps a finger a beat before the press and lets it go 240ms after the lift', async () => {
    const f = fixture({ touch: true }),
      log: string[] = []
    f.act.place('one')
    f.env.press = (down) => log.push(`${at(f)} press:${down}`)
    f.env.touching = (down) => log.push(`${at(f)} touching:${down}`)
    const click = f.act.click()
    await f.clock.step(30)
    await click
    expect(log).toEqual([
      '0 touching:true',
      '140 press:true',
      '240 press:false',
      '240 press:false',
      '480 touching:false',
    ])
  })

  it('hovers only as a move starts and ends, and presses its target or what it hovers', async () => {
    const f = fixture()
    const r = f.env.registry
    r.entries.set('row', {
      rect: { x: 0, y: 200, width: 300, height: 60 },
      layout: { x: 0, y: 200, width: 300, height: 60 },
      order: 1,
    })
    r.entries.set('button', {
      rect: { x: 200, y: 210, width: 50, height: 30 },
      layout: { x: 200, y: 210, width: 50, height: 30 },
      order: 2,
      parent: 'row',
    })
    const hovered = () => [...r.entries.keys()].filter((n) => r.interaction(n).hover).sort()
    const run = async (beat: Promise<void>) => {
      await f.clock.step(60)
      await beat
    }
    // place() never hovers, even onto a target
    f.act.place({ x: 10, y: 230 })
    expect(hovered()).toEqual([])
    // Hover lands as the move ends, not on the way
    const onWay: string[] = []
    await run(f.act.move('row', { onMove: () => onWay.push(hovered().join()) }))
    expect(new Set(onWay)).toEqual(new Set(['']))
    expect(hovered()).toEqual(['row'])
    // Onto a button inside the row: the row stays hovered all the way
    onWay.length = 0
    await run(f.act.move('button', { onMove: () => onWay.push(hovered().join()) }))
    expect(new Set(onWay)).toEqual(new Set(['row']))
    expect(hovered()).toEqual(['button', 'row'])
    // A state change under a still pointer leaves hover alone
    await run(f.act.set({ count: 2 }))
    expect(hovered()).toEqual(['button', 'row'])
    // A bare click presses what the cursor hovers
    const pressed: string[] = []
    const watch = r.subscribe(() => {
      for (const n of r.entries.keys()) if (r.interaction(n).pressed) pressed.push(n)
    })
    await run(f.act.click())
    expect(new Set(pressed)).toEqual(new Set(['button']))
    // A move to a bare point leaves hover as it starts
    await run(f.act.move({ x: 100, y: 20 }))
    expect(hovered()).toEqual([])
    // A click on a bare point presses nothing, even over a target
    pressed.length = 0
    await run(f.act.click({ x: 30, y: 25 }))
    expect(pressed).toEqual([])
    // A click on a target presses that target
    await run(f.act.click('one'))
    expect(new Set(pressed)).toEqual(new Set(['one']))
    expect(hovered()).toEqual(['one'])
    // A drag lets go of hover as it presses, and never hovers on the way
    await run(f.act.drag('row'))
    expect(hovered()).toEqual([])
    watch()
  })

  it('types with a beat before the first character and after the last, on a repeatable rhythm', async () => {
    const f = fixture(),
      seen: [number, string][] = []
    f.env.setState = (patch) => {
      Object.assign(f.state, typeof patch === 'function' ? patch(f.state) : patch)
      seen.push([f.clock.now() - 1000, f.state.text])
    }
    let done = -1
    const typing = f.act.type('text', 'abc', { interval: 100 }).then(() => (done = f.clock.now() - 1000))
    await f.clock.advance(1000)
    await typing
    const gaps = [0, 1, 2, 3].map((i) => 100 * (0.7 + 0.6 * hash(i)))
    expect(seen.map(([, text]) => text)).toEqual(['', 'a', 'ab', 'abc'])
    let t = 0
    seen.forEach(([time], i) => {
      expect(time).toBeCloseTo(t, 6)
      t += gaps[i]
    })
    expect(done).toBeCloseTo(t, 6)
  })

  it('mounts keycaps hidden and shows them two frames later, so they always fade up', async () => {
    const f = fixture()
    const keys = f.env.keys as jest.Mock
    const last = () => keys.mock.calls.at(-1)[0]
    const key = f.act.key('cmd+k')
    expect(last()).toMatchObject({ caps: ['⌘', 'K'], show: false, down: false })
    await f.clock.step(1)
    expect(last().show).toBe(false)
    await f.clock.step(1)
    expect(last()).toMatchObject({ show: true, down: false })
    // Down 180ms after it shows, up 140ms later, which is when key() resolves
    await f.clock.advance(180)
    expect(last()).toMatchObject({ show: true, down: true })
    await f.clock.advance(140)
    await key
    expect(last()).toMatchObject({ show: true, down: false })
    await f.clock.advance(600)
    expect(last()).toMatchObject({ show: false, down: false })
    // Each stroke gets an id no other act will reuse
    const next = f.act.key('enter')
    expect(last().id).toBeGreaterThan(keys.mock.calls[0][0].id)
    f.controller.abort()
    await next.catch(() => {})
  })

  it('lands a set on its second frame without waiting on native measurement', async () => {
    const f = fixture()
    const measure = jest.spyOn(f.env.registry, 'measure')
    let done = false
    const set = f.act.set({ count: 1 }).then(() => (done = true))
    await f.clock.step(1)
    expect(done).toBe(false)
    await f.clock.step(1)
    await set
    expect(done).toBe(true)
    // Points need no geometry; a named target does
    const toPoint = f.act.move({ x: 90, y: 90 }, { duration: 50 })
    await f.clock.step(5)
    await toPoint
    expect(measure).not.toHaveBeenCalled()
    const toName = f.act.move('two', { duration: 50 })
    await f.clock.step(5)
    await toName
    expect(measure).toHaveBeenCalledTimes(1)
  })

  it('enters from just past the nearest edge, on a slight diagonal', async () => {
    const cases = [
      [
        { x: 30, y: 300 },
        { x: -40, y: 300 + 640 * 0.12 },
      ],
      [
        { x: 340, y: 100 },
        { x: 360 + 16, y: 100 + 640 * 0.12 },
      ],
      [
        { x: 180, y: 20 },
        { x: 180 - 360 * 0.06, y: -40 },
      ],
      [
        { x: 180, y: 630 },
        { x: 180 + 360 * 0.06, y: 640 + 16 },
      ],
    ] as const
    for (const [to, from] of cases) {
      const f = fixture(),
        points: { x: number; y: number }[] = []
      f.env.place = (p) => points.push(p)
      const enter = f.act.enter(to)
      await f.clock.step(50)
      await enter
      expect(points[0].x).toBeCloseTo(from.x, 6)
      expect(points[0].y).toBeCloseTo(from.y, 6)
      expect(points.at(-1)).toEqual(to)
      f.clock.restore()
    }
  })

  it('moves a cursor into a scroll area before scrolling, and skips a target that is not there', async () => {
    const f = fixture({ cursor: true }),
      set = jest.fn()
    f.env.registry.entries.get('two')!.scroll = { offset: 0, max: 100, set }
    f.env.position.current = { x: 10, y: 400 }
    let started = -1
    f.env.registry.subscribe(() => {
      if (started < 0 && f.env.registry.interaction('two').scrolling) started = at(f)
    })
    const scroll = f.act.scroll('two', 50, { duration: 100 })
    await f.clock.step(80)
    await scroll
    // Into the area at (0.6w, 0.55h), a 120ms hold, then the scroll
    expect(f.env.position.current).toEqual({ x: 230, y: 116.5 })
    expect(started).toBeGreaterThan(300 + 120 - 1)
    expect(set).toHaveBeenLastCalledWith(50)
    await expect(f.act.scroll('missing', 10)).resolves.toBeUndefined()
  })

  it('reports errors from beats nobody awaits, and stays quiet about stopped ones', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const f = fixture()
    const move = f.act.move('two')
    void f.act.wait(500)
    f.controller.abort()
    await f.clock.step(2)
    // An awaited call still sees the stop
    await expect(move).rejects.toBeInstanceOf(Stopped)
    expect(errors).not.toHaveBeenCalled()
    const g = fixture()
    void g.act.move('missing').catch(() => {})
    await g.clock.settle()
    expect(errors).toHaveBeenCalledWith('[stageshow-native] script error', expect.any(Error))
    errors.mockRestore()
  })
})
