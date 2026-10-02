import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

// Independent read-only migration audit. Synthetic transport observations are
// test inputs, not production availability or proof of complete source parity.
test.use({ trace: 'retain-on-failure', video: 'off' })
const ready = fixture.snapshots.ready
const owner = 'session_source_completion_audit_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_source_completion_audit_0001', traceId: 'trace_source_completion_audit_0001' })

async function setup(page: Page) {
  const requests: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    requests.push(`${request.method()} ${path}`)
    let data: unknown, version = '0.1.0', revision: string | null = '1'
    if (path === '/api/v1/auth/session') data = { sessionId: owner, state: 'AUTHENTICATED', revision,
      issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    else if (path === '/api/v1/auth/csrf') { revision = null; data = { csrfToken: 'csrf_source_completion_audit_0001', expiresAt: '2030-01-02T00:00:00Z' } }
    else if (path === `/api/v3/conversations/${ready.conversationId}` && request.method() === 'GET') {
      version = '0.3.0'; revision = ready.conversationStateRevision; data = ready
    } else return route.abort('failed')
    return route.fulfill({ contentType: 'application/json', headers: revision === null ? {} : { ETag: '"source_completion_audit_0001"' },
      body: JSON.stringify({ meta: meta(version, revision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  return { requests, errors }
}
// Fixed source9fb places Insights in the actual account settings menu.
// Use existing controls without replacing owner, response source or handlers.
async function sourceInsightEntry(page: Page) {
  const settings = page.locator('[data-sidebar-action="settings"]')
  const trigger = await settings.count() ? settings : page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]').first()
  if (!await trigger.isVisible()) {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  }
  await trigger.click()
  const entry = page.locator('.ca-settings [data-menu-action="insight"]')
  await expect(entry).toBeVisible()
  return entry
}
async function menu(page: Page, label: string) {
  if (label === '인사이트') { await (await sourceInsightEntry(page)).click(); return }
  const button = page.locator('.client-sidebar').getByRole('button', { name: label, exact: true })
  if (!await button.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await button.click()
}
async function locale(page: Page) {
  const trigger = page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]')
  if (!await trigger.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await trigger.click()
  await expect(page.locator('.ca-settings')).toBeVisible()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  const panel = page.locator('.client-settings-page')
  await expect(panel).toBeVisible()
  await expect(panel.locator('select.stg-sel')).toBeVisible()
  return panel
}
async function returnFromSettings(page: Page) {
  const panel = page.locator('.client-settings-page')
  if (!await panel.locator('.stg-back').isVisible()) {
    if (await panel.locator('.stg-mback').isVisible()) await panel.locator('.stg-mback').click()
    else await panel.locator('.stg-tg').click()
  }
  await panel.locator('.stg-back').click()
  await expect(panel).toHaveCount(0)
}


for (const width of [320, 1440]) {
  test(`${width}px 전역 메뉴 장거리 왕복: 기존 대화 DOM·초안·소유자 유지, 암묵 실행 없음`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await setup(page), requests = [...state.requests]
    const input = page.locator('.g-composer textarea')
    await input.fill('전체 화면을 확인하고 이어 쓸 질문')
    const original = await input.elementHandle()
    const surfaces = [
      ['연구 기록', '#research-main'], ['인사이트', '.client-insights'],
      [sourceSidebarNavigationLabel('ko', 'sharing'), '.native-strategies'], [sourceSidebarNavigationLabel('ko', 'brokers'), '.native-brokers'],
      [sourceSidebarNavigationLabel('ko', 'trading'), '.native-trading-workspace'],
    ] as const
    for (const [label, selector] of surfaces) {
      await menu(page, label)
      const panel = page.locator(selector)
      await expect(panel).toBeVisible()
      await expect(input).toBeHidden()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await page.screenshot({ path: info.outputPath(`${width}-${label}.png`) })
      await panel.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
      await expect(input).toBeVisible()
      await expect(input).toHaveValue('전체 화면을 확인하고 이어 쓸 질문')
      expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
    }
    expect(state.requests).toEqual(requests)
    expect(state.errors).toEqual([])
  })

  test(`${width}px 설정·7언어 반복 진입: 과거 통화 설정 거절과 닫기 후 비활성 잠금 해제`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await setup(page), requests = [...state.requests]
    const input = page.locator('.g-composer textarea')
    await input.fill('언어와 통화를 바꿔도 보존')
    for (const language of ['English', '日本語', '简体中文', '繁體中文', 'Español', 'Français', '한국어'] as const) {
      const panel = await locale(page)
      await panel.locator('select.stg-sel').selectOption({ label: language })
      await expect(panel.locator('select.stg-sel')).toHaveValue(({ English: 'en', 日本語: 'ja', 简体中文: 'zh-CN', 繁體中文: 'zh-TW', Español: 'es', Français: 'fr', 한국어: 'ko' })[language]!)
      await expect(panel.locator('.num')).toHaveText('USD')
      await returnFromSettings(page)
      await expect(input).toBeEnabled()
      expect(await input.evaluate(node => !!node.closest('[inert]'))).toBe(false)
      await input.focus()
      await expect(input).toBeFocused()
      await expect(input).toHaveValue('언어와 통화를 바꿔도 보존')
    }
    for (const currency of ['USD', 'USDT', 'USDC', 'BTC', 'KRW', 'EUR', 'JPY', 'GBP']) {
      const panel = await locale(page)
      await expect(panel.locator('#locale-currency, [role="tab"]')).toHaveCount(0)
      expect(await page.evaluate(async currency => {
        const path = '/src/client-preferences.ts'
        return (await import(path)).setClientPreference('currency', currency)
      }, currency)).toBe(currency === 'USD')
      await returnFromSettings(page)
      const again = await locale(page)
      await expect(again.locator('select.stg-sel')).toHaveValue('ko')
      await expect(again.locator('.num')).toHaveText('USD')
      await returnFromSettings(page)
    }
    expect(state.requests).toEqual(requests)
    expect(state.errors).toEqual([])
  })
}
