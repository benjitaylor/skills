import { clock } from './clock'
import type { Point, Rect, Target } from './geometry'
import type { Layout } from './look'
import { capsOf, type CursorKind, type Keys } from './cursor-types'
import type { Registry } from './registry'
import { bezier } from './ease'

type Patch<S> = Partial<S> | ((state: S) => Partial<S>)
type MoveOptions = {
  duration?: number
  path?: (progress: number, from: Point, to: Point) => Point
  onMove?: (at: Point, from: Point, t: number) => void
}
export interface Act<S> {
  set(patch: Patch<S>): Promise<void>
  put(patch: Patch<S>): void
  wait(ms: number): Promise<void>
  rect(name: string, opts?: { layout?: boolean }): Rect
  caret(name: string, at: Point): number
  center(name: string): Point
  move(to: Target, opts?: MoveOptions): Promise<void>
  click(to?: Target, opts?: { double?: boolean; right?: boolean }): Promise<void>
  scroll(name: string, to: number | string, opts?: { duration?: number; offset?: number }): Promise<void>
  cursor(kind: CursorKind): Promise<void>
  snap(patch: Patch<S>, scope?: string): Promise<void>
  key(combo: string): Promise<void>
  stagger<T>(items: T[], fn: (item: T, i: number) => Promise<void> | void, gap?: number): Promise<void>
  mark(name: string): void
  type(key: keyof S, text: string, opts?: { interval?: number }): Promise<void>
  drag(
    to: Target,
    onMove?: MoveOptions['onMove'],
    opts?: Omit<MoveOptions, 'onMove'> & { cursor?: 'preserve' },
  ): Promise<void>
  place(to: Target): void
  enter(to: Target, opts?: { duration?: number }): Promise<void>
  readonly signal: AbortSignal
  readonly layout: Layout
}
export type Script<S> = (act: Act<S>) => Promise<void>
export class Stopped extends Error {}
export interface ActEnv<S> {
  registry: Registry
  layout: Layout
  speed: number
  width: number
  height: number
  position: { current: Point }
  kind: { current: CursorKind }
  setState(patch: Patch<S>): void
  place(point: Point): void
  setKind(kind: CursorKind): void
  press(down: boolean): void
  touching(down: boolean): void
  ripple(point: Point): void
  keys(value: Keys): void
  instant(value: boolean, scope?: string): void
  mark(name: string): void
  touch: boolean
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

export function createAct<S>(signal: AbortSignal, env: ActEnv<S>): Act<S> {
  const check = () => {
    if (signal.aborted) throw new Stopped()
  }
  const pause = (schedule: (done: () => void) => number, cancel: (id: number) => void) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Stopped())
        return
      }
      const abort = () => {
        cancel(id)
        signal.removeEventListener('abort', abort)
        reject(new Stopped())
      }
      const id = schedule(() => {
        signal.removeEventListener('abort', abort)
        signal.aborted ? reject(new Stopped()) : resolve()
      })
      signal.addEventListener('abort', abort, { once: true })
    })
  const frame = () => pause((done) => clock.raf(done), clock.cancelRaf)
  const wait = (ms: number) => pause((done) => clock.timeout(done, Math.max(0, ms) / env.speed), clock.clearTimeout)
  const tween = async (ms: number, fn: (t: number) => void) => {
    check()
    if (ms <= 0) {
      fn(1)
      return
    }
    const start = clock.now()
    for (;;) {
      check()
      const t = clamp((clock.now() - start) / (ms / env.speed), 0, 1)
      fn(t)
      if (t === 1) return
      await frame()
    }
  }
  const own = (release: () => void) => {
    let live = true
    const done = () => {
      if (!live) return
      live = false
      signal.removeEventListener('abort', done)
      release()
    }
    signal.addEventListener('abort', done, { once: true })
    return done
  }
  let autoUsed = false
  const baseKind = env.kind.current
  const place = (p: Point, auto = true) => {
    env.position.current = p
    env.place(p)
    const name = env.registry.hit(p)
    env.registry.hover(name)
    if (auto) {
      const marked = [...env.registry.entries.values()].some((entry) => entry.cursor)
      if (!marked && !autoUsed) return
      if (marked) autoUsed = true
      let id: string | undefined = name,
        kind: CursorKind | undefined
      while (id && !kind) {
        const entry = env.registry.entries.get(id)
        kind = entry?.cursor
        id = entry?.parent
      }
      const next = kind ?? baseKind
      if (env.kind.current !== next) {
        env.kind.current = next
        env.setKind(next)
      }
    }
  }
  let keyId = 0
  const a: Act<S> = {
    signal,
    layout: env.layout,
    put(patch) {
      if (!signal.aborted) env.setState(patch)
    },
    async set(patch) {
      check()
      a.put(patch)
      await frame()
      await frame()
      await env.registry.measure()
      check()
      place(env.position.current)
    },
    wait,
    rect: (name, opts) => env.registry.rect(name, opts?.layout),
    center: (name) => env.registry.resolve(name, env.layout),
    caret: (name, at) => env.registry.caret(name, at),
    async move(to, opts) {
      check()
      await env.registry.measure()
      check()
      const from = { ...env.position.current },
        end = env.registry.resolve(to, env.layout)
      const distance = Math.hypot(end.x - from.x, end.y - from.y)
      if (distance < 0.5) {
        place(end)
        return
      }
      await tween(opts?.duration ?? clamp(260 + distance * 0.9, 300, 650), (t) => {
        const progress = ease(t),
          lift = Math.sin(Math.PI * progress) * Math.min(distance * 0.08, 24)
        const p = opts?.path?.(progress, from, end) ?? {
          x: from.x + (end.x - from.x) * progress - ((end.y - from.y) / distance) * lift,
          y: from.y + (end.y - from.y) * progress + ((end.x - from.x) / distance) * lift,
        }
        place(p)
        opts?.onMove?.(p, from, t)
      })
    },
    async click(to, opts) {
      check()
      if (to !== undefined) {
        await a.move(to)
        await wait(120)
      }
      check()
      const name = env.registry.hit(env.position.current)
      const release = own(() => {
        env.press(false)
        env.touching(false)
        if (name) env.registry.update(name, { pressed: false })
      })
      try {
        if (env.touch) {
          env.touching(true)
          await wait(140)
        }
        for (let i = 0; i < (opts?.double ? 2 : 1); i++) {
          if (i) await wait(70)
          check()
          env.press(true)
          env.ripple(env.position.current)
          if (name) env.registry.update(name, { pressed: opts?.right ? 'right' : 'primary' })
          await wait(opts?.double ? 80 : 100)
          check()
          env.press(false)
          if (name) env.registry.update(name, { pressed: false })
        }
      } finally {
        release()
      }
    },
    async scroll(name, to, opts) {
      check()
      await env.registry.measure()
      check()
      const entry = env.registry.entries.get(name)
      if (!entry?.scroll) throw new Error(`Stageshow scroll target is not mounted: ${name}`)
      if (!env.registry.interaction(name).hover) await a.move(name)
      check()
      const scrolling = entry.scroll,
        start = scrolling.offset
      const end = clamp(
        typeof to === 'number' ? to : start + a.rect(to).y - entry.rect.y - (opts?.offset ?? 0),
        0,
        scrolling.max,
      )
      env.registry.update(name, { scrolling: true })
      const release = own(() => env.registry.update(name, { scrolling: false }))
      try {
        await tween(opts?.duration ?? clamp(420 + Math.abs(end - start) * 1.2, 500, 1400), (t) => {
          scrolling.offset = start + (end - start) * ease(t)
          scrolling.set(scrolling.offset)
        })
        await env.registry.measure()
        check()
      } finally {
        release()
      }
    },
    async cursor(kind) {
      check()
      env.kind.current = kind
      env.setKind(kind)
      await frame()
    },
    async snap(patch, scope) {
      check()
      env.instant(true, scope)
      const release = own(() => env.instant(false, scope))
      try {
        await a.set(patch)
      } finally {
        release()
      }
    },
    async key(combo) {
      check()
      const id = ++keyId,
        caps = capsOf(combo)
      const release = own(() => {
        if (keyId === id) env.keys({ id, caps, show: false, down: false })
      })
      env.keys({ id, caps, show: true, down: false })
      await wait(180)
      check()
      env.keys({ id, caps, show: true, down: true })
      await wait(140)
      check()
      env.keys({ id, caps, show: true, down: false })
      void wait(600).then(release, release)
    },
    async stagger(items, fn, gap = 60) {
      await Promise.all(
        items.map(async (item, i) => {
          if (i) await wait(gap * i)
          check()
          await fn(item, i)
        }),
      )
    },
    mark(name) {
      if (!signal.aborted) env.mark(name)
    },
    async type(key, text, opts) {
      let prefix = ''
      a.put({ [key]: prefix } as Partial<S>)
      for (const char of text) {
        check()
        prefix += char
        a.put({ [key]: prefix } as Partial<S>)
        const hash = Math.abs(Math.sin(prefix.length * 12.9898) * 43758.5453) % 1
        await wait((opts?.interval ?? 35) * (0.7 + 0.6 * hash))
      }
    },
    async drag(to, onMove, opts) {
      check()
      await env.registry.measure()
      check()
      const from = { ...env.position.current },
        end = env.registry.resolve(to, env.layout),
        kind = env.kind.current
      const name = env.registry.hit(from)
      const release = own(() => {
        env.press(false)
        env.touching(false)
        env.setKind(kind === 'grab' ? 'open' : kind)
        if (name) env.registry.update(name, { pressed: false })
      })
      try {
        env.touching(true)
        env.press(true)
        if (name) env.registry.update(name, { pressed: 'primary' })
        await wait(160)
        check()
        if (opts?.cursor !== 'preserve' && kind !== 'ibeam' && kind !== 'crosshair') env.setKind('grab')
        const distance = Math.hypot(end.x - from.x, end.y - from.y) || 1
        await tween(opts?.duration ?? clamp(650 + distance * 0.6, 700, 1400), (t) => {
          const progress = ease(t),
            lift = Math.sin(Math.PI * progress) * Math.min(distance * 0.08, 24)
          const p = opts?.path?.(progress, from, end) ?? {
            x: from.x + (end.x - from.x) * progress - ((end.y - from.y) / distance) * lift,
            y: from.y + (end.y - from.y) * progress + ((end.x - from.x) / distance) * lift,
          }
          place(p, false)
          onMove?.(p, from, t)
        })
        await wait(120)
      } finally {
        release()
      }
    },
    place(to) {
      check()
      place(env.registry.resolve(to, env.layout))
    },
    async enter(to, opts) {
      check()
      await env.registry.measure()
      check()
      const end = env.registry.resolve(to, env.layout)
      const edges = [
        { d: end.x, p: { x: -32, y: end.y } },
        { d: env.width - end.x, p: { x: env.width + 32, y: end.y } },
        { d: end.y, p: { x: end.x, y: -32 } },
        { d: env.height - end.y, p: { x: end.x, y: env.height + 32 } },
      ]
      const from = edges.sort((a, b) => a.d - b.d)[0].p,
        curve = bezier('enter')
      place(from)
      await tween(opts?.duration ?? 700, (t) => {
        const p = curve(t)
        place({ x: from.x + (end.x - from.x) * p, y: from.y + (end.y - from.y) * p })
      })
    },
  }
  return a
}
