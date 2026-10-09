import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { aboutText } from '../../src/client-about-copy'
import type { ClientLanguage } from '../../src/client-preferences'

const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const sourceCopy = [
  ['.ab-hero > .ab-d', '말로 전략을 만들고, 실제 시장 데이터로 검증하고, 지금 쓰는 거래소 계정에서 실행합니다.'],
  ['.ab-steps .ab-card:nth-child(3) .ab-d', '거래소를 고르고 한 번 승인하면, 전략이 그 계정에서 직접 주문합니다.'],
  ['.ab-steps .ab-card:nth-child(4) .ab-d', '전략이 24시간 시장을 보고, 사고판 이유를 문장으로 남깁니다.'],
  ['.ab-steps .ab-card:nth-child(4) .pl-items > li:first-child > span', '24시간 자동 실행'],
  ['#faq details:first-child p', '말로 투자 전략을 만들고, 실제 시장 데이터로 검증하고, 연결한 거래소에서 실행하는 AI 트레이딩 서비스입니다.'],
  ['.ab-final .pl-d', '아이디어 하나로 시작합니다. 전략을 만들고 검증한 뒤, 지금 쓰는 거래소에서 실행합니다.'],
] as const

const delay = (milliseconds: number) => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds))

class ServiceVite {
  private exited = false
  private readonly exit: Promise<number | null>
  private readonly output: string[] = []

  private constructor(private readonly child: ChildProcessWithoutNullStreams) {
    this.exit = new Promise(resolveExit => {
      child.once('error', error => { this.exited = true; this.output.push(error.message); resolveExit(-1) })
      child.once('close', code => { this.exited = true; resolveExit(code) })
    })
    child.stdout.on('data', chunk => this.output.push(String(chunk)))
    child.stderr.on('data', chunk => this.output.push(String(chunk)))
  }

  static async start(origin: string) {
    const vite = await realpath(resolve('node_modules/vite/bin/vite.js'))
    const child = spawn(process.execPath, [vite, '--config', 'vite.service.config.ts', '--host', '127.0.0.1', '--port', new URL(origin).port, '--strictPort'], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C.UTF-8', NODE_ENV: 'test', VITE_E2E_FAST: 'true',
        VITE_TETH_EXCHANGE_CONNECT: 'false', VITE_TETH_CONSULTATION: 'false',
        TETH_LOCAL_BACKEND_URL: '', TETH_OWNER_LOCAL_SERVICE_URL: '', TETH_STRUCTURAL_SMOKE_PROFILE_HASH: '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const processHandle = new ServiceVite(child)
    for (let attempt = 0; attempt < 80 && !processHandle.exited; attempt++) {
      try {
        if ((await fetch(`${origin}/internal-poc.html`, { signal: AbortSignal.timeout(500) })).status === 200) return processHandle
      } catch { /* bounded startup polling */ }
      await delay(100)
    }
    const output = processHandle.output.join('').slice(-4_000)
    await processHandle.stop()
    throw new Error(`SERVICE_VITE_START_FAILED\n${output}`)
  }

  async stop() {
    if (this.exited) return
    this.child.kill('SIGTERM')
    if (await Promise.race([this.exit.then(() => true), delay(5_000).then(() => false)])) return
    this.child.kill('SIGKILL')
    await Promise.race([this.exit, delay(2_000)])
  }
}

async function reserveOrigin() {
  const server = createServer()
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('SERVICE_PORT_RESERVATION_FAILED')
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
  return `http://127.0.0.1:${address.port}`
}

type Traffic = { api: string[]; external: string[] }
async function openServiceAbout(page: Page, origin: string): Promise<Traffic> {
  const traffic: Traffic = { api: [], external: [] }
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { traffic.external.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      traffic.api.push(`${request.method()} ${url.pathname}`)
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    }
    return route.fallback()
  })
  await page.context().route(`${origin}/about/`, async route => {
    const response = await route.fetch({ url: `${origin}/internal-poc.html` })
    expect(response.status()).toBe(200)
    await route.fulfill({ response })
  })
  await page.addInitScript(() => {
    if (localStorage.getItem('tethLang') === null) localStorage.setItem('tethLang', 'ko')
  })
  await page.goto(`${origin}/about/`)
  await expect(page.locator('.client-info-about')).toBeVisible()
  return traffic
}

let origin = '', service: ServiceVite | undefined
test.describe.configure({ mode: 'serial' })
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(60_000)

test.beforeAll(async () => {
  origin = await reserveOrigin()
  service = await ServiceVite.start(origin)
})

test.afterAll(async () => { await service?.stop() })

test('service-only /about/은 7개 locale에서 원본 핵심 카피 6개를 그대로 렌더링한다', async ({ page }) => {
  const traffic = await openServiceAbout(page, origin)
  for (const language of languages) {
    await page.evaluate(value => localStorage.setItem('tethLang', value), language)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    for (const [selector, source] of sourceCopy) {
      await expect(page.locator(selector)).toHaveText(aboutText(language, source))
    }
  }
  expect(traffic.api).toEqual([])
  expect(traffic.external).toEqual([])
})

test('가입 CTA는 서비스 홈으로만 돌아가며 비활성 거래소·상담 권한을 만들지 않는다', async ({ page }) => {
  const traffic = await openServiceAbout(page, origin)
  const ctas = page.locator('.hd .cta, .ab-hero .ab-cta, #plans .pl-cta, .ab-final .pl-cta')
  await expect(ctas).toHaveCount(5)
  for (const cta of await ctas.all()) await expect(cta).toHaveAttribute('href', '/')
  await page.locator('.ab-hero .ab-cta').click()
  await expect(page).toHaveURL(`${origin}/`)
  await expect(page.locator('.client-info-about')).toHaveCount(0)
  expect(traffic.external).toEqual([])
  expect(traffic.api.filter(call => !call.startsWith('GET /api/v1/auth/'))).toEqual([])
  expect(traffic.api.some(call => /exchange-connections|consultation/.test(call))).toBe(false)
})

test('about 원문 선택과 service feature flags는 서로 독립된 source 경계다', async () => {
  const [pages, entry] = await Promise.all([
    readFile('src/components/ClientPublicPages.tsx', 'utf8'),
    readFile('src/internal-poc/service-main.tsx', 'utf8'),
  ])
  expect(pages).not.toContain('servicePageCopy')
  expect(pages).toContain('copy={text => aboutText(language, text)}')
  expect(entry).toContain("exchangeConnectionsEnabled={import.meta.env.VITE_TETH_EXCHANGE_CONNECT === 'true'}")
  expect(entry).toContain("consultationEnabled={import.meta.env.VITE_TETH_CONSULTATION === 'true'}")
})
