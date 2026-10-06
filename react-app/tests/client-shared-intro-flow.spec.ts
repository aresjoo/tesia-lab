import { expect, test, type Locator, type Page } from '@playwright/test'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'

const owner = 'intro-a@example.test', otherOwner = 'intro-b@example.test'
const row = sourceSharedStrategies().find(item => item.asset === '이더리움')!
const target = sharedHash({ nick: row.nick, period: 'all' })
const heading = '이 전략을 따라하려면 연결이 필요해요'
const previous = { id: 'intro-original-chat', title: '보존할 대화', renamed: true, idea: '원래 질문', draft: '원래 대화의 미전송 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], updatedAt: 1 }
const homeDraft = '보존할 홈 초안'
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function setup(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, previous, homeDraft }) => {
    if (sessionStorage.getItem('intro-fixture-initialized')) return
    sessionStorage.setItem('intro-fixture-initialized', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연결 안내 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: previous.id, homeDraft, sessions: [previous], sharedFollows: [] }))
  }, { owner, previous, homeDraft })
}

async function experience(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
}

async function unchanged(page: Page, expected?: unknown) {
  const value = await experience(page)
  if (expected && typeof expected === 'object' && 'sessions' in expected && Array.isArray(expected.sessions)) {
    // BF699 preserves absent optional fields; comparing the exact snapshot also
    // rejects fabricated empty results. Keep the separate no-write assertions.
    expect(value).toEqual(expected)
  }
  else {
    // Conversation scroll restoration can persist after a route visit. It is
    // display metadata, not a strategy mutation; keep all other fields exact.
    expect(value.sessions).toHaveLength(1)
    const { conversationViewport, ...session } = value.sessions[0]
    if (conversationViewport !== undefined) expect(conversationViewport).toEqual({ follow: true, questionKey: '', spacer: 0, top: 0 })
    expect(session).toEqual(previous)
    expect(value.sharedFollows).toEqual([])
    expect(value.currentId).toBe(previous.id)
    expect(value.homeDraft).toBe(homeDraft)
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth:client-delegation:')))).toEqual([])
  }
}

async function navigate(page: Page, hash: string) {
  await page.evaluate(hash => { location.hash = hash }, hash)
}

async function enter(page: Page) {
  await page.goto(`/${target}`)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  const gate = page.getByRole('dialog', { name: heading, exact: true })
  await expect(gate).toBeVisible()
  return gate
}

async function reachable(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded()
  const box = await control.boundingBox(), viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse), (max-width: 640px)').matches)
  // Fine-pointer text retains its typography with a transparent minimum hitbox.
  if (touch) expect(box!.height).toBeGreaterThanOrEqual(44)
  else expect(box!.height).toBeGreaterThanOrEqual(24)
  expect(await control.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit) })).toBe(true)
}

test('첫 따라하기 안내와 나중에 하기는 저장하지 않고 같은 전략의 명시 복제로만 이어진다', async ({ page }) => {
  await setup(page)
  const gate = await enter(page)
  await expect(gate).toContainText(`${row.nick}`)
  await expect(gate.getByRole('button', { name: '무료로 연동하기', exact: true })).toBeDisabled()
  await expect(gate).toContainText('UID 연동 기능을 준비 중이에요.')
  await unchanged(page)
  const writes: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url()) })
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Object.assign(window, { introWrites: [] })
    Storage.prototype.setItem = function (key, value) { Reflect.get(window, 'introWrites').push(key); return set.call(this, key, value) }
  })
  await gate.getByRole('button', { name: '무료로 연동하기', exact: true }).evaluate(el => (el as HTMLButtonElement).click())
  await expect(gate).toBeVisible()
  await gate.getByRole('button', { name: '나중에 하기', exact: true }).click()
  const copy = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(gate).toHaveCount(0)
  await expect(copy).toContainText(row.nick)
  await expect(copy.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue(String(row.parameters.sl))
  await unchanged(page)
  expect(await page.evaluate(() => Reflect.get(window, 'introWrites'))).toEqual([])
  await copy.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await unchanged(page)
  expect(await page.evaluate(() => Reflect.get(window, 'introWrites'))).toEqual([])
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.locator('.client-delegation .tfw')).toBeVisible()
  const saved = await experience(page)
  expect(saved.sessions).toHaveLength(2)
  expect(saved.sessions.find((item: { id: string }) => item.id === previous.id)).toEqual(previous)
  expect(saved.sharedFollows).toHaveLength(1)
  expect(saved.sharedFollows[0]).toMatchObject({ owner, nick: row.nick, parameters: row.parameters })
  expect(saved.homeDraft).toBe(homeDraft)
  expect(writes).toEqual([])
})

for (const method of ['닫기', 'Escape']) test(`${method}는 연결 안내만 중단하고 다시 따라하기에서 재표시한다`, async ({ page }) => {
  await setup(page)
  const gate = await enter(page)
  if (method === 'Escape') await page.keyboard.press('Escape')
  else await gate.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(gate).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '전략 따라하기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전략 복사하기', exact: true })).toBeFocused()
  await unchanged(page)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await expect(gate).toBeVisible()
  await unchanged(page)
})

test('나중에 한 번 선택하면 페이지 내 경로 왕복은 재유도하지 않고 새로고침은 다시 유도한다', async ({ page }) => {
  await setup(page)
  const gate = await enter(page)
  await gate.getByRole('button', { name: '나중에 하기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '전략 따라하기', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await navigate(page, '#/plan')
  await expect(page.locator('.client-strategy-sharing')).toHaveCount(0)
  await navigate(page, target)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '전략 따라하기', exact: true })).toBeVisible()
  await expect(gate).toHaveCount(0)
  await page.keyboard.press('Escape')
  await unchanged(page)
  await page.reload()
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await expect(gate).toBeVisible()
  await unchanged(page)
})

for (const destination of ['#/plan', sharedHash({ nick: sourceSharedStrategies().find(item => item.nick !== row.nick)!.nick, period: 'all' })]) test(`${destination} 이탈 후 이전 나중에 버튼의 늦은 클릭은 복제나 재유도 생략을 만들지 않는다`, async ({ page }) => {
  await setup(page)
  const gate = await enter(page)
  await gate.getByRole('button', { name: '나중에 하기', exact: true }).evaluate(el => Reflect.set(window, 'oldIntroButton', el))
  await navigate(page, destination)
  await expect(gate).toHaveCount(0)
  await page.evaluate(() => (Reflect.get(window, 'oldIntroButton') as HTMLButtonElement).click())
  await expect(page.getByRole('dialog', { name: '전략 따라하기', exact: true })).toHaveCount(0)
  await unchanged(page)
  await navigate(page, target)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await expect(gate).toBeVisible()
})

test('구독 안내는 기존 대화로 돌아가며 원 초안·홈 초안·복제 기록을 보존한다', async ({ page }) => {
  await setup(page)
  const gate = await enter(page)
  await gate.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await expect(gate).toHaveCount(0)
  await expect(page.locator('.client-strategy-sharing')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue(previous.draft)
  await expect(page.getByRole('status').filter({ hasText: '전략 검증을 통과하면 구독 단계로 이어져요' })).toBeVisible()
  await unchanged(page)
})

test('저장된 따라가기 설정도 같은 안내를 거쳐 저장 원본 조건을 변경 없이 연다', async ({ page }) => {
  await setup(page)
  await page.route('**/intro-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Stored follow fixture</body></html>' }))
  await page.goto('/intro-store.html')
  const saved = await page.evaluate(async ({ owner, row }) => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    store.copySharedStrategy(owner, { nick: row.nick, budgetIndex: 3, sl: -8, tp: 15 })
    return JSON.parse(sessionStorage.getItem('teth-client-experience')!)
  }, { owner, row })
  await page.goto('/#/share')
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await page.locator(`[data-follow-id="${saved.sharedFollows[0].id}"]`).getByRole('button', { name: '설정 변경', exact: true }).click()
  const gate = page.getByRole('dialog', { name: heading, exact: true })
  await expect(gate).toBeVisible()
  await unchanged(page, saved)
  await gate.getByRole('button', { name: '나중에 하기', exact: true }).click()
  const copy = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(copy.getByRole('combobox', { name: '시작 예산', exact: true })).toHaveValue('3')
  await expect(copy.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue('-8')
  await expect(copy.getByRole('combobox', { name: '익절 목표', exact: true })).toHaveValue('15')
  await page.keyboard.press('Escape')
  await unchanged(page, saved)
})

test('같은 페이지에서 계정을 바꾸면 다른 owner는 나중에 선택을 이어받지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  const gate = await enter(page)
  await gate.getByRole('button', { name: '나중에 하기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '전략 따라하기', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.locator('[data-sidebar-action="account"]').filter({ visible: true }).click()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await navigate(page, target)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(otherOwner)
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await page.getByRole('button', { name: '비밀번호로 계속하기', exact: true }).click()
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-only-password')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '이메일 주소', exact: true })).toHaveCount(0)
  await navigate(page, target)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await expect(gate).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-profile-preview')!).email)).toBe(otherOwner)
  expect((await experience(page)).sharedFollows).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 연결 안내는 읽기·44px 클릭·키보드 나중에 이동이 가능하다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  await setup(page)
  const gate = await enter(page)
  await page.evaluate(() => document.fonts.ready)
  await expect(gate).toHaveCSS('word-break', 'keep-all')
  await expect(gate.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`shared-intro-${width}-top.png`) })
  for (const name of ['닫기', '구독으로 업그레이드', '나중에 하기']) await reachable(page, gate.getByRole('button', { name, exact: true }))
  const later = gate.getByRole('button', { name: '나중에 하기', exact: true })
  await gate.getByRole('button', { name: '닫기', exact: true }).focus()
  for (let count = 0; count < 10 && !await later.evaluate(el => el === document.activeElement); count++) await page.keyboard.press('Tab')
  await expect(later).toBeFocused()
  await page.screenshot({ path: info.outputPath(`shared-intro-${width}-later.png`) })
  await page.keyboard.press('Enter')
  const copy = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(copy).toBeVisible()
  expect(await copy.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.screenshot({ path: info.outputPath(`shared-intro-${width}-copy.png`) })
  await page.keyboard.press('Escape')
  await unchanged(page)
})
