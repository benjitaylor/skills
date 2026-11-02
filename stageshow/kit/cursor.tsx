import type { ReactNode, Ref } from 'react'
import { MacCrosshair, MacGrab, MacIbeam, MacOpenHand, MacPointer, MacPointingHand, MacResizeEW, MacResizeNESW, MacResizeNS, MacResizeNWSE, MacWait } from './cursors'
import { ARROW_HOTSPOT, HOTSPOT, type CursorKind, type CursorStyle } from './core'
import './cursor.css'

// The cursor a stage draws: the glyph for each kind, where its hotspot sits,
// the five styles, and the ripple a click can send out.

export type { CursorKind, CursorStyle } from './core'

const GLYPHS: Record<CursorKind, () => ReactNode> = {
  pointer: MacPointer,
  ibeam: MacIbeam,
  crosshair: MacCrosshair,
  hand: MacPointingHand,
  open: MacOpenHand,
  grab: MacGrab,
  wait: MacWait,
  'resize-ns': MacResizeNS,
  'resize-ew': MacResizeEW,
  'resize-nwse': MacResizeNWSE,
  'resize-nesw': MacResizeNESW,
}

function SolidArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="ss-cursor__arrow" aria-hidden>
      <path d="M4 3 18.5 9.6 11.8 11.8 9.6 18.5Z" />
    </svg>
  )
}

/** The cursor element. The stage moves it (a transform on cursorRef) and marks it pressed or idle. */
export function Cursor({ cursorRef, style = 'real', kind }: { cursorRef: Ref<HTMLDivElement>; style?: CursorStyle; kind: CursorKind }) {
  return (
    <div ref={cursorRef} className="ss-cursor" data-style={style} data-kind={kind} aria-hidden>
      {style === 'touch' && <span className="ss-cursor__streak" />}
      <div className="ss-cursor__press">
        {(style === 'circle' || style === 'touch') && <span className="ss-cursor__dot" />}
        {style !== 'circle' && style !== 'touch' && (Object.keys(GLYPHS) as CursorKind[]).map((k) => {
          const arrow = style === 'arrow'
          // The arrow style has two glyphs: the arrow, and the I-beam over text
          if (arrow && k !== 'pointer' && k !== 'ibeam') return null
          const Glyph = arrow && k === 'pointer' ? SolidArrow : GLYPHS[k]
          const hot = arrow && k === 'pointer' ? ARROW_HOTSPOT : HOTSPOT[k]
          const shown = arrow && kind !== 'ibeam' ? 'pointer' : kind
          return (
            <div
              key={k}
              className="ss-cursor__glyph"
              data-glyph={k}
              data-active={k === shown}
              style={{ marginLeft: -hot.x, marginTop: -hot.y, transformOrigin: `${hot.x}px ${hot.y}px` }}
            >
              <Glyph />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ripple } from './core'
