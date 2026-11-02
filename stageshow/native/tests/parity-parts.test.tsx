// Parts and controls against the web kit's CSS: the numbers each one draws
// with, and the pace and curve each state change takes on the kit clock.
import React from 'react'
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { Animated, Image, Text as RNText, StyleSheet, View } from 'react-native'
import { Circle, Path, SvgXml } from 'react-native-svg'
import { clock, installVirtualClock } from '../kit/clock'
import { bezier, type Bezier } from '../kit/ease'
import { LookContext, resolveTokens, type Palette, type Theme } from '../kit/look'
import { MotionContext } from '../kit/reduced-motion'
import { SceneContext } from '../kit/native'
import { Registry } from '../kit/registry'
import { PhoneContext } from '../kit/phone'
import { brandMarks, type BrandName } from '../kit/brands'
import { Avatar, BrandMark, Check, Chip, Icon, Menu, Meter, Pin, Row, Spinner, Toast, Tooltip } from '../kit/parts'
import { InkContext } from '../kit/parts/Icon'
import { greyscaleXml, mixColor } from '../kit/parts/paint'
import { Badge, Field, Segmented, Slot, Tabs, Toggle } from '../kit/controls'

const EASE: Bezier = [0.25, 0.1, 0.25, 1]
const SETTLE: Bezier = [0.22, 1, 0.36, 1]
const at = (curve: Bezier, t: number) => bezier(curve)(t)

let tree: ReactTestRenderer | undefined
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount())
  tree = undefined
  clock.recording?.restore()
})
const motion = { still: false, active: true, instant: false, speed: 1 }
function Scene({
  theme = 'light',
  palette = 'accent',
  registry,
  children,
}: {
  theme?: Theme
  palette?: Palette
  registry?: Registry
  children: React.ReactNode
}) {
  const look = {
    theme,
    palette,
    fidelity: 'standard' as const,
    layout: 'wide' as const,
    tokens: resolveTokens(theme, palette),
  }
  const scene = registry && { registry, root: { current: null }, width: 400, height: 400, scale: 1 }
  return (
    <LookContext.Provider value={look}>
      <MotionContext.Provider value={motion}>
        <SceneContext.Provider value={scene ?? null}>{children}</SceneContext.Provider>
      </MotionContext.Provider>
    </LookContext.Provider>
  )
}
async function render(node: React.ReactElement) {
  await act(async () => {
    tree = TestRenderer.create(node)
  })
  return tree!
}
const advance = async (ms: number) => act(() => clock.recording!.advance(ms))
type Style = Record<string, unknown>
const flat = (node: ReactTestInstance) => (StyleSheet.flatten(node.props.style) ?? {}) as Style
const read = (value: unknown): unknown =>
  value && typeof (value as { __getValue?: unknown }).__getValue === 'function'
    ? (value as { __getValue(): unknown }).__getValue()
    : value
const css = (value: unknown) => String(read(value)).replace(/\s/g, '')
const alphaOf = (value: unknown) => Number(/,([\d.]+)\)$/.exec(css(value))?.[1])
const channels = (color: string) => (/\(([^)]*)\)/.exec(color.replace(/\s/g, ''))?.[1] ?? '').split(',').map(Number)
// Animated colours carry alpha in 8 bits, as every native colour does: 0.06 lands on 15/255.
function same(value: unknown, expected: string) {
  const [r, g, b, a = 1] = channels(css(value)),
    [er, eg, eb, ea = 1] = channels(expected)
  expect([r, g, b]).toEqual([er, eg, eb])
  expect(Math.abs(a - ea)).toBeLessThanOrEqual(1 / 255)
}
const views = (root: ReactTestInstance) => root.findAll((n) => n.type === Animated.View)
const byId = (root: ReactTestInstance, id: string) => views(root).find((n) => n.props.testID === id)!
const text = (root: ReactTestInstance, content: string) =>
  root.findAll((n) => (n.type === RNText || n.type === Animated.Text) && n.props.children === content)[0]
const light = resolveTokens('light', 'accent'),
  dark = resolveTokens('dark', 'accent')

it('mixes colours premultiplied and greys only paints in mono marks', () => {
  expect(mixColor('transparent', 'rgba(59,130,246,0.12)', 0.5)).toBe('rgba(59,130,246,0.06)')
  expect(mixColor('#000000', '#ffffff', 0.5)).toBe('rgba(128,128,128,1)')
  const xml = greyscaleXml(
    '<svg><path fill="#1434CB" style="fill:#ff0000"/><rect fill="url(#abc)"/><use href="#abc"/></svg>',
  )
  // Rec. 709 luma: 0.2126 * 0x14 + 0.7152 * 0x34 + 0.0722 * 0xcb = 56, and pure red 54
  expect(xml).toContain('fill="#383838"')
  expect(xml).toContain('fill:#363636')
  expect(xml).toContain('url(#abc)')
  expect(xml).toContain('href="#abc"')
})

it('draws the spinner at the web geometry in the ink around it, turning once every 0.8s', async () => {
  installVirtualClock()
  const r = await render(
    <Scene>
      <InkContext.Provider value="#fff">
        <Spinner testID="spin" />
      </InkContext.Provider>
    </Scene>,
  )
  const spin = byId(r.root, 'spin')
  expect(flat(spin)).toMatchObject({ width: 14, height: 14 })
  expect(spin.findAllByType(Circle)[0].props).toMatchObject({
    r: 6.25,
    stroke: '#fff',
    strokeOpacity: 0.18,
    strokeWidth: 1.5,
  })
  expect(spin.findAllByType(Path)[0].props).toMatchObject({ d: 'M8 1.75a6.25 6.25 0 0 1 6.25 6.25', strokeWidth: 1.5 })
  await advance(400)
  expect(read((flat(spin).transform as Style[])[0].rotate)).toBe('180deg')
})

it('highlights menu rows on ink-2, at once under the cursor and easing out over 0.15s', async () => {
  installVirtualClock()
  const registry = new Registry()
  const r = await render(
    <Scene registry={registry}>
      <Menu testID="menu" items={['Open', 'Move']} value={1} targets={['open', 'move']} />
    </Scene>,
  )
  expect(flat(byId(r.root, 'menu'))).not.toHaveProperty('padding')
  const open = byId(r.root, 'open')
  expect(flat(open)).toMatchObject({ height: 26, gap: 8, paddingHorizontal: 8, borderRadius: 6 })
  expect(registry.entries.get('open')?.cursor).toBeUndefined()
  same(flat(byId(r.root, 'move')).backgroundColor, light.ink[1])
  expect(alphaOf(flat(open).backgroundColor)).toBe(0)
  await act(async () => registry.update('open', { hover: true }))
  same(flat(open).backgroundColor, light.ink[1])
  await act(async () => registry.update('open', { hover: false }))
  await advance(75)
  expect(alphaOf(flat(open).backgroundColor)).toBeCloseTo(0.06 * (1 - at(EASE, 0.5)), 2)
  await advance(80)
  expect(alphaOf(flat(open).backgroundColor)).toBe(0)
})

it('lays a row on the web type scale, fills it with ink-1 and scales it up inside a phone', async () => {
  installVirtualClock()
  const registry = new Registry()
  const row = (selected: boolean) => (
    <Row target="row" title="Maya" subtitle="Design" meta="9:41" unread selected={selected} lead={<View />} />
  )
  const r = await render(<Scene registry={registry}>{row(true)}</Scene>)
  expect(flat(byId(r.root, 'row'))).toMatchObject({ padding: 12, borderRadius: 10 })
  same(flat(byId(r.root, 'row')).backgroundColor, light.ink[0])
  expect(text(r.root, 'Maya').props.numberOfLines).toBe(1)
  expect(flat(text(r.root, 'Maya'))).toMatchObject({
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: light.text,
  })
  expect(flat(text(r.root, 'Design'))).toMatchObject({ fontSize: 11.5, lineHeight: 16, color: light.muted })
  expect(flat(text(r.root, '9:41'))).toMatchObject({ fontSize: 11, lineHeight: 16, color: light.textFaint })
  const dot = r.root.findAll((n) => n.type === View && flat(n).backgroundColor === light.accent)[0]
  expect(flat(dot)).toMatchObject({ width: 6, height: 6, left: -13 })
  // Deselected it eases out over 0.2s; hovered it eases back in
  await act(async () => r.update(<Scene registry={registry}>{row(false)}</Scene>))
  await advance(100)
  expect(alphaOf(flat(byId(r.root, 'row')).backgroundColor)).toBeCloseTo(0.04 * (1 - at(EASE, 0.5)), 2)
  await act(async () => registry.update('row', { hover: true }))
  await advance(200)
  same(flat(byId(r.root, 'row')).backgroundColor, light.ink[0])

  await act(async () =>
    r.update(
      <Scene>
        <PhoneContext.Provider value={{ width: 390, height: 844, radius: 50 }}>
          <Row title="Maya" subtitle="Design" unread />
        </PhoneContext.Provider>
      </Scene>,
    ),
  )
  expect(flat(text(r.root, 'Maya'))).toMatchObject({ fontSize: 17, lineHeight: 22 })
  expect(flat(text(r.root, 'Design'))).toMatchObject({ fontSize: 15, lineHeight: 20 })
  const phoneDot = r.root.findAll((n) => n.type === View && flat(n).backgroundColor === light.accent)[0]
  expect(flat(phoneDot)).toMatchObject({ width: 10, left: -17 })
})

it('rims a pin in the surface with a drop shadow and rings the open one over 0.3s', async () => {
  installVirtualClock()
  const pin = (selected: boolean) => (
    <Scene>
      <Pin testID="pin" name="alex" tone="ink" selected={selected} />
    </Scene>
  )
  const r = await render(pin(false))
  expect(flat(byId(r.root, 'pin'))).toMatchObject({
    padding: 2,
    backgroundColor: light.surface,
    boxShadow: '0 2px 6px -1px rgba(0,0,0,0.25)',
  })
  const face = r.root.findAll((n) => n.type === View && flat(n).backgroundColor === light.ink[2])[0]
  expect(face).toBeDefined()
  expect(flat(text(r.root, 'A'))).toMatchObject({ color: light.text, fontWeight: '600' })
  const ring = () => views(r.root).find((n) => String(flat(n).boxShadow).includes('0 0 0 3px'))!
  expect(String(flat(ring()).boxShadow)).toBe(`0 0 0 1.5px ${light.surface}, 0 0 0 3px ${light.ink[4]}`)
  expect(read(flat(ring()).opacity)).toBe(0)
  await act(async () => r.update(pin(true)))
  await advance(150)
  expect(read(flat(ring()).opacity)).toBeCloseTo(at(EASE, 0.5), 4)
  await advance(150)
  expect(read(flat(ring()).opacity)).toBe(1)
})

it('places the tab bar on first measurement and slides it on the settle curve', async () => {
  installVirtualClock()
  const tabs = (value: number) => (
    <Scene>
      <Tabs testID="tabs" items={['One', 'Two']} value={value} />
    </Scene>
  )
  const r = await render(tabs(0))
  expect(flat(byId(r.root, 'tabs'))).toMatchObject({ gap: 18 })
  const [one, two] = views(r.root).filter((n) => n.props.accessibilityRole === 'tab')
  expect(flat(one)).toMatchObject({ paddingBottom: 9 })
  expect(flat(text(r.root, 'One'))).toMatchObject({ fontSize: 12.5, fontWeight: '500' })
  await act(async () => {
    one.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 40, height: 24 } } })
    two.props.onLayout({ nativeEvent: { layout: { x: 58, y: 0, width: 30, height: 24 } } })
  })
  const bar = () => views(r.root).find((n) => flat(n).height === 2)!
  expect(flat(bar()).backgroundColor).toBe(light.text)
  expect(flat(bar())).not.toHaveProperty('borderRadius')
  expect(read(flat(bar()).width)).toBe(40)
  await act(async () => r.update(tabs(1)))
  await advance(175)
  const x = read((flat(bar()).transform as Style[])[0].translateX) as number
  expect(x).toBeCloseTo(58 * at(SETTLE, 0.5), 3)
  await advance(175)
  expect(read(flat(bar()).width)).toBe(30)
  expect(css(flat(text(r.root, 'Two')).color)).toBe('rgba(38,38,40,1)')
  expect(r.root.findAll((n) => n.props.cursor === 'hand')).toHaveLength(0)
})

it('reveals the meter gradient over 0.8s on ink-1 and fades a tone in over it', async () => {
  installVirtualClock()
  const meter = (value: number, tone?: 'danger') => (
    <Scene>
      <Meter testID="meter" value={value} tone={tone} />
    </Scene>
  )
  const r = await render(meter(0))
  expect(flat(byId(r.root, 'meter'))).toMatchObject({ height: 6, backgroundColor: light.ink[0] })
  expect(flat(byId(r.root, 'meter'))).not.toHaveProperty('minWidth')
  await act(async () => r.update(meter(0.5, 'danger')))
  await advance(400)
  const clip = views(r.root).find((n) => typeof read(flat(n).width) === 'string')!
  expect(parseFloat(String(read(flat(clip).width)))).toBeCloseTo(50 * at([0.45, 0, 0.2, 1], 0.5), 2)
  const tone = views(r.root).find((n) => flat(n).position === 'absolute' && 'opacity' in flat(n))!
  expect(read(flat(tone).opacity)).toBe(1)
  expect(css(flat(tone).backgroundColor)).toBe('rgba(239,68,68,1)')
})

it('draws a toast as the web pill, white ink for its icon, rising 10px over 0.6s', async () => {
  installVirtualClock()
  const toast = (show: boolean, theme: Theme = 'light') => (
    <Scene theme={theme}>
      <Toast testID="toast" show={show} icon={<Icon name="check" />} action="Undo">
        Saved
      </Toast>
    </Scene>
  )
  const r = await render(toast(false))
  const style = () => flat(byId(r.root, 'toast'))
  expect(style()).toMatchObject({
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1c1c1f',
    boxShadow: light.shadow.satellite,
  })
  expect(style()).not.toHaveProperty('alignSelf')
  expect(r.root.findAll((n) => n.props.absoluteStrokeWidth)[0].props.color).toBe('#fff')
  expect(flat(text(r.root, 'Undo'))).toMatchObject({ color: 'rgba(255,255,255,0.6)', fontWeight: '500' })
  await act(async () => r.update(toast(true)))
  await advance(300)
  expect(read((style().transform as Style[])[0].translateY)).toBeCloseTo(10 * (1 - at(SETTLE, 0.5)), 3)
  await act(async () => r.update(toast(true, 'dark')))
  expect(style().backgroundColor).toBe(dark.raised)
  expect(flat(text(r.root, 'Saved')).color).toBe(dark.text)
})

it('tiles brand marks on the surface with a hairline, greys them in mono and sizes a src at 62%', async () => {
  const same = (Object.keys(brandMarks) as BrandName[]).find(
    (b) => brandMarks[b].dark === brandMarks[b].light && !('tileBackground' in brandMarks[b]),
  )!
  const r = await render(
    <Scene theme="dark">
      <BrandMark testID="named" name="acme" />
      <BrandMark testID="light-tile" brand={same} />
      <BrandMark testID="src" brand="visa" src="https://example.com/logo.png" />
    </Scene>,
  )
  expect(flat(byId(r.root, 'named'))).toMatchObject({
    backgroundColor: dark.surface,
    boxShadow: `inset 0 0 0 1px ${dark.border}`,
  })
  expect(flat(text(r.root, 'A'))).toMatchObject({ fontWeight: '600', fontSize: 12, color: dark.text })
  expect(flat(byId(r.root, 'light-tile'))).toMatchObject({
    backgroundColor: '#fff',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
  })
  expect(flat(byId(r.root, 'src'))).toMatchObject({ width: 28 })
  expect(flat(byId(r.root, 'src').findByType(Image))).toMatchObject({ width: 28 * 0.62, height: 28 * 0.62 })

  await act(async () =>
    r.update(
      <Scene palette="mono">
        <BrandMark brand="visa" />
      </Scene>,
    ),
  )
  const xml = r.root.findByType(SvgXml).props.xml as string
  expect(xml).not.toMatch(/#1434CB/i)
  expect(xml).toContain('fill="#383838"')
})

it('rings a field with ink-4, fades focus and error halos over 0.2s and keeps its placeholder mounted', async () => {
  installVirtualClock()
  const field = (value: string, focused?: boolean, status?: 'error') => (
    <Scene>
      <Field value={value} placeholder="Email" focused={focused} status={status} box={{ target: 'box' }} />
    </Scene>
  )
  const r = await render(field(''))
  const box = () => flat(byId(r.root, 'box'))
  expect(box()).toMatchObject({ height: 34, gap: 8, paddingRight: 11, borderRadius: 8 })
  expect(box().boxShadow).toBe(`inset 0 0 0 1px ${light.ink[3]}`)
  expect(read(box().paddingLeft)).toBe(11)
  const halo = (color: string) => views(r.root).find((n) => String(flat(n).boxShadow).includes(color))!
  expect(read(flat(halo(light.accent)).opacity)).toBe(0)
  expect(flat(text(r.root, 'Email')).color).toBe(light.textFaint)
  await act(async () => r.update(field('a', true)))
  const hint = () => text(r.root, 'Email').parent!.parent!
  expect(read(flat(hint()).opacity)).toBe(0)
  await advance(100)
  expect(read(flat(halo(light.accent)).opacity)).toBeCloseTo(at(EASE, 0.5), 4)
  await act(async () => r.update(field('a', true, 'error')))
  await advance(200)
  expect(read(flat(halo(light.danger)).opacity)).toBe(1)
  expect(read(flat(halo(light.accent)).opacity)).toBe(0)
  expect(String(flat(halo(light.danger)).boxShadow)).toBe(
    `inset 0 0 0 1px ${light.danger}, 0 0 0 3px ${light.dangerSoft}`,
  )
  await act(async () => r.update(field('', false)))
  await advance(100)
  expect(read(flat(hint()).opacity)).toBeCloseTo(at(EASE, 0.5), 4)
})

it('commits a field chip around its text and lets a cleared chip fade holding it', async () => {
  installVirtualClock()
  const registry = new Registry()
  const field = (value: string, chip: boolean) => (
    <Scene registry={registry}>
      <Field value={value} chip={chip} remove="x" focused box={{ target: 'box' }} />
    </Scene>
  )
  const r = await render(field('design', false))
  const x = () => flat(byId(r.root, 'x'))
  expect(read(x().marginLeft)).toBe(-16)
  expect(read(x().opacity)).toBe(0)
  expect(registry.entries.get('x')?.cursor).toBe('hand')
  await act(async () => r.update(field('design', true)))
  await advance(175)
  expect(read(flat(byId(r.root, 'box')).paddingLeft)).toBeCloseTo(11 - 6 * at([0.45, 0, 0.1, 1], 0.5), 3)
  await advance(200)
  expect(read(flat(byId(r.root, 'box')).paddingLeft)).toBe(5)
  expect(read(x().marginLeft)).toBe(4)
  expect(read(x().opacity)).toBe(0.75)
  const chip = () => text(r.root, 'design').parent!
  same(flat(chip()).backgroundColor, light.accentSoft)
  expect(read(flat(chip()).paddingRight)).toBe(4)
  // The caret follows the chip, 6px clear
  const caret = () => views(r.root).find((n) => flat(n).width === 1.5)!
  expect(read(flat(caret()).marginLeft)).toBe(6)
  // Hovered, the x is whole at once on an ink-2 disc
  await act(async () => registry.update('x', { hover: true }))
  expect(read(x().opacity)).toBe(1)
  same(x().backgroundColor, light.ink[1])
  await act(async () => registry.update('x', { hover: false }))
  // Cleared, it holds its text for its 0.25s fade, then lets go
  await act(async () => r.update(field('', false)))
  expect(text(r.root, 'design')).toBeDefined()
  await advance(125)
  expect(read(flat(chip()).opacity)).toBeCloseTo(1 - at(EASE, 0.5), 4)
  await advance(130)
  expect(text(r.root, 'design')).toBeUndefined()
})

it('holds the caret solid for 0.5s after a keystroke, then blinks 0.53s on and off', async () => {
  installVirtualClock()
  const r = await render(
    <Scene>
      <Field value="a" focused />
    </Scene>,
  )
  const caret = () => views(r.root).find((n) => flat(n).width === 1.5)!
  expect(flat(caret())).toMatchObject({ height: 16, borderRadius: 1, backgroundColor: light.accent })
  await advance(450)
  expect(read(flat(caret()).opacity)).toBe(1)
  await advance(50)
  await advance(265)
  expect(read(flat(caret()).opacity)).toBe(1)
  await advance(300)
  expect(read(flat(caret()).opacity)).toBe(0)
})

it('draws the valid tick in over 0.35s', async () => {
  installVirtualClock()
  const r = await render(
    <Scene>
      <Field value="a@b.co" status="valid" />
    </Scene>,
  )
  const tick = r.root.findAll((n) => n.type === Path && n.props.d === 'M3.5 8.5 6.5 11.5 12.5 4.5')[0]
  const length = Math.hypot(3, 3) + Math.hypot(6, 7)
  expect(tick.props).toMatchObject({ stroke: light.success, strokeWidth: 2 })
  expect(tick.props.strokeDashoffset).toBeCloseTo(length, 3)
  await advance(350)
  const drawn = r.root.findAll((n) => n.type === Path && n.props.d === 'M3.5 8.5 6.5 11.5 12.5 4.5')[0]
  expect(drawn.props.strokeDashoffset).toBe(0)
})

it('fades the toggle accent in over ink-5 and settles the knob over 0.25s', async () => {
  installVirtualClock()
  const toggle = (on: boolean, theme: Theme = 'light', palette: Palette = 'accent') => (
    <Scene theme={theme} palette={palette}>
      <Toggle testID="toggle" on={on} />
    </Scene>
  )
  const r = await render(toggle(false))
  expect(flat(byId(r.root, 'toggle')).backgroundColor).toBe(light.ink[4])
  const [layer, knob] = views(r.root).filter((n) => n.props.testID !== 'toggle')
  expect(flat(knob).boxShadow).toBe('0 0.5px 1.5px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.04)')
  await act(async () => r.update(toggle(true)))
  await advance(100)
  expect(read(flat(layer).opacity)).toBeCloseTo(at(EASE, 0.5), 4)
  await advance(25)
  expect(read((flat(knob).transform as Style[])[0].translateX)).toBeCloseTo(12 * at(SETTLE, 0.5), 3)
  await act(async () => r.update(toggle(true, 'blueprint')))
  expect(flat(knob).backgroundColor).toBe(resolveTokens('blueprint', 'accent').well)
  expect(flat(knob).boxShadow).toBeUndefined()
  await act(async () => r.update(toggle(true, 'dark', 'mono')))
  expect(flat(knob).backgroundColor).toBe('#111')
})

it('slides the segmented thumb by segments, never on first layout, and eases label colour', async () => {
  installVirtualClock()
  const seg = (value: number) => (
    <Scene>
      <Segmented testID="seg" items={['Monthly', 'Yearly']} value={value} />
    </Scene>
  )
  const r = await render(seg(1))
  expect(flat(byId(r.root, 'seg'))).toMatchObject({ padding: 2, borderRadius: 8, backgroundColor: light.ink[1] })
  await act(async () =>
    byId(r.root, 'seg').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 204, height: 30 } } }),
  )
  const thumb = () => views(r.root).find((n) => flat(n).backgroundColor === light.raised)!
  expect(flat(thumb())).toMatchObject({ width: 100, borderRadius: 6 })
  expect(flat(thumb()).boxShadow).toBe('0 1px 2px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)')
  expect(read((flat(thumb()).transform as Style[])[0].translateX)).toBe(100)
  const option = views(r.root).filter((n) => n.props.accessibilityRole === 'tab')[0]
  expect(flat(option)).toMatchObject({ height: 26, paddingHorizontal: 10 })
  expect(flat(text(r.root, 'Monthly'))).toMatchObject({ fontSize: 12, fontWeight: '500', color: light.muted })
  await act(async () => r.update(seg(0)))
  await advance(150)
  expect(read((flat(thumb()).transform as Style[])[0].translateX)).toBeCloseTo(100 * (1 - at(SETTLE, 0.5)), 3)
  await advance(150)
  expect(css(flat(text(r.root, 'Monthly')).color)).toBe('rgba(38,38,40,1)')
})

it('opens a slot over 0.45s without clipping its children and fades its dashed mark in last', async () => {
  installVirtualClock()
  const slot = (open: boolean) => (
    <Scene>
      <Slot testID="slot" open={open} height={38} dashed>
        <View testID="card" />
      </Slot>
    </Scene>
  )
  const r = await render(slot(false))
  expect(flat(byId(r.root, 'slot'))).not.toHaveProperty('overflow')
  const mark = () => views(r.root).find((n) => flat(n).borderStyle === 'dashed')!
  expect(flat(mark())).toMatchObject({ borderWidth: 1.5, borderColor: light.ink[4], height: 38 })
  await act(async () => r.update(slot(true)))
  await advance(225)
  expect(read(flat(byId(r.root, 'slot')).height)).toBeCloseTo(38 * at([0.45, 0, 0.2, 1], 0.5), 3)
  await advance(75)
  expect(read(flat(mark()).opacity)).toBe(0)
  await advance(80)
  expect(read(flat(mark()).opacity)).toBeCloseTo(at([0, 0, 0.58, 1], 0.5), 4)
})

it('fills ink avatars with the flattened fill and rings them with a cut-out gap', async () => {
  installVirtualClock()
  const avatar = (ring?: 'pending' | 'waiting' | 'confirmed', theme: Theme = 'light') => (
    <Scene theme={theme}>
      <Avatar testID="a" tone="ink" name="Maya" ring={ring} ringBg="#f00" />
    </Scene>
  )
  const blueprint = resolveTokens('blueprint', 'accent')
  const face = () => views(r.root).find((n) => flat(n).overflow === 'hidden')!
  let r = await render(avatar(undefined, 'blueprint'))
  expect(read(flat(face()).backgroundColor)).toBe(blueprint.fill)
  expect(flat(text(r.root, 'M'))).toMatchObject({ color: blueprint.text, fontWeight: '600' })
  await act(async () => r.unmount())
  r = await render(avatar('pending'))
  const ring = () => views(r.root).find((n) => flat(n).borderWidth === 3)!
  expect(flat(ring())).toMatchObject({ left: -3, width: 30, borderRadius: 15 })
  expect(css(flat(ring()).borderColor)).toBe(light.ink[2])
  const gap = r.root.findAll((n) => n.type === View && flat(n).borderWidth === 1.5)[0]
  expect(flat(gap)).toMatchObject({ left: -1.5, width: 27, borderColor: '#f00' })
  await act(async () => r.update(avatar('confirmed')))
  await advance(175)
  expect(css(flat(ring()).borderColor)).not.toBe('rgba(34,197,94,1)')
  await advance(175)
  expect(css(flat(ring()).borderColor)).toBe('rgba(34,197,94,1)')
  // Waiting: a comet turning once every 1.1s, fading in over 0.3s
  await act(async () => r.update(avatar('waiting')))
  await advance(550)
  const comet = views(r.root).find((n) => Array.isArray(flat(n).transform))!
  expect(read((flat(comet).transform as Style[])[0].rotate)).toBe('180deg')
  expect(read(flat(comet).opacity)).toBe(1)
  expect(comet.findAllByType(Path).length).toBeGreaterThan(8)
})

it('shows the check tick at 160ms, draws it over 0.32s and drops it at once when turned off', async () => {
  installVirtualClock()
  const check = (on: boolean, pending = false) => (
    <Scene>
      <Check on={on} pending={pending} />
    </Scene>
  )
  const tick = () => r.root.findAll((n) => n.type === Path && n.props.d === 'M4.5 8.2 7 10.6l4.6-5')[0]
  const r = await render(check(false, true))
  expect(views(r.root).length).toBeGreaterThan(1)
  await act(async () => r.update(check(true)))
  await advance(150)
  expect(tick().props.opacity).toBe(0)
  await advance(20)
  expect(tick().props.opacity).toBe(1)
  const length = Math.hypot(2.5, 2.4) + Math.hypot(4.6, 5)
  expect(tick().props.strokeDasharray[0]).toBeCloseTo(10.26, 2)
  await advance(310)
  expect(tick().props.strokeDashoffset).toBeCloseTo(0, 5)
  expect(length).toBeCloseTo(10.26, 2)
  await act(async () => r.update(check(false)))
  expect(tick().props.opacity).toBe(0)
})

it('tints badges with the soft and text tokens and eases a tone change over 0.35s', async () => {
  installVirtualClock()
  const badge = (tone: 'neutral' | 'success' | 'accent', theme: Theme = 'light') => (
    <Scene theme={theme}>
      <Badge testID="badge" tone={tone} dot>
        Ready
      </Badge>
    </Scene>
  )
  const r = await render(badge('neutral'))
  expect(flat(byId(r.root, 'badge'))).toMatchObject({ gap: 5, height: 20, paddingLeft: 7, paddingRight: 9 })
  expect(flat(byId(r.root, 'badge')).backgroundColor).toBe(light.ink[1])
  const dot = views(r.root).find((n) => flat(n).width === 6)!
  expect(flat(dot)).toMatchObject({ height: 6, borderRadius: 3 })
  await act(async () => r.update(badge('success')))
  await advance(175)
  // Premultiplied: half way the hue is already green, never a grey-green from straight RGB
  const [red, green, , alpha] = channels(css(flat(byId(r.root, 'badge')).backgroundColor))
  expect(green).toBeGreaterThan(150)
  expect(red).toBeLessThan(40)
  expect(alpha).toBeGreaterThan(0.06)
  expect(alpha).toBeLessThan(0.12)
  await advance(175)
  same(flat(byId(r.root, 'badge')).backgroundColor, light.successSoft)
  expect(css(flat(text(r.root, 'Ready')).color)).toBe('rgba(21,128,61,1)')
  await act(async () => r.update(badge('accent', 'blueprint')))
  await advance(350)
  expect(css(flat(text(r.root, 'Ready')).color)).toBe('rgba(209,209,209,1)')
})

it('centres a tooltip on its target by its own size and shows it over 0.15s', async () => {
  installVirtualClock()
  const tip = (show: boolean) => (
    <Scene>
      <Tooltip testID="tip" show={show} at={{ x: 100, y: 50, width: 40, height: 20 }}>
        Files
      </Tooltip>
    </Scene>
  )
  const r = await render(tip(false))
  const style = () => flat(byId(r.root, 'tip'))
  expect(style()).toMatchObject({ left: 120, top: 76, height: 22, paddingHorizontal: 8, borderRadius: 6 })
  expect(style().backgroundColor).toBe('#26262a')
  expect((style().transform as Style[])[0]).toEqual({ translateX: '-50%' })
  expect(flat(text(r.root, 'Files'))).toMatchObject({ fontSize: 11, fontWeight: '500', color: '#fff' })
  await act(async () => r.update(tip(true)))
  await advance(75)
  expect(read(style().opacity)).toBeCloseTo(at(EASE, 0.5), 4)
  await advance(75)
  await act(async () => r.update(tip(false)))
  await advance(50)
  expect(read(style().opacity)).toBeCloseTo(1 - at(EASE, 0.5), 4)
})

it('opens a chip slot before showing the chip, and gives its x a muted ink and no cursor', async () => {
  installVirtualClock()
  const registry = new Registry()
  const chip = (show: boolean) => (
    <Scene registry={registry}>
      <Chip testID="chip" show={show} remove="x">
        Design
      </Chip>
    </Scene>
  )
  const r = await render(chip(false))
  expect(registry.entries.get('x')?.cursor).toBeUndefined()
  const pill = r.root.findAll((n) => n.type === View && flat(n).gap === 6)[0]
  expect(flat(pill)).toMatchObject({ height: 24, paddingLeft: 10, paddingRight: 4, backgroundColor: light.accentSoft })
  expect(r.root.findAll((n) => n.props.absoluteStrokeWidth)[0].props.color).toBe(light.muted)
  await act(async () => r.update(chip(true)))
  await advance(150)
  expect(read(flat(byId(r.root, 'chip')).opacity)).toBe(0)
  await advance(120)
  expect(read(flat(byId(r.root, 'chip')).opacity)).toBeCloseTo(at(EASE, 0.5), 4)
})

it('passes icon styles to the glyph and takes an inherited ink', async () => {
  const r = await render(
    <Scene>
      <Icon name="check" style={{ marginLeft: 4, opacity: 0.5, color: '#123456' }} />
      <InkContext.Provider value="#abcdef">
        <Icon name="plus" />
      </InkContext.Provider>
    </Scene>,
  )
  const glyphs = r.root.findAll((n) => n.props.absoluteStrokeWidth)
  const check = glyphs.find((n) => n.props.color === '#123456')!
  expect(check.props.style).toEqual({ marginLeft: 4, opacity: 0.5 })
  expect(glyphs.some((n) => n.props.color === '#abcdef')).toBe(true)
})
