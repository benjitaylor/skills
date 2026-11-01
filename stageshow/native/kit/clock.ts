/** A kit-local clock. Never replaces React Native's process-wide timers. */
export type FrameCallback = (time: number) => void
interface Driver {
  now(): number
  raf(fn: FrameCallback): number
  cancelRaf(id: number): void
  timeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
}
const real: Driver = {
  now: () => performance.now(),
  raf: (fn) => requestAnimationFrame(fn),
  cancelRaf: (id) => cancelAnimationFrame(id),
  timeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id),
}
let driver = real
let recording: ClockControl | null = null
export const clock = {
  now: () => driver.now(),
  raf: (fn: FrameCallback) => driver.raf(fn),
  cancelRaf: (id: number) => driver.cancelRaf(id),
  timeout: (fn: () => void, ms: number) => driver.timeout(fn, ms),
  clearTimeout: (id: number) => driver.clearTimeout(id),
  layoutRaf: (fn: FrameCallback) => recording?.requestLayoutFrame(fn) ?? driver.raf(fn),
  cancelLayoutRaf: (id: number) => (recording ? recording.cancelLayoutFrame(id) : driver.cancelRaf(id)),
  get recording() {
    return recording
  },
}
export interface ClockControl {
  readonly fps: number
  readonly frame: number
  now(): number
  step(frames?: number): Promise<void>
  advance(milliseconds: number): Promise<void>
  settle(): Promise<void>
  requestLayoutFrame(callback: FrameCallback): number
  cancelLayoutFrame(id: number): void
  readonly layoutPending: boolean
  flushLayout(): Promise<void>
  /** Stop mounted scenes before restoring. Unlike the web clock, native globals are untouched. */
  restore(): void
}
export function installVirtualClock(
  opts: { fps?: number; epoch?: number; onLayout?: () => void | Promise<void> } = {},
): ClockControl {
  if (recording) return recording
  const fps = opts.fps ?? 60
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError('fps must be positive and finite')
  let now = 1000,
    frame = 0,
    id = 0,
    stepping = false,
    restored = false
  const timers = new Map<number, { at: number; fn: () => void }>()
  let frames = new Map<number, FrameCallback>()
  let layouts = new Map<number, FrameCallback>()
  const settle = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve()
  }
  const flushLayout = async () => {
    await settle()
    await opts.onLayout?.()
    const pending = layouts
    layouts = new Map()
    for (const fn of pending.values()) fn(now)
    await settle()
  }
  const advance = async (ms: number) => {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Clock advance must be finite and non-negative')
    if (restored) return
    if (stepping) throw new Error('Clock advances must be awaited sequentially')
    stepping = true
    try {
      const end = now + ms
      await settle()
      if (restored) return
      let runs = 0
      for (;;) {
        const next = [...timers]
          .filter(([, t]) => t.at <= end + 1e-6)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
        if (!next) break
        if (++runs > 10000) throw new Error('Virtual clock timer limit exceeded')
        timers.delete(next[0])
        now = next[1].at
        next[1].fn()
        await settle()
        if (restored) return
      }
      now = end
      await flushLayout()
      if (restored) return
      const pending = frames
      frames = new Map()
      frame++
      for (const fn of pending.values()) fn(now)
      await settle()
    } finally {
      stepping = false
    }
  }
  driver = {
    now: () => now,
    raf: (fn) => {
      frames.set(++id, fn)
      return id
    },
    cancelRaf: (key) => {
      frames.delete(key)
    },
    timeout: (fn, ms) => {
      timers.set(++id, { at: now + Math.max(0, ms), fn })
      return id
    },
    clearTimeout: (key) => {
      timers.delete(key)
    },
  }
  const control: ClockControl = {
    fps,
    get frame() {
      return frame
    },
    now: () => now,
    async step(n = 1) {
      if (!Number.isInteger(n) || n < 0) throw new RangeError('frames must be a non-negative integer')
      for (let i = 0; i < n && !restored; i++) await advance(1000 / fps)
    },
    advance,
    settle,
    flushLayout,
    requestLayoutFrame(fn) {
      layouts.set(++id, fn)
      return id
    },
    cancelLayoutFrame(key) {
      layouts.delete(key)
    },
    get layoutPending() {
      return layouts.size > 0
    },
    restore() {
      if (restored) return
      restored = true
      timers.clear()
      frames.clear()
      layouts.clear()
      driver = real
      recording = null
    },
  }
  recording = control
  return control
}
