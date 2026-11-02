import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core'
import type { Keys, KeysAt } from '../kit/core'

/** The last key row (fading out) and the current one. Tracked by id, so a row fading out is never rewritten by the next. */
@Component({
  selector: 'ss-keycaps',
  template: `
    @for (row of shown(); track row.id) {
      <div class="ss-keys" [attr.data-show]="row.show" [attr.data-at]="at()" aria-hidden="true">
        @for (cap of row.caps; track $index) {
          <kbd class="ss-key" [attr.data-down]="row.down">{{ cap }}</kbd>
        }
      </div>
    }
  `,
  styleUrl: '../kit/keys.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class KeycapsComponent {
  readonly rows = input.required<(Keys | null)[]>()
  readonly at = input<KeysAt>('bottom')
  protected readonly shown = computed(() => this.rows().filter((r): r is Keys => r !== null))
}
