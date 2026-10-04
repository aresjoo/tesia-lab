import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
const ready = fixture.snapshots.ready
const owner = 'session_insight_navigation_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_insight_navigation_fixture_0001', traceId: 'trace_insight_navigation_fixture_0001' })
const composer = (page: Page) => page.locator('.g-composer textarea')
// The source footer makes the outer document shell the scroll owner.
const scrollport = (page: Page) => page.locator('.client-service-app.has-site-footer')
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
async function menu(page: Page, name: string | RegExp) {
  if (name === '인사이트') { await (await sourceInsightEntry(page)).click(); return }
  const button = page.locator('.client-sidebar').getByRole('button', { name, exact: true })
  if (!await button.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await button.click()
}
async function marketOptions(page: Page, label: '시장' | 'Market') {
  // Source mobile markets use a body-level modal sheet, not a hub descendant.
  // Keep the desktop inline boundary and require the actual named listbox.
  const narrow = await page.evaluate(() => matchMedia('(max-width: 760px)').matches)
  const surface = narrow ? page.getByRole('dialog') : page.locator('.native-strategies')
  const options = surface.getByRole('listbox', { name: label, exact: true })
  await expect(options).toBeVisible()
  return options
}

test('거래소 목록·상세·리뷰는 원본 구조와 초안을 보존하고 가상 실적을 표시하지 않는다', async ({ page }, info) => {
  const requests = await setup(page), initial = [...requests]
  await composer(page).fill('돌아와서 이어 쓸 초안')
  await page.evaluate(() => Reflect.set(window,'originalComposer',document.querySelector('.g-composer textarea')))
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  const hub = page.locator('.native-brokers')
  await expect(hub.getByRole('heading',{level:1})).toBeFocused()
  await expect(hub.locator('.bk2-card')).toHaveCount(21)
  await expect(hub.locator('.bk2-card .bt .wbtn')).toHaveCount(21)
  await expect(hub.locator('.bk2-meta .rt, .pr')).toHaveCount(0)
  await expect(hub.locator('.bk2-card').first()).toContainText('상태 미확인')
  await hub.getByRole('button',{name:'Binance 자세히',exact:true}).click()
  await expect(hub.locator('.bk2-head h2')).toHaveText('Binance')
  await expect(hub.locator('.bk2-promo, .bk2-rvc')).toHaveCount(0)
  await hub.getByRole('button',{name:'TETH로 연결',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('연결이나 결제는 실행되지 않았어요.')
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click()
  await hub.getByRole('tab',{name:'리뷰',exact:true}).click()
  await expect(hub.getByRole('button',{name:'리뷰 남기기',exact:true})).toBeDisabled()
  await expect(hub.locator('.bk2-empty')).toHaveText('리뷰 데이터가 아직 제공되지 않았습니다.')
  await expect(hub.locator('.bk2-dist .n')).toHaveText(['—','—','—','—','—'])
  await hub.locator('.bk2-empty').scrollIntoViewIfNeeded()
  await expect(hub.locator('.bk2-empty')).toBeInViewport()
  await page.screenshot({path:info.outputPath('broker-service.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await hub.getByRole('button',{name:'대화로 돌아가기',exact:true}).click()
  await expect(composer(page)).toHaveValue('돌아와서 이어 쓸 초안')
  await expect(composer(page)).toBeFocused()
  expect(await page.evaluate(()=>Reflect.get(window,'originalComposer')===document.querySelector('.g-composer textarea'))).toBe(true)
  expect(requests).toEqual(initial)
})
test('전략 시장·판단 방식의 표시 언어만 바뀌고 검색과 선택 값은 유지된다', async ({ page }) => {
  const requests = await setup(page), initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  const hub = page.locator('.native-strategies')
  await hub.getByRole('searchbox').fill('ETH')
  await hub.getByRole('button', { name: /^시장:/ }).click()
  await (await marketOptions(page, '시장')).getByRole('option', { name: '가상자산', exact: true }).click()
  await hub.getByRole('group', { name: '판단 방식', exact: true }).getByRole('button', { name: 'AI 판단', exact: true }).click()
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'en')
  })
  await expect(hub.getByRole('button', { name: /^Market:/ })).toContainText('Crypto')
  await expect(hub.getByRole('group', { name: 'Decision method', exact: true }).getByRole('button', { name: 'AI decision', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(hub.getByRole('searchbox')).toHaveValue('ETH')
  await hub.getByRole('button', { name: /^Market:/ }).click()
  await expect((await marketOptions(page, 'Market')).getByRole('option', { name: 'Crypto', exact: true })).toHaveAttribute('aria-selected', 'true')
  expect(requests).toEqual(initial)
})

test('거래소 상세에서 메뉴를 다시 누르면 목록으로 돌아가며 새 전략 취소는 초안을 유지한다', async ({ page }) => {
  const requests = await setup(page), initial = [...requests]
  await composer(page).fill('목록과 새 전략을 왕복해도 보존')
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  await page.locator('.native-brokers').getByRole('button', { name: 'Binance 자세히', exact: true }).click()
  await page.locator('.native-brokers .bk2-faq').scrollIntoViewIfNeeded()
  expect(await scrollport(page).evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  await expect(page.locator('.native-brokers .bk2-card')).toHaveCount(21)
  await expect(page.locator('.native-brokers .hub-header h1')).toHaveText('지원 거래소')
  await expect(page.locator('.native-brokers .hub-header h1')).toBeFocused()
  await expect.poll(() => scrollport(page).evaluate(el => el.scrollTop)).toBe(0)
  await menu(page, /^(?:＋ )?새 전략$/)
  await page.locator('.client-global-notice').getByRole('button').last().click()
  await expect(page.locator('.native-brokers')).toBeVisible()
  await expect(composer(page)).toHaveValue('목록과 새 전략을 왕복해도 보존')
  await menu(page, /^(?:＋ )?새 전략$/)
  await page.locator('.client-global-notice').getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('.native-brokers')).toHaveCount(0)
  await expect(page.locator('.landing-hero textarea')).toHaveValue('')
  // Explicit reset rechecks the session; it must not create/send a conversation.
  expect(requests.slice(initial.length).every(request => request === 'GET /api/v1/auth/session')).toBe(true)
  expect(requests.filter(request => request.startsWith('POST'))).toEqual([])
})

test('거래소 지연 로딩 완료는 사용자가 옮긴 키보드 초점을 빼앗지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/internal-poc/NativeBrokers.tsx*', async route => { await gate; await route.continue() })
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  try {
    await expect(page.locator('.site-page-loading')).toBeVisible()
    await page.locator('.site-page-loading').press('Shift+Tab')
    const target = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
    await target.focus()
    release()
    await expect(page.locator('.native-brokers')).toBeAttached()
    await expect(target).toBeFocused()
  } finally { release() }
})

test('거래소 청크 실패에서 복귀해도 같은 대화 입력을 유지한다', async ({ page }) => {
  const requests = await setup(page), initial = [...requests]
  await composer(page).fill('거래소 청크 실패에도 유지')
  await page.route('**/src/internal-poc/NativeBrokers.tsx*', route => route.abort('failed'))
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  await expect(page.locator('.site-page-recovery')).toBeVisible()
  await page.locator('.site-page-recovery').getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(composer(page)).toHaveValue('거래소 청크 실패에도 유지')
  await expect(composer(page)).toBeFocused()
  expect(requests).toEqual(initial)
})
test('원본 지원 플래그와 무관하게 상세는 미확인 상태이며 목록 스크롤을 복원한다', async ({ page }) => {
  const requests = await setup(page), initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  const hub = page.locator('.native-brokers')
  for (const name of ['Binance', '업비트']) {
    await hub.getByRole('button', { name: `${name} 자세히`, exact: true }).click()
    await expect(hub.locator('.bk2-head')).toContainText('상태 미확인')
    await expect(hub.locator('.bk2-head')).not.toContainText('연결됨')
    await hub.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('연결이나 결제는 실행되지 않았어요.')
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
    await hub.locator('.bk2-bc button').click()
  }
  const last = hub.locator('.bk2-card').last()
  await last.scrollIntoViewIfNeeded()
  const before = await scrollport(page).evaluate(el => el.scrollTop)
  expect(before).toBeGreaterThan(0)
  const id = await last.locator('.nm').getAttribute('id')
  await last.locator('.obtn').click()
  await expect(hub.locator('.bk2-head h2')).toBeFocused()
  await hub.locator('.bk2-bc button').click()
  await expect(hub.locator(`#${id}`)).toBeFocused()
  await expect.poll(() => scrollport(page).evaluate(el => el.scrollTop)).toBeCloseTo(before, 0)
  expect(requests).toEqual(initial)
})
test('푸터가 있는 거래소의 모바일 정렬 시트는 실제 스크롤을 잠그고 원래 위치를 복구한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  const requests = await setup(page), initial = [...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  const sort = page.getByRole('button', { name: /^거래소 정렬:/ })
  await sort.scrollIntoViewIfNeeded()
  const before = await scrollport(page).evaluate(el => el.scrollTop)
  await sort.click()
  await expect(scrollport(page)).toHaveCSS('overflow-y', 'hidden')
  await page.keyboard.press('Escape')
  await expect(scrollport(page)).toHaveCSS('overflow-y', 'auto')
  await expect(sort).toBeFocused()
  await expect.poll(() => scrollport(page).evaluate(el => el.scrollTop)).toBeCloseTo(before, 0)
  expect(requests).toEqual(initial)
})

test('전략들 검색·정렬·시장 필터는 원본과 같은 조작을 유지한다',async({page},info)=>{
  const requests=await setup(page), initial=[...requests]
  await menu(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  const hub=page.locator('.native-strategies')
  await expect(hub.locator('.client-sharing-counter')).toHaveCount(0)
  await hub.getByRole('searchbox',{name:'전략 검색'}).fill('ETH')
  await expect(hub.getByRole('combobox',{name:'정렬 기준',exact:true}).locator('option[value=ret]')).toHaveAttribute('disabled', '')
  await hub.getByRole('button',{name:/^시장:/}).click()
  await (await marketOptions(page, '시장')).getByRole('option',{name:'가상자산',exact:true}).click()
  await expect(hub.locator('[data-public-catalogue]')).toBeVisible()
  await expect(hub.locator('.tfbk-card').first()).toBeVisible()
  await expect(hub.locator('canvas')).toHaveCount(0)
  await expect(hub.getByRole('searchbox')).toHaveValue('ETH')
  await expect(hub.getByRole('button',{name:/^시장:/})).toContainText('가상자산')
  await expect(hub.getByRole('combobox',{name:'정렬 기준',exact:true})).toHaveValue('pick')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await page.screenshot({path:info.outputPath('strategies-service.png'),fullPage:true})
  expect(requests).toEqual(initial)
})
test('거래소·인사이트·기록 사이 이동 시 대화는 보존하고 한 화면만 표시한다',async({page})=>{
  await setup(page)
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  await menu(page,'인사이트')
  await expect(page.locator('.native-brokers')).toHaveCount(0)
  await expect(page.locator('.nfz-top3 > div')).toHaveCount(3)
  await expect(page.locator('.nfz-rail')).toBeVisible()
  await expect(page.locator('.nfz-card,time')).toHaveCount(0)
  await menu(page, sourceSidebarNavigationLabel('ko', 'brokers'))
  await menu(page,'연구 기록')
  await expect(page.locator('.native-brokers')).toHaveCount(0)
  await expect(page.locator('#research-main')).toHaveCount(1)
})
