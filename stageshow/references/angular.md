# Stageshow in Angular

`kit-angular/` binds the kit to Angular 20 and later: standalone components,
signal inputs, OnPush, zoneless-ready. It is a binding, not a fork. The
script API (`Act`), the clock, measuring, easing and every style are `kit/`'s
own files, so a script written for the React kit runs unchanged, and film.mjs
films an Angular stage the same way.

Everything else in this skill (framing, craft, motion, rehearsal, the gold
bar) applies as written. Read it the same way; only the markup changes.

## Set up

Copy `kit/` and `kit-angular/` side by side into the project (for example
`src/stageshow/kit` and `src/stageshow/kit-angular`). `kit-angular/` imports
only the framework-free files of `kit/` (`act.ts`, `core.ts`, `clock.ts`,
`ease.ts`, `measure.ts`, `util.ts`) and its CSS; the React `.tsx` files are
never reached and need no React install. Components load their own CSS
(`ViewEncapsulation.None`, as the kit's global classes expect).

```ts
import { STAGESHOW, type Act } from './stageshow/kit-angular'

@Component({ imports: [STAGESHOW], ... })
```

Zoneless (`provideZonelessChangeDetection()`) and Zone.js both work.

## The stage

`<Stage>`'s render function becomes an `<ng-template ssScene>`. Bind the
initial state to it to type the template's variables:

```html
<ss-stage [width]="560" [height]="400" [initial]="initial" [script]="script" play="once"
          [cursor]="{ at: { x: 520, y: 370 } }" [compact]="{ below: 560, width: 358, height: 420 }">
  <ng-template [ssScene]="initial" let-s let-rect="rect" let-layout="layout">
    <ss-window url="app.northwind.co/signup">
      <span class="fe-button" data-target="create" data-cursor="pointer">Create account</span>
    </ss-window>
  </ng-template>
</ss-stage>
```

- Every `StageProps` field is an input of the same name. `class` on
  `<ss-stage>` lands where React's `className` does (the `.ss-fit` box).
- The script is a plain function, `(a: Act<S>) => Promise<void>`, the same
  as React's. Keep it outside the component, or in a field, so its identity
  is stable: a new script starts a fresh scene.
- Mark targets with `data-target` and `data-cursor` as in React. A bound one
  is `[attr.data-target]`.
- `rect(name)` in the template, `injectLook()` and `injectReducedMotion()` in
  a part replace `useLook()` and `useReducedMotion()`.

## Parts

| React | Angular |
|---|---|
| `<Window url title tabs nav ...>` | `<ss-window>` with the same inputs. `sidebar`, `toolbar` and `lead` are content slots: an element marked `ssSidebar`, `ssToolbar`, `ssLead`. A url as markup is `ssUrl`. `body={{ className, 'data-crop' }}` is `bodyClass` and `bodyCrop`. |
| `<Bar w h tone r>` | `<ss-bar [w] [h] [tone] [r]>`. Recolor with `[style.background]`: a template binding wins over the tone, a static `style` attribute does not. |
| `<Text>copy</Text>` | `<ss-text text="copy">`; `filler`, `wrap`, `w`, `h`, `tone` as in React, and `size` for the bar estimate (React reads `style.fontSize`). |
| `<Prompt path>`, `<Caret still>` | `<ss-prompt path>`, `<ss-caret still>` |

Selectors use the `ss-` prefix, like the kit's classes, not an app prefix.

## What is ported

The stage and everything the script API drives: fitting and the compact
layout, play modes (loop, once, hover), visibility and on-screen pausing,
reduced motion and posters, the cursor (every kind and style, idle, ripple),
keycaps, measuring and `rect()`, the look (theme, palette, fidelity, greys,
tokens, accent, ground), and the window chrome with its small parts.

Not ported yet: phones and iOS parts, messages, the motion parts (`Roll`,
`Swap`, `Collapse`, `Fly`, `Follow`, `States`, `Stream`, `Popover`,
`Camera`, `Scroll`, `Expand`, `Count`, `Connector`), the small parts and
controls (`Row`, `Avatar`, `Icon`, `Field`, `Badge` and the rest), `Code` and
`Chart`. Build those in the scene with the kit's CSS classes, or port one at a
time following `window.component.ts`: same class names and data attributes,
CSS loaded with `styleUrl`, no change to `kit/`.

## Verify

`playground-angular/` serves the ported examples in `examples-angular/` on
Angular 20, the oldest release supported:

```sh
cd playground-angular
npm install
npm run dev          # http://localhost:4300, ?capture=<id> for one example
npm run build        # strict templates, extended diagnostics as errors
```

Film as in React: `node scripts/film.mjs 'http://localhost:4300/?capture=cursor-resize' --select '#example' --gate`.
A ported example should film with the same findings as its React original.
