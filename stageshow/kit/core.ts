// The parts of the stage that belong to no UI framework: the look's names,
// the cursor's kinds and hotspots, the click ripple, and keycaps as data.
// act.ts, clock.ts, ease.ts, measure.ts, util.ts and this file import
// nothing from React, so another binding (kit-angular/) drives the same
// script API and draws with the same CSS.

import type { Point } from './measure'

/** glass: frosted, translucent surfaces over a soft color field. */
export type Theme = 'light' | 'dark' | 'blueprint' | 'glass'
export type Palette = 'accent' | 'mono'
/** minimal: no text, only shapes. standard: real text where it carries meaning. realistic: real text, logos and avatars everywhere. */
export type Fidelity = 'minimal' | 'standard' | 'realistic'
/** wide: the design size. compact: the smaller design used below `compact.below`. */
export type Layout = 'wide' | 'compact'

export type Look = { theme: Theme; palette: Palette; fidelity: Fidelity; layout: Layout }

/** pointer: the arrow. hand: the pointing hand, for links and buttons. open: the
 * open hand over something draggable. grab: the closed hand while it's held.
 * resize-ns, resize-ew: over an edge that drags. resize-nwse, resize-nesw:
 * over a corner (top-left or bottom-right, and top-right or bottom-left). */
export type CursorKind = 'pointer' | 'ibeam' | 'crosshair' | 'hand' | 'open' | 'grab' | 'wait' | 'resize-ns' | 'resize-ew' | 'resize-nwse' | 'resize-nesw'
/**
 * real: the macOS pointer. large: the same, 1.5x, for sites whose demos run
 * small. circle: the iPad's glass pointer, always showing. touch: a finger on
 * a phone, shown only where it touches (a soft dot that lands on press,
 * stays while a drag is held, and fades), invisible between taps. arrow: a
 * solid, rounded arrowhead, as illustrated product demos draw the pointer; it
 * stays an arrow over links and while dragging, and turns to an I-beam only
 * over text.
 */
export type CursorStyle = 'real' | 'large' | 'circle' | 'touch' | 'arrow'

export const CURSOR_KINDS: readonly CursorKind[] = ['pointer', 'ibeam', 'crosshair', 'hand', 'open', 'grab', 'wait', 'resize-ns', 'resize-ew', 'resize-nwse', 'resize-nesw']

// Where each glyph's hotspot sits inside its box, so the point is the click.
export const HOTSPOT: Record<CursorKind, Point> = {
  pointer: { x: 7.5, y: 5.25 },
  ibeam: { x: 5, y: 8 },
  crosshair: { x: 8.5, y: 8.5 },
  hand: { x: 9.75, y: 3.25 },
  open: { x: 11.7, y: 10.4 },
  grab: { x: 12, y: 12 },
  wait: { x: 8, y: 8 },
  'resize-ns': { x: 10.5, y: 10.5 },
  'resize-ew': { x: 10.5, y: 10.5 },
  'resize-nwse': { x: 10.5, y: 10.5 },
  'resize-nesw': { x: 10.5, y: 10.5 },
}

// The arrow style's pointer: one solid, rounded arrowhead, tip at the hotspot
export const ARROW_HOTSPOT: Point = { x: 4, y: 3 }

/** A ring that spreads from the click point and fades, drawn under the cursor. */
export function ripple(root: HTMLElement, at: Point) {
  const r = document.createElement('span')
  r.className = 'ss-ripple'
  r.style.left = `${at.x}px`
  r.style.top = `${at.y}px`
  root.appendChild(r)
  r.addEventListener('animationend', () => r.remove())
}

/** Where keycaps show. Give `{ wide, compact }` to place them per layout. */
export type KeysAt = 'bottom' | 'top' | 'bottom-left' | 'bottom-right'

// Each keystroke is its own row of caps, so one still fading out never
// changes or recenters when the next arrives
export type Keys = { id: number; caps: string[]; show: boolean; down: boolean }

const KEYCAPS: Record<string, string> = { cmd: '⌘', shift: '⇧', alt: '⌥', option: '⌥', ctrl: '⌃', enter: '↵', return: '↵', esc: 'esc', tab: '⇥', up: '↑', down: '↓', left: '←', right: '→', backspace: '⌫' }

/** 'cmd+k' as caps: ['⌘', 'K']. */
export const capsOf = (combo: string) => combo.split('+').map((k) => KEYCAPS[k.trim().toLowerCase()] ?? k.trim().toUpperCase())
