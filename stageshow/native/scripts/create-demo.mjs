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
  'examples',
  'REHEARSAL.md',
  'LICENSE',
  'NOTICE.md',
  'app.json',
  'tsconfig.json',
  'package-lock.json',
]) {
  await cp(resolve(source, entry), resolve(destination, entry), { recursive: true })
}
// Carry the complete craft guidance and original reference scenes with the app.
// The web sources are reference material; the runnable native sources live in examples/.
await mkdir(resolve(destination, 'guidance'))
for (const entry of ['references', 'examples']) {
  await cp(resolve(source, '..', entry), resolve(destination, 'guidance', entry), { recursive: true })
}
const sharedSkill = (await readFile(resolve(source, '../SKILL.md'), 'utf8'))
  .replaceAll('native/AUTHORING.md', '../AUTHORING.md')
  .replaceAll('native/README.md', '../NATIVE-API.md')
  .replaceAll('native/PARITY.md', '../PARITY.md')
  .replaceAll('native/kit/', '../kit/')
await writeFile(resolve(destination, 'guidance/SKILL.md'), sharedSkill)
await writeFile(
  resolve(destination, 'PARITY.md'),
  (await readFile(resolve(source, 'PARITY.md'), 'utf8')).replace('(README.md)', '(NATIVE-API.md)'),
)
const authoring = (await readFile(resolve(source, 'AUTHORING.md'), 'utf8'))
  .replaceAll('../SKILL.md', 'guidance/SKILL.md')
  .replaceAll('../references/', 'guidance/references/')
  .replace('README.md#native-contract', 'NATIVE-API.md#native-contract')
await writeFile(resolve(destination, 'AUTHORING.md'), authoring)
await writeFile(
  resolve(destination, 'NATIVE-API.md'),
  (await readFile(resolve(source, 'README.md'), 'utf8')).replaceAll('../references/', 'guidance/references/'),
)
await writeFile(
  resolve(destination, 'AGENTS.md'),
  `# Stageshow Native demo\n\nRead AUTHORING.md before creating or changing an illustration. It routes to the\ncomplete shared skill in guidance/SKILL.md and all original craft references.\nStart from the native examples/; guidance/examples/ contains the original web\nreference sources for visual comparison, not native imports. Use NATIVE-API.md\nfor native styling, targets, lifecycle and validation. Judge scenes beside their\ngold reference and record actual device coverage; passing tests is not visual sign-off.\n`,
)
const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
pkg.scripts = Object.fromEntries(
  Object.entries(pkg.scripts).filter(([name]) =>
    ['start', 'ios', 'android', 'web', 'typecheck', 'export'].includes(name),
  ),
)
await writeFile(resolve(destination, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
await writeFile(
  resolve(destination, 'README.md'),
  (await readFile(resolve(source, 'demo/README.md'), 'utf8')).replaceAll('(../AUTHORING.md)', '(AUTHORING.md)'),
)
await writeFile(resolve(destination, '.gitignore'), 'node_modules/\n.expo/\ndist/\nweb-dist/\n')
console.log(`Created ${destination}\nRun npm ci, then npm run ios (or android/web) in that folder.`)
