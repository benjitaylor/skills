import type { Point } from './geometry'
export type Route = 'h' | 'v' | 'straight' | 'step' | 'curve'
// The S-curve's controls: level out of `a` and level into `b`, half way across
export function bend(a: Point, b: Point): [Point, Point] {
  const m = (a.x + b.x) / 2
  return [
    { x: m, y: a.y },
    { x: m, y: b.y },
  ]
}

export function corners(a: Point, b: Point, route: Route): Point[] {
  if (route === 'straight') return [a, b]
  if (route === 'curve') {
    // Sampled, so a label and the arrow follow the curve itself
    const [c1, c2] = bend(a, b)
    return Array.from({ length: 25 }, (_, i) => {
      const t = i / 24
      const u = 1 - t
      return {
        x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
      }
    })
  }
  if (route === 'step') {
    const m = (a.x + b.x) / 2
    return [a, { x: m, y: a.y }, { x: m, y: b.y }, b]
  }
  return route === 'h' ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b]
}

export function along(pts: Point[], f: number): Point {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y))
  let left = segs.reduce((n, s) => n + s, 0) * Math.max(0, Math.min(1, f))
  for (let i = 0; i < segs.length; i++) {
    if (left <= segs[i] || i === segs.length - 1) {
      const t = segs[i] ? Math.min(1, left / segs[i]) : 0
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }
    }
    left -= segs[i]
  }
  return pts[0]
}

export function elbow(a: Point, b: Point, route: Route, r: number) {
  if (route === 'straight') return `M${a.x} ${a.y}L${b.x} ${b.y}`
  if (route === 'curve') {
    const [c1, c2] = bend(a, b)
    return `M${a.x} ${a.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`
  }
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (route === 'step') {
    const m = (a.x + b.x) / 2
    const k = Math.min(r, Math.abs(dx) / 2, Math.abs(dy) / 2)
    const sx = Math.sign(dx) || 1
    const sy = Math.sign(dy) || 1
    if (!k) return `M${a.x} ${a.y}H${m}V${b.y}H${b.x}`
    return `M${a.x} ${a.y}H${m - sx * k}Q${m} ${a.y} ${m} ${a.y + sy * k}V${b.y - sy * k}Q${m} ${b.y} ${m + sx * k} ${b.y}H${b.x}`
  }
  const k = Math.min(r, Math.abs(dx), Math.abs(dy))
  const sx = Math.sign(dx) || 1
  const sy = Math.sign(dy) || 1
  if (route === 'h') {
    return `M${a.x} ${a.y}H${b.x - sx * k}Q${b.x} ${a.y} ${b.x} ${a.y + sy * k}V${b.y}`
  }
  return `M${a.x} ${a.y}V${b.y - sy * k}Q${a.x} ${b.y} ${a.x + sx * k} ${b.y}H${b.x}`
}
