import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const web = path.resolve(root, '../kit'),
  native = path.join(root, 'kit')
function source(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}
function exportsAt(dir) {
  const sf = source(path.join(dir, 'index.ts')),
    result = new Map()
  sf.forEachChild((node) => {
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const item of node.exportClause.elements)
        result.set(item.name.text, node.isTypeOnly || item.isTypeOnly ? 'type' : 'value')
    }
  })
  return result
}
const original = exportsAt(web),
  port = exportsAt(native)
const missing = [...original].filter(([name, kind]) => port.get(name) !== kind)
if (missing.length) {
  console.error('Missing exports:', missing)
  process.exitCode = 1
} else
  console.log(
    `Public exports: ${[...original.values()].filter((x) => x === 'value').length} values and ${[...original.values()].filter((x) => x === 'type').length} types present.`,
  )
function functions(dir) {
  const result = new Map()
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) for (const [key, value] of functions(path.join(dir, entry.name))) result.set(key, value)
    else if (/\.tsx?$/.test(entry.name)) {
      const sf = source(path.join(dir, entry.name))
      sf.forEachChild((node) => {
        if (
          !ts.isFunctionDeclaration(node) ||
          !node.name ||
          !node.parameters[0] ||
          !ts.isObjectBindingPattern(node.parameters[0].name)
        )
          return
        result.set(
          node.name.text,
          node.parameters[0].name.elements
            .filter((el) => !el.dotDotDotToken)
            .map((el) => (el.propertyName ?? el.name).getText(sf).replace(/['"]/g, '')),
        )
      })
    }
  }
  return result
}
const w = functions(web),
  n = functions(native)
for (const [name] of original) {
  if (!w.has(name) || !n.has(name)) continue
  const absent = w.get(name).filter((p) => !['className'].includes(p) && !n.get(name).includes(p))
  if (absent.length) {
    console.error(`${name}: missing explicitly consumed props ${absent.join(', ')}`)
    process.exitCode = 1
  }
}
// This checks the named API surface, not visual or behavioural parity.
