import { ChangeDetectionStrategy, Component, Directive, ViewEncapsulation, booleanAttribute, computed, contentChild, input } from '@angular/core'
import { NgTemplateOutlet } from '@angular/common'
import { injectLook } from './look'

// Window chrome and its small parts (Bar, Text, Prompt, Caret): the Angular
// binding of kit/window.tsx, on the same CSS (kit/window.css). React's node
// props (sidebar, toolbar, lead, a rolling url) are content slots here:
//
//   <ss-window title="Inbox">
//     <nav ssSidebar>...</nav>
//     <span ssToolbar>...</span>
//     ...the window's content
//   </ss-window>

/** The sidebar's content: a full-height sidebar, the traffic lights in its top. */
@Directive({ selector: '[ssSidebar]' })
export class WindowSidebar {}

/** Controls on the right of the bar (toolbar buttons, avatars, a share button). */
@Directive({ selector: '[ssToolbar]' })
export class WindowToolbar {}

/** Controls on the left of the bar, after the title (a breadcrumb, a filter, view tabs). */
@Directive({ selector: '[ssLead]' })
export class WindowLead {}

/** The address as markup instead of the `url` string, to roll just the path. */
@Directive({ selector: '[ssUrl]' })
export class WindowUrl {}

type Variant = 'terminal' | 'framed' | 'sidebar' | 'tabs' | 'plain'

/**
 * Window chrome. Three kinds, chosen by inputs:
 * - browser (`url`): address bar, optional `nav` arrows and `tabs` strip
 * - app (`title`): a plain title bar with a centered title
 * - sidebar app (an `ssSidebar` slot): the sidebar runs to the top and holds the lights
 * Plus the `chrome` materials: terminal, glass, card, hairline. Every input is
 * WindowProps in kit/window.tsx; read its notes there.
 */
@Component({
  selector: 'ss-window',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #lightsT>
      <span class="ss-window__lights"><span class="ss-window__dot"></span><span class="ss-window__dot"></span><span class="ss-window__dot"></span></span>
    </ng-template>
    <ng-template #urlT><ng-content select="[ssUrl]">{{ url() }}</ng-content></ng-template>
    <ng-template #toolbarT><ng-content select="[ssToolbar]" /></ng-template>
    <ng-template #leadT><ng-content select="[ssLead]" /></ng-template>
    <ng-template #sidebarT><ng-content select="[ssSidebar]" /></ng-template>
    <ng-template #contentT><ng-content /></ng-template>
    <ng-template #bodyT>
      <div class="ss-window__body" [class.ss-term]="variant() === 'terminal'" [class]="bodyClass() ?? ''" [attr.data-crop]="bodyCrop() ? '' : null">
        <ng-container [ngTemplateOutlet]="contentT" />
      </div>
    </ng-template>
    <ng-template #addressT>
      @if (hasUrl()) {
        @if (nav()) {
          <span class="ss-window__nav">
            <svg class="ss-window__chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M6.5 1.5 3 5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg class="ss-window__chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M3.5 1.5 7 5 3.5 8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        }
        <span class="ss-window__url"><ng-container [ngTemplateOutlet]="urlT" /></span>
      }
    </ng-template>

    @switch (variant()) {
      @case ('terminal') {
        <div class="ss-window__bar">
          <ng-container [ngTemplateOutlet]="lightsT" />
          @if (title() !== undefined) {
            <span class="ss-term__title">{{ title() }}</span>
          }
        </div>
        <ng-container [ngTemplateOutlet]="bodyT" />
      }
      @case ('framed') {
        <div class="ss-window__bar">
          <ng-container [ngTemplateOutlet]="lightsT" />
          @if (hasUrl()) {
            <span class="ss-window__url">
              @if (chrome() === 'glass') {
                <svg class="ss-window__lock" width="7" height="8" viewBox="0 0 7 8" aria-hidden="true">
                  <path d="M1.5 3.3V2.4a2 2 0 0 1 4 0v.9" fill="none" stroke="currentColor" stroke-width="1.1" />
                  <rect x="0" y="3.3" width="7" height="4.7" rx="1.2" fill="currentColor" />
                </svg>
              }
              <span class="ss-window__url-text"><ng-container [ngTemplateOutlet]="urlT" /></span>
            </span>
          }
          <span class="ss-window__end"><ng-container [ngTemplateOutlet]="toolbarT" /></span>
        </div>
        <ng-container [ngTemplateOutlet]="bodyT" />
      }
      @case ('sidebar') {
        <aside class="ss-window__side" [style.width.px]="sidebarWidth()">
          <div class="ss-window__side-top"><ng-container [ngTemplateOutlet]="lightsT" /></div>
          <ng-container [ngTemplateOutlet]="sidebarT" />
        </aside>
        <div class="ss-window__main">
          <div class="ss-window__bar">
            @if (title() !== undefined) {
              <span class="ss-window__heading">{{ title() }}</span>
            }
            <ng-container [ngTemplateOutlet]="leadT" />
            <ng-container [ngTemplateOutlet]="addressT" />
            <span class="ss-window__spacer"></span>
            <ng-container [ngTemplateOutlet]="toolbarT" />
          </div>
          <ng-container [ngTemplateOutlet]="bodyT" />
        </div>
      }
      @case ('tabs') {
        <div class="ss-window__tabs">
          <ng-container [ngTemplateOutlet]="lightsT" />
          @for (tab of tabs(); track $index) {
            <span class="ss-window__tab" [attr.data-active]="$first || null">
              <span class="ss-window__favicon"></span>
              <span class="ss-window__tab-label">{{ tab }}</span>
            </span>
          }
        </div>
        <div class="ss-window__bar">
          <ng-container [ngTemplateOutlet]="addressT" />
          <ng-container [ngTemplateOutlet]="toolbarT" />
        </div>
        <ng-container [ngTemplateOutlet]="bodyT" />
      }
      @default {
        <div class="ss-window__bar">
          <ng-container [ngTemplateOutlet]="lightsT" />
          <ng-container [ngTemplateOutlet]="addressT" />
          @if (title() !== undefined) {
            <span class="ss-window__title" [attr.data-toolbar]="toolbarSlot() ? 'true' : null">{{ title() }}</span>
          }
          <ng-container [ngTemplateOutlet]="leadT" />
          @if (!hasUrl() && title() === undefined) {
            <span class="ss-window__spacer"></span>
          }
          <ng-container [ngTemplateOutlet]="toolbarT" />
        </div>
        <ng-container [ngTemplateOutlet]="bodyT" />
      }
    }
  `,
  styleUrl: '../kit/window.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ss-window ss-recede',
    // `title` is the window's title, not a tooltip on the host
    '[attr.title]': 'null',
    '[attr.data-chrome]': "variant() === 'terminal' ? 'terminal' : variant() === 'framed' ? chrome() : null",
    '[attr.data-kind]': "variant() === 'sidebar' || variant() === 'tabs' ? variant() : null",
    '[attr.data-side]': "variant() === 'sidebar' && sidebarStyle() === 'floating' ? 'floating' : null",
    '[attr.data-lights]': 'lightsAttr()',
    '[attr.data-lights-size]': "variant() !== 'framed' && lightsSize() === 'large' ? 'large' : null",
    '[attr.data-bar]': "(variant() === 'sidebar' || variant() === 'plain') && barSize() === 'tall' ? 'tall' : null",
    '[attr.data-url-shape]': "variant() === 'sidebar' || variant() === 'tabs' || variant() === 'plain' ? (urlShape() ?? null) : null",
    '[attr.data-receded]': 'receded() || null',
  },
})
export class WindowComponent {
  /** The address. For markup (a rolling path), project an element marked ssUrl instead. */
  readonly url = input<string>()
  readonly urlShape = input<'rounded' | 'pill'>()
  /** Browser: tab titles above the address bar; the first is the active tab. */
  readonly tabs = input<string[]>()
  /** Browser: back and forward buttons before the address. */
  readonly nav = input(false, { transform: booleanAttribute })
  /** App: the window title. */
  readonly title = input<string>()
  readonly sidebarWidth = input(180)
  readonly sidebarStyle = input<'flush' | 'floating'>()
  /** A class for the content column, which sits inside the window's own clip. */
  readonly bodyClass = input<string>()
  /** Marks the content column data-crop, for film's crop checks. */
  readonly bodyCrop = input(false, { transform: booleanAttribute })
  /** Fades the window to 40%, so a window in front of it reads as the subject. */
  readonly receded = input(false, { transform: booleanAttribute })
  readonly chrome = input<'native' | 'glass' | 'terminal' | 'card' | 'hairline'>()
  readonly lights = input<'color' | 'grey' | 'white'>()
  readonly lightsSize = input<'standard' | 'large'>()
  readonly barSize = input<'standard' | 'tall'>()

  protected readonly sidebarSlot = contentChild(WindowSidebar)
  protected readonly toolbarSlot = contentChild(WindowToolbar)
  protected readonly urlSlot = contentChild(WindowUrl)

  protected readonly hasUrl = computed(() => this.url() !== undefined || !!this.urlSlot())
  protected readonly variant = computed<Variant>(() => {
    const chrome = this.chrome()
    if (chrome === 'terminal') return 'terminal'
    if (chrome === 'glass' || chrome === 'card' || chrome === 'hairline') return 'framed'
    if (this.sidebarSlot()) return 'sidebar'
    if (this.tabs()?.length) return 'tabs'
    return 'plain'
  })
  protected readonly lightsAttr = computed(() => {
    const lights = this.lights()
    if (this.variant() !== 'framed') return lights === 'grey' ? 'grey' : null
    return lights === 'color' || lights === 'white' ? lights : this.chrome() === 'glass' ? 'grey' : null
  })
}

const INK = ['var(--ss-ink-1)', 'var(--ss-ink-2)', 'var(--ss-ink-3)', 'var(--ss-ink-4)', 'var(--ss-ink-5)']
type Tone = 1 | 2 | 3 | 4 | 5
const px = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)

/**
 * A placeholder: a line of text, a value, an icon slot or a pill. A line
 * gives way in a narrow row as text would; where it fits, it is exactly `w`.
 * To recolor one, bind [style.background]: a template binding wins over the
 * bar's own tone, a static style attribute does not.
 */
@Component({
  selector: 'ss-bar',
  template: '',
  styleUrl: '../kit/window.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ss-bar',
    '[attr.data-shrink]': 'gives() || null',
    '[style.width]': 'width()',
    '[style.height.px]': 'h()',
    '[style.border-radius.px]': 'r()',
    '[style.background]': 'ink()',
  },
})
export class BarComponent {
  readonly w = input.required<number | string>()
  readonly h = input(6)
  /** 1 (faintest) to 5 */
  readonly tone = input<Tone>(3)
  readonly r = input(2)
  /** Let it narrow in a row too tight for it. On by default for a line (a numeric `w` over three times `h`). */
  readonly shrink = input<boolean | undefined>(undefined)
  protected readonly gives = computed(() => this.shrink() ?? (typeof this.w() === 'number' && (this.w() as number) > this.h() * 3))
  protected readonly width = computed(() => px(this.w()))
  protected readonly ink = computed(() => INK[this.tone() - 1])
}

/**
 * Text that knows the stage's fidelity: real words normally, a bar of about
 * the same width in minimal (and for `filler`, everywhere but realistic).
 * Write real copy once and every look follows.
 */
@Component({
  selector: 'ss-text',
  template: `@if (!asBar()) {{{ text() }}}`,
  styleUrl: '../kit/window.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ss-text]': '!asBar()',
    '[class.ss-bar]': 'asBar()',
    '[attr.data-wrap]': '(!asBar() && wrap()) || null',
    '[attr.data-shrink]': 'asBar() || null',
    '[style.width.px]': 'asBar() ? barWidth() : null',
    '[style.height.px]': 'asBar() ? h() : null',
    '[style.border-radius.px]': 'asBar() ? 2 : null',
    '[style.background]': 'asBar() ? ink() : null',
  },
})
export class TextComponent {
  readonly text = input.required<string>()
  /** Filler: the words show only at realistic fidelity; elsewhere the line is a bar of about the same width. */
  readonly filler = input(false, { transform: booleanAttribute })
  /** Bar width in minimal fidelity. Defaults to an estimate from the text. */
  readonly w = input<number>()
  readonly h = input(6)
  readonly tone = input<Tone>(3)
  /** The font size the estimate assumes. */
  readonly size = input(11)
  /** Let it wrap. Text is one line by default, so a label never breaks by accident. */
  readonly wrap = input(false, { transform: booleanAttribute })

  private readonly look = injectLook()
  protected readonly asBar = computed(() => {
    const fidelity = this.look().fidelity
    return fidelity === 'minimal' || (this.filler() && fidelity !== 'realistic')
  })
  protected readonly barWidth = computed(() => this.w() ?? Math.round(this.text().length * this.size() * 0.52))
  protected readonly ink = computed(() => INK[this.tone() - 1])
}

/** A terminal command line: a dim path, the prompt mark, and the command bright. */
@Component({
  selector: 'ss-prompt',
  template: `<span class="ss-term__path">{{ path() }}</span><span class="ss-term__sigil">❯</span><span class="ss-term__cmd"><ng-content /></span>`,
  styleUrl: '../kit/window.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ss-term__line ss-term__prompt', style: 'display: block' },
})
export class PromptComponent {
  /** The working directory shown before the prompt. */
  readonly path = input('~')
}

/** A terminal's block cursor. Blinks unless `still` (while typing, a real one holds solid). */
@Component({
  selector: 'ss-caret',
  template: '',
  styleUrl: '../kit/window.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ss-term__caret', 'aria-hidden': 'true', '[attr.data-still]': 'still() || null' },
})
export class CaretComponent {
  readonly still = input(false, { transform: booleanAttribute })
}
