# Native rehearsal — 2026-11-01

Status: ready for maintainer review; full device and release validation remains open.
Reference: upstream web kit at `802057409787133703c56001080169e347305572`.

## Automated checks

- Native TypeScript check: passed.
- Jest: 26 tests across clock, choreography, geometry and native component suites.
  Includes interrupted tween retargeting, lifecycle cancellation, touch playback,
  scrolling and clipping, Unicode typing, target suppression for sizing probes,
  closed expansion faces, safe clock restoration, all gallery pages and all nine
  phone frames. These are not screenshot tests.
- Public API check: all 63 runtime exports and 44 type exports present; explicitly
  consumed component props compared, with browser `className` excluded.
- Native formatting and Expo dependency compatibility: passed.
- iOS and Android Metro/Hermes exports: passed. Optional web export: passed.
- Parent web TypeScript and CSS namespace checks: passed (81 CSS files).

Exports verify resolution and bundling. They do not establish Android rendering,
device performance, or visual equivalence.

## iOS inspection

Preview environment: Expo Go SDK 57, iPhone 17 Pro simulator, iOS 26.5.
The Inbox scene was observed through its sent/read/reply payoff and in its dark
poster. The native preview's focus, replay, poster and virtual clock controls were
exercised. Frame stepping uses real native layout opportunities between virtual
frames; it deliberately takes real time to advance a scene.

The Kit poster was inspected for component layout. The Motion scene reached its
file-transfer payoff with the list scrolled and the expansion closed again. This
review caught and corrected a closed expansion face exposing its screen content,
and the empty-field caret appearing after its placeholder. Step mode was checked
at 0.05 s, 1.00 s, and 2.00 s; the last frame showed the in-progress typed message.
The Devices gallery mounted all nine frames; its first phone, lock screen and
notification stack were visually inspected. This does not substitute for reviewing
each frame and platform combination.

A separate visual reviewer compared the Inbox payoff with a capture of the web
Messages example, without reading the native implementation. Findings were:

1. The full phone and keyboard competed with the conversation. The native scene
   was reframed to crop into the exchange and composer.
2. The back chevron pointed right and the empty composer showed a paper plane.
   The chevron is corrected; the composer uses a microphone when empty and an
   upward send arrow while typing.
3. Text and edges inside the scaled phone looked softer than the surrounding
   playground controls. Pixel-scale rendering needs further inspection on real
   devices; this remains open.

A second still review confirmed the improved Inbox framing and microphone, and
found no additional obvious Kit poster regression. Its keyboard-boundary crop
and doubled expansion-card corner findings were corrected in the playground.

The two reference captures had different conversation states. They are evidence
for composition, not a frame-by-frame motion comparison. The upstream browser
film also reported uneven gutters in its reference scene; no native film gate is
inferred from that browser run. Generated captures are excluded from git.

## Remaining production-release validation

- Android emulator and physical-device review, including animated masks, native
  blur, text measurement and cursor targeting. No Android device run was available
  for this rehearsal.
- Physical iOS review and release-build frame-time measurements. The deterministic
  SVG/tween clock runs on the JS thread; performance has not been certified.
- Matched opening, typing, action, payoff and reset captures for every motion
  family, including rapid interruption and overlapping target geometry.
- Theme/fidelity/chrome/cursor variants at compact and wide host sizes; native
  Reduce Motion setting changes, navigation/background transitions, large text,
  RTL and complex shaping. Unit tests cover some logic, not this visual matrix.
- Verify the iOS phone rasterization tradeoff and text sharpness on physical devices.

Use [PARITY.md](PARITY.md) for the implementation ledger and platform adaptations.
Do not describe this rehearsal as full behavioral or visual parity.

## Second review pass — demo and matching scenes

The scaled phone softness was reproduced on iPhone 17 Pro / iOS 26.5. Removing
only the mask did not resolve it. Rasterizing the outer phone at its displayed
bounds did, while retaining the superellipse mask and original phone size.
`shouldRasterizeIOS` remains overridable; no memory/frame-time benchmark is
claimed. React Native sets the rasterization scale to the device display scale
when that flag is enabled.

The new standalone demo includes the gallery plus two shared web/native fixtures.
A common data/choreography file names opening, typing and payoff. The native and
DOM renditions use explicit platform layout styles. Comparison exposed and fixed
rounded pill styling, status/blueprint colors, chart marker styling, glass color
placement, a subpixel measurement truncation, phone message sizing and vertical
spacing, reaction anchoring and keyboard upper corners. The web reference's
black Count on dark/blueprint is retained as an upstream reference defect; native
keeps readable text. Matching captures do not claim pixel identity.

The new checks bring the total to 30 passing tests. They add matching fixture
mounts, replay cancellation during typing, meaningful OS reduced-motion posters
and URL option validation. Browser checks cover 48 scene pairs / 96 captures,
plus rapid state interruption, repeated playback and both forced/OS reduced
motion in each theme and renderer. The HTML report is an artifact, not committed
output. The workflow runs these checks and validates the generated demo.

Actual iOS inspection covers four themes in both scenes, the compact layout,
the wide controls layout in landscape, and replay/reduced-motion interaction.
A fresh screenshot review was used to find the corrections above. The short
recording and matching-scene report are linked from the PR. Generated evidence
is kept outside source control. Android rendering, physical devices, performance,
all fidelity/chrome/cursor combinations and exhaustive shaping/RTL remain open.

## Third review pass — original gold compositions and guidance

The default demo now opens native renditions of `examples/messages`,
`examples/subscriptions` and `examples/dark-bento`. Their original content,
script data, timings, crop and compact compositions are retained. The browser
comparison imports the original components without restyling them.

Comparison corrected inherited ink/border values, system-font rendering in the
web preview, measured tabular digit widths, window URL/chrome styling, phone
content inset and shadow, avatar artwork/text styling, radial gradients, album
cover edges, composer glyphs and the checkout loading indicator's contrast.
Native SVG ellipse radii need a separate browser adapter because browser SVG
uses a radius plus transform. The native renderer keeps its own rx/ry behavior.

Validation: 34 tests in six suites; native and web TypeScript; CSS namespace
check; 63-value/44-type API coverage; iOS/Android Hermes and web exports. The
48-pair theme/size/state matrix also passed interruption, replay and forced/OS
reduced-motion checks in both browser renderers. Gold coverage adds six stable
reduced-motion poster pairs and 24 sampled live pairs, plus recordings and a
source check that the two ported stories retain the original choreography.
Live capture uses parallel wall-clock deadlines, not a synchronized virtual clock;
intermediate poses may differ because of paint/capture timing.

A fresh reviewer compared all 12 gold poster frames and all 24 live sample
pairs. Findings were cover depth, checkout word spacing, composer glyph weight
and spinner contrast; those were corrected. Actual iPhone 17 Pro / iOS 26.5
inspection covers all three compact gold posters, message playback and the
subscription loop. The review includes a native screen recording. This is
simulator evidence, not a physical-device performance measurement. Android
rendering, accessibility services, shaping/RTL and the exhaustive variant matrix
remain open as recorded above.

The standalone generator now includes AUTHORING.md, the shared skill, all 15
unchanged craft references, original example sources, the native API guide and
AGENTS.md routing. Its check verifies those files, guide links and refusal to
overwrite an existing destination. The web example sources are comparison
material; native examples are the runnable starting points. Browser filming
commands in the original references still belong to the contribution checkout.

## Review fixes — 2026-11-01

A code review against the web kit found four gaps; each now has a test that fails
on the previous code.

- Accessibility: the stage's `accessibilityLabel` was ignored on iOS because the
  view was not `accessible`, and VoiceOver read the faux UI as real controls. The
  stage is now one labelled image (or a play button) with its contents hidden.
- Authoring warnings: missing-target, loop-seam and selection-drift warnings from
  the web kit were absent. They now run in development builds.
- Stalled measurement: a native measurement that timed out became a 0×0 rect,
  moving the cursor's aim and hit testing. A timeout now keeps the last rect.
- Measurement cost: each target measured the stage root separately, measured
  twice on mount and repeated its layout measurement on unchanged passes. Hover
  and press changes re-rendered and re-measured the whole stage. Targets now
  share one root reading, layout is re-read only when the rect changes, and
  interactions update only their own targets. Device frame times are still unmeasured.

Validation: native TypeScript and the Jest suites (41 tests). Device, Android and
browser comparison runs were not repeated for these changes; CI covers the
browser comparisons.

## Visual and motion parity pass — 2026-11-02

Every native family was audited line by line against the web kit (stage, Act and
cursor; motion parts; windows, code and charts; phones, keyboard and messages;
parts and controls). Tokens, durations, delays, curves and geometry now use the
web values; the parity suites assert them on the virtual clock (156 tests).

Root causes found on the way, each with a regression test:

- Every unnamed `SceneView` passed an instant motion context to its subtree, so
  most tweens snapped instead of animating.
- `useTween` defaulted to a front-loaded curve where the web uses CSS `ease`,
  `ease-out` or a named curve; parts now pass the web curve explicitly.
- Resets animated back from the poster; they now commit with motion off, as
  web's `data-placing` does, while entrances (draw-ins, mount fades) still play.
- Count digits rolled one stagger late, and their window drifted on React
  Native Web because a measured line height is rounded there.
- Thread rows glided on every layout pass rather than on commits only, so rows
  dipped while a receipt or reply was still opening.

Evidence:

- `npm run check:motion` (new) steps the web original and the native port on one
  virtual clock. Subscriptions: 13 of 13 beats within one 50 ms sample, 77 and 78
  moving frames. Messages: 37 and 38 moving frames. Phone fixture: 2 of 2 beats.
  Controls: all beats except a one-line Swap fade on the compact fixture's first
  mount after its layout switch, which native does not play yet.
- Poster differences (pixels differing by more than 24 levels): Subscriptions
  0.7% / 0.3%, Dark Bento 0.1% / 0.1%, Messages 3.8% / 3.3%. Messages sits about
  one point lower inside the phone on native, a rounding of the phone's scale
  that predates this pass. Comparison scenes: controls 0.7–0.9% (was 1.3–4.8%),
  phone 4.4–6.5% (was 6.3–12.5%); the remainder is text rasterization.
- iOS Simulator (iPhone 17 Pro, iOS 26.5, Expo Go): Messages, Subscriptions and
  Dark Bento played through; Inbox and Kit checked in light and dark; Devices
  lock screen inspected. The thread no longer dips when the typing bubble or
  reply arrives.
- Type check, Jest, API parity, formatting, standalone demo check, Expo
  dependency check, iOS/Android export, and the parent web kit's type and CSS
  checks pass.

Not covered: Android device or emulator runs, physical iOS frame times, the full
theme × fidelity × chrome × cursor matrix, and text blur, which React Native
cannot draw portably (see PARITY.md).
