import React from 'react'
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { Animated, ScrollView, StyleSheet, Text as RNText, View, type LayoutRectangle } from 'react-native'
import { Circle, Path } from 'react-native-svg'
import { clock, installVirtualClock } from '../kit/clock'
import { bezier } from '../kit/ease'
import { curves, useTween } from '../kit/animate'
import { MotionContext } from '../kit/reduced-motion'
import { resolveTokens } from '../kit/look'
import { SceneContext } from '../kit/native'
import { Registry } from '../kit/registry'
import { PhoneContext } from '../kit/phone'
import { Collapse, Swap, States, Popover, Follow, Fly, Expand } from '../kit/motion/layout'
import { Count, Roll, Stream } from '../kit/motion/text'
import { Connector } from '../kit/motion/Connector'
import { Scroll } from '../kit/motion/Scroll'

// The motion kit against the web kit's CSS: durations, delays and curves as Collapse.css, Roll.css
// and the rest write them, stepped on the virtual clock.
const tokens = resolveTokens('light', 'accent')
const moving = { still: false, active: true, instant: false, speed: 1 }
let tree: ReactTestRenderer | undefined
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount())
  tree = undefined
  clock.recording?.restore()
})
const scene = (registry = new Registry()) => ({ registry, root: { current: null }, width: 360, height: 640, scale: 1 })
const staged = (node: React.ReactElement, s = scene()) => (
  <SceneContext.Provider value={s}>
    <MotionContext.Provider value={moving}>{node}</MotionContext.Provider>
  </SceneContext.Provider>
)
async function render(node: React.ReactElement) {
  await act(async () => {
    tree = TestRenderer.create(node)
  })
  return tree!
}
const flat = (node: ReactTestInstance) => (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>
const read = (v: unknown) => (typeof v === 'number' ? v : (v as { __getValue(): number }).__getValue())
const translateY = (node: ReactTestInstance) =>
  read((flat(node).transform as Record<string, unknown>[]).find((t) => 'translateY' in t)!.translateY)
const lay = (node: ReactTestInstance, layout: Partial<LayoutRectangle>) =>
  act(async () => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0, ...layout } } }))
/** The hidden sizing probes, in render order. */
const probes = (renderer: ReactTestRenderer) =>
  renderer.root.findAll((n) => n.type === View && flat(n).maxWidth === '100%' && typeof n.props.onLayout === 'function')

it('plays an entrance through settling and carries a tween on when settling ends, as web data-placing does', async () => {
  const c = installVirtualClock()
  const placing = { ...moving, instant: true }
  const values: Record<string, Animated.Value> = {}
  function Probe({ to }: { to: number }) {
    values.entrance = useTween(1, 400, { from: 0, ease: curves.linear })
    values.change = useTween(to, 400, { ease: curves.linear })
    return null
  }
  const at = (motion: typeof moving, to: number) => (
    <SceneContext.Provider value={scene()}>
      <MotionContext.Provider value={motion}>
        <Probe to={to} />
      </MotionContext.Provider>
    </SceneContext.Provider>
  )
  const renderer = await render(at(placing, 0))
  // While settling, a value change lands at once but the entrance still plays
  await act(async () => renderer.update(at(placing, 10)))
  expect(read(values.change)).toBe(10)
  await act(async () => c.advance(100))
  expect(read(values.entrance)).toBeGreaterThan(0.2)
  expect(read(values.entrance)).toBeLessThan(0.3)
  // Settling ends mid-entrance: it carries on from where it is, on its original schedule
  await act(async () => renderer.update(at(moving, 10)))
  await act(async () => c.advance(100))
  expect(read(values.entrance)).toBeGreaterThan(0.45)
  expect(read(values.entrance)).toBeLessThan(0.55)
  await act(async () => c.advance(250))
  expect(read(values.entrance)).toBe(1)
})

it('rolls Count figures through cells exactly one em apart, whatever the measured line height', async () => {
  installVirtualClock()
  const r = await render(staged(<Count value={48} style={{ fontSize: 26, lineHeight: 36.4 }} />))
  // React Native Web reports a measured line as 36, not 36.4: the pitch must not depend on it
  for (const text of r.root.findAll((n) => n.type === RNText && typeof n.props.onLayout === 'function'))
    await act(async () => text.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 16, height: 36 } } }))
  const cells = r.root.findAll((n) => n.type === View && flat(n).height === 26 && flat(n).justifyContent === 'center')
  expect(cells.length).toBe(60)
  for (const strip of r.root.findAll((n) => n.type === Animated.View && 'transform' in flat(n)))
    expect([-18 * 26, -14 * 26]).toContain(translateY(strip))
})

it('holds a zero-duration tween with a delay, then jumps, as CSS does', async () => {
  const c = installVirtualClock()
  let value: Animated.Value | undefined
  function Probe({ to }: { to: number }) {
    value = useTween(to, 0, { delay: 150 })
    return null
  }
  const renderer = await render(staged(<Probe to={0} />))
  await act(async () => renderer.update(staged(<Probe to={4} />)))
  await act(async () => c.advance(140))
  expect(read(value)).toBe(0)
  await act(async () => c.advance(20))
  expect(read(value)).toBe(4)
})

describe('Collapse', () => {
  const inner = (renderer: ReactTestRenderer) =>
    renderer.root.findAll((n) => n.type === Animated.View && flat(n).position === 'absolute' && flat(n).top === 0)[0]
  const outer = (renderer: ReactTestRenderer) => flat(renderer.root.findAll((n) => n.type === Animated.View)[0])
  it('opens a row from its middle on separate height and fade curves, unclipped once settled', async () => {
    const c = installVirtualClock()
    const node = (open: boolean) => staged(<Collapse open={open}>{null}</Collapse>)
    const renderer = await render(node(false))
    await lay(inner(renderer), { height: 30 })
    expect(translateY(inner(renderer))).toBe(-15)
    await act(async () => renderer.update(node(true)))
    await act(async () => c.advance(140))
    // The fade waits 0.15s; the height has been opening on cubic-bezier(0.4, 0, 0.2, 1) over 0.46s
    expect(read(flat(inner(renderer)).opacity)).toBe(0)
    const space = bezier([0.4, 0, 0.2, 1])(140 / 460)
    expect(read(outer(renderer).height)).toBeCloseTo(30 * space, 3)
    expect(translateY(inner(renderer))).toBeCloseTo(-15 * (1 - space), 3)
    expect(outer(renderer).overflow).toBe('hidden')
    await act(async () => c.advance(130))
    expect(read(flat(inner(renderer)).opacity)).toBeCloseTo(bezier(curves.easeOut)(120 / 240), 3)
    await act(async () => c.advance(400))
    expect(read(outer(renderer).height)).toBe(30)
    expect(outer(renderer).overflow).toBe('visible')
    // Closing: the fade starts at once on (0, 0.8, 0.5, 1); the height waits 50ms
    await act(async () => renderer.update(node(false)))
    await act(async () => c.advance(40))
    expect(read(outer(renderer).height)).toBe(30)
    expect(read(flat(inner(renderer)).opacity)).toBeCloseTo(1 - bezier([0, 0.8, 0.5, 1])(40 / 420), 3)
  })
  it('drops content whole from 10pt above, never clipped', async () => {
    const c = installVirtualClock()
    const node = (open: boolean) =>
      staged(
        <Collapse open={open} reveal="drop">
          {null}
        </Collapse>,
      )
    const renderer = await render(node(false))
    await lay(inner(renderer), { height: 80 })
    expect(translateY(inner(renderer))).toBe(-10)
    expect(outer(renderer).overflow).toBe('visible')
    await act(async () => renderer.update(node(true)))
    await act(async () => c.advance(200))
    expect(translateY(inner(renderer))).toBe(-10)
    expect(read(flat(inner(renderer)).opacity)).toBe(0)
    await act(async () => c.advance(300))
    expect(translateY(inner(renderer))).toBeCloseTo(-10 * (1 - bezier([0.22, 1, 0.36, 1])(300 / 600)), 3)
    expect(read(flat(inner(renderer)).opacity)).toBeCloseTo(bezier(curves.ease)(260 / 300), 3)
  })
})

describe('Connector', () => {
  const from = { x: 0, y: 0 },
    to = { x: 100, y: 0 }
  const node = (show: boolean, extra: Partial<React.ComponentProps<typeof Connector>> = {}) =>
    staged(<Connector from={from} to={to} route="straight" show={show} {...extra} />)
  it('draws on over 1s in the accent, then grows a ringed dot as it arrives', async () => {
    const c = installVirtualClock()
    const renderer = await render(node(false))
    await act(async () => renderer.update(node(true)))
    const [reveal, line] = renderer.root.findAllByType(Path)
    expect(line.props.stroke).toBe(tokens.accent)
    expect(line.props.strokeLinecap).toBeUndefined()
    await act(async () => c.advance(500))
    expect(reveal.props.strokeDashoffset).toBeCloseTo(100 * (1 - bezier([0.65, 0, 0.35, 1])(0.5)), 3)
    const dot = () => renderer.root.findByType(Circle).props
    expect(dot()).toMatchObject({ opacity: 0, fill: tokens.accent, stroke: '#fff' })
    await act(async () => c.advance(500))
    await act(async () => c.advance(100))
    expect(dot().opacity).toBeCloseTo(bezier(curves.ease)(0.5), 3)
    expect(dot().r).toBeCloseTo(3 * (0.4 + 0.6 * bezier([0.22, 1, 0.36, 1])(1 / 3)), 3)
    await act(async () => c.advance(200))
    expect(dot()).toMatchObject({ opacity: 1, r: 3, strokeWidth: 2 })
  })
  it('fades the line intact when hidden and resets it undrawn after 0.25s', async () => {
    const c = installVirtualClock()
    const renderer = await render(node(true, { arrow: true, label: 'POST' }))
    const [reveal, line, arrow] = renderer.root.findAllByType(Path)
    expect(arrow.props).toMatchObject({ opacity: 1, strokeLinecap: 'round', strokeLinejoin: 'round' })
    await act(async () => renderer.update(node(false, { arrow: true, label: 'POST' })))
    await act(async () => c.advance(200))
    expect(reveal.props.strokeDashoffset).toBe(0)
    expect(line.props.opacity).toBeCloseTo(1 - bezier(curves.ease)(0.8), 3)
    expect(renderer.root.findAllByType(Path)[2].props.opacity).toBe(0)
    await act(async () => c.advance(60))
    expect(reveal.props.strokeDashoffset).toBe(100)
    expect(line.props.opacity).toBe(0)
  })
  it('sets a label as a raised pill, and a number as an 18pt step circle', async () => {
    const renderer = await render(node(true, { label: 3 }))
    const pill = renderer.root.findAll((n) => n.type === Animated.View && flat(n).borderRadius === 999)[0]
    expect(flat(pill)).toMatchObject({ width: 18, height: 18, backgroundColor: tokens.raised })
    expect(flat(pill).boxShadow).toBe(`0 0 0 1px ${tokens.border}, ${tokens.shadow.card}`)
    const text = pill.findByType(RNText)
    expect(flat(text)).toMatchObject({ fontSize: 10.5, fontWeight: '500', lineHeight: 14, color: tokens.text })
  })
})

describe('Roll', () => {
  it('slides the old text a full line up and out, and raises each new unit a full line', async () => {
    const c = installVirtualClock()
    const renderer = await render(staged(<Roll>{'$20'}</Roll>))
    await act(async () => renderer.update(staged(<Roll>{'$31'}</Roll>)))
    const [before, after] = probes(renderer)
    await lay(before, { width: 16, height: 17 })
    await lay(after, { width: 12, height: 17 })
    const outgoing = renderer.root.findAll((n) => n.type === Animated.Text && n.props.children === '20')[0]
    const units = renderer.root.findAll((n) => n.type === Animated.Text && /^\d$/.test(n.props.children))
    expect(units.map((n) => n.props.children)).toEqual(['3', '1'])
    expect(translateY(units[1])).toBe(17)
    // The row of new units carries no fade of its own; each unit fades with its rise
    const row = renderer.root.findAll(
      (n) => n.type === View && flat(n).flexDirection === 'row' && flat(n).position === 'absolute',
    )
    expect(row).toHaveLength(1)
    expect(flat(row[0]).opacity).toBeUndefined()
    const box = () => flat(renderer.root.findAll((n) => n.type === Animated.View && flat(n).height === 17)[0])
    await act(async () => c.advance(140))
    expect(translateY(outgoing)).toBeCloseTo(-17 * bezier([0.55, 0, 1, 0.45])(0.5), 3)
    // Narrowing: the box holds the old width for 360ms
    expect(read(box().width)).toBe(16)
    await act(async () => c.advance(140))
    expect(read(flat(outgoing).opacity)).toBe(0)
    expect(translateY(outgoing)).toBe(-17)
    expect(translateY(units[1])).toBeCloseTo(17 * (1 - bezier([0.22, 1, 0.36, 1])((280 - 155) / 550)), 3)
    await act(async () => c.advance(330))
    expect(read(box().width)).toBeCloseTo(16 - 4 * bezier([0.22, 1, 0.36, 1])(250 / 500), 3)
  })
})

describe('Count', () => {
  it('rolls a figure in a one-em window on the web curve, with a hair before the unit', async () => {
    const c = installVirtualClock()
    const node = (value: number) => staged(<Count value={value} format={(n) => `${n}%`} style={{ fontSize: 30 }} />)
    const renderer = await render(node(1))
    const window = renderer.root.findAll((n) => n.type === View && n.props.accessibilityElementsHidden)[0]
    expect(flat(window).height).toBe(30)
    const unit = renderer.root.findAll((n) => n.type === RNText && n.props.children === '%')[0]
    expect(flat(unit).marginLeft).toBeCloseTo(2.4, 5)
    await act(async () => renderer.update(node(5)))
    await act(async () => c.advance(350))
    const strip = renderer.root.findAll((n) => n.type === Animated.View && 'transform' in flat(n))[0]
    expect(translateY(strip)).toBeCloseTo(-30 * (11 + 4 * bezier([0.3, 0.75, 0.1, 1])(0.5)), 3)
    const cell = strip.findAllByType(RNText)[0]
    expect(flat(cell).textAlign).toBe('left')
  })
})

describe('Stream', () => {
  it('marks a run in the success tint, its last space left out, fading words in over 0.35s', async () => {
    const c = installVirtualClock()
    const node = (count: number) => staged(<Stream text="one two three" count={count} mark={(w) => w !== 'three'} />)
    const renderer = await render(node(1))
    const words = renderer.root.findAllByType(Animated.Text)
    expect(words.map((n) => n.props.children)).toEqual(['one ', 'two', 'three'])
    // Animated colors carry 8-bit alpha
    const tint = (n: ReactTestInstance) =>
      String(read(flat(n).backgroundColor))
        .match(/[\d.]+/g)!
        .map(Number)
    expect(tokens.successSoft).toBe('rgba(34,197,94,0.12)')
    expect(tint(words[0]).slice(0, 3)).toEqual([34, 197, 94])
    expect(tint(words[0])[3]).toBeCloseTo(0.12, 2)
    expect(tint(words[2])).toEqual([34, 197, 94, 0])
    await act(async () => renderer.update(node(2)))
    await act(async () => c.advance(175))
    expect(read(flat(words[1]).opacity)).toBeCloseTo(bezier(curves.ease)(0.5), 3)
  })
})

describe('Swap', () => {
  it('fades the new content in from its first mount and keeps a shrink on its delay to the end', async () => {
    const c = installVirtualClock()
    const node = (id: number) => staged(<Swap id={id}>{id ? 'Short' : 'A longer label'}</Swap>)
    const renderer = await render(node(0))
    const layer = () => renderer.root.findAll((n) => n.type === Animated.View && flat(n).position === 'relative')[0]
    expect(read(flat(layer()).opacity)).toBe(0)
    await lay(probes(renderer)[0], { width: 100, height: 17 })
    const box = () => flat(renderer.root.findAll((n) => n.type === Animated.View)[0])
    // A first measure takes its size at once
    expect(read(box().width)).toBe(100)
    await act(async () => c.advance(450))
    expect(read(flat(layer()).opacity)).toBe(1)
    await act(async () => renderer.update(node(1)))
    await lay(probes(renderer)[0], { width: 40, height: 17 })
    const swap = bezier([0.25, 0.8, 0.25, 1])
    await act(async () => c.advance(200))
    expect(read(box().width)).toBe(100)
    await act(async () => c.advance(250))
    // The old copy has gone; the box carries on from its 225ms delay rather than restarting
    await act(async () => c.advance(50))
    expect(read(box().width)).toBeCloseTo(100 - 60 * swap(275 / 450), 3)
  })
})

describe('States', () => {
  it('lays a state out as a row, hands off in sequence and drops the old one back once gone', async () => {
    const c = installVirtualClock()
    const node = (value: 'a' | 'b') =>
      staged(
        <States
          value={value}
          states={{
            a: 'Deploy',
            b: (
              <>
                <View testID="spinner" /> Deploying
              </>
            ),
          }}
        />,
      )
    const renderer = await render(node('a'))
    const rows = renderer.root.findAll(
      (n) => n.type === View && flat(n).gap === 6 && !!n.findAll((m) => m.props.testID === 'spinner').length,
    )
    expect(flat(rows[0]).flexDirection).toBe('row')
    expect(rows[0].findAllByType(RNText).map((n) => n.props.children)).toEqual(['Deploying'])
    const items = () =>
      renderer.root.findAll((n) => n.type === Animated.View && flat(n).position === 'absolute' && 'opacity' in flat(n))
    await act(async () => renderer.update(node('b')))
    await act(async () => c.advance(60))
    expect(read(flat(items()[1]).opacity)).toBe(0)
    expect(translateY(items()[1])).toBe(4)
    expect(translateY(items()[0])).toBe(0)
    await act(async () => c.advance(100))
    expect(read(flat(items()[0]).opacity)).toBe(0)
    expect(translateY(items()[0])).toBe(4)
    expect(read(flat(items()[1]).opacity)).toBeCloseTo(bezier(curves.easeOut)(90 / 250), 3)
    expect(translateY(items()[1])).toBeCloseTo(4 * (1 - bezier([0.22, 1, 0.36, 1])(90 / 300)), 3)
  })
})

describe('Popover', () => {
  it('scales only its raised surface opening, and shrinks whole as it fades closing', async () => {
    const c = installVirtualClock()
    const node = (show: boolean) => staged(<Popover show={show}>{null}</Popover>)
    const renderer = await render(node(false))
    const surface = () => flat(renderer.root.findAll((n) => n.type === Animated.View && !!flat(n).boxShadow)[0])
    const box = () => flat(renderer.root.findAll((n) => n.type === Animated.View)[0])
    const scale = (style: Record<string, unknown>) => read((style.transform as { scale: unknown }[])[0].scale)
    expect(surface()).toMatchObject({ backgroundColor: tokens.raised, boxShadow: tokens.shadow.float })
    expect(box().padding).toBe(4)
    await act(async () => renderer.update(node(true)))
    await act(async () => c.advance(90))
    expect(read(box().opacity)).toBeCloseTo(bezier(curves.ease)(0.5), 3)
    expect(scale(box())).toBe(1)
    expect(scale(surface())).toBeCloseTo(0.96 + 0.04 * bezier([0.22, 1, 0.36, 1])(90 / 240), 3)
    await act(async () => c.advance(300))
    await act(async () => renderer.update(node(false)))
    await act(async () => c.advance(120))
    expect(scale(box())).toBeCloseTo(1 - 0.04 * bezier([0.4, 0, 1, 1])(0.5), 3)
    expect(scale(surface())).toBe(1)
    expect(read(box().opacity)).toBeCloseTo(1 - bezier(curves.ease)(0.5), 3)
  })
})

describe('Follow', () => {
  it('interpolates between 60Hz spring steps and fades in and out', async () => {
    const c = installVirtualClock()
    const at = (x: number) => ({ x, y: 0, width: 10, height: 10 })
    const node = (to: ReturnType<typeof at> | null) => staged(<Follow to={to} />)
    const renderer = await render(node(at(0)))
    const style = () => flat(renderer.root.findAll((n) => n.type === Animated.View)[0])
    const x = () => read((style().transform as { translateX: unknown }[])[0].translateX)
    expect(read(style().opacity)).toBe(1)
    await act(async () => renderer.update(node(at(100))))
    await act(async () => c.advance(1000 / 120))
    // Half a frame in: half of the first spring step (100 * 0.25)
    expect(x()).toBeCloseTo(12.5, 3)
    await act(async () => renderer.update(node(null)))
    await act(async () => c.advance(90))
    expect(read(style().opacity)).toBeCloseTo(1 - bezier(curves.ease)(0.5), 3)
  })
})

describe('Fly', () => {
  const from = { x: 0, y: 0, width: 20, height: 20 },
    to = { x: 100, y: 40, width: 40, height: 40 }
  const node = (go: boolean, held = false) => staged(<Fly from={from} to={to} go={go} held={held} />)
  const outer = (renderer: ReactTestRenderer) => flat(renderer.root.findAll((n) => n.type === Animated.View)[0])
  const lift = (renderer: ReactTestRenderer) =>
    read(
      (
        flat(renderer.root.findAll((n) => n.type === Animated.View && flat(n).flex === 1)[0]).transform as {
          scale: unknown
        }[]
      )[0].scale,
    )
  it('buds in only while held at rest, shows whole on take-off and lifts to 1.12 at 30%', async () => {
    const c = installVirtualClock()
    const renderer = await render(node(false, true))
    await act(async () => c.advance(100))
    expect(read(outer(renderer).opacity)).toBeCloseTo(bezier(curves.easeOut)(0.5), 3)
    await act(async () => renderer.update(node(true, true)))
    expect(outer(renderer).opacity).toBe(1)
    await act(async () => c.advance(225))
    expect(lift(renderer)).toBeCloseTo(1.12, 3)
    await act(async () => c.advance(100))
    // Each keyframe segment is eased on its own: 100ms into the 30%-85% segment
    expect(lift(renderer)).toBeCloseTo(1.12 - 0.12 * bezier([0.33, 1, 0.68, 1])(100 / 412.5), 3)
  })
  it('hides at once and jumps home when it stops', async () => {
    const c = installVirtualClock()
    const renderer = await render(node(true))
    await act(async () => c.advance(300))
    await act(async () => renderer.update(node(false)))
    expect(read(outer(renderer).opacity)).toBe(0)
    expect(read((outer(renderer).transform as { translateX: unknown }[])[0].translateX)).toBe(0)
  })
})

describe('Expand', () => {
  const from = { x: 20, y: 30, width: 90, height: 50 }
  it('opens a card with no ground of its own, its content still sideways, to the phone screen corner', async () => {
    const c = installVirtualClock()
    const node = (open: boolean) =>
      staged(
        <PhoneContext.Provider value={{ width: 360, height: 640, radius: 64, dark: false }}>
          <Expand open={open} from={from}>
            {null}
          </Expand>
        </PhoneContext.Provider>,
      )
    const renderer = await render(node(false))
    const card = () => flat(renderer.root.findAll((n) => n.type === Animated.View && flat(n).overflow === 'hidden')[0])
    const content = () => renderer.root.findAll((n) => n.type === Animated.View && flat(n).width === 360)[0]
    expect(card().backgroundColor).toBeUndefined()
    expect(read((flat(content()).transform as { translateX: unknown }[])[0].translateX)).toBe(-20)
    await act(async () => renderer.update(node(true)))
    await act(async () => c.advance(520))
    expect(read(card().borderRadius)).toBe(64)
    expect(read((flat(content()).transform as { translateX: unknown }[])[0].translateX)).toBe(0)
  })
  it('scales a launched app uniformly from the card, raising its ground as the face fades', async () => {
    const c = installVirtualClock()
    const node = (open: boolean) =>
      staged(
        <Expand open={open} from={from} face={<View />} background="#123456">
          {null}
        </Expand>,
      )
    const renderer = await render(node(false))
    const app = () => flat(renderer.root.findAll((n) => n.type === Animated.View)[0])
    const ground = () =>
      flat(renderer.root.findAll((n) => n.type === Animated.View && flat(n).backgroundColor === '#123456')[0])
    const clip = () => flat(renderer.root.findAll((n) => n.type === Animated.View && flat(n).overflow === 'hidden')[0])
    const s = 90 / 360
    expect((app().transform as Record<string, unknown>[]).map((t) => read(Object.values(t)[0]))).toEqual([20, 30, s])
    expect(read(clip().height)).toBeCloseTo(50 / s, 5)
    expect(read(clip().borderRadius)).toBeCloseTo(16 / s, 5)
    expect(read(ground().opacity)).toBe(0)
    await act(async () => renderer.update(node(true)))
    await act(async () => c.advance(128))
    expect(read(ground().opacity)).toBeCloseTo(bezier(curves.ease)(0.5), 3)
    await act(async () => c.advance(600))
    await act(async () => renderer.update(node(false)))
    await act(async () => c.advance(440))
    expect(read(ground().opacity)).toBe(1)
  })
})

describe('Scroll', () => {
  it('draws the overlay thumb at the web size, quick to show and slow to leave', async () => {
    const c = installVirtualClock(),
      registry = new Registry()
    const renderer = await render(
      staged(
        <Scroll name="list" style={{ height: 100 }}>
          {null}
        </Scroll>,
        scene(registry),
      ),
    )
    await lay(renderer.root.findAll((n) => n.type === Animated.View)[0], { width: 200, height: 100 })
    await act(async () => renderer.root.findByType(ScrollView).props.onContentSizeChange(200, 400))
    const thumb = () => flat(renderer.root.findAll((n) => n.type === Animated.View && flat(n).width === 6)[0])
    expect(thumb()).toMatchObject({ right: 2, borderRadius: 3, backgroundColor: tokens.ink[4] })
    await act(async () => registry.update('list', { scrolling: true }))
    await act(async () => c.advance(75))
    expect(read(thumb().opacity)).toBeCloseTo(bezier(curves.ease)(0.5), 3)
    await act(async () => c.advance(100))
    await act(async () => registry.update('list', { scrolling: false }))
    await act(async () => c.advance(590))
    expect(read(thumb().opacity)).toBe(1)
    await act(async () => c.advance(260))
    expect(read(thumb().opacity)).toBeCloseTo(1 - bezier(curves.ease)(0.5), 2)
  })
})
