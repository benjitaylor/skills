import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { AccessibilityInfo } from 'react-native'
import Messages from '../examples/Messages'
import Subscriptions from '../examples/Subscriptions'
import DarkBento from '../examples/DarkBento'
import { resolveTokens } from '../kit/look'

it.each([
  [Messages, "Perfect, I'll grab us a table by the window"],
  [Subscriptions, 'Studio Kite'],
  [DarkBento, 'Added by Mara'],
] as const)('renders the complete gold poster without starting motion', async (Component, payoff) => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  let tree: TestRenderer.ReactTestRenderer
  const onError = jest.fn(),
    onMark = jest.fn()
  await act(async () => {
    tree = TestRenderer.create(<Component poster onError={onError} onMark={onMark} />)
  })
  expect(JSON.stringify(tree!.toJSON())).toContain(payoff)
  expect(onError).not.toHaveBeenCalled()
  expect(onMark).not.toHaveBeenCalled()
  await act(async () => tree!.unmount())
  jest.restoreAllMocks()
})

it('keeps placeholder ink translucency aligned with the original light and dark materials', () => {
  expect(resolveTokens('light', 'accent').ink).toEqual([
    'rgba(0,0,0,0.04)',
    'rgba(0,0,0,0.06)',
    'rgba(0,0,0,0.08)',
    'rgba(0,0,0,0.1)',
    'rgba(0,0,0,0.15)',
  ])
  expect(resolveTokens('dark', 'accent').ink).toEqual([
    'rgba(255,255,255,0.05)',
    'rgba(255,255,255,0.07)',
    'rgba(255,255,255,0.1)',
    'rgba(255,255,255,0.13)',
    'rgba(255,255,255,0.2)',
  ])
})
