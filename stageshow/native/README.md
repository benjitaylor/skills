# Stageshow for React Native

A native adaptation of the Stageshow illustration kit, with the complete public
component vocabulary and the same `Stage` / `Act` choreography model. Scenes use
React Native views and text, Animated values, and SVG paths. There is no WebView.

This is a contribution preview. [PARITY.md](PARITY.md) separates implemented
coverage, native API adaptations, and validation still needed before calling the
port production ready. The existing web kit remains a separate entry point.

Read [AUTHORING.md](AUTHORING.md) for the native authoring workflow and exact gold
starting points. The standalone generator includes this guidance, every original
craft reference and the original web example sources for comparison.

## Preview

Use Node 22.13 or later and npm. From this folder:

```sh
npm ci
npm run ios       # Xcode simulator, or Expo Go on a matching iOS device
npm run android   # running Android emulator or connected device
npm run web       # optional React Native Web preview
```

The Expo 57 demo opens **Examples** (Messages, Subscriptions and Dark Bento),
with **Components** (Inbox, Kit, Motion, and Devices) and
**Compare** (matching web/native controls and phone stories). Choose a theme
and fidelity, switch to the poster, replay, or use Focus for a larger view.
Step mode starts a fresh scene on the kit's virtual clock. Advance by 50 ms to
inspect a transition, or one second to reach the next beat. The host controls
continue using native time. Leave step mode to restore live playback.

## Create a standalone demo

```sh
npm run create:demo -- /path/to/new-folder
cd /path/to/new-folder
npm ci
npm run ios
```

The generator refuses existing folders and includes all source and licenses.
It does not import the parent repository. See [demo/README.md](demo/README.md).
Compare scenes supports four themes, opening/typing/payoff beats, compact/wide
layouts, live replay, Reduce motion and Focus. Wide layouts need a landscape
phone or tablet. Focus leaves only Back and Replay above the scene.

## Use in an Expo app

Copy `kit/`, `brand-sources/`, `LICENSE`, and `NOTICE.md` together into your app.
Keep relative imports inside the kit intact. Install compatible dependencies in
the host project:

```sh
npx expo install react-native-svg @react-native-masked-view/masked-view expo-blur
npm install lucide-react-native
```

The preview currently verifies Expo 57, React 19.2, and React Native 0.86. Other
versions need their own validation. A bare React Native app also needs Expo
modules configured for `expo-blur`; alternatively replace the two blur surfaces
with the host's native blur implementation. Rebuild a development client after
adding native dependencies.

```tsx
import { View } from 'react-native'
import { Stage, Row, Check, type Act } from './stageshow/kit'

const initial = { saved: false }

async function script(a: Act<typeof initial>) {
  await a.wait(600)
  await a.click('save')
  await a.set({ saved: true })
  await a.wait(1400)
}

export function SaveStory({ visible = true }: { visible?: boolean }) {
  return (
    <Stage
      width={358}
      height={160}
      initial={initial}
      poster={{ saved: true }}
      script={script}
      play="once"
      visible={visible}
      cursor={{ at: { x: 320, y: 130 }, style: 'touch' }}
      accessibilityLabel="A document is saved"
    >
      {(s) => (
        <View style={{ padding: 24 }}>
          <Row target="save" cursor="hand" title="Project brief" meta={s.saved ? 'Saved' : 'Save'}>
            <Check on={s.saved} />
          </Row>
        </View>
      )}
    </Stage>
  )
}
```

These are authored illustrations. `a.click()` draws cursor feedback; `a.set()`
changes scene state. They do not operate real app controls.

## Native contract

- Use `SceneView` for custom targets. Kit surfaces accept `target` / `cursor`,
  and the aliases `data-target` / `data-cursor`. A plain `View` does not register
  itself with the scene. Names are unique within a stage.
- `style` uses React Native values. Replace DOM tags with native views and text;
  replace CSS selectors with `hoverStyle` and `pressedStyle`. Text styles belong
  on `Text` or the relevant text prop. Native styles do not cascade.
- `useLook().tokens` exposes native colors, radius, font size and font family.
  `Stage tokens` accepts those token keys, rather than CSS custom properties.
- Measurements and cursor targets use stage design coordinates. The stage
  accounts for host scaling; phone contents lay out at native point sizes.
  `rect(name, { layout: true })` ignores the target's own transform. Call
  `await a.set(...)` before measuring new content.
- Set `visible` from navigation focus / list viewability. Backgrounding the app
  cancels the current script. A visible return restarts an interrupted run;
  a completed `once` scene remains complete until `replay` changes.
- `play="hover"` starts on pointer entry in the web preview. On iOS/Android it
  shows the poster until tapped, then plays once; another tap replays it.
- The OS Reduce Motion preference always wins. `reducedMotion` and `specimen`
  can force a still for previews. Always supply a meaningful `poster`.
- `Phone` rasterizes its displayed bounds on iOS to keep text sharp through
  nested scaling. Set `shouldRasterizeIOS={false}` to opt out. This trades an
  offscreen bitmap and memory for rendering quality; it is not a performance
  guarantee. Profile animation-heavy scenes on your target hardware.
- `Thread` takes its natural content height by default, as on web. Set
  `style={{ flex: 1 }}` explicitly when a conversation should fill a screen.
  Phone messages use phone text sizes, while standalone threads remain smaller.
- `Phone wallpaper` takes a color, `WALLPAPER`, or a native image source.
  `Phone bezel` supplies the optional photo frame. CSS gradients and image URLs
  in CSS variables become native SVG / image content.
- `brandMarks` contains the original artwork as SVG XML strings rather than
  browser URLs. `BrandMark` accepts custom image/SVG URIs through `src`.
- The virtual clock is kit-local. It never replaces `Date`, native timers, or
  React Native's animation scheduler. Install it before mounting scenes and
  unmount them before restoring it. `epoch` is accepted for source compatibility
  but does not change native `Date`. Pass an async `onLayout` callback when the
  host needs to wait for native layout between virtual frames.

## Verify a change

```sh
npm run typecheck
npm test
npm run check:parity
npm run check:demo
npm run format:check
npx expo install --check
```

Stop the development server before exporting:

```sh
npm run export
```

`check:parity` compares the upstream public exports and explicitly consumed
component props. It guards API coverage; it does not certify behavior or pixels.
Tests exercise clock isolation, cancellation, native targets, scrolling, Unicode
typing, interrupted tweens, hidden targets and retained transition layers. The
playground render test mounts every page and all nine phone frame variants.

Also run `npm run typecheck` and `npm run check:css` in the parent Stageshow folder.
For native visual review, use the simulator/device plus Step mode. The web
`film.mjs` DOM probes do not inspect native views. Follow the composition and
motion questions in `../references/verify.md` and record actual device coverage
in [REHEARSAL.md](REHEARSAL.md). An export is a bundle check, not a device test.

## Matching-scene checks

The CI workflow installs the parent web kit and this demo, checks both, exports
native/web bundles, recreates a standalone app, then runs `npm run check:scenes`.
It uploads an HTML report with 96 screenshots: two scenes × four themes × two
sizes × three beats × two renderers. The test also interrupts transitions,
replays mid-story, and checks forced and OS reduced motion.

To run locally, export web first with the dev server stopped:

```sh
npx expo export --platform web --output-dir web-dist
# Serve web-dist on 127.0.0.1:8086 and the parent Vite playground on port 5178.
# Install Chromium from the parent: npx playwright-core install chromium
npm run check:scenes
```

`CHROME_PATH`, `WEB_SCENE_URL`, `NATIVE_SCENE_URL` and `SCENE_OUTPUT` override the
browser, URLs and report folder. These are DOM and React Native Web comparisons;
iOS simulator/device captures remain a separate review. The test asserts scene
bounds, content, cancellation and stable reduced-motion frames, not pixel
identity. Typography and native blur can differ by platform.

## Updating shared artwork

Run `node scripts/sync-brands.mjs` from this folder after an upstream brand update.
It embeds the original SVG XML and copies source/license notices. Device,
keyboard, cursor and geometry changes should be compared with their upstream
counterparts during review; those native adaptations are intentionally readable
source files, not a runtime dependency on the DOM kit.

## Gold reference comparisons

`npm run check:gold` renders the original, unmodified Messages, Subscriptions and
Dark Bento beside the native renditions, at compact and wide design sizes. It
checks meaningful reduced-motion posters, frame bounds, runtime errors and
unchanged choreography data, then records both renderers and samples the live
sequences. Matching elapsed waits are not frame-locked; use the recordings to
judge timing. Reports live in `gold-results/` and are uploaded by CI.

Use the same servers as the matching-scene check. `GOLD_STILLS_ONLY=1` runs the
poster pass; `GOLD_OUTPUT`, `WEB_GOLD_URL` and `NATIVE_GOLD_URL` override paths.
The native demo's Examples tab is the composition reference; Components and
Compare remain diagnostic tools.

Spinner accepts a native `color` prop for contrast on filled surfaces. Avatar
accepts `textStyle` and a clipped `background` artwork slot; Facepile accepts
custom `avatars` while keeping its overlap masks. These replace web text/color
inheritance and selector styling in native compositions.
