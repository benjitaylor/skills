import { clock, installVirtualClock } from '../kit/clock'

afterEach(() => clock.recording?.restore())
it('advances kit frames without replacing native timers or Date', async () => {
  const raf = globalThis.requestAnimationFrame,
    timeout = globalThis.setTimeout,
    date = Date.now
  const c = installVirtualClock({ fps: 50 }),
    times: number[] = []
  const tick = (t: number) => {
    times.push(t)
    if (times.length < 3) clock.raf(tick)
  }
  clock.raf(tick)
  await c.step(3)
  expect(times).toEqual([1020, 1040, 1060])
  expect(c.frame).toBe(3)
  expect(globalThis.requestAnimationFrame).toBe(raf)
  expect(globalThis.setTimeout).toBe(timeout)
  expect(Date.now).toBe(date)
})
it('orders timers by deadline then registration and drains their continuations', async () => {
  const c = installVirtualClock(),
    events: string[] = []
  clock.timeout(() => events.push('later'), 30)
  clock.timeout(() => {
    events.push('first')
    void Promise.resolve().then(() => clock.timeout(() => events.push('nested'), 2))
  }, 10)
  clock.timeout(() => events.push('second'), 10)
  const id = clock.timeout(() => events.push('cancelled'), 5)
  clock.clearTimeout(id)
  await c.advance(30)
  expect(events).toEqual(['first', 'second', 'nested', 'later'])
})
it('keeps layout frames separate and cancels work', async () => {
  const c = installVirtualClock(),
    events: string[] = []
  clock.layoutRaf(() => events.push('layout'))
  const cancelled = clock.raf(() => events.push('cancelled'))
  clock.cancelRaf(cancelled)
  clock.raf(() => events.push('animation'))
  expect(c.layoutPending).toBe(true)
  await c.flushLayout()
  expect(events).toEqual(['layout'])
  await c.step()
  expect(events).toEqual(['layout', 'animation'])
})
it('rejects invalid and simultaneous advances', async () => {
  expect(() => installVirtualClock({ fps: 0 })).toThrow(RangeError)
  const c = installVirtualClock()
  await expect(c.advance(-1)).rejects.toThrow(RangeError)
  await expect(c.step(0.5)).rejects.toThrow(RangeError)
  const first = c.advance(10)
  await expect(c.advance(10)).rejects.toThrow('sequentially')
  await first
})

it('waits for the native layout adapter before delivering animation frames', async () => {
  const events: string[] = []
  const c = installVirtualClock({
    onLayout: async () => {
      await Promise.resolve()
      events.push('native layout')
    },
  })
  clock.raf(() => events.push('frame'))
  await c.step()
  expect(events).toEqual(['native layout', 'frame'])
})

it('cancels an in-flight step when restored without disturbing a newer clock', async () => {
  let release!: () => void
  const c = installVirtualClock({
    onLayout: () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
  })
  const callback = jest.fn()
  clock.raf(callback)
  const pending = c.step(60)
  while (!release) await Promise.resolve()
  c.restore()
  const next = installVirtualClock()
  release()
  await pending
  c.restore()
  expect(callback).not.toHaveBeenCalled()
  expect(clock.recording).toBe(next)
  expect(next.now()).toBe(1000)
})
