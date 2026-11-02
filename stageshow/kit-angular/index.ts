// Stageshow for Angular 20+: standalone components, signals, zoneless-ready.
// The script API, clock, measuring and CSS are kit/'s own; copy kit/ beside
// this folder (see references/angular.md). Components load their own CSS.

import { BarComponent, CaretComponent, PromptComponent, TextComponent, WindowComponent, WindowLead, WindowSidebar, WindowToolbar, WindowUrl } from './window.component'
import { SceneDirective } from './scene.directive'
import { StageComponent } from './stage.component'

// The stage: the canvas, the script, the cursor, measuring and playback
export { StageComponent } from './stage.component'
export type { Play, LookTokens, StageCursor, StageCompact } from './stage.component'
export { SceneDirective } from './scene.directive'
export type { SceneContext } from './scene.directive'
export { StageContext, injectLook, injectReducedMotion, prefersReducedMotion } from './look'
export { CursorComponent } from './cursor.component'
export { KeycapsComponent } from './keycaps.component'

// Frames and small parts
export { WindowComponent, WindowSidebar, WindowToolbar, WindowLead, WindowUrl, BarComponent, TextComponent, PromptComponent, CaretComponent } from './window.component'

// Shared with the React kit: the script API, measuring, the clock, easing
export type { Act, Script } from '../kit/act'
export { inset, box, between, contains } from '../kit/measure'
export type { Point, Rect, Target } from '../kit/measure'
export type { CursorKind, CursorStyle, Theme, Palette, Fidelity, Layout, KeysAt } from '../kit/core'
export { clock, installVirtualClock } from '../kit/clock'
export type { ClockControl } from '../kit/clock'
export { EASE, bezier, css as easeCss } from '../kit/ease'
export type { EaseName, Bezier } from '../kit/ease'

/** Everything a scene template uses, for a component's `imports`. */
export const STAGESHOW = [
  StageComponent,
  SceneDirective,
  WindowComponent,
  WindowSidebar,
  WindowToolbar,
  WindowLead,
  WindowUrl,
  BarComponent,
  TextComponent,
  PromptComponent,
  CaretComponent,
] as const
