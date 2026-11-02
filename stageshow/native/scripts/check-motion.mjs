import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '../../node_modules/playwright-core/index.mjs'

// Frame-locked motion comparison. The web original and the native port each run on their own
// virtual clock, stepped by the same milliseconds, so a different curve, delay or beat shows at the
// frame where it starts instead of hiding in wall-clock capture jitter. Web gets the kit's clock as
// an init script; the native web build installs its own when the URL has clock=virtual.
const esbuild = createRequire(new URL('../../package.json', import.meta.url))('esbuild')
const clockSource =
  esbuild.buildSync({
    entryPoints: [fileURLToPath(new URL('../../kit/clock.ts', import.meta.url))],
    bundle: true,
    format: 'iife',
    globalName: '__ssClock',
    write: false,
  }).outputFiles[0].text + '\n__ssClock.installVirtualClock({})'

const webBase = process.env.WEB_MOTION_URL || 'http://127.0.0.1:5178/'
const nativeBase = process.env.NATIVE_MOTION_URL || 'http://127.0.0.1:8086/'
const every = Number(process.env.MOTION_EVERY || 50)
const output = resolve(process.env.MOTION_OUTPUT || 'motion-results')
const gold = (name, width, ms) => ({
  web: `?capture=native-gold&gold=${name}&width=${width}`,
  native: `?capture=1&gold=${name}&width=${width}`,
  id: 'gold-scene',
  ms,
})
const review = (scene, theme, width, ms) => ({
  web: `?capture=native-parity&scene=${scene}&theme=${theme}&width=${width}`,
  native: `?review=1&scene=${scene}&theme=${theme}&width=${width}`,
  id: 'review-scene',
  play: 'review-Play',
  ms,
})
const scenes = {
  'messages-358': gold('messages', 358, 14000),
  'subscriptions-720': gold('subscriptions', 720, 14000),
  'controls-light-358': review('controls', 'light', 358, 3600),
  'controls-dark-720': review('controls', 'dark', 720, 3600),
  'phone-light-358': review('phone', 'light', 358, 3600),
}
const only = process.env.MOTION_SCENES?.split(',').filter(Boolean)
for (const name of only ?? []) assert.ok(scenes[name], `unknown scene ${name}: ${Object.keys(scenes).join(', ')}`)
const MOVING = 0.002

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const results = []
const errors = []
try {
  const lab = await browser.newPage()
  // Fraction of pixels whose largest channel differs by more than 24, read on canvases.
  const difference = (a, b) =>
    lab.evaluate(
      async ([a, b]) => {
        const load = async (src) => createImageBitmap(await (await fetch(src)).blob())
        const [x, y] = await Promise.all([load(a), load(b)])
        const w = Math.max(x.width, y.width),
          h = Math.max(x.height, y.height)
        const read = (image) => {
          const g = new OffscreenCanvas(w, h).getContext('2d')
          g.fillStyle = '#fff'
          g.fillRect(0, 0, w, h)
          g.drawImage(image, 0, 0)
          return g.getImageData(0, 0, w, h).data
        }
        const p = read(x),
          q = read(y)
        let n = 0
        for (let i = 0; i < p.length; i += 4)
          if (Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])) > 24) n++
        return n / (w * h)
      },
      [a, b].map((png) => `data:image/png;base64,${png.toString('base64')}`),
    )
  for (const [name, scene] of Object.entries(scenes)) {
    if (only && !only.includes(name)) continue
    const dir = resolve(output, name)
    await mkdir(dir, { recursive: true })
    const open = async (label, url, inject) => {
      const page = await browser.newPage({
        viewport: { width: 900, height: 1000 },
        deviceScaleFactor: 2,
        reducedMotion: 'no-preference',
      })
      page.on('pageerror', (e) => errors.push(`${name} ${label}: ${e.message}`))
      if (inject) await page.addInitScript({ content: clockSource })
      await page.goto(inject ? url : `${url}&clock=virtual`)
      await page.waitForFunction(() => !!window.__stageshow?.clock, null, { timeout: 15000 })
      // Mount one virtual frame at a time, so both scenes start from the same frame.
      for (let i = 0; ; i++) {
        assert.ok(i < 240, `${name} ${label}: scene did not mount`)
        await page.evaluate(() => window.__stageshow.clock.step(1))
        const box = await page.getByTestId(scene.id).boundingBox()
        if (box?.width && box.height) break
      }
      if (scene.play) {
        await page.getByTestId(scene.play).click()
        await page.evaluate(() => window.__stageshow.clock.step(1))
      }
      return page
    }
    const pages = [await open('web', webBase + scene.web, true), await open('native', nativeBase + scene.native, false)]
    const frames = []
    let previous = null
    for (let t = 0, i = 0; t <= scene.ms; t += every, i++) {
      const shots = []
      for (const page of pages) {
        if (t) await page.evaluate((n) => window.__stageshow.clock.step(n), Math.round(every / (1000 / 60)))
        shots.push(await page.getByTestId(scene.id).screenshot({ animations: 'allow' }))
      }
      const file = (who) => `${String(i).padStart(4, '0')}-${who}.png`
      await writeFile(resolve(dir, file('web')), shots[0])
      await writeFile(resolve(dir, file('native')), shots[1])
      frames.push({
        t,
        differ: await difference(shots[0], shots[1]),
        web: previous ? await difference(previous[0], shots[0]) : 0,
        native: previous ? await difference(previous[1], shots[1]) : 0,
      })
      previous = shots
    }
    await Promise.all(pages.map((page) => page.close()))
    // A beat is a run of moving frames after a still one. Pair each web beat with the nearest native one.
    const beats = (who) =>
      frames.flatMap((f, i) => {
        if (f[who] <= MOVING || (i && frames[i - 1][who] > MOVING)) return []
        let end = i
        while (frames[end + 1]?.[who] > MOVING) end++
        return [{ start: f.t, ms: frames[end].t - f.t + every }]
      })
    const web = beats('web'),
      native = beats('native')
    const paired = web.map((beat) => {
      const match = native.reduce(
        (best, b) => (Math.abs(b.start - beat.start) < Math.abs(best?.start - beat.start) || !best ? b : best),
        null,
      )
      return { web: beat, native: match, offset: match ? match.start - beat.start : null }
    })
    const moving = (who) => frames.filter((f) => f[who] > MOVING).length
    const result = {
      name,
      every,
      frames: frames.length,
      meanDiffer: frames.reduce((s, f) => s + f.differ, 0) / frames.length,
      movingFrames: { web: moving('web'), native: moving('native') },
      beats: paired,
      timeline: frames,
    }
    results.push(result)
    const late = paired.filter((p) => p.offset === null || Math.abs(p.offset) > every)
    console.log(
      `${name}: ${(result.meanDiffer * 100).toFixed(1)}% mean difference; moving frames web ${result.movingFrames.web}, native ${result.movingFrames.native}; ${paired.length - late.length}/${paired.length} beats within ${every}ms`,
    )
    for (const p of late)
      console.log(
        `  beat at ${p.web.start}ms (${p.web.ms}ms on web): ${p.native ? `native at ${p.native.start}ms for ${p.native.ms}ms` : 'no native motion'}`,
      )
  }
  assert.deepEqual(errors, [])
  const strip = (r) =>
    r.timeline
      .map((f, i) => ({ ...f, i }))
      .filter((f, i, all) => f.i % 10 === 0 || (f.web > MOVING && !(all[i - 1]?.web > MOVING)))
      .map((f) => {
        const png = (who) => `${r.name}/${String(f.i).padStart(4, '0')}-${who}.png`
        return `<figure><figcaption>${f.t}ms · ${(f.differ * 100).toFixed(1)}% differ</figcaption><img src="${png('web')}"><img src="${png('native')}"></figure>`
      })
      .join('')
  const chart = (r) => {
    const w = 900,
      h = 80,
      x = (i) => (i / Math.max(1, r.timeline.length - 1)) * w
    const line = (key, color, flip) =>
      `<polyline fill="none" stroke="${color}" stroke-width="1.5" points="${r.timeline
        .map((f, i) => `${x(i).toFixed(1)},${(h / 2 + (flip ? 1 : -1) * Math.min(h / 2, f[key] * 400)).toFixed(1)}`)
        .join(' ')}"/>`
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" stroke="#ccc"/>${line('web', '#3b82f6')}${line('native', '#f97316', true)}</svg>`
  }
  await writeFile(
    resolve(output, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Frame-locked motion</title><style>body{font:14px system-ui;background:#eee;padding:24px}section{background:#fff;padding:16px;margin:16px 0}figure{display:inline-block;margin:4px;vertical-align:top}figure img{width:180px;display:inline-block;margin-right:2px}figcaption{font-size:11px;color:#666}</style><h1>Web original (left) · React Native Web (right), on one virtual clock</h1><p>Both renderers advance ${every}ms per sample. In the timeline, blue above the line is web motion and orange below is native motion. A beat that starts later, runs shorter or snaps shows as a shifted or missing orange shape. Fonts and blur differ by renderer, so a difference that holds still across frames is a layout or style difference, not motion.</p>${results.map((r) => `<section><h2>${r.name}</h2><p>Mean difference ${(r.meanDiffer * 100).toFixed(1)}%. Moving frames: web ${r.movingFrames.web}, native ${r.movingFrames.native}.</p>${chart(r)}<div>${strip(r)}</div></section>`).join('')}`,
  )
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ every, results }, null, 2))
  console.log(`Report: ${output}/index.html`)
} finally {
  await browser.close()
}
