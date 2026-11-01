/** Shared data and choreography for the web/native comparison. No renderer imports. */
export const themes = ['light', 'dark', 'blueprint', 'glass'] as const
export const phases = ['opening', 'typing', 'payoff'] as const
export type ReviewTheme = (typeof themes)[number]
export type Phase = (typeof phases)[number]
export type SceneName = 'controls' | 'phone'
export const states = {
  opening: { email: '', count: 1280, enabled: false, saved: false },
  typing: { email: 'maya@studio', count: 1324, enabled: true, saved: false },
  payoff: { email: 'maya@studio.design', count: 1364, enabled: true, saved: true },
}
export type ReviewState = (typeof states)[Phase]
type StoryAct = {
  wait(ms: number): Promise<void>
  set(value: Partial<ReviewState>): Promise<void>
  mark(name: string): void
}
export async function story(a: StoryAct) {
  a.mark('opening')
  await a.wait(1200)
  await a.set(states.typing)
  a.mark('typing')
  await a.wait(1600)
  await a.set(states.payoff)
  a.mark('payoff')
  await a.wait(4000)
}
export async function hold(a: StoryAct) {
  await a.wait(600000)
}
export const chart = [12, 18, 15, 26, 22, 34, 31]
export const messages = ['There’s a new place on the corner.', 'The coffee looks excellent ☕', 'I’m in. Let’s go!']

export function reviewOptions(search: string) {
  const params = new URLSearchParams(search)
  const theme = params.get('theme')
  const phase = params.get('phase')
  return {
    scene: params.get('scene') === 'phone' ? ('phone' as const) : ('controls' as const),
    theme: themes.includes(theme as ReviewTheme) ? (theme as ReviewTheme) : ('light' as const),
    phase: phases.includes(phase as Phase) ? (phase as Phase) : ('payoff' as const),
    width: params.get('width') === '720' ? 720 : 358,
    reduced: params.get('reduced') === '1',
  }
}
