import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '../../node_modules/playwright-core/index.mjs'

// Browser regression coverage for RN Web and the original DOM renderer.
// Actual iOS/Android rendering still requires simulator/device review.
const output = resolve(process.env.SCENE_OUTPUT || 'scene-results')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const errors = [],
  rows = []
const pages = await Promise.all(
  ['web', 'native'].map(async (name) => {
    const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 })
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`))
    return page
  }),
)
const bases = [
  process.env.WEB_SCENE_URL || 'http://127.0.0.1:5178/?capture=native-parity',
  process.env.NATIVE_SCENE_URL || 'http://127.0.0.1:8086/?review=1',
]
const settle = async (page) => {
  await page.getByTestId('review-scene').waitFor()
  await page.waitForTimeout(1600)
}
try {
  for (const scene of ['controls', 'phone'])
    for (const theme of ['light', 'dark', 'blueprint', 'glass'])
      for (const width of [358, 720])
        for (const phase of ['opening', 'typing', 'payoff']) {
          const id = `${scene}-${theme}-${width}-${phase}`
          const boxes = []
          for (const [i, page] of pages.entries()) {
            await page.goto(`${bases[i]}&${new URLSearchParams({ scene, theme, width: String(width), phase })}`)
            await settle(page)
            const frame = page.getByTestId('review-scene')
            const body = await frame.textContent()
            assert.ok(
              body.includes(scene === 'phone' ? 'The coffee looks excellent' : 'Studio workspace'),
              `${id}: missing focal content`,
            )
            if (phase === 'payoff')
              assert.ok(
                body.includes(scene === 'phone' ? 'Perfect. See you there!' : 'maya@studio.design'),
                `${id}: payoff missing`,
              )
            boxes.push(await frame.boundingBox())
            assert.equal(await page.getByTestId('review-error').count(), 0, `${id}: script failed`)
            await frame.screenshot({ path: resolve(output, `${id}-${i ? 'native' : 'web'}.png`) })
          }
          for (const dimension of ['width', 'height'])
            assert.ok(
              Math.abs(boxes[0][dimension] - boxes[1][dimension]) < 2,
              `${id}: mismatched ${dimension}: ${boxes.map((b) => b[dimension])}`,
            )
          rows.push(id)
        }
  // Exercise a live interruption, then request a still while playback is active.
  for (const [i, page] of pages.entries()) {
    for (const theme of ['light', 'dark', 'blueprint', 'glass']) {
      await page.goto(`${bases[i]}&scene=controls&theme=${theme}&phase=opening&width=358`)
      await settle(page)
      for (const state of ['typing', 'payoff', 'opening', 'typing', 'payoff']) {
        await page.getByTestId(`review-${state}`).click()
        await page.waitForTimeout(40)
      }
      await page.waitForTimeout(1600)
      assert.ok((await page.getByTestId('review-scene').textContent()).includes('maya@studio.design'))
      await page
        .getByTestId('review-scene')
        .screenshot({ path: resolve(output, `interrupted-${theme}-${i ? 'native' : 'web'}.png`) })
      await page.getByTestId('review-Play').click()
      await page.waitForTimeout(300)
      await page.getByTestId('review-Play').click()
      await page.waitForTimeout(3300)
      assert.ok((await page.getByTestId('review-scene').textContent()).includes('Ready to collaborate'))
      await page.getByTestId('review-Reduce motion').click()
      const before = await page.getByTestId('review-scene').screenshot()
      await page.waitForTimeout(400)
      const after = await page.getByTestId('review-scene').screenshot()
      assert.ok(before.equals(after), `${theme}: forced reduced-motion frame changed`)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`${bases[i]}&scene=controls&theme=${theme}&phase=opening&width=720`)
      await settle(page)
      await page.getByTestId('review-Play').click()
      await page.waitForTimeout(100)
      assert.ok(
        (await page.getByTestId('review-scene').textContent()).includes('Ready to collaborate'),
        `${theme}: OS reduced-motion poster missing`,
      )
      await page.emulateMedia({ reducedMotion: 'no-preference' })
    }
  }
  assert.deepEqual(errors, [], 'Browser runtime errors')
  const html = `<!doctype html><meta charset="utf-8"><title>Stageshow native scene comparisons</title><style>body{font:14px system-ui;background:#eee;padding:24px}section{background:white;padding:16px;margin:16px 0;break-inside:avoid}img{max-width:48%;vertical-align:top}h1{font-size:26px}</style><h1>48 matching scenes · DOM left, React Native Web right</h1><p>Four themes × two sizes × three states × two scenes. Geometry/content assertions, replay interruption and forced/OS reduced-motion checks passed. These browser captures supplement the separate iOS simulator review; they do not certify Android rendering.</p>${rows.map((id) => `<section><h2>${id}</h2><img src="${id}-web.png"><img src="${id}-native.png"></section>`).join('')}`
  await writeFile(resolve(output, 'index.html'), html)
  await writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      { pairs: rows.length, captures: rows.length * 2, interruptionThemes: 4, renderers: 2, errors },
      null,
      2,
    ),
  )
  console.log(
    `Passed ${rows.length} scene pairs (96 captures), interruption/replay and forced/OS reduced motion in both renderers. Report: ${output}/index.html`,
  )
} finally {
  await browser.close()
}
