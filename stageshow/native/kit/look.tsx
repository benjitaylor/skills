import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark' | 'blueprint' | 'glass'
export type Palette = 'accent' | 'mono'
export type Fidelity = 'minimal' | 'standard' | 'realistic'
export type Layout = 'wide' | 'compact'
export interface Tokens {
  background: string
  surface: string
  well: string
  border: string
  text: string
  muted: string
  accent: string
  accentSoft: string
  success: string
  danger: string
  warning: string
  ink: [string, string, string, string, string]
  fontSize: number
  radius: number
  fontFamily?: string
}
export type LookTokens = Partial<Tokens>
export interface Look {
  theme: Theme
  palette: Palette
  fidelity: Fidelity
  layout: Layout
  tokens: Tokens
}
const light: Tokens = {
  background: '#faf9f6',
  surface: '#ffffff',
  well: '#f3f2ef',
  border: '#e4e3df',
  text: '#252521',
  muted: '#8a8982',
  accent: '#6366f1',
  accentSoft: '#eeedff',
  success: '#32966a',
  danger: '#d75454',
  warning: '#bd8a32',
  ink: ['#f3f2ef', '#eae9e5', '#dbdad5', '#c7c6c0', '#aaa9a2'],
  fontSize: 12,
  radius: 10,
}
export function resolveTokens(
  theme: Theme,
  palette: Palette,
  greys?: 'warm' | 'cool',
  accent?: string,
  overrides?: LookTokens,
): Tokens {
  let t = { ...light }
  if (greys === 'cool')
    t = {
      ...t,
      background: '#f7f8fa',
      well: '#eef0f3',
      border: '#dfe2e6',
      ink: ['#f1f3f5', '#e8ebef', '#d7dce3', '#c2c9d2', '#a0a9b5'],
    }
  if (theme === 'dark')
    t = {
      ...t,
      background: '#101112',
      surface: '#1e2023',
      well: '#282a2e',
      border: '#34373c',
      text: '#f0f0f2',
      muted: '#9b9da4',
      accentSoft: '#30304c',
      ink: ['#25272b', '#303238', '#41444b', '#5a5e67', '#797e88'],
    }
  if (theme === 'blueprint')
    t = {
      ...t,
      background: '#173e79',
      surface: '#1c4787',
      well: '#214e90',
      border: '#6d91bd',
      text: '#f3f8ff',
      muted: '#a9c5e6',
      accent: '#bcddff',
      accentSoft: '#2e5b96',
      ink: ['#254e83', '#305a91', '#5176a4', '#7d9abf', '#a9c5e6'],
    }
  if (theme === 'glass')
    t = {
      ...t,
      background: 'transparent',
      surface: 'rgba(255,255,255,0.74)',
      well: 'rgba(255,255,255,0.45)',
      border: 'rgba(255,255,255,0.8)',
    }
  if (palette === 'mono') t = { ...t, accent: t.text, accentSoft: t.well }
  if (accent) t.accent = accent
  return { ...t, ...overrides }
}
export const LookContext = createContext<Look>({
  theme: 'light',
  palette: 'accent',
  fidelity: 'standard',
  layout: 'wide',
  tokens: light,
})
export const useLook = () => useContext(LookContext)
