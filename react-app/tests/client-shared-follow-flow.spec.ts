import { expect, test, type Page } from '@playwright/test'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { prepareSharedCopy } from '../src/client-shared-copy'
import { delegationWorkMilestones, resolveDelegationProgress } from '../src/client-delegation-fixtures'

const owner = 'follow-a@example.test', otherOwner = 'follow-b@example.test'
const source = sourceSharedStrategies()
const first = source[0], second = source.find(row => row.nick !== first.nick)!
const request = { nick: first.nick, budgetIndex: 1, sl: first.parameters.sl, tp: first.parameters.tp! }
const previous = { id: 'follow-prior-chat', title: '이전 대화', renamed: true, idea: '기존 질문', draft: '기존 대화의 미전송 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], updatedAt: 1 }
const botKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const botBytes = JSON.stringify([{ sessionId: 'prior-bot-session', record: { id: '1700', name: '기존 등록 봇', createdAt: 1700, parameters: { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }, score: 80, ret: 15, mdd: -5, n: 12, winRate: 70, environment: 'paper', status: 'live', asset: '비트코인', capital: 5000000, exchangeId: 'binance', exchangeName: 'Binance', version: 'v1.0' } }])
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function continueCopyAfterIntro(page: Page) {
  const intro = page.getByRole('dialog', { name: '이 전략을 따라하려면 연결이 필요해요', exact: true })
  const settings = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  // Keep store fixtures unchanged; only real Main copy/edit entries consume
  // the source first-use sheet through its explicit Later action.
  await expect(intro.or(settings).first()).toBeVisible()
  if (await intro.isVisible()) {
    await intro.getByRole('button', { name: '나중에 하기', exact: true }).click()
    await expect(intro).toHaveCount(0)
  }
  await expect(settings).toBeVisible()
}

async function storeFixture(page: Page) {
  await page.route('**/shared-follow-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Local follow store fixture</body></html>' }))
  await page.goto('/shared-follow-store.html')
  await page.evaluate(async ({ previous, botKey, botBytes }) => {
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: previous.id, homeDraft: '보존할 홈 초안', sessions: [previous], sharedFollows: [] }))
    sessionStorage.setItem(botKey, botBytes)
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    Object.assign(window, { followStore: createClientExperienceStore(), createFollowStore: createClientExperienceStore })
  }, { previous, botKey, botBytes })
}

test('동일 설정 재검증은 follow ID를 재사용하지만 매번 새 세션으로 이전 완료와 분리한다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, request }) => {
    const store = Reflect.get(window, 'followStore')
    const firstId = store.copySharedStrategy(owner, request)
    const first = structuredClone(store.getSnapshot())
    const uiKey = `teth:client-delegation:${firstId}`
    const oldUi = JSON.parse(sessionStorage.getItem(uiKey)!)
    sessionStorage.setItem(uiKey, JSON.stringify({ ...oldUi, page: 'report', workStep: 5 }))
    const secondId = store.copySharedStrategy(owner, { ...request })
    return { firstId, secondId, first, after: store.getSnapshot(), currentUi: JSON.parse(sessionStorage.getItem(`teth:client-delegation:${secondId}`)!), oldUi: JSON.parse(sessionStorage.getItem(uiKey)!) }
  }, { owner, request })
  expect(result.secondId).not.toBe(result.firstId)
  expect(result.after.sharedFollows).toHaveLength(1)
  expect(result.after.sharedFollows[0]).toMatchObject({ ...result.first.sharedFollows[0], sessionId: result.secondId, active: true, confirmedAt: expect.any(Number) })
  expect(result.after.sessions).toHaveLength(3)
  expect(result.currentUi).toMatchObject({ page: 'backtest', workStep: 0, attempt: 0 })
  expect(result.oldUi).toMatchObject({ page: 'report', workStep: 5 })
  expect(result.after.sessions.find((row: { id: string }) => row.id === previous.id)).toMatchObject(previous)
  expect(result.after.homeDraft).toBe('보존할 홈 초안')
})

test('설정 변경은 명시 follow ID를 유지하고 같은 계정의 다른 기록만 비활성화한다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, otherOwner, request, second }) => {
    const store = Reflect.get(window, 'followStore')
    store.copySharedStrategy(otherOwner, request)
    const other = structuredClone(store.getSnapshot().sharedFollows.find((row: { owner: string }) => row.owner === otherOwner))
    store.copySharedStrategy(owner, request)
    const first = store.getSnapshot().sharedFollows.find((row: { owner: string }) => row.owner === owner)
    store.copySharedStrategy(owner, { nick: second.nick, budgetIndex: 3, sl: second.parameters.sl, tp: second.parameters.tp })
    const before = structuredClone(store.getSnapshot())
    const expectedFollow = { sessionId: first.sessionId, parameters: first.parameters, budgetIndex: first.budgetIndex }
    const id = store.copySharedStrategy(owner, { ...request, sl: -12, tp: 15, budgetIndex: 2, expectedFollow }, first.id)
    return { other, first, id, before, after: store.getSnapshot() }
  }, { owner, otherOwner, request, second })
  expect(result.after.sharedFollows).toHaveLength(3)
  expect(result.after.sharedFollows.find((row: { owner: string }) => row.owner === otherOwner)).toEqual(result.other)
  expect(result.after.sharedFollows.filter((row: { owner: string; active: boolean }) => row.owner === owner && row.active)).toHaveLength(1)
  expect(result.after.sharedFollows.find((row: { id: string }) => row.id === result.first.id)).toMatchObject({ sessionId: result.id, budgetIndex: 2, active: true, parameters: { ...first.parameters, sl: -12, tp: 15 } })
  expect(result.after.sessions).toHaveLength(result.before.sessions.length + 1)
})

test('보관·삭제는 record만 바꾸며 등록 봇·세션을 보존하고 삭제한 기록을 reload로 되살리지 않는다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, request, botKey }) => {
    const store = Reflect.get(window, 'followStore')
    store.copySharedStrategy(owner, request)
    const before = structuredClone(store.getSnapshot()), record = before.sharedFollows[0]
    const bots = sessionStorage.getItem(botKey)
    store.archiveSharedFollow(owner, record.id)
    const archived = structuredClone(store.getSnapshot())
    store.removeSharedFollow(owner, record.id)
    const removed = structuredClone(store.getSnapshot())
    const restored = Reflect.get(window, 'createFollowStore')().getSnapshot()
    return { before, bots, archived, removed, restored, botsAfter: sessionStorage.getItem(botKey) }
  }, { owner, request, botKey })
  expect(result.archived.sharedFollows[0]).toEqual({ ...result.before.sharedFollows[0], active: false })
  expect(result.archived.sessions).toEqual(result.before.sessions)
  expect(result.removed.sharedFollows).toEqual([])
  expect(result.removed.sessions).toEqual(result.before.sessions)
  expect(result.restored.sharedFollows).toEqual([])
  expect(result.restored.sessions).toEqual(result.before.sessions)
  expect(result.botsAfter).toBe(result.bots)
  expect(result.botsAfter).toBe(botBytes)
})

test('다른 계정·없는 record의 변경은 거절되고 기존 기록을 변경하지 않는다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, otherOwner, request }) => {
    const store = Reflect.get(window, 'followStore')
    store.copySharedStrategy(owner, request)
    const before = JSON.stringify(store.getSnapshot()), id = store.getSnapshot().sharedFollows[0].id, errors: string[] = []
    for (const [method, actor, target] of [['archiveSharedFollow', otherOwner, id], ['removeSharedFollow', otherOwner, id], ['archiveSharedFollow', owner, 'missing'], ['removeSharedFollow', owner, 'missing'], ['removeSharedFollow', owner, id]] as const) {
      try { store[method](actor, target) } catch (error) { errors.push((error as Error).message) }
    }
    try { store.copySharedStrategy(otherOwner, request, id) } catch (error) { errors.push((error as Error).message) }
    return { before, after: JSON.stringify(store.getSnapshot()), errors }
  }, { owner, otherOwner, request })
  expect(result.errors).toHaveLength(6)
  expect(result.after).toBe(result.before)
})

test('follow 보관·삭제 저장 실패는 메모리·원 bytes·구독을 그대로 유지하고 재시도할 수 있다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, request }) => {
    const store = Reflect.get(window, 'followStore')
    store.copySharedStrategy(owner, request)
    const id = store.getSnapshot().sharedFollows[0].id
    const write = Storage.prototype.setItem
    let blocked = false, notifications = 0
    store.subscribe(() => { notifications++ })
    Storage.prototype.setItem = function (key, value) { if (blocked && key === 'teth-client-experience') throw new Error('blocked fixture'); return write.call(this, key, value) }
    const failures = []
    for (const method of ['archiveSharedFollow', 'removeSharedFollow']) {
      const before = store.getSnapshot(), bytes = sessionStorage.getItem('teth-client-experience')
      notifications = 0
      blocked = true
      let error = ''
      try { store[method](owner, id) } catch (cause) { error = (cause as Error).message }
      failures.push({ error, same: before === store.getSnapshot(), sameBytes: bytes === sessionStorage.getItem('teth-client-experience'), notifications })
      blocked = false
      store[method](owner, id)
    }
    return { failures, notifications, after: store.getSnapshot() }
  }, { owner, request })
  for (const failure of result.failures) expect(failure).toMatchObject({ error: expect.any(String), same: true, sameBytes: true, notifications: 0 })
  expect(result.failures.every(failure => failure.error.length > 0)).toBe(true)
  expect(result.notifications).toBe(1)
  expect(result.after.sharedFollows).toEqual([])
})

test('legacy 복제 기록은 sharedFollows 필드가 없을 때만 이관하고 명시 빈 배열·손상 필드를 부활시키지 않는다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, request }) => {
    const store = Reflect.get(window, 'followStore'), create = Reflect.get(window, 'createFollowStore')
    const id = store.copySharedStrategy(owner, request)
    const original = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    const legacy = { ...original }
    delete legacy.sharedFollows
    sessionStorage.setItem('teth-client-experience', JSON.stringify(legacy))
    const restored = create().getSnapshot()
    const variants = []
    for (const sharedFollows of [[], null, {}, 'broken']) {
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ ...legacy, sharedFollows }))
      variants.push(create().getSnapshot())
    }
    return { id, restored, variants, legacy }
  }, { owner, request })
  expect(result.restored.sharedFollows).toHaveLength(1)
  expect(result.restored.sharedFollows[0]).toMatchObject({ owner, nick: request.nick, sessionId: result.id, asset: first.asset, parameters: first.parameters, budgetIndex: request.budgetIndex })
  for (const value of result.variants) {
    expect(value.sharedFollows).toEqual([])
    expect(value.sessions).toEqual(result.legacy.sessions)
    expect(value.homeDraft).toBe('보존할 홈 초안')
  }
})

test('저장된 RSI·추세·기간·미설정 익절은 원 전략 최신값으로 덮어쓰지 않는다', async ({ page }) => {
  await storeFixture(page)
  const parameters = { ...first.parameters, rsiTh: 39, trendFilter: false, startI: 400, endI: 1200, tp: null }
  const result = await page.evaluate(({ owner, request, parameters }) => {
    const store = Reflect.get(window, 'followStore'), create = Reflect.get(window, 'createFollowStore')
    store.copySharedStrategy(owner, request)
    const persisted = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    const record = persisted.sharedFollows[0]
    record.parameters = parameters
    sessionStorage.setItem('teth-client-experience', JSON.stringify(persisted))
    const restored = create()
    const expectedFollow = { sessionId: record.sessionId, parameters: record.parameters, budgetIndex: record.budgetIndex }
    const id = restored.copySharedStrategy(owner, { ...request, sl: -12, tp: null, budgetIndex: 3, expectedFollow }, record.id)
    return { record, snapshot: restored.getSnapshot(), id, ui: JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!) }
  }, { owner, request, parameters })
  const expected = { ...parameters, sl: -12 }
  expect(result.snapshot.sharedFollows).toHaveLength(1)
  expect(result.snapshot.sharedFollows[0]).toMatchObject({ id: result.record.id, sessionId: result.id, parameters: expected, budgetIndex: 3 })
  expect(result.ui.parameters).toEqual(expected)
  expect(result.ui.pendingParameters).toEqual(expected)
  expect(result.snapshot.sessions.find((row: { id: string }) => row.id === result.id).takeProfit).toBe('미설정')
})

test('이전 job의 직접 수정은 새 job에 귀속된 follow를 해제하지 않는다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, request }) => {
    const store = Reflect.get(window, 'followStore')
    const oldId = store.copySharedStrategy(owner, request)
    const newId = store.copySharedStrategy(owner, request)
    const before = structuredClone(store.getSnapshot().sharedFollows)
    store.detachSharedCopy(oldId)
    const afterOld = structuredClone(store.getSnapshot().sharedFollows)
    const oldSession = structuredClone(store.getSnapshot().sessions.find((row: { id: string }) => row.id === oldId))
    const currentSession = structuredClone(store.getSnapshot().sessions.find((row: { id: string }) => row.id === newId))
    store.detachSharedCopy(newId)
    return { before, afterOld, oldSession, currentSession, afterNew: store.getSnapshot().sharedFollows }
  }, { owner, request })
  expect(result.afterOld).toEqual(result.before)
  expect(result.oldSession.sharedCopy.active).toBe(false)
  expect(result.currentSession.sharedCopy.active).toBe(true)
  expect(result.afterNew[0]).toEqual({ ...result.before[0], active: false })
})

test('배경 검증 경과는 원본 milestone과 공급 규칙만 전진시키고 복구·미공급 경계는 보존한다', () => {
  const { ui } = prepareSharedCopy(request, 10000)
  const original = JSON.stringify(ui)
  Object.freeze(ui.parameters); Object.freeze(ui.pendingParameters); Object.freeze(ui)
  expect(resolveDelegationProgress(ui, 9999)).toBe(ui)
  expect(resolveDelegationProgress(ui, 10479)).toBe(ui)
  delegationWorkMilestones.forEach((offset, index) => {
    const value = resolveDelegationProgress(ui, 10000 + offset)!
    expect(value.workStep).toBe(index + 1)
    expect(value.parameters).toEqual(ui.parameters)
    expect(value.page).toBe('backtest')
    expect(value.attempt).toBe(0)
  })
  const finished = resolveDelegationProgress(ui, 20000)!
  expect(finished.pendingParameters).toBeUndefined()
  expect(resolveDelegationProgress(finished, 30000)).toBe(finished)
  for (const variant of [{ ...ui, recoveryRequired: true as const }, { ...ui, workStartedAt: undefined }, { ...ui, page: 'intake' as const }, { ...ui, questionIndex: 4 }]) {
    expect(resolveDelegationProgress(variant, 20000)).toBe(variant)
  }
  expect(resolveDelegationProgress(ui, NaN)).toBe(ui)
  expect(resolveDelegationProgress(undefined, 20000)).toBeUndefined()
  expect(JSON.stringify(ui)).toBe(original)
})

for (const action of ['archive', 'replace', 'reset'] as const) test(`${action} 시점의 확정 조건을 보관하고 이후 구 job 결과로 덮어쓰지 않는다`, async ({ page }) => {
  await storeFixture(page)
  const completed = { ...first.parameters, rsiTh: 37, trendFilter: false }, late = { ...first.parameters, rsiTh: 29, startI: 500 }
  const result = await page.evaluate(async ({ owner, request, second, action, completed, late }) => {
    const path = '/src/client-delegation-fixtures.ts'
    const { readDelegationUi, saveDelegationUi } = await import(/* @vite-ignore */ path)
    const store = Reflect.get(window, 'followStore'), id = store.copySharedStrategy(owner, request)
    const recordId = store.getSnapshot().sharedFollows[0].id, ui = readDelegationUi(id)
    saveDelegationUi(id, { ...ui, workStep: 5, parameters: completed, pendingParameters: undefined })
    if (action === 'archive') store.archiveSharedFollow(owner, recordId)
    if (action === 'reset') store.detachSharedCopy(id)
    if (action === 'replace') store.copySharedStrategy(owner, { nick: second.nick, budgetIndex: 3, sl: second.parameters.sl, tp: second.parameters.tp })
    const archived = structuredClone(store.getSnapshot().sharedFollows.find((row: { id: string }) => row.id === recordId))
    saveDelegationUi(id, { ...ui, workStep: 5, parameters: late, pendingParameters: undefined })
    const expectedFollow = { sessionId: archived.sessionId, parameters: archived.parameters, budgetIndex: archived.budgetIndex }
    const nextId = store.copySharedStrategy(owner, { ...request, expectedFollow }, recordId)
    return { archived, nextId, next: store.getSnapshot().sharedFollows.find((row: { id: string }) => row.id === recordId), nextUi: readDelegationUi(nextId) }
  }, { owner, request, second, action, completed, late })
  expect(result.archived).toMatchObject({ active: false, parameters: completed })
  expect(result.next).toMatchObject({ id: result.archived.id, parameters: completed, sessionId: result.nextId, active: true })
  expect(result.nextUi.parameters).toEqual(completed)
})

test('추천 조건을 완료한 기록은 초기 조건 신규 복제와 중복되지 않고 복귀는 최초 대화로 연결된다', async ({ page }) => {
  await storeFixture(page)
  const changed = { ...first.parameters, rsiTh: 37, trendFilter: false }
  const result = await page.evaluate(async ({ owner, request, changed }) => {
    const path = '/src/client-delegation-fixtures.ts'
    const { readDelegationUi, saveDelegationUi } = await import(/* @vite-ignore */ path)
    const store = Reflect.get(window, 'followStore'), firstId = store.copySharedStrategy(owner, request)
    const ui = readDelegationUi(firstId), firstFollow = store.getSnapshot().sharedFollows[0].id
    saveDelegationUi(firstId, { ...ui, workStep: 5, parameters: changed, pendingParameters: undefined })
    const nextId = store.copySharedStrategy(owner, request)
    const againId = store.copySharedStrategy(owner, request)
    return { firstFollow, nextId, againId, after: store.getSnapshot() }
  }, { owner, request, changed })
  expect(result.after.sharedFollows).toHaveLength(2)
  expect(result.after.sharedFollows.find((row: { id: string }) => row.id === result.firstFollow)).toMatchObject({ active: false, parameters: changed })
  const active = result.after.sharedFollows.find((row: { active: boolean }) => row.active)
  expect(active.parameters).toEqual(first.parameters)
  expect(active.sessionId).toBe(result.againId)
  for (const id of [result.nextId, result.againId]) expect(result.after.sessions.find((row: { id: string }) => row.id === id).sharedCopy.returnId).toBe(previous.id)
})

test('follow 확정의 expected snapshot 누락·session/6개 규칙/예산 불일치는 UUID·저장·emit 없이 거절한다', async ({ page }) => {
  await storeFixture(page)
  const result = await page.evaluate(({ owner, request }) => {
    const store = Reflect.get(window, 'followStore')
    store.copySharedStrategy(owner, request)
    const record = structuredClone(store.getSnapshot().sharedFollows[0])
    const expectedFollow = { sessionId: record.sessionId, parameters: record.parameters, budgetIndex: record.budgetIndex }
    const before = store.getSnapshot(), bytes = sessionStorage.getItem('teth-client-experience')
    let writes = 0, ids = 0, emits = 0
    const write = Storage.prototype.setItem, uuid = crypto.randomUUID.bind(crypto)
    Storage.prototype.setItem = function (key, value) { writes++; return write.call(this, key, value) }
    crypto.randomUUID = () => { ids++; return uuid() }
    store.subscribe(() => { emits++ })
    const variants = [undefined, { ...expectedFollow, sessionId: 'another-job' }, { ...expectedFollow, budgetIndex: 3 },
      ...(['sl', 'tp', 'rsiTh', 'trendFilter', 'startI', 'endI'] as const).map(key => ({ ...expectedFollow, parameters: { ...record.parameters, [key]: key === 'trendFilter' ? !record.parameters[key] : record.parameters[key] + 1 } }))]
    const errors: string[] = []
    for (const expectedFollow of variants) {
      try { store.copySharedStrategy(owner, { ...request, expectedFollow }, record.id) } catch (error) { errors.push((error as Error).message) }
    }
    try { store.copySharedStrategy(owner, { ...request, expectedFollow }) } catch (error) { errors.push((error as Error).message) }
    return { errors, writes, ids, emits, same: before === store.getSnapshot(), sameBytes: bytes === sessionStorage.getItem('teth-client-experience') }
  }, { owner, request })
  expect(result.errors).toHaveLength(10)
  expect(result.errors.every(error => error.length > 0)).toBe(true)
  expect(result).toMatchObject({ writes: 0, ids: 0, emits: 0, same: true, sameBytes: true })
})

async function followPage(page: Page, count = 1, controlledTime = false) {
  const fixed = new Date('2026-09-20T12:00:00Z')
  if (controlledTime) await page.clock.setFixedTime(fixed)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await storeFixture(page)
  const records = await page.evaluate(({ owner, otherOwner, request, second, count }) => {
    const store = Reflect.get(window, 'followStore')
    store.copySharedStrategy(otherOwner, request)
    store.copySharedStrategy(owner, request)
    if (count > 1) store.copySharedStrategy(owner, { nick: second.nick, budgetIndex: 3, sl: second.parameters.sl, tp: second.parameters.tp })
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '따라가기 검수자', email: owner }))
    return store.getSnapshot().sharedFollows
  }, { owner, otherOwner, request, second, count })
  await page.goto('/#/share')
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.client-shared-follow-list')).toBeVisible()
  if (controlledTime) {
    await page.clock.pauseAt(fixed.getTime() + 50)
    await page.clock.setSystemTime(fixed.getTime() + 50)
  }
  return records as Array<{ id: string; owner: string; sessionId: string; nick: string; active: boolean }>
}

async function snapshot(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
}

test('목록은 현재 계정만 표시하고 이어서 진행은 기록에 결속된 기존 세션을 연다', async ({ page }) => {
  const records = await followPage(page, 2)
  const mine = records.filter(row => row.owner === owner), active = mine.find(row => row.active)!
  const list = page.locator('.client-shared-follow-list')
  await expect(list.locator('article')).toHaveCount(2)
  await expect(list.locator(`[data-follow-id="${records.find(row => row.owner === otherOwner)!.id}"]`)).toHaveCount(0)
  const summary = list.getByRole('definition')
  await expect(summary).toHaveText(['2개', '1개', '1개'])
  const before = await snapshot(page)
  await list.locator(`[data-follow-id="${active.id}"]`).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${second.asset} 전략 검증`, exact: true })).toBeVisible()
  expect((await snapshot(page)).currentId).toBe(active.sessionId)
  expect((await snapshot(page)).sessions).toEqual(before.sessions)
  await page.evaluate(({ otherOwner }) => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: otherOwner })), { otherOwner })
  await page.goto('/#/share')
  await page.reload()
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(list.locator('article')).toHaveCount(1)
  await expect(list.locator('article')).toHaveAttribute('data-follow-id', records.find(row => row.owner === otherOwner)!.id)
})

test('게스트 목록에는 계정 기록을 노출하지 않고 로그인 복원 전 저장 내역을 삭제하지 않는다', async ({ page }) => {
  await followPage(page, 2)
  const before = await snapshot(page)
  await page.evaluate(() => sessionStorage.removeItem('teth-client-profile-preview'))
  await page.reload()
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.client-shared-follow-list article')).toHaveCount(0)
  expect((await snapshot(page)).sharedFollows).toEqual(before.sharedFollows)
  await page.evaluate(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '따라가기 검수자', email: owner })), owner)
  await page.reload()
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.client-shared-follow-list article')).toHaveCount(2)
})

test('설정 변경 확정은 follow ID를 보존하고 이전 세션과 구분되는 새 검증을 시작한다', async ({ page }) => {
  await page.clock.install()
  const records = await followPage(page), record = records.find(row => row.owner === owner)!
  await page.locator(`[data-follow-id="${record.id}"]`).getByRole('button', { name: '설정 변경', exact: true }).click()
  await continueCopyAfterIntro(page)
  const dialog = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(dialog.getByRole('combobox', { name: '시작 예산', exact: true })).toHaveValue('1')
  await dialog.getByRole('combobox', { name: '시작 예산', exact: true }).selectOption('2')
  await dialog.getByRole('combobox', { name: '손절선', exact: true }).selectOption('-12')
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
  const after = await snapshot(page), latest = after.sharedFollows.find((row: { id: string }) => row.id === record.id)
  expect(latest).toMatchObject({ budgetIndex: 2, parameters: { ...first.parameters, sl: -12 } })
  expect(latest.sessionId).not.toBe(record.sessionId)
  expect(after.currentId).toBe(latest.sessionId)
  expect(after.sessions.some((row: { id: string }) => row.id === record.sessionId)).toBe(true)
  await page.reload()
  expect((await snapshot(page)).sharedFollows.find((row: { id: string }) => row.id === record.id)).toEqual(latest)
  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
})

test('설정 창 A를 연 뒤 완료 규칙이 B가 되면 확정을 거절하고 다시 연 창에서 B를 확인한다', async ({ page }) => {
  await page.clock.install()
  const records = await followPage(page, 1, true), record = records.find(row => row.owner === owner)!
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50))
  const card = page.locator(`[data-follow-id="${record.id}"]`)
  await card.getByRole('button', { name: '설정 변경', exact: true }).click()
  await continueCopyAfterIntro(page)
  const settings = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(settings.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue(String(first.parameters.sl))
  await settings.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const before = await snapshot(page), parameters = { ...first.parameters, sl: -12, rsiTh: 37, trendFilter: false }
  await page.evaluate(async ({ id, parameters }) => {
    const path = '/src/client-delegation-fixtures.ts'
    const { readDelegationUi, saveDelegationUi } = await import(/* @vite-ignore */ path)
    saveDelegationUi(id, { ...readDelegationUi(id), workStep: 5, parameters, pendingParameters: undefined })
  }, { id: record.sessionId, parameters })
  await page.clock.runFor(550)
  const estimate = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  await estimate.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(estimate.getByRole('alert')).toContainText('전략 조건이 바뀌었어요')
  await expect(estimate).toBeVisible()
  expect((await snapshot(page)).sessions).toEqual(before.sessions)
  expect((await snapshot(page)).sharedFollows).toEqual(before.sharedFollows)
  await estimate.getByRole('button', { name: '닫기', exact: true }).click()
  await card.getByRole('button', { name: '설정 변경', exact: true }).click()
  await continueCopyAfterIntro(page)
  await expect(settings.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue('-12')
  await settings.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await estimate.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
  const after = await snapshot(page), next = after.sharedFollows.find((row: { id: string }) => row.id === record.id)
  expect(next.parameters).toEqual(parameters)
  expect(next.sessionId).not.toBe(record.sessionId)
  expect(after.sessions).toHaveLength(before.sessions.length + 1)
})

test('보관 확인·삭제·reload는 등록 봇과 이전 세션을 보존한다', async ({ page }) => {
  const records = await followPage(page), record = records.find(row => row.owner === owner)!
  const card = page.locator(`[data-follow-id="${record.id}"]`)
  const before = await snapshot(page)
  await card.getByRole('button', { name: '중지', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '따라가기 중지', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  expect((await snapshot(page)).sharedFollows).toEqual(before.sharedFollows)
  await card.getByRole('button', { name: '중지', exact: true }).click()
  await dialog.getByRole('button', { name: '중지하고 보관', exact: true }).click()
  await expect(card).toContainText('보관됨')
  await expect(card.getByRole('button', { name: '다시 검증', exact: true })).toBeVisible()
  await card.getByRole('button', { name: '목록에서 삭제', exact: true }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.client-shared-follow-list article')).toHaveCount(0)
  await expect(page.locator('.client-shared-follow-list')).toContainText('아직 따라가는 전략이 없어요')
  expect((await snapshot(page)).sessions).toEqual(before.sessions)
  expect(await page.evaluate(key => sessionStorage.getItem(key), botKey)).toBe(botBytes)
})

test('보관·삭제 저장 실패는 화면과 원 기록을 유지하며 명시 재시도로만 완료된다', async ({ page }) => {
  const records = await followPage(page), record = records.find(row => row.owner === owner)!
  const card = page.locator(`[data-follow-id="${record.id}"]`)
  await page.evaluate(() => {
    const write = Storage.prototype.setItem
    Object.assign(window, { followWriteBlocked: true })
    Storage.prototype.setItem = function (key, value) {
      if (Reflect.get(window, 'followWriteBlocked') && key === 'teth-client-experience') throw new Error('fixture storage failure')
      return write.call(this, key, value)
    }
  })
  const before = await snapshot(page)
  await card.getByRole('button', { name: '중지', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '따라가기 중지', exact: true })
  await dialog.getByRole('button', { name: '중지하고 보관', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('보관하지 못했어요')
  await expect(dialog).toBeVisible()
  expect((await snapshot(page)).sharedFollows).toEqual(before.sharedFollows)
  await page.evaluate(() => Reflect.set(window, 'followWriteBlocked', false))
  await dialog.getByRole('button', { name: '중지하고 보관', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(card).toContainText('보관됨')
  const archived = await snapshot(page)
  await page.evaluate(() => Reflect.set(window, 'followWriteBlocked', true))
  await card.getByRole('button', { name: '목록에서 삭제', exact: true }).click()
  await expect(page.locator('.ss3-notice')).toContainText('삭제하지 못했어요')
  await expect(card).toBeVisible()
  expect((await snapshot(page)).sharedFollows).toEqual(archived.sharedFollows)
  await page.evaluate(() => Reflect.set(window, 'followWriteBlocked', false))
  await card.getByRole('button', { name: '목록에서 삭제', exact: true }).click()
  await expect(card).toHaveCount(0)
  await expect(page.locator('.hub-header h1')).toBeFocused()
  expect((await snapshot(page)).sessions).toEqual(before.sessions)
})

test('다시 답하기의 저장 실패는 현재 조건과 화면을 유지하고 오류만 표시한다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const records = await followPage(page), record = records.find(row => row.owner === owner)!
  await page.locator(`[data-follow-id="${record.id}"]`).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await expect(page.locator('.client-delegation .tfw')).toBeVisible()
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  const reset = page.getByRole('button', { name: '다시 답하기', exact: true })
  await expect(reset).toBeVisible()
  const before = await snapshot(page)
  const beforeUi = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!), record.sessionId)
  await page.evaluate(() => {
    const write = Storage.prototype.setItem
    Object.assign(window, { followResetBlocked: true })
    Storage.prototype.setItem = function (key, value) {
      if (Reflect.get(window, 'followResetBlocked') && key === 'teth-client-experience') throw new Error('reset fixture storage failure')
      return write.call(this, key, value)
    }
  })
  await reset.click()
  await expect(page.getByRole('alert')).toContainText('복제 조건을 해제하지 못했어요')
  await expect(reset).toBeVisible()
  await expect(page.getByRole('heading', { name: '어떤 자산으로 할까요?', exact: true })).toHaveCount(0)
  expect((await snapshot(page)).sharedFollows).toEqual(before.sharedFollows)
  expect((await snapshot(page)).sessions).toEqual(before.sessions)
  const afterUi = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!), record.sessionId)
  expect(afterUi.answers).toEqual(beforeUi.answers)
  expect(afterUi.parameters).toEqual(beforeUi.parameters)
  expect(afterUi.page).toBe(beforeUi.page)
  expect(errors).toEqual([])
  await page.evaluate(() => Reflect.set(window, 'followResetBlocked', false))
  await reset.click()
  await expect(page.getByRole('heading', { name: '어떤 자산으로 할까요?', exact: true })).toBeVisible()
  expect((await snapshot(page)).sharedFollows.find((row: { id: string }) => row.id === record.id).active).toBe(false)
  expect(errors).toEqual([])
})

test('목록의 배경 검증은 시간 경과 후 같은 세션의 원 규칙 결과로만 바뀐다', async ({ page }) => {
  await page.clock.install()
  const records = await followPage(page, 1, true), record = records.find(row => row.owner === owner)!
  // Wall time stayed fixed during lazy mounting; explicit advancement starts here.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50))
  const card = page.locator(`[data-follow-id="${record.id}"]`)
  await expect(card.locator('.ss3-st')).toHaveText('검증 중')
  const before = await snapshot(page)
  await page.clock.fastForward(3500)
  await expect(card.locator('.ss3-st')).toHaveText('검증 통과')
  expect((await snapshot(page)).sharedFollows).toEqual(before.sharedFollows)
  await card.getByRole('button', { name: '이어서 진행', exact: true }).click()
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toBeVisible()
  expect((await snapshot(page)).currentId).toBe(record.sessionId)
  const ui = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!), record.sessionId)
  expect(ui.parameters).toEqual(first.parameters)
  expect(ui.workStep).toBe(5)
})

test('보관된 전략의 다시 검증은 같은 follow ID로 시작하며 삭제된 공개 전략의 저장 조건도 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await storeFixture(page)
  const nick = '이전 공개 전략 <보존 & 확인>', parameters = { ...first.parameters, rsiTh: 39, trendFilter: false, startI: 400, endI: 1200, tp: null }
  const record = await page.evaluate(({ owner, request, nick, parameters }) => {
    const store = Reflect.get(window, 'followStore')
    store.copySharedStrategy(owner, request)
    const data = JSON.parse(sessionStorage.getItem('teth-client-experience')!), record = data.sharedFollows[0]
    Object.assign(record, { nick, parameters, active: false })
    data.sessions.find((row: { id: string }) => row.id === record.sessionId).sharedCopy.nick = nick
    sessionStorage.setItem('teth-client-experience', JSON.stringify(data))
    // No source result is supplied for the renamed, no-longer-public record.
    sessionStorage.removeItem(`teth:client-delegation:${record.sessionId}`)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '따라가기 검수자', email: owner }))
    return record
  }, { owner, request, nick, parameters })
  await page.goto('/#/share')
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  const card = page.locator(`[data-follow-id="${record.id}"]`)
  await expect(card.locator('.nm')).toHaveText(nick)
  await expect(card.locator('svg')).toHaveCount(0)
  await expect(card).not.toContainText('원 전략 검증 수익')
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('shared-follow-ghost-320.png') })
  await card.getByRole('button', { name: '다시 검증', exact: true }).click()
  await continueCopyAfterIntro(page)
  const dialog = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(dialog).toContainText(nick)
  await expect(dialog.getByRole('combobox', { name: '익절 목표', exact: true })).toHaveValue('none')
  await page.screenshot({ path: info.outputPath('shared-follow-ghost-settings-320.png') })
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await page.screenshot({ path: info.outputPath('shared-follow-ghost-estimate-320.png') })
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${first.asset} 전략 검증`, exact: true })).toBeVisible()
  const after = await snapshot(page)
  expect(after.sharedFollows).toHaveLength(1)
  expect(after.sharedFollows[0]).toMatchObject({ id: record.id, nick, parameters, active: true })
  expect(after.sharedFollows[0].sessionId).not.toBe(record.sessionId)
})

for (const width of [320, 1440]) test(`${width}px 원본 목록·키보드 취소는 읽을 수 있고 계정 버튼과 겹치지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const records = await followPage(page, 2), active = records.find(row => row.owner === owner && row.active)!
  await page.evaluate(() => document.fonts.ready)
  const list = page.locator('.client-shared-follow-list'), card = list.locator(`[data-follow-id="${active.id}"]`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  // Fixed source index.html:26088 hides the fresh public common bell.
  await expect(page.locator('.client-account-bell, .client-account-utility')).toHaveCount(0)
  const headerButton = page.locator('.hub-header').getByRole('button')
  const header = await headerButton.boundingBox()
  expect(header).not.toBeNull()
  expect(header!.x).toBeGreaterThanOrEqual(0)
  expect(header!.x + header!.width).toBeLessThanOrEqual(width)
  expect(header!.height).toBeGreaterThanOrEqual(44)
  expect(await headerButton.evaluate(el => { const r = el.getBoundingClientRect(); return [0.2, 0.5, 0.8].every(f => el.contains(document.elementFromPoint(r.left + r.width * f, r.top + r.height / 2))) })).toBe(true)
  for (const button of await list.locator('article .bt button').all()) {
    await button.scrollIntoViewIfNeeded()
    const box = await button.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  }
  const trigger = card.getByRole('button', { name: '중지', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: '따라가기 중지', exact: true })).toBeVisible()
  const dialog = page.getByRole('dialog', { name: '따라가기 중지', exact: true })
  for (const button of await dialog.getByRole('button').all()) {
    const box = await button.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(900)
  }
  await page.screenshot({ path: info.outputPath(`shared-follow-archive-${width}.png`) })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(card).not.toContainText('보관됨')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath(`shared-follow-${width}.png`), fullPage: true })
  await list.evaluate(el => { for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) ancestor.scrollTop = 0 })
  await page.screenshot({ path: info.outputPath(`shared-follow-top-${width}.png`) })
})
