// Direction: right-to-left scenes. A stage with dir="rtl" sets dir and lang on
// its root, so the kit's logical CSS (inline-start, inline-end) mirrors on its
// own. This file holds what CSS can't do: digits, mirroring hand-placed
// points, and reading direction from an element. See references/rtl.md.

/** ltr: the default. rtl: Arabic, Hebrew, Persian, Urdu. */
export type Dir = 'ltr' | 'rtl'
/** latn: 0 1 2 3. arab: Eastern Arabic ٠ ١ ٢ ٣, with ٫ for the decimal point and ٬ for thousands. */
export type Digits = 'latn' | 'arab'

const EASTERN = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

/**
 * A string with its digits in the given system. Only the glyphs change: the
 * digits of one number keep their order (a phone number, a card number, 541),
 * since a number is always read most significant digit first.
 * Separators convert only between two digits, so "1,250.75" becomes
 * "١٬٢٥٠٫٧٥" while the comma in a sentence is left alone.
 */
export function toDigits(text: string, digits: Digits): string {
  if (digits === 'latn' || !/[0-9]/.test(text)) return text
  return text
    .replace(/(?<=[0-9])[.,](?=[0-9])/g, (s) => (s === '.' ? '٫' : '٬'))
    .replace(/[0-9]/g, (d) => EASTERN[+d])
}

/** A string with any Eastern Arabic digits and separators read back as Western, for parsing. */
export function toLatin(text: string): string {
  if (!/[٠-٩]/.test(text)) return text
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/٫/g, '.').replace(/٬/g, ',')
}

/** A number formatted for a scene: digits, grouping and the decimal mark of the system. */
export function formatNumber(n: number, digits: Digits, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(digits === 'arab' ? 'ar-SA-u-nu-arab' : 'en-US', opts).format(n)
}

type Pt = { x: number; y: number }
type Box = { x: number; y: number; width: number; height: number }

/**
 * A point dx in from a box's start edge and dy down from its top: its left
 * edge in ltr, its right edge in rtl. The way to aim at part of a measured
 * box (the third column of a row, a grip near the start) that holds in both
 * directions; `row.x + 176` only holds in ltr.
 */
export const fromStart = (r: Box, dx: number, dy: number, dir: Dir): Pt => ({ x: dir === 'rtl' ? r.x + r.width - dx : r.x + dx, y: r.y + dy })

/** A design-space point for a stage `width` wide, mirrored in rtl: a cursor's resting place, a spot off the canvas. */
export const mirror = (p: Pt, width: number, dir: Dir): Pt => (dir === 'rtl' ? { x: width - p.x, y: p.y } : p)

/**
 * A measured rect seen from the line's start, for a stage `width` wide: as
 * is in ltr, reflected in rtl. A scene with hand-built geometry (an SVG path
 * that wraps a margin, a junction placed past a column) computes in this
 * ltr-like space with its design numbers, then maps each x back with mirror()
 * or `mirrorX`, so one piece of geometry draws both directions.
 */
export const mirrorRect = <R extends Box>(r: R, width: number, dir: Dir): R => (dir === 'rtl' ? { ...r, x: width - r.x - r.width } : r)

/** An x in the same reflected space and back: width - x in rtl. */
export const mirrorX = (x: number, width: number, dir: Dir) => (dir === 'rtl' ? width - x : x)

/** +1 in ltr, -1 in rtl: the sign of "toward the end" on the x axis, for a hand-written slide or offset. */
export const sign = (dir: Dir) => (dir === 'rtl' ? -1 : 1)

/** Whether an element lays out right to left, read from the page rather than assumed. */
export const isRtl = (el: Element | null) => !!el && getComputedStyle(el).direction === 'rtl'

// Text that keeps Western digits in an Eastern-digit scene: code, terminals,
// URLs, and anything the scene marks data-digits="latn" (a card number shown
// as printed on the card, a version string).
const KEEP = '[data-digits="latn"], .ss-code, .ss-term, .ss-window__url, script, style'

/**
 * Converts the digits of every text node under root, and keeps converting as
 * the scene changes. A MutationObserver runs before the browser paints, so a
 * Latin digit is never drawn, and converting is idempotent, so its own edits
 * settle at once. React never reads text back from the DOM, so a re-render
 * writes Latin digits and this converts them again before the frame.
 * Returns the disconnect.
 */
export function watchDigits(root: HTMLElement, digits: Digits): () => void {
  if (digits === 'latn') return () => {}
  const convert = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? ''
      if (!/[0-9]/.test(text) || node.parentElement?.closest(KEEP)) return
      const next = toDigits(text, digits)
      if (next !== text) node.nodeValue = next
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE || (node as Element).closest(KEEP)) return
    const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) convert(n)
  }
  convert(root)
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') convert(r.target)
      else r.addedNodes.forEach(convert)
    }
  })
  mo.observe(root, { subtree: true, childList: true, characterData: true })
  return () => mo.disconnect()
}
