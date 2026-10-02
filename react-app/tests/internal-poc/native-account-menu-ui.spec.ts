import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import sourceCopy from '../../src/client-reference-copy.json' with { type: 'json' }
import settingsCopy from '../../src/client-settings-copy.json' with { type: 'json' }
import { nativeHistoryCopy } from '../../src/internal-poc/native-history-copy'
import { nativeShellCopy, nativeShellText } from '../../src/internal-poc/native-shell-copy'
import { shellText, sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { feedbackText } from '../../src/client-feedback-copy'
import { CLIENT_RESEARCH_COPY, researchCopy } from '../../src/client-research-copy'
import { clientResearchLabel } from '../../src/client-research-label'
import { openNativeAccountMenu as openNativeAccountMenuConsumer } from './native-account-test-helpers'
import strategyListCopy from '../../src/client-strategy-list-copy.json' with { type: 'json' }

// Real native UI/controller/SDK, controlled synthetic responses only. Opening
// source menus does not grant authentication, approval or execution authority.
test.use({ trace: 'off', video: 'off' })
test.setTimeout(25_000)
const ready = fixture.snapshots.ready, owner = 'session_account_menu_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_account_menu_fixture_0001', traceId: 'trace_account_menu_fixture_0001' })
async function setup(page: Page, authenticated = true) {
  const state = { posts: [] as string[], calls: [] as string[], revoked: false, owner, failTurn: false, holdTurn: undefined as (() => Promise<void>) | undefined }
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, id }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { owner, id: ready.conversationId })
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    state.calls.push(`${request.method()} ${path}`)
    if (request.method() === 'POST') state.posts.push(path)
    let data: unknown, version = '0.1.0', revision: string | null = '1', etag = '"account_menu_session_etag_0001"'
    if (path === '/api/v1/auth/session' || path === '/api/v1/auth/logout') {
      if (path.endsWith('/session') && state.revoked) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic absent session' } }) })
      if (path.endsWith('/logout')) { state.revoked = true; revision = '2'; etag = '"account_menu_logout_etag_0002"' }
      data = { sessionId: state.owner, state: state.revoked ? 'REVOKED' : authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision,
        issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    } else if (path === '/api/v1/auth/csrf') {
      revision = null; data = { csrfToken: 'csrf_account_menu_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' }
    } else if (path.startsWith('/api/v3/')) {
      version = '0.3.0'; revision = ready.conversationStateRevision; etag = '"account_menu_conversation_etag_0004"'
      data = ready
      if (path.endsWith('/messages')) {
        if (state.holdTurn) await state.holdTurn()
        if (state.failTurn) return route.abort('failed')
        data = fixture.documents.find(item => item.name === 'turn')!.value
      } else if (request.method() !== 'GET') return route.abort('failed')
    } else return route.abort('failed')
    return route.fulfill({ status: 200, contentType: 'application/json', headers: revision === null ? {} : { ETag: etag }, body: JSON.stringify({ meta: meta(version, revision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return state
}
async function openNativeAccountMenu(page: Page) {
  const trigger = page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]')
  if (!await page.locator('.client-settings-page').isVisible() && !await trigger.isVisible()) {
    // Source scroll-hidden mobile menu is restored by its real keyboard handler.
    await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter')
  }
  return openNativeAccountMenuConsumer(page)
}

async function dismissObservedClarification(page: Page) {
  const question = page.locator('.client-market-question.gcl')
  await expect(question).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toBeHidden()
  // Close only the observed UI card. This supplies no answer or authority;
  // the existing SDK/request-count assertions must remain unchanged.
  await question.locator('.ask-controls .x').click()
  await expect(question).toHaveCount(0)
}

async function memberHelp(panel: ReturnType<Page['locator']>) {
  const help = panel.getByRole('button', { name: settingsCopy.help.ko, exact: true })
  if (!await help.isVisible()) await panel.locator('.stg-mback').click()
  await expect(help).toBeVisible()
  return help
}

async function settings(page: Page) {
  const guestSettings = page.locator('[data-sidebar-action="settings"]')
  const trigger = await guestSettings.count() ? guestSettings : page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]')
  if (!await trigger.isVisible()) { await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter') }
  await trigger.click()
  await expect(page.locator('.ca-settings')).toBeVisible()
  return page.locator('.ca-settings')
}

async function closeMemberSettings(panel: ReturnType<Page['locator']>) {
  const close = panel.locator('.stg-back')
  // Source mobile detail returns through its list before the list close action.
  if (!await close.isVisible()) {
    await panel.locator('.stg-mback').click()
    await expect(panel.locator('.stg-navigation a:focus')).toHaveCount(1)
  }
  await close.click()
}

async function selectMemberTab(panel: ReturnType<Page['locator']>, tab: string) {
  const link = panel.locator(`a[href="#/settings/${tab}"]`)
  if (!await link.isVisible()) await panel.locator('.stg-mback').click()
  await link.click()
  return link
}

async function memberSettings(page: Page, tab: 'general' | 'account' | 'billing' = 'general') {
  const trigger = page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]')
  if (!await trigger.isVisible()) { await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter') }
  await trigger.click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  const panel = page.locator('.client-settings-page')
  await expect(panel).toBeVisible()
  if (tab !== 'general') await selectMemberTab(panel, tab)
  await expect(panel.locator('h1')).toHaveText(settingsCopy[tab].ko)
  await expect(panel.locator('h1')).toBeFocused()
  return panel
}

for (const width of [320, 768, 1440]) test(`native 회원 설정 ${width}px: 원본 5탭과 미공급 상태를 열고 같은 대화로 복귀한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  const input = page.locator('.g-composer textarea')
  await input.fill('설정을 보고 돌아와도 남는 초안')
  const original = await input.elementHandle(), calls = [...state.calls]
  const panel = await memberSettings(page, 'billing')
  await expect(panel).toContainText(settingsCopy.unavailable.ko)
  for (const tab of ['general', 'account', 'notify', 'security', 'billing'] as const) {
    const link = panel.locator(`a[href="#/settings/${tab}"]`)
    await selectMemberTab(panel, tab)
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(panel.locator('h1')).toHaveText(settingsCopy[tab].ko)
    await expect(panel.locator('h1')).toBeFocused()
    if (tab === 'notify') {
      await expect(panel.locator('.client-settings-notifications button')).toHaveCount(12)
      for (const control of await panel.locator('.client-settings-notifications button').all()) await expect(control).toBeDisabled()
    } else if (tab !== 'general') await expect(panel).toContainText(settingsCopy.unavailable.ko)
  }
  await expect(page.locator('.ca-settings, .ca-profile, .native-service-plan')).toHaveCount(0)
  await expect(panel.locator('input, .nfx-hero, .nfx-sw')).toHaveCount(0)
  expect(state.calls).toEqual(calls)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`native-settings-${width}.png`) })
  await closeMemberSettings(panel)
  await expect(panel).toHaveCount(0)
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('설정을 보고 돌아와도 남는 초안')
  expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
  await memberSettings(page, 'billing')
  await closeMemberSettings(panel)
})
async function locale(page: Page, entry: 'supplied-compatibility' | 'fresh-home' = 'supplied-compatibility') {
  if (entry === 'fresh-home') await page.locator('.client-globe').click()
  else {
    await page.evaluate(async () => {
      const path = '/tests/fixtures/native-locale-compatibility.tsx'
      const { installNativeLocaleCompatibility } = await import(/* @vite-ignore */ path)
      installNativeLocaleCompatibility()
    })
    await page.getByRole('button', { name: '명시 호환 소비자 언어 열기', exact: true }).click()
  }
  await expect(page.locator('.client-locale-panel')).toBeVisible()
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  return page.locator('.client-locale-panel')
}

test('native 게스트 설정은 PLAN을 노출하지 않으며 계정 데이터를 만들지 않는다', async ({ page }) => {
  const state = await setup(page, false), calls = [...state.calls]
  const menu = await settings(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async code => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code) }, language)
    await expect(menu.getByRole('button', { name: shellText(language, 'planCredits'), exact: true })).toHaveCount(0)
    await expect(page.locator('.native-service-plan')).toHaveCount(0)
  }
  expect(state.calls).toEqual(calls)
})

test('native 회원 설정: 7언어 전환은 선택한 탭·초점·미공급 상태를 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const state = await setup(page), calls = [...state.calls]
  const panel = await memberSettings(page, 'billing')
  const tab = panel.locator('a[href="#/settings/billing"]')
  // Mobile source detail hides the navigation; keep focus on its real Back link.
  const focused = panel.locator('.stg-mback')
  await focused.focus()
  const node = await focused.elementHandle()
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async code => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code) }, code)
    await expect(panel.locator('h1')).toHaveText(settingsCopy.billing[code])
    await expect(tab).toHaveText(settingsCopy.billing[code])
    await expect(tab).toHaveAttribute('aria-current', 'page')
    await expect(focused).toBeFocused()
    await expect(focused).toBeInViewport({ ratio: 1 })
    expect(await focused.evaluate((element, previous) => element === previous, node)).toBe(true)
    await expect(panel).toContainText(settingsCopy.unavailable[code])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(state.calls).toEqual(calls)
  await page.screenshot({ path: info.outputPath('native-settings-fr-320.png') })
})

test('native 회원 설정을 보는 동안 대화 응답은 완료되고 복귀해도 동일 요청과 초안이 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await setup(page)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  const input = page.locator('.g-composer textarea'), node = await input.elementHandle()
  await input.fill('백그라운드에서도 진행할 원문'); await input.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  const panel = await memberSettings(page, 'billing'), title = panel.locator('h1')
  release()
  await expect(input).toBeEnabled()
  await expect(title).toBeFocused()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  await closeMemberSettings(panel)
  await dismissObservedClarification(page)
  try { await expect(input).toBeFocused() } catch (error) {
    await test.info().attach('settings-return-focus', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => { const el = document.activeElement; return { tag: el?.tagName, id: el?.id, className: el?.className, settingsAncestor: !!el?.closest('.client-settings-page') } })) })
    throw error
  }
  expect(await input.evaluate((element, previous) => element === previous, node)).toBe(true)
  await expect(page.locator('.g-urow').last()).toContainText('백그라운드에서도 진행할 원문')
  expect(state.posts).toHaveLength(1)
})

test('native 활동 기록 청크 실패 시에도 원래 대화와 입력으로 복귀한다', async ({ page }) => {
  const state = await setup(page), calls = [...state.calls]
  const input = page.locator('.g-composer textarea')
  await input.fill('청크 실패 보존')
  await page.route('**/src/internal-poc/NativeAccountPlan.tsx*', route => route.abort('failed'))
  // Exact plan now belongs to Billing; the independently lazy activity route
  // continues to own this recovery boundary. Do not restore an obsolete menu.
  await page.evaluate(() => { location.hash = '#/plan/alerts' })
  const fallback = page.locator('.client-load-page.is-inline')
  await expect(fallback.getByRole('region')).toBeFocused()
  await fallback.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(input).toHaveValue('청크 실패 보존')
  await expect(input).toBeFocused()
  expect(state.calls).toEqual(calls)
})
async function openResearchHistory(page: Page) {
  const mobile = page.locator('.client-hamburger')
  if (await mobile.isVisible()) { await mobile.focus(); await page.keyboard.press('Enter') }
  else await page.locator('.client-rail-logo-row button').click()
  await page.getByRole('button', { name: '연구 기록', exact: true }).click()
  await expect(page.locator('#research-main')).toBeVisible()
}
test('native 회원 설정: 뒤로·앞으로 탐색은 탭과 초안을 보존하되 지난 로그아웃 확인을 재사용하지 않는다', async ({ page }) => {
  const state = await setup(page), calls = [...state.calls]
  const input = page.locator('.g-composer textarea')
  await input.fill('탐색 후 이어갈 미전송 문장')
  const node = await input.elementHandle()
  const panel = await memberSettings(page, 'account')
  await panel.getByRole('button', { name: settingsCopy.logout.ko, exact: true }).click()
  await expect(panel.locator('.stg-confirm')).toBeVisible()
  await selectMemberTab(panel, 'billing')
  const mobileList = page.viewportSize()!.width <= 900
  if (mobileList) { await page.goBack(); await expect(page).toHaveURL(/#\/settings$/) }
  await page.goBack()
  await expect(panel.locator('h1')).toHaveText(settingsCopy.account.ko)
  await expect(panel.locator('h1')).toBeFocused()
  await expect(panel.locator('.stg-confirm')).toHaveCount(0)
  if (mobileList) { await page.goForward(); await expect(page).toHaveURL(/#\/settings$/) }
  await page.goForward()
  await expect(panel.locator('h1')).toHaveText(settingsCopy.billing.ko)
  await expect(panel.locator('h1')).toBeFocused()
  await closeMemberSettings(panel)
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('탐색 후 이어갈 미전송 문장')
  expect(await input.evaluate((element, previous) => element === previous, node)).toBe(true)
  expect(state.calls).toEqual(calls)
})

test('native 회원 설정 320px: 한국어 안내의 단어를 중간에서 자르지 않고 긴 번역도 넘치지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await setup(page)
  const panel = await memberSettings(page, 'account')
  const hint = panel.getByText(settingsCopy.deleteHint.ko, { exact: true })
  await page.evaluate(() => document.fonts.ready)
  for (const word of settingsCopy.deleteHint.ko.split(' ')) {
    expect(await hint.evaluate((element, word) => {
      const node = element.firstChild!, start = node.textContent!.indexOf(word)
      const range = document.createRange()
      range.setStart(node, start); range.setEnd(node, start + word.length)
      return range.getClientRects().length
    }, word), word).toBe(1)
  }
  await hint.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('settings-korean-wrap-320.png') })
  for (const code of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async code => {
      const path = '/src/client-preferences.ts'
      ;(await import(path)).setClientPreference('language', code)
    }, code)
    await expect(panel.getByText(settingsCopy.deleteHint[code], { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await panel.locator('.stg-r').evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth + 1))).toBe(true)
  }
})

test('native 활동 기록 청크 실패 중에도 진행 중 대화는 완료되고 복귀 시 원문·요청을 보존한다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  const input = page.locator('.g-composer textarea'), node = await input.elementHandle()
  await input.fill('다른 화면 오류와 무관하게 완료할 질문')
  await input.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  await page.route('**/src/internal-poc/NativeAccountPlan.tsx*', route => route.abort('failed'))
  await page.evaluate(() => { location.hash = '#/plan/alerts' })
  const fallback = page.locator('.client-load-page.is-inline')
  await expect(fallback.getByRole('region')).toBeFocused()
  release()
  await expect(input).toBeEnabled()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  await expect(fallback.getByRole('region')).toBeFocused()
  await fallback.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await dismissObservedClarification(page)
  await expect(input).toBeFocused()
  expect(await input.evaluate((element, previous) => element === previous, node)).toBe(true)
  await expect(page.locator('.g-urow').last()).toContainText('다른 화면 오류와 무관하게 완료할 질문')
  expect(state.posts).toHaveLength(1)
})
for (const width of [320, 1440]) test(`${width}px 최신 원본 a092 게스트 새 전략은 레일과 펼친 메뉴 모두 비활성이다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page, false)
  const input = page.locator('.g-composer textarea')
  await input.fill('게스트가 작성 중인 원문')
  const calls = [...state.calls]
  const rail = page.locator('.client-rail-new-row button')
  await expect(rail).toBeDisabled()
  await rail.evaluate(node => (node as HTMLButtonElement).click())
  await (width === 320 ? page.locator('.client-hamburger') : page.locator('.client-rail-logo-row button')).click()
  const expanded = page.locator('.client-new-strategy')
  await expect(expanded).toBeDisabled()
  await expanded.evaluate(node => (node as HTMLButtonElement).click())
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await expect(input).toHaveValue('게스트가 작성 중인 원문')
  expect(state.calls).toEqual(calls)
})

test('native 대화 표시 7언어 전환은 공용 입력·전송·제목 문구와 동일하며 입력 DOM·커서·서버 초안을 보존한다', async ({ page }) => {
  const state = await setup(page)
  const input = page.locator('.g-composer textarea')
  await input.fill('보내지 않은 원문 조건')
  await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(2, 5))
  const original = await input.elementHandle(), calls = [...state.calls]
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  for (const [code, inputLabel, sendLabel] of [
    ['ko', 'TETH에게 물어보세요', '메시지 보내기'], ['en', 'Ask TETH', 'Send message'],
    ['ja', 'TETHに聞いてください', 'メッセージを送信'], ['zh-CN', '向TETH提问', '发送消息'],
    ['zh-TW', '向TETH提問', '傳送訊息'], ['es', 'Pregunta a TETH', 'Enviar mensaje'], ['fr', 'Posez votre question à TETH', 'Envoyer le message'],
  ]) {
    await page.evaluate(async code => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code) }, code)
    await expect(input).toHaveAccessibleName(inputLabel)
    await expect(page.locator('.g-composer').getByRole('button', { name: sendLabel, exact: true })).toBeVisible()
    await expect(input).toHaveValue('보내지 않은 원문 조건')
    await expect(input).toBeFocused()
    expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([2, 5])
    expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
    expect(state.calls).toEqual(calls)
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(storage)
  }
})
for (const width of [320, 1440]) test(`연구 기록 ${width}px: 전체 기록 메뉴는 단일 대화 이력 API를 호출하지 않고 같은 대화로 돌아온다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('기록을 확인하고 이어갈 조건')
  const original = await input.elementHandle(), calls = [...state.calls]
  const stored = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  await openResearchHistory(page)
  const hub = page.locator('#research-main')
  await expect(hub).toBeVisible()
  await expect(hub.locator('h1')).toHaveText('연구 기록')
  await expect(hub.locator('h1')).toBeFocused()
  await expect(hub.getByRole('searchbox')).toBeDisabled()
  await expect(hub).not.toContainText('아직 연구 기록이 없어요')
  await expect(hub.locator('.g-hist-list, .g-hist-more')).toHaveCount(0)
  await expect(input).toBeHidden()
  expect(state.calls).toEqual(calls)
  expect(await hub.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`native-research-history-${width}.png`) })
  await hub.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(input).toBeVisible()
  await expect(input).toHaveValue('기록을 확인하고 이어갈 조건')
  await expect(input).toBeFocused()
  expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(stored)
  expect(state.calls).toEqual(calls)
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect.poll(() => state.calls.some(call => call.includes('/api/v8/'))).toBe(true)
})
test('연구 기록은 7언어 전환 중 복귀 버튼 초점을 유지하고 숨겨진 대화의 응답을 처리한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const state = await setup(page)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  // The accessible label intentionally changes with the selected language.
  const input = page.locator('.g-composer textarea')
  await input.fill('지원 범위를 알려줘'); await input.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  const original = await input.elementHandle()
  await openResearchHistory(page)
  const hub = page.locator('#research-main'), back = hub.locator('.hub-header button')
  const originalBack = await back.elementHandle()
  await back.focus()
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async code => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code) }, code)
    await expect(hub.locator('h1')).toHaveText(CLIENT_RESEARCH_COPY[code].history)
    await expect(back).toHaveText(CLIENT_RESEARCH_COPY[code].return)
    await expect(back).toBeFocused()
    expect(await back.evaluate((node, previous) => node === previous, originalBack)).toBe(true)
    await expect(hub).toContainText(nativeHistoryCopy[code].title)
    expect(await hub.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('native-research-history-fr-short.png') })
  release()
  await expect(page.locator('.g-composer textarea')).toBeEnabled()
  await expect(page.locator('.g-composer textarea')).toBeHidden()
  await expect(back).toBeFocused()
  await back.click()
  await dismissObservedClarification(page)
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
  expect(state.posts).toHaveLength(1)
  expect(state.calls.some(call => call.includes('/api/v8/'))).toBe(false)
})
test('연구 기록 청크 실패는 인라인 복구 화면이며 서버 대화와 입력을 보존한다', async ({ page }) => {
  await page.route('**/src/components/ClientResearchHistory.tsx', route => route.abort('failed'))
  const state = await setup(page)
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('청크 실패에도 남을 입력')
  const calls = [...state.calls], original = await input.elementHandle()
  const mobile = page.locator('.client-hamburger')
  if (await mobile.isVisible()) { await mobile.focus(); await page.keyboard.press('Enter') }
  else await page.locator('.client-rail-logo-row button').click()
  await page.getByRole('button', { name: '연구 기록', exact: true }).click()
  const fallback = page.getByRole('region', { name: '페이지를 불러오지 못했습니다' })
  await expect(fallback).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(fallback).toBeFocused()
  expect(await page.locator('.client-load-page.is-inline').evaluate(node => {
    const main = node.closest('main')!
    return node.getBoundingClientRect().height <= main.getBoundingClientRect().height + 1
  })).toBe(true)
  await fallback.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('청크 실패에도 남을 입력')
  expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
  expect(state.calls).toEqual(calls)
})
test('기록 화면을 보고 있어도 대화 실패 안내는 가려지지 않고 미확정 요청은 보존된다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  state.failTurn = true
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('실패 응답 확인'); await input.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  await openResearchHistory(page)
  release()
  const hub = page.locator('#research-main')
  await expect(hub.getByRole('alert')).toBeVisible()
  const issue = await hub.getByRole('alert').textContent() ?? ''
  expect(issue.length).toBeGreaterThan(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).not.toBeNull()
  await hub.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(issue)
  expect(state.posts).toHaveLength(1)
})
test('supplied compatibility: 실제 service 대화 옆 언어 소비자는 저장·Escape·포커스·대화를 보존한다', async ({ page }) => {
  const state = await setup(page, false), url = page.url()
  const input = page.locator('.g-composer textarea')
  await input.fill('아직 보내지 않은 조건')
  const panel = await locale(page)
  await expect(panel).toBeFocused()
  expect(await panel.evaluate(node => !!node.closest('[inert]'))).toBe(false)
  await panel.getByRole('button', { name: 'English', exact: true }).click()
  await expect(panel).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe('en')
  await expect(input).toHaveValue('아직 보내지 않은 조건')
  await expect(input).toHaveAccessibleName('Ask TETH')
  expect(page.url()).toBe(url); expect(state.posts).toHaveLength(0)
  await locale(page); await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON')
  expect(await page.locator('.client-service-app').evaluate(node => (node as HTMLElement).inert)).toBe(false)
})
test('native 셸 사전은 28문구·7언어와 문자 그대로의 기능 이름 치환을 보장한다', () => {
  expect(Object.keys(nativeShellCopy)).toHaveLength(28)
  expect(nativeShellCopy).toHaveProperty('resetFailed')
  for (const row of Object.values(nativeShellCopy)) {
    expect(row).toHaveLength(7)
    expect(row.every(text => typeof text === 'string' && text.trim().length > 0)).toBe(true)
  }
  expect(nativeShellText('ko', 'featureUnavailable', 'PLAN 및 크레딧')).toBe('PLAN 및 크레딧 기능은 이 내부 서비스에 아직 연결되지 않았습니다. 현재 대화는 그대로 유지됩니다.')
  expect(nativeShellText('en', 'featureUnavailable', '$&')).toContain('The $& feature')
})
test('native 기본 제목만 현지화하며 사용자 제목·편집 커서와 문서 선택을 유지한다', async ({ page }) => {
  const state = await setup(page)
  const setLanguage = async (code: string) => page.evaluate(async code => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code) }, code)
  await setLanguage('en')
  await expect(page.locator('.g-title')).toHaveText('New strategy')
  await expect(page.locator('.g-chead h1')).toHaveAccessibleName('Conversation title')
  // Viewing or cancelling the editor is not authoring a title.
  await page.locator('.g-title').click()
  await page.locator('.g-title-input').fill('취소할 제목')
  await page.locator('.g-title-input').press('Escape')
  await setLanguage('ko')
  await expect(page.locator('.g-title')).toHaveText('새 전략')
  await page.locator('.g-title').click()
  await setLanguage('en')
  await page.locator('.g-title-input').press('Tab')
  await expect(page.locator('.g-title')).toHaveText('New strategy')
  await page.locator('.g-title').click()
  const title = page.locator('.g-title-input')
  await title.fill('새 전략')
  await title.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(1, 3))
  await setLanguage('ja')
  await expect(title).toHaveValue('새 전략')
  await expect(title).toBeFocused()
  expect(await title.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([1, 3])
  await title.press('Enter')
  await expect(page.locator('.g-title')).toHaveText('새 전략')
  await page.locator('.g-tabs button').nth(1).click()
  const workspace = page.locator('.native-research-workspace')
  const tab = workspace.getByRole('tab', { selected: true })
  const panelId = await tab.getAttribute('aria-controls')
  expect(panelId).toBeTruthy()
  const doc = workspace.locator(`[role="tabpanel"][id="${panelId}"]`)
  await expect(doc).toBeVisible()
  await doc.locator('.native-plan-technical > summary').click()
  await doc.locator('.native-strategy-source > summary').click()
  await tab.focus()
  const originalDoc = await doc.elementHandle(), originalTab = await tab.elementHandle(), calls = [...state.calls]
  const content = await doc.locator('.native-strategy-source pre').textContent()
  expect(content).toBe(JSON.stringify(ready.draftState.projection, null, 2))
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await setLanguage(code)
    await expect(workspace.locator('.rw-heading [title]')).toHaveText('새 전략')
    await expect(tab).toHaveText(clientResearchLabel('Research Plan', code))
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(tab).toHaveAttribute('aria-controls', panelId!)
    await expect(doc).toBeVisible()
    await expect(tab).toBeFocused()
    expect(await tab.evaluate((node, previous) => node === previous, originalTab)).toBe(true)
    expect(await doc.evaluate((node, previous) => node === previous, originalDoc)).toBe(true)
    await expect(doc.locator('.native-strategy-document h2')).toHaveText(nativeShellText(code, 'strategyDraft'))
    expect(await doc.locator('.native-strategy-source pre').textContent()).toBe(content)
  }
  expect(state.calls).toEqual(calls)
  // Whitespace resets the presentation default instead of authoring Korean.
  await workspace.getByRole('button', { name: 'Retour à la conversation', exact: true }).click()
  await expect(workspace).toBeHidden()
  await page.locator('.g-title').click()
  await title.fill('   ')
  await title.press('Enter')
  await expect(page.locator('.g-title')).toHaveText('Nouvelle stratégie')
  await setLanguage('en')
  await expect(page.locator('.g-title')).toHaveText('New strategy')
  expect(state.calls).toEqual(calls)
})
test('native 대기 중 전략 허브의 언어 변경은 펼친 작업 설명·동일 요청을 보존하고 응답 도착 후 원문을 표시한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await setup(page)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  const input = page.locator('.g-composer textarea')
  await input.fill('사용자가 보낸 원문 조건'); await input.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  const activity = page.locator('.g-act2').filter({ has: page.locator('.hlb', { hasText: '응답 기다리는 중' }) })
  const originalActivity = await activity.elementHandle()
  await expect(activity.locator('.hd')).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter')
  await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true }).click()
  const hub = page.locator('.native-strategies'), close = hub.locator('.hub-header button')
  await expect(hub).toBeVisible()
  await close.focus()
  const originalHub = await hub.elementHandle(), originalInput = await input.elementHandle(), calls = [...state.calls]
  const draft = await input.inputValue()
  const unavailable = {
    ko: '공개 전략 목록이 아직 연결되어 있지 않습니다.', en: 'The public strategy catalog is not connected yet.',
    ja: '公開戦略の一覧はまだ接続されていません。', 'zh-CN': '公开策略列表尚未接入。', 'zh-TW': '公開策略清單尚未接上。',
    es: 'El catálogo de estrategias públicas aún no está conectado.', fr: 'Le catalogue de stratégies publiques n’est pas encore connecté.',
  }
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toBeNull()
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async code => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code) }, code)
    // Locate by captured DOM identity after the visible label changes.
    expect(await page.evaluate(node => node?.isConnected, originalActivity)).toBe(true)
    const header = page.locator('.g-act2 .hd').last()
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.g-act2').last()).toContainText(nativeShellText(code, 'requestTitle'))
    await expect(page.locator('.g-act2 .ad').last()).toContainText(nativeShellText(code, 'requestDetail'))
    await expect(hub.locator('.hub-header h1')).toHaveText(strategyListCopy[code].title)
    await expect(hub.locator('.ss3-empty[role="status"]')).toHaveText(unavailable[code])
    expect(await hub.evaluate((node, previous) => node === previous, originalHub)).toBe(true)
    await expect(close).toBeFocused()
    await expect(close).toHaveText(researchCopy(code, 'return'))
    expect(await input.evaluate((node, previous) => node === previous, originalInput)).toBe(true)
    await expect(input).toHaveValue(draft)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(journal)
    expect(state.calls).toEqual(calls)
    expect(await hub.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('native-shell-pending-fr.png') })
  await close.click()
  await expect(hub).toHaveCount(0)
  await expect(page.locator('#tesia-main')).toBeFocused()
  await expect(page.locator('.g-act2 .ad').last()).toBeVisible()
  await page.locator('.g-act2').last().scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('native-shell-activity-fr.png') })
  release()
  await expect(input).toBeEnabled()
  await expect(page.locator('.g-urow').last()).toContainText('사용자가 보낸 원문 조건')
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  expect(state.posts).toHaveLength(1)
  await expect(hub).toHaveCount(0)
})
test('native 설정 계정은 미공급 신원을 만들지 않고 명시 로그아웃이 기존 POST 하나만 보낸다', async ({ page }) => {
  const state = await setup(page)
  const logout = await openNativeAccountMenu(page)
  await expect(logout).toBeEnabled()
  await expect(page.locator('.client-settings-page h1')).toHaveText('계정')
  await expect(page.locator('.client-settings-page')).not.toContainText('@')
  expect(state.posts).toHaveLength(0)
  await logout.click()
  await expect.poll(() => state.posts).toEqual(['/api/v1/auth/logout'])
  await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('로그아웃 응답과 현재 브라우저 세션 부재를 확인했습니다.')
  await expect(page.getByText('이전 요청 기록을 보존하고 현재 브라우저에서 새 대화 시작', { exact: true })).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await expect(page.locator('.ca-auth')).toHaveCount(0)
})

test('구 통화 preference는 거절되며 회원 언어 설정 왕복에도 서버의 100 USDT 초안·입력을 보존한다', async ({ page }) => {
  const state = await setup(page)
  await page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true }).fill('통화와 별개인 미전송 전략')
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await page.locator('.native-plan-technical > summary').click()
  const doc = page.getByRole('article', { name: '현재 서버 전략 초안', exact: true })
  await expect(doc).toContainText('100 USDT')
  const before = await doc.innerText(), requests = [...state.calls]
  const panel = await memberSettings(page)
  await expect(panel.getByRole('combobox')).toHaveCount(1)
  await expect(panel).toContainText('USD')
  const beforeCurrency = await page.evaluate(() => localStorage.getItem('tethCurrency'))
  expect(await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    return (await import(path)).setClientPreference('currency', 'KRW')
  })).toBe(false)
  await panel.getByRole('combobox').focus()
  await panel.getByRole('combobox').selectOption('en')
  await expect(panel.getByRole('combobox')).toBeFocused()
  await panel.getByRole('combobox').selectOption('ko')
  await closeMemberSettings(panel)
  await expect(panel).toHaveCount(0)
  await expect(doc).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('tethCurrency'))).toBe(beforeCurrency)
  expect(await doc.innerText()).toBe(before)
  expect(state.calls).toEqual(requests)
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue('통화와 별개인 미전송 전략')
})

for (const width of [320, 1440]) test(`고객지원 ${width}px: 원본 패널·SVG·키보드 왕복은 대화와 저장·API를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page), input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('고객지원 확인 후 이어갈 문장')
  const originalInput = await input.elementHandle(), calls = [...state.calls]
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  const member = await memberSettings(page)
  const help = await memberHelp(member)
  await help.click()
  const popup = page.locator('.client-modal-help .site-help-pop')
  await expect(popup).toHaveAccessibleName('24/7 고객지원')
  await expect(page.locator('.ca-settings, .client-locale-panel')).toHaveCount(0)
  await expect(popup.locator('.help-close')).toBeFocused()
  expect(await page.locator('.client-service-app').evaluate(node => (node as HTMLElement).inert)).toBe(true)
  expect(await popup.evaluate(node => !!node.closest('[hidden],[inert]'))).toBe(false)
  await expect(page.locator('.client-modal-help .site-help-trigger svg')).toHaveAttribute('viewBox', '0 0 32 32')
  await expect(popup.locator('a').first()).toHaveAttribute('href', '/about/#faq')
  await expect(popup.locator('a').last()).toHaveAttribute('href', '/policies/#overview')
  await page.keyboard.press('Shift+Tab')
  await expect(popup.locator('a').last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(popup.locator('.help-close')).toBeFocused()
  const box = await popup.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`native-help-${width}.png`) })
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(help).toBeFocused()
  expect(await page.locator('.client-service-app').evaluate(node => (node as HTMLElement).inert)).toBe(false)
  await closeMemberSettings(member)
  await expect(input).toHaveValue('고객지원 확인 후 이어갈 문장')
  expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true)
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(before)
  expect(state.calls).toEqual(calls); expect(state.posts).toEqual([])
})
test('프로필이 열린 채 동일 AUTHENTICATED의 owner가 바뀌면 현재 계정을 로그아웃하지 않는다', async ({ page }) => {
  const state = await setup(page)
  const logout = await openNativeAccountMenu(page)
  state.owner = 'session_account_menu_fixture_0002'
  await logout.click()
  await expect(page.getByRole('alert')).toContainText('REQUEST_UNCONFIRMED')
  expect(state.posts).toHaveLength(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))).toBeNull()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
})

test('열린 고객지원은 7언어·짧은 화면에서도 원문과 SVG·같은 초점을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 480 })
  const state = await setup(page), calls = [...state.calls]
  const member = await memberSettings(page)
  const help = await memberHelp(member)
  await help.click()
  const popup = page.locator('.client-modal-help .site-help-pop'), close = popup.locator('.help-close')
  const handle = await popup.elementHandle()
  const shape = await page.locator('.client-modal-help .site-help-trigger svg').innerHTML()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('language', language)
    }, language)
    await expect(popup).toHaveAccessibleName(sourceCopy.I18N['help.title'][language])
    await expect(popup.locator('p').first()).toHaveText(sourceCopy.I18N['help.body'][language])
    await expect(popup.locator('p').last()).toHaveText(sourceCopy.I18N['help.sub'][language])
    await expect(close).toBeFocused()
    expect(await popup.evaluate((node, original) => node === original, handle)).toBe(true)
    expect(await page.locator('.client-modal-help .site-help-trigger svg').innerHTML()).toBe(shape)
    const rect = await popup.boundingBox()
    expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(320)
    expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(480)
    await page.keyboard.press('Shift+Tab')
    await expect(popup.locator('a').last()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
  }
  await close.dispatchEvent('keydown', { key: 'Tab', bubbles: true, isComposing: true })
  await close.dispatchEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true })
  await expect(close).toBeFocused(); await expect(popup).toBeVisible()
  await page.screenshot({ path: info.outputPath('native-help-fr-short.png') })
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(member.getByRole('button', { name: settingsCopy.help.fr, exact: true })).toBeFocused()
  expect(state.calls).toEqual(calls)
})

async function mountAccountBoundary(page: Page, home = false, nativeAccounts = true, signedIn = true) {
  // Pure presentation boundary, separate from the real SDK route tests above.
  await page.route('**/native-account-isolated.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/native-account-isolated.html')
  await page.evaluate(async ({ home, nativeAccounts, signedIn }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const module = await import(/* @vite-ignore */ rp), react = module.default ?? module
    const dom = await import(/* @vite-ignore */ dp), { ClientServiceExperience } = await import(/* @vite-ignore */ cp), h = react.createElement
    function Host() {
      const [state, setState] = react.useState({ phase: 'ready', busy: false, absent: false, inputDisabled: true, sessionState: signedIn ? 'AUTHENTICATED' : 'ANONYMOUS', accountScope: 'account_scope_a' })
      Object.assign(window, { setAccountTestState: (patch: unknown) => setState((previous: object) => ({ ...previous, ...patch as object })) })
      return h(ClientServiceExperience, { nativeAccounts, accountScope: state.accountScope, state: { ...state, source: 'service', input: '', messages: [], quickReplies: [], workflow: home ? null : h('p', null, '표시 경계 시험'), outcome: null, issue: null,
        onInput: () => {}, onSend: () => {}, onReset: () => {}, onLogout: state.absent ? undefined : () => { const target = window as unknown as { accountLogoutCalls: number }; target.accountLogoutCalls++ } } })
    }
    Object.assign(window, { accountLogoutCalls: 0 })
    const mounted = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { unmountAccountBoundary: () => mounted.unmount() })
    mounted.render(h(Host))
  }, { home, nativeAccounts, signedIn })
}

test('홈 템플릿 표시 경계는 일시 권한 미확인에서 보존하고 확인된 다른 owner에게 넘기지 않는다', async ({ page }) => {
  await mountAccountBoundary(page, true)
  const patch = (value: object) => page.evaluate(value => Reflect.get(window, 'setAccountTestState')(value), value)
  await patch({ inputDisabled: false })
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await patch({ phase: 'loading', accountScope: null, sessionState: null })
  await patch({ phase: 'ready', accountScope: 'account_scope_a', sessionState: 'AUTHENTICATED' })
  await expect(page.getByRole('button', { name: 'BTC 선택 해제', exact: true })).toBeVisible()
  await patch({ accountScope: 'account_scope_b' })
  await expect(page.locator('.client-template-selection')).toHaveCount(0)
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await patch({ phase: 'logged-out', accountScope: null, sessionState: null })
  await patch({ phase: 'ready', accountScope: 'account_scope_b', sessionState: 'AUTHENTICATED' })
  await expect(page.locator('.client-template-selection')).toHaveCount(0)
  // Logout is authoritative even if presentation identity arrives one render later.
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await patch({ phase: 'logged-out' })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'logged-out')
  await patch({ phase: 'ready' })
  await expect(page.locator('.client-template-selection')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(0)
})

for (const surface of ['feedback', 'profile', 'history', 'plan'] as const) test(`격리 표시 경계 ${surface}: 계정 ID 교체 때 이전 초안·확인 UI를 넘기지 않는다`, async ({ page }) => {
  // The latest source exposes feedback through the guest menu, not member settings.
  await mountAccountBoundary(page, false, true, surface !== 'feedback')
  let panel
  if (surface === 'profile') { await openNativeAccountMenu(page); panel = page.locator('.stg-confirm') }
  else if (surface === 'history') { await openResearchHistory(page); panel = page.locator('#research-main') }
  else if (surface === 'plan') { panel = await memberSettings(page, 'billing') }
  else {
    await (await settings(page)).getByRole('button', { name: '의견 보내기', exact: true }).click()
    panel = page.locator('.ca-feedback')
    await panel.locator('textarea').fill('계정 A의 미전송 의견')
  }
  await expect(panel).toBeVisible()
  const previous = await panel.elementHandle()
  await page.evaluate(() => Reflect.get(window, 'setAccountTestState')({ accountScope: 'account_scope_a', busy: true }))
  await expect(panel).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'setAccountTestState')({ accountScope: 'account_scope_b', busy: false }))
  if (surface === 'plan') {
    await expect(panel).toBeVisible()
    expect(await previous!.evaluate(node => node.isConnected)).toBe(false)
  } else await expect(panel).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(0)
})

test('피드백 번역 조회가 실패해도 전송 차단은 해제되지 않는다', async ({ page }) => {
  // Presentation fault injection only, not an SDK/authority bypass.
  await page.route('**/src/client-feedback-copy.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export function feedbackText() { return undefined }' }))
  const state = await setup(page, false)
  await (await settings(page)).getByRole('button', { name: '의견 보내기', exact: true }).click()
  const panel = page.locator('.ca-feedback')
  await panel.locator('textarea').fill('문구 사전이 없어도 전송되면 안 됩니다')
  await expect(panel.locator('.fb-send')).toBeDisabled()
  await expect(panel.locator('.fb-unavailable')).toHaveCount(0)
  await expect(panel.locator('.fb-send')).not.toHaveAttribute('aria-describedby', /.+/)
  await panel.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await expect(panel.locator('.fb-done')).toHaveCount(0)
  await expect(panel.locator('textarea')).toHaveValue('문구 사전이 없어도 전송되면 안 됩니다')
  expect(state.posts).toHaveLength(0)
})

for (const home of [true, false]) test(`격리 표시 경계 ${home ? '홈' : '대화'}의 로그아웃 라벨도 7언어에 동기화되며 기존 busy 차단을 보존한다`, async ({ page }) => {
  await mountAccountBoundary(page, home, false)
  const logout = page.locator('.client-service-logout')
  await expect(logout).toHaveCount(1)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      ;(await import(/* @vite-ignore */ path)).setClientPreference('language', language)
    }, language)
    await expect(logout).toHaveText(shellText(language, 'logout'))
  }
  expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'setAccountTestState')({ busy: true }))
  await expect(logout).toBeDisabled()
  await logout.evaluate(node => (node as HTMLButtonElement).click())
  expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'setAccountTestState')({ busy: false }))
  await expect(logout).toBeEnabled()
  await logout.click()
  expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(1)
})

test('기록 화면에서 새 전략을 확정하면 확인 배너를 종료하고 같은 명령을 다시 유도하지 않는다', async ({ page }) => {
  await mountAccountBoundary(page)
  await openResearchHistory(page)
  if (await page.locator('.client-rail-new-row button').isVisible()) await page.locator('.client-rail-new-row button').click()
  else { await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter'); await page.locator('.client-new-strategy').click() }
  await expect(page.getByText('새 전략을 시작하면 현재 화면의 대화는 사라집니다. 서버 작업을 취소하는 동작은 아닙니다.')).toBeVisible()
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('#research-main')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '새 전략 시작', exact: true })).toHaveCount(0)
})
test('연구 기록 중 계정 상태가 바뀌면 기록 화면을 닫고 본문에 복귀한다', async ({ page }) => {
  await mountAccountBoundary(page)
  await openResearchHistory(page)
  await page.evaluate(() => (window as unknown as { setAccountTestState: (patch: unknown) => void }).setAccountTestState({ sessionState: 'ANONYMOUS', phase: 'error' }))
  await expect(page.locator('#research-main')).toHaveCount(0)
  await expect(page.locator('#tesia-main')).toBeFocused()
})
test('홈 도움말을 읽는 동안 서비스 단계가 바뀌면 초점을 새 본문에 인계한다', async ({ page }) => {
  await mountAccountBoundary(page, true)
  const trigger = page.locator('.client-service-app > .site-help .site-help-trigger')
  await trigger.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.site-help-pop .help-close')).toBeFocused()
  await page.evaluate(() => (window as unknown as { setAccountTestState: (patch: object) => void }).setAccountTestState({ phase: 'loading' }))
  await expect(page.locator('.site-help')).toHaveCount(0)
  await expect(page.locator('#tesia-main')).toBeFocused()
  expect(await page.locator('#tesia-main').evaluate(node => !!node.closest('[inert],[hidden]'))).toBe(false)
  expect(await page.evaluate(() => (window as unknown as { accountLogoutCalls: number }).accountLogoutCalls)).toBe(0)
})
test('홈 도움말 이탈 전에 다른 버튼을 선택했다면 서비스 단계 변경이 초점을 빼앗지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mountAccountBoundary(page, true)
  await page.locator('.site-help-trigger').focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.site-help-pop .help-close')).toBeFocused()
  const settings = page.locator('.client-sidebar-bottom [data-sidebar-action="account"]')
  await settings.focus()
  await page.evaluate(() => (window as unknown as { setAccountTestState: (patch: object) => void }).setAccountTestState({ phase: 'loading' }))
  await expect(page.locator('.site-help')).toHaveCount(0)
  await expect(settings).toBeFocused()
})
test('격리 표시 경계: ready·error만 허용하며 busy·onLogout 부재·다른 phase는 강제 조작도 막는다', async ({ page }) => {
  await mountAccountBoundary(page)
  await openNativeAccountMenu(page)
  const panel = page.locator('.client-settings-page')
  const confirm = panel.locator('.stg-confirm')
  const logout = confirm.getByRole('button', { name: '로그아웃', exact: true })
  await expect(logout).toBeEnabled()
  for (const patch of [{ busy: true }, { busy: false, absent: true }, { absent: false, phase: 'logged-out' }]) {
    await page.evaluate(patch => Reflect.get(window, 'setAccountTestState')(patch), patch)
    await expect(logout).toBeDisabled()
    await logout.evaluate(node => (node as HTMLButtonElement).click())
    expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(0)
  }
  await page.evaluate(() => Reflect.get(window, 'setAccountTestState')({ phase: 'loading' }))
  await expect(panel).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'setAccountTestState')({ phase: 'error' }))
  await expect(panel).toBeVisible()
  await expect(confirm).toHaveCount(0)
  await panel.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(logout).toBeEnabled()
  await logout.click()
  expect(await page.evaluate(() => Reflect.get(window, 'accountLogoutCalls'))).toBe(1)
})

for (const width of [320, 1440]) test(`추가 경계 ${width}px: 회원 확인 취소·앱 복귀는 의미에 맞는 초점과 body 스타일을 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 })
  await setup(page)
  await openNativeAccountMenu(page)
  const member = page.locator('.client-settings-page')
  await page.keyboard.press('Escape')
  await expect(member.locator('.stg-confirm')).toHaveCount(0)
  await expect(member.getByRole('button', { name: '로그아웃', exact: true })).toBeFocused()
  await page.evaluate(() => document.body.style.setProperty('overflow', 'scroll', 'important'))
  await selectMemberTab(member, 'general')
  await expect(member.getByRole('combobox')).toBeVisible()
  await closeMemberSettings(member)
  await expect(member).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toBeFocused()
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual(['scroll', 'important'])
})

for (const surface of ['profile', 'settings', 'locale', 'help'] as const) test(`supplied consumer 경계 ${surface}: host unmount 후 기존 inert·overflow 값과 important 우선순위를 복원한다`, async ({ page }) => {
  await mountAccountBoundary(page, false, true, surface !== 'locale')
  await expect(page.locator('.client-service-app')).toBeVisible()
  await page.evaluate(() => {
    document.body.style.setProperty('overflow', 'scroll', 'important')
    const sibling = document.createElement('aside'); sibling.id = 'inert-sentinel'; sibling.inert = true; document.body.append(sibling)
    Object.assign(window, { detachedAccountApp: document.querySelector('.client-service-app') })
  })
  if (surface === 'profile') await openNativeAccountMenu(page)
  else if (surface === 'settings') await memberSettings(page)
  else if (surface === 'help') {
    await (await memberHelp(await memberSettings(page))).click()
    await expect(page.locator('.client-modal-help .help-close')).toBeFocused()
  }
  else await locale(page)
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(surface === 'help' || surface === 'locale' ? 'hidden' : 'scroll')
  await page.evaluate(() => (window as unknown as { unmountAccountBoundary: () => void }).unmountAccountBoundary())
  await expect(page.locator('.client-settings-page, .ca-settings, .ca-profile, .client-locale-panel, .client-modal-help')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { detachedAccountApp: HTMLElement }).detachedAccountApp.inert)).toBe(false)
  expect(await page.locator('#fixture').evaluate(node => (node as HTMLElement).inert)).toBe(false)
  expect(await page.locator('#inert-sentinel').evaluate(node => (node as HTMLElement).inert)).toBe(true)
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual(['scroll', 'important'])
})
for (const width of [320, 1440]) test(`${width === 320 ? 'supplied compatibility beside fresh source' : 'fresh source'} 공개 ${width}px: 언어→닫기는 body 우선순위를 그대로 복원한다`, async ({ page }) => {
  // Shared source host regression only; the public page remains preview UI.
  await page.setViewportSize({ width, height: 960 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await page.evaluate(() => document.body.style.setProperty('overflow', 'scroll', 'important'))
  // Mobile source hides globe; preserve the retained consumer's restoration
  // separately without claiming an unavailable fresh-source entry.
  if (width === 320) await expect(page.locator('.client-globe')).toBeHidden()
  const panel = await locale(page, width === 320 ? 'supplied-compatibility' : 'fresh-home')
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  await expect(panel).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual(['scroll', 'important'])
  expect(await page.locator('.client-source-app').evaluate(node => (node as HTMLElement).inert)).toBe(false)
})
for (const width of [320, 1440]) test(`${width}px 프로필의 실제 로그아웃 버튼 크기·포커스·닫기 위치`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 960 })
  const state = await setup(page)
  const logout = await openNativeAccountMenu(page)
  await logout.focus(); await expect(logout).toBeFocused()
  const box = await logout.boundingBox(); expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(width <= 600 ? 44 : 34)
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath(`native-account-profile-${width}.png`) })
  await page.keyboard.press('Escape'); await expect(page.locator('.stg-confirm')).toHaveCount(0)
  expect(await page.locator('.client-service-app').evaluate(node => (node as HTMLElement).inert)).toBe(false)
  expect(state.posts).toHaveLength(0)
})
test('TURN 응답 미확정 뒤에도 명시 로그아웃은 허용하고 기존 요청 journal을 보존한다', async ({ page }) => {
  const state = await setup(page); state.failTurn = true
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('실패 시 보존할 질문'); await input.press('Enter')
  await expect(page.locator('[data-delivery="uncertain"]')).toBeVisible()
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toBeNull()
  const logout = await openNativeAccountMenu(page)
  await expect(logout).toBeEnabled()
  await logout.click()
  await expect.poll(() => state.posts.filter(path => path.endsWith('/logout')).length).toBe(1)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(journal)
})
for (const width of [320, 1440]) test(`${width}px 서비스 의견 보내기는 원본 폼을 열고 미접수 상태에서 완료를 만들지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 600 })
  const state = await setup(page, false)
  const input = page.locator('.g-composer textarea')
  await input.fill('의견을 남긴 뒤 이어갈 질문')
  const originalInput = await input.elementHandle(), calls = [...state.calls]
  const stored = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  await (await settings(page)).getByRole('button', { name: '의견 보내기', exact: true }).click()
  const panel = page.locator('.ca-feedback')
  await expect(panel).toBeVisible()
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  const text = panel.locator('textarea'), send = panel.locator('.fb-send')
  await expect(text).toBeFocused()
  await text.fill('차트의 체결 구간을 확인하고 싶습니다.')
  await expect(send).toBeDisabled()
  await expect(panel.locator('.fb-unavailable')).toBeVisible()
  await panel.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await expect(text).toHaveValue('차트의 체결 구간을 확인하고 싶습니다.')
  await expect(panel.locator('.fb-done')).toHaveCount(0)
  await expect(panel.locator('.fb-fine a')).toHaveCount(2)
  const bounds = await panel.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
  expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`native-feedback-${width}.png`) })
  await expect(text).toHaveCSS('word-break', 'keep-all')
  await page.setViewportSize({ width, height: 360 })
  await text.scrollIntoViewIfNeeded()
  expect(await panel.locator('.fb-body').evaluate(node => node.clientHeight)).toBeGreaterThan(0)
  const textBounds = await text.boundingBox(), bodyBounds = await panel.locator('.fb-body').boundingBox()
  expect(textBounds!.y).toBeGreaterThanOrEqual(bodyBounds!.y)
  expect(textBounds!.y + textBounds!.height).toBeLessThanOrEqual(bodyBounds!.y + bodyBounds!.height + 1)
  const sendBounds = await send.boundingBox()
  expect(sendBounds!.y).toBeGreaterThanOrEqual(0)
  expect(sendBounds!.y + sendBounds!.height).toBeLessThanOrEqual(361)
  await page.screenshot({ path: info.outputPath(`native-feedback-short-${width}.png`) })
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(input).toHaveValue('의견을 남긴 뒤 이어갈 질문')
  expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true)
  expect(state.calls).toEqual(calls)
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(stored)
  await originalInput?.dispose()
})

for (const width of [320, 1440]) test(`${width}px 피드백의 7언어·첨부 검증·삭제는 원문과 DOM을 유지하고 Blob을 회수한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 600 })
  const state = await setup(page, false)
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    const audit = { created: [] as string[], revoked: [] as string[] }
    Object.assign(window, { feedbackBlobAudit: audit })
    URL.createObjectURL = blob => { const url = create(blob); audit.created.push(url); return url }
    URL.revokeObjectURL = url => { audit.revoked.push(url); revoke(url) }
  })
  const calls = [...state.calls]
  await (await settings(page)).getByRole('button', { name: '의견 보내기', exact: true }).click()
  const panel = page.locator('.ca-feedback'), text = panel.locator('textarea'), file = panel.locator('input[type=file]')
  await text.fill('원문을 번역하거나 지우지 마세요')
  const panelNode = await panel.elementHandle()
  await file.setInputFiles({ name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('fixture') })
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      ;(await import(/* @vite-ignore */ path)).setClientPreference('language', language)
    }, language)
    await expect(panel.getByRole('alert')).toHaveText(feedbackText(language, 'imageOnly'))
    await expect(text).toHaveAttribute('aria-invalid', 'false')
    await expect(panel.locator('.fb-unavailable')).toHaveText(feedbackText(language, 'unavailable'))
    await expect(text).toHaveValue('원문을 번역하거나 지우지 마세요')
    expect(await panel.evaluate((node, original) => node === original, panelNode)).toBe(true)
  }
  await file.setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(panel.getByRole('alert')).toHaveText(feedbackText('fr', 'tooLarge'))
  const image = { name: '원본 차트 이름.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=', 'base64') }
  await file.setInputFiles(image)
  await expect(panel.getByRole('alert')).toHaveCount(0)
  await expect(panel.getByAltText(feedbackText('fr', 'attachmentAlt'))).toBeVisible()
  await expect(panel.locator('.nm')).toContainText(image.name)
  await panel.locator('.rm').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`native-feedback-fr-${width}.png`) })
  await panel.getByRole('button', { name: feedbackText('fr', 'removeAttachment'), exact: true }).click()
  await expect(panel.locator('.fb-attach')).toBeFocused()
  await expect(panel.locator('.fb-prev')).toHaveCount(0)
  await file.setInputFiles(image)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  const audit = await page.evaluate(() => Reflect.get(window, 'feedbackBlobAudit') as { created: string[]; revoked: string[] })
  expect(audit.created).toHaveLength(2)
  expect(audit.revoked).toEqual(audit.created)
  expect(state.calls).toEqual(calls)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('원문을 번역하거나 지우지 마세요')
  await panelNode?.dispose()
})

test('동일 계정의 대화 응답은 열린 피드백 초안을 지우지 않고 소유자 변경은 창을 닫는다', async ({ page }) => {
  const state = await setup(page, false)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  const composer = page.locator('.g-composer textarea')
  await composer.fill('지원 범위를 알려줘'); await composer.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  await (await settings(page)).getByRole('button', { name: '의견 보내기', exact: true }).click()
  const panel = page.locator('.ca-feedback'), text = panel.locator('textarea')
  await text.fill('같은 계정에서 작성 중인 의견')
  const original = await panel.elementHandle()
  release()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect.poll(() => page.locator('[data-delivery="pending"]').count()).toBe(0)
  await expect(text).toHaveValue('같은 계정에서 작성 중인 의견')
  expect(await panel.evaluate((node, previous) => node === previous, original)).toBe(true)
  state.owner = 'session_feedback_changed_0002'
  // Simulate the controller observing a changed session while an overlay is
  // open; this is not a pointer click through the intentionally inert app.
  await page.getByRole('button', { name: '세션 다시 확인', exact: true, includeHidden: true }).evaluate(node => (node as HTMLButtonElement).click())
  await expect(panel).toHaveCount(0)
  expect(state.posts.filter(path => !path.endsWith('/messages'))).toEqual([])
  await original?.dispose()
})

test('supplied compatibility: 언어 저장 실패는 패널을 유지하고 저장되었다고 주장하지 않는다', async ({ page }) => {
  const state = await setup(page, false)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { if (key === 'tethLang') throw new Error('SYNTHETIC_STORAGE_FAILURE'); return original.call(this, key, value) }
  })
  const panel = await locale(page)
  await panel.getByRole('button', { name: 'English', exact: true }).click()
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('status')).toContainText('Settings could not be saved')
  expect(await page.evaluate(() => localStorage.getItem('tethLang'))).not.toBe('en')
  await page.keyboard.press('Escape')
  expect(state.posts).toHaveLength(0)
})

for (const width of [320, 1440]) test(`${width}px 회원 설정 로그아웃은 명시 확인 후 동일 SDK에 한 번 연결된다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 600 })
  const state = await setup(page)
  const panel = await memberSettings(page, 'account')
  const trigger = panel.getByRole('button', { name: '로그아웃', exact: true })
  await trigger.click()
  const confirm = panel.locator('.stg-confirm')
  await expect(confirm.getByRole('button', { name: settingsCopy.cancel.ko, exact: true })).toBeFocused()
  expect(state.posts).toHaveLength(0)
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  const logout = confirm.getByRole('button', { name: '로그아웃', exact: true })
  await logout.scrollIntoViewIfNeeded()
  await expect(logout).toBeInViewport()
  await page.screenshot({ path: info.outputPath(`settings-logout-${width}.png`) })
  // Same-tick repeated dispatch must still be deduplicated by the controller.
  await logout.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect(panel).toHaveCount(0)
  await expect.poll(() => state.posts.filter(path => path.endsWith('/logout')).length).toBe(1)
  expect(state.posts).toEqual(['/api/v1/auth/logout'])
})

test('익명 설정에는 로그아웃을 노출하지 않는다', async ({ page }) => {
  const state = await setup(page, false)
  await settings(page)
  await expect(page.locator('[data-account-action="logout"]')).toHaveCount(0)
  expect(state.posts).toHaveLength(0)
})

test('회원 설정 로그아웃도 진행 중 요청을 취소하거나 중복 인증 변경을 보내지 않는다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  const input = page.locator('.g-composer textarea')
  await input.fill('지원 범위를 알려줘'); await input.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  const panel = await memberSettings(page, 'account')
  const logout = panel.getByRole('button', { name: '로그아웃', exact: true })
  await expect(logout).toBeDisabled()
  await logout.evaluate(node => (node as HTMLButtonElement).click())
  // Dispatching keys tests the disabled element itself, not whatever happens
  // to own focus after a failed attempt to focus a native disabled button.
  for (const key of ['Enter', ' ', 'Enter']) await logout.dispatchEvent('keydown', { key, bubbles: true })
  await expect(panel.locator('.stg-confirm')).toHaveCount(0)
  expect(state.posts.some(path => path.endsWith('/logout'))).toBe(false)
  release()
  await expect(logout).toBeEnabled()
  await logout.click()
  await panel.locator('.stg-confirm').getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect.poll(() => state.posts.filter(path => path.endsWith('/logout')).length).toBe(1)
})

for (const width of [320, 1440]) test(`${width}px 회원 설정 계정의 열린 라벨도 7언어 변경을 따르고 대화와 요청을 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  const input = page.locator('.g-composer textarea')
  await input.fill('아직 보내지 않은 조건')
  const inputNode = await input.elementHandle(), initialCalls = [...state.calls]
  const initialStorage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  const panel = await memberSettings(page, 'account')
  const panelNode = await panel.elementHandle()
  const logout = panel.locator('.stg-main button').filter({ hasText: /^로그아웃$/ })
  const logoutNode = await logout.elementHandle()
  await logout.focus()
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      ;(await import(/* @vite-ignore */ path)).setClientPreference('language', language)
    }, code)
    const translated = panel.getByRole('button', { name: settingsCopy.logout[code], exact: true })
    await expect(panel.locator('h1')).toHaveText(settingsCopy.account[code])
    await expect(translated).toBeEnabled()
    await expect(translated).toBeFocused()
    expect(await translated.evaluate((node, original) => node === original, logoutNode)).toBe(true)
    expect(await panel.evaluate((node, original) => node === original, panelNode)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await closeMemberSettings(panel)
  await expect(panel).toHaveCount(0)
  await expect(input).toHaveValue('아직 보내지 않은 조건')
  expect(await input.evaluate((node, original) => node === original, inputNode)).toBe(true)
  expect(state.calls).toEqual(initialCalls)
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(initialStorage)
  await inputNode?.dispose(); await panelNode?.dispose(); await logoutNode?.dispose()
})

for (const width of [320, 1440]) for (const [code, label] of [['ko', '한국어'], ['en', 'English'], ['ja', '日本語'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['es', 'Español'], ['fr', 'Français']]) {
  test(`supplied compatibility ${width}px ${code}: 원본 언어 패널은 하나이며 선택·초점·viewport를 보존한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 })
    const state = await setup(page, false)
    const panel = await locale(page)
    await panel.getByRole('button', { name: label, exact: true }).click()
    await expect(panel).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe(code)
    await locale(page)
    await expect(panel.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Tab')
    expect(await panel.evaluate(node => node.contains(document.activeElement))).toBe(true)
    const bounds = await panel.boundingBox(); expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(961)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => document.fonts.ready)
    if (code === 'ko' || code === 'fr') await page.screenshot({ path: testInfo.outputPath(`native-account-locale-${code}-${width}.png`) })
    await page.keyboard.press('Escape'); await settings(page)
    if (code === 'ko' || code === 'fr') await page.screenshot({ path: testInfo.outputPath(`native-account-settings-${code}-${width}.png`) })
    expect(state.posts).toHaveLength(0)
  })
}
test('진행 중 메뉴를 열어도 응답은 완료되고 잠긴 로그아웃 강제 클릭은 POST하지 않는다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  state.holdTurn = () => new Promise<void>(resolve => { release = resolve })
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('지원 범위를 알려줘'); await input.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  const logout = await openNativeAccountMenu(page)
  await expect(logout).toBeDisabled()
  await logout.evaluate(node => (node as HTMLButtonElement).click())
  await expect(page.locator('.stg-confirm')).toHaveCount(0)
  expect(state.posts.some(path => path.endsWith('/logout'))).toBe(false)
  release()
  await expect(logout).toBeEnabled()
  await closeMemberSettings(page.locator('.client-settings-page'))
  await dismissObservedClarification(page)
  await expect(input).toBeFocused()
  await expect(input).toBeEnabled()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  expect(state.posts).toHaveLength(1)
})
test('설정의 원본 정책 링크는 native URL·입력·초안을 보존하고 외부 페이지로 나가지 않는다', async ({ page }) => {
  const state = await setup(page, false), url = page.url()
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('보존할 미전송 조건')
  const menu = await settings(page)
  await menu.locator('[aria-controls="ca-sub-help"]').click()
  await menu.locator('a[href="/policies/#terms"]').click()
  await expect(menu).toHaveCount(0)
  expect(page.url()).toBe(url)
  await expect(input).toHaveValue('보존할 미전송 조건')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  expect(state.posts).toHaveLength(0)
})
