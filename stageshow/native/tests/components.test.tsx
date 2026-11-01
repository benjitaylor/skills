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

it('holds a hover scene as a poster until native touch activation', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  const c = installVirtualClock(),
    script = jest.fn(async () => {})
  const renderer = await render(
    <Stage width={100} height={100} initial={{ done: false }} poster={{ done: true }} script={script} play="hover">
      {(s) => <View testID={s.done ? 'poster' : 'opening'} />}
    </Stage>,
  )
  await act(async () => c.advance(1000))
  expect(script).not.toHaveBeenCalled()
  expect(renderer.root.findAllByProps({ testID: 'poster' }).length).toBeGreaterThan(0)
  const target = renderer.root.findAll((node) => typeof node.props.onTouchEnd === 'function')[0]
  await act(async () => target.props.onTouchEnd())
  await act(async () => c.advance(50))
  expect(script).toHaveBeenCalledTimes(1)
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
