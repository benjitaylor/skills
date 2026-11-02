import React from 'react'
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { Animated, StyleSheet, Text as RNText, View, type ViewStyle } from 'react-native'
import { ClipPath, Circle, G, Rect } from 'react-native-svg'
import { clock, installVirtualClock } from '../kit/clock'
import { bezier } from '../kit/ease'
import { MotionContext } from '../kit/reduced-motion'
import { LookContext, resolveTokens, useLook, type Look, type Palette, type Theme } from '../kit/look'
import { SceneView } from '../kit/native'
import { Glass } from '../kit/glass'
import { Bar, Caret, Prompt, Window, termColors } from '../kit/window'
import { Code } from '../kit/code'
import { Chart } from '../kit/chart'
import { DRAW_EASE, chartPoints } from '../kit/chart-geometry'

const look = (theme: Theme = 'light', palette: Palette = 'accent', accent?: string): Look => ({
  theme,
  palette,
  fidelity: 'standard',
  layout: 'wide',
  tokens: resolveTokens(theme, palette, undefined, accent),
})
const moving = { still: false, active: true, instant: false, speed: 1 }
let tree: ReactTestRenderer | undefined
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount())
  tree = undefined
  clock.recording?.restore()
})
function staged(node: React.ReactElement, value: Look = look()) {
  return (
    <MotionContext.Provider value={moving}>
      <LookContext.Provider value={value}>{node}</LookContext.Provider>
    </MotionContext.Provider>
  )
}
async function render(node: React.ReactElement, value?: Look) {
  await act(async () => {
    tree = TestRenderer.create(staged(node, value))
  })
  return tree!
}
const flat = (node: ReactTestInstance) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as ViewStyle & Record<string, unknown>
const value = (v: unknown) => (typeof v === 'number' ? v : (v as { __getValue(): number }).__getValue())
const frame = (renderer: ReactTestRenderer) => flat(renderer.root.findAllByType(SceneView)[0])
/** The three light dots: views as tall as they are wide, fully round. */
const dots = (renderer: ReactTestRenderer, size: number) =>
  renderer.root.findAll((n) => n.type === View && flat(n).width === size && flat(n).borderRadius === size / 2).map(flat)

describe('Window', () => {
  it('frames a native window in canvas with the look radius and window shadow, no border', async () => {
    const light = await render(<Window title="Notes" />)
    expect(frame(light)).toMatchObject({
      backgroundColor: '#f6f5f4',
      borderRadius: 12,
      boxShadow: resolveTokens('light', 'accent').shadow.window,
    })
    expect(frame(light).borderWidth).toBeUndefined()
    const dark = await render(<Window title="Notes" />, look('dark'))
    expect(frame(dark)).toMatchObject({
      backgroundColor: '#111113',
      boxShadow: resolveTokens('dark', 'accent').shadow.window,
    })
  })

  it('draws the title bar at the web metrics: 38px, 1px rule, an optically centered 13px title', async () => {
    const renderer = await render(<Window title="Notes" />)
    const bar = renderer.root.findAll((n) => n.type === View && flat(n).height === 38)[0]
    expect(flat(bar)).toMatchObject({ paddingHorizontal: 14.5, borderBottomWidth: 1, backgroundColor: '#ffffff' })
    const title = renderer.root.findAll((n) => n.type === RNText && n.props.children === 'Notes')[0]
    expect(flat(title)).toMatchObject({ fontSize: 13, fontWeight: '600', marginRight: 36, textAlign: 'center' })
    const unified = await render(<Window title="Notes" toolbar={<View />} />)
    const left = unified.root.findAll((n) => n.type === RNText && n.props.children === 'Notes')[0]
    expect(flat(left)).toMatchObject({ marginLeft: 14, textAlign: 'left' })
  })

  it('colors the lights per chrome, mode and look', async () => {
    expect(dots(await render(<Window />), 9)[0]).toMatchObject({ backgroundColor: '#ff5f57' })
    expect(dots(await render(<Window lights="grey" />), 9)[0]).toMatchObject({
      backgroundColor: 'rgba(186,200,218,0.5)',
    })
    expect(dots(await render(<Window lights="grey" />), 9)[0].boxShadow).toBeUndefined()
    expect(dots(await render(<Window chrome="terminal" lights="grey" />), 9)[0]).toMatchObject({
      backgroundColor: 'rgba(255,255,255,0.16)',
    })
    // white is for the framed chromes; a native window ignores it, as on web
    expect(dots(await render(<Window lights="white" />), 9)[0]).toMatchObject({ backgroundColor: '#ff5f57' })
    expect(dots(await render(<Window chrome="glass" lights="white" url="a.b" />), 8)[0]).toMatchObject({
      backgroundColor: 'rgba(255,255,255,0.5)',
    })
    expect(dots(await render(<Window chrome="card" lights="white" />), 9)[0]).toMatchObject({
      backgroundColor: '#ecf2f7',
    })
    expect(dots(await render(<Window chrome="hairline" />), 5)).toHaveLength(3)
    expect(dots(await render(<Window />, look('blueprint')), 9)[0]).toMatchObject({
      backgroundColor: 'transparent',
      boxShadow: 'inset 0 0 0 1px rgba(214,232,255,0.35)',
    })
    expect(dots(await render(<Window />, look('light', 'mono')), 9)[0]).toMatchObject({
      backgroundColor: 'rgba(0,0,0,0.15)',
    })
    expect(dots(await render(<Window lightsSize="large" />), 12)).toHaveLength(3)
  })

  it('makes the blueprint bar and address field outlines', async () => {
    const renderer = await render(<Window url="site.app" />, look('blueprint'))
    const bar = renderer.root.findAll((n) => n.type === View && flat(n).height === 38)[0]
    expect(flat(bar).backgroundColor).toBe('transparent')
    const field = renderer.root.findAll((n) => n.type === View && flat(n).paddingHorizontal === 10)[0]
    expect(flat(field)).toMatchObject({
      backgroundColor: 'transparent',
      boxShadow: 'inset 0 0 0 1px rgba(214,232,255,0.2)',
    })
  })

  it('frosts glass chrome under its own tint and insets the page as a white card', async () => {
    const renderer = await render(<Window chrome="glass" url="northwind.app" />)
    expect(frame(renderer)).toMatchObject({ backgroundColor: 'transparent', borderRadius: 12 })
    expect(renderer.root.findAllByType(Glass)).toHaveLength(1)
    expect(
      renderer.root.findAll((n) => n.type === View && flat(n).backgroundColor === 'rgba(248,250,253,0.45)'),
    ).toHaveLength(1)
    const field = renderer.root.findAll((n) => n.type === View && flat(n).height === 20)[0]
    expect(flat(field)).toMatchObject({
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.38)',
      paddingHorizontal: 8,
    })
    const page = renderer.root.findAllByType(SceneView)[1]
    expect(flat(page)).toMatchObject({ marginHorizontal: 6, marginBottom: 6, borderRadius: 6, backgroundColor: '#fff' })
  })

  it('frosts every native window in the glass theme and none of the opaque chromes', async () => {
    expect((await render(<Window />, look('glass'))).root.findAllByType(Glass)).toHaveLength(1)
    expect((await render(<Window />)).root.findAllByType(Glass)).toHaveLength(0)
    expect((await render(<Window chrome="card" />, look('glass'))).root.findAllByType(Glass)).toHaveLength(0)
  })

  it('draws card and hairline frames at their web values', async () => {
    const card = await render(<Window chrome="card" url="pay.app" />)
    expect(frame(card)).toMatchObject({ backgroundColor: '#fff', borderRadius: 8 })
    const field = card.root.findAll((n) => n.type === View && flat(n).height === 24)[0]
    expect(flat(field)).toMatchObject({ backgroundColor: '#ecf2f7', borderRadius: 4, paddingHorizontal: 10 })
    const hairline = await render(<Window chrome="hairline" url="pay.app" />)
    const bar = hairline.root.findAll((n) => n.type === View && flat(n).height === 20)[0]
    expect(flat(bar)).toMatchObject({ borderBottomWidth: 1, paddingHorizontal: 8 })
  })

  it('draws a terminal on its own dark surface with a centered title, and keeps a custom accent', async () => {
    let accent = ''
    function Probe() {
      accent = useLook().tokens.accent
      return null
    }
    const renderer = await render(
      <Window chrome="terminal" title="northwind — zsh">
        <Probe />
        <Prompt path="~/app">npm test</Prompt>
      </Window>,
      look('light', 'accent', '#ff0066'),
    )
    expect(frame(renderer)).toMatchObject({ backgroundColor: termColors.background, borderRadius: 12 })
    expect(frame(renderer).boxShadow).toBe(
      `inset 0 0 0 1px rgba(255,255,255,0.07), ${resolveTokens('light', 'accent').shadow.hero}`,
    )
    expect(accent).toBe('#ff0066')
    const title = renderer.root.findAll((n) => n.type === RNText && n.props.children === 'northwind — zsh')[0]
    expect(flat(title)).toMatchObject({ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.42)' })
    const overlay = renderer.root.findAll((n) => n.type === View && n.props.pointerEvents === 'none')[0]
    expect(flat(overlay)).toMatchObject({ position: 'absolute', left: 0, right: 0, alignItems: 'center' })
    const body = renderer.root.findAllByType(SceneView)[1]
    expect(flat(body)).toMatchObject({ gap: 3, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16 })
    // a prompt after output stands clear of it
    expect(flat(renderer.root.findByType(Prompt).parent!)).toMatchObject({ marginTop: 8 })
  })

  it('types prompt lines in mono at the web colors', async () => {
    const renderer = await render(
      <Prompt path="~">
        ls
        <Caret still />
      </Prompt>,
    )
    const [path, sigil] = renderer.root.findAll((n) => n.type === RNText).map(flat)
    expect(path).toMatchObject({ color: '#6f8ccf', fontFamily: resolveTokens('light', 'accent').mono, fontSize: 11.5 })
    expect(sigil).toMatchObject({ color: '#6ee7a8', marginHorizontal: 7 })
  })

  it('lays out tabs, a floating sidebar and a tall bar at the web metrics', async () => {
    const tabs = await render(<Window tabs={['Inbox', 'Docs']} url="mail.app" />)
    const strip = tabs.root.findAll((n) => n.type === View && flat(n).alignItems === 'flex-end')[0]
    expect(flat(strip)).toMatchObject({ height: 38, gap: 2, backgroundColor: '#f6f5f4' })
    const tab = tabs.root.findAll((n) => n.type === View && flat(n).width === 140)
    expect(tab).toHaveLength(2)
    expect(flat(tab[0])).toMatchObject({ height: 30, borderTopLeftRadius: 8, backgroundColor: '#ffffff' })
    const floating = await render(<Window sidebar={<View />} sidebarStyle="floating" title="Mail" />)
    expect(frame(floating)).toMatchObject({ borderRadius: 24, backgroundColor: '#ffffff' })
    const top = floating.root.findAll((n) => n.type === View && flat(n).height === 22)[0]
    expect(flat(top).paddingHorizontal).toBe(6.5)
    const tall = await render(<Window barSize="tall" title="Finder" />)
    const bar = tall.root.findAll((n) => n.type === View && flat(n).height === 64)[0]
    expect(flat(bar)).toMatchObject({
      paddingTop: 10,
      paddingHorizontal: 21.5,
      borderBottomWidth: 0,
      alignItems: 'flex-start',
    })
  })

  it('recedes over 0.3s', async () => {
    const c = installVirtualClock()
    const renderer = await render(<Window />)
    await act(async () => renderer.update(staged(<Window receded />)))
    await act(async () => c.advance(150))
    const midway = value(frame(renderer).opacity)
    expect(midway).toBeGreaterThan(0.4)
    expect(midway).toBeLessThan(1)
    await act(async () => c.advance(200))
    expect(value(frame(renderer).opacity)).toBeCloseTo(0.4)
  })

  it('caps a placeholder line at its container only when it gives way', async () => {
    const line = await render(<Bar w={90} />)
    expect(frame(line)).toMatchObject({ maxWidth: '100%', minWidth: 0, flexShrink: 1 })
    const icon = await render(<Bar w={10} h={10} />)
    expect(frame(icon).maxWidth).toBeUndefined()
  })
})

describe('Code', () => {
  const lines = [
    { text: 'const total = sum(2)' },
    { text: '  ready: "yes",', kind: 'add' as const },
    { text: '  // gone', kind: 'del' as const },
  ]
  const color = (renderer: ReactTestRenderer, text: string) =>
    flat(renderer.root.findAll((n) => n.type === RNText && n.props.children === text)[0]).color
  it('colors syntax per theme and palette', async () => {
    const light = await render(<Code lines={lines} />)
    expect([color(light, 'const'), color(light, 'sum'), color(light, '2'), color(light, '"yes"')]).toEqual([
      '#7c3aed',
      '#2563eb',
      '#b45309',
      '#15803d',
    ])
    expect(color(light, '// gone')).toBe('#9a9a9d')
    const dark = await render(<Code lines={lines} />, look('dark'))
    expect([color(dark, 'const'), color(dark, 'sum'), color(dark, '2'), color(dark, '"yes"')]).toEqual([
      '#c4b5fd',
      '#93c5fd',
      '#fdba74',
      '#86efac',
    ])
    const blueprint = await render(<Code lines={lines} />, look('blueprint'))
    expect([color(blueprint, 'const'), color(blueprint, '"yes"'), color(blueprint, '// gone')]).toEqual([
      '#f0f6ff',
      '#b3c9ec',
      '#7fa1da',
    ])
    const mono = await render(<Code lines={lines} />, look('dark', 'mono'))
    expect(color(mono, 'const')).toBe('#ececee')
  })

  it('sets mono type, the 19px line, the gutter and diff tints at the web values', async () => {
    const renderer = await render(<Code lines={lines} />)
    const t = resolveTokens('light', 'accent')
    const number = renderer.root.findAll((n) => n.type === RNText && n.props.children === 1)[0]
    expect(flat(number)).toMatchObject({
      width: 30,
      paddingRight: 10,
      fontSize: 11.5,
      lineHeight: 19,
      fontFamily: t.mono,
      fontVariant: ['tabular-nums'],
      color: t.textFaint,
    })
    const rows = renderer.root.findAll((n) => n.type === View && flat(n).height === 19 && flat(n).paddingRight === 12)
    expect(rows.map((n) => flat(n).backgroundColor)).toEqual(['transparent', t.successSoft, t.dangerSoft])
    const mark = renderer.root.findAll((n) => n.type === RNText && n.props.children === '+')[0]
    expect(flat(mark)).toMatchObject({ width: 16, color: t.successText, fontFamily: t.mono, fontSize: 11.5 })
  })

  // Named, so the rows stay out of the instant scope SceneView gives every unnamed view (native.tsx); see the report
  it('fades a streamed line in over 0.3s', async () => {
    const c = installVirtualClock()
    const renderer = await render(<Code target="code" lines={lines} count={1} />)
    const opacity = () =>
      renderer.root
        .findAll((n) => n.type === Animated.View && flat(n).height === 19 && flat(n).paddingRight === 12)
        .map((n) => value(flat(n).opacity))
    expect(opacity()).toEqual([1, 0, 0])
    await act(async () => renderer.update(staged(<Code target="code" lines={lines} count={2} />)))
    await act(async () => c.advance(150))
    expect(opacity()[1]).toBeGreaterThan(0)
    expect(opacity()[1]).toBeLessThan(1)
    await act(async () => c.advance(200))
    expect(opacity()[1]).toBe(1)
  })
})

describe('Chart', () => {
  const data = [3, 6, 4, 8],
    size = { width: 100, height: 40 }
  const wipe = (renderer: ReactTestRenderer) =>
    renderer.root.findByType(ClipPath).findByType(Rect).props.width as number
  // Svg wraps its children in a root G; the drawing is the one clipped by the wipe
  const drawing = (renderer: ReactTestRenderer) => renderer.root.findAll((n) => n.type === G && !!n.props.clipPath)[0]
  it('draws a line in over 1.2s on its own curve, then fades it out whole when hidden', async () => {
    const c = installVirtualClock()
    const renderer = await render(<Chart data={data} {...size} />)
    const [first, , , last] = chartPoints({ data, ...size })
    const at = (ms: number) => first.x + (last.x - first.x) * bezier(DRAW_EASE)(ms / 1200) + 6
    await act(async () => c.advance(300))
    expect(wipe(renderer)).toBeCloseTo(at(300), 0)
    await act(async () => c.advance(1000))
    expect(wipe(renderer)).toBe(size.width + 12)
    await act(async () => renderer.update(staged(<Chart data={data} {...size} show={false} />)))
    await act(async () => c.advance(120))
    expect(wipe(renderer)).toBe(size.width + 12)
    const fading = drawing(renderer).props.opacity
    expect(fading).toBeGreaterThan(0)
    expect(fading).toBeLessThan(1)
    await act(async () => c.advance(200))
    expect(drawing(renderer).props.opacity).toBe(0)
    expect(renderer.root.findByType(Circle).props.r).toBeCloseTo(3.5 * 0.4)
  })

  it('grows the end dot in with an overshoot when shown again, and redraws', async () => {
    const c = installVirtualClock()
    const renderer = await render(<Chart data={data} {...size} show={false} />)
    expect(renderer.root.findByType(Circle).props.opacity).toBe(0)
    await act(async () => renderer.update(staged(<Chart data={data} {...size} />)))
    await act(async () => c.advance(10))
    expect(wipe(renderer)).toBeLessThan(size.width)
    await act(async () => c.advance(220))
    expect(renderer.root.findByType(Circle).props.r).toBeGreaterThan(3.5)
  })

  // Named for the same reason as the streamed code lines
  it('mounts bars at full height and grows them only when shown', async () => {
    const c = installVirtualClock()
    const heights = (renderer: ReactTestRenderer) =>
      renderer.root
        .findAllByType(Rect)
        .filter((n) => n.props.fill === resolveTokens('light', 'accent').accent)
        .map((n) => n.props.height as number)
    const bars = (show: boolean) => <Chart target="chart" kind="bars" data={data} {...size} show={show} />
    const renderer = await render(bars(true))
    expect(heights(renderer)[3]).toBeCloseTo(38)
    await act(async () => renderer.update(staged(bars(false))))
    await act(async () => c.advance(800))
    expect(heights(renderer)).toEqual([0, 0, 0, 0])
    await act(async () => renderer.update(staged(bars(true))))
    await act(async () => c.advance(350))
    expect(heights(renderer)[0]).toBeGreaterThan(0)
    expect(heights(renderer)[0]).toBeLessThan(38 * (3 / 8))
  })
})
