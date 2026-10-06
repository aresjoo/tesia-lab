import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'

// 독립 원문: 고정9fb index.html:15510 breadcrumb / :21659 mk3Head CTA.
// 최종 sk-detail :24815–24884에서 이 두 literal은 재치환되지 않는다.
const original = { breadcrumb: '전략 복사', copy: '전략 복사하기' }
const foreign = [
  ['en', 'Strategy sharing', 'Follow'], ['ja', '戦略の共有', 'フォロー'],
  ['zh-CN', '策略分享', '跟随'], ['zh-TW', '策略分享', '跟隨'],
  ['es', 'Compartir estrategias', 'Seguir'], ['fr', 'Partage de stratégies', 'Suivre'],
] as const
const nick = sourceSharedStrategies()[0].nick
const initialExperience = { currentId: null, homeDraft: '복귀 뒤 유지할 원문 초안', sessions: [], sharedFollows: [], storageError: false, recoveryWarning: false }
const audits = new WeakMap<Page, { blocked: string[]; errors: string[] }>()
test.use({ serviceWorkers: 'block' })

async function guard(page: Page, baseURL: string | undefined) {
  if (!baseURL || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) throw Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin, audit = { blocked: [] as string[], errors: [] as string[] }
  audits.set(page, audit)
  page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || request.method() !== 'GET' || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      audit.blocked.push(url.origin !== origin ? 'EXTERNAL' : request.method() !== 'GET' ? 'MUTATION' : 'API')
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
  await page.context().routeWebSocket('**', socket => {
    const url = new URL(socket.url())
    const hmr = url.origin === origin.replace(/^http/, 'ws') && url.pathname === '/' && url.searchParams.has('token')
      && [...url.searchParams.keys()].every(key => key === 'token')
    if (!hmr) audit.blocked.push('WEBSOCKET')
    socket.close()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(initialExperience => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '원문 상세 검수자', email: 'original-detail@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify(initialExperience))
  }, initialExperience)
}

async function preferenceBridge(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts', promise = import(/* @vite-ignore */ path)
    Reflect.set(window, 'originalDetailPreferenceModule', promise)
    Reflect.set(window, 'originalDetailSetLanguage', (await promise).setClientPreference)
  })
}
async function changeLanguage(page: Page, language: string) {
  await page.evaluate(language => Reflect.get(window, 'originalDetailSetLanguage')('language', language), language)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

async function main(page: Page, baseURL: string | undefined) {
  await guard(page, baseURL)
  await page.goto('/#/share')
  await openRetained(page)
  await preferenceBridge(page)
  return page.locator('.client-shared-detail')
}
async function openRetained(page: Page) {
  await page.evaluate(hash => { history.pushState(null, '', hash); dispatchEvent(new Event('teth:navigate')) }, sharedHash({ nick, period: 'all' }))
  await expect(page.locator('.ss3-dtitle')).toContainText(nick)
  await expect(page.locator('.ss3-matrix button.mx')).toHaveCount(6)
}
async function native(page: Page, baseURL: string | undefined) {
  await guard(page, baseURL)
  await page.goto('/')
  await page.evaluate(async () => {
    const path = '/tests/fixtures/sharing-service-harness.tsx'
    const { mountSharing } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'originalDetailNative', mountSharing(true))
  })
  const hub = page.locator('#sharing-test-root')
  await expect(hub.locator('.native-strategies')).toBeVisible()
  await hub.locator('.strategy-list-link').first().click()
  await expect(hub.locator('.ss3-dtitle')).toHaveText('공급된 전략')
  await expect(hub.locator('[data-metric="ret"] b')).toHaveText('+12.3%')
  await preferenceBridge(page)
  return hub.locator('.client-shared-detail')
}
const breadcrumb = (detail: Locator) => detail.locator('.tfbk-bc button')
const copyAction = (detail: Locator) => detail.locator('.shared-detail-actions > .wbtn')
const experience = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))

async function geometry(page: Page, detail: Locator, info: TestInfo, scope: string) {
  await page.evaluate(() => document.fonts.ready)
  const buttons = await detail.locator('.tfbk-bc button, .shared-detail-actions > .wbtn').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect()
    return { text: node.textContent, width: rect.width, height: rect.height, left: rect.left, right: rect.right, overflow: node.scrollWidth - node.clientWidth }
  }))
  const viewport = await page.evaluate(() => ({ width: innerWidth, horizontalOverflow: document.documentElement.scrollWidth - innerWidth }))
  expect(buttons).toHaveLength(2)
  for (const button of buttons) { expect(button.width).toBeGreaterThan(0); expect(button.height).toBeGreaterThan(0); expect(button.overflow).toBeLessThanOrEqual(1) }
  expect(viewport.horizontalOverflow).toBeLessThanOrEqual(1)
  await info.attach(`${scope}-geometry.json`, { body: JSON.stringify({ buttons, viewport, path: await page.evaluate(() => location.hash) }), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath(`${scope}-original-actions.png`) })
}

test.afterEach(async ({ page }) => { expect(audits.get(page)).toEqual({ blocked: [], errors: [] }) })

test('shared detail original actions: Main retained URL KO 원문·복귀 route·초안·copy 진입 유지', async ({ page, baseURL }, info) => {
  const detail = await main(page, baseURL)
  await expect(breadcrumb(detail)).toHaveText(original.breadcrumb)
  await expect(copyAction(detail)).toHaveText(original.copy)
  const detailHash = await page.evaluate(() => location.hash)
  await geometry(page, detail, info, 'main-ko')
  await breadcrumb(detail).click()
  await expect(page.locator('.strategy-list-grid')).toBeVisible()
  expect(await page.evaluate(() => location.hash)).toBe('#/share')
  expect(await experience(page)).toEqual(initialExperience)
  await openRetained(page)
  await copyAction(detail).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  expect(await page.evaluate(() => location.hash)).toBe(detailHash)
  expect(await experience(page)).toEqual(initialExperience)
})

test('shared detail original actions: Native supplied KO 원문·기존 검증 callbacks·목록 복귀 유지', async ({ page, baseURL }, info) => {
  const detail = await native(page, baseURL)
  await expect(breadcrumb(detail)).toHaveText(original.breadcrumb)
  await expect(copyAction(detail)).toHaveText(original.copy)
  await geometry(page, detail, info, 'native-ko')
  await copyAction(detail).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox')).toHaveCount(3)
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '확정하고 검증 시작', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'originalDetailNative').actions.filter((kind: string) => kind.startsWith('validate')))).toEqual(['validate-copy'])
  await page.evaluate(() => Reflect.get(window, 'originalDetailNative').settle('validate-copy'))
  await dialog.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'originalDetailNative').settle('validate-confirm'))
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'originalDetailNative').actions.filter((kind: string) => kind.startsWith('validate')))).toEqual(['validate-copy', 'validate-confirm'])
  await breadcrumb(detail).click()
  await expect(page.locator('#sharing-test-root .strategy-list-link')).toBeVisible()
  expect(await page.evaluate(() => location.hash)).toBe('')
  expect(await experience(page)).toEqual(initialExperience)
})

for (const scope of ['Main', 'Native'] as const) test(`shared detail original actions: ${scope} 다른6언어 기존 breadcrumb·CTA·route·초안 유지`, async ({ page, baseURL }, info) => {
  const detail = await (scope === 'Main' ? main : native)(page, baseURL)
  const hash = await page.evaluate(() => location.hash)
  for (const [language, back, follow] of foreign) {
    await changeLanguage(page, language)
    await expect(breadcrumb(detail)).toHaveText(back)
    await expect(copyAction(detail)).toHaveText(follow)
    expect(await page.evaluate(() => location.hash)).toBe(hash)
    expect(await experience(page)).toEqual(initialExperience)
  }
  await geometry(page, detail, info, `${scope.toLowerCase()}-fr`)
  await changeLanguage(page, 'ko')
  await expect(breadcrumb(detail)).toHaveText(original.breadcrumb)
  await expect(copyAction(detail)).toHaveText(original.copy)
})

async function returnLabelReceipt(page: Page, button: Locator, info: TestInfo, scope: string) {
  await expect(button).toHaveText(original.breadcrumb)
  const hash = await page.evaluate(() => location.hash)
  for (const [language, back] of foreign) {
    await changeLanguage(page, language)
    await expect(button).toHaveText(back)
    expect(await page.evaluate(() => location.hash)).toBe(hash)
    expect(await experience(page)).toEqual(initialExperience)
  }
  await changeLanguage(page, 'ko')
  await expect(button).toHaveText(original.breadcrumb)
  const box = await button.evaluate(node => {
    const rect = node.getBoundingClientRect()
    return { text: node.textContent, width: rect.width, height: rect.height, overflow: node.scrollWidth - node.clientWidth }
  })
  expect(box.width).toBeGreaterThan(0); expect(box.height).toBeGreaterThan(0); expect(box.overflow).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await info.attach(`${scope}-return.json`, { body: JSON.stringify({ hash, box, experience: await experience(page) }), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath(`${scope}-return.png`) })
}

test('shared detail additional return labels: Native own nullparameters 원문 breadcrumb·공급 공개·복귀 보존', async ({ page, baseURL }, info) => {
  const detail = await native(page, baseURL), hub = page.locator('#sharing-test-root')
  await breadcrumb(detail).click()
  await hub.getByRole('button', { name: '내 전략', exact: true }).click()
  await hub.getByRole('button', { name: '내 전략 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await dialog.getByRole('textbox').fill('공급된 소개')
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'originalDetailNative').settle('publish'))
  await expect(dialog).toHaveCount(0)
  await hub.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await hub.locator('.strategy-list-link').filter({ hasText: '나의 검증 전략' }).click()
  await expect(hub.locator('.ss3-dtitle')).toContainText('나의 검증 전략')
  await expect(hub).toContainText('검증 곡선 없음. 저장된 요약 지표만 표시합니다.')
  const calls = await page.evaluate(() => Reflect.get(window, 'originalDetailNative').actions)
  expect(calls).toEqual(['tab', 'publish', 'tab'])
  await info.attach('native-own-calls.json', { body: JSON.stringify(calls), contentType: 'application/json' })
  const back = hub.locator('.tfbk-bc button')
  await returnLabelReceipt(page, back, info, 'native-own')
  await back.click()
  await expect(hub.locator('.strategy-list-link').filter({ hasText: '나의 검증 전략' })).toBeVisible()
  expect(await experience(page)).toEqual(initialExperience)
})

// 원본에는 loading UI 대응 오라클이 없다. 이 검사는 동일 목록 복귀 label의 일관성만 검사한다.
test('shared detail additional return labels: Main catalogue error 목록명 일관성·기존 복귀·초안 보존', async ({ page, baseURL }, info) => {
  await guard(page, baseURL)
  await page.route('**/src/client-catalogue-worker.ts?worker_file&type=module', route => route.abort('failed'))
  await page.goto(`/${sharedHash({ nick: 'r1', period: 'all' })}`)
  const status = page.locator('.catalogue-loading')
  await expect(status).toHaveAttribute('aria-busy', 'false')
  await preferenceBridge(page)
  const back = status.locator('button').last()
  await returnLabelReceipt(page, back, info, 'main-catalogue-error')
  await back.click()
  await expect(page.locator('.strategy-list-grid')).toBeVisible()
  expect(await page.evaluate(() => location.hash)).toBe('#/share')
  expect(await experience(page)).toEqual(initialExperience)
})
