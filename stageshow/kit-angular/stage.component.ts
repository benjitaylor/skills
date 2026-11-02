import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterEveryRender,
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  computed,
  contentChild,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type WritableSignal,
} from '@angular/core'
import { NgTemplateOutlet } from '@angular/common'
import { checkSeam, createAct, Stopped, type ActEnv, type Script, type Setter } from '../kit/act'
import { clock } from '../kit/clock'
import { ripple as spawnRipple, type CursorKind, type CursorStyle, type Fidelity, type Keys, type KeysAt, type Layout, type Look, type Palette, type Theme } from '../kit/core'
import { EMPTY, nameOf, rectOf, sameRects, stageSpace, targetRectOf, thumb, type Point, type Rect, type Target } from '../kit/measure'
import { clamp, easeInOutCubic, isDev, warn } from '../kit/util'
import { CursorComponent } from './cursor.component'
import { KeycapsComponent } from './keycaps.component'
import { StageContext, prefersReducedMotion } from './look'
import { SceneDirective, type SceneContext } from './scene.directive'

// The stage: fits a design-size scene into its container, runs the script
// while it is on screen, and draws the cursor and keycaps over the scene.
// The Angular binding of kit/stage.tsx: the same script API (kit/act.ts),
// measuring (kit/measure.ts), clock (kit/clock.ts) and CSS (kit/stage.css),
// with state in signals and the scene in an <ng-template ssScene>.

/** loop: repeats while on screen. once: plays when first seen, then holds the end. hover: plays while the pointer is over it, settles back when it leaves; on a screen with no hover (a phone) it plays once. */
export type Play = 'loop' | 'once' | 'hover'

/** Design tokens for a look: `--ss-accent`, `--ss-radius-md`, `--ss-font` and the rest. */
export type LookTokens = { [token: `--ss-${string}`]: string }

/** Where the cursor rests, its kind and style. The fields are StageProps['cursor'] in kit/stage.tsx. */
export interface StageCursor {
  at: Target
  kind?: CursorKind
  style?: CursorStyle
  still?: boolean
  ripple?: boolean
  idle?: number | false
}

export interface StageCompact {
  below: number
  width: number
  height: number
}

type Ref<T> = { current: T }
const setter = <T,>(sig: WritableSignal<T>): Setter<T> => (next) => sig.update((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next))

@Component({
  selector: 'ss-stage',
  imports: [NgTemplateOutlet, CursorComponent, KeycapsComponent],
  template: `
    <div
      #root
      class="ss-stage"
      [attr.data-specimen]="specimen() || null"
      [attr.data-unframed]="unframed() || null"
      [attr.data-still]="still() || null"
      [attr.data-placing]="settling() || null"
      [attr.data-theme]="theme()"
      [attr.data-palette]="palette()"
      [attr.data-greys]="greys() === 'cool' ? 'cool' : null"
      [attr.data-fidelity]="fidelity()"
      [attr.data-layout]="layout()"
      [style]="vars()"
      [style.width.px]="designW()"
      [style.height.px]="designH()"
      [style.margin-left.px]="inset() || null"
      [style.transform]="'scale(' + scale() + ')'"
    >
      @if (ground()) {
        <div class="ss-ground" aria-hidden="true" [style]="orbs()"></div>
      }
      @if (scene(); as sc) {
        <ng-container [ngTemplateOutlet]="sc.template" [ngTemplateOutletContext]="context()" />
      }
      @if (script()) {
        <ss-keycaps [rows]="keyRows()" [at]="keysAt()" />
      }
      @if (showCursor()) {
        <ss-cursor [cursorStyle]="cursor()?.style ?? 'real'" [kind]="kind()" />
      }
    </div>
  `,
  styleUrl: '../kit/stage.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [StageContext],
  host: {
    class: 'ss-fit',
    style: 'display: block',
    '[style.max-width.px]': 'grows() ? null : width()',
    '[style.height.px]': 'designH() * scale()',
  },
})
export class StageComponent<S extends object> {
  /** Design size. The stage scales down to fit its container, and only grows past it with `fill`. */
  readonly width = input.required<number>()
  readonly height = input.required<number>()
  /** Scene state at the start of each loop. Statics can leave it out. */
  readonly initial = input<S>({} as S)
  /** Loops while on screen. Leave out for a static illustration. */
  readonly script = input<Script<S>>()
  /** The still frame shown under reduced motion or with no script. Defaults to initial. */
  readonly poster = input<S>()
  /** Where the cursor rests; leave out to hide it. See StageProps['cursor'] in kit/stage.tsx. */
  readonly cursor = input<StageCursor>()
  readonly play = input<Play>('loop')
  /** A second, smaller design for narrow containers: a tighter crop, never the wide scene shrunk. */
  readonly compact = input<StageCompact>()
  /** Where keycaps from act.key appear. */
  readonly keys = input<KeysAt | { wide: KeysAt; compact: KeysAt }>('bottom')
  /** Targets shown hovered in a still, since no script is there to hover them. */
  readonly hover = input<string[]>()
  readonly themeIn = input<Theme>('light', { alias: 'theme' })
  readonly palette = input<Palette>('accent')
  readonly fidelity = input<Fidelity>('standard')
  /** The grays' temperature: warm (the default) or cool. Light theme only. */
  readonly greys = input<'warm' | 'cool'>()
  /** A look as values: any `--ss-*` tokens, set on the stage over its theme's. */
  readonly tokens = input<LookTokens>()
  /** Grow past the design size to fill the container (up to 2x). */
  readonly fill = input(false, { transform: booleanAttribute })
  /** The accent color for this stage. Sets --ss-accent, its soft fill and the gradient's second stop. */
  readonly accent = input<string>()
  /** What the scene sits on: soft color orbs, optionally with your own two or three colors. */
  readonly ground = input<'orbs' | [string, string] | [string, string, string]>()
  /** Plays the script faster (above 1) or slower (below 1). */
  readonly speedIn = input(1, { alias: 'speed' })
  /** A specimen sheet of parts, not a product frame. */
  readonly specimen = input(false, { transform: booleanAttribute })
  /** No framing, when the developer asks for it. */
  readonly unframed = input(false, { transform: booleanAttribute })

  protected readonly scene = contentChild<SceneDirective<S>>(SceneDirective)
  private readonly rootRef = viewChild.required<ElementRef<HTMLDivElement>>('root')
  private readonly cursorRef = viewChild<CursorComponent, ElementRef<HTMLDivElement>>(CursorComponent, { read: ElementRef })
  private readonly host: HTMLElement = inject(ElementRef).nativeElement
  private readonly cdr = inject(ChangeDetectorRef)
  private readonly destroyRef = inject(DestroyRef)
  private readonly ctx = inject(StageContext, { self: true })

  // film.mjs can slow every stage down (--slow) and film any stage dark (--dark)
  private readonly film = typeof window === 'undefined' ? {} : ((window as unknown as { __stageshow?: { slow?: number; theme?: Theme } }).__stageshow ?? {})
  protected readonly theme = computed(() => this.film.theme ?? this.themeIn())
  private readonly speed = computed(() => this.speedIn() / (this.film.slow ?? 1))
  // Hover scripts can hold their ending without returning to the start.
  // On touch, play once rather than assuming the script has a loop seam.
  private readonly playMode = computed<Play>(() => {
    const p = this.play()
    return p === 'hover' && typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches ? 'once' : p
  })

  readonly layout = signal<Layout>('wide')
  protected readonly grows = signal(false)
  protected readonly scale = signal(1)
  protected readonly inset = signal(0)
  protected readonly designW = computed(() => (this.layout() === 'compact' && this.compact() ? this.compact()!.width : this.width()))
  protected readonly designH = computed(() => (this.layout() === 'compact' && this.compact() ? this.compact()!.height : this.height()))

  private readonly reduced = prefersReducedMotion()
  protected readonly still = computed(() => !this.script() || this.reduced())

  readonly state = linkedSignal<S>(() => (this.still() && this.poster()) || this.initial())
  protected readonly kind = linkedSignal<CursorKind>(() => this.cursor()?.kind ?? 'pointer')
  private readonly keyRow = signal<Keys>({ id: 0, caps: [], show: false, down: false })
  private readonly lastKeys = signal<Keys | null>(null)
  protected readonly keyRows = computed(() => [this.lastKeys(), this.keyRow()])
  protected readonly keysAt = computed(() => {
    const k = this.keys()
    return typeof k === 'string' ? k : k[this.layout()]
  })
  protected readonly showCursor = computed(() => {
    const c = this.cursor()
    return !!c && (!this.script() || !this.still() || !!c.still)
  })
  protected readonly settling = signal(true)

  protected readonly vars = computed(() => {
    const accent = this.accent()
    return {
      ...this.tokens(),
      ...(accent ? { '--ss-accent': accent, '--ss-accent-2': accent, '--ss-accent-soft': `color-mix(in srgb, ${accent} 14%, transparent)` } : null),
    }
  })
  protected readonly orbs = computed(() => {
    const g = this.ground()
    return Array.isArray(g) ? { '--ss-orb-1': g[0], '--ss-orb-2': g[1], ...(g[2] ? { '--ss-orb-3': g[2] } : null) } : null
  })

  // Rects of every data-target, in stage pixels, refreshed after each render.
  private readonly rects = signal<Record<string, Rect>>({})
  protected readonly rect = (name: string): Rect => this.rects()[name] ?? EMPTY
  protected readonly context = computed<SceneContext<S>>(() => {
    // Reading rects here re-renders the scene when a target moves
    this.rects()
    const state = this.state()
    return { $implicit: state, state, rect: this.rect, layout: this.layout() }
  })

  // What an act works with. Plain objects where the React stage keeps refs.
  private readonly pos: Ref<Point> = { current: { x: 0, y: 0 } }
  private readonly hovered: Ref<Element | null> = { current: null }
  private readonly dragging: Ref<boolean> = { current: false }
  private readonly autoUsed: Ref<boolean> = { current: false }
  private readonly autoRef: Ref<((p: Point) => void) | null> = { current: null }
  // When the cursor last did something; while a script plays, a cursor that
  // has sat still for longer than `idle` fades out until its next move
  private active = 0
  // Each loop: when it began, whether the cursor has moved yet, and (learned
  // from the first run) how long it waits before its first move
  private loopAt = 0
  private moved = false
  private firstMove: number | null = null
  private passes = { n: 0, frame: 0, owed: false }
  private glideId = 0
  private resetFrame = 0

  constructor() {
    const ctx = this.ctx
    ctx.look = computed<Look>(() => ({ theme: this.theme(), palette: this.palette(), fidelity: this.fidelity(), layout: this.layout() }))
    ctx.still = this.still

    // Fit: pick the layout from the container width, then scale its design
    // size into it. Again whenever the design size or fill policy changes.
    afterRenderEffect(() => {
      this.width()
      this.compact()
      this.fill()
      untracked(() => this.fit())
    })
    afterNextRender(() => {
      const ro = new ResizeObserver(() => this.fit())
      ro.observe(this.host)
      // Hosts can switch layout/fill policy without changing this box's
      // width. Observe only those attributes on its ancestors, not the scene.
      const hosts = new MutationObserver(() => this.fit())
      for (let h = this.host.parentElement; h; h = h.parentElement) hosts.observe(h, { attributes: true, attributeFilter: ['data-ss-wide', 'data-ss-fill'] })
      // Things that slide or scale into place move after the render that
      // started them, so measure again once they settle.
      const root = this.rootRef().nativeElement
      root.addEventListener('transitionend', this.remeasure)
      root.addEventListener('animationend', this.remeasure)
      this.destroyRef.onDestroy(() => {
        ro.disconnect()
        hosts.disconnect()
        root.removeEventListener('transitionend', this.remeasure)
        root.removeEventListener('animationend', this.remeasure)
        clock.cancelLayoutRaf(this.passes.frame)
      })
    })

    afterEveryRender(() => {
      this.remeasure()
      // Stills have no script to hover things, so mark them here.
      const hover = this.hover()
      if (!this.still() || !hover) return
      const root = this.rootRef().nativeElement
      hover.forEach((name) => root.querySelector(`[data-target="${name}"]`)?.setAttribute('data-hover', ''))
    })

    // Placing: until the first measurements (after fonts load) have painted,
    // and again after a wide/compact switch, nothing transitions. Otherwise
    // anything placed from rect() would visibly travel from 0,0 into place.
    effect((onCleanup) => {
      this.layout()
      untracked(() => this.settling.set(true))
      let live = true
      let frame = 0
      const release = () => {
        frame = clock.layoutRaf(() => {
          frame = clock.layoutRaf(() => live && this.settling.set(false))
        })
      }
      if (!document.fonts || document.fonts.status === 'loaded') release()
      else document.fonts.ready.then(() => live && release())
      onCleanup(() => {
        live = false
        clock.cancelLayoutRaf(frame)
      })
    })

    // Rest the cursor at its start point, unless a script is running: then the
    // cursor is mid-story, and a resize must not send it back to rest
    afterRenderEffect(() => {
      this.scale()
      this.layout()
      this.cursorRef()
      untracked(() => {
        if (this.cursor() && !this.loopAt) this.place(this.resolve(this.restAt()))
      })
    })

    // The cursor's kind follows what's under it after every render too, so a
    // hand doesn't linger when the link it was over slides away. Not mid-drag.
    afterRenderEffect(() => {
      this.state()
      untracked(() => {
        if (this.cursor() && !this.still() && !this.dragging.current) this.autoRef.current?.(this.pos.current)
      })
    })

    // Run the loop only while the stage is on screen and the tab is visible.
    // A changed script, layout, speed or motion preference starts a fresh scene.
    afterRenderEffect((onCleanup) => {
      const still = this.still()
      const script = this.script()
      const play = this.playMode()
      this.layout()
      this.speed()
      untracked(() => onCleanup(this.run(still, script, play)))
    })
  }

  private fit() {
    const fit = this.host
    const w = fit.clientWidth
    const compact = this.compact()
    // A host that sizes the stage by something other than the screen (a
    // bento tile set by its row's height) marks a wrapper data-ss-wide to
    // keep the wide design, scaled, rather than the phone-width one
    const wide = !!fit.parentElement?.closest('[data-ss-wide]')
    const next: Layout = compact && !wide && w < compact.below ? 'compact' : 'wide'
    this.layout.set(next)
    const grow = this.fill() || !!fit.parentElement?.closest('[data-ss-fill]')
    this.grows.set(grow)
    const dw = next === 'compact' ? compact!.width : this.width()
    const s = Math.min(grow ? 2 : 1, w / dw)
    this.scale.set(s)
    // A design narrower than its box sits in the middle of it, not at its left
    this.inset.set(Math.max(0, (w - dw * s) / 2))
  }

  private measureAll() {
    const root = this.rootRef().nativeElement
    const out: Record<string, Rect> = {}
    const targets = root.querySelectorAll<HTMLElement>('[data-target]')
    if (!targets.length) return out
    const scale = this.scale()
    const space = stageSpace(root, scale)
    targets.forEach((el) => {
      out[el.dataset['target']!] = targetRectOf(root, el, scale, space)
    })
    return out
  }

  // Something placed from rect() can itself be a target, and the two can
  // chase each other. Allow a few passes per frame, then wait for the next.
  private readonly remeasure = () => {
    const p = this.passes
    const commit = () => {
      const next = this.measureAll()
      if (!sameRects(this.rects(), next)) this.rects.set(next)
    }
    if (!p.frame)
      p.frame = clock.layoutRaf(() => {
        p.n = 0
        p.frame = 0
        if (!p.owed) return
        p.owed = false
        commit()
      })
    if (p.n >= 4) {
      p.owed = true
      return
    }
    p.n++
    commit()
  }

  // Where the cursor rests, for the layout showing
  private restAt(): Target {
    const at = this.cursor()!.at
    return typeof at === 'object' && 'wide' in at ? at[this.layout()] : at
  }

  private readonly place = (p: Point) => {
    if (this.loopAt && !this.moved && Math.hypot(p.x - this.pos.current.x, p.y - this.pos.current.y) > 0.5) {
      this.moved = true
      this.firstMove ??= performance.now() - this.loopAt
    }
    this.pos.current = p
    this.active = performance.now()
    const el = this.cursorRef()?.nativeElement
    if (!el) return
    el.style.transform = `translate(${p.x}px, ${p.y}px)`
    el.removeAttribute('data-idle')
  }

  private readonly resolve = (t: Target): Point => {
    // One target per layout, as cursor.at takes it
    if (typeof t === 'object' && t !== null && 'wide' in t) t = this.layout() === 'compact' ? t.compact : t.wide
    const name = nameOf(t)
    if (name === null) return t as Point
    const root = this.rootRef().nativeElement
    const el = root.querySelector<HTMLElement>(`[data-target="${name}"]`)
    if (!el) {
      warn(`no element with data-target="${name}"`)
      return this.pos.current
    }
    const r = rectOf(root, el, this.scale())
    const f = typeof t === 'string' ? { x: 0.5, y: 0.5 } : (t as { x: number; y: number })
    return { x: r.x + r.width * f.x, y: r.y + r.height * f.y }
  }

  private readonly ripple = (at: Point) => {
    if (this.reduced()) return
    spawnRipple(this.rootRef().nativeElement, at)
  }

  private cancelReset() {
    ++this.glideId
    cancelAnimationFrame(this.resetFrame)
    this.resetFrame = 0
    this.rootRef().nativeElement.removeAttribute('data-settling')
  }

  // Back to the start. `glide` (a hover stage settling as the pointer leaves)
  // lets the scene's own transitions carry it back and walks the cursor home;
  // otherwise everything jumps, since nobody is watching.
  private reset(glide = false) {
    this.cancelReset()
    const id = this.glideId
    const root = this.rootRef().nativeElement
    this.dragging.current = false
    this.state.set(this.initial())
    this.kind.set(this.cursor()?.kind ?? 'pointer')
    this.keyRow.update((k) => ({ ...k, show: false, down: false }))
    this.lastKeys.set(null)
    root.querySelectorAll('[data-hover],[data-pressed]').forEach((el) => {
      el.removeAttribute('data-hover')
      el.removeAttribute('data-pressed')
    })
    root.removeAttribute('data-mark')
    root.querySelectorAll<HTMLElement>('[data-scrolled]').forEach((el) => {
      el.scrollTop = 0
      el.removeAttribute('data-scrolled')
      thumb(el)
    })
    root.querySelectorAll('[data-scrolling]').forEach((el) => el.removeAttribute('data-scrolling'))
    this.cursorRef()?.nativeElement.removeAttribute('data-pressed')
    this.hovered.current = null
    if (!this.cursor()) return
    if (!glide) {
      this.resetFrame = requestAnimationFrame(() => {
        this.resetFrame = 0
        this.place(this.resolve(this.restAt()))
        this.autoRef.current?.(this.pos.current)
      })
      return
    }
    root.setAttribute('data-settling', '')
    this.resetFrame = requestAnimationFrame(() => {
      const from = { ...this.pos.current }
      const end = this.resolve(this.restAt())
      const ms = clamp(320 + Math.hypot(end.x - from.x, end.y - from.y) * 0.7, 380, 700)
      const t0 = performance.now()
      const step = () => {
        if (this.glideId !== id) return
        const t = Math.min(1, (performance.now() - t0) / ms)
        const e = easeInOutCubic(t)
        this.place({ x: from.x + (end.x - from.x) * e, y: from.y + (end.y - from.y) * e })
        if (t < 1) this.resetFrame = requestAnimationFrame(step)
        else {
          this.resetFrame = 0
          root.removeAttribute('data-settling')
        }
      }
      step()
    })
  }

  // Each run gets its own act (kit/act.ts), bound to its own signal, so a
  // canceled run can never pick up the next run's signal and keep going.
  private makeAct(signal: AbortSignal) {
    const self = this
    const env: ActEnv<S> = {
      rootRef: { get current() { return self.rootRef().nativeElement } },
      cursorRef: { get current() { return self.cursorRef()?.nativeElement ?? null } },
      pos: this.pos,
      hovered: this.hovered,
      kindRef: { get current() { return self.kind() }, set current(v) { self.kind.set(v) } },
      keysRef: { get current() { return self.keyRow() }, set current(v) { self.keyRow.set(v) } },
      dragging: this.dragging,
      autoUsed: this.autoUsed,
      autoRef: this.autoRef,
      scaleRef: { get current() { return self.scale() }, set current(v) { self.scale.set(v) } },
      speed: this.speed(),
      layout: this.layout(),
      cursor: this.cursor(),
      resolve: this.resolve,
      place: this.place,
      remeasure: this.remeasure,
      ripple: this.ripple,
      setState: setter(this.state),
      setKind: setter(this.kind),
      setKeys: setter(this.keyRow),
      setLastKeys: setter(this.lastKeys),
      // The cursor and whatever follows it paint in the same frame: render
      // the scene now, as React's flushSync does
      sync: (fn) => {
        fn()
        this.cdr.detectChanges()
        this.remeasure()
      },
    }
    return createAct<S>(signal, env)
  }

  /** Starts the scene for the current inputs; returns its teardown. */
  private run(still: boolean, script: Script<S> | undefined, play: Play): () => void {
    const stage = this.rootRef().nativeElement
    if (still || !script) {
      this.reset()
      stage.removeAttribute('data-offscreen')
      this.state.set(this.poster() ?? this.initial())
      return () => this.cancelReset()
    }
    this.reset()
    const root = this.host
    const cursor = this.cursor()
    const initial = this.initial()
    let ctrl: AbortController | null = null
    let onScreen = false
    let hovering = false
    let done = false

    // Idle: a cursor waiting to start reads as a stuck one, so before its
    // first move it steps out of the shot. Once it has acted, resting to
    // watch the result is part of the story: only a long stillness fades it,
    // and never while it holds a press or rests on what it hovers.
    const idle = cursor?.idle ?? 4000
    const LEAD = 1200
    let idleTimer = 0
    let revealTimer = 0
    const cursorEl = () => this.cursorRef()?.nativeElement
    const watchIdle = () => {
      window.clearInterval(idleTimer)
      if (!cursor || idle === false) return
      this.active = performance.now()
      idleTimer = window.setInterval(() => {
        const el = cursorEl()
        if (!el) return
        const now = performance.now()
        if (!this.moved) {
          // Later loops know when it moves and handle it in beginLoop
          if (this.firstMove === null && now - this.active > LEAD) el.setAttribute('data-idle', '')
          return
        }
        if (el.hasAttribute('data-pressed') || stage.querySelector('[data-hover]')) this.active = now
        else if (now - this.active > idle) el.setAttribute('data-idle', '')
      }, 150)
    }
    const beginLoop = () => {
      this.loopAt = performance.now()
      this.moved = false
      window.clearTimeout(revealTimer)
      const el = cursorEl()
      const wait = this.firstMove
      if (idle === false || !el || wait === null || wait <= LEAD) return
      // A long opening wait: out now, back in just before the first move
      el.setAttribute('data-idle', '')
      revealTimer = window.setTimeout(() => el.removeAttribute('data-idle'), wait - 400)
    }
    const unwatchIdle = () => {
      window.clearInterval(idleTimer)
      window.clearTimeout(revealTimer)
      this.loopAt = 0
      cursorEl()?.removeAttribute('data-idle')
    }
    const finishIdle = () => {
      window.clearInterval(idleTimer)
      window.clearTimeout(revealTimer)
      // A completed once scene cannot move again. Keep a hovered/pressed
      // cursor visible, or finish its existing idle delay with one timeout.
      const el = cursorEl()
      const held = () => el?.hasAttribute('data-pressed') || stage.querySelector('[data-hover]')
      if (!cursor || idle === false || !el || el.hasAttribute('data-idle') || held()) return
      const delay = (this.moved ? idle : LEAD) - (performance.now() - this.active)
      revealTimer = window.setTimeout(() => {
        if (!held()) el.setAttribute('data-idle', '')
      }, Math.max(0, delay))
    }

    const start = () => {
      if (ctrl || done || !onScreen || document.hidden) return
      if (play === 'hover' && !hovering) return
      this.cancelReset()
      if (cursor) this.place(this.resolve(this.restAt()))
      ctrl = new AbortController()
      const signal = ctrl.signal
      watchIdle()
      const act = this.makeAct(signal)
      ;(async () => {
        do {
          beginLoop()
          try {
            await script(act)
          } catch (e) {
            if (e instanceof Stopped) return
            // A real error in the script: report it once and stand the stage
            // down, so a later start() can run it again
            console.error('[stageshow] script error', e)
            ctrl = null
            unwatchIdle()
            return
          }
          if (play === 'loop' && isDev()) checkSeam(this.state(), initial, this.pos.current, cursor ? this.resolve(this.restAt()) : null)
        } while (play === 'loop' && !signal.aborted)
        // Once holds its end state for good; hover holds it until the pointer leaves.
        if (play === 'once' && !signal.aborted) {
          done = true
          finishIdle()
        }
      })()
    }
    const stop = (glide = false) => {
      unwatchIdle()
      if (!ctrl) return
      ctrl.abort()
      ctrl = null
      if (!done) this.reset(glide)
    }

    const markOffscreen = () => stage.toggleAttribute('data-offscreen', !onScreen || document.hidden)
    markOffscreen()
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      // Off screen its CSS animations pause too, so nothing runs out of view
      markOffscreen()
      onScreen ? start() : stop()
    })
    io.observe(root)
    const onVisibility = () => {
      markOffscreen()
      document.hidden ? stop() : start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const enter = () => {
      hovering = true
      start()
    }
    const leave = () => {
      hovering = false
      stop(true)
    }
    if (play === 'hover') {
      root.addEventListener('pointerenter', enter)
      root.addEventListener('pointerleave', leave)
    }
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      root.removeEventListener('pointerenter', enter)
      root.removeEventListener('pointerleave', leave)
      unwatchIdle()
      ctrl?.abort()
      ctrl = null
      this.autoRef.current = null
      this.cancelReset()
    }
  }
}
