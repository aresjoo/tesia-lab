import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { stat, realpath } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, isAbsolute, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

const optedIn = process.env.TETH_CONSULTATION_LIVE_LOOPBACK_E2E === '1'
test.skip(!optedIn, '실제 loopback harness를 명시한 별도 검증에서만 실행합니다.')

type Scenario = 'replay-reload-done' | 'explicit-cancel'
type GateName = 'create-response' | 'provider-partial' | 'events-after-partial' | 'cancel-intent'
type ReceiptSummary = Readonly<{
  createRequests: number
  cancelRequests: number
  eventRequests: number
  uniqueCreateKeyHashes: number
  uniqueCreateBodyHashes: number
  createIdempotencyRows: number
  cancelIntentRows: number
  providerDispatches: number
  providerPathValid: boolean
  providerConnectionClosed: boolean
  providerResponseClosed: boolean
  originChecksPassed: boolean
  csrfChecksPassed: boolean
}>
type HarnessMessage =
  | Readonly<{ v: 1; event: 'ready'; backendOrigin: string; scenario: Scenario }>
  | Readonly<{ v: 1; event: 'gate'; name: GateName }>
  | Readonly<{ v: 1; event: 'ack'; id: string; command: 'release' | 'shutdown' }>
  | Readonly<{ v: 1; event: 'receipt'; id: string; summary: ReceiptSummary }>
  | Readonly<{ v: 1; event: 'stopped'; clean: true }>

type HarnessInputs = Readonly<{ python: string; harness: string; backendRoot: string }>
type HarnessDiagnostic = Readonly<{
  kind: 'consultation-http'
  operation: 'create' | 'cancel' | 'events' | 'poll' | 'history' | 'capabilities' | 'other'
  status: number
  closedError: 'BAD_REQUEST' | 'AUTHENTICATION_REQUIRED' | 'FORBIDDEN' | 'CSRF_INVALID' | 'ORIGIN_INVALID' | 'NOT_FOUND'
    | 'IDEMPOTENCY_KEY_REUSED' | 'PROVIDER_UNAVAILABLE' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'INVALID' | null
  createRequests: number
  cancelRequests: number
  eventRequests: number
  providerDispatches: number
  gateElapsedMs: number
  providerGateTimedOut: boolean
  providerResponseClosed: boolean
  cancelIntentRows: number
}>
type Waiter = {
  accept: (message: HarnessMessage) => boolean
  resolve: (message: HarnessMessage) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const CONTROL = /^[A-Za-z0-9_-]{1,64}$/
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
const hasControlCharacter = (value: string) => [...value].some(character => character.charCodeAt(0) <= 0x1f || character.charCodeAt(0) === 0x7f)

function loopbackOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port !== ''
      && url.username === '' && url.password === '' && url.pathname === '/' && url.search === '' && url.hash === ''
      && url.origin === value
  } catch { return false }
}

function parseHarnessMessage(line: string): HarnessMessage {
  if (new TextEncoder().encode(line).length > 16_384) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
  let candidate: unknown
  try { candidate = JSON.parse(line) }
  catch { throw Error('LIVE_HARNESS_PROTOCOL_INVALID') }
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
  const value = candidate as Record<string, unknown>
  if (value.v !== 1 || typeof value.event !== 'string') throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
  if (value.event === 'ready') {
    if (!exactKeys(value, ['v', 'event', 'backendOrigin', 'scenario']) || !loopbackOrigin(value.backendOrigin)
      || !['replay-reload-done', 'explicit-cancel'].includes(String(value.scenario))) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
    return value as HarnessMessage
  }
  if (value.event === 'gate') {
    if (!exactKeys(value, ['v', 'event', 'name'])
      || !['create-response', 'provider-partial', 'events-after-partial', 'cancel-intent'].includes(String(value.name))) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
    return value as HarnessMessage
  }
  if (value.event === 'ack') {
    if (!exactKeys(value, ['v', 'event', 'id', 'command']) || typeof value.id !== 'string' || !CONTROL.test(value.id)
      || !['release', 'shutdown'].includes(String(value.command))) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
    return value as HarnessMessage
  }
  if (value.event === 'receipt') {
    if (!exactKeys(value, ['v', 'event', 'id', 'summary']) || typeof value.id !== 'string' || !CONTROL.test(value.id)
      || value.summary === null || typeof value.summary !== 'object' || Array.isArray(value.summary)) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
    const summary = value.summary as Record<string, unknown>
    const numbers = ['createRequests', 'cancelRequests', 'eventRequests', 'uniqueCreateKeyHashes', 'uniqueCreateBodyHashes',
      'createIdempotencyRows', 'cancelIntentRows', 'providerDispatches'] as const
    const booleans = ['providerPathValid', 'providerConnectionClosed', 'providerResponseClosed', 'originChecksPassed', 'csrfChecksPassed'] as const
    if (!exactKeys(summary, [...numbers, ...booleans])
      || numbers.some(key => !Number.isSafeInteger(summary[key]) || Number(summary[key]) < 0)
      || booleans.some(key => typeof summary[key] !== 'boolean')) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
    return value as HarnessMessage
  }
  if (value.event === 'stopped' && exactKeys(value, ['v', 'event', 'clean']) && value.clean === true) return value as HarnessMessage
  throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
}

function parseHarnessDiagnostic(line: string): HarnessDiagnostic {
  let candidate: unknown
  try { candidate = JSON.parse(line) }
  catch { throw Error('LIVE_HARNESS_STDERR_INVALID') }
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) throw Error('LIVE_HARNESS_STDERR_INVALID')
  const value = candidate as Record<string, unknown>
  const counters = ['createRequests', 'cancelRequests', 'eventRequests', 'providerDispatches', 'cancelIntentRows'] as const
  if (!exactKeys(value, ['kind', 'operation', 'status', 'closedError', 'gateElapsedMs', 'providerGateTimedOut', 'providerResponseClosed', ...counters])
    || value.kind !== 'consultation-http'
    || !['create', 'cancel', 'events', 'poll', 'history', 'capabilities', 'other'].includes(String(value.operation))
    || !Number.isInteger(value.status) || Number(value.status) < 100 || Number(value.status) > 599
    || !(value.closedError === null || ['BAD_REQUEST', 'AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'CSRF_INVALID', 'ORIGIN_INVALID', 'NOT_FOUND',
      'IDEMPOTENCY_KEY_REUSED', 'PROVIDER_UNAVAILABLE', 'RATE_LIMITED', 'INTERNAL_ERROR', 'INVALID'].includes(String(value.closedError)))
    || !Number.isInteger(value.gateElapsedMs) || Number(value.gateElapsedMs) < 0 || Number(value.gateElapsedMs) > 120_000
    || typeof value.providerGateTimedOut !== 'boolean' || typeof value.providerResponseClosed !== 'boolean'
    || counters.some(key => !Number.isSafeInteger(value[key]) || Number(value[key]) < 0)) throw Error('LIVE_HARNESS_STDERR_INVALID')
  return value as HarnessDiagnostic
}

class HarnessProcess {
  readonly child: ChildProcessWithoutNullStreams
  private buffer = ''
  private messages: HarnessMessage[] = []
  private waiters = new Set<Waiter>()
  private commandOrdinal = 0
  private messageCount = 0
  private failure: Error | null = null
  private exited = false
  private stderrBytes = 0
  private stderrBuffer = ''
  private diagnosticCount = 0
  readonly exit: Promise<number | null>

  private constructor(inputs: HarnessInputs, scenario: Scenario, expectedOrigin: string) {
    this.child = spawn(inputs.python, ['-u', inputs.harness, '--scenario', scenario, '--expected-origin', expectedOrigin, '--port', '0'], {
      cwd: inputs.backendRoot,
      env: {
        PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C.UTF-8', PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1',
        PYTHONPATH: `${resolve(inputs.backendRoot, 'src')}:${resolve(inputs.backendRoot, 'tests')}`,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', (chunk: string) => this.read(chunk))
    this.child.stderr.on('data', (chunk: Buffer) => this.readStderr(chunk))
    this.child.once('error', () => this.fail(Error('LIVE_HARNESS_SPAWN_FAILED')))
    this.exit = new Promise(resolveExit => this.child.once('close', code => {
      this.exited = true
      if (this.stderrBuffer !== '') this.fail(Error('LIVE_HARNESS_STDERR_INVALID'))
      resolveExit(code)
      if (code !== 0) this.fail(Error('LIVE_HARNESS_EXIT_FAILED'))
    }))
  }

  static async start(inputs: HarnessInputs, scenario: Scenario, expectedOrigin: string) {
    const process = new HarnessProcess(inputs, scenario, expectedOrigin)
    try {
      const ready = await process.take(message => message.event === 'ready', 15_000)
      if (ready.event !== 'ready' || ready.scenario !== scenario) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
      return { process, backendOrigin: ready.backendOrigin }
    } catch (error) {
      await process.stop()
      throw error
    }
  }

  private fail(error: Error) {
    if (this.failure) return
    this.failure = error
    for (const waiter of this.waiters) { clearTimeout(waiter.timer); waiter.reject(error) }
    this.waiters.clear()
  }

  private read(chunk: string) {
    this.buffer += chunk
    if (new TextEncoder().encode(this.buffer).length > 16_384 && !this.buffer.includes('\n')) {
      this.fail(Error('LIVE_HARNESS_PROTOCOL_INVALID')); return
    }
    for (;;) {
      const index = this.buffer.indexOf('\n')
      if (index < 0) break
      const line = this.buffer.slice(0, index).replace(/\r$/, '')
      this.buffer = this.buffer.slice(index + 1)
      if (!line) continue
      try {
        if (++this.messageCount > 64) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
        this.push(parseHarnessMessage(line))
      } catch { this.fail(Error('LIVE_HARNESS_PROTOCOL_INVALID')); return }
    }
  }

  private readStderr(chunk: Buffer) {
    this.stderrBytes += chunk.byteLength
    if (this.stderrBytes > 65_536) { this.fail(Error('LIVE_HARNESS_STDERR_LIMIT')); return }
    if ([...chunk].some(byte => byte > 0x7f)) { this.fail(Error('LIVE_HARNESS_STDERR_INVALID')); return }
    this.stderrBuffer += chunk.toString('ascii')
    for (;;) {
      const index = this.stderrBuffer.indexOf('\n')
      if (index < 0) break
      const line = this.stderrBuffer.slice(0, index).replace(/\r$/, '')
      this.stderrBuffer = this.stderrBuffer.slice(index + 1)
      if (!line || ++this.diagnosticCount > 128) { this.fail(Error('LIVE_HARNESS_STDERR_INVALID')); return }
      try {
        const diagnostic = parseHarnessDiagnostic(line)
        process.stderr.write(`${JSON.stringify(diagnostic)}\n`)
      } catch { this.fail(Error('LIVE_HARNESS_STDERR_INVALID')); return }
    }
  }

  private push(message: HarnessMessage) {
    const waiter = [...this.waiters].find(candidate => candidate.accept(message))
    if (!waiter) { this.messages.push(message); return }
    this.waiters.delete(waiter); clearTimeout(waiter.timer); waiter.resolve(message)
  }

  private take(accept: (message: HarnessMessage) => boolean, timeoutMs: number): Promise<HarnessMessage> {
    if (this.failure) return Promise.reject(this.failure)
    const index = this.messages.findIndex(accept)
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0])
    if (this.exited) return Promise.reject(Error('LIVE_HARNESS_EXITED'))
    return new Promise((resolveMessage, reject) => {
      const waiter = {} as Waiter
      waiter.accept = accept
      waiter.resolve = resolveMessage
      waiter.reject = reject
      waiter.timer = setTimeout(() => { this.waiters.delete(waiter); reject(Error('LIVE_HARNESS_DEADLINE')) }, timeoutMs)
      this.waiters.add(waiter)
    })
  }

  async gate(name: GateName) {
    const message = await this.take(candidate => candidate.event === 'gate' && candidate.name === name, 20_000)
    if (message.event !== 'gate') throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
  }

  private write(command: Record<string, unknown>) {
    if (!this.child.stdin.writable || this.exited) throw Error('LIVE_HARNESS_EXITED')
    const raw = JSON.stringify(command)
    if (Buffer.byteLength(raw) > 4_096) throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
    this.child.stdin.write(`${raw}\n`)
  }

  async release(name: Exclude<GateName, 'cancel-intent'>) {
    const id = `c${++this.commandOrdinal}`
    this.write({ v: 1, id, command: 'release', name })
    const response = await this.take(message => message.event === 'ack' && message.id === id, 5_000)
    if (response.event !== 'ack' || response.command !== 'release') throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
  }

  async receipt(): Promise<ReceiptSummary> {
    const id = `c${++this.commandOrdinal}`
    this.write({ v: 1, id, command: 'receipt' })
    const response = await this.take(message => message.event === 'receipt' && message.id === id, 5_000)
    if (response.event !== 'receipt') throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
    return response.summary
  }

  async stop() {
    if (this.exited) return
    try {
      const id = `c${++this.commandOrdinal}`
      this.write({ v: 1, id, command: 'shutdown' })
      const ack = await this.take(message => message.event === 'ack' && message.id === id, 2_000)
      if (ack.event !== 'ack' || ack.command !== 'shutdown') throw Error('LIVE_HARNESS_PROTOCOL_INVALID')
      await this.take(message => message.event === 'stopped', 10_000)
      const code = await Promise.race([this.exit, delay(2_000).then(() => null)])
      if (code !== 0) throw Error('LIVE_HARNESS_EXIT_FAILED')
      return
    } catch { /* bounded process termination below */ }
    this.child.kill('SIGTERM')
    if (await Promise.race([this.exit.then(() => true), delay(2_000).then(() => false)])) return
    this.child.kill('SIGKILL')
    await Promise.race([this.exit, delay(2_000)])
  }
}

class ViteProcess {
  private exited = false
  private readonly exit: Promise<number | null>
  private constructor(private readonly child: ChildProcessWithoutNullStreams) {
    this.exit = new Promise(resolveExit => {
      child.once('error', () => { this.exited = true; resolveExit(-1) })
      child.once('close', code => { this.exited = true; resolveExit(code) })
    })
    child.stdout.on('data', () => undefined)
    child.stderr.on('data', () => undefined)
  }

  static async start(origin: string, backendOrigin: string) {
    const vite = await realpath(resolve('node_modules/vite/bin/vite.js'))
    const port = new URL(origin).port
    const child = spawn(process.execPath, [vite, '--config', 'vite.service.config.ts', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C.UTF-8', NODE_ENV: 'test', VITE_E2E_FAST: 'true',
        VITE_TETH_CONSULTATION: 'true', TETH_LOCAL_BACKEND_URL: backendOrigin, TETH_OWNER_LOCAL_SERVICE_URL: origin,
        TETH_STRUCTURAL_SMOKE_PROFILE_HASH: '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const processHandle = new ViteProcess(child)
    for (let attempt = 0; attempt < 80 && !processHandle.exited; attempt++) {
      try {
        if ((await fetch(`${origin}/internal-poc.html`, { signal: AbortSignal.timeout(500) })).status === 200) return processHandle
      } catch { /* bounded startup polling */ }
      await delay(100)
    }
    await processHandle.stop()
    throw Error('LIVE_VITE_START_FAILED')
  }

  async stop() {
    if (this.exited) return
    this.child.kill('SIGTERM')
    if (await Promise.race([this.exit.then(() => true), delay(5_000).then(() => false)])) return
    this.child.kill('SIGKILL')
    await Promise.race([this.exit, delay(2_000)])
  }
}

async function loadInputs(): Promise<HarnessInputs> {
  const pythonInput = process.env.TETH_CONSULTATION_E2E_PYTHON
  const harnessInput = process.env.TETH_CONSULTATION_E2E_HARNESS
  if (!pythonInput || !harnessInput || !isAbsolute(pythonInput) || !isAbsolute(harnessInput)
    || hasControlCharacter(pythonInput) || hasControlCharacter(harnessInput)) throw Error('LIVE_HARNESS_INPUT_REQUIRED')
  const python = resolve(pythonInput)
  const [pythonTarget, harness] = await Promise.all([realpath(python), realpath(harnessInput)])
  const [pythonStat, harnessStat] = await Promise.all([stat(pythonTarget), stat(harness)])
  if (!pythonStat.isFile() || !harnessStat.isFile()) throw Error('LIVE_HARNESS_INPUT_INVALID')
  const backendRoot = dirname(dirname(dirname(harness)))
  return { python, harness, backendRoot }
}

async function reserveOrigin() {
  const server = createServer()
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw Error('LIVE_PORT_RESERVATION_FAILED')
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
  return `http://127.0.0.1:${address.port}`
}

async function withRuntime<T>(inputs: HarnessInputs, scenario: Scenario, run: (origin: string, harness: HarnessProcess) => Promise<T>) {
  const origin = await reserveOrigin()
  let harness: HarnessProcess | undefined, vite: ViteProcess | undefined
  try {
    const started = await HarnessProcess.start(inputs, scenario, origin)
    harness = started.process
    vite = await ViteProcess.start(origin, started.backendOrigin)
    return await run(origin, harness)
  } finally {
    await vite?.stop()
    await harness?.stop()
  }
}

function traffic(page: Page, origin: string) {
  const counts = { create: 0, cancel: 0, events: 0, v3Posts: 0 }
  let authDiagnostics = 0
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin !== origin) return
    if (request.method() === 'POST' && url.pathname === '/api/v13/consultation/turns') counts.create++
    if (request.method() === 'POST' && url.pathname.endsWith('/cancel')) counts.cancel++
    if (request.method() === 'GET' && url.pathname.endsWith('/events')) counts.events++
    if (request.method() === 'POST' && url.pathname.startsWith('/api/v3/')) counts.v3Posts++
  })
  page.on('response', response => {
    const request = response.request(), url = new URL(response.url())
    if (request.method() !== 'GET' || url.origin !== origin || authDiagnostics >= 128) return
    const operation = url.pathname === '/api/v1/auth/session' ? 'session'
      : url.pathname === '/api/v1/auth/csrf' ? 'csrf' : null
    const status = response.status()
    if (operation === null || !Number.isInteger(status) || status < 100 || status > 599) return
    authDiagnostics++
    process.stderr.write(`${JSON.stringify({ kind: 'consultation-browser-auth', operation, status })}\n`)
  })
  return counts
}

async function assertFreshCookie(page: Page, origin: string) {
  await expect.poll(async () => {
    // Chromium accepts Secure cookies on its trustworthy loopback context, but
    // URL-filtered cookie inspection may omit them for an http: URL.
    const cookie = (await page.context().cookies()).find(candidate =>
      candidate.name === '__Host-tesia_session' && candidate.domain === new URL(origin).hostname)
    return { present: cookie !== undefined, secure: cookie?.secure, httpOnly: cookie?.httpOnly,
      hostOnly: cookie?.domain === '127.0.0.1', rootPath: cookie?.path === '/', lax: cookie?.sameSite === 'Lax' }
  }, { timeout: 10_000 }).toEqual({ present: true, secure: true, httpOnly: true, hostOnly: true, rootPath: true, lax: true })
  expect(await page.evaluate(() => document.cookie.includes('__Host-tesia_session'))).toBe(false)
}

async function loadReady(page: Page, origin: string) {
  const capabilityStatus = page.waitForResponse(response => {
    const url = new URL(response.url())
    return response.request().method() === 'GET' && url.origin === origin
      && url.pathname === '/api/v13/consultation/capabilities' && url.search === ''
  }, { timeout: 15_000 }).then(response => response.status())
  await page.goto(`${origin}/internal-poc.html`)
  expect(await capabilityStatus).toBe(200)
  const input = page.locator('#strategy-idea')
  await expect(input).toBeEnabled()
  await assertFreshCookie(page, origin)

  // The page response proves the product requested the real endpoint. Read a
  // second real GET inside the page so Chromium applies its trustworthy-loopback
  // Secure-cookie policy without exposing or injecting the cookie value.
  const capability = await page.evaluate(async pageOrigin => {
    const response = await fetch(`${pageOrigin}/api/v13/consultation/capabilities`, {
      method: 'GET', headers: { Accept: 'application/json' }, credentials: 'same-origin',
      cache: 'no-store', redirect: 'error',
    })
    const candidate: unknown = await response.json()
    const value = candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
      ? candidate as Record<string, unknown> : {}
    const data = value.data !== null && typeof value.data === 'object' && !Array.isArray(value.data)
      ? value.data as Record<string, unknown> : {}
    return { status: response.status, apiContractVersion: value.apiContractVersion, available: data.available }
  }, origin)
  expect(capability).toEqual({ status: 200, apiContractVersion: '0.13.0', available: true })
  return input
}

let inputs: HarnessInputs
test.beforeAll(async () => { if (optedIn) inputs = await loadInputs() })

test('live-loopback: response loss replay와 reader detach 뒤 partial→done을 실제 HTTP로 복구한다', async ({ page }) => {
  await withRuntime(inputs, 'replay-reload-done', async (origin, harness) => {
    const observed = traffic(page, origin)
    const input = await loadReady(page, origin)
    await input.fill('실제 백엔드 재개 질문')
    await input.press('Enter')
    await harness.gate('create-response')

    await page.reload({ waitUntil: 'domcontentloaded' })
    const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
    await expect(resume).toBeVisible()
    await harness.release('create-response')
    await resume.click()
    await harness.gate('provider-partial')
    await expect(page.locator('.g-amsg[data-response-state="streaming"]').last()).toContainText('실제 부분', { timeout: 25_000 })
    await harness.gate('events-after-partial')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('.g-amsg[data-response-state="streaming"]').last()).toContainText('실제 부분', { timeout: 25_000 })
    await harness.release('events-after-partial')
    await harness.release('provider-partial')
    await expect(page.locator('.g-amsg[data-response-state="done"]').last()).toContainText('실제 부분 완료', { timeout: 25_000 })

    const receipt = await harness.receipt()
    expect(receipt).toEqual({ createRequests: 2, cancelRequests: 0, eventRequests: expect.any(Number), uniqueCreateKeyHashes: 1,
      uniqueCreateBodyHashes: 1, createIdempotencyRows: 1, cancelIntentRows: 0, providerDispatches: 1, providerPathValid: true,
      providerConnectionClosed: true, providerResponseClosed: true, originChecksPassed: true, csrfChecksPassed: true })
    expect(receipt.eventRequests).toBeGreaterThanOrEqual(2)
    expect(observed).toMatchObject({ create: 2, cancel: 0, v3Posts: 0 })
  })
})

test('live-loopback: 명시 중지는 실제 cancel intent만 기록하고 부분 답변을 보존한다', async ({ page }) => {
  await withRuntime(inputs, 'explicit-cancel', async (origin, harness) => {
    const observed = traffic(page, origin)
    const input = await loadReady(page, origin)
    await input.fill('실제 백엔드 중지 질문')
    await input.press('Enter')
    await harness.gate('provider-partial')
    await expect(page.locator('.g-amsg[data-response-state="streaming"]').last()).toContainText('중지 전 부분', { timeout: 25_000 })
    await page.getByRole('button', { name: '응답 중지', exact: true }).click()
    await harness.gate('cancel-intent')
    await harness.release('provider-partial')
    await expect(page.locator('.g-amsg[data-response-state="interrupted"]').last()).toContainText('중지 전 부분', { timeout: 25_000 })

    const receipt = await harness.receipt()
    expect(receipt).toEqual({ createRequests: 1, cancelRequests: 1, eventRequests: expect.any(Number), uniqueCreateKeyHashes: 1,
      uniqueCreateBodyHashes: 1, createIdempotencyRows: 1, cancelIntentRows: 1, providerDispatches: 1, providerPathValid: true,
      providerConnectionClosed: true, providerResponseClosed: true, originChecksPassed: true, csrfChecksPassed: true })
    expect(receipt.eventRequests).toBeGreaterThanOrEqual(1)
    expect(observed).toMatchObject({ create: 1, cancel: 1, v3Posts: 0 })
  })
})
