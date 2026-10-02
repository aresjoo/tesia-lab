import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { researchCopy, researchNavigationLabel } from '../../src/client-research-copy'
import { openNativeAccountMenu as openObservedNativeAccountMenu } from './native-account-test-helpers'

test.use({ trace: 'off', video: 'off' })
// Fixed source9fb keeps Insights in the real account menu, outside the sidebar IA.
// Consume actual source controls; never replace service state, handlers or ports.
async function sourceInsightEntry(page: Page) {
  // Guest drawer order is login→settings; the desktop rail reverses it.
  // Choose the settings action itself, never the anonymous login action.
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

async function openNativeAccountMenu(page: Page) {
  if (!await page.locator('.client-settings-page').isVisible()) await revealSourceNavigation(page)
  return openObservedNativeAccountMenu(page)
}

const ready = fixture.snapshots.ready
const turn = fixture.documents.find(item => item.name === 'turn')!.value
const owner = 'session_insight_navigation_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_insight_navigation_fixture_0001', traceId: 'trace_insight_navigation_fixture_0001' })
const insight = (page: Page) => page.locator('.client-insights')
const composer = (page: Page) => page.locator('.g-composer textarea')
async function setup(page: Page, authenticated = true, restore = true) {
  const requests: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner, restore }) => {
    if (!restore) return
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner, restore })
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/')) requests.push(`${request.method()} ${path}`)
  })
  await page.route('**/api/**', route => route.abort('failed'))
  await page.route('**/api/v1/auth/session', route => route.fulfill({ contentType: 'application/json',
    headers: { ETag: '"insight_session_fixture_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: {
      sessionId: owner, state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1',
      issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z',
    } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_insight_navigation_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route(`**/api/v3/conversations/${ready.conversationId}`, route => route.fulfill({
    contentType: 'application/json', headers: { ETag: '"insight_draft_fixture_0004"' },
    body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) }))
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(restore ? composer(page) : page.locator('.landing-hero textarea')).toBeVisible()
  return requests
}
async function menu(page: Page, name: string | RegExp) {
  if (name === '인사이트') { await (await sourceInsightEntry(page)).click(); return }
  const button = page.locator('.client-sidebar').getByRole('button', { name, exact: true })
  if (!await button.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await button.click()
}

for (const width of [320, 1440]) test(`${width}px 인사이트는 원본 표면을 유지하고 언어 변경·왕복 시 대화와 초점을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const requests = await setup(page)
  await composer(page).fill('인사이트를 보면서 유지할 전략 초안')
  await page.evaluate(() => Reflect.set(window, 'insightComposer', document.querySelector('.g-composer textarea')))
  const initial = [...requests]
  await menu(page, '인사이트')
  await expect(insight(page)).toHaveAttribute('data-source', 'UNAVAILABLE')
  await expect(insight(page).getByRole('heading', { level: 1 })).toBeFocused()
  await expect(composer(page)).toBeHidden()
  // Source sidebar has no Insights row: the active content remains the real
  // Insights surface, without falsely highlighting one of its four nav rows.
  await expect(page.locator('.client-sidebar button[aria-current="page"]')).toHaveCount(0)
  await expect(insight(page).locator('.nfz-card, .nfz-cur, time, .insight-empty, [role="progressbar"]')).toHaveCount(0)
  await expect(insight(page).locator('.nfz-top3 > div')).toHaveCount(3)
  await expect(insight(page).locator('.nfz-rail')).toBeVisible()
  await expect(insight(page)).not.toContainText('9월 13일')
  const titles = new Set<string>()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async value => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', value)
    }, language)
    await expect(insight(page)).toHaveAttribute('aria-label', researchNavigationLabel(language, 'insight'))
    await expect(insight(page).getByRole('button', { name: researchCopy(language, 'return'), exact: true })).toBeVisible()
    titles.add(await insight(page).getByRole('heading', { level: 1 }).innerText())
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await insight(page).getByRole('button').evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  }
  expect(titles.size).toBe(7)
  await page.screenshot({ path: info.outputPath(`insight-${width}-fr.png`), fullPage: true })
  await insight(page).getByRole('button', { name: researchCopy('fr', 'return'), exact: true }).click()
  await expect(insight(page)).toHaveCount(0)
  await expect(composer(page)).toHaveValue('인사이트를 보면서 유지할 전략 초안')
  await expect(composer(page)).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'insightComposer') === document.querySelector('.g-composer textarea'))).toBe(true)
  expect(requests).toEqual(initial)
  expect(errors).toEqual([])
})

test('익명 첫 화면에서도 로그인 없이 열고 같은 입력창으로 돌아온다', async ({ page }) => {
  const requests = await setup(page, false, false)
  const input = page.locator('.landing-hero textarea')
  await input.fill('아직 보내지 않은 첫 질문')
  const initial = [...requests]
  await menu(page, '인사이트')
  await expect(insight(page)).toBeVisible()
  await expect(page.getByRole('region', { name: '실제 계정 로그인', exact: true })).toHaveCount(0)
  await expect(page.locator('#teth-help')).toHaveCount(0)
  await insight(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(input).toHaveValue('아직 보내지 않은 첫 질문')
  await expect(input).toBeFocused()
  expect(requests).toEqual(initial)
})

test('연구 기록·트레이딩 진입은 인사이트와 중첩되지 않는다', async ({ page }) => {
  const requests = await setup(page)
  const initial = [...requests]
  await composer(page).fill('메뉴 왕복 초안')
  for (const [label, selector] of [['연구 기록', '#research-main'], [sourceSidebarNavigationLabel('ko', 'trading'), '.native-trading-workspace']]) {
    await menu(page, '인사이트')
    await expect(insight(page)).toBeVisible()
    await menu(page, label)
    await expect(insight(page)).toHaveCount(0)
    await expect(page.locator(selector)).toBeVisible()
    await menu(page, '인사이트')
    await expect(page.locator(selector)).toHaveCount(0)
    await expect(insight(page).getByRole('heading', { level: 1 })).toBeFocused()
  }
  await insight(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(composer(page)).toHaveValue('메뉴 왕복 초안')
  expect(requests).toEqual(initial)
})

test('다른 화면을 보는 동안 실제 SDK 턴 응답은 계속 수신되고 재전송하지 않는다', async ({ page }) => {
  const requests = await setup(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v3/conversations/*/messages', async route => {
    await gate
    await route.fulfill({ contentType: 'application/json', headers: { ETag: '"insight_turn_fixture_0004"' },
      body: JSON.stringify({ meta: meta('0.3.0', '4'), data: turn }) })
  })
  await composer(page).fill('비트코인 조건을 확인해줘')
  await composer(page).press('Enter')
  try {
    await expect.poll(() => requests.filter(item => item.includes('/messages')).length).toBe(1)
    const spacer = page.locator('.g-spacer')
    const pendingHeight = await spacer.evaluate(el => (el as HTMLElement).style.height)
    expect(parseFloat(pendingHeight)).toBeGreaterThan(0)
    await menu(page, '인사이트')
    await expect(insight(page)).toBeVisible()
    release()
    await expect(composer(page)).toBeEnabled()
    await expect.poll(() => spacer.evaluate(el => (el as HTMLElement).style.height)).toBe(pendingHeight)
    await expect(insight(page)).toBeVisible()
    await insight(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
    await expect(page.locator('.g-umsg').last()).toContainText('비트코인 조건을 확인해줘')
    // The supplied response now renders the client-owned question dock.
    // Returning must focus its first answer, without exposing a second input.
    await expect(composer(page)).toBeHidden()
    await expect(page.locator('.client-question-dock .op').first()).toBeFocused()
    await page.locator('.client-question-dock').getByRole('button', { name: '직접 답변 작성', exact: true }).click()
    const direct = page.locator('.client-question-dock input')
    await direct.fill('조건을 직접 수정하는 중')
    await menu(page, '인사이트')
    await insight(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
    await expect(direct).toHaveValue('조건을 직접 수정하는 중')
    await expect(direct).toBeFocused()
    expect(requests.filter(item => item.startsWith('POST'))).toEqual([`POST /api/v3/conversations/${ready.conversationId}/messages`])
  } finally { release() }
})

test('확인된 로그아웃은 열린 인사이트도 닫는다', async ({ page }) => {
  await setup(page)
  let revoked = false
  await page.route('**/api/v1/auth/logout', route => { revoked = true; return route.fulfill({ contentType: 'application/json', headers: { ETag: '"insight_logout_fixture_0002"' },
    body: JSON.stringify({ meta: meta('0.1.0', '2'), data: { sessionId: owner, state: 'REVOKED', revision: '2',
      issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }) })
  await page.route('**/api/v1/auth/session', route => revoked ? route.fulfill({ status: 401, contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Fixture revoked session' } }) }) : route.fallback())
  await menu(page, '인사이트')
  await expect(insight(page)).toBeVisible()
  await (await openNativeAccountMenu(page)).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'logged-out')
  await expect(insight(page)).toHaveCount(0)
})

test('느린 화면 로딩 중 사용자가 옮긴 초점을 완료 후 빼앗지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/internal-poc/NativeInsights.tsx*', async route => { await gate; await route.continue() })
  await menu(page, '인사이트')
  try {
    await expect(page.locator('.site-page-loading')).toBeVisible()
    await page.locator('.site-page-loading').press('Shift+Tab')
    const target = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
    await target.focus()
    release()
    await expect(insight(page)).toBeAttached()
    await expect(target).toBeFocused()
  } finally { release() }
})

test('인사이트 청크 실패에도 기존 대화 입력을 잃지 않고 복귀한다', async ({ page }) => {
  const requests = await setup(page)
  await composer(page).fill('화면 로딩 실패에도 보존할 초안')
  const initial = [...requests]
  await page.route('**/src/internal-poc/NativeInsights.tsx*', route => route.abort('failed'))
  await menu(page, '인사이트')
  await expect(page.locator('.site-page-recovery')).toBeVisible()
  await page.locator('.site-page-recovery').getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(composer(page)).toHaveValue('화면 로딩 실패에도 보존할 초안')
  await expect(composer(page)).toBeFocused()
  expect(requests).toEqual(initial)
})

test('인사이트에서 새 전략 확인 취소는 화면과 초안을 지키고 명시 확인만 초기화한다', async ({ page }) => {
  const requests = await setup(page)
  await composer(page).fill('새 전략 취소 시 보존할 초안')
  await menu(page, '인사이트')
  await menu(page, /^(?:＋ )?새 전략$/)
  await expect(page.locator('.client-global-notice')).toBeVisible()
  await page.locator('.client-global-notice').getByRole('button').last().click()
  await expect(insight(page)).toBeVisible()
  await expect(composer(page)).toHaveValue('새 전략 취소 시 보존할 초안')
  await menu(page, /^(?:＋ )?새 전략$/)
  await page.locator('.client-global-notice').getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(insight(page)).toHaveCount(0)
  await expect(page.locator('.landing-hero textarea')).toHaveValue('')
  expect(requests.filter(item => item.startsWith('POST'))).toEqual([])
})

test('최신 결제 설정과 인사이트 사이 이동은 열린 화면을 하나만 유지한다', async ({ page }) => {
  const requests = await setup(page)
  await composer(page).fill('요금 화면 왕복 초안')
  const initial = [...requests]
  await menu(page, '인사이트')
  const settings = page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]')
  if (!await settings.isVisible()) await page.locator('.client-hamburger').click()
  await settings.click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  const settingsPage = page.locator('.client-settings-page')
  const billing = settingsPage.locator('[data-settings-tab="billing"]')
  if (!await billing.isVisible()) await settingsPage.locator('.stg-mback').click()
  await billing.click()
  await expect(insight(page)).toHaveCount(0)
  await expect(settingsPage.locator('h1')).toHaveText('결제')
  if (!await settingsPage.locator('.stg-back').isVisible()) await settingsPage.locator('.stg-mback').click()
  await settingsPage.locator('.stg-back').click()
  await menu(page, '인사이트')
  await expect(settingsPage).toHaveCount(0)
  await expect(insight(page).getByRole('heading', { level: 1 })).toBeFocused()
  await insight(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(composer(page)).toHaveValue('요금 화면 왕복 초안')
  expect(requests).toEqual(initial)
})
