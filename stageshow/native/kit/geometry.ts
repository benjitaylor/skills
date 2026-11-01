// Measuring: where things are, in stage pixels. Targets and rects for the
// script API, the drawn scale that turns screen pixels into stage pixels,
// and the rect helpers demos use to place overlays from measured targets.

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }
/**
 * A target is the name in an element's data-target (aimed at its center), a
 * named element with x and y as fractions of its box ({ at: 'apply', x: 0.8, y: 0.7 }),
 * or a point in stage pixels.
 */
export type Target = string | Point | { at: string; x: number; y: number } | { wide: Target; compact: Target }

export const EMPTY: Rect = { x: 0, y: 0, width: 0, height: 0 }

export const nameOf = (t: Target) => (typeof t === 'string' ? t : 'at' in t ? t.at : null)

/** Rect helpers for positioning overlays from measured targets. */
export const inset = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  width: r.width + by * 2,
  height: r.height + by * 2,
})
export const box = (r: Rect) => ({ left: r.x, top: r.y, width: r.width, height: r.height })
export const between = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(b.x - a.x),
  height: Math.abs(b.y - a.y),
})
export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height
