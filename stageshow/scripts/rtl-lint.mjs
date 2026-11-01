#!/usr/bin/env node
// Lists physical left/right CSS left in the kit, the examples and the
// teaching pairs, so a scene mirrors under dir="rtl" (references/rtl.md).
// Passes: logical properties, centering (left: 50% with translate(-50%)),
// and any line carrying a `physical:` comment, the mark for geometry that is
// physical on purpose (a translate from a measured rect, a scaled canvas).
// usage: node scripts/rtl-lint.mjs [dir ...]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['kit', 'examples', 'teaching']

const PHYSICAL = [
  [/(?<![-\w])(left|right)\s*:/, 'left/right: use inset-inline-start/end'],
  [/\b(margin|padding|border|scroll-margin|scroll-padding)-(left|right)\b/, '-left/-right: use -inline-start/-end'],
  [/\bborder-(top|bottom)-(left|right)-radius\b/, 'corner radius: use border-start-start-radius and kin'],
  [/text-align\s*:\s*(left|right)\b/, 'text-align left/right: use start/end'],
  [/float\s*:\s*(left|right)\b/, 'float left/right: use inline-start/inline-end'],
  [/translateX\(\s*-?(?!0(px|%|em)?\s*\))[0-9.]+(px|em|rem|%)\s*\)/, 'a fixed translateX: multiply by var(--ss-x)'],
]

const tokens = (v) => {
  const out = []; let depth = 0; let cur = ''
  for (const ch of v.trim()) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) { if (cur) out.push(cur); cur = '' } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}
const SHORT = /(?:^|[{;])\s*(padding|margin|inset|border-radius)\s*:\s*([^;{}!]+)/g

function lint(file) {
  const found = []
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (/physical:/.test(line) || /left:\s*50%/.test(line) || /translate(X|3d)?\(\s*-50%/.test(line)) return
    const code = line.replace(/\/\*.*?\*\//g, '')
    if (/^\s*(\/\*|\*)/.test(line)) return
    for (const [re, why] of PHYSICAL) if (re.test(code)) found.push([i + 1, why, line.trim()])
    for (const m of code.matchAll(SHORT)) {
      const [, prop, val] = m
      const t = tokens(val.split('/')[0])
      if (prop === 'border-radius') {
        if ((t.length === 4 && (t[0] !== t[1] || t[2] !== t[3])) || t.length === 3) found.push([i + 1, 'asymmetric border-radius shorthand: split into logical corners', line.trim()])
      } else if (t.length === 4 && t[1] !== t[3]) found.push([i + 1, `asymmetric ${prop} shorthand: split into ${prop}-block and ${prop}-inline`, line.trim()])
    }
  })
  return found
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.css')) out.push(p)
  }
  return out
}

let total = 0
for (const d of dirs) for (const file of walk(resolve(root, d))) {
  const found = lint(file)
  for (const [n, why, line] of found) console.log(`${relative(root, file)}:${n}  ${why}\n    ${line}`)
  total += found.length
}
console.log(total ? `\nrtl: ${total} physical declaration(s); write them logically, or mark one that is physical on purpose with a /* physical: why */ comment` : 'rtl: no physical declarations left')
process.exitCode = total ? 1 : 0
