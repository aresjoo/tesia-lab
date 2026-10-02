import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import type { SharedFollowRecord } from '../src/client-shared-follow'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

// Public source-preview persistence only. No service/exchange authorization is
// supplied by this fixture; the real store/decoders/source score remain in use.
const key = 'teth-client-experience', owner = 'handoff@example.test', id = 'handoff-session'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
const originalParameters = { ...parameters, sl: -8, tp: 15 }
const completedParameters = { ...parameters, sl: -7 }
const uncertain = '저장 여부를 확인할 수 없어요. 새로고침해 저장된 기록을 확인해주세요.'
function fixture() {
  const turns: ClientTurn[] = [1, 2].map(n => ({ id: `turn-${n}`, question: 'ETH 추세 손절 5%, 익절 12%', answer: '검증 완료', fullAnswer: '검증 완료',
    startedAt: 1000 * n, finishedAt: 1000 * n + 100, status: 'done', suggestions: [], phase: 'plan',
    inlineRequest: { parameters: { ...parameters }, pair: 'ETH/USDT', timeframe: '1시간봉' } }))
  const session: ClientSession = { id, title: '보존할 카피 대화', renamed: true, idea: '원작자 전략', draft: '아직 보내지 않은 초안',
    pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−8%', takeProfit: '+15%', researchStatus: '검토 필요', phase: 'plan',
    turns, updatedAt: 4000, workspace: 'conversation', tradingReady: false,
    conversationViewport: { top: 120, spacer: 30, follow: false, questionKey: 'turn-2' },
    inlineResults: turns.map((turn, n) => ({ ...turn.inlineRequest!, turnId: turn.id, ordinal: n + 1, completedAt: turn.finishedAt! + 1100 })),
    sharedCopy: { owner, nick: '원작자', confirmedAt: 500, returnId: 'previous-chat', active: true, followId: 'follow-exact' } }
  const previous: ClientSession = { ...session, id: 'previous-chat', title: '이전 대화', draft: '이전 초안', turns: [], inlineResults: [], sharedCopy: undefined }
  const follow: SharedFollowRecord = { id: 'follow-exact', owner, nick: '원작자', asset: '비트코인', parameters: { ...originalParameters },
    budgetIndex: 1, confirmedAt: 500, sessionId: id, active: true }
  return { currentId: id, homeDraft: '보존할 홈 초안', sessions: [session, previous], sharedFollows: [follow,
    { ...follow, id: 'other-owner-follow', owner: 'other@example.test', sessionId: 'other-session' },
    { ...follow, id: 'old-follow', sessionId: 'old-session', active: false }] }
}
type Fixture = ReturnType<typeof fixture>
async function mount(page: Page, state: Fixture = fixture(), options: { inlineCache?: boolean; raw?: string; omitFollows?: boolean } = {}) {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.route('**/inline-handoff-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Local handoff store fixture</body></html>' }))
  await page.goto('/inline-handoff-store.html')
  await page.evaluate(async ({ state, options, key, id, completedParameters }) => {
    const stored: Record<string, unknown> = { ...state }
    if (options.omitFollows) delete stored.sharedFollows
    sessionStorage.setItem(key, options.raw ?? JSON.stringify(stored))
    // A completed old shared verification must be archived from its effective
    // parameters, unless this cache belongs to a different inline result.
    const uiKey = `teth:client-delegation:${id}`
    const ui = { page: 'report', questionIndex: 5, attempt: 1, workStep: 5, expert: false, chartInterval: '1D', parameters: completedParameters,
      answers: { asset: { index: 0, label: '비트코인' }, style: { index: 1 }, budget: { index: 2 }, period: { index: 2 }, stop: { index: 1 } },
      ...(options.inlineCache ? { inlineResult: true, inlineTurnId: 'turn-1' } : {}) }
    sessionStorage.setItem(uiKey, JSON.stringify(ui))
    sessionStorage.setItem('teth-client-user-strategies:handoff%40example.test', '[{"fixture":"unrelated registration bytes"}]')
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    const originalUuid = crypto.randomUUID.bind(crypto)
    const f = { store, createClientExperienceStore, before: store.getSnapshot(), bytes: get.call(sessionStorage, key),
      uiBytes: get.call(sessionStorage, uiKey), writes: [] as string[], emits: 0, ids: 0, mode: '', attempted: false,
      raw: () => get.call(sessionStorage, key) }
    store.subscribe(() => { f.emits++ })
    crypto.randomUUID = () => { f.ids++; return originalUuid() }
    Storage.prototype.getItem = function (name) {
      if (name === key && f.mode === 'readback' && f.attempted) throw new Error('fixture readback failure')
      return get.call(this, name)
    }
    Storage.prototype.setItem = function (name, value) {
      f.writes.push(name)
      if (name !== key) return set.call(this, name, value)
      f.attempted = true
      if (f.mode === 'throw') throw new Error('fixture before write')
      if (f.mode === 'drop') return
      set.call(this, name, f.mode === 'corrupt' ? '{"unverified":"bytes"}' : value)
      if (f.mode === 'after') throw new Error('fixture after write')
    }
    Object.assign(window, { handoff: f })
  }, { state, options, key, id, completedParameters })
}

test('활성 카피 인라인 연결은 정확한 follow만 effective 조건으로 보관하고 experience 한 번만 저장한다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ id, owner, key }) => {
    const f = Reflect.get(window, 'handoff'), before = f.store.getSnapshot()
    const ok = f.store.connectInlineResult(id, 'turn-1', owner), after = f.store.getSnapshot()
    return { ok, before, after, stored: JSON.parse(f.raw()), writes: f.writes, emits: f.emits, ids: f.ids,
      uiSame: sessionStorage.getItem(`teth:client-delegation:${id}`) === f.uiBytes,
      bot: sessionStorage.getItem('teth-client-user-strategies:handoff%40example.test'),
      refreshed: f.createClientExperienceStore().getSnapshot(), expectedKey: key }
  }, { id, owner, key })
  expect(result.ok).toBe(true)
  expect(result.writes).toEqual([key]); expect(result.emits).toBe(1); expect(result.ids).toBe(0)
  expect(result.after.sessions[0]).toEqual({ ...result.before.sessions[0], inlineConnectionTurnId: 'turn-1', workspace: 'delegation', sharedCopy: { ...result.before.sessions[0].sharedCopy, active: false } })
  expect(result.after.sessions[1]).toEqual(result.before.sessions[1])
  expect(result.after.homeDraft).toBe(result.before.homeDraft)
  expect(result.after.sharedFollows[0]).toEqual({ ...result.before.sharedFollows[0], active: false, parameters: completedParameters, budgetIndex: 2 })
  expect(result.after.sharedFollows.slice(1)).toEqual(result.before.sharedFollows.slice(1))
  expect(result.uiSame).toBe(true); expect(result.bot).toBe('[{"fixture":"unrelated registration bytes"}]')
  expect(result.stored.sessions).toEqual(result.after.sessions)
  expect(result.refreshed.sessions).toEqual(result.after.sessions)
  expect(result.refreshed.sharedFollows).toEqual(result.after.sharedFollows)
})

test('동일 selector 재클릭은 no-op이고 inactive copy에서 다른 새 결과를 선택할 수 있다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ id, owner }) => {
    const f = Reflect.get(window, 'handoff')
    f.store.connectInlineResult(id, 'turn-1', owner)
    const first = f.store.getSnapshot(), firstRaw = f.raw()
    const duplicate = f.store.connectInlineResult(id, 'turn-1', owner)
    const noOp = { same: first === f.store.getSnapshot(), sameBytes: firstRaw === f.raw(), writes: f.writes.length, emits: f.emits }
    f.store.connectInlineResult(id, 'turn-2', owner)
    return { duplicate, noOp, first, after: f.store.getSnapshot(), writes: f.writes, emits: f.emits }
  }, { id, owner })
  expect(result.duplicate).toBe(true)
  expect(result.noOp).toEqual({ same: true, sameBytes: true, writes: 1, emits: 1 })
  expect(result.after.sessions[0].inlineConnectionTurnId).toBe('turn-2')
  expect(result.after.sharedFollows).toEqual(result.first.sharedFollows)
  expect(result.writes).toEqual([key, key]); expect(result.emits).toBe(2)
})

for (const mode of ['throw', 'drop']) test(`${mode}: 저장 실패는 snapshot·원문·구독을 보존하고 명시 재시도만 전환한다`, async ({ page }) => {
  await mount(page)
  const failure = await page.evaluate(({ id, owner, mode }) => {
    const f = Reflect.get(window, 'handoff'); f.mode = mode
    let error = ''
    try { f.store.connectInlineResult(id, 'turn-1', owner) } catch (e) { error = (e as Error).message }
    return { error, same: f.before === f.store.getSnapshot(), sameBytes: f.bytes === f.raw(), emits: f.emits, writes: f.writes }
  }, { id, owner, mode })
  expect(failure).toMatchObject({ error: expect.any(String), same: true, sameBytes: true, emits: 0, writes: [key] })
  const retry = await page.evaluate(({ id, owner }) => {
    const f = Reflect.get(window, 'handoff'); f.mode = ''
    return { ok: f.store.connectInlineResult(id, 'turn-1', owner), writes: f.writes, emits: f.emits, after: f.store.getSnapshot() }
  }, { id, owner })
  expect(retry.ok).toBe(true); expect(retry.writes).toEqual([key, key]); expect(retry.emits).toBe(1)
  expect(retry.after.sharedFollows[0].active).toBe(false)
})

test('setItem이 저장 후 throw해도 exact new bytes가 확인되면 한 번만 publish한다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ id, owner }) => {
    const f = Reflect.get(window, 'handoff'); f.mode = 'after'
    const ok = f.store.connectInlineResult(id, 'turn-1', owner)
    f.store.connectInlineResult(id, 'turn-1', owner)
    return { ok, writes: f.writes, emits: f.emits, raw: JSON.parse(f.raw()), state: f.store.getSnapshot() }
  }, { id, owner })
  expect(result.ok).toBe(true); expect(result.writes).toEqual([key]); expect(result.emits).toBe(1)
  expect(result.raw.sessions).toEqual(result.state.sessions)
})

for (const mode of ['readback', 'corrupt']) test(`${mode}: 모호한 결과는 publish하지 않고 debounce·flush·추가 전환의 old overwrite를 차단한다`, async ({ page }) => {
  await mount(page)
  const initial = await page.evaluate(({ id, owner, mode }) => {
    const f = Reflect.get(window, 'handoff')
    f.store.draft('저장 대기 초안')
    const before = f.store.getSnapshot(), emits = f.emits
    f.mode = mode
    let error = ''
    try { f.store.connectInlineResult(id, 'turn-1', owner) } catch (e) { error = (e as Error).message }
    return { error, same: before === f.store.getSnapshot(), emitDelta: f.emits - emits, raw: f.raw() }
  }, { id, owner, mode })
  expect(initial).toMatchObject({ error: uncertain, same: true, emitDelta: 0 })
  await page.clock.fastForward(1000)
  const after = await page.evaluate(({ id, owner }) => {
    const f = Reflect.get(window, 'handoff'); f.mode = ''
    f.store.flush()
    // Existing ordinary in-memory editing is not globally redesigned. It must
    // still never overwrite the unverified durable result through persist.
    f.store.draft('새로고침 전 메모리 초안'); f.store.flush()
    const errors: string[] = []
    for (const action of [() => f.store.connectInlineResult(id, 'turn-1', owner), () => f.store.archiveSharedFollow(owner, 'follow-exact')]) {
      try { action() } catch (e) { errors.push((e as Error).message) }
    }
    return { errors, raw: f.raw(), writes: f.writes, restored: f.createClientExperienceStore().getSnapshot() }
  }, { id, owner })
  expect(after.errors[0]).toBe(uncertain); expect(after.errors).toHaveLength(2)
  expect(after.raw).toBe(initial.raw); expect(after.writes).toEqual([key])
  if (mode === 'readback') expect(after.restored.sessions[0].inlineConnectionTurnId).toBe('turn-1')
})

for (const mismatch of ['current', 'session', 'owner', 'guest', 'follow-id', 'follow-owner', 'follow-session', 'follow-inactive', 'result', 'result-corrupt', 'running', 'pending', 'score']) {
  test(`${mismatch}: 최신 메모리의 stale handoff는 저장·emit·UUID 없이 거절한다`, async ({ page }) => {
    await mount(page)
    const result = await page.evaluate(({ id, owner, mismatch }) => {
      const f = Reflect.get(window, 'handoff'), state = f.store.getSnapshot(), session = state.sessions[0]
      let requestedId = id, actor: string | null = owner, turnId = 'turn-1'
      if (mismatch === 'current') state.currentId = 'previous-chat'
      if (mismatch === 'session') requestedId = 'missing'
      if (mismatch === 'owner') actor = 'other@example.test'
      if (mismatch === 'guest') actor = null
      if (mismatch === 'follow-id') session.sharedCopy.followId = 'missing'
      if (mismatch === 'follow-owner') state.sharedFollows[0].owner = 'changed@example.test'
      if (mismatch === 'follow-session') state.sharedFollows[0].sessionId = 'replacement-job'
      if (mismatch === 'follow-inactive') state.sharedFollows[0].active = false
      if (mismatch === 'result') turnId = 'missing'
      if (mismatch === 'result-corrupt') session.inlineResults[0].completedAt++
      if (mismatch === 'running') session.turns.at(-1).status = 'running'
      if (mismatch === 'pending') session.inlineResults.pop()
      if (mismatch === 'score') {
        const p = { ...session.inlineResults[0].parameters, startI: session.inlineResults[0].parameters.endI }
        session.inlineResults[0] = { ...session.inlineResults[0], parameters: p }
        session.turns[0] = { ...session.turns[0], inlineRequest: { ...session.turns[0].inlineRequest, parameters: p } }
      }
      let error = ''
      try { f.store.connectInlineResult(requestedId, turnId, actor) } catch (e) { error = (e as Error).message }
      return { error, same: state === f.store.getSnapshot(), sameBytes: f.raw() === f.bytes, writes: f.writes, emits: f.emits, ids: f.ids }
    }, { id, owner, mismatch })
    expect(result).toEqual({ error: expect.any(String), same: true, sameBytes: true, writes: [], emits: 0, ids: 0 })
    expect(result.error.length).toBeGreaterThan(0)
  })
}

test('storageError는 연결을 막는다', async ({ page }) => {
  await mount(page, fixture(), { raw: '{broken' })
  const denied = await page.evaluate(({ id }) => {
    const f = Reflect.get(window, 'handoff'); let error = ''
    try { f.store.connectInlineResult(id, 'turn-1', null) } catch (e) { error = (e as Error).message }
    return { error, writes: f.writes, storageError: f.store.getSnapshot().storageError }
  }, { id })
  expect(denied).toMatchObject({ error: expect.any(String), writes: [], storageError: true })
})

test('sharedCopy 없는 guest는 유효 결과를 선택할 수 있다', async ({ page }) => {
  const state = fixture(); delete state.sessions[0].sharedCopy
  await mount(page, state)
  const allowed = await page.evaluate(({ id }) => Reflect.get(window, 'handoff').store.connectInlineResult(id, 'turn-1', null), { id })
  expect(allowed).toBe(true)
})

for (const invalid of ['missing', 'type', 'active-copy', 'broken-result', 'low-score']) test(`${invalid}: 잘못된 selector만 제거하고 대화 복구 안내·원문·다른 자료를 보존한다`, async ({ page }) => {
  const state = fixture(), session = state.sessions[0]
  session.workspace = 'delegation'; session.inlineConnectionTurnId = 'turn-1'
  session.sharedCopy!.active = invalid === 'active-copy'
  state.sharedFollows[0].active = session.sharedCopy!.active
  if (invalid === 'missing') session.inlineConnectionTurnId = 'absent'
  if (invalid === 'type') Reflect.set(session, 'inlineConnectionTurnId', 42)
  if (invalid === 'broken-result') session.inlineResults![0].completedAt++
  if (invalid === 'low-score') {
    const p = { ...parameters, startI: parameters.endI }
    session.inlineResults![0].parameters = p; session.turns[0].inlineRequest = { ...session.turns[0].inlineRequest!, parameters: p }
  }
  await mount(page, state)
  const restored = await page.evaluate(() => {
    const f = Reflect.get(window, 'handoff')
    return { snapshot: f.store.getSnapshot(), sameBytes: f.raw() === f.bytes, writes: f.writes }
  })
  expect(restored.snapshot.recoveryWarning).toBe(true)
  expect(restored.snapshot.sessions[0]).not.toHaveProperty('inlineConnectionTurnId')
  expect(restored.snapshot.sessions[0].workspace).toBe('conversation')
  expect(restored.snapshot.sessions[0].draft).toBe(session.draft)
  expect(restored.snapshot.sessions[0].sharedCopy).toEqual(session.sharedCopy)
  expect(restored.snapshot.sessions[1]).toEqual(state.sessions[1])
  expect(restored.snapshot.homeDraft).toBe(state.homeDraft)
  expect(restored.sameBytes).toBe(true); expect(restored.writes).toEqual([])
})

for (const provenance of ['selector', 'invalid-selector', 'inline-cache']) test(`${provenance}: legacy 후보 복원은 인라인 조건을 원작자 follow로 합성하지 않는다`, async ({ page }) => {
  const state = fixture(); state.sessions[0].sharedCopy!.active = false
  if (provenance === 'selector') state.sessions[0].inlineConnectionTurnId = 'turn-1'
  if (provenance === 'invalid-selector') state.sessions[0].inlineConnectionTurnId = 'missing'
  await mount(page, state, { omitFollows: true, inlineCache: provenance === 'inline-cache' })
  expect(await page.evaluate(() => Reflect.get(window, 'handoff').store.getSnapshot().sharedFollows)).toEqual([])
})

test('legacy followId 없는 active copy도 session.id와 정확히 결속된 follow만 해제한다', async ({ page }) => {
  const state = fixture()
  delete state.sessions[0].sharedCopy!.followId
  state.sharedFollows[0].id = id
  await mount(page, state)
  const result = await page.evaluate(({ id, owner }) => {
    const f = Reflect.get(window, 'handoff')
    return { ok: f.store.connectInlineResult(id, 'turn-1', owner), state: f.store.getSnapshot(), writes: f.writes }
  }, { id, owner })
  expect(result.ok).toBe(true)
  expect(result.state.sharedFollows[0]).toMatchObject({ id, active: false })
  expect(result.writes).toEqual([key])
})

test('effectiveFollow는 inline cache의 완료 조건으로 원작자 조건을 덮어쓰지 않는다', async ({ page }) => {
  await mount(page, fixture(), { inlineCache: true })
  const result = await page.evaluate(({ id, owner }) => {
    const f = Reflect.get(window, 'handoff'), before = f.store.getSnapshot().sharedFollows[0]
    f.store.connectInlineResult(id, 'turn-1', owner)
    return { before, after: f.store.getSnapshot().sharedFollows[0], writes: f.writes }
  }, { id, owner })
  expect(result.after).toEqual({ ...result.before, active: false })
  expect(result.after.parameters).toEqual(originalParameters)
  expect(result.writes).toEqual([key])
})
