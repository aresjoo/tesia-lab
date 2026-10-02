import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { clientTerminalText } from '../../src/client-terminal-copy'
import { researchCopy } from '../../src/client-research-copy'
import { shellText, sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import type { ClientLanguage } from '../../src/client-preferences'
import { openNativeAccountMenu } from './native-account-test-helpers'

test.use({ trace: 'off', video: 'off' })
const ready = fixture.snapshots.ready
const owner = 'session_trading_navigation_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_trading_navigation_fixture_0001', traceId: 'trace_trading_navigation_fixture_0001' })
const terminal = (page: Page) => page.locator('.native-trading-workspace')
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
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json',
    headers: { ETag: '"trading_session_fixture_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: {
      sessionId: owner, state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1',
      issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z',
    } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_trading_navigation_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route(`**/api/v3/conversations/${ready.conversationId}`, route => route.fulfill({ status: 200,
    contentType: 'application/json', headers: { ETag: '"trading_draft_fixture_0004"' },
    body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) }))
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(restore ? composer(page) : page.locator('.landing-hero textarea')).toBeVisible()
  return requests
}
async function menu(page: Page, name: string) {
  await revealSourceNavigation(page)
  const button = page.locator('.client-sidebar').getByRole('button', { name, exact: true })
  if (!await button.isVisible()) await page.locator('.client-hamburger').click()
  await button.click()
}
async function locale(page: Page, language: ClientLanguage) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, language)
}

for (const width of [320, 1440]) test(`${width}px 원본 거래 터미널 왕복은 계좌 데이터를 만들지 않고 대화와 초점을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const requests = await setup(page)
  await composer(page).fill('보내지 않은 전략 조건')
  await page.evaluate(() => Reflect.set(window, 'tradingComposer', document.querySelector('.g-composer textarea')))
  const initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page).getByRole('heading', { name: '내 트레이딩', exact: true })).toBeVisible()
  await expect(terminal(page).getByRole('heading', { level: 1 })).toBeFocused()
  await expect(composer(page)).toBeHidden()
  await expect(page.locator('.client-sidebar button[aria-current="page"]')).toHaveAttribute('aria-label', sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page).locator('.tft-card, canvas, .cst-dashboard')).toHaveCount(0)
  await expect(terminal(page).locator('.tft-rh .ct2')).toHaveText('—')
  await expect(terminal(page).getByText('아직 실행 중인 전략이 없습니다.', { exact: true })).toHaveCount(0)
  expect(requests).toEqual(initial)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await locale(page, language)
    await expect(terminal(page).getByRole('heading', { level: 1 })).toHaveText(shellText(language, 'trading'))
    expect(await terminal(page).locator('.cat-heading').evaluate(header => {
      const title = header.querySelector('h1')!.getBoundingClientRect()
      const tools = header.querySelector('.cat-heading-tools')!.getBoundingClientRect()
      return title.width >= 140 && title.height < 100 && tools.right <= innerWidth + 1
        && (innerWidth > 860 || title.left >= 60)
        && (title.bottom <= tools.top + 1 || title.right <= tools.left + 1)
    })).toBe(true)
    const tabs = terminal(page).getByRole('tablist', { name: clientTerminalText(language, 'bottomTablist') })
    await expect(tabs.getByRole('tab')).toHaveCount(6)
    await tabs.getByRole('tab', { name: clientTerminalText(language, 'assets'), exact: true }).click()
    await expect(tabs.getByRole('tab', { name: clientTerminalText(language, 'assets'), exact: true })).toHaveAttribute('aria-selected', 'true')
    const pane = terminal(page).getByRole('tabpanel', { name: clientTerminalText(language, 'assets'), exact: true })
    await expect(pane.getByText(clientTerminalText(language, 'connectionTitle'), { exact: true })).toBeVisible()
    // The source CTA may browse the existing catalogue without claiming an
    // account connection. Actual SDK writes remain absent throughout this test.
    await expect(pane.getByRole('button')).toHaveAttribute('aria-disabled', 'false')
    await expect(terminal(page)).toContainText(clientTerminalText(language, 'accountUnavailable'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath(`trading-${width}-fr.png`), fullPage: true })
  await terminal(page).getByRole('button', { name: researchCopy('fr', 'return'), exact: true }).click()
  await expect(terminal(page)).toHaveCount(0)
  await expect(composer(page)).toHaveValue('보내지 않은 전략 조건')
  await expect(composer(page)).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'tradingComposer') === document.querySelector('.g-composer textarea'))).toBe(true)
  expect(requests).toEqual(initial)
  await locale(page, 'ko')
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page).getByRole('heading', { level: 1 })).toBeFocused()
})

test('전체화면에서 직접 대화로 돌아와도 스크롤 잠금과 dialog가 남지 않는다', async ({ page }) => {
  const requests = await setup(page)
  await composer(page).fill('전체화면 왕복 초안')
  const initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await terminal(page).getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '내 트레이딩', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(composer(page)).toHaveValue('전체화면 왕복 초안')
  await expect(composer(page)).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  expect(requests).toEqual(initial)
})

test('익명 사용자의 거래 메뉴는 기존 로그인 진입을 유지한다', async ({ page }) => {
  await setup(page, false)
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page)).toHaveCount(0)
  await expect(page.getByRole('region', { name: '실제 계정 로그인', exact: true })).toBeVisible()
})

test('전체화면 새 전략의 확인은 가려지지 않고 취소 시 초안을 지키며 요청하지 않는다', async ({ page }) => {
  const requests = await setup(page)
  await composer(page).fill('취소하면 남아야 할 초안')
  const initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await terminal(page).getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '내 트레이딩', exact: true })
  if (await dialog.locator('.ctt-main-tabs').isVisible()) await dialog.locator('.ctt-main-tabs').getByRole('tab').nth(1).click()
  const selector = dialog.locator('.ctt-selector-button')
  if (await selector.isVisible() && await selector.getAttribute('aria-expanded') !== 'true') await selector.click()
  await dialog.locator('.tft-new').first().click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.client-global-notice')).toBeVisible()
  await page.locator('.client-global-notice').getByRole('button').last().click()
  await expect(composer(page)).toHaveValue('취소하면 남아야 할 초안')
  expect(requests).toEqual(initial)
})

test('연구 기록과 거래 화면은 중첩되지 않고 대화 초안을 유지한다', async ({ page }) => {
  await setup(page)
  await composer(page).fill('연구와 거래 화면 사이 초안')
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page)).toBeVisible()
  await menu(page, '연구 기록')
  await expect(terminal(page)).toHaveCount(0)
  await expect(page.locator('#research-main')).toBeVisible()
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(page.locator('#research-main')).toHaveCount(0)
  await terminal(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(composer(page)).toHaveValue('연구와 거래 화면 사이 초안')
})

test('거래 화면 왕복은 열어 둔 전략 문서와 행 수정 입력도 유지한다', async ({ page }) => {
  const requests = await setup(page)
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await page.locator('.native-plan-technical > summary').click()
  const document = page.getByRole('article', { name: '현재 서버 전략 초안', exact: true })
  await document.getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = document.getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('아직 전송하지 않은 수정 요청')
  const initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(document).toBeHidden()
  await terminal(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(document).toBeVisible()
  await expect(field).toHaveValue('아직 전송하지 않은 수정 요청')
  expect(await page.evaluate(() => globalThis.document.activeElement !== globalThis.document.body)).toBe(true)
  expect(requests).toEqual(initial)
})

test('거래 화면에서 명시 로그아웃하면 터미널과 소유자 화면을 닫는다', async ({ page }) => {
  const requests = await setup(page)
  let revoked = false
  await page.route('**/api/v1/auth/logout', route => {
    revoked = true
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"trading_logout_fixture_0002"' },
      body: JSON.stringify({ meta: meta('0.1.0', '2'), data: { sessionId: owner, state: 'REVOKED', revision: '2',
        issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
  })
  await page.route('**/api/v1/auth/session', route => revoked ? route.fulfill({ status: 401, contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Fixture revoked session' } }) }) : route.fallback())
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page)).toBeVisible()
  await (await openNativeAccountMenu(page)).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'logged-out')
  await expect(terminal(page)).toHaveCount(0)
  expect(requests.filter(path => path.startsWith('POST'))).toEqual(['POST /api/v1/auth/logout'])
})

test('첫 질문 전 홈에서도 거래 화면은 독립 스크롤과 입력 복귀를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const requests = await setup(page, true, false)
  const field = page.locator('.landing-hero textarea')
  await field.fill('첫 질문 초안')
  const initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page)).toBeVisible()
  expect(await terminal(page).evaluate(node => node.clientHeight <= innerHeight)).toBe(true)
  await terminal(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(field).toHaveValue('첫 질문 초안')
  await expect(field).toBeFocused()
  expect(requests).toEqual(initial)
})

test('거래 화면을 보는 동안 서버 대화 응답을 중지하거나 재전송하지 않는다', async ({ page }) => {
  const requests = await setup(page)
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route(`**/api/v3/conversations/${ready.conversationId}/messages`, async route => {
    await held
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"trading_turn_fixture_0004"' },
      body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision),
        data: fixture.documents.find(item => item.name === 'turn')!.value }) })
  })
  await composer(page).fill('화면을 옮겨도 진행할 질문')
  await composer(page).press('Enter')
  await expect.poll(() => requests.filter(path => path.startsWith('POST')).length).toBe(1)
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  await expect(terminal(page)).toBeVisible()
  release()
  await expect(composer(page)).toBeEnabled()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  await expect(terminal(page).getByRole('heading', { level: 1 })).toBeFocused()
  await terminal(page).getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-urow').last()).toContainText('화면을 옮겨도 진행할 질문')
  // This observed response supplies a clarification: source returns to its
  // visible choice, then its explicit close restores the preserved composer.
  const question = page.getByRole('region', { name: 'Remove or replace the unsupported capability.', exact: true })
  await expect(question).toBeVisible()
  await expect(composer(page)).toBeHidden()
  await expect(question.getByRole('button', { name: 'Remove clause', exact: true })).toBeFocused()
  await question.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  await expect(composer(page)).toBeVisible()
  await expect(composer(page)).toBeFocused()
  expect(requests.filter(path => path.startsWith('POST'))).toEqual([`POST /api/v3/conversations/${ready.conversationId}/messages`])
})

test('거래 화면 파일 로딩 실패에서도 기존 대화와 초안으로 복귀한다', async ({ page }) => {
  const requests = await setup(page)
  const initial = [...requests]
  await composer(page).fill('파일 로딩 실패에도 남을 입력')
  await page.route('**/src/internal-poc/NativeTradingWorkspace.tsx*', route => route.abort('failed'))
  await menu(page, sourceSidebarNavigationLabel('ko', 'trading'))
  const fallback = page.locator('.client-load-page.is-inline')
  await expect(fallback.getByRole('region')).toBeFocused()
  await fallback.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(composer(page)).toHaveValue('파일 로딩 실패에도 남을 입력')
  await expect(composer(page)).toBeFocused()
  expect(requests).toEqual(initial)
})
