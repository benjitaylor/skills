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
  background: '#f6f5f4',
  surface: '#ffffff',
  well: '#efeeec',
  border: 'rgba(0,0,0,0.1)',
  text: '#262628',
  muted: '#7a7a7d',
  accent: '#3b82f6',
  accentSoft: 'rgba(59,130,246,0.12)',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  ink: ['#efeeec', '#eae9e5', '#dbdad5', '#c7c6c0', '#aaa9a2'],
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
      background: '#111113',
      surface: '#1a1a1d',
      well: '#0a0a0b',
      border: 'rgba(255,255,255,0.13)',
      text: '#ececee',
      muted: '#9d9da1',
      accentSoft: 'rgba(59,130,246,0.2)',
      ink: ['#25272b', '#303238', '#41444b', '#5a5e67', '#797e88'],
    }
  if (theme === 'blueprint')
    t = {
      ...t,
      background: '#1450b4',
      surface: '#1857bd',
      well: '#1450b4',
      border: 'rgba(214,232,255,0.35)',
      text: '#f0f6ff',
      muted: '#b3c9ec',
      accent: '#ffffff',
      accentSoft: 'rgba(255,255,255,0.15)',
      success: '#e6f0ff',
      danger: '#e6f0ff',
      warning: '#e6f0ff',
      ink: ['#254e83', '#305a91', '#5176a4', '#7d9abf', '#b3c9ec'],
    }
  if (theme === 'glass')
    t = {
      ...t,
      background: '#ebe9f5',
      surface: 'rgba(255,255,255,0.62)',
      well: '#ebe9f5',
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
