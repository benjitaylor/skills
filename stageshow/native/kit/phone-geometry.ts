export function superellipsePath(w: number, h: number, a: number, n: number) {
  const steps = 32
  const e = 2 / n
  const pts: string[] = []
  const corners: [number, number, number, number][] = [
    [w - a, a, 1, -1],
    [w - a, h - a, 1, 1],
    [a, h - a, -1, 1],
    [a, a, -1, -1],
  ]
  corners.forEach(([cx, cy, sx, sy], c) => {
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (Math.PI / 2)
      // Clockwise: top-right runs top to right, bottom-right right to bottom, and so on
      const u = c % 2 === 0 ? Math.sin(t) : Math.cos(t)
      const v = c % 2 === 0 ? Math.cos(t) : Math.sin(t)
      pts.push(`${(cx + sx * a * Math.pow(u, e)).toFixed(2)} ${(cy + sy * a * Math.pow(v, e)).toFixed(2)}`)
    }
  })
  return `M${pts.join('L')}Z`
}

/** The gradient line CSS draws for `linear-gradient(<angle>deg, …)` over a w × h box, in that
 * box's coordinates: through the centre, long enough that the corners land on 0% and 100%. */
export function gradientLine(angle: number, w: number, h: number) {
  const a = (angle * Math.PI) / 180,
    dx = Math.sin(a),
    dy = -Math.cos(a)
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
  return { x1: w / 2 - dx * half, y1: h / 2 - dy * half, x2: w / 2 + dx * half, y2: h / 2 + dy * half }
}
