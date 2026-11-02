import type { Keys, KeysAt } from './core'
import './keys.css'

// Keystrokes shown as keycaps (act.key): the caps for a combo, and the rows
// the stage draws them in.

export { capsOf, type Keys, type KeysAt } from './core'

/** The last row (fading out) and the current one. */
export function Keycaps({ rows, at }: { rows: (Keys | null)[]; at: KeysAt }) {
  return (
    <>
      {rows.map(
        (row) =>
          row && (
            <div key={row.id} className="ss-keys" data-show={row.show} data-at={at} aria-hidden>
              {row.caps.map((c, i) => (
                <kbd key={i} className="ss-key" data-down={row.down}>
                  {c}
                </kbd>
              ))}
            </div>
          ),
      )}
    </>
  )
}
