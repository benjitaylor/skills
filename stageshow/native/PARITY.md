# Native parity ledger

Baseline: `benjitaylor/skills` at
`802057409787133703c56001080169e347305572`.
Scope: every component, public helper, exported type name and `Act` method in
`stageshow/kit/index.ts`. The original Messages, Subscriptions and Dark Bento compositions now have native
gold examples. Porting the remaining authored examples and browser filming tools
is outside component parity.

## Implemented surface

| Family            | Native implementation                                                                                                                   | Exercise                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Stage             | `Stage`, `useLook`, `useReducedMotion`; looks, compact design dimensions, poster, loop/once/hover playback, cursor, keys, app lifecycle | All preview pages; clock/act/component tests                  |
| Frames            | `Window`, `Bar`, `Text`, `Prompt`, `Caret`                                                                                              | Kit terminal, Motion terminal; native source variants         |
| Devices           | `Phone` (all 9 frames), `LockScreen`, `Notification`, `WALLPAPER`, `Keyboard`                                                           | Inbox and Devices; 9-frame render test                        |
| Messaging         | `Thread`, `Bubble`, `Stamp`, `Receipt`                                                                                                  | Inbox: compose, send, typing, reply, reaction                 |
| Motion            | `Connector`, `Count`, `Roll`, `Swap`, `Collapse`, `Fly`, `Follow`, `States`, `Stream`, `Popover`, `Camera`, `Scroll`, `Expand`          | Kit and Motion; interrupted tween / hidden sizing probe tests |
| Parts             | `Avatar`, `Check`, `Icon`, `Spinner`, `Toast`, `Tooltip`, `Meter`, `Menu`, `Facepile`, `Chip`, `BrandMark`, `Pin`, `Row`                | Kit, Motion and Inbox                                         |
| Controls          | `Field`, `Segmented`, `Toggle`, `Tabs`, `Badge`, `Slot`                                                                                 | Kit and Motion                                                |
| Data              | `Code`, `Chart`, `chartPoints`                                                                                                          | Kit and Motion; chart marker geometry test                    |
| Geometry / timing | `inset`, `box`, `between`, `contains`, `cellOf`, `EASE`, `bezier`, `easeCss`, `clock`, `installVirtualClock`                            | Pure helpers, act tests and Step mode                         |
| Artwork           | Complete `brandMarks`, native cursor shapes, keyboard/status glyphs, superellipse phone outline                                         | Bundled original SVG data; source/license notices retained    |

The API check currently covers 63 runtime exports and 44 type exports. It also
compares explicitly destructured component props, excluding browser `className`.
This count is a coverage guard, not a declaration of visual equivalence.

All `Act` operations are implemented: `set`, `put`, `wait`, `rect`, `caret`,
`center`, `move`, `click`, `scroll`, `cursor`, `snap`, `key`, `stagger`, `mark`,
`type`, `drag`, `place`, and `enter`, plus `signal` and `layout`. The web kit's
development warnings are ported too: missing targets, loop seams (state or cursor
not back at the start), and selection drags that overshoot or never read the caret.
The export check does not cover these, because `checkSeam` and `warn` are internal.

## Platform adaptations

See the native contract in [README.md](README.md). In particular:

- CSS inheritance, custom properties, pseudo-classes, filters and DOM attributes
  are native styles, token values, explicit target registration and SVG masks.
- Fonts and text rasterization follow the host OS. Exact cross-platform pixel
  identity is not claimed. Caret stops are measured from native text prefixes;
  bidirectional text and complex shaping need a dedicated fixture before use
  for a precise selection illustration.
- Native hit testing uses registered target rectangles and parent clip bounds.
  It is not the browser's arbitrary transformed DOM stacking algorithm. Register
  overlay targets and explicitly hide inactive surfaces.
- Targets are measured with one shared stage-root reading per pass. A
  measurement that gets no native reply within 250 ms keeps the last rect.
  Hover and press changes update their own targets without re-rendering the
  stage. Rect changes still re-render it, so a per-frame `a.put()` during a drag
  re-measures every target on each frame. Profile dense drag scenes on device.
- The web kit leaves stage content readable by screen readers. The native stage
  is one labelled image (or a play button) and hides its faux UI.
- Tokens, durations, delays, curves and geometry are the web kit's values. The
  parity suites assert them on the virtual clock for each family. Beat timing
  matches web in virtual time, except that a beat aimed at a named target waits
  for native measurement (asynchronous on React Native Web) and the first beat
  waits for the reset to commit. Resets snap back with motion off, and the
  first frame stays hidden until the container width is known.
- Entrances (a part's mount animation, such as the chart's draw-in or Swap's
  first fade) play through settling and resets, as they do on web, where
  `data-placing` turns off transitions only. Thread rows glide only when a commit
  moves them, as the web kit's FLIP compares tops across a commit. React Native
  Web reports layout only when a size changes, so there the rows read their tops
  just before and after each commit.
- Not reproduced: text blur in Roll, Swap, States, Stream, the receipt and
  fade-ins (React Native has no portable text blur); `saturate()` on frosted
  surfaces; Swap's 8-point resize edge fade; rounded Stream highlight runs;
  Roll's automatic alignment (pass `align`); the shortening of a transition
  reversed mid-flight; the typing dots' first-cycle delays; and the reply morph
  for JSX children that change size (typing and string changes morph).
- Backdrop blur intensities are calibrated on the web build and approximate on
  iOS and Android. Cursor glyph shadows use a layer shadow on iOS and a
  drop-shadow filter elsewhere. SF Pro's 590 weight renders as 600, and the
  phone screen's −0.015em tracking is not inherited by arbitrary text.
- Mono greyscale recolors bundled SVG marks; raster images use the grayscale
  view filter.
- `easeCss` remains available for shared authoring data; native animation uses
  `bezier` and Animated values. Browser CSS strings are not native styles.
- Animated SVG geometry is driven on the JS thread to share a deterministic
  clock. This is intended for small illustration scenes. There is no measured
  frame-rate guarantee for dense scenes or low-end devices.
- Blur appearance and font metrics are platform dependent. Native masks use
  software rendering on Android when animated. Verify that cost on target
  hardware.
- The optional web preview has its own CSS-mask adapter; the upstream browser
  kit remains the web implementation to use in a web product.

## Authoring and visual evidence

The generated demo carries AUTHORING.md, the full shared skill, all 15 unchanged
craft references, original web example sources and an agent entry point. Native
gold examples preserve the original story data and choreography; automated checks
compare those sources and capture both design sizes. The demo defaults to those
examples, with separate component and regression pages.

The new gold check supplies six reduced-motion poster pairs and 24 live sample
pairs, with recordings. The original web examples are imported without restyling.
Live samples use parallel wall-clock deadlines, not a synchronized clock. The existing
48-pair theme/size/state matrix remains complementary coverage. These browser
reports compare DOM and React Native Web; actual iOS evidence is separate.

## Release gate still open

The contribution is ready for maintainer review. Production-release validation
still needs Android device review and the full visual variant matrix. iOS simulator inspection and bundle exports are
recorded separately in [REHEARSAL.md](REHEARSAL.md). In particular, do not infer
that every combination of theme, fidelity, phone frame, window chrome, cursor,
rapid interruption, text shaping, and compact layout has passed from the
export count or the component render test.
