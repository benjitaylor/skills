import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const native = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(tmpdir(), 'stageshow-guidance-'))
const demo = resolve(temporary, 'demo')
try {
  execFileSync(process.execPath, [resolve(native, 'scripts/create-demo.mjs'), demo])
  const references = (await readdir(resolve(native, '../references'))).filter((x) => x.endsWith('.md'))
  for (const name of references)
    assert.equal(
      await readFile(resolve(demo, 'guidance/references', name), 'utf8'),
      await readFile(resolve(native, '../references', name), 'utf8'),
      `${name}: shared guidance changed or missing`,
    )
  for (const file of [
    'AGENTS.md',
    'AUTHORING.md',
    'NATIVE-API.md',
    'guidance/SKILL.md',
    'PARITY.md',
    'examples/Messages.tsx',
    'examples/Subscriptions.tsx',
    'examples/DarkBento.tsx',
  ])
    assert.ok((await stat(resolve(demo, file))).isFile(), `${file} not packaged`)
  for (const file of ['AUTHORING.md', 'README.md', 'NATIVE-API.md', 'PARITY.md']) {
    const text = await readFile(resolve(demo, file), 'utf8')
    for (const match of text.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      const target = match[1]
      if (/^[a-z]+:/.test(target)) continue
      assert.ok((await stat(resolve(dirname(resolve(demo, file)), target))).isFile(), `${file}: broken link ${target}`)
    }
  }
  assert.match(await readFile(resolve(demo, 'AGENTS.md'), 'utf8'), /Read AUTHORING.md/)
  const marker = resolve(demo, 'AUTHORING.md'),
    before = await readFile(marker, 'utf8')
  assert.throws(() =>
    execFileSync(process.execPath, [resolve(native, 'scripts/create-demo.mjs'), demo], { stdio: 'pipe' }),
  )
  assert.equal(await readFile(marker, 'utf8'), before, 'Existing demo must never be overwritten')
  console.log(
    `Standalone guidance verified: ${references.length} unchanged references, native gold examples, agent entry point and local guide links.`,
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
