import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core'
import { STAGESHOW } from '../../kit-angular'

// examples/monochrome in Angular: a still, three customers' sites side by
// side in grayscale, fading out at the foot. The composition notes are in
// examples/monochrome/index.tsx; the CSS is the React example's own.
//
// Real strings: the three URLs and headlines.

const SITES = [
  { url: 'lumen.studio', head: 'Light for small rooms', hue: '#d97706' },
  { url: 'halvorsen.co', head: 'Accounting, without the paperwork', hue: '#2563eb' },
  { url: 'tidepool.app', head: 'Swim lessons, booked in a tap', hue: '#059669' },
]

@Component({
  selector: 'ss-example-monochrome',
  imports: [STAGESHOW],
  template: `
    <ss-stage class="mn" [width]="720" [height]="320" [compact]="{ below: 600, width: 358, height: 320 }">
      <ng-template ssScene>
        <div class="mn-fade">
          <div class="mn-row">
            @for (site of sites; track site.url) {
              <ss-window class="mn-win" [url]="site.url">
                <div class="mn-site" [style.--mn-hue]="site.hue">
                  <div class="mn-nav">
                    <ss-bar [w]="18" [h]="18" [r]="5" [style.background]="site.hue" />
                    <ss-bar [w]="40" [h]="6" [r]="3" [tone]="2" />
                    <ss-bar [w]="34" [h]="6" [r]="3" [tone]="2" />
                  </div>
                  <ss-text class="mn-head" [text]="site.head" />
                  <ss-bar [w]="150" [h]="7" [r]="3.5" [tone]="2" />
                  <span class="mn-cta"></span>
                  <div class="mn-hero"></div>
                </div>
              </ss-window>
            }
          </div>
        </div>
      </ng-template>
    </ss-stage>
  `,
  styleUrl: '../../examples/monochrome/mono.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonochromeExample {
  protected readonly sites = SITES
}
