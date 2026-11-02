import { Directive, TemplateRef, inject, input } from '@angular/core'
import type { Layout } from '../kit/core'
import type { Rect } from '../kit/measure'

/** What a scene template is handed each render: the state, rect() and the layout showing. */
export interface SceneContext<S> {
  $implicit: S
  state: S
  /** Where a data-target is now, in stage pixels, refreshed after each render. */
  rect: (name: string) => Rect
  layout: Layout
}

/**
 * The scene a stage draws: the Angular form of <Stage>'s render function.
 * Bind the initial state to type the template's variables:
 *
 *   <ng-template [ssScene]="initial" let-s let-rect="rect" let-layout="layout">
 *
 * A still with no state can use the bare attribute: <ng-template ssScene>.
 */
@Directive({ selector: 'ng-template[ssScene]' })
export class SceneDirective<S> {
  /** Only types the template's variables; the stage keeps the state. */
  readonly ssScene = input<S | ''>()
  readonly template = inject<TemplateRef<SceneContext<S>>>(TemplateRef)

  static ngTemplateContextGuard<S>(_dir: SceneDirective<S>, ctx: unknown): ctx is SceneContext<Exclude<S, ''>> {
    return true
  }
}
