import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

// Source a012632: member profile opens the popup; its Settings item opens General.
// Guest entry still opens authentication, never a synthetic account.
// Real NativeServiceApp + SDK, with explicit synthetic session/conversation wire.
test.setTimeout(30_000)
test.use({ actionTimeout: 10_000 })
const ready = fixture.snapshots.ready
const owner = 'session_insight_navigation_fixture_0001'
const meta = (version: string, revision: string | null) => ({
  apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_insight_navigation_fixture_0001', traceId: 'trace_insight_navigation_fixture_0001',
})

async function setup(page: Page, authenticated = true) {
  const requests: string[] = []
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
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
  await page.route(`**/api/v3/conversations/${ready.conversationId}`, route => route.fulfill({ contentType: 'application/json',
    headers: { ETag: '"insight_draft_fixture_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) }))
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  expect(requests).toContain('GET /api/v1/auth/session')
  expect(requests).toContain(`GET /api/v3/conversations/${ready.conversationId}`)
  expect(requests.filter(value => value.startsWith('POST'))).toEqual([])
  return requests
}

async function expectSourceSettings(page: Page) {
  const menu = page.locator('.client-settings-page')
  await expect(menu).toBeVisible()
  for (const label of ['일반', '계정', '알림', '결제', '보안']) {
    await expect(menu.getByRole('link', { name: label, exact: true })).toBeVisible()
  }
  await expect(menu.getByRole('button', { name: '상담원에게 묻기', exact: true })).toBeVisible()
  await expect(menu.getByRole('button', { name: '거래소 연결', exact: true })).toBeVisible()
  await expect(menu.locator('h1')).toHaveText('일반')
  await expect(page.locator('.ca-profile')).toHaveCount(0)
  return menu
}

for (const activation of ['click', 'Enter'] as const) test(`인증된 축소 프로필 ${activation}은 팝업을 거쳐 전용 설정을 열고 초안을 보존한다`, async ({ page }, info) => {
  const requests = await setup(page), initial = [...requests]
  const composer = page.locator('.g-composer textarea')
  await composer.fill('설정을 확인한 뒤 이어 쓸 초안')
  const original = await composer.elementHandle()
  const profile = page.locator('[data-sidebar-action="account"]')
  await expect(profile).toBeVisible()
  if (activation === 'click') await profile.click()
  else { await profile.focus(); await profile.press('Enter') }
  await expect(page.locator('.ca-settings')).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  await info.attach('actual-native-account-surface', { contentType: 'application/json', body: JSON.stringify({
    phase: await page.locator('.client-service-app').getAttribute('data-service-phase'),
    settings: await page.locator('.client-settings-page').allTextContents(), requests,
  }, null, 2) })
  const menu = page.locator('.client-settings-page')
  await expect(menu.locator('h1')).toHaveText('일반')
  await expect(page).toHaveURL(/#\/settings\/general$/)
  await menu.getByRole('combobox', { name: '언어', exact: true }).selectOption('en')
  await expect(menu.locator('h1')).toHaveText('General')
  await menu.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ko')
  await menu.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await expect(composer).toBeVisible()
  await expect(composer).toHaveValue('설정을 확인한 뒤 이어 쓸 초안')
  expect(await composer.evaluate((node, before) => node === before, original)).toBe(true)
  expect(requests).toEqual(initial)
})

test('대조군: 펼친 인증 프로필 행도 같은 전용 설정을 연다', async ({ page }) => {
  const requests = await setup(page), initial = [...requests]
  await page.locator('.client-rail-logo-row button').click()
  await page.locator('[data-sidebar-action="profile-settings"]').click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  await expectSourceSettings(page)
  expect(requests).toEqual(initial)
})

test('대조군: 익명 축소 프로필은 설정 권한을 만들지 않고 실제 로그인 창을 연다', async ({ page }) => {
  const requests = await setup(page, false), initial = [...requests]
  await page.locator('[data-sidebar-action="account"]').click()
  await expect(page.locator('dialog.native-auth-surface')).toBeVisible()
  await expect(page.locator('.ca-profile, .ca-settings')).toHaveCount(0)
  // Opening real authentication re-verifies the owner, without a mutation.
  expect(requests.slice(initial.length)).toEqual(['GET /api/v1/auth/session'])
  expect(requests.filter(value => value.startsWith('POST'))).toEqual([])
})
