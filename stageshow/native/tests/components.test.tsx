import React from 'react'
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer'
import { AccessibilityInfo, Animated, AppState, View } from 'react-native'
import App from '../playground/App'
import { clock, installVirtualClock } from '../kit/clock'
import { MotionContext } from '../kit/reduced-motion'
import { useTween } from '../kit/animate'
import { SceneContext, SceneView } from '../kit/native'
import { Registry } from '../kit/registry'
import { Swap, States } from '../kit/motion/layout'
import { Check, Expand, Phone, Stage, type Act } from '../kit'

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)

let tree: ReactTestRenderer | undefined
const originalAppState = AppState.currentState
beforeEach(() => {
  AppState.currentState = 'active'
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
})
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount())
  tree = undefined
  clock.recording?.restore()
  AppState.currentState = originalAppState
  jest.restoreAllMocks()
})
async function render(node: React.ReactElement) {
  await act(async () => {
    tree = TestRenderer.create(node)
  })
  return tree!
}

it('renders every gallery page and every phone frame using native primitives', async () => {
  const renderer = await render(<App />)
  for (const label of ['Kit', 'Motion', 'Devices', 'Inbox']) {
    const button = renderer.root
      .findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
      .find((node) => node.findAll((child) => child.props.children === label).length > 0)
    expect(button).toBeDefined()
    await act(async () => {
      button!.props.onPress()
    })
    expect(renderer.toJSON()).not.toBeNull()
    if (label === 'Devices') expect(renderer.root.findAllByType(Phone)).toHaveLength(9)
  }
})
it('uses pending and completed states in the same native Check', async () => {
  const renderer = await render(<Check on={false} pending />)
  expect(renderer.root.findAllByType(Animated.View).length).toBeGreaterThan(1)
  await act(async () => renderer.update(<Check on pending />))
  expect(renderer.toJSON()).not.toBeNull()
})
it('retargets an interrupted tween from its current value and snaps for reduced motion', async () => {
  const c = installVirtualClock()
  let value: Animated.Value | undefined
  function Probe({ to }: { to: number }) {
    value = useTween(to, 100, { ease: [0, 0, 1, 1] })
    return null
  }
  const mode = { still: false, instant: false, active: true, speed: 1 }
  const node = (to: number, still = false) => (
    <MotionContext.Provider value={{ ...mode, still }}>
      <Probe to={to} />
    </MotionContext.Provider>
  )
  const renderer = await render(node(0))
  await act(async () => renderer.update(node(100)))
  await act(async () => c.advance(50))
  const read = () => (value as unknown as { __getValue(): number }).__getValue()
  expect(read()).toBeCloseTo(50, 0)
  await act(async () => renderer.update(node(0)))
  expect(read()).toBeCloseTo(50, 0)
  await act(async () => c.advance(50))
  expect(read()).toBeCloseTo(25, 0)
  await act(async () => renderer.update(node(80, true)))
  expect(read()).toBe(80)
})
it('keeps invisible sizing probes out of the target registry and releases old Swap layers', async () => {
  const c = installVirtualClock(),
    registry = new Registry()
  const scene = { registry, root: { current: null }, width: 360, height: 640, scale: 1 }
  const node = (id: number) => (
    <SceneContext.Provider value={scene}>
      <Swap id={id}>
        <SceneView target="item">
          <View />
        </SceneView>
      </Swap>
      <States<'a' | 'b'> value="a" states={{ a: <SceneView target="a" />, b: <SceneView target="b" /> }} />
    </SceneContext.Provider>
  )
  const renderer = await render(node(0))
  expect([...registry.entries.keys()].sort()).toEqual(['a', 'b', 'item'])
  expect(registry.entries.get('b')?.hidden).toBe(true)
  await act(async () => renderer.update(node(1)))
  expect([...registry.entries.keys()].filter((n) => n === 'item')).toHaveLength(1)
  await act(async () => c.advance(700))
  // Current content + its measurement probe; the outgoing layer has unmounted.
  expect(renderer.root.findAllByType(SceneView).filter((n) => n.props.target === 'item')).toHaveLength(2)
})

it('aborts an offscreen native run and restarts it on return', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  const c = installVirtualClock(),
    signals: AbortSignal[] = []
  const script = jest.fn(async (a: Act<{ done: boolean }>) => {
    signals.push(a.signal)
    await a.wait(10000)
  })
  const node = (visible: boolean) => (
    <Stage width={100} height={100} initial={{ done: false }} script={script} visible={visible}>
      {() => <View />}
    </Stage>
  )
  const renderer = await render(node(true))
  await act(async () => c.advance(50))
  expect(script).toHaveBeenCalledTimes(1)
  await act(async () => renderer.update(node(false)))
  expect(signals[0].aborted).toBe(true)
  await act(async () => c.advance(1000))
  expect(script).toHaveBeenCalledTimes(1)
  await act(async () => renderer.update(node(true)))
  await act(async () => c.advance(50))
  expect(script).toHaveBeenCalledTimes(2)
})

it('plays a hover scene once on a native screen, from its opening, and replays it on tap', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  const c = installVirtualClock(),
    script = jest.fn(async (a: Act<{ done: boolean }>) => {
      await a.wait(100)
      await a.set({ done: true })
    })
  const renderer = await render(
    <Stage width={100} height={100} initial={{ done: false }} poster={{ done: true }} script={script} play="hover">
      {(s) => <View testID={s.done ? 'ending' : 'opening'} />}
    </Stage>,
  )
  // A phone has no hover: as on web's (hover: none), it plays once when seen
  expect(script).toHaveBeenCalledTimes(1)
  expect(renderer.root.findAllByProps({ testID: 'opening' }).length).toBeGreaterThan(0)
  await act(async () => c.advance(1000))
  expect(script).toHaveBeenCalledTimes(1)
  expect(renderer.root.findAllByProps({ testID: 'ending' }).length).toBeGreaterThan(0)
  const target = renderer.root.findAll((node) => typeof node.props.onTouchEnd === 'function')[0]
  await act(async () => target.props.onTouchEnd())
  await act(async () => c.advance(50))
  expect(script).toHaveBeenCalledTimes(2)
})

it('exposes a stage as one labelled element and hides its faux UI from assistive tech', async () => {
  const stageView = (renderer: ReactTestRenderer) =>
    renderer.root.findAll((node) => node.type === View && typeof node.props.onLayout === 'function')[0]
  const renderer = await render(
    <Stage width={100} height={100} accessibilityLabel="A document is saved">
      {() => <View testID="faux" />}
    </Stage>,
  )
  const labelled = stageView(renderer)
  expect(labelled.props).toMatchObject({
    accessible: true,
    accessibilityRole: 'image',
    accessibilityLabel: 'A document is saved',
  })
  const hidden = labelled.findAll(
    (node) => node.type === View && node.props.importantForAccessibility === 'no-hide-descendants',
  )[0]
  expect(hidden.props.accessibilityElementsHidden).toBe(true)
  expect(hidden.findAllByProps({ testID: 'faux' }).length).toBeGreaterThan(0)

  await act(async () =>
    renderer.update(
      <Stage width={100} height={100} script={async () => {}} play="hover">
        {() => <View />}
      </Stage>,
    ),
  )
  expect(stageView(renderer).props).toMatchObject({ accessible: true, accessibilityRole: 'button' })
  await act(async () =>
    renderer.update(
      <Stage width={100} height={100}>
        {() => <View />}
      </Stage>,
    ),
  )
  expect(stageView(renderer).props.accessible).toBe(false)
})

it('warns when a looping script does not return to its opening state', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  const warnings = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const c = installVirtualClock()
  const script = async (a: Act<{ done: boolean }>) => {
    await a.set({ done: true })
    await a.wait(100)
  }
  await render(
    <Stage width={100} height={100} initial={{ done: false }} script={script}>
      {() => <View />}
    </Stage>,
  )
  await act(async () => c.step(20))
  expect(warnings).toHaveBeenCalledWith(
    '[stageshow-native] loop seam: state still differs from initial at the end of the script (done)',
  )
})

it('measures targets against one root reading and keeps the last rect when measurement stalls', async () => {
  const registry = new Registry()
  type Reply = (...rect: number[]) => void
  const root = { measureInWindow: jest.fn((reply: Reply) => reply(0, 0, 360, 640)) }
  const scene = { registry, root: { current: root as unknown as View }, width: 360, height: 640, scale: 1 }
  // The jest preset's native views never answer a measurement; give each target real replies.
  type Native = { measureInWindow: jest.Mock; measureLayout: jest.Mock }
  const refs = { a: React.createRef<View>(), b: React.createRef<View>(), c: React.createRef<View>() }
  await render(
    <SceneContext.Provider value={scene}>
      <SceneView ref={refs.a} target="a" />
      <SceneView ref={refs.b} target="b" />
      <SceneView ref={refs.c} target="c" />
    </SceneContext.Provider>,
  )
  const native = (name: keyof typeof refs) => refs[name].current as unknown as Native
  for (const [name, x] of [
    ['a', 10],
    ['b', 80],
    ['c', 150],
  ] as const)
    Object.assign(native(name), {
      measureInWindow: jest.fn((reply: Reply) => reply(x, 20, 50, 30)),
      measureLayout: jest.fn((_root: unknown, reply: Reply) => reply(x, 20, 50, 30)),
    })
  root.measureInWindow.mockClear()
  await registry.measure()
  expect(registry.rect('b')).toEqual({ x: 80, y: 20, width: 50, height: 30 })
  expect(root.measureInWindow).toHaveBeenCalledTimes(1)
  expect(native('a').measureLayout).toHaveBeenCalledTimes(1)

  // An unchanged pass: one root reading, and no layout re-measurement.
  await registry.measure()
  expect(root.measureInWindow).toHaveBeenCalledTimes(2)
  expect(native('a').measureLayout).toHaveBeenCalledTimes(1)

  // A native reply that never arrives keeps the target where it was.
  native('a').measureInWindow.mockImplementation(() => {})
  await registry.measure()
  expect(registry.rect('a')).toEqual({ x: 10, y: 20, width: 50, height: 30 })
})

it('updates hovered targets without re-rendering the whole stage', async () => {
  let renders = 0,
    registry: Registry | undefined
  function Grab() {
    registry = React.useContext(SceneContext)?.registry
    return null
  }
  await render(
    <Stage width={100} height={100}>
      {() => {
        renders++
        return (
          <SceneView target="row" hoverStyle={{ opacity: 0.5 }}>
            <Grab />
          </SceneView>
        )
      }}
    </Stage>,
  )
  const before = renders
  await act(async () => registry!.update('row', { hover: true }))
  expect(renders).toBe(before)
  expect(
    tree!.root.findAll((node) => node.type === Animated.View && node.props.testID === 'row')[0].props.style,
  ).toContainEqual({ opacity: 0.5 })
  await act(async () => registry!.notify())
  expect(renders).toBe(before + 1)
})

it('hides launched-screen content and targets behind the closed Expand face', async () => {
  const registry = new Registry()
  const scene = { registry, root: { current: null }, width: 360, height: 640, scale: 1 }
  const node = (open: boolean) => (
    <SceneContext.Provider value={scene}>
      <MotionContext.Provider value={{ still: true, active: false, instant: false, speed: 1 }}>
        <Expand open={open} from={{ x: 20, y: 30, width: 100, height: 50 }} face={<View />}>
          <SceneView target="screen-action" />
        </Expand>
      </MotionContext.Provider>
    </SceneContext.Provider>
  )
  const renderer = await render(node(false))
  expect(registry.entries.get('screen-action')?.hidden).toBe(true)
  const content = renderer.root.findAllByType(Animated.View).find((n) => n.props.style?.width === 360)
  expect((content?.props.style.opacity as { __getValue(): number }).__getValue()).toBe(0)
  await act(async () => renderer.update(node(true)))
  expect(registry.entries.get('screen-action')?.hidden).toBe(false)
  expect((content?.props.style.opacity as { __getValue(): number }).__getValue()).toBe(1)
})
