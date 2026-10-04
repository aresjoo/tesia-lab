import { expect, test, type Page } from '@playwright/test'

const owner = 'sidebar-source@example.test'
const sourceSession = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `원문 ${id}`, renamed: true, idea: '원래 질문', draft: `${id} 미전송 초안`, pair: 'BTC/USDT', mode: 'trend', phase: 'plan', timeframe: '일봉', risk: '-3%', researchStatus: '초안', workspace: 'conversation', tradingReady: false, turns: [], updatedAt: 1, ...extra })
async function drawer(page: Page) {
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
}

async function openMain(page: Page, sessions: Record<string, unknown>[] = [], signedIn = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ sessions, owner, signedIn }) => {
    localStorage.setItem('tethLang', 'ko')
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '메뉴 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '홈의 원문 초안', sessions }))
    // Live classification is registration-backed; a legacy session.paper flag
    // is not execution evidence. Keep these layout fixtures explicitly registered.
    const paperSessions = sessions.filter(session => session.paper === true)
    if (paperSessions.length) sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify(paperSessions.map((session, index) => ({ sessionId: session.id, record: {
      id: String(2000 + index), name: session.title, createdAt: 2000 + index,
      status: 'live', environment: 'paper', origin: 'research', parameters: null,
      score: 81, ret: 7, mdd: -4, n: 23, winRate: 61,
    } }))))
  }, { sessions, owner, signedIn })
  await page.goto('/')
  await drawer(page)
  await expect(page.locator('.client-sidebar')).toBeVisible()
}

test('원본 메인 메뉴는 연구 기록·AI 트레이딩·전략 복사·거래소 연결 순서다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openMain(page)
  const menu = page.locator('.client-sidebar')
  const labels = await menu.locator('.client-util').evaluateAll(nodes => nodes.filter(node => (node as HTMLElement).offsetWidth > 0).map(node => node.getAttribute('aria-label') || node.textContent?.trim()))
  expect(labels).toEqual(['연구 기록', 'AI 트레이딩', '전략 복사', '거래소 연결'])
  for (const name of ['예약된 검증', '랭킹', '전략 공유']) await expect(menu.getByRole('button', { name, exact: true })).toHaveCount(0)
  const paths = await menu.getByRole('button', { name: '전략 복사', exact: true }).locator('svg path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))
  expect(paths).toEqual(['M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8-.7-.7-2-.8-3-.2z', 'M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 21.5 2c0 2.7-.9 7.5-6 10.6a22.4 22.4 0 0 1-3.5 2.4z', 'M9 12H4s.5-3.6 2-5c1.6-1.5 5 0 5 0', 'M12 15v5s3.6-.5 5-2c1.5-1.6 0-5 0-5'])
})

for (const width of [320, 1440]) test(`${width}px최근·Live그룹은고정순서와원문·Paper표시및대화왕복을보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 640 })
  await openMain(page, [sourceSession('recent', { updatedAt: 90 }), sourceSession('pinned', { pinned: true }), sourceSession('paper-one', { paper: true }), sourceSession('paper-two', { paper: true, pinned: true })])
  const recent = page.locator('[data-sidebar-group="recent"]'), live = page.locator('[data-sidebar-group="live"]')
  await expect(recent.getByRole('heading', { name: '최근', exact: true })).toBeVisible()
  await expect(recent.locator('.client-session > span')).toHaveText(['원문 pinned', '원문 recent'])
  await expect(live.locator('.client-session > span')).toHaveText(['원문 paper-one', '원문 paper-two'])
  await expect(live.locator('.client-session-badge')).toHaveText(['Paper', 'Paper'])
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath(`sidebar-groups-${width}.png`) })
  const row = recent.getByRole('button', { name: /원문 recent 초안/ })
  await row.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue('recent 미전송 초안')
  await drawer(page)
  await expect(recent.locator('.client-session[aria-current="true"]')).toContainText('원문 recent')
  await page.getByRole('button', { name: '전략 복사', exact: true }).click()
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
  // The source catalogue has no extra visual route toolbar. The retained
  // accessible return action is exposed on focus, like a skip link.
  const back = page.getByRole('button', { name: '대화로 돌아가기', exact: true })
  await back.focus()
  await expect(back).toBeInViewport()
  expect(await back.evaluate(element => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return hit === element || element.contains(hit)
  })).toBe(true)
  await back.press('Enter')
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue('recent 미전송 초안')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
})

test('최근빈상태는원문을표시하고Live가없으면빈Live그룹을만들지않는다', async ({ page }) => {
  await openMain(page)
  await expect(page.locator('[data-sidebar-group="recent"]')).toContainText('아직 없음')
  await expect(page.locator('[data-sidebar-group="live"]')).toHaveCount(0)
})

for (const height of [480, 640, 900]) test(`320x${height}긴목록은높이에맞는단일스크롤로마지막행과계정에접근한다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height })
  const sessions = [...Array.from({ length: 24 }, (_, index) => sourceSession(`row-${index}`, { updatedAt: 100 - index })), sourceSession('last-paper', { paper: true })]
  await openMain(page, sessions)
  const list = page.locator(height <= 640 ? '.client-research-navigation' : '.client-sidebar-records')
  await page.evaluate(() => document.fonts.ready)
  const layout = await list.evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight, groups: [...el.querySelectorAll('ul')].map(node => ({ overflow: getComputedStyle(node).overflowY, range: node.scrollHeight - node.clientHeight })) }))
  expect(layout.scroll).toBeGreaterThan(layout.client)
  expect(layout.groups).toEqual([{ overflow: 'visible', range: 0 }, { overflow: 'visible', range: 0 }])
  if (height <= 640) expect(await page.locator('.client-sidebar-records').evaluate(el => getComputedStyle(el).overflowY)).toBe('visible')
  const nav = await page.locator('.client-research-navigation').boundingBox(), links = await page.locator('.client-drawer-links').boundingBox(), account = await page.locator('.client-sidebar-bottom').boundingBox()
  expect(nav!.y + nav!.height).toBeLessThanOrEqual(links!.y + 1)
  expect(links!.y + links!.height).toBeLessThanOrEqual(account!.y + 1)
  expect(account!.y + account!.height).toBeLessThanOrEqual(height)
  const last = page.locator('[data-sidebar-group="live"] .client-session')
  await last.scrollIntoViewIfNeeded(); await last.focus()
  const bounds = await last.boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(nav!.y); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y + nav!.height + 1)
  expect(await last.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
  await page.screenshot({ path: info.outputPath(`sidebar-long-list-320x${height}.png`) })
  await page.keyboard.press('Enter')
  await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  await drawer(page)
  const settings = page.locator('[data-sidebar-action="profile-settings"]')
  await settings.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('등록Live분류는현재owner기록만소비하고공개badge는실환경값과무관하게Paper다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(owner => {
    const record = { id: '1900', name: '본인 등록 원문', createdAt: 1900, status: 'live', environment: 'live', parameters: null, score: 81, ret: 7, mdd: -4, n: 23, winRate: 61 }
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify([{ sessionId: 'own-registration', record }]))
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent('other@example.test')}`, JSON.stringify([{ sessionId: 'foreign-registration', record: { ...record, id: '1901', createdAt: 1901 } }]))
  }, owner)
  await openMain(page, [sourceSession('own-registration'), sourceSession('foreign-registration')])
  const live = page.locator('[data-sidebar-group="live"]')
  await expect(live.locator('.client-session > span')).toHaveText(['원문 own-registration'])
  await expect(live.locator('.client-session-badge')).toHaveText('Paper')
  await expect(page.locator('[data-sidebar-group="recent"] .client-session > span')).toHaveText(['원문 foreign-registration'])
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-user-strategies:'))))
  await live.locator('.client-session').click()
  await expect(page).toHaveURL(/#\/trade\/bot\/1900$/)
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-user-strategies:'))))).toEqual(before)
})

test('행이름수정은최근입력순서를바꾸지않고고정·삭제는명시행에만적용된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openMain(page, [sourceSession('first', { updatedAt: 1 }), sourceSession('second', { updatedAt: 90 }), sourceSession('paper', { paper: true })])
  const recent = page.locator('[data-sidebar-group="recent"]')
  await expect(recent.locator('.client-session > span')).toHaveText(['원문 first', '원문 second'])
  await page.getByRole('button', { name: '원문 first 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  await page.getByRole('textbox', { name: '연구 이름', exact: true }).fill('바꾼 원문 제목')
  await page.getByRole('dialog').getByRole('button', { name: '이름 변경', exact: true }).click()
  await expect(recent.locator('.client-session > span')).toHaveText(['바꾼 원문 제목', '원문 second'])
  await page.getByRole('button', { name: '원문 second 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '고정', exact: true }).click()
  await expect(recent.locator('.client-session > span')).toHaveText(['원문 second', '바꾼 원문 제목'])
  await page.getByRole('button', { name: '원문 paper 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByRole('button', { name: '원문 paper 관리', exact: true })).toBeFocused()
  await page.getByRole('button', { name: '원문 paper 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.locator('[data-sidebar-group="live"]')).toHaveCount(0)
  await expect(recent.locator('.client-session')).toHaveCount(2)
})

test('원본메뉴키보드순서는마우스순서와동일하고선택후현재대화초안은유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await openMain(page)
  const nav = page.locator('.client-research-navigation > nav')
  const labels = ['연구 기록', 'AI 트레이딩', '전략 복사', '거래소 연결']
  await nav.getByRole('button', { name: labels[0], exact: true }).focus()
  for (const label of labels) {
    await expect(nav.getByRole('button', { name: label, exact: true })).toBeFocused()
    if (label !== labels.at(-1)) await page.keyboard.press('Tab')
  }
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('connection-plan')).toHaveAttribute('data-step', 'plan')
  await expect(page.getByTestId('connection-plan').getByRole('heading', { level: 1 })).toHaveText('거래소 연결')
  await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).homeDraft)).toBe('홈의 원문 초안')
})

test('모바일프로필은하단가용폭을사용하고짧은원문이름을자르지않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 480 })
  await openMain(page)
  await page.evaluate(() => document.fonts.ready)
  const profile = page.locator('[data-sidebar-action="profile-settings"]')
  await page.screenshot({ path: info.outputPath('sidebar-mobile-profile.png') })
  const geometry = await profile.evaluate(el => {
    const parent = el.parentElement!, p = getComputedStyle(parent), name = el.querySelector('span')!
    return { width: el.getBoundingClientRect().width, available: parent.clientWidth - parseFloat(p.paddingLeft) - parseFloat(p.paddingRight), textScroll: name.scrollWidth, textClient: name.clientWidth }
  })
  expect(geometry.width).toBeGreaterThanOrEqual(geometry.available - 1)
  expect(geometry.textScroll).toBeLessThanOrEqual(geometry.textClient)
})

test('메인전략복사·최근·빈상태는7언어에반응하고사용자제목과Paper출처는그대로다', async ({ page }) => {
  await openMain(page, [sourceSession('사용자 제목 原文', { paper: true })])
  // Fixed source-copy oracle, independent of the product's translation lookup.
  const copies = [
    ['ko', '전략 복사', '최근', '아직 없음'],
    ['en', 'Copy strategies', 'Recent', 'Nothing yet'],
    ['ja', '戦略コピー', '最近', 'まだありません'],
    ['zh-CN', '复制策略', '最近', '暂无'],
    ['zh-TW', '複製策略', '最近', '尚無'],
    ['es', 'Copiar estrategias', 'Recientes', 'Aún no hay nada'],
    ['fr', 'Copier des stratégies', 'Récents', 'Rien pour le moment'],
  ]
  for (const [language, strategies, recent, empty] of copies) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('language', language)
    }, language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('.client-research-navigation > nav').getByRole('button', { name: strategies, exact: true })).toBeVisible()
    await expect(page.locator('[data-sidebar-group="recent"] h2')).toHaveText(recent)
    await expect(page.locator('.client-sidebar-record-empty')).toHaveText(empty)
    await expect(page.locator('[data-sidebar-group="live"] .client-session > span')).toHaveText('원문 사용자 제목 原文')
    await expect(page.locator('.client-session-badge')).toHaveText('Paper')
  }
})

// Frozen9fb source5180–5183 has four member utilities;1515–1516
// exposes only trading/sharing for guests. applyLang26591–26604 does not
// insert insight; source5265/10677 keep it inside the settings menu.
for (const width of [320, 1440]) for (const signedIn of [false, true]) test(`${width}px ${signedIn ? '회원' : '게스트'} 원본메뉴순서와설정인사이트키보드이동은초안을보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 640 })
  await openMain(page, [], signedIn)
  const sidebar = page.locator('.client-sidebar')
  const expected = signedIn ? ['연구 기록', 'AI 트레이딩', '전략 복사', '거래소 연결'] : ['AI 트레이딩', '전략 복사']
  const utilities = sidebar.locator('.client-util')
  expect(await utilities.evaluateAll(nodes => nodes.filter(node => (node as HTMLElement).offsetWidth > 0).map(node => node.getAttribute('aria-label')))).toEqual(expected)
  await expect(sidebar.getByRole('button', { name: '인사이트', exact: true })).toHaveCount(0)
  await sidebar.getByRole('button', { name: expected[0], exact: true }).focus()
  for (const label of expected) {
    await expect(sidebar.getByRole('button', { name: label, exact: true })).toBeFocused()
    if (label !== expected.at(-1)) await page.keyboard.press('Tab')
  }
  const settings = sidebar.locator(`[data-sidebar-action="${signedIn ? 'profile-settings' : 'settings'}"]`)
  await settings.focus(); await page.keyboard.press('Enter')
  const insight = page.locator('.ca-menu-layer[data-surface-active="true"] [data-menu-action="insight"]')
  await expect(insight).toBeVisible()
  await insight.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/insight$/)
  await expect(page.locator('.client-insights')).toBeVisible()
  await expect(page.locator('.ca-menu-layer')).toHaveCount(0)
  await expect(sidebar).not.toHaveClass(/mobile-open/)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).homeDraft)).toBe('홈의 원문 초안')
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요', exact: true })).toHaveValue('홈의 원문 초안')
})
