import { clock } from './clock'
import type { Point, Rect, Target } from './geometry'
import type { Layout } from './look'
import { capsOf, type CursorKind, type Keys } from './cursor-types'
import type { Registry } from './registry'
import { bezier } from './ease'
import { warn } from './dev'

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
  /** The stage draws a cursor: scroll moves it into the area first. */
  cursor?: boolean
  /** What the cursor shows over unmarked areas once the scene marks any. Pointer by default. */
  base?: CursorKind
  /** A finger mid-swipe: the dot stays down and the trail shows. */
  swiping?(on: boolean): void
  /** The swipe trail behind the finger: length in px, heading in radians. */
  streak?(length: number, angle: number): void
  /** Set to the act's kind-from-what's-under-it, so the stage can re-read it after a commit. */
  auto?: { current: ((at: Point) => void) | null }
  /** True while a drag owns the cursor's kind. */
  dragging?: { current: boolean }
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
// Uneven but repeatable rhythm, so every loop types the same way
const hash = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
// Gathers speed over the first quarter, then one speed to the lift, still moving when it
// leaves so the throw carries straight on
const fingerEase = (t: number) => {
  const a = 0.25,
    k = 1 / (1 - a / 2)
  return t < a ? ((t * t) / (2 * a)) * k : (t - a / 2) * k
}
// Keystroke rows outlive their act; ids must never repeat across runs or stages.
let keySerial = 0

export function createAct<S>(signal: AbortSignal, env: ActEnv<S>): Act<S> {
  const { registry } = env
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
  // Release transient state synchronously on abort, so a later finally can't clear a new run's.
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
  const unwrap = (t: Target): Exclude<Target, { wide: Target }> =>
    typeof t === 'object' && 'wide' in t ? unwrap(t[env.layout]) : t
  const nameOf = (t: Target) => {
    const u = unwrap(t)
    return typeof u === 'string' ? u : 'at' in u ? u.at : undefined
  }
  const resolve = (t: Target) => registry.resolve(t, env.layout)
  // Only a named target needs fresh geometry; a point or a state change doesn't wait on the
  // native measurement, so its beat lands on the same frame as web's.
  const measured = async (t: Target) => {
    if (nameOf(t) === undefined) return
    await registry.measure()
    check()
  }

  // Kind from what's under the cursor, as a real one works. A scene that never marks
  // anything keeps the script's kind; one that did falls back to the base once its marked
  // targets are gone, so a hand doesn't outlive the thing it was over.
  let autoUsed = false
  const base = env.base ?? 'pointer'
  const auto = (p: Point) => {
    const marked = [...registry.entries.values()].some((entry) => entry.cursor)
    if (!marked && !autoUsed) return
    if (marked) autoUsed = true
    let id = registry.hit(p),
      kind: CursorKind | undefined
    while (id && !kind) {
      const entry = registry.entries.get(id)
      kind = entry?.cursor
      id = entry?.parent
    }
    const next = kind ?? base
    if (env.kind.current !== next) {
      env.kind.current = next
      env.setKind(next)
    }
  }
  if (env.auto) env.auto.current = auto
  // A run starts in the kind of what the cursor rests on, so a loop's first frame matches its last
  if (!env.dragging?.current) auto(env.position.current)
  const place = (p: Point, kind = true) => {
    env.position.current = p
    env.place(p)
    if (kind) auto(p)
  }

  // Hover is the target and every target around it, as in a browser: a row stays hovered
  // while the cursor is on a button inside it. It changes only where web's does: as a move
  // starts and ends, and as a drag or an entrance begins.
  let hovered: string | undefined
  const chain = (name?: string) => {
    const out: string[] = []
    for (let id = name; id && !out.includes(id); id = registry.entries.get(id)?.parent) out.push(id)
    return out
  }
  const hover = (name?: string) => {
    if (hovered === name) return
    registry.hover(name)
    hovered = name
  }

  // The touch dot lingers a beat after a lift, then goes
  let lift = 0
  signal.addEventListener('abort', () => clock.clearTimeout(lift), { once: true })
  const touch = () => {
    clock.clearTimeout(lift)
    env.touching(true)
  }
  const fingerGone = () => {
    clock.clearTimeout(lift)
    if (signal.aborted) env.touching(false)
    else lift = clock.timeout(() => env.touching(false), 240)
  }

  let latestKey = 0,
    carets = 0
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
      // The scene changed under a still pointer: re-read what is under it now
      auto(env.position.current)
      check()
    },
    async wait(ms) {
      check()
      await wait(ms)
      // Whatever slid or scaled into place has landed by now: refresh the rects the scene
      // places from, without holding the next beat.
      void registry.measure()
    },
    rect: (name, opts) => {
      if (!registry.entries.has(name)) warn(`no target named "${name}"`)
      return registry.rect(name, opts?.layout)
    },
    center: (name) => resolve(name),
    caret: (name, at) => {
      carets++
      return registry.caret(name, at)
    },
    async move(to, opts) {
      check()
      await measured(to)
      const name = nameOf(to)
      const from = { ...env.position.current },
        end = resolve(to)
      const distance = Math.hypot(end.x - from.x, end.y - from.y)
      if (distance < 0.5) return hover(name)
      // Leave hover only on what the cursor actually leaves: moving from a row onto a button
      // inside it keeps the row hovered all the way
      const dest = chain(name)
      hover(chain(hovered).find((n) => dest.includes(n)))
      // A hand travels in a shallow arc, quicker over short hops
      const bow = Math.min(distance * 0.08, 24),
        nx = -(end.y - from.y) / distance,
        ny = (end.x - from.x) / distance
      await tween(opts?.duration ?? clamp(260 + distance * 0.9, 300, 650), (t) => {
        const e = ease(t),
          lift = Math.sin(Math.PI * e) * bow
        const p = opts?.path?.(e, from, end) ?? {
          x: from.x + (end.x - from.x) * e + nx * lift,
          y: from.y + (end.y - from.y) * e + ny * lift,
        }
        // What follows the pointer first, so the stage moves both in one commit
        opts?.onMove?.(p, from, t)
        place(p)
      })
      check()
      hover(name)
    },
    async click(to, opts) {
      check()
      if (to !== undefined) {
        await a.move(to)
        await wait(120)
      }
      check()
      // A click presses its target, or what the cursor already hovers; a bare point presses nothing
      const name = to !== undefined ? nameOf(to) : hovered
      const finger = env.touch
      const release = own(() => {
        env.press(false)
        if (name) registry.update(name, { pressed: false })
        if (finger) fingerGone()
      })
      try {
        // A finger is only there when it touches: it shows just before, and goes after it lifts
        if (finger) {
          touch()
          await wait(140)
        }
        for (let i = 0; i < (opts?.double ? 2 : 1); i++) {
          if (i) await wait(70)
          check()
          env.press(true)
          env.ripple(env.position.current)
          if (name) registry.update(name, { pressed: opts?.right ? 'right' : 'primary' })
          await wait(opts?.double ? 80 : 100)
          check()
          env.press(false)
          if (name) registry.update(name, { pressed: false })
        }
      } finally {
        release()
      }
    },
    async scroll(name, to, opts) {
      check()
      const entry = registry.entries.get(name)
      if (!entry?.scroll) return
      if (env.cursor || typeof to === 'string') {
        await registry.measure()
        check()
      }
      const scrolling = entry.scroll,
        start = scrolling.offset
      let end = typeof to === 'number' ? to : start
      if (typeof to === 'string' && registry.entries.has(to))
        end = start + registry.rect(to).y - entry.rect.y - (opts?.offset ?? 0)
      end = clamp(end, 0, scrolling.max)
      // You can only scroll what the pointer is over: a cursor outside the area moves into
      // it first, then holds still while the content moves under it
      if (env.cursor) {
        const box = entry.rect,
          p = env.position.current
        const inside =
          p.x >= box.x + 8 && p.x <= box.x + box.width - 8 && p.y >= box.y + 8 && p.y <= box.y + box.height - 8
        if (!inside) {
          await a.move({ x: box.x + box.width * 0.6, y: box.y + box.height * 0.55 })
          await a.wait(120)
        }
      }
      registry.update(name, { scrolling: true })
      const release = own(() => registry.update(name, { scrolling: false }))
      try {
        await tween(opts?.duration ?? clamp(420 + Math.abs(end - start) * 1.2, 500, 1400), (t) => {
          scrolling.offset = start + (end - start) * ease(t)
          scrolling.set(scrolling.offset)
        })
        check()
      } finally {
        release()
      }
      // The content moved under the cursor: re-read it once measured, without holding the next beat
      void registry.measure().then(() => {
        if (!signal.aborted) auto(env.position.current)
      })
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
        a.put(patch)
        await frame()
        await frame()
        check()
      } finally {
        release()
      }
    },
    async key(combo) {
      check()
      const caps = capsOf(combo),
        id = ++keySerial
      latestKey = id
      const hide = own(() => {
        if (latestKey === id) env.keys({ id, caps, show: false, down: false })
      })
      // Mounted hidden, shown two frames later, so the row always fades up
      env.keys({ id, caps, show: false, down: false })
      await frame()
      await frame()
      check()
      env.keys({ id, caps, show: true, down: false })
      await wait(180)
      check()
      env.keys({ id, caps, show: true, down: true })
      await wait(140)
      check()
      env.keys({ id, caps, show: true, down: false })
      // The caps linger and fade without holding up the script.
      void wait(600).then(hide, hide)
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
      const interval = opts?.interval ?? 35,
        chars = Array.from(text)
      for (let i = 0; i <= chars.length; i++) {
        check()
        a.put({ [key]: chars.slice(0, i).join('') } as Partial<S>)
        await wait(interval * (0.7 + 0.6 * hash(i)))
      }
    },
    async drag(to, onMove, opts) {
      check()
      await measured(to)
      const from = { ...env.position.current },
        end = resolve(to)
      const distance = Math.hypot(end.x - from.x, end.y - from.y)
      hover(undefined)
      // The hand closes only while the button is held: on press here, and back to what it was
      // on release. Over text (I-beam) or a canvas (crosshair) a drag selects, so it keeps its kind.
      const before = env.kind.current,
        selects = before === 'ibeam' || before === 'crosshair',
        closesHand = !selects && opts?.cursor !== 'preserve'
      // A finger swipes in one motion: it lands and is already moving. A mouse presses, then carries.
      const finger = env.touch
      if (finger) {
        touch()
        await wait(140)
        check()
      }
      // The trail: one streak from where the finger was a few frames ago to where it is now
      const trail: Point[] = []
      const drawTrail = (at: Point) => {
        trail.unshift({ ...at })
        if (trail.length > 9) trail.pop()
        const tail = trail[trail.length - 1],
          dx = at.x - tail.x,
          dy = at.y - tail.y
        env.streak?.(Math.min(Math.hypot(dx, dy), 100), Math.atan2(dy, dx))
      }
      if (env.dragging) env.dragging.current = true
      let closed = false
      const release = own(() => {
        if (env.dragging) env.dragging.current = false
        env.press(false)
        env.swiping?.(false)
        if (finger) fingerGone()
        // Cut short mid-carry: the hand opens again
        if (closed && signal.aborted) {
          const back = before === 'grab' ? 'pointer' : before
          env.kind.current = back
          env.setKind(back)
        }
      })
      try {
        // The press dips first and the hand closes at the bottom of it, so the change of
        // shape sits inside the press. A finger presses, seen as a press, and then swipes.
        env.press(true)
        await wait(finger ? 170 : 60)
        if (finger) {
          env.streak?.(0, 0)
          env.swiping?.(true)
        }
        check()
        if (closesHand && !finger) {
          closed = true
          env.kind.current = 'grab'
          env.setKind('grab')
        }
        if (!finger) await wait(70)
        check()
        env.press(false)
        // Carried in the same shallow arc as a move, a little flatter for the weight; a
        // selection is precise and runs straight, so the caret never leaves the text
        const bow = selects ? 0 : Math.min(distance * 0.06, 18),
          nx = distance ? -(end.y - from.y) / distance : 0,
          ny = distance ? (end.x - from.x) / distance : 0
        // A selection across lines drops into its last line first, then sweeps along it, as a
        // hand does. A straight diagonal runs back past the anchor on the first line.
        const lines = selects && Math.abs(end.y - from.y) > 6
        if (lines && end.y > from.y && end.x < from.x - 2)
          warn(
            'a text selection that ends left of where it starts overshoots and shrinks back; select text that starts a line, or fits on one',
          )
        const caretsBefore = carets
        // A flick is brief, about a quarter second; the throw does the rest
        const ms = finger
          ? (opts?.duration ?? clamp(180 + distance * 0.5, 240, 300))
          : (opts?.duration ?? clamp(360 + distance * 1.1, 450, 900))
        await tween(ms, (t) => {
          const e = finger ? fingerEase(t) : ease(t),
            lift = Math.sin(Math.PI * e) * bow
          // The drop: y arrives early, x mostly late (a curve through (from.x, end.y))
          const ey = lines ? 1 - (1 - e) * (1 - e) : e,
            ex = lines ? e * e : e
          const at = opts?.path?.(e, from, end) ?? {
            x: from.x + (end.x - from.x) * ex + nx * lift,
            y: from.y + (end.y - from.y) * ey + ny * lift,
          }
          // The cursor and whatever follows it (a card, a selection) paint in the same commit
          onMove?.(at, from, t)
          place(at, false)
          if (finger) drawTrail(at)
        })
        // A selection grown by time or a word count drifts off the I-beam.
        if (selects && onMove && carets === caretsBefore)
          warn(
            'selection drift: a text selection drag never read a.caret(), so the highlight is not under the I-beam; set it from a.caret(name, at) in onMove',
          )
        check()
        if (closed) {
          const back = before === 'grab' ? 'pointer' : before
          env.kind.current = back
          env.setKind(back)
        }
      } finally {
        release()
      }
      // What's under the cursor now decides (the thing it was over may have moved or gone)
      auto(end)
    },
    place(to) {
      if (signal.aborted) return
      place(resolve(to))
    },
    async enter(to, opts) {
      check()
      await measured(to)
      const end = resolve(to),
        w = env.width,
        h = env.height
      // Out past the edge nearest the target, far enough that the hand is hidden, and in on a
      // slight diagonal
      const out = 40,
        gaps = [end.x, w - end.x, end.y, h - end.y],
        side = gaps.indexOf(Math.min(...gaps))
      const from =
        side === 0
          ? { x: -out, y: end.y + h * 0.12 }
          : side === 1
            ? { x: w + out * 0.4, y: end.y + h * 0.12 }
            : side === 2
              ? { x: end.x - w * 0.06, y: -out }
              : { x: end.x + w * 0.06, y: h + out * 0.4 }
      const curve = bezier('enter')
      place(from, false)
      hover(undefined)
      await tween(opts?.duration ?? 700, (t) => {
        const p = curve(t)
        place({ x: from.x + (end.x - from.x) * p, y: from.y + (end.y - from.y) * p })
      })
      check()
      hover(nameOf(to))
    },
  }
  // A beat started without await (a move alongside other beats) rejects with Stopped when the
  // stage stops; that is expected and must not surface as an unhandled rejection. Any other
  // error is reported here, since nobody may be awaiting it. Awaited calls still see it.
  const out = { ...a }
  for (const k of Object.keys(a) as (keyof Act<S>)[]) {
    const fn = a[k]
    if (typeof fn !== 'function') continue
    ;(out as unknown as Record<string, unknown>)[k] = (...args: unknown[]) => {
      const result = (fn as (...x: unknown[]) => unknown).apply(a, args)
      if (result instanceof Promise)
        result.catch((e) => {
          if (!(e instanceof Stopped)) console.error('[stageshow-native] script error', e)
        })
      return result
    }
  }
  return out
}

// A loop that doesn't end where it began jumps on every repeat.
export function checkSeam(end: object, initial: object, at: Point, rest: Point | null) {
  const changed = Object.keys(initial).filter(
    (k) =>
      JSON.stringify((end as Record<string, unknown>)[k]) !== JSON.stringify((initial as Record<string, unknown>)[k]),
  )
  if (changed.length)
    warn(`loop seam: state still differs from initial at the end of the script (${changed.join(', ')})`)
  if (rest && Math.hypot(at.x - rest.x, at.y - rest.y) > 1) warn('loop seam: cursor does not end where it starts')
}
