import { expect, test, type Page } from '@playwright/test'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { prepareSharedCopy } from '../src/client-shared-copy'
import { sharedHash } from '../src/client-shared-strategies'

const owner = 'follow-order@example.test', otherOwner = 'follow-order-other@example.test'
const sources = sourceSharedStrategies()
const previous = { id: 'follow-order-original', title: '원래 대화', renamed: true, idea: '기존 질문', draft: '기존 미전송 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], updatedAt: 1 }
const botKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const botBytes = JSON.stringify([{ sessionId: 'unrelated-bot-session', record: { id: '1900', name: '기존 등록 봇', createdAt: 1900, parameters: null, score: 80, ret: 15, mdd: -5, n: 12, winRate: 70, environment: 'paper', status: 'ready' } }])
const records = (times: number[]) => times.map((confirmedAt, index) => ({ id: `record-${'ABC'[index]}`, owner, nick: sources[index].nick, asset: sources[index].asset, parameters: sources[index].parameters, budgetIndex: 1, confirmedAt, sessionId: `old-job-${index}`, active: false }))

async function openFollowing(page: Page) {
  await page.goto('/#/share')
  // Current source discovery is list-only; the retained library is an explicit URL.
  await page.evaluate(() => { location.hash = '#/share/library' })
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.client-shared-follow-list')).toBeVisible()
}

async function mainFixture(page: Page, times: number[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ previous, rows, owner, otherOwner, botKey, botBytes }) => {
    if (sessionStorage.getItem('follow-order-initialized')) return
    sessionStorage.setItem('follow-order-initialized', 'true')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '순서 검수자', email: owner }))
    sessionStorage.setItem(botKey, botBytes)
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: previous.id, homeDraft: '홈 초안 보존', sessions: [previous], sharedFollows: [...rows, { ...rows[0], id: 'other-owner', owner: otherOwner }] }))
    localStorage.setItem('tethLang', 'ko')
  }, { previous, rows: records(times), owner, otherOwner, botKey, botBytes })
  await openFollowing(page)
}

async function order(page: Page) {
  await expect(page.locator('.client-shared-follow-list')).toBeVisible()
  return page.locator('.client-shared-follow-list article').evaluateAll(rows => rows.map(row => row.getAttribute('data-follow-id')))
}

for (const times of [[300, 100, 200], [200, 200, 200]]) test(`명시 생성 배열 ABC는 시각 ${times.join('/')}과 무관하게 CBA로 표시된다`, async ({ page }) => {
  await mainFixture(page, times)
  expect(await order(page)).toEqual(['record-C', 'record-B', 'record-A'])
  await page.reload()
  expect(await order(page)).toEqual(['record-C', 'record-B', 'record-A'])
  expect((await snapshot(page)).sharedFollows.map((row: { id: string }) => row.id)).toEqual(['record-A', 'record-B', 'record-C', 'other-owner'])
})

async function snapshot(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
}

async function confirmCopy(page: Page, change = false) {
  const intro = page.getByRole('dialog', { name: '이 전략을 따라하려면 연결이 필요해요', exact: true })
  const copy = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(intro.or(copy).first()).toBeVisible()
  if (await intro.isVisible()) await intro.getByRole('button', { name: '나중에 하기', exact: true }).click()
  await expect(copy).toBeVisible()
  if (change) await copy.getByRole('combobox', { name: '손절선', exact: true }).selectOption('-12')
  await copy.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('실제 Main의 A 설정 변경과 동일 조건 재검증은 제자리이며 새 D만 맨 앞에 추가된다', async ({ page }) => {
  await mainFixture(page, [100, 200, 300])
  const before = await snapshot(page), originalOther = before.sharedFollows.find((row: { owner: string }) => row.owner === otherOwner)
  const cardA = page.locator('[data-follow-id="record-A"]')
  await cardA.getByRole('button', { name: '다시 검증', exact: true }).click()
  await confirmCopy(page, true)
  let saved = await snapshot(page)
  const firstJob = saved.sharedFollows.find((row: { id: string }) => row.id === 'record-A').sessionId
  expect(saved.sharedFollows.map((row: { id: string }) => row.id)).toEqual(['record-A', 'record-B', 'record-C', 'other-owner'])
  await openFollowing(page)
  expect(await order(page)).toEqual(['record-C', 'record-B', 'record-A'])
  // Re-enter through the public source, without followId: equal complete
  // settings must deduplicate A rather than append a new follow record.
  await page.goto(`/${sharedHash({ nick: sources[0].nick, period: 'all' })}`)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await confirmCopy(page, true)
  saved = await snapshot(page)
  expect(saved.sharedFollows.find((row: { id: string }) => row.id === 'record-A').sessionId).not.toBe(firstJob)
  await openFollowing(page)
  expect(await order(page)).toEqual(['record-C', 'record-B', 'record-A'])
  await page.goto(`/${sharedHash({ nick: sources[3].nick, period: 'all' })}`)
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await confirmCopy(page)
  saved = await snapshot(page)
  const newest = saved.sharedFollows.find((row: { owner: string; nick: string }) => row.owner === owner && row.nick === sources[3].nick)
  expect(saved.sharedFollows.map((row: { id: string }) => row.id)).toEqual(['record-A', 'record-B', 'record-C', 'other-owner', newest.id])
  await openFollowing(page)
  expect(await order(page)).toEqual([newest.id, 'record-C', 'record-B', 'record-A'])
  await page.reload()
  expect(await order(page)).toEqual([newest.id, 'record-C', 'record-B', 'record-A'])
  const after = await snapshot(page)
  expect(after.sharedFollows.find((row: { owner: string }) => row.owner === otherOwner)).toEqual(originalOther)
  expect(after.sessions.find((row: { id: string }) => row.id === previous.id)).toEqual(before.sessions[0])
  expect(after.homeDraft).toBe(before.homeDraft)
  expect(await page.evaluate(key => sessionStorage.getItem(key), botKey)).toBe(botBytes)
})

test('명시 배열은 다른 계정 전환·reload에도 추측 재정렬하거나 타인 기록을 섞지 않는다', async ({ page }) => {
  await mainFixture(page, [300, 100, 200])
  const before = await snapshot(page)
  await page.evaluate(otherOwner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: otherOwner })), otherOwner)
  await page.reload()
  // Current source discovery is list-only; the retained library is an explicit URL.
  await page.evaluate(() => { location.hash = '#/share/library' })
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  expect(await order(page)).toEqual(['other-owner'])
  await page.evaluate(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '순서 검수자', email: owner })), owner)
  await page.reload()
  expect(await order(page)).toEqual(['record-C', 'record-B', 'record-A'])
  expect((await snapshot(page)).sharedFollows).toEqual(before.sharedFollows)
})

const legacyUi = prepareSharedCopy({ nick: sources[0].nick, budgetIndex: 1, sl: sources[0].parameters.sl, tp: sources[0].parameters.tp }, 100).ui
const legacySession = (id: string, followId: string, at: number, account = owner, active = true) => ({ ...previous, id, workspace: 'delegation', sharedCopy: { owner: account, nick: sources[0].nick, confirmedAt: at, active, followId, returnId: previous.id } })

async function legacyFixture(page: Page, variant: 'duplicates' | 'ties' | 'empty' | 'malformed') {
  const sessions = variant === 'ties' ? [
    legacySession('tie-A-first', 'A', 300), legacySession('tie-B', 'B', 300), legacySession('tie-A-second', 'A', 300),
  ] : [
    legacySession('dup-old', 'duplicate', 100), legacySession('tie-B', 'B', 300),
    legacySession('dup-new', 'duplicate', 300), legacySession('tie-C', 'C', 300),
    legacySession('dup-invalid', 'duplicate', 900), legacySession('other-latest', 'other', 400, otherOwner),
    legacySession('old-D', 'D', 50, owner, false), legacySession('dup-tie-second', 'duplicate', 300),
  ]
  await page.route('**/follow-order-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Local migration fixture</body>' }))
  await page.goto('/follow-order-store.html')
  return page.evaluate(async ({ sessions, previous, ui, owner, variant }) => {
    for (const session of sessions) sessionStorage.setItem(`teth:client-delegation:${session.id}`, JSON.stringify(session.id === 'dup-invalid' ? { ...ui, parameters: { ...ui.parameters, endI: 999999 }, pendingParameters: undefined } : ui))
    const initial = { currentId: previous.id, homeDraft: '기존 복구 초안', sessions: [previous, ...sessions], ...(variant === 'empty' ? { sharedFollows: [] } : variant === 'malformed' ? { sharedFollows: null } : {}) }
    sessionStorage.setItem('teth-client-experience', JSON.stringify(initial))
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복구 검수자', email: owner }))
    localStorage.setItem('tethLang', 'ko')
    const rawBefore = sessionStorage.getItem('teth-client-experience')
    const path = '/src/client-experience-store.ts', { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore(), recovered = structuredClone(store.getSnapshot())
    const rawAfterRead = sessionStorage.getItem('teth-client-experience')
    store.flush()
    const persisted = JSON.parse(sessionStorage.getItem('teth-client-experience')!), reloaded = createClientExperienceStore().getSnapshot()
    return { initial, recovered, rawBefore, rawAfterRead, persisted, reloaded }
  }, { sessions, previous, ui: legacyUi, owner, variant })
}

test('legacy 필드 미공급만 최신 유효 중복을 선택하고 active 판정 뒤 오래된 순서로 저장 정규화한다', async ({ page }) => {
  const result = await legacyFixture(page, 'duplicates')
  expect(result.rawAfterRead).toBe(result.rawBefore)
  expect(result.recovered.sharedFollows.map((row: { id: string }) => row.id)).toEqual(['D', 'C', 'duplicate', 'B', 'other'])
  expect(result.recovered.sharedFollows.find((row: { id: string }) => row.id === 'duplicate')).toMatchObject({ sessionId: 'dup-new', confirmedAt: 300, active: false })
  expect(result.recovered.sharedFollows.filter((row: { active: boolean }) => row.active).map((row: { id: string }) => row.id)).toEqual(['B', 'other'])
  expect(result.recovered.recoveryWarning).toBe(true)
  expect(result.persisted.sharedFollows).toEqual(result.recovered.sharedFollows)
  expect(result.reloaded.sharedFollows).toEqual(result.recovered.sharedFollows)
  expect(result.reloaded.sessions).toEqual(result.recovered.sessions)
  expect(result.reloaded.homeDraft).toBe('기존 복구 초안')
  await openFollowing(page)
  expect(await order(page)).toEqual(['B', 'duplicate', 'C', 'D'])
  await page.reload()
  expect(await order(page)).toEqual(['B', 'duplicate', 'C', 'D'])
})

test('legacy 동일시각은 입력상 첫 유효 중복과 첫 active 소유자를 그대로 보존한다', async ({ page }) => {
  const result = await legacyFixture(page, 'ties')
  expect(result.recovered.sharedFollows.map((row: { id: string }) => row.id)).toEqual(['B', 'A'])
  expect(result.recovered.sharedFollows.find((row: { id: string }) => row.id === 'A')).toMatchObject({ sessionId: 'tie-A-first', active: true })
  expect(result.recovered.sharedFollows.find((row: { id: string }) => row.id === 'B').active).toBe(false)
  expect(result.persisted.sharedFollows).toEqual(result.recovered.sharedFollows)
  expect(result.reloaded.sharedFollows).toEqual(result.recovered.sharedFollows)
  await openFollowing(page)
  expect(await order(page)).toEqual(['A', 'B'])
})

for (const variant of ['empty', 'malformed'] as const) test(`명시 ${variant} 목록에서는 legacy 세션이 있어도 따라가기 기록을 부활시키지 않는다`, async ({ page }) => {
  const result = await legacyFixture(page, variant)
  expect(result.recovered.sharedFollows).toEqual([])
  expect(result.persisted.sharedFollows).toEqual([])
  expect(result.reloaded.sharedFollows).toEqual([])
  expect(result.reloaded.sessions).toEqual(result.recovered.sessions)
  await openFollowing(page)
  expect(await order(page)).toEqual([])
  await expect(page.locator('.client-shared-follow-list')).toContainText('아직 따라가는 전략이 없어요')
  await page.reload()
  expect(await order(page)).toEqual([])
})
