import { EMPTY, type Point, type Rect, type Target } from './geometry'
import type { Layout } from './look'
import type { CursorKind } from './cursor-types'

export interface CaretLine {
  x: number
  y: number
  width: number
  height: number
  text: string
  offset: number
  stops?: number[]
}
export interface Entry {
  rect: Rect
  layout: Rect
  parent?: string
  cursor?: CursorKind
  hidden?: boolean
  clips?: boolean
  order: number
  measure?(): Promise<void>
  scroll?: { offset: number; max: number; set(value: number): void }
  lines?: CaretLine[]
}
export interface Interaction {
  hover: boolean
  pressed: false | 'primary' | 'right'
  scrolling: boolean
}
const IDLE: Interaction = Object.freeze({ hover: false, pressed: false, scrolling: false })
export class Registry {
  entries = new Map<string, Entry>()
  private interactions = new Map<string, Interaction>()
  private listeners = new Set<() => void>()
  version = 0
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  notify = () => {
    this.version++
    this.listeners.forEach((fn) => fn())
  }
  interaction = (name?: string) => (name ? (this.interactions.get(name) ?? IDLE) : IDLE)
  update(name: string, patch: Partial<Interaction>) {
    const before = this.interaction(name),
      next = { ...before, ...patch }
    if (before.hover === next.hover && before.pressed === next.pressed && before.scrolling === next.scrolling) return
    this.interactions.set(name, next)
    this.notify()
  }
  rect(name: string, layout = false): Rect {
    return this.entries.get(name)?.[layout ? 'layout' : 'rect'] ?? EMPTY
  }
  resolve(target: Target, layout: Layout): Point {
    if (typeof target !== 'string' && 'wide' in target) return this.resolve(target[layout], layout)
    if (typeof target !== 'string' && !('at' in target)) return target
    const name = typeof target === 'string' ? target : target.at
    const entry = this.entries.get(name)
    if (!entry) throw new Error(`Stageshow target is not mounted: ${name}`)
    const r = entry.rect
    const f = typeof target === 'string' ? { x: 0.5, y: 0.5 } : target
    return { x: r.x + r.width * f.x, y: r.y + r.height * f.y }
  }
  hit(point: Point): string | undefined {
    const inside = (r: Rect) =>
      r.width > 0 &&
      r.height > 0 &&
      point.x >= r.x &&
      point.x <= r.x + r.width &&
      point.y >= r.y &&
      point.y <= r.y + r.height
    return [...this.entries]
      .filter(([, e]) => {
        if (e.hidden || !inside(e.rect)) return false
        const seen = new Set<string>()
        for (let id = e.parent; id && !seen.has(id); ) {
          seen.add(id)
          const parent = this.entries.get(id)
          if (parent?.hidden || (parent?.clips && !inside(parent.rect))) return false
          id = parent?.parent
        }
        return true
      })
      .sort((a, b) => b[1].order - a[1].order)[0]?.[0]
  }
  hover(name?: string) {
    const chain = new Set<string>()
    for (let id = name; id && !chain.has(id); id = this.entries.get(id)?.parent) chain.add(id)
    for (const id of this.entries.keys()) this.update(id, { hover: chain.has(id) })
  }
  async measure() {
    await Promise.all([...this.entries.values()].map((entry) => entry.measure?.()))
  }
  reset() {
    this.interactions.clear()
    for (const entry of this.entries.values())
      if (entry.scroll) {
        entry.scroll.set(0)
        entry.scroll.offset = 0
      }
    this.notify()
  }
  caret(name: string, point: Point) {
    const entry = this.entries.get(name),
      lines = entry?.lines
    if (!entry || !lines?.length) return 0
    const sx = entry.rect.width / (entry.layout.width || entry.rect.width) || 1,
      sy = entry.rect.height / (entry.layout.height || entry.rect.height) || 1
    const x = (point.x - entry.rect.x) / sx,
      y = (point.y - entry.rect.y) / sy
    if (y < lines[0].y) return 0
    const last = lines[lines.length - 1]
    if (y > last.y + last.height) return last.offset + last.text.length
    const line = lines.reduce((a, b) => (Math.abs(a.y + a.height / 2 - y) < Math.abs(b.y + b.height / 2 - y) ? a : b))
    const stops =
      line.stops ??
      Array.from({ length: line.text.length + 1 }, (_, i) => (i / Math.max(1, line.text.length)) * line.width)
    let index = 0
    for (let i = 1; i < stops.length; i++)
      if (Math.abs(stops[i] + line.x - x) < Math.abs(stops[index] + line.x - x)) index = i
    return line.offset + index
  }
}
