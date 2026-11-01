import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// A standalone Expo app: no symlinks or imports back into this repository.
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = process.argv[2] && resolve(process.argv[2])
if (!destination || destination === source || destination.startsWith(`${source}/`)) {
  throw new Error('Pass a new destination folder outside stageshow/native')
}
await mkdir(destination) // Never overwrite an existing project.
for (const entry of [
  'kit',
  'brand-sources',
  'playground',
  'review',
  'demo',
  'LICENSE',
  'NOTICE.md',
  'app.json',
  'tsconfig.json',
  'package-lock.json',
]) {
  await cp(resolve(source, entry), resolve(destination, entry), { recursive: true })
}
const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
pkg.scripts = Object.fromEntries(
  Object.entries(pkg.scripts).filter(([name]) =>
    ['start', 'ios', 'android', 'web', 'typecheck', 'export'].includes(name),
  ),
)
await writeFile(resolve(destination, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
await writeFile(resolve(destination, 'README.md'), await readFile(resolve(source, 'demo/README.md')))
await writeFile(resolve(destination, '.gitignore'), 'node_modules/\n.expo/\ndist/\nweb-dist/\n')
console.log(`Created ${destination}\nRun npm ci, then npm run ios (or android/web) in that folder.`)
