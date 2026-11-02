import { createContext, useContext } from 'react'
import type { Look } from './core'

// The look a stage sets for everything inside it: theme, palette, fidelity,
// and which of its designs (wide or compact) is showing. <Stage> provides it;
// parts read it with useLook().

export type { Theme, Palette, Fidelity, Layout, Look } from './core'

export const LookContext = createContext<Look>({
  theme: 'light',
  palette: 'accent',
  fidelity: 'standard',
  layout: 'wide',
})
export const useLook = () => useContext(LookContext)
