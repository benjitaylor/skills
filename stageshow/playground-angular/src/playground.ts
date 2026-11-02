import { ChangeDetectionStrategy, Component, type Type } from '@angular/core'
import { NgComponentOutlet } from '@angular/common'
import { CursorResizeExample } from '../../examples-angular/cursor-resize/cursor-resize.component'
import { MonochromeExample } from '../../examples-angular/monochrome/monochrome.component'

// The Angular viewer: a list of the ported examples, and ?capture=<id> for
// one example alone on the page, the route film.mjs films.

const EXAMPLES: { id: string; name: string; component: Type<unknown> }[] = [
  { id: 'cursor-resize', name: 'Resize cursors', component: CursorResizeExample },
  { id: 'monochrome', name: 'Monochrome', component: MonochromeExample },
]

@Component({
  selector: 'ss-playground',
  imports: [NgComponentOutlet],
  template: `
    @if (capture) {
      <main id="example" class="pg-capture"><ng-container [ngComponentOutlet]="capture.component" /></main>
    } @else {
      <main class="pg-list">
        <h1>Stageshow for Angular</h1>
        @for (ex of examples; track ex.id) {
          <section>
            <h2><a [href]="'?capture=' + ex.id">{{ ex.name }}</a></h2>
            <ng-container [ngComponentOutlet]="ex.component" />
          </section>
        }
      </main>
    }
  `,
  styles: `
    .pg-capture { padding: 16px; }
    .pg-list { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
    .pg-list h2 { font-size: 15px; margin: 40px 0 12px; }
    .pg-list a { color: inherit; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Playground {
  protected readonly examples = EXAMPLES
  protected readonly capture = EXAMPLES.find((e) => e.id === new URLSearchParams(location.search).get('capture')) ?? null
}
