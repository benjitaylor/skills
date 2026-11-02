import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core'
import { STAGESHOW, type Act } from '../../kit-angular'

// examples/cursor-resize in Angular: the same script, state and CSS, the
// scene as an <ng-template ssScene>. The resize cursors, on one selected
// frame. The cursor starts as the arrow and turns into the triangles the
// moment it crosses a handle: north-south on the bottom edge, east-west on
// the right edge, and the two diagonals on the corners. Each handle says its
// kind with data-cursor; the script only moves and drags, and every drag is
// undone by another, so the loop starts where it ends.

type S = { x: number; y: number; w: number; h: number; held: string | null }
const START: S = { x: 120, y: 70, w: 200, h: 140, held: null }

const pull = async (a: Act<S>, handle: string, dx: number, dy: number, apply: (s: S, mx: number, my: number) => Partial<S>) => {
  await a.move(handle)
  const from = a.center(handle)
  let base: S | null = null
  await a.set((s) => {
    base = s
    return { held: handle }
  })
  await a.drag({ x: from.x + dx, y: from.y + dy }, (p, o) => a.put(apply(base!, Math.round(p.x - o.x), Math.round(p.y - o.y))), { duration: 750, cursor: 'preserve' })
  await a.set({ held: null })
  await a.wait(350)
}

const script = async (a: Act<S>) => {
  await a.wait(600)
  await pull(a, 'edge-s', 0, 30, (s, _, my) => ({ h: s.h + my }))
  await pull(a, 'edge-e', 40, 0, (s, mx) => ({ w: s.w + mx }))
  await pull(a, 'corner-se', -40, -30, (s, mx, my) => ({ w: s.w + mx, h: s.h + my }))
  await pull(a, 'corner-ne', 30, -24, (s, mx, my) => ({ w: s.w + mx, y: s.y + my, h: s.h - my }))
  await pull(a, 'corner-ne', -30, 24, (s, mx, my) => ({ w: s.w + mx, y: s.y + my, h: s.h - my }))
  await a.move('rest')
  await a.wait(700)
}

const HANDLES: [string, string, string][] = [
  ['edge-n', 'resize-ns', 'n'], ['edge-s', 'resize-ns', 's'], ['edge-w', 'resize-ew', 'w'], ['edge-e', 'resize-ew', 'e'],
  ['corner-nw', 'resize-nwse', 'nw'], ['corner-se', 'resize-nwse', 'se'], ['corner-ne', 'resize-nesw', 'ne'], ['corner-sw', 'resize-nesw', 'sw'],
]

@Component({
  selector: 'ss-example-cursor-resize',
  imports: [STAGESHOW],
  template: `
    <ss-stage specimen [width]="440" [height]="300" [initial]="start" [script]="script" [cursor]="{ at: { x: 64, y: 252 } }">
      <ng-template [ssScene]="start" let-s>
        <div class="cr-canvas">
          <div class="cr-frame" [style.left.px]="s.x" [style.top.px]="s.y" [style.width.px]="s.w" [style.height.px]="s.h">
            <div class="cr-fill"></div>
            @for (h of handles; track h[0]) {
              <i class="cr-handle" [attr.data-side]="h[2]" [attr.data-target]="h[0]" [attr.data-cursor]="h[1]" [attr.data-held]="s.held === h[0] || null"></i>
            }
            <span class="cr-size">{{ s.w }} × {{ s.h }}</span>
          </div>
          <span class="cr-rest" data-target="rest"></span>
        </div>
      </ng-template>
    </ss-stage>
  `,
  styleUrl: '../../examples/cursor-resize/cursor-resize.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursorResizeExample {
  protected readonly start = START
  protected readonly script = script
  protected readonly handles = HANDLES
}
