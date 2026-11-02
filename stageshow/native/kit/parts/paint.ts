// Colour math for porting the web kit's CSS: transitions between colours, and
// the mono palette's grayscale filter. Hex, rgb() and rgba() strings (and the
// keywords the kit uses); anything else passes through untouched.

export type RGBA = [number, number, number, number]

const KEYWORDS: Record<string, RGBA> = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
}

export function parseColor(color: string): RGBA | null {
  const c = color.trim().toLowerCase()
  if (KEYWORDS[c]) return [...KEYWORDS[c]]
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.exec(c)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((h) => h + h).join('') : hex
    const [r, g, b, a = 255] = (full.match(/../g) ?? []).map((h) => parseInt(h, 16))
    return [r, g, b, a / 255]
  }
  const args = /^rgba?\(([^)]*)\)$/.exec(c)?.[1]
  if (!args) return null
  const parts = args
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((p, i) => (p.endsWith('%') ? (parseFloat(p) / 100) * (i < 3 ? 255 : 1) : parseFloat(p)))
  if (parts.length < 3 || !parts.every(Number.isFinite)) return null
  return [parts[0], parts[1], parts[2], parts[3] ?? 1]
}

export const formatColor = ([r, g, b, a]: RGBA) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.round(a * 1e4) / 1e4})`

/**
 * CSS colour interpolation, which is premultiplied: a fade from transparent
 * keeps the colour's own hue the whole way instead of passing through black.
 */
export function mixColor(from: string, to: string, t: number) {
  const a = parseColor(from),
    b = parseColor(to)
  if (!a || !b) return t < 1 ? from : to
  const alpha = a[3] + (b[3] - a[3]) * t
  if (alpha <= 0) return formatColor([b[0], b[1], b[2], 0])
  const channel = (i: number) => (a[i] * a[3] * (1 - t) + b[i] * b[3] * t) / alpha
  return formatColor([channel(0), channel(1), channel(2), alpha])
}

/** The colour at zero alpha: where a CSS fade from transparent starts, so its hue holds as it fades. */
export function clear(color: string) {
  const c = parseColor(color)
  return c ? formatColor([c[0], c[1], c[2], 0]) : 'transparent'
}

/** CSS `grayscale(1)`: Rec. 709 luma of the sRGB channels, alpha kept. */
export function greyscale(color: string) {
  const c = parseColor(color)
  if (!c) return color
  const y = Math.round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
  if (color.trim().startsWith('#') && c[3] === 1) return `#${y.toString(16).padStart(2, '0').repeat(3)}`
  return formatColor([y, y, y, c[3]])
}

// Paint values only: attributes and style declarations, never url(#id) or href="#id" references.
const PAINT =
  /((?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*(?:=\s*["']|:\s*))(#[\da-f]{3,8}\b|rgba?\([^)]*\))/gi

/**
 * Bundled marks are SVG markup, so the mono palette's `img { filter: grayscale(1) }`
 * is applied by rewriting their paints, which works on every platform.
 */
export const greyscaleXml = (xml: string) =>
  xml.replace(PAINT, (_, prefix: string, paint: string) => prefix + greyscale(paint))
