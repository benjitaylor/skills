import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core'
import { ARROW_HOTSPOT, CURSOR_KINDS, HOTSPOT, type CursorKind, type CursorStyle } from '../kit/core'
import type { Point } from '../kit/measure'
import { GRAB_EDGE, GRAB_FILL, OPEN_HAND, RESIZE_TIP } from './cursor-paths'

type Glyph = { kind: CursorKind; glyph: CursorKind | 'arrow'; hot: Point; turn: number }

const TURN: Partial<Record<CursorKind, number>> = { 'resize-ns': 0, 'resize-ew': 90, 'resize-nwse': -45, 'resize-nesw': 45 }

/**
 * The cursor element. The stage moves it (a transform on the host) and marks
 * it pressed or idle; this draws every glyph and shows the one for `kind`.
 */
@Component({
  selector: 'ss-cursor',
  templateUrl: './cursor.component.html',
  styleUrl: '../kit/cursor.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ss-cursor',
    'aria-hidden': 'true',
    '[attr.data-style]': 'cursorStyle()',
    '[attr.data-kind]': 'kind()',
  },
})
export class CursorComponent {
  readonly cursorStyle = input<CursorStyle>('real')
  readonly kind = input<CursorKind>('pointer')

  protected readonly OPEN_HAND = OPEN_HAND
  protected readonly GRAB_EDGE = GRAB_EDGE
  protected readonly GRAB_FILL = GRAB_FILL
  protected readonly RESIZE_TIP = RESIZE_TIP

  // The arrow style has two glyphs: the arrow, and the I-beam over text
  protected readonly glyphs = computed<Glyph[]>(() => {
    const style = this.cursorStyle()
    if (style === 'circle' || style === 'touch') return []
    const arrow = style === 'arrow'
    return CURSOR_KINDS.filter((k) => !arrow || k === 'pointer' || k === 'ibeam').map((k) => ({
      kind: k,
      glyph: arrow && k === 'pointer' ? 'arrow' : k,
      hot: arrow && k === 'pointer' ? ARROW_HOTSPOT : HOTSPOT[k],
      turn: TURN[k] ?? 0,
    }))
  })
  protected readonly shown = computed<CursorKind>(() => (this.cursorStyle() === 'arrow' && this.kind() !== 'ibeam' ? 'pointer' : this.kind()))
}
