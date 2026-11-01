export type CursorKind =
  | 'pointer'
  | 'ibeam'
  | 'crosshair'
  | 'hand'
  | 'open'
  | 'grab'
  | 'wait'
  | 'resize-ns'
  | 'resize-ew'
  | 'resize-nwse'
  | 'resize-nesw'
export type CursorStyle = 'real' | 'large' | 'circle' | 'touch' | 'arrow'
export type KeysAt = 'bottom' | 'top' | 'bottom-left' | 'bottom-right'
export type Keys = { id: number; caps: string[]; show: boolean; down: boolean }
const KEYCAPS: Record<string, string> = {
  cmd: '⌘',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  ctrl: '⌃',
  enter: '↵',
  return: '↵',
  esc: 'esc',
  tab: '⇥',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  backspace: '⌫',
}
export const capsOf = (combo: string) =>
  combo.split('+').map((k) => KEYCAPS[k.trim().toLowerCase()] ?? k.trim().toUpperCase())
