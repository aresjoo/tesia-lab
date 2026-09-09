import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readFile, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'

// PM §16: Backend #104 retained artifact includes #102 committed replay.
// Separate, disposable SQLite test runtime, NOT an upgrade of the PG service.
const pins = {
  tesia_backend: ['tesia_backend-0.1.0-py3-none-any.whl', 'b5965d4ebdb7f179e92411341d2d64a79410e67dd4b8563f5a324bc543496025'],
  tesia_ai: ['tesia_ai-0.1.0-py3-none-any.whl', '9241104520c145a7d2fd398eb2ee2823b0f8def2986d6c9e717aa25e3425bd99'],
  tesia_contracts: ['tesia_contracts-0.14.0rc1-py3-none-any.whl', 'e9a8a401e0c2437eb42a528730810b08a6a5dcca00744e10f2a9ddb09b155e5f'],
}
const releaseInput = process.env.TETH_REVIEWED_SERVICE_RELEASE
const webInput = process.env.TETH_CANDIDATE_WEB_DIST
if (!releaseInput || !webInput) throw new Error('EXPLICIT_REVIEWED_RELEASE_AND_WEB_REQUIRED')
const release = await realpath(resolve(releaseInput))
const web = await realpath(resolve(webInput))
const origin = 'http://127.0.0.1:8790'
const html = await readFile(join(web, 'internal-poc.html'), 'utf8')
if (!html.includes(`name="tesia-owner-local-service-url" content="${origin}"`)) throw new Error('CANDIDATE_ORIGIN_ATTESTATION_REQUIRED')
for (const [name, hash] of Object.values(pins)) {
  if (createHash('sha256').update(await readFile(join(release, 'wheels', name))).digest('hex') !== hash) throw new Error('REVIEWED_WHEEL_HASH_MISMATCH')
}
const python = join(release, 'venv/bin/python')
const cleanEnv = { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', PYTHONUNBUFFERED: '1' }
// Read-only exact installed package payload verification, before imports.
execFileSync(python, ['-I', '-c', `
import json, pathlib, sys, sysconfig, zipfile
root = pathlib.Path(sys.argv[1])
site = pathlib.Path(sysconfig.get_paths()['purelib'])
for package, (filename, _) in json.loads(sys.argv[2]).items():
    with zipfile.ZipFile(root / 'wheels' / filename) as wheel:
        names = [n for n in wheel.namelist() if n.startswith(package + '/') and not n.endswith('/')]
        assert names
        for name in names:
            path = site / name
            assert path.is_file() and not path.is_symlink() and path.read_bytes() == wheel.read(name)
        expected = {n for n in names if n.endswith('.py')}
        actual = {p.relative_to(site).as_posix() for p in (site / package).rglob('*.py')}
        assert actual == expected
`, release, JSON.stringify(pins)], { env: cleanEnv, stdio: 'pipe', timeout: 30_000 })
try {
  await fetch(`${origin}/internal-poc.html`, { signal: AbortSignal.timeout(500) })
  throw new Error('CANDIDATE_PORT_OCCUPIED')
} catch (error) { if (error.message === 'CANDIDATE_PORT_OCCUPIED') throw error }

const runtime = await mkdtemp(join(tmpdir(), 'teth-replay-runtime-'))
const server = spawn(python, ['-I', '-c', 'from tesia_backend.operator.local_service import main; raise SystemExit(main())',
  '--database', join(runtime, 'poc.sqlite3'), '--web-dist', web, '--port', '8790', '--compiler', 'tesia-ai', '--session-mode', 'service'],
{ env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'] })
let serverClosed = false
let stderrBytes = 0
server.stdout.on('data', () => {}) // Never echo runtime payloads.
server.stderr.on('data', value => { stderrBytes += value.length })
const serverExit = new Promise(resolveExit => {
  server.once('error', () => { serverClosed = true; resolveExit('SPAWN_FAILED') })
  server.once('close', code => { serverClosed = true; resolveExit(code) })
})
let tests
let interrupted = false
const interrupt = () => { interrupted = true; tests?.kill('SIGINT') }
process.on('SIGINT', interrupt)
process.on('SIGTERM', interrupt)
let testExit = 1
try {
  let ready = false
  for (let attempt = 0; attempt < 60 && !interrupted && !serverClosed; attempt++) {
    try { ready = (await fetch(`${origin}/internal-poc.html`, { signal: AbortSignal.timeout(1000) })).status === 200 } catch { /* startup only */ }
    if (ready) break
    await delay(500)
  }
  if (!ready || interrupted || serverClosed) throw new Error('CANDIDATE_STARTUP_NOT_CONFIRMED')
  console.log(JSON.stringify({ event: 'CANDIDATE_READY', backend: '#104', sqlite: true, runtime, publicDeployment: false }))
  tests = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'tests/internal-poc/client-service.spec.ts', '--workers=1', ...process.argv.slice(2)], {
    env: { ...process.env, TETH_CLIENT_SERVICE_URL: `${origin}/internal-poc.html#/client`, TETH_SERVICE_REPLAY: 'committed', TETH_CLIENT_SERVICE_ASSETS: '' }, stdio: 'inherit',
  })
  testExit = await new Promise(resolveExit => { tests.once('error', () => resolveExit(1)); tests.once('close', code => resolveExit(code ?? 1)) })
} finally {
  if (!serverClosed) server.kill('SIGTERM')
  const shutdown = await Promise.race([serverExit, delay(60_000, 'DRAIN_UNCONFIRMED', { ref: false })])
  console.log(JSON.stringify({ event: 'CANDIDATE_STOPPED', shutdown, stderrBytes, testExit, runtimePreserved: true }))
  process.exitCode = testExit || (shutdown === 0 && stderrBytes === 0 ? 0 : 1)
  process.off('SIGINT', interrupt)
  process.off('SIGTERM', interrupt)
}
