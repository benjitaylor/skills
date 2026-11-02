import { createContext, useContext } from 'react'
import { Platform } from 'react-native'

export type Theme = 'light' | 'dark' | 'blueprint' | 'glass'
export type Palette = 'accent' | 'mono'
export type Fidelity = 'minimal' | 'standard' | 'realistic'
export type Layout = 'wide' | 'compact'
/** Box shadows in React Native's CSS syntax, one per depth the web kit names (`--ss-shadow-*`). */
export interface Shadows {
  window: string
  float: string
  card: string
  hero: string
  lift: string
  satellite: string
  ground: string
}
/** The web kit's radius scale (`--ss-radius-*`). */
export interface Radii {
  sm: number
  md: number
  lg: number
  window: number
  pill: number
}
/**
 * Native values of the web kit's `--ss-*` tokens. Names follow the web where they are new;
 * `background`, `border`, `text` and `muted` keep their earlier native names for the stage
 * ground, `--ss-line`, `--ss-text-strong` and `--ss-text`.
 */
export interface Tokens {
  /** The stage's own ground. Light and dark leave it to the host, as on web; blueprint and glass paint theirs. */
  background: string
  canvas: string
  surface: string
  chrome: string
  raised: string
  well: string
  /** ink-3 flattened onto the surface, for overlapping shapes. */
  fill: string
  border: string
  lineFaint: string
  text: string
  muted: string
  textFaint: string
  icon: string
  iconFaint: string
  accent: string
  accent2: string
  accentSoft: string
  accentText: string
  success: string
  danger: string
  warning: string
  successSoft: string
  successText: string
  dangerSoft: string
  dangerText: string
  warningSoft: string
  warningText: string
  ink: [string, string, string, string, string]
  shadow: Shadows
  radii: Radii
  /** Control and row heights (`--ss-control`, `--ss-row`). */
  control: number
  row: number
  fontSize: number
  radius: number
  fontFamily?: string
  mono: string
}
export type LookTokens = Partial<Tokens>
export interface Look {
  theme: Theme
  palette: Palette
  fidelity: Fidelity
  layout: Layout
  tokens: Tokens
}
// iOS resolves ui-monospace to SF Mono, the web kit's first choice; a bare "monospace" is not a family there.
const mono = Platform.select({
  ios: 'ui-monospace',
  android: 'monospace',
  default: '"SF Mono", SFMono-Regular, ui-monospace, Consolas, monospace',
})
const light: Tokens = {
  background: 'transparent',
  canvas: '#f6f5f4',
  surface: '#ffffff',
  chrome: '#ffffff',
  raised: '#ffffff',
  well: '#efeeec',
  fill: '#ebebeb',
  border: 'rgba(0,0,0,0.06)',
  lineFaint: 'rgba(0,0,0,0.04)',
  text: '#262628',
  muted: '#7a7a7d',
  textFaint: '#9a9a9d',
  icon: '#707074',
  iconFaint: '#c4c4c7',
  accent: '#3b82f6',
  accent2: '#8b5cf6',
  accentSoft: 'rgba(59,130,246,0.12)',
  accentText: '#306bca',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  successSoft: 'rgba(34,197,94,0.12)',
  successText: '#15803d',
  dangerSoft: 'rgba(239,68,68,0.1)',
  dangerText: '#b91c1c',
  warningSoft: 'rgba(245,158,11,0.14)',
  warningText: '#b45309',
  ink: ['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.15)'],
  shadow: {
    window: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)',
    float: '0 0 0 1px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.12), 0 12px 32px rgba(0,0,0,0.08)',
    card: '0 1px 2px rgba(0,0,0,0.04)',
    hero: '0 0 0 1px rgba(0,0,0,0.06), 0 30px 60px -12px rgba(50,50,93,0.25), 0 18px 36px -18px rgba(0,0,0,0.3)',
    lift: '0 0 0 1px rgba(0,0,0,0.04), 0 12px 28px -6px rgba(50,50,93,0.28), 0 6px 12px -6px rgba(0,0,0,0.16)',
    satellite: '0 0 0 1px rgba(0,0,0,0.04), 0 14px 32px -8px rgba(50,50,93,0.24), 0 4px 10px -4px rgba(0,0,0,0.1)',
    ground: '0 0 0 1px rgba(50,50,93,0.06), 0 24px 48px -24px rgba(50,50,93,0.18)',
  },
  radii: { sm: 6, md: 8, lg: 10, window: 12, pill: 999 },
  control: 34,
  row: 26,
  fontSize: 12,
  fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
  radius: 10,
  mono,
}
const rgb = (color: string) => {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim())?.[1]
  if (!hex) return null
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}
/** CSS color-mix in sRGB for hex colors; other color strings pass through unchanged. */
export function mix(color: string, other: string, amount: number) {
  const a = rgb(color),
    b = rgb(other)
  if (!a || !b) return color
  return `#${a
    .map((v, i) =>
      Math.round(v * amount + b[i] * (1 - amount))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
/** CSS color-mix with transparent: the color at `alpha`, for hex colors. */
export function alpha(color: string, amount: number) {
  const c = rgb(color)
  return c ? `rgba(${c.join(',')},${amount})` : color
}
export function resolveTokens(
  theme: Theme,
  palette: Palette,
  greys?: 'warm' | 'cool',
  accent?: string,
  overrides?: LookTokens,
): Tokens {
  let t: Tokens = { ...light }
  if (theme === 'dark')
    t = {
      ...t,
      canvas: '#111113',
      surface: '#1a1a1d',
      chrome: '#1d1d20',
      raised: '#26262a',
      well: '#0a0a0b',
      fill: '#313134',
      border: 'rgba(255,255,255,0.08)',
      lineFaint: 'rgba(255,255,255,0.05)',
      text: '#ececee',
      muted: '#9d9da1',
      textFaint: '#6c6c70',
      icon: '#9a9aa0',
      iconFaint: '#4a4a50',
      accentSoft: 'rgba(59,130,246,0.2)',
      accentText: '#76a8f9',
      successSoft: 'rgba(34,197,94,0.16)',
      successText: '#4ade80',
      dangerSoft: 'rgba(239,68,68,0.16)',
      dangerText: '#f87171',
      warningSoft: 'rgba(245,158,11,0.18)',
      warningText: '#fbbf24',
      ink: [
        'rgba(255,255,255,0.05)',
        'rgba(255,255,255,0.07)',
        'rgba(255,255,255,0.1)',
        'rgba(255,255,255,0.13)',
        'rgba(255,255,255,0.2)',
      ],
      shadow: {
        window: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.4)',
        float: '0 0 0 1px rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.3)',
        card: '0 0 0 1px rgba(255,255,255,0.05)',
        hero: '0 0 0 1px rgba(255,255,255,0.08), 0 30px 60px -12px rgba(0,0,0,0.6)',
        lift: '0 0 0 1px rgba(255,255,255,0.1), 0 12px 28px -6px rgba(0,0,0,0.6)',
        satellite: '0 0 0 1px rgba(255,255,255,0.1), 0 14px 32px -8px rgba(0,0,0,0.7), 0 4px 10px -4px rgba(0,0,0,0.5)',
        ground: '0 0 0 1px rgba(255,255,255,0.1), 0 24px 48px -24px rgba(0,0,0,0.6)',
      },
    }
  if (theme === 'blueprint')
    t = {
      ...t,
      background: '#1450b4',
      canvas: 'transparent',
      surface: '#1857bd',
      chrome: 'transparent',
      raised: '#1b5cc4',
      well: '#1450b4',
      fill: '#4277cc',
      border: 'rgba(214,232,255,0.35)',
      lineFaint: 'rgba(214,232,255,0.2)',
      text: '#f0f6ff',
      muted: '#b3c9ec',
      textFaint: '#7fa1da',
      icon: '#c9dcf7',
      iconFaint: '#6f97d6',
      accent: '#ffffff',
      accentSoft: 'rgba(255,255,255,0.15)',
      success: '#e6f0ff',
      danger: '#e6f0ff',
      warning: '#e6f0ff',
      successSoft: 'rgba(255,255,255,0.14)',
      dangerSoft: 'rgba(255,255,255,0.14)',
      warningSoft: 'rgba(255,255,255,0.14)',
      successText: '#ffffff',
      dangerText: '#ffffff',
      warningText: '#ffffff',
      ink: [
        'rgba(214,232,255,0.12)',
        'rgba(214,232,255,0.16)',
        'rgba(214,232,255,0.22)',
        'rgba(214,232,255,0.3)',
        'rgba(214,232,255,0.45)',
      ],
      shadow: {
        ...t.shadow,
        window: '0 0 0 1px rgba(214,232,255,0.55)',
        float: '0 0 0 1px rgba(214,232,255,0.7)',
        card: '0 0 0 1px rgba(214,232,255,0.35)',
        hero: '0 0 0 1px rgba(214,232,255,0.55)',
        satellite: '0 0 0 1px rgba(214,232,255,0.8)',
        ground: '0 0 0 1px rgba(214,232,255,0.7)',
      },
    }
  if (theme === 'glass')
    t = {
      ...t,
      background: '#ebe9f5',
      canvas: 'rgba(255,255,255,0.5)',
      surface: 'rgba(255,255,255,0.62)',
      chrome: 'rgba(255,255,255,0.38)',
      raised: 'rgba(255,255,255,0.74)',
      well: '#ebe9f5',
      border: 'rgba(255,255,255,0.65)',
      lineFaint: 'rgba(255,255,255,0.45)',
      shadow: {
        ...t.shadow,
        window: 'inset 0 0 0 1px rgba(255,255,255,0.75), 0 20px 50px -14px rgba(40,40,90,0.28)',
        hero: 'inset 0 0 0 1px rgba(255,255,255,0.75), 0 30px 60px -16px rgba(40,40,90,0.3)',
        satellite: 'inset 0 0 0 1px rgba(255,255,255,0.85), 0 16px 36px -10px rgba(40,40,90,0.32)',
        float: 'inset 0 0 0 1px rgba(255,255,255,0.85), 0 12px 32px -8px rgba(40,40,90,0.28)',
        ground: 'inset 0 0 0 1px rgba(255,255,255,0.85), 0 24px 48px -24px rgba(40,40,90,0.24)',
        card: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
      },
    }
  // Cool greys change the light theme's canvas and well only, as on web.
  if (greys === 'cool' && theme === 'light') t = { ...t, canvas: '#f4f5f8', well: '#eceef2' }
  if (palette === 'mono') {
    const ink = theme === 'dark' ? '#f2f2f2' : '#1a1a1a'
    t = {
      ...t,
      accent: ink,
      accent2: ink,
      success: ink,
      danger: ink,
      warning: ink,
      successText: ink,
      dangerText: ink,
      accentSoft: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      successSoft: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      dangerSoft: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    }
  }
  if (accent) t = { ...t, accent, accent2: accent, accentSoft: alpha(accent, 0.14) }
  // --ss-accent-text: color-mix(accent 82%, #000), or (accent 70%, #fff) in dark, from whichever accent applies.
  t.accentText = theme === 'dark' ? mix(t.accent, '#ffffff', 0.7) : mix(t.accent, '#000000', 0.82)
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
