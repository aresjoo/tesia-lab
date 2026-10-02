import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { nativeShellText } from '../../src/internal-poc/native-shell-copy'

const ready = fixture.snapshots.ready
const owner = 'session_notice_fixture_000001'
async function setup(page: Page) {
  const writes: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  // Explicit synthetic wire data exercises the actual service shell, not a
  // claim of backend/market readiness. Unexpected requests never leave here.
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') { writes.push(`${request.method()} ${path}`); return route.abort() }
    if (path === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', resourceRevision: null, requestId: 'req_notice_fixture_000001', traceId: 'trace_notice_fixture_000001' },
      data: { csrfToken: 'csrf_notice_fixture_000001', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
    const conversation = path.startsWith('/api/v3/')
    if (!conversation && path !== '/api/v1/auth/session') return route.abort()
    const revision = conversation ? ready.conversationStateRevision : '1'
    return route.fulfill({ contentType: 'application/json', headers: { ETag: '"notice-fixture-1"' }, body: JSON.stringify({
      meta: { apiContractVersion: conversation ? '0.3.0' : '0.1.0', resourceRevision: revision, requestId: 'req_notice_fixture_000001', traceId: 'trace_notice_fixture_000001' },
      data: conversation ? ready : { sessionId: owner, state: 'AUTHENTICATED', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await expect(page.locator('.native-research-plan')).toBeVisible()
  return writes
}
async function confirmation(page: Page) {
  const quick = page.locator('.client-rail-new-row button')
  if (await quick.isVisible()) await quick.click()
  else {
    await page.locator('.client-hamburger:visible,.client-rail-logo-row button:visible').first().focus(); await page.keyboard.press('Enter')
    await page.locator('.client-sidebar .client-new-strategy').click()
  }
  await expect(page.locator('.client-global-notice')).toContainText('서버 작업을 취소하는 동작은 아닙니다.')
}

for (const [width, height] of [[320, 900], [768, 900], [1100, 900], [1440, 900], [320, 568], [844, 390]]) test(`native research notice ${width}x${height}: document controls, reading and draft remain usable`, async ({ page }, info) => {
  await page.setViewportSize({ width, height })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const writes = await setup(page)
  const draft = page.locator('.g-composer textarea')
  await draft.fill('확인 안내를 닫아도 남을 초안')
  const original = await draft.elementHandle()
  const storage = await page.evaluate(() => ({ ...sessionStorage }))
  await confirmation(page)
  const notice = page.locator('.client-global-notice')
  const text = await notice.innerText()
  const workspace = page.locator('.native-research-workspace')
  const drawer = workspace.locator('.rw-aux')
  const trigger = workspace.locator('.rw-title .rw-mobile-artifacts')
  if (await trigger.isVisible()) {
    // This real click failed before correction: fixed notice covered it.
    await trigger.click()
    await expect(drawer).toBeVisible()
    await drawer.locator('.rw-artifact').first().click()
    await expect(drawer).toBeHidden()
  } else await drawer.locator('.rw-artifact').first().click()
  await expect(notice).toHaveText(text, { useInnerText: true })
  for (const button of await notice.locator('button').all()) {
    const rect = await button.boundingBox()
    expect(rect!.height).toBeGreaterThanOrEqual(44)
    expect(rect!.width).toBeGreaterThanOrEqual(44)
  }
  const scroll = workspace.locator('.rw-scroll')
  await scroll.evaluate(node => { node.scrollTop = node.scrollHeight })
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  await expect(notice).toBeInViewport()
  const noticeBox = (await notice.boundingBox())!, scrollBox = (await scroll.boundingBox())!
  const visibleNoticeBox = (await page.locator('.native-service-action-notice').boundingBox())!
  expect(scrollBox.height).toBeGreaterThanOrEqual(80)
  // The notice may scroll inside its capped viewport. Its clipped content's
  // full bounding box is not the actual region that could cover the document.
  expect(visibleNoticeBox.y + visibleNoticeBox.height).toBeLessThanOrEqual(scrollBox.y + 1)
  const headerBox = (await workspace.locator('.rw-header').boundingBox())!
  expect(visibleNoticeBox.y + visibleNoticeBox.height).toBeLessThanOrEqual(headerBox.y + 1)
  for (const control of await page.locator('.client-account-utility button:visible,.client-hamburger:visible').all()) {
    const rect = (await control.boundingBox())!
    expect(rect.x < noticeBox.x + noticeBox.width && rect.x + rect.width > noticeBox.x
      && rect.y < noticeBox.y + noticeBox.height && rect.y + rect.height > noticeBox.y).toBe(false)
  }
  await expect(draft).toHaveValue('확인 안내를 닫아도 남을 초안')
  expect(await draft.evaluate((node, saved) => node === saved, original)).toBe(true)
  const close = notice.getByRole('button', { name: '알림 닫기', exact: true })
  await close.focus(); await page.keyboard.press('Enter')
  await expect(notice).toHaveCount(0)
  await expect(draft).toHaveValue('확인 안내를 닫아도 남을 초안')
  expect(await page.evaluate(() => ({ ...sessionStorage }))).toEqual(storage)
  expect(writes).toEqual([])
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await confirmation(page)
  await page.screenshot({ path: info.outputPath('native-notice.png'), fullPage: true })
})

for (const [width, height] of [[320, 568], [844, 390]]) test(`native confirmation ${width}x${height}: seven languages keep controls and reading space`, async ({ page }) => {
  await page.setViewportSize({ width, height })
  const writes = await setup(page)
  await confirmation(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async code => {
      const path = '/src/client-preferences.ts'
      ;(await import(/* @vite-ignore */ path)).setClientPreference('language', code)
    }, language)
    const notice = page.locator('.client-global-notice')
    await expect(notice.locator(':scope > span')).toHaveText(nativeShellText(language, 'resetConfirm'))
    const scroll = page.locator('.native-research-workspace .rw-scroll')
    expect((await scroll.boundingBox())!.height).toBeGreaterThanOrEqual(80)
    // If a translated notice itself needs scrolling, the controls must still
    // be reachable without scrolling or replacing the strategy document.
    for (const button of await notice.locator('button').all()) {
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeInViewport()
      const rect = (await button.boundingBox())!
      expect(rect.height).toBeGreaterThanOrEqual(44)
      expect(rect.width).toBeGreaterThanOrEqual(44)
      const clip = (await page.locator('.native-service-action-notice').boundingBox())!
      expect(rect.y).toBeGreaterThanOrEqual(clip.y - 1)
      expect(rect.y + rect.height).toBeLessThanOrEqual(clip.y + clip.height + 1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(writes).toEqual([])
})

test('narrow analysis switch retains confirmation and the same analysis DOM', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/notice-analysis-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.goto('/notice-analysis-fixture.html')
  // Isolated layout seam only. The analysis input is a lifetime probe, not a
  // fabricated trading chart or actual backtest result.
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const shellPath = '/src/internal-poc/ClientServiceExperience.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(shellPath)).text(), reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ reactPath), react = reactModule.default ?? reactModule
    const dom = await import(/* @vite-ignore */ domPath), { ClientServiceExperience } = await import(/* @vite-ignore */ shellPath)
    const audit = { sends: 0, resets: 0 }
    Reflect.set(window, 'noticeLayoutAudit', audit)
    function Host() {
      const [input, setInput] = react.useState('')
      return react.createElement(ClientServiceExperience, { nativeAccounts: true, accountScope: 'notice-layout-owner',
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', source: 'service', messages: [{ id: 'fixture-user', role: 'user', text: '표시 수명 검사' }], input, busy: false, inputDisabled: false, recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: setInput, onSend: async () => { audit.sends++ }, onReset: async () => { audit.resets++; return false } },
        strategyDocument: { identity: 'notice-layout-document', content: react.createElement('p', null, '공급된 문서 표시 슬롯') },
        researchPresentation: { scope: 'notice-layout-owner', data: { scopeId: 'notice-layout-document', status: 'unavailable' } },
        analysis: react.createElement('input', { 'aria-label': '분석 수명 검사', defaultValue: '보존할 분석 입력' }),
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(Host))
  })
  await page.locator('[data-analysis-tab="chat"]').click()
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await expect(page.locator('.native-research-workspace')).toBeVisible()
  await confirmation(page)
  const notice = page.locator('.client-global-notice'), savedNotice = await notice.elementHandle()
  await page.locator('[data-analysis-tab="analysis"]').click()
  await expect(page.locator('.native-research-workspace')).toBeHidden()
  await expect(notice).toBeInViewport()
  expect(await notice.evaluate((node, previous) => node === previous, savedNotice)).toBe(true)
  const analysis = page.getByRole('textbox', { name: '분석 수명 검사' }), savedAnalysis = await analysis.elementHandle()
  await analysis.fill('이동 중 보존된 분석 상태')
  await notice.getByRole('button', { name: '알림 닫기', exact: true }).click()
  await expect(notice).toHaveCount(0)
  await expect(analysis).toHaveValue('이동 중 보존된 분석 상태')
  expect(await analysis.evaluate((node, previous) => node === previous, savedAnalysis)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'noticeLayoutAudit'))).toEqual({ sends: 0, resets: 0 })
})
