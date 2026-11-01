import type { CSSProperties } from 'react'
import { useLook } from '../looks'
import { formatNumber } from '../dir'
import './Money.css'

// The Saudi riyal sign (U+20C1, Unicode 17). Few fonts draw it yet, so it is
// drawn here: the paths are Lucide's saudi-riyal icon (lucide-static 1.66.0,
// ISC licence; see NOTICE.md), the same stroke family as the kit's icons.
const RIYAL = ['M10 2.977v13.19a2 2 0 01-1.23 1.846L4 19.999', 'M14 4v9.523a1 1 0 001.371.928L19 13', 'm19 18-5 2', 'M19 8 4 14']

/**
 * The riyal sign at the size of the text around it, in currentColor. `weight`
 * is its stroke on a 24-unit grid: 2 sits with regular text, 2.6 with bold.
 */
export function Riyal({ weight = 2, className, style }: { weight?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={`ss-riyal${className ? ` ${className}` : ''}`} style={style} role="img" aria-label="ريال سعودي">
      {RIYAL.map((d) => <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  )
}

/**
 * An amount in riyals: the sign on the number's left with a space, as SAMA's
 * rules set it in every language, and the digits and separators of the
 * stage's `digits`. The pair reads left to right in an rtl paragraph too, so
 * the sign never lands on the wrong side. `sign="abbr"` writes ر.س after
 * the number instead, as a bank SMS or a system notification still does.
 */
export function Money({ value, decimals = 2, sign = 'riyal', weight, className, style }: { value: number; decimals?: number; sign?: 'riyal' | 'abbr'; weight?: number; className?: string; style?: CSSProperties }) {
  const { digits } = useLook()
  const figure = formatNumber(value, digits, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  if (sign === 'abbr') return <span className={`ss-money${className ? ` ${className}` : ''}`} style={style}>{figure} ر.س</span>
  return (
    <span className={`ss-money${className ? ` ${className}` : ''}`} style={style} dir="ltr">
      <Riyal weight={weight} />
      <span className="ss-money__figure">{figure}</span>
    </span>
  )
}
