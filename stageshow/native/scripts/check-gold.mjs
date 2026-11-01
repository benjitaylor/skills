import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '../../node_modules/playwright-core/index.mjs'

// Guard against accidental drift in the ported story, not just matching a final frame.
for (const [example, start, end] of [
  ['messages', 'type S', 'function ArrowUp'],
  ['subscriptions', 'type Pulse', 'function Checkout'],
]) {
  const web = await readFile(new URL(`../../examples/${example}/index.tsx`, import.meta.url), 'utf8')
  const native = await readFile(new URL(`../examples/${example}-model.ts`, import.meta.url), 'utf8')
  const clean = (text) =>
    text
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, '')
  assert.equal(
    clean(native.slice(native.indexOf(start), native.lastIndexOf('export {'))),
    clean(web.slice(web.indexOf(start), web.indexOf(end))),
    `${example}: gold choreography changed`,
  )
}

const output = resolve(process.env.GOLD_OUTPUT || 'gold-results')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const errors = [],
  rows = []
const bases = [
  process.env.WEB_GOLD_URL || 'http://127.0.0.1:5178/?capture=native-gold',
  process.env.NATIVE_GOLD_URL || 'http://127.0.0.1:8086/?capture=1',
]
try {
  for (const gold of ['messages', 'subscriptions', 'dark-bento'])
    for (const width of [358, 720]) {
      const boxes = []
      const id = `${gold}-${width}`
      for (const [renderer, base] of bases.entries()) {
        const page = await browser.newPage({
          viewport: { width: 900, height: 900 },
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
        })
        page.on('pageerror', (e) => errors.push(`${id}: ${e.message}`))
        await page.goto(`${base}&gold=${gold}&width=${width}&poster=1`)
        const frame = page.getByTestId('gold-scene')
        await frame.waitFor()
        await page.waitForTimeout(1200)
        const text = await frame.textContent()
        assert.ok(
          text.includes(
            gold === 'messages'
              ? "Perfect, I'll grab us a table by the window"
              : gold === 'subscriptions'
                ? 'Studio Kite'
                : 'Added by Mara',
          ),
          `${id}: meaningful poster missing`,
        )
        assert.equal(await page.getByTestId('gold-error').count(), 0)
        boxes.push(await frame.boundingBox())
        await frame.screenshot({ path: resolve(output, `${id}-${renderer ? 'native' : 'web'}.png`) })
        const before = await frame.screenshot()
        await page.waitForTimeout(200)
        assert.ok(before.equals(await frame.screenshot()), `${id}: reduced-motion poster moved`)
        await page.close()
      }
      for (const dim of ['width', 'height'])
        assert.ok(Math.abs(boxes[0][dim] - boxes[1][dim]) < 2, `${id}: ${dim} differs`)
      rows.push(id)
    }
  if (!process.env.GOLD_STILLS_ONLY)
    for (const gold of ['messages', 'subscriptions'])
      for (const width of [358, 720]) {
        // Sample the same elapsed times in both renderers; videos retain the intervening frames.
        const contexts = await Promise.all(
          bases.map(() =>
            browser.newContext({
              viewport: { width: 900, height: 900 },
              deviceScaleFactor: 1,
              reducedMotion: 'no-preference',
              recordVideo: { dir: output, size: { width: 900, height: 900 } },
            }),
          ),
        )
        const pages = await Promise.all(contexts.map((c) => c.newPage()))
        const id = `${gold}-${width}-live`
        pages.forEach((page, i) => page.on('pageerror', (e) => errors.push(`${id}-${i}: ${e.message}`)))
        await Promise.all(pages.map((page, i) => page.goto(`${bases[i]}&gold=${gold}&width=${width}`)))
        let previous = 0
        for (const ms of [1000, 3500, 6500, 10000, 14000, 18000]) {
          await Promise.all(pages.map((p) => p.waitForTimeout(ms - previous)))
          for (const [i, page] of pages.entries()) {
            assert.equal(await page.getByTestId('gold-error').count(), 0, `${id}: native choreography failed`)
            await page
              .getByTestId('gold-scene')
              .screenshot({ path: resolve(output, `${id}-${ms}-${i ? 'native' : 'web'}.png`) })
          }
          previous = ms
          rows.push(`${id}-${ms}`)
        }
        await Promise.all(contexts.map((c) => c.close()))
        for (const [i, page] of pages.entries()) {
          await page.video().saveAs(resolve(output, `${id}-${i ? 'native' : 'web'}.webm`))
          await page.video().delete()
        }
      }
  assert.deepEqual(errors, [])
  await writeFile(
    resolve(output, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Original gold / native</title><style>body{font:14px system-ui;background:#eee;padding:24px}section{background:white;padding:16px;margin:16px 0}img{max-width:48%;vertical-align:top}</style><h1>Original gold left · React Native Web right</h1><p>Original components are imported without restyling. Posters and live sequences use the original design sizes and compact layouts. Samples are taken at matching elapsed waits, not a synchronized virtual clock; live poses may differ by capture/paint timing. Native device evidence is separate.</p>${rows.map((id) => `<section><h2>${id}</h2><img src="${id}-web.png"><img src="${id}-native.png"></section>`).join('')}`,
  )
  await writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        pairs: rows.length,
        errors,
        originalsRestyled: false,
        liveSampling: 'matching elapsed waits; not frame-locked',
      },
      null,
      2,
    ),
  )
  console.log(`Passed ${rows.length} gold pairs. Report: ${output}/index.html`)
} finally {
  await browser.close()
}
