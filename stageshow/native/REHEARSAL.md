# Native rehearsal — 2026-11-01

Status: contribution preview; full visual and device parity is still an open gate.
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

## Required before removing draft status

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
- Resolve the scaled-phone text softness noted above, and inspect glyphs at 4×.

Use [PARITY.md](PARITY.md) for the implementation ledger and platform adaptations.
Do not describe this rehearsal as full behavioral or visual parity.
