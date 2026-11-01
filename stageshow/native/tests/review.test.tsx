import React from 'react'
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer'
import { AccessibilityInfo, AppState, View } from 'react-native'
import { Stage, type Act } from '../kit'
import { clock, installVirtualClock } from '../kit/clock'
import { states, story, themes, phases, reviewOptions, type ReviewState } from '../review/model'
import { ReviewScene } from '../review/Scene'

let tree: ReactTestRenderer | undefined
const original = AppState.currentState
beforeEach(() => {
  AppState.currentState = 'active'
})
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount())
  tree = undefined
  clock.recording?.restore()
  AppState.currentState = original
  jest.restoreAllMocks()
})

it('mounts both matching scenes at every theme and named beat', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  for (const scene of ['controls', 'phone'] as const)
    for (const theme of themes)
      for (const phase of phases) {
        await act(async () => {
          tree = TestRenderer.create(<ReviewScene scene={scene} theme={theme} phase={phase} reduced />)
        })
        expect(tree!.toJSON()).not.toBeNull()
        await act(async () => tree!.unmount())
      }
  tree = undefined
})

it('replaying during typing cancels the old story and only the new run reaches payoff', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  const c = installVirtualClock(),
    events: string[] = [],
    signals: AbortSignal[] = []
  let latest = states.opening
  const script = async (a: Act<ReviewState>) => {
    signals.push(a.signal)
    await story(a)
  }
  const advance = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) await act(async () => c.advance(50))
  }
  const node = (replay: number) => (
    <Stage
      width={358}
      height={480}
      initial={states.opening}
      poster={states.payoff}
      script={script}
      play="once"
      replay={replay}
      onMark={(m) => events.push(m)}
    >
      {(s) => {
        latest = s
        return <View />
      }}
    </Stage>
  )
  await act(async () => {
    tree = TestRenderer.create(node(0))
  })
  await advance(1400)
  expect(latest).toEqual(states.typing)
  await act(async () => tree!.update(node(1)))
  expect(signals[0].aborted).toBe(true)
  await act(async () => c.advance(50))
  expect(latest).toEqual(states.opening)
  await advance(1400)
  expect(latest).toEqual(states.typing)
  await advance(1800)
  expect(latest).toEqual(states.payoff)
  expect(events.filter((x) => x === 'payoff')).toHaveLength(1)
})

it('OS reduced motion holds the meaningful poster without starting choreography', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  const c = installVirtualClock(),
    script = jest.fn(story)
  let latest = states.opening
  await act(async () => {
    tree = TestRenderer.create(
      <Stage width={358} height={480} initial={states.opening} poster={states.payoff} script={script}>
        {(s) => {
          latest = s
          return <View />
        }}
      </Stage>,
    )
  })
  await act(async () => c.advance(10000))
  expect(latest).toEqual(states.payoff)
  expect(script).not.toHaveBeenCalled()
})

it('ignores unsupported URL options instead of creating invalid review states', () => {
  expect(reviewOptions('?theme=bad&phase=bad&width=-1&scene=bad')).toEqual({
    scene: 'controls',
    theme: 'light',
    phase: 'payoff',
    width: 358,
    reduced: false,
  })
  expect(reviewOptions('?scene=phone&theme=dark&phase=typing&width=720&reduced=1')).toEqual({
    scene: 'phone',
    theme: 'dark',
    phase: 'typing',
    width: 720,
    reduced: true,
  })
})
