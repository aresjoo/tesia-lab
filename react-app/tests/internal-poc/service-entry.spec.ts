import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { expect, test, type Page } from '@playwright/test'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { getServiceSiteLocation, toServiceSiteHref } from '../../src/internal-poc/service-site-navigation'
import { CLIENT_DOWNLOAD_ASSETS, CLIENT_PUBLIC_ASSETS } from '../../src/client-public-assets'
import { recoverNativeAfterJournalFailure } from './native-session-recovery-test-helpers'

const exec = promisify(execFile)
const ready = conversationFixture.snapshots.ready
const recordedTurn = conversationFixture.documents.find(item => item.name === 'turn')!.value
const owner = 'session_service_entry_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_service_entry_fixture_0001', traceId: 'trace_service_entry_fixture_0001', resourceRevision: revision })
let output: string, files: string[], html: string
const assets = new Map<string, Buffer>()
test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)
test.use({ actionTimeout: 10_000 })

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? listFiles(root, join(current, entry.name)) : [relative(root, join(current, entry.name))]))).flat().sort()
}

test.beforeAll(async ({ browserName }, info) => {
  const temporary = await mkdtemp(join(tmpdir(), 'teth-service-entry-'))
  output = join(temporary, 'dist-service')
  const result = await exec('npm', ['run', 'build:service', '--', '--outDir', output], {
    cwd: process.cwd(), timeout: 150_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, TETH_OWNER_LOCAL_SERVICE_URL: '', TETH_LOCAL_BACKEND_URL: '', TETH_STRUCTURAL_SMOKE_PROFILE_HASH: '' },
  })
  files = await listFiles(output)
  html = await readFile(join(output, 'internal-poc.html'), 'utf8')
  for (const file of files) assets.set(`/${file}`, await readFile(join(output, file)))
  // Retain the isolated output and build evidence for the parent reviewer.
  await info.attach('service-build-output', { body: `${browserName}\n${output}\n${result.stdout}\n${result.stderr}`, contentType: 'text/plain' })
})

test('service 빌드는 fixture·legacy 선택 entry 없이 독립 HTML과 완결된 로컬 asset closure를 만든다', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  expect(pkg.scripts['build:service']).toBe('tsc -b && vite build --config vite.service.config.ts')
  expect(pkg.scripts.build).toBe('tsc -b && vite build')
  expect(pkg.scripts['build:internal-poc']).toBe('tsc -b && vite build --config vite.internal-poc.config.ts')
  expect(files).toContain('internal-poc.html')
  expect(files).not.toContain('index.html')
  expect(files).not.toContain('internal-poc-fixture.html')
  expect(files.filter(file => /fixture.*\.(?:js|html)$/i.test(file))).toEqual([])
  expect(html).toContain('id="internal-poc-root"')
  expect(html).not.toContain('/src/')
  expect(html).not.toContain('fixture')
  const javascript = (await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(join(output, file), 'utf8')))).join('\n')
  for (const forbidden of ['LOCAL_STRATEGY_BACKTEST_VERTICAL', 'SERVICE_V03_MOCK_JOURNEY_MEMORY_ONLY', '입력과 무관한 고정 계약 fixture 시연', '#/v03-journey']) expect(javascript).not.toContain(forbidden)
  expect(javascript).toContain('/api/v1/auth/session')
  expect(javascript).toContain('client-service-app')
  // Native Paper/Structural Smoke panels remain permitted. Their existence
  // must not be confused with the removed legacy fixture bootstrap.
  const declarations = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1])
  const publicPageSource = await readFile('src/components/ClientAboutPage.tsx', 'utf8')
  const imageReferences = [...publicPageSource.matchAll(/src=["'](\/client-(?:shots|broker-assets)\/[^"']+)["']/g)].map(match => match[1])
  // The public closure also serves the restored trading introduction and shared
  // footer. Derive their references from consumers, not the manifest under test.
  const introSource = await readFile('src/components/ClientTradingIntro.tsx', 'utf8')
  const introBase = introSource.match(/const assets=['"]([^'"]+)['"]/)?.[1]
  expect(introBase).toBe('/client-trading-intro')
  const modelSource = introSource.match(/const models=\[([\s\S]*?)\] as const/)?.[1] ?? ''
  const modelKeys = [...modelSource.matchAll(/\['([a-z]+)','[^']+','/g)].map(match => match[1])
  expect(new Set(modelKeys).size).toBe(9)
  const introReferences = [...introSource.matchAll(/\$\{assets\}\/([^$`]+)`/g)].map(match => `${introBase}/${match[1]}`)
  // The tiles fallback is consumed both by the canvas and its poster image.
  // The asset closure is a set; repeated real consumers must remain valid.
  expect([...new Set(introReferences)].sort()).toEqual(['/client-trading-intro/buffett.jpg', '/client-trading-intro/halo.mp4', '/client-trading-intro/hero-tiles-end.jpg'])
  const footerSource = await readFile('src/components/ClientSiteFooter.tsx', 'utf8')
  const footerReferences = [...footerSource.matchAll(/src=["'](\/assets\/logos\/[^"']+)["']/g)].map(match => match[1])
  expect(footerReferences).toEqual(['/assets/logos/bitget-512.png'])
  expect([...new Set([...imageReferences, ...CLIENT_DOWNLOAD_ASSETS, ...introReferences, ...modelKeys.map(key => `${introBase}/ai/${key}.png`), ...footerReferences])].sort()).toEqual([...CLIENT_PUBLIC_ASSETS].sort())
  for (const asset of CLIENT_PUBLIC_ASSETS) expect(declarations).toContain(asset)
  for (const href of declarations) expect(assets.has(href), href).toBe(true)
  for (const file of files.filter(file => file.endsWith('.js'))) expect(declarations).toContain(`/${file}`)
  const css = files.filter(file => file.endsWith('.css'))
  expect(css.length).toBeGreaterThan(0)
  for (const file of css) {
    expect(declarations).toContain(`/${file}`)
    const body = await readFile(join(output, file), 'utf8')
    for (const match of body.matchAll(/url\(\s*['"]?([^\s)'";]+)['"]?\s*\)/g)) {
      if (match[1].startsWith('data:') || match[1].startsWith('#')) continue
      const path = new URL(match[1], `http://fixture.invalid/${file}`).pathname
      expect(assets.has(path), path).toBe(true)
    }
  }
})

test('서비스 HTML 목표나 chunk가 누락·중복되면 빌드는 조용히 통과하지 않는다', async () => {
  const { loadConfigFromFile } = await import('vite')
  // Match the isolated build above. Operator configuration is validated by
  // separate boundary tests, not by this HTML-hook test. Always restore it.
  const keys = ['TETH_OWNER_LOCAL_SERVICE_URL', 'TETH_LOCAL_BACKEND_URL', 'TETH_STRUCTURAL_SMOKE_PROFILE_HASH'] as const
  const previous = keys.map(key => process.env[key])
  const loaded = await (async () => {
    try {
      for (const key of keys) process.env[key] = ''
      return await loadConfigFromFile({ command: 'build', mode: 'production' }, 'vite.service.config.ts')
    } finally {
      keys.forEach((key, index) => {
        if (previous[index] === undefined) delete process.env[key]
        else process.env[key] = previous[index]
      })
    }
  })()
  expect(keys.map(key => process.env[key])).toEqual(previous)
  type Hook = { name: string; transformIndexHtml: { handler: (html: string, context: { filename: string; path: string; bundle?: object }) => unknown } }
  const plugins = loaded!.config.plugins!.flat() as Hook[]
  const pre = plugins.find(plugin => plugin.name === 'native-service-entry')!.transformIndexHtml.handler
  const post = plugins.find(plugin => plugin.name === 'owner-local-client-asset-closure')!.transformIndexHtml.handler
  const source = await readFile('internal-poc.html', 'utf8')
  const context = { filename: '/internal-poc.html', path: '/internal-poc.html' }
  const script = '<script type="module" src="/src/internal-poc/main.tsx"></script>'
  const title = '<title>TETH AI · 내부 전략 POC</title>'
  for (const value of [source.replace(script, ''), source.replace(script, script + script)]) expect(() => pre(value, context)).toThrow('SERVICE_ENTRY_TARGET_MISSING_OR_DUPLICATED')
  for (const value of [source.replace(title, ''), source.replace(title, title + title)]) expect(() => pre(value, context)).toThrow('SERVICE_TITLE_TARGET_MISSING_OR_DUPLICATED')
  for (const value of [source.replace('</head>', ''), source.replace('</head>', '</head></head>')]) expect(() => pre(value, context)).toThrow('SERVICE_HEAD_TARGET_MISSING_OR_DUPLICATED')
  expect(() => post(source, { ...context, bundle: {} })).toThrow('INTERNAL_CLIENT_ENTRY_MISSING')
})

async function serveBuilt(page: Page) {
  const traffic = { paths: [] as string[], unexpected: [] as string[], scripts: [] as string[] }
  const allowed = new Set(['/internal-poc.html', ...[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1])])
  for (const [path, body] of assets) {
    if (!path.endsWith('.css') || !allowed.has(path)) continue
    for (const match of body.toString().matchAll(/url\(\s*['"]?([^\s)'";]+)['"]?\s*\)/g)) {
      if (!match[1].startsWith('data:') && !match[1].startsWith('#')) allowed.add(new URL(match[1], `http://fixture.invalid${path}`).pathname)
    }
  }
  const mime: Record<string, string> = { js: 'text/javascript', css: 'text/css', html: 'text/html', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', webp: 'image/webp' }
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.startsWith('/api/')) { traffic.unexpected.push(`${request.method()} ${path}`); return route.abort('blockedbyclient') }
    // Match the approved backend aliases, using byte-identical built HTML.
    const key = ['/', '/auth/complete', '/about/', '/download/', '/policies/'].includes(path) ? '/internal-poc.html' : path
    const body = assets.get(key)
    if (!body || !allowed.has(key) || url.hostname !== '127.0.0.1') { traffic.unexpected.push(path); return route.abort('blockedbyclient') }
    traffic.paths.push(path)
    if (request.resourceType() === 'script') traffic.scripts.push(path)
    return route.fulfill({ status: 200, contentType: mime[key.split('.').at(-1)!] ?? 'application/octet-stream', body })
  })
  return traffic
}

async function recordedWire(page: Page) {
  const controls = { owner, sessionState: 'AUTHENTICATED', failSession: false, sessionReads: 0, draftReads: 0,
    posts: [] as { path: string; body: Record<string, unknown>; key?: string; match?: string }[] }
  await page.route('**/api/v1/auth/session', route => {
    controls.sessionReads++
    if (controls.failSession) return route.abort('failed')
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"service_entry_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
      data: { sessionId: controls.owner, state: controls.sessionState, revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
  })
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_service_entry_fixture_only', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const create = request.method() === 'POST' && path === '/api/v3/conversations', turn = request.method() === 'POST' && path.endsWith('/messages')
    if (!create && !turn && request.method() !== 'GET') return route.abort('blockedbyclient')
    if (request.method() === 'GET') controls.draftReads++
    else controls.posts.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'], match: request.headers()['if-match'] })
    return route.fulfill({ status: create ? 201 : 200, contentType: 'application/json', headers: { ETag: `"service_entry_conversation_etag_000${turn ? 5 : 4}"` },
      body: JSON.stringify({ meta: meta('0.3.0', turn ? '5' : ready.conversationStateRevision), data: turn ? recordedTurn : ready }) })
  })
  return controls
}

const phase = (page: Page, value: string) => expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', value)

async function openInfo(page: Page) {
  const about = page.getByRole('link', { name: 'TETH 정보', exact: true }).filter({ visible: true })
  if (await about.count() === 0) { if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page); await page.locator((page.viewportSize()?.width ?? 0) > 860 ? '.client-rail-logo-row button' : '.client-hamburger').click() }
  if (await about.count() > 0) await about.first().click()
  else {
    // Authenticated desktop conversation hides the mobile-only drawer links.
    // Its original profile → support → FAQ path still opens the same document
    // without navigating through or replacing the running conversation.
    await page.locator('[data-sidebar-action="account"],[data-sidebar-action="profile-settings"]').click()
    await page.locator('.ca-settings').getByRole('button', { name: '고객지원', exact: true }).click()
    await page.locator('.client-modal-help a[href="/about/#faq"]').click()
  }
  await expect(page.locator('.client-info-about')).toBeVisible()
}

test('서비스는 원본 문서 URL을 유지하고 기존 정보 fragment·서버 alias 북마크도 해석한다', () => {
  for (const name of ['about', 'download', 'policies']) {
    expect(toServiceSiteHref(`/${name}/`)).toBe(`/${name}/`)
    expect(toServiceSiteHref(`/${name}/#faq`)).toBe(`/${name}/#faq`)
    expect(getServiceSiteLocation(`/${name}/#faq`)).toBe(`/${name}/#faq`)
    for (const base of ['/', '/internal-poc.html', '/auth/complete']) expect(getServiceSiteLocation(`${base}#/site/${name}/faq`)).toBe(`/${name}/#faq`)
  }
  for (const value of ['/#/site/unknown', '/unknown#/site/about', '/#/site/about/../policies', '/#/site/policies/%3Cscript%3E', '/#/fixture', '/auth/complete?campaign=fixture#/site/about']) expect(getServiceSiteLocation(value)).toBeNull()
  for (const value of ['https://example.invalid/about/', '//example.invalid/about/', '/about/?token=not-a-real-token', '/about/#invalid/anchor', '/']) expect(toServiceSiteHref(value)).toBe(value)
})

test('정보 화면 왕복은 서비스 홈 입력과 SDK 세션을 보존한다', async ({ page }, info) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.goto('/')
  await phase(page, 'ready')
  await page.locator('#strategy-idea').fill('정보를 확인하고 이어서 질문')
  const reads = controls.sessionReads
  await openInfo(page)
  await expect(page).toHaveURL(/\/about\/$/)
  await expect(page.locator('.client-service-app')).toBeHidden()
  await expect(page.locator('#site-main')).toBeFocused()
  await page.screenshot({ path: info.outputPath('service-about.png') })
  await page.locator('.client-info-about a[href="/download/"]').filter({ visible: true }).first().click()
  await expect(page.locator('.client-info-download')).toBeVisible()
  await page.getByRole('link', { name: '웹에서 바로 시작하기', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toHaveValue('정보를 확인하고 이어서 질문')
  expect(controls.sessionReads).toBe(reads)
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
  await page.goBack()
  await expect(page.locator('.client-info-download')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.client-info-about')).toBeVisible()
})

test('정보 페이지 직접 진입·정책 앵커·reload는 서버 경로와 세션을 새로 만들지 않는다', async ({ page }, info) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.goto('/#/site/policies/privacy')
  await expect(page.locator('.client-info-policies')).toBeVisible()
  await expect(page.locator('.client-service-app')).toHaveCount(0)
  expect(controls.sessionReads).toBe(0)
  await page.reload()
  await expect(page.locator('.client-info-policies')).toBeVisible()
  expect(controls.sessionReads).toBe(0)
  await expect(page.locator('#v-privacy .sum-row')).toHaveCount(4)
  await expect(page.locator('.pg-h1')).toHaveText('개인정보 보호와 약관')
  const terms = page.locator('.tabs a[data-v="terms"]')
  await expect(terms).toHaveAttribute('href', '/policies/#terms')
  await terms.click()
  await expect(page.locator('#v-terms .sum-row')).toHaveCount(3)
  await expect(page.locator('.view.on')).toHaveAttribute('id', 'v-terms')
  await page.locator('.tabs a[data-v="faq"]').click()
  await expect(page.locator('#v-faq')).toBeVisible()
  await page.goBack()
  await expect(terms).toHaveAttribute('aria-current', 'page')
  await page.goto('/#/site/policies/t-risk')
  await expect(page).toHaveURL(/#\/site\/policies\/t-risk$/)
  await expect(page.locator('#t-risk')).toBeVisible()
  await page.locator('.client-info-policies a[href="/"]').first().click()
  await phase(page, 'ready')
  await expect(page.locator('#strategy-idea')).toBeInViewport({ ratio: 1 })
  await expect(page.locator('.client-home-gallery .g-tpl').first()).toHaveCSS('opacity', '1')
  await expect(page.locator('.client-hero-subtitle')).toHaveCSS('opacity', '1')
  await page.screenshot({ path: info.outputPath('service-home-return.png') })
  const footer = page.locator('.client-site-footer')
  await footer.locator('.gft-wm').scrollIntoViewIfNeeded()
  expect(await footer.evaluate(el => document.querySelector('.client-home-band')!.getBoundingClientRect().bottom <= el.getBoundingClientRect().top + 1)).toBe(true)
  await page.locator('.client-service-app').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(page.locator('#strategy-idea')).toBeInViewport({ ratio: 1 })
  expect(controls.sessionReads).toBeGreaterThan(0)
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('새 소개의 요금 앵커·12개 자산·FAQ는 서비스 정적 허용목록에서 완결된다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.goto('/#/site/about')
  const pricing = page.locator('.ab-acts .ab-link')
  await expect(pricing).toHaveAttribute('href', '/about/#pricing')
  await pricing.click()
  await expect(page).toHaveURL(/\/about\/#pricing$/)
  await expect(page.locator('#pricing')).toBeInViewport()
  for (const img of await page.locator('.ab img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true)
  }
  await page.locator('#faq summary').last().click()
  await page.locator('#faq details[open] a').click()
  await expect(page).toHaveURL(/\/download\/$/)
  expect(controls.sessionReads).toBe(0)
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('서버 HTML alias의 정보 경로는 열리지만 쿼리 있는 인증 경로를 가리지 않는다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  for (const alias of ['/internal-poc.html', '/auth/complete']) {
    await page.goto(`${alias}#/site/about`)
    await expect(page.locator('.client-info-about')).toBeVisible()
    await expect(page.locator('.client-service-app')).toHaveCount(0)
    expect(controls.sessionReads).toBe(0)
  }
  await page.goto('/auth/complete?campaign=fixture#/site/about')
  await phase(page, 'ready')
  await expect(page.locator('.client-info-about')).toHaveCount(0)
  expect(controls.sessionReads).toBeGreaterThan(0)
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('정보 화면을 보는 동안 대화 응답은 계속 처리되고 복귀 때 같은 대화가 남는다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v3/conversations/*/messages', async route => { await gate; await route.fallback() })
  try {
    await page.goto('/')
    await phase(page, 'ready')
    await page.locator('#strategy-idea').fill('진행 중 소개 확인')
    await page.getByRole('button', { name: '대화 시작', exact: true }).click()
    await expect(page.locator('.g-umsg')).toContainText('진행 중 소개 확인')
    await openInfo(page)
    release()
    await expect.poll(() => controls.posts.length).toBe(2)
    await expect(page.locator('.client-service-app .g-composer textarea')).toBeEnabled()
    await expect(page.locator('.client-info-about')).toBeVisible()
    await page.locator('.client-info-about .hd .brand').click()
    await expect(page.locator('.g-umsg')).toContainText('진행 중 소개 확인')
    await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
    await page.locator('.g-composer textarea').fill('지우지 않을 수정 문장')
    await openInfo(page)
    await page.goBack()
    await expect(page.locator('.g-composer textarea')).toHaveValue('지우지 않을 수정 문장')
    expect(controls.posts).toHaveLength(2)
    expect(traffic.unexpected).toEqual([])
  } finally { release() }
})

test('설정 포털의 다운로드 진입은 메뉴·스크롤 잠금을 해제하고 입력을 보존한다', async ({ page }, info) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.goto('/')
  await phase(page, 'ready')
  await page.locator('#strategy-idea').fill('다운로드 확인 후 이어갈 질문')
  const trigger = page.locator('[data-sidebar-action="settings"], [data-sidebar-action="profile-settings"]')
  if (!await trigger.isVisible()) { if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page); await page.locator((page.viewportSize()?.width ?? 0) > 860 ? '.client-rail-logo-row button' : '.client-hamburger').click() }
  await trigger.click()
  await expect(page.locator('.ca-settings')).toBeVisible()
  await page.locator('.ca-settings').getByRole('button', { name: '다운로드', exact: true }).click()
  await expect(page.locator('.client-info-download')).toBeVisible()
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  expect(await page.locator('#site-main').evaluate(node => Boolean(node.closest('[inert]')))).toBe(false)
  await page.screenshot({ path: info.outputPath('service-download.png') })
  await page.goBack()
  await expect(page.locator('#strategy-idea')).toHaveValue('다운로드 확인 후 이어갈 질문')
  await page.locator('#strategy-idea').fill('복귀 후에도 입력 가능')
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('built 원본 도움말은 실제 서비스 정보 링크로 이동하고 홈 질문·세션·원본 SVG를 보존한다', async ({ page }, info) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.goto('/')
  await phase(page, 'ready')
  const input = page.locator('#strategy-idea'), trigger = page.locator('.client-service-app > .site-help .site-help-trigger')
  await input.fill('도움말을 읽고 이어갈 질문')
  const inputNode = await input.elementHandle(), reads = controls.sessionReads
  await expect(trigger.locator('svg')).toHaveAttribute('viewBox', '0 0 32 32')
  await trigger.focus(); await page.keyboard.press('Enter')
  const popup = page.locator('.client-service-app > .site-help .site-help-pop')
  await expect(popup.locator('.help-close')).toBeFocused()
  await expect(popup.locator('a').first()).toHaveAttribute('href', '/about/#faq')
  await expect(popup.locator('a').last()).toHaveAttribute('href', '/policies/#overview')
  await popup.locator('a').first().click()
  await expect(page).toHaveURL(/\/about\/#faq$/)
  await expect(page.locator('.client-info-about')).toBeVisible()
  await expect(page.locator('.client-service-app')).toBeHidden()
  await expect(page.locator('#site-main')).toBeFocused()
  await page.screenshot({ path: info.outputPath('native-help-faq.png') })
  await page.goBack()
  await expect(input).toHaveValue('도움말을 읽고 이어갈 질문')
  expect(await input.evaluate((node, original) => node === original, inputNode)).toBe(true)
  expect(controls.sessionReads).toBe(reads); expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('built 고객지원→정책을 읽는 동안 요청은 계속 완료되고 같은 대화로 돌아온다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v3/conversations/*/messages', async route => { await gate; await route.fallback() })
  try {
    await page.goto('/')
    await phase(page, 'ready')
    await page.locator('#strategy-idea').fill('도움말을 읽는 동안에도 응답은 이어져야 합니다')
    await page.getByRole('button', { name: '대화 시작', exact: true }).click()
    await expect(page.locator('.g-umsg')).toContainText('도움말을 읽는 동안에도 응답은 이어져야 합니다')
    const settings = page.locator('[data-sidebar-action="settings"], [data-sidebar-action="profile-settings"]')
    if (!await settings.isVisible()) { if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page); await page.locator((page.viewportSize()?.width ?? 0) > 860 ? '.client-rail-logo-row button' : '.client-hamburger').click() }
    await settings.click()
    await page.locator('.ca-settings').getByRole('button', { name: '고객지원', exact: true }).click()
    const popup = page.locator('.client-modal-help .site-help-pop')
    await expect(popup.locator('.help-close')).toBeFocused()
    await expect(popup.locator('a').last()).toHaveAttribute('href', '/policies/#overview')
    await popup.locator('a').last().click()
    await expect(page).toHaveURL(/\/policies\/#overview$/)
    await expect(page.locator('#site-main')).toBeVisible()
    await expect(page.locator('.client-modal-help, .ca-settings')).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    release()
    await expect.poll(() => controls.posts.length).toBe(2)
    await expect(page.locator('.client-service-app .g-composer textarea')).toBeEnabled()
    await page.goBack()
    await expect(page.locator('.g-umsg')).toContainText('도움말을 읽는 동안에도 응답은 이어져야 합니다')
    await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
    await page.locator('.g-composer textarea').fill('응답 확인 후 수정할 조건')
    expect(controls.posts).toHaveLength(2); expect(traffic.unexpected).toEqual([])
  } finally { release() }
})

test('정보 chunk 로딩 실패 뒤에도 같은 대화 입력으로 안전하게 돌아온다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  const chunk = files.find(file => /^assets\/ClientPublicPages-.*\.js$/.test(file))
  expect(chunk).toBeTruthy()
  await page.route(`**/${chunk}`, route => route.abort('failed'))
  await page.goto('/')
  await phase(page, 'ready')
  await page.locator('#strategy-idea').fill('실패해도 잃지 않을 입력')
  const about = page.getByRole('link', { name: 'TETH 정보', exact: true }).filter({ visible: true })
  if (await about.count() === 0) { if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page); await page.locator((page.viewportSize()?.width ?? 0) > 860 ? '.client-rail-logo-row button' : '.client-hamburger').click() }
  await about.first().click()
  await expect(page.getByRole('heading', { name: '페이지를 불러오지 못했습니다', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toHaveValue('실패해도 잃지 않을 입력')
  await page.locator('#strategy-idea').fill('실패 후 재입력')
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('built 도움말 chunk 실패도 대화를 제거하지 않고 닫기·초점·스크롤을 복구한다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  const chunk = files.find(file => file.endsWith('.js') && assets.get(`/${file}`)?.toString().includes('help-status-dot'))
  expect(chunk).toBeTruthy()
  await page.route(`**/${chunk}`, route => route.abort('failed'))
  await page.goto('/')
  await phase(page, 'ready')
  const input = page.locator('#strategy-idea')
  await input.fill('선택 기능이 실패해도 보존할 질문')
  const inputNode = await input.elementHandle()
  const settings = page.locator('[data-sidebar-action="settings"], [data-sidebar-action="profile-settings"]')
  if (!await settings.isVisible()) { if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page); await page.locator((page.viewportSize()?.width ?? 0) > 860 ? '.client-rail-logo-row button' : '.client-hamburger').click() }
  await settings.click()
  await page.locator('.ca-settings').getByRole('button', { name: '고객지원', exact: true }).click()
  await expect(page.getByRole('heading', { name: '페이지를 불러오지 못했습니다', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.client-load-layer, .client-modal-help')).toHaveCount(0)
  await expect((page.viewportSize()?.width ?? 0) <= 860 ? page.locator('.client-hamburger') : settings).toBeFocused()
  await expect(input).toHaveValue('선택 기능이 실패해도 보존할 질문')
  expect(await input.evaluate((node, original) => node === original, inputNode)).toBe(true)
  expect(await page.locator('.client-service-app').evaluate(node => (node as HTMLElement).inert)).toBe(false)
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  expect(controls.posts).toEqual([]); expect(traffic.unexpected).toEqual([])
})

for (const navigation of ['back', 'hash'] as const) test(`확대 입력의 top-layer는 정보 화면 ${navigation} 이동에 남지 않는다`, async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.goto('/#/site/about')
  await page.locator('.client-info-about .hd .brand').click()
  await phase(page, 'ready')
  const draft = '잃어버리면 안 되는 첫 줄\n두 번째 줄\n마지막 전략 조건'
  await page.locator('#strategy-idea').fill(draft)
  await page.locator('.client-expand').click()
  await expect(page.locator('.client-composer-dialog')).toBeVisible()
  if (navigation === 'back') await page.goBack()
  else await page.evaluate(() => { window.location.hash = '/site/about' })
  await expect(page.locator('.client-info-about')).toBeVisible()
  await expect(page.locator('.client-composer-dialog')).toHaveCount(0)
  await expect(page.locator('#site-main')).toBeFocused()
  expect(await page.locator('.client-service-app').evaluate(node => Boolean(node.closest('[inert]')))).toBe(true)
  await page.locator('.client-info-about .hd .brand').click()
  await expect(page.locator('#strategy-idea')).toHaveValue(draft)
  await expect(page.locator('#strategy-idea')).toBeInViewport()
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('built no-hash root는 SDK 세션 GET 후 native 홈과 명시 CREATE/TURN만 사용한다', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.goto('/')
  await phase(page, 'ready')
  await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
  await page.screenshot({ path: info.outputPath('built-service-native-home.png') })
  expect(controls.sessionReads).toBeGreaterThan(0)
  expect(controls.posts).toEqual([])
  const question = '서비스 번들 기록된 계약 검증'
  await page.locator('#strategy-idea').fill(question)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect.poll(() => controls.posts.length).toBe(2)
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  expect(controls.posts.map(post => post.path)).toEqual(['/api/v3/conversations', `/api/v3/conversations/${ready.conversationId}/messages`])
  expect(controls.posts[1].body).toMatchObject({ message: question, expectedConversationStateRevision: '4' })
  expect(controls.posts.every(post => Boolean(post.key))).toBe(true)
  expect(controls.posts[1].match).toBe('"service_entry_conversation_etag_0004"')
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation-session'))).toBe(owner)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(ready.conversationId)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBeNull()
  expect(traffic.scripts.length).toBeGreaterThan(0)
  expect(traffic.scripts.every(path => path.startsWith('/assets/') && assets.has(path))).toBe(true)
  expect(traffic.unexpected).toEqual([])
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('built-service-native-conversation.png') })
})

test('built root와 auth callback 및 legacy 해시에서도 native 세션 경계만 활성화된다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  for (const path of ['/', '/#/client', '/#/v03-journey', '/#/fixture', '/internal-poc.html#/client', '/auth/complete']) {
    const before = controls.sessionReads
    const navigation = await page.goto(path)
    await phase(page, 'ready')
    await expect(page.locator('.client-service-app'), path).toHaveClass(/view-landing/)
    if (path === '/auth/complete') {
      const auth = page.getByRole('dialog', { name: '로그인', exact: true })
      await expect(auth).toBeVisible()
      await expect(auth.locator('.native-auth-recovery')).toHaveAttribute('open', '')
      await expect(auth.locator('.native-auth-recovery button')).toHaveCount(4)
      for (const button of await auth.locator('.native-auth-recovery button').all()) await expect(button).toBeEnabled()
    }
    // Same-document hash changes must not restart the session controller.
    if (navigation === null) expect(controls.sessionReads).toBe(before)
    else expect(controls.sessionReads).toBeGreaterThan(before)
    const warm = controls.sessionReads
    await page.reload()
    await phase(page, 'ready')
    await expect.poll(() => controls.sessionReads).toBeGreaterThan(warm)
    await expect(page.getByText('LOCAL_STRATEGY_BACKTEST_VERTICAL', { exact: true })).toHaveCount(0)
    if (path === '/auth/complete') {
      const auth = page.getByRole('dialog', { name: '로그인', exact: true })
      await expect(auth).toBeVisible()
      const beforeClose = controls.sessionReads
      await auth.locator('[data-native-auth-close]').click()
      await expect(auth).not.toBeVisible()
      await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
      expect(controls.sessionReads).toBe(beforeClose)
    }
    expect(controls.posts).toEqual([])
  }
  expect(traffic.unexpected).toEqual([])
})

test('built 서비스는 JS 실행 전에도 원본의 어두운 첫 페인트를 유지한다', async ({ page }, info) => {
  await serveBuilt(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/assets/*.js', async route => { await gate; await route.abort('blockedbyclient') })
  try {
    await page.goto('/', { waitUntil: 'commit' })
    await expect.poll(() => page.evaluate(() => {
      const sheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
      return sheets.length > 0 && sheets.every(link => link.sheet !== null)
    })).toBe(true)
    await expect(page.locator('.client-service-app')).toHaveCount(0)
    const paint = await page.evaluate(() => ({ background: getComputedStyle(document.body).backgroundColor, image: getComputedStyle(document.body).backgroundImage }))
    await info.attach('pre-script-paint', { body: JSON.stringify(paint), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('built-service-pre-script.png') })
    // Source 9fb index:7578,7661 explicitly changed the main surface to black.
    // This checks loaded CSS before React, not the browser's pre-CSS canvas.
    expect(paint).toEqual({ background: 'rgb(0, 0, 0)', image: 'none' })
  } finally { release() }
})

test('built 서버 오류는 Mock으로 fallback하지 않고 동일 native 세션 복구만 허용한다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  controls.failSession = true
  await page.goto('/')
  await phase(page, 'error')
  await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toBeVisible()
  expect(controls.posts).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBeNull()
  controls.failSession = false
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await phase(page, 'ready')
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})

test('built 전송 전 기록 실패 후 실제 복구는 다른 owner에게 이전 대화·미전송 문장을 복원하지 않는다', async ({ page }) => {
  const traffic = await serveBuilt(page), controls = await recordedWire(page)
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  await page.goto('/')
  await phase(page, 'ready')
  const input = page.locator('textarea').first()
  await input.fill('원 계정 미전송 문장')
  controls.owner = 'session_service_entry_other_owner_0002'
  const before = controls.draftReads
  await recoverNativeAfterJournalFailure(page)
  await phase(page, 'ready')
  await expect(input).toHaveValue('')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toHaveCount(0)
  expect(controls.draftReads).toBe(before)
  expect(controls.posts).toEqual([])
  expect(traffic.unexpected).toEqual([])
})
