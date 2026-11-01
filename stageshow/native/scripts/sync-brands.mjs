import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const input = path.resolve(root, '../kit/brands')
const registry = fs.readFileSync(path.join(input, 'index.ts'), 'utf8')
const embedded = registry.replace(/new URL\('\.\/([^']+\.svg)', import\.meta\.url\)\.href/g, (_, file) =>
  JSON.stringify(fs.readFileSync(path.join(input, file), 'utf8')),
)
if (embedded.includes('import.meta.url'))
  throw new Error('Unexpected asset URL syntax; review the upstream registry before updating')
fs.writeFileSync(
  path.join(root, 'kit/brands.ts'),
  '// Generated from ../../kit/brands by scripts/sync-brands.mjs. Keep brand-sources notices when copying.\n' +
    embedded,
)
for (const file of fs.readdirSync(input).filter((file) => file === 'SOURCES.md' || file.startsWith('LICENSE-')))
  fs.copyFileSync(path.join(input, file), path.join(root, 'brand-sources', file))
console.log('Embedded the upstream brand artwork and retained its source/license notices.')
