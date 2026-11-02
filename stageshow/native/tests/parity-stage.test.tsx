import React from 'react'
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer'
import { AccessibilityInfo, Animated, AppState, Text, View, type AppStateStatus } from 'react-native'
import { Stop } from 'react-native-svg'
import { clock, installVirtualClock } from '../kit/clock'
import { MotionContext, useReducedMotion } from '../kit/reduced-motion'
import { useTween } from '../kit/animate'
import { Label, SceneContext, SceneView } from '../kit/native'
import { Registry } from '../kit/registry'
import { Cursor } from '../kit/cursor'
import { Stage, type Act } from '../kit'

let tree: ReactTestRenderer | undefined
const originalAppState = AppState.currentState
beforeEach(() => {
  AppState.currentState = 'active'
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
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
const read = (v: unknown) => (v as { __getValue(): number }).__getValue()
async function run(c: ReturnType<typeof installVirtualClock>, ms: number, every = 50) {
  for (let t = 0; t < ms; t += every) await act(async () => c.advance(every))
}

it('snaps tweens only inside the named instant scope, never under every unnamed view', async () => {
  const c = installVirtualClock()
  const loose = { current: undefined as Animated.Value | undefined },
    scoped = { current: undefined as Animated.Value | undefined }
  function Probe({ to, out }: { to: number; out: typeof loose }) {
    out.current = useTween(to, 100, { ease: [0, 0, 1, 1] })
    return null
  }
  const registry = new Registry()
  const node = (to: number, instantScope?: string) => (
    <SceneContext.Provider
      value={{ registry, root: { current: null }, width: 360, height: 640, scale: 1, instantScope }}
    >
      <MotionContext.Provider value={{ still: false, active: true, instant: false, speed: 1 }}>
        <SceneView>
          <Probe to={to} out={loose} />
        </SceneView>
        <SceneView target="panel">
          <Probe to={to} out={scoped} />
        </SceneView>
      </MotionContext.Provider>
    </SceneContext.Provider>
  )
  const renderer = await render(node(0))
  await act(async () => renderer.update(node(100)))
  await act(async () => c.advance(50))
  expect(read(loose.current)).toBeCloseTo(50, 0)
  expect(read(scoped.current)).toBeCloseTo(50, 0)
  // act.snap(patch, 'panel'): only the named target's subtree jumps
  await act(async () => renderer.update(node(0, 'panel')))
  expect(read(scoped.current)).toBe(0)
  expect(read(loose.current)).toBeCloseTo(50, 0)
  await act(async () => c.advance(50))
  expect(read(loose.current)).toBeCloseTo(25, 0)
})

describe('Stage timing', () => {
  // The OS preference is read once per mount; prime it so the first frame is the scene's
  async function primed() {
    await render(
      <Stage width={100} height={100}>
        {() => <View />}
      </Stage>,
    )
    await act(async () => tree?.unmount())
    tree = undefined
  }

  it('opens on the initial state, not the poster, and starts its script on that frame', async () => {
    await primed()
    const c = installVirtualClock(),
      starts: number[] = [],
      frames: boolean[] = []
    const script = async (a: Act<{ done: boolean }>) => {
      starts.push(clock.now())
      await a.wait(100)
    }
    await render(
      <Stage width={100} height={100} initial={{ done: false }} poster={{ done: true }} script={script}>
        {(s) => {
          frames.push(s.done)
          return <View />
        }}
      </Stage>,
    )
    expect(frames.every((done) => !done)).toBe(true)
    // No settling wait or measurement before a cursorless script
    expect(starts).toEqual([1000])
    // Loops run back to back
    await run(c, 250)
    expect(starts).toEqual([1000, 1100, 1200])
  })

  it('snaps back to its opening on replay, then animates again; a finished once scene keeps moving', async () => {
    await primed()
    const c = installVirtualClock(),
      seen: [boolean, boolean][] = []
    function Probe({ done }: { done: boolean }) {
      seen.push([done, useReducedMotion()])
      return null
    }
    const script = async (a: Act<{ done: boolean }>) => {
      await a.wait(100)
      await a.set({ done: true })
    }
    const node = (replay: number) => (
      <Stage width={100} height={100} initial={{ done: false }} script={script} play="once" replay={replay}>
        {(s) => <Probe done={s.done} />}
      </Stage>
    )
    const renderer = await render(node(0))
    await run(c, 300)
    // Spinners and transitions keep running after a once scene completes
    expect(seen.at(-1)).toEqual([true, false])
    seen.length = 0
    await act(async () => renderer.update(node(1)))
    // The frame that rewinds has motion off, so nothing tweens back from the ending
    const rewind = seen.findIndex(([done]) => !done)
    expect(seen[rewind]).toEqual([false, true])
    expect(seen.at(-1)).toEqual([false, false])
  })

  it('keeps playing through an inactive app (Control Center, a banner) and stops in the background', async () => {
    await primed()
    const c = installVirtualClock(),
      signals: AbortSignal[] = []
    let change: ((state: AppStateStatus) => void) | undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      change = fn
      return { remove() {} } as ReturnType<typeof AppState.addEventListener>
    })
    const script = async (a: Act<object>) => {
      signals.push(a.signal)
      await a.wait(10000)
    }
    await render(
      <Stage width={100} height={100} script={script}>
        {() => <View />}
      </Stage>,
    )
    await act(async () => change?.('inactive'))
    await act(async () => c.advance(50))
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)
    await act(async () => change?.('background'))
    expect(signals[0].aborted).toBe(true)
  })

  it('steps the cursor out before a slow first move, and back in just before it on later loops', async () => {
    await primed()
    const c = installVirtualClock()
    const script = async (a: Act<object>) => {
      await a.wait(2000)
      await a.move({ x: 90, y: 90 }, { duration: 100 })
      await a.wait(300)
      await a.move({ x: 10, y: 10 }, { duration: 100 })
    }
    await render(
      <Stage width={100} height={100} script={script} cursor={{ at: { x: 10, y: 10 } }}>
        {() => <View />}
      </Stage>,
    )
    const shown = () => tree!.root.findByType(Cursor).props.visible as boolean
    const at = async (ms: number) => run(c, ms - (clock.now() - 1000))
    await at(1300)
    expect(shown()).toBe(true)
    // First loop: still at rest past the 1200ms lead, so it leaves the shot
    await at(1400)
    expect(shown()).toBe(false)
    // It comes back the moment it moves
    await at(2050)
    expect(shown()).toBe(true)
    // Second loop (from 2500): it knows the first move comes 2000ms in, so it is out from
    // the start and back 400ms before that move
    await at(2550)
    expect(shown()).toBe(false)
    await at(4050)
    expect(shown()).toBe(false)
    await at(4150)
    expect(shown()).toBe(true)
  })

  it('keeps the scene out of sight until its container reports a width', async () => {
    const renderer = await render(
      <Stage width={100} height={100}>
        {() => <View />}
      </Stage>,
    )
    const outer = renderer.root.findAll((n) => n.type === View && typeof n.props.onLayout === 'function')[0]
    const inner = () => outer.findAll((n) => n.type === View && n.props.collapsable === false)[0].props.style
    expect(inner().opacity).toBe(0)
    await act(async () => outer.props.onLayout({ nativeEvent: { layout: { width: 50, height: 50, x: 0, y: 0 } } }))
    expect(inner().opacity).toBe(1)
    expect(inner().transform).toEqual([{ scale: 0.5 }])
  })

  it('paints the ground orbs at the web strengths, first orb on top, fading out at 70%', async () => {
    const renderer = await render(
      <Stage width={100} height={100} ground="orbs" theme="dark">
        {() => <View />}
      </Stage>,
    )
    const stops = renderer.root.findAllByType(Stop).map((s) => [s.props.offset, s.props.stopColor, s.props.stopOpacity])
    expect(stops).toEqual([
      ['0', '#c9b8ff', 0.3],
      ['0.7', '#c9b8ff', 0],
      ['0', '#ffc59a', 0.24],
      ['0.7', '#ffc59a', 0],
      ['0', '#a9d8ff', 0.18],
      ['0.7', '#a9d8ff', 0],
    ])
    const fills = renderer.root
      .findAll((n) => typeof n.props.fill === 'string' && n.props.fill.includes('orb'))
      .map((n) => n.props.fill as string)
      .filter((fill, i, all) => all.indexOf(fill) === i)
    expect(fills.map((f) => f.slice(-2, -1))).toEqual(['2', '1', '0'])
  })
})

describe('cursor drawing', () => {
  const draw = (props: Partial<React.ComponentProps<typeof Cursor>>) => (
    <MotionContext.Provider value={{ still: false, active: true, instant: false, speed: 1 }}>
      <Cursor position={new Animated.ValueXY()} kind="pointer" pressed={false} touching={false} {...props} />
    </MotionContext.Provider>
  )
  const layers = (renderer: ReactTestRenderer) =>
    renderer.root.findAll((n) => n.type === Animated.View && Array.isArray(n.props.style?.transformOrigin))

  it('scales each glyph about its own hotspot, the large I-beam at 1.15x', async () => {
    installVirtualClock()
    const renderer = await render(draw({ kind: 'ibeam', style: 'large' }))
    const [ibeam] = layers(renderer)
    expect(ibeam.props.style.transformOrigin).toEqual([5, 8, 0])
    expect(ibeam.props.style).toMatchObject({ left: -5, top: -8 })
    expect(read(ibeam.props.style.transform[0].scale)).toBe(1.15)
  })

  it('crosses from one glyph to the next rather than swapping', async () => {
    const c = installVirtualClock()
    const renderer = await render(draw({ kind: 'pointer' }))
    await act(async () => renderer.update(draw({ kind: 'hand' })))
    await act(async () => c.advance(100))
    const [pointer, hand] = layers(renderer)
    // Midway through the 200ms CSS ease, the arrow is shrinking out as the hand grows in
    expect(read(pointer.props.style.opacity)).toBeGreaterThan(0.05)
    expect(read(pointer.props.style.opacity)).toBeLessThan(0.95)
    expect(read(hand.props.style.transform[0].scale)).toBeGreaterThan(0.05)
    await act(async () => c.advance(150))
    expect(read(pointer.props.style.opacity)).toBe(0)
    expect(read(hand.props.style.transform[0].scale)).toBe(1)
  })

  it('dips the press about the hotspot: down 0.9 in 80ms, back softly', async () => {
    const c = installVirtualClock()
    const renderer = await render(draw({}))
    const press = () =>
      renderer.root.findAll((n) => n.type === Animated.View && n.props.style?.transformOrigin === 'top left')[0]
    await act(async () => renderer.update(draw({ pressed: true })))
    await act(async () => c.advance(80))
    expect(read(press().props.style.transform[0].scale)).toBeCloseTo(0.9, 5)
    await act(async () => renderer.update(draw({ pressed: false })))
    await act(async () => c.advance(80))
    expect(read(press().props.style.transform[0].scale)).toBeGreaterThan(0.97)
  })
})

describe('Label', () => {
  it('reads mixed content inline: text runs styled, elements beside them in one row', async () => {
    const renderer = await render(
      <Label style={{ fontSize: 13 }}>
        <>
          <View testID="spinner" /> Deploying
        </>
      </Label>,
    )
    const row = renderer.root.findAll((n) => n.type === View && n.props.style?.flexDirection === 'row')[0]
    expect(row.findByProps({ testID: 'spinner' })).toBeDefined()
    expect(row.findByType(Text).props.children).toBe(' Deploying')
  })

  it('joins text-only pieces into one text', async () => {
    const count = 3
    const renderer = await render(<Label>{count} items</Label>)
    expect(renderer.root.findAllByType(Text).map((t) => t.props.children)).toEqual(['3 items'])
  })

  it('leaves a lone element alone', async () => {
    const renderer = await render(
      <Label>
        <View testID="icon" />
      </Label>,
    )
    expect(renderer.root.findAll((n) => n.type === View && n.props.style?.flexDirection === 'row')).toHaveLength(0)
  })
})

it('hands the scene a target rect without its own scale, as web rect() does', async () => {
  const registry = new Registry()
  type Reply = (...rect: number[]) => void
  const root = { measureInWindow: jest.fn((reply: Reply) => reply(0, 0, 360, 640)) }
  const scene = { registry, root: { current: root as unknown as View }, width: 360, height: 640, scale: 1 }
  const ref = React.createRef<View>()
  await render(
    <SceneContext.Provider value={scene}>
      <SceneView ref={ref} target="card" style={{ width: 100, height: 100, transform: [{ scale: 0.5 }] }} />
    </SceneContext.Provider>,
  )
  // A 100px card at (40, 60), drawn at half size about its center
  Object.assign(ref.current as object, {
    measureInWindow: jest.fn((reply: Reply) => reply(65, 85, 50, 50)),
    measureLayout: jest.fn((_root: unknown, reply: Reply) => reply(40, 60, 100, 100)),
  })
  await registry.measure()
  expect(registry.rect('card')).toEqual({ x: 65, y: 85, width: 50, height: 50 })
  expect(registry.targetRect('card')).toEqual({ x: 40, y: 60, width: 100, height: 100 })
})
