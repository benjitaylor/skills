export interface ChartGeometry {
  data: number[]
  kind?: 'line' | 'bars'
  width: number
  height: number
  dot?: boolean
  max?: number
}
export function chartPoints({ data, kind = 'line', width, height, dot = true, max }: ChartGeometry) {
  const top = max ?? Math.max(...data, 1)
  const pad = kind === 'line' && dot ? 4 : 1
  const h = height - pad * 2
  if (kind === 'bars') {
    const gap = Math.max(2, Math.round(width / data.length / 4))
    const bw = (width - gap * (data.length - 1)) / data.length
    return data.map((v, i) => ({ x: i * (bw + gap) + bw / 2, y: height - Math.max(2, (v / top) * h) }))
  }
  return data.map((v, i) => ({
    x: pad + (i / Math.max(1, data.length - 1)) * (width - pad * 2),
    y: pad + h - (v / top) * h,
  }))
}

/** A smooth path through the points (Catmull-Rom as cubic Béziers), never overshooting the ends. */
export function smooth(p: { x: number; y: number }[]) {
  if (!p.length) return ''
  let d = `M${p[0].x} ${p[0].y}`
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]
    const b = p[i]
    const c = p[i + 1]
    const e = p[i + 2] ?? c
    d += `C${b.x + (c.x - a.x) / 6} ${b.y + (c.y - a.y) / 6} ${c.x - (e.x - b.x) / 6} ${c.y - (e.y - b.y) / 6} ${c.x} ${c.y}`
  }
  return d
}

/**
 * The same curve as smooth(), sampled at a fixed number of points. A path
 * only eases into another with the same commands, so a line drawn from 8
 * points and one from 9 would swap in a frame while the dot traveled.
 * Sampling keeps every line the same shape of path, whatever the data's length.
 */
const SAMPLES = 48

/** The draw-in's timing: the same curve the rest of the kit's travel uses. */
const DRAW_MS = 1200
function ease(t: number) {
  // cubic-bezier(0.45, 0, 0.2, 1), solved for x by bisection
  const b = (a: number, c: number, u: number) => 3 * a * u * (1 - u) ** 2 + 3 * c * u * u * (1 - u) + u ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2
    if (b(0.45, 0.2, m) < t) lo = m
    else hi = m
  }
  return b(0, 1, (lo + hi) / 2)
}

/** The curve's height at x, from its sampled points. */
export function yAt(p: { x: number; y: number }[], x: number) {
  let i = 1
  while (i < p.length - 1 && p[i].x < x) i++
  const a = p[i - 1]
  const c = p[i]
  const t = c.x === a.x ? 0 : Math.max(0, Math.min(1, (x - a.x) / (c.x - a.x)))
  return a.y + (c.y - a.y) * t
}

export function resample(p: { x: number; y: number }[]) {
  if (p.length < 2) return p
  const out: { x: number; y: number }[] = []
  for (let s = 0; s <= SAMPLES; s++) {
    const u = (s / SAMPLES) * (p.length - 1)
    const i = Math.min(Math.floor(u), p.length - 2)
    const t = u - i
    const a = p[i - 1] ?? p[i]
    const b = p[i]
    const c = p[i + 1]
    const e = p[i + 2] ?? c
    // The Bézier segment smooth() draws between b and c
    const c1 = { x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 }
    const c2 = { x: c.x - (e.x - b.x) / 6, y: c.y - (e.y - b.y) / 6 }
    const m = 1 - t
    const k = (p0: number, p1: number, p2: number, p3: number) =>
      m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3
    out.push({ x: k(b.x, c1.x, c2.x, c.x), y: k(b.y, c1.y, c2.y, c.y) })
  }
  return out
}
