import { DestroyRef, Injectable, computed, inject, signal, type Signal } from '@angular/core'
import type { Look } from '../kit/core'

// The look a stage sets for everything inside it: theme, palette, fidelity,
// and which of its designs (wide or compact) is showing. <ss-stage> provides
// it; parts read it with injectLook(). The Angular side of kit/looks.ts.

const DEFAULT_LOOK: Look = { theme: 'light', palette: 'accent', fidelity: 'standard', layout: 'wide' }

/** What a stage shares with the parts drawn inside it. Each <ss-stage> provides its own. */
@Injectable()
export class StageContext {
  look: Signal<Look> = signal(DEFAULT_LOOK).asReadonly()
  /** A still stage (no script, or reduced motion): motion parts settle instead of tweening. */
  still: Signal<boolean> = signal(false).asReadonly()
}

/** The stage's look, for a part rendered inside it. Outside a stage, the default look. */
export function injectLook(): Signal<Look> {
  return inject(StageContext, { optional: true })?.look ?? signal(DEFAULT_LOOK).asReadonly()
}

/** The viewer's prefers-reduced-motion, as a signal. Call in an injection context. */
export function prefersReducedMotion(): Signal<boolean> {
  const reduced = signal(false)
  if (typeof window === 'undefined' || !window.matchMedia) return reduced.asReadonly()
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const update = () => reduced.set(mq.matches)
  update()
  mq.addEventListener('change', update)
  inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', update))
  return reduced.asReadonly()
}

/** Whether a part should skip its tweens: the viewer asked for reduced motion, or its stage is a still. */
export function injectReducedMotion(): Signal<boolean> {
  const still = inject(StageContext, { optional: true })?.still
  const reduced = prefersReducedMotion()
  return computed(() => !!still?.() || reduced())
}
