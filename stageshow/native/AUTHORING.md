# Authoring Stageshow for React Native

Start here for Expo or React Native. The original Stageshow craft rules still
apply. A native implementation changes rendering and measurement, not the bar
for composition. Read [the shared skill](../SKILL.md), then
[craft](../references/craft.md) and [framing](../references/framing.md) in full.
Use the [native API contract](README.md#native-contract) for platform details.

## Start from a native gold example

| Brief                         | Native starting point                       | Original reference       | Preserve                                                                                                                            |
| ----------------------------- | ------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| A phone conversation          | [Messages](examples/Messages.tsx)           | `examples/messages`      | 420 × 340 / 358 × 340 stage, 326-point phone, bottom gutter 16, phone bleeding above the stage; measured composer-to-bubble handoff |
| A system story / billing hero | [Subscriptions](examples/Subscriptions.tsx) | `examples/subscriptions` | 720 × 440 / 358 × 460; checkout overlaps the sidebar, never the amount; price flies to the new row and revenue follows              |
| A dark feature tile           | [Dark Bento](examples/DarkBento.tsx)        | `examples/dark-bento`    | 360 × 280 / 358 × 280; one window beyond two edges, album sleeves, one raised satellite, one explanation                            |

The default demo opens these compositions. Components is the parts catalog;
Compare contains controlled regression fixtures. A catalog or test fixture is
not the visual standard for a product illustration.

Copy the closest native example and its model/shared helpers. Preserve its crop,
row pitch, type scale and motion sequence before replacing its product content.
For another composition, inspect the original web example alongside its CSS;
translate the layout to native views, not a screenshot or a WebView. Do not copy
CSS declarations into React Native styles and hope they inherit.

## Seven decisions, in order

1. **Place.** State the real host width, background, focal object and payoff.
   Design compact at 358 points independently of desktop. Scaling a 720-point
   dashboard until its type is tiny is a failed compact design.
2. **Look.** Map the product's fonts, color and shape to Stage tokens. Read
   [looks](../references/looks.md) and [backgrounds](../references/backgrounds.md).
   Set text styles on Text or the component's text prop: native views do not
   cascade fonts. Avatar accepts `textStyle`; view `style` controls its fill. Its `background`
   slot accepts clipped native artwork; Facepile accepts custom `avatars` while
   retaining the kit’s overlap masks. Spinner accepts `color` for contrast on
   filled controls; its default uses the accent token.
3. **Story.** Write three to five beats, each caused by a gesture or a visible
   system event. Read [motion](../references/motion.md) and
   [choreography](../references/choreography.md). Keep the original timing while
   porting. Shorten reading time only after watching it at its actual size.
4. **Frame.** Put the poster beside the gold before animating. Keep one gutter,
   crop only filler and device continuation, keep meaningful controls whole,
   and let a secondary surface overlap quiet space. For grids read
   [bento](../references/bento.md). A full phone centered inside another card is
   not a substitute for an intentional crop.
5. **Screen.** Usually 3–7 meaningful strings, with surrounding rows still
   recognizable. Placeholder bars use the kit's ink tones. Keep album art,
   recognizable chrome and appropriate icons. Read
   [products](../references/products.md), [brands](../references/brands.md),
   [annotations](../references/annotations.md) and the relevant entries in
   [kit](../references/kit.md). That kit reference describes the web API;
   native prop differences are in the native API contract.
6. **Choreograph.** Register custom targets with SceneView. Await `a.set()` before
   measuring; use `a.rect()` rather than guessed coordinates. Retain incoming and
   outgoing surfaces so changes animate. Keep words at their real size during
   a resize. Cancel on replay/unmount. Hide inactive targets. A loop resets out
   of sight or through a visible cause; a once-only conversation can hold its
   result until explicitly replayed.
7. **Rehearse.** Supply the meaningful poster first. Record the actual native
   simulator/device at real speed, then inspect the press, departure, arrival,
   receipt, reply and loop boundary. Test replay mid-transition, navigation away
   and back, and reduced motion during playback. Use
   [verify](../references/verify.md), [teaching](../references/teaching.md),
   [rehearse](../references/rehearse.md) and a fresh reviewer following
   [review](../references/review.md). Record what was and was not checked.

## Native translation checklist

- **Type:** use the same point size, weight, letter spacing and explicit line
  height as the reference. Use system fonts unless the product specifies one.
  Compare visible baselines and wrapping, not just declared sizes. Do not fix
  a font mismatch by making the whole scene smaller.
- **Surfaces:** use translucent ink for isolated filler; opaque fills for
  overlapping faces and cards. Dark depth comes from surface steps. Native blur
  and font rasterization vary; inspect both platforms rather than claiming
  identical pixels from a web preview.
- **Chrome:** use Window and Phone. Preserve their status bar, island, home
  indicator, traffic lights and content dimensions. Use native styles for
  authored layout, not modifications to the device's inner geometry.
- **Masks and shadows:** choose which view clips the content and which casts
  the shadow. SVG masks and animated SVG work have platform costs. The iOS
  Phone rasterization opt-out is documented in the API contract; judge text
  sharpness at displayed size and profile representative hardware.
- **Touch:** a desktop pointer is not a phone gesture. Use the touch cursor and
  visible press feedback for phone stories. Authored controls illustrate an
  interaction; they do not submit forms or send real messages.
- **Accessibility:** give Stage a useful description, honor the OS reduced-motion
  preference, and keep demo host controls accessible at normal text sizes.
  The illustration's designed type scale and the host app's Dynamic Type are
  different responsibilities. Test screen readers and large host text on devices.

## Evidence and limits

`npm run check:gold` compares the three native compositions with the unmodified
web gold components, including compact and wide posters and live sequences.
`npm run check:scenes` covers the broader theme/state regression matrix. Browser
captures compare DOM with React Native Web. They do not prove native iOS or
Android pixels, frame time, or accessibility behavior.

Use the poster comparison first, then the recording. A test passing does not
establish visual parity: the focal scale, hierarchy, crop, surfaces and motion
must hold beside the actual reference. Document intentional platform differences
and outstanding device work in REHEARSAL.md. The definitive coverage record is
[PARITY.md](PARITY.md), not the number of exports or screenshots.
