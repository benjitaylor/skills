# Right to left

Arabic, Hebrew, Persian and Urdu read right to left, and their interfaces mirror: the title on the right, the back button pointing right, a list's icon on the right of its words, a sheet's close on the left. A scene for one of them is written right to left from the start, not an English scene flipped. `examples/checkout-ar` is the gold: copy it the way step 4 says.

```tsx
<Stage width={400} height={520} dir="rtl" /* lang="ar", digits="arab" by default */>
  {(s, rect, layout, dir) => …}
</Stage>
```

`dir="rtl"` sets `dir` and `lang` on the stage, and the kit does the mirroring: every part is written with logical properties (`inset-inline-start`, `margin-inline-end`, `text-align: start`), so rows, chrome, bubbles, the status bar, toggles, segmented thumbs, meters and chevrons flip with no work from the scene. `lang` defaults to `ar`; set `he` or `fa` for those. `digits` defaults to `arab` (Eastern Arabic ٠١٢٣, with ٫ for the decimal point and ٬ for thousands) for a scene written rtl, and `latn` for everything else; Saudi banking and government apps mostly show Western digits, so pass `digits="latn"` when the product does.

## What mirrors and what never does

Mirrors, and the kit handles it: layout and reading order, a window's traffic lights (to the top right, red outermost, as macOS draws them in Arabic), the iOS status bar (time on the right, the glyphs on the left, the battery facing left), back and next chevrons, arrows and send, a meter's or slider's fill (it grows from the right), a toggle's knob, a thread (mine on the left with the tail on the left corner), a sheet's or card's growth corner, a list's leading icon, a scrollbar.

Never mirrors: the digits of one number (a phone number, a card's last four, 541 stay in order), checkmarks, logos and brand marks, clocks, photographs and illustrations, media playback (transport buttons and the timeline read left to right in every language), a keyboard's keys (a fixed object; `Keyboard rows` takes a layout from a screenshot of the real one), code, terminals, URLs and email addresses, and time charts (`Chart` is drawn left to right, and any axis labels a scene adds go in a `dir="ltr"` row with it, never one mirrored and the other not). Mark anything else that is left to right by nature `dir="ltr"`.

## Writing a scene that mirrors

Use logical properties everywhere a scene places something by design: `inset-inline-start`, `padding-inline`, `margin-inline-end`, `border-inline-start`, `text-align: start`, and in a style object `insetInlineStart`. A four-value shorthand with unequal sides (`padding: 0 34px 0 52px`, `inset: 0 auto 0 0`, `border-radius: 8px 8px 0 0` is fine, `12px 4px 4px 12px` is not) is physical: split it into `-block` and `-inline`. A hand-written slide multiplies by the stage's sign, `translateX(calc(12px * var(--ss-x)))`; `--ss-x` is 1 in ltr and -1 in rtl. `npm run check:rtl` lists every physical property left in kit and example code.

Some things stay physical on purpose, each marked with a `physical:` comment so the check passes them: an element moved by a translate from a measured rect (a dragged card, a follower, a cursor, a peer's pointer) keeps `left: 0` and is moved from the left in both directions; anything centered with `left: 50%` and `translate(-50%)`; a canvas scaled from its top left (the phone's screen). Mixing the two on one element is the trap: an inline `left` from a measured rect plus a stylesheet `inset-inline-start` and a width gives the browser three constraints, and in rtl it drops `left`, so the element sits wherever the stylesheet put it.

Measured geometry needs nothing. `rect()`, `a.center()` and named targets are physical and land wherever the layout put them, and a box fraction (`{ at: 'pay', x: 0.8 }`) is read from the box's start edge, so `0.8` is near the end in both directions. Raw points stay physical, like `rect()`, so a point a scene writes by hand is written with the direction: `fromStart(r, dx, dy, a.dir)` for a spot inside a measured box (`row.x + 176` only holds in ltr), `mirror(p, width, a.dir)` for a design-space point (a cursor's resting place), `sign(a.dir)` for a direction of travel (a swipe toward the start, a resize toward the end). The render function's fourth argument is the same `dir`. A scene with its own geometry (an SVG path that wraps a margin, a junction past a column) computes in the line's own space with `mirrorRect()` and maps each x back with `mirrorX()`; `examples/annotations/composed.tsx` does it for a whole annotation. `cursor.at` as a raw point is physical too: give it a named target when the scene mirrors.

## Type

Arabic joins its letters, and any tracking breaks the joins; the stage zeroes letter-spacing under `:lang(ar)`, so a look's negative tracking for Latin display type never reaches Arabic. Arabic sets smaller than Latin at the same size, its letters sitting lower and narrower: a one-word label at the bottom of the type scale (a timestamp, a badge) takes a step up. Write plain Arabic, without tashkeel beyond standard tanween; full vocalization reads as a textbook. No fonts are bundled: `--ss-font-arabic` (default `"SF Arabic", "Noto Sans Arabic"`) is put ahead of the look's font in an Arabic scene, and those faces carry no Latin letters, so English words fall through to the look. A look with its own Arabic face sets the token.

A mixed line reads right: an English word or a number inside Arabic is its own left-to-right run, and the paragraph keeps its order. Roll gives text with no rtl letters an ltr direction, and Count is always ltr inside, so a rolling price never reorders. An English scene filmed with `--rtl` shows bidi artifacts in its English text ("24 KB" as "KB 24", a question mark at the start): that is the Unicode bidi algorithm doing its job on English in an rtl paragraph, so judge layout in that film, not text.

## Numbers and money

`digits` converts every text node of the stage as it renders; code, terminals, URLs and anything marked `data-digits="latn"` keep Western digits. Write numbers in Western digits in the scene, or with `formatNumber(n, digits, opts)`; Count and Roll parse either and draw the stage's. `Money` writes an amount in riyals with the sign SAMA set in 2025 (U+20C1), on the number's left with a space in every language: `<Money value={187.5} />` draws ⃁ ١٨٧٫٥٠ in an Arabic scene. Few fonts draw U+20C1 yet, so `Riyal` draws it from vector paths. `sign="abbr"` writes ر.س after the number, as a bank's SMS or a system notification still does.

## Checking

Film it right to left the way it will be seen, and run the gate: `node scripts/film.mjs "<preview>/?capture=<yours>" --select '#example' --gate`. The film checks read the stage's direction, so a window bleeding off the left in an rtl stage is the right crop, and lines are compared at their start edge. `--rtl` films any stage mirrored (layout only: language and digits follow what the scene was written in), which is how an ltr scene is checked for mirroring before it is translated; `?dir=rtl` previews the same in the playground. A host page that crops a stage on one side mirrors its own crop in rtl; `--rtl` flips stages, not the page around them.
