import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

// Real local-preview stores with controlled browser Storage, not server-job or
// account authority. No timer implementation or product method is substituted.
const key = 'teth-client-experience', owner = 'research@example.test'
const now = Date.UTC(2026, 8, 16, 12)
const uncertain = '저장 여부를 확인할 수 없어요. 새로고침해 저장된 기록을 확인해주세요.'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
const scopeOf = (id: string, turn: string) => `inline-plan:${JSON.stringify([id, turn])}`
const replayKey = (scope: string) => `teth-research-preview:restored:${scope}`
function session(id: string): ClientSession {
  const turns: ClientTurn[] = [1, 2].map(n => ({ id: `turn-${n}`, question: 'ETH 추세 손절 5% 익절 12%', answer: '완료', fullAnswer: '완료',
    startedAt: n * 1000, finishedAt: n * 1000 + 100, status: 'done', phase: 'plan', suggestions: [],
    inlineRequest: { parameters: { ...parameters, sl: n === 1 ? -5 : -7 }, pair: 'ETH/USDT', timeframe: '1시간봉' } }))
  return { id, title: `${id} 연구`, idea: '보존할 원문', draft: `${id} 초안`, pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '-8%',
    takeProfit: '+15%', researchStatus: '초안', phase: 'plan', turns, updatedAt: 4000, workspace: 'research', tradingReady: false,
    inlineResults: turns.map((turn, index) => ({ ...turn.inlineRequest!, turnId: turn.id, ordinal: index + 1, completedAt: turn.finishedAt! + 1100 })) }
}
function fixture() { return { currentId: 'a', homeDraft: '홈 초안', sessions: [session('a'), session('b')], sharedFollows: [] } }
function playing(startedAt = now, status = 'playing') {
  return { seconds: 0, status, view: 'activity', questions: [], clockVersion: 1, ...(status === 'playing' ? { clockStartedAt: startedAt } : {}) }
}
async function mount(page: Page, state = fixture(), caches: Record<string, unknown> = {}, readFailKey = '') {
  await page.clock.install({ time: new Date(now) })
  await page.route('**/research-lifecycle-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Research lifecycle fixture</body></html>' }))
  await page.goto('/research-lifecycle-store.html')
  await page.evaluate(async ({ state, caches, key, readFailKey }) => {
    sessionStorage.setItem(key, JSON.stringify(state))
    Object.entries(caches).forEach(([name, value]) => sessionStorage.setItem(name, JSON.stringify(value)))
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
    const readFailure = { key: readFailKey }, writes: string[] = []
    // Install before imports/create: a constructor read must see the same
    // single-key failure as later observations, without touching seed bytes.
    Storage.prototype.getItem = function (name) {
      if (name === readFailure.key) throw new Error('fixture preview read unavailable')
      return get.call(this, name)
    }
    Storage.prototype.setItem = function (name, value) { writes.push(name); set.call(this, name, value) }
    const storePath = '/src/client-experience-store.ts', previewPath = '/src/mock-research-preview.ts'
    const scopePath = '/src/client-research-lifecycle.ts', documentPath = '/src/client-research-cache.ts'
    const [experience, preview, lifecycle, documents] = await Promise.all([
      import(/* @vite-ignore */ storePath), import(/* @vite-ignore */ previewPath),
      import(/* @vite-ignore */ scopePath), import(/* @vite-ignore */ documentPath),
    ])
    const store = experience.createClientExperienceStore()
    const f = { store, experience, preview, lifecycle, documents, readFailure, writes, removes: [] as string[], failKey: '', mode: '', attempted: false,
      raw: (name = key) => get.call(sessionStorage, name), replay: (scope: string) => preview.getMockResearchPreview(`restored:${scope}`),
      reset: () => { f.writes.length = 0; f.removes.length = 0 } }
    Storage.prototype.getItem = function (name) {
      if (name === readFailure.key) throw new Error('fixture preview read unavailable')
      if (name === key && f.mode === 'readback' && f.attempted) throw new Error('fixture readback unavailable')
      return get.call(this, name)
    }
    Storage.prototype.setItem = function (name, value) {
      f.writes.push(name)
      if (name === f.failKey) throw new Error('fixture storage unavailable')
      set.call(this, name, value)
      if (name === key) f.attempted = true
    }
    Storage.prototype.removeItem = function (name) { f.removes.push(name); remove.call(this, name) }
    Object.assign(window, { lifecycleFixture: f })
  }, { state, caches, key, readFailKey })
}

test('94.999초에는 차단하고 95초에는 같은 클릭에서 완료를 따라잡아 시작한다', async ({ page }) => {
  const state = fixture(); state.currentId = 'b'; state.sessions[0].researchStatus = '진행 중'
  await mount(page, state, { [replayKey('a')]: playing() })
  const result = await page.evaluate(({ now, owner }) => {
    const f = Reflect.get(window, 'lifecycleFixture')
    let error = ''
    try { f.store.startResearch('b', 'b', owner, now + 94_999) } catch (e) { error = (e as Error).message }
    const blocked = { error, b: f.replay('b').getSnapshot(), state: f.store.getSnapshot() }
    const ok = f.store.startResearch('b', 'b', owner, now + 95_000)
    return { blocked, ok, a: f.replay('a').getSnapshot(), b: f.replay('b').getSnapshot(), state: f.store.getSnapshot() }
  }, { now, owner })
  expect(result.blocked.error).toBe('다른 연구가 진행 중이에요: a 연구. 완료 후 시작할 수 있어요')
  expect(result.blocked.b.status).toBe('idle')
  expect(result.blocked.state.sessions[1].researchStatus).toBe('초안')
  expect(result.ok).toBe(true)
  expect(result.a).toMatchObject({ status: 'completed', seconds: 95 })
  expect(result.b).toMatchObject({ status: 'playing', seconds: 0, clockStartedAt: now + 95_000 })
  expect(result.state.sessions[1].researchStatus).toBe('진행 중')
})

test('동일 tick 연타는 시작 시각을 유지하고 React effect 이전에도 다른 세션 시작을 막는다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ now, owner }) => {
    const f = Reflect.get(window, 'lifecycleFixture')
    f.store.startResearch('a', 'a', owner, now)
    const reserved = f.store.getSnapshot().sessions[0].researchStatus
    f.store.startResearch('a', 'a', owner, now)
    f.store.select('b')
    let error = ''
    try { f.store.startResearch('b', 'b', owner, now) } catch (e) { error = (e as Error).message }
    return { reserved, error, a: f.replay('a').getSnapshot(), b: f.replay('b').getSnapshot(), writes: f.writes }
  }, { now, owner })
  expect(result.reserved).toBe('진행 중'); expect(result.error).toContain('다른 연구가 진행 중')
  expect(result.a.clockStartedAt).toBe(now); expect(result.b.status).toBe('idle')
  expect(result.writes.filter((name: string) => name === replayKey('a'))).toHaveLength(1)
})

for (const status of ['playing', 'paused']) test(`방문한 과거 scope의 ${status} 연구도 새 계획 시작을 막는다`, async ({ page }) => {
  const state = fixture(), old = scopeOf('a', 'turn-1'), current = scopeOf('a', 'turn-2')
  Object.assign(state.sessions[0], { researchPlanTurnId: 'turn-2', researchPlanTurnIds: ['turn-1', 'turn-2'] })
  await mount(page, state, { [replayKey(old)]: playing(now, status) })
  const result = await page.evaluate(({ owner, now, current, old }) => {
    const f = Reflect.get(window, 'lifecycleFixture'); let error = ''
    try { f.store.startResearch('a', current, owner, now) } catch (e) { error = (e as Error).message }
    return { error, old: f.replay(old).getSnapshot(), current: f.replay(current).getSnapshot(), writes: f.writes }
  }, { owner, now, current, old })
  expect(result.error).toContain('다른 연구가 진행 중'); expect(result.old.status).toBe(status)
  expect(result.current.status).toBe('idle'); expect(result.writes).toEqual([])
})

for (const variant of ['deleted', 'current', 'scope', 'workspace', 'owner', 'guest', 'time'] as const) test(`${variant}: 오래된 시작 요청은 저장하지 않는다`, async ({ page }) => {
  const state = fixture()
  if (variant === 'deleted') state.sessions = state.sessions.filter(s => s.id !== 'a')
  if (variant === 'current') state.currentId = 'b'
  if (variant === 'workspace') state.sessions[0].workspace = 'conversation'
  if (variant === 'scope') Object.assign(state.sessions[0], { researchPlanTurnId: 'turn-1', researchPlanTurnIds: ['turn-1'] })
  if (variant === 'owner' || variant === 'guest') state.sessions[0].sharedCopy = { owner, nick: '원작자', active: false, confirmedAt: 500, returnId: null }
  await mount(page, state)
  const result = await page.evaluate(({ owner, now, variant }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(), raw = f.raw(); let error = ''
    try { f.store.startResearch('a', 'a', variant === 'guest' ? null : variant === 'owner' ? 'other@example.test' : owner, variant === 'time' ? NaN : now) } catch (e) { error = (e as Error).message }
    return { error, same: f.store.getSnapshot() === before, rawSame: raw === f.raw(), writes: f.writes }
  }, { owner, now, variant })
  expect(result.error).not.toBe(''); expect(result).toMatchObject({ same: true, rawSame: true, writes: [] })
})

test('기존 storageError에서는 catch-up이나 시작 저장도 하지 않는다', async ({ page }) => {
  await mount(page, fixture(), { [replayKey('b')]: playing(now - 100_000) })
  const result = await page.evaluate(({ owner, now, key }) => {
    const f = Reflect.get(window, 'lifecycleFixture'); f.failKey = key; f.store.flush(); f.failKey = ''; f.reset()
    const before = f.store.getSnapshot(), raw = f.raw(); let error = ''
    try { f.store.startResearch('a', 'a', owner, now) } catch (e) { error = (e as Error).message }
    return { error, storageError: before.storageError, same: before === f.store.getSnapshot(), rawSame: raw === f.raw(), writes: f.writes }
  }, { owner, now, key })
  expect(result).toEqual({ error: '기존 대화 기록을 확인한 뒤 다시 시도해주세요.', storageError: true, same: true, rawSame: true, writes: [] })
})

test('불확실한 계획 저장은 quarantine에 들어가 후속 시작·상태동기화 쓰기를 막는다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ owner, now }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(); f.mode = 'readback'; f.attempted = false
    const errors: string[] = []
    try { f.store.openResearchPlan('a', 'turn-1', owner) } catch (e) { errors.push((e as Error).message) }
    const raw = f.raw(); f.reset(); f.mode = ''
    try { f.store.startResearch('a', 'a', owner, now) } catch (e) { errors.push((e as Error).message) }
    f.store.syncResearchStatus('a'); f.store.flush()
    return { errors, uncertain: f.store.commitUncertain(), same: before === f.store.getSnapshot(), rawSame: raw === f.raw(), writes: f.writes }
  }, { owner, now })
  expect(result).toEqual({ errors: [uncertain, uncertain], uncertain: true, same: true, rawSame: true, writes: [] })
})

test('replay 저장 실패에도 메모리 실행을 유지하고 다른 연구를 중복 시작하지 않는다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ owner, now, failedKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'); f.failKey = failedKey
    f.store.startResearch('a', 'a', owner, now)
    const a = f.replay('a').getSnapshot(), status = f.store.getSnapshot().sessions[0].researchStatus
    f.failKey = ''; f.store.select('b'); let error = ''
    try { f.store.startResearch('b', 'b', owner, now) } catch (e) { error = (e as Error).message }
    return { a, status, error, b: f.replay('b').getSnapshot() }
  }, { owner, now, failedKey: replayKey('a') })
  expect(result.a).toMatchObject({ status: 'playing', storageError: true, clockStartedAt: now })
  expect(result.status).toBe('진행 중'); expect(result.error).toContain('다른 연구가 진행 중'); expect(result.b.status).toBe('idle')
})

test('계획 selector·방문 목록·조건은 결과별이고 legacy 캐시와 대화 원문은 보존한다', async ({ page }) => {
  const legacy = { ...playing(), status: 'completed', seconds: 95 }
  await mount(page, fixture(), { [replayKey('a')]: legacy, 'teth-client-research-documents:a': { draft: 'legacy 문서 초안' } })
  const result = await page.evaluate(({ owner, legacyKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(), legacyRaw = f.raw(legacyKey), docRaw = f.raw('teth-client-research-documents:a')
    f.store.openResearchPlan('a', 'turn-1', owner)
    const first = f.store.getSnapshot().sessions[0], firstContext = f.lifecycle.researchPlanContext(first)
    f.store.openResearchPlan('a', 'turn-2', owner); f.store.openResearchPlan('a', 'turn-1', owner)
    const after = f.store.getSnapshot(), reloaded = f.experience.createClientExperienceStore().getSnapshot()
    return { before, after, first, firstContext, reloaded, scopes: f.lifecycle.researchScopes(after.sessions[0]),
      legacySame: legacyRaw === f.raw(legacyKey), docSame: docRaw === f.raw('teth-client-research-documents:a') }
  }, { owner, legacyKey: replayKey('a') })
  expect(result.first.researchPlanTurnId).toBe('turn-1'); expect(result.first.researchStatus).toBe('초안')
  expect(result.firstContext).toMatchObject({ pair: 'ETH/USDT', mode: 'trend', timeframe: '1시간봉', risk: '−5%', takeProfit: '+12%', parameters })
  expect(result.after.sessions[0]).toMatchObject({ researchPlanTurnId: 'turn-1', researchPlanTurnIds: ['turn-1', 'turn-2'], workspace: 'research' })
  expect(result.scopes).toEqual(['a', scopeOf('a', 'turn-1'), scopeOf('a', 'turn-2')])
  expect(result.after.sessions[0].turns).toEqual(result.before.sessions[0].turns)
  expect(result.after.sessions[0].inlineResults).toEqual(result.before.sessions[0].inlineResults)
  expect(result.after.sessions[0].draft).toBe(result.before.sessions[0].draft)
  expect(result.after.sessions[1]).toEqual(result.before.sessions[1]); expect(result.after.homeDraft).toBe(result.before.homeDraft)
  expect(result.reloaded.sessions).toEqual(result.after.sessions)
  expect(result.legacySame).toBe(true); expect(result.docSame).toBe(true)
})

test('숨겨진 원 scope가 경과 후 완료되고 새 계획과 혼동 없이 새 store에서도 복원된다', async ({ page }) => {
  await mount(page)
  await page.evaluate(({ owner, now }) => {
    const f = Reflect.get(window, 'lifecycleFixture')
    f.store.openResearchPlan('a', 'turn-1', owner)
    f.store.startResearch('a', f.lifecycle.researchScope(f.store.getSnapshot().sessions[0]), owner, now)
    f.store.openResearchPlan('a', 'turn-2', owner)
  }, { owner, now })
  await page.clock.fastForward(95_000)
  const result = await page.evaluate(({ owner, now }) => {
    const f = Reflect.get(window, 'lifecycleFixture'); f.store.tick(now + 95_000)
    const before = f.store.getSnapshot().sessions[0]
    const oldScope = f.lifecycle.researchScope(before, 'turn-1'), newScope = f.lifecycle.researchScope(before, 'turn-2')
    const old = f.replay(oldScope).getSnapshot(), current = f.replay(newScope).getSnapshot()
    f.preview.forgetMockResearchPreview(`restored:${oldScope}`)
    const reloaded = f.experience.createClientExperienceStore(); reloaded.openResearchPlan('a', 'turn-1', owner)
    return { before, old, current, restored: f.replay(oldScope).getSnapshot(), after: reloaded.getSnapshot().sessions[0] }
  }, { owner, now })
  expect(result.before.researchPlanTurnId).toBe('turn-2'); expect(result.before.researchStatus).toBe('검토 필요')
  expect(result.old).toMatchObject({ status: 'completed', seconds: 95 }); expect(result.current.status).toBe('idle')
  expect(result.restored).toMatchObject({ status: 'completed', seconds: 95 })
  expect(result.after).toMatchObject({ researchPlanTurnId: 'turn-1', researchStatus: '검토 필요' })
})

test('손상 selector는 원문 쓰기 없이 대화로 회복하고 유효 결과를 명시 선택하면 복구된다', async ({ page }) => {
  const state = fixture()
  Object.assign(state.sessions[0], { researchPlanTurnId: 'missing', researchPlanTurnIds: ['turn-1', 'missing', 'turn-1', 42] })
  await mount(page, state)
  const result = await page.evaluate(({ owner }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(), raw = f.raw(), writes = [...f.writes]; let error = ''
    try { f.store.openResearchPlan('a', 'missing', owner) } catch (e) { error = (e as Error).message }
    const preserved = raw === f.raw()
    f.store.openResearchPlan('a', 'turn-1', owner)
    return { before, writes, error, preserved, after: f.store.getSnapshot() }
  }, { owner })
  expect(result.before.recoveryWarning).toBe(true)
  expect(result.before.sessions[0]).toMatchObject({ workspace: 'conversation', researchPlanRecovery: true, researchPlanTurnIds: ['turn-1', 'missing'] })
  expect(result.before.sessions[0].researchPlanTurnId).toBeUndefined(); expect(result.writes).toEqual([])
  expect(result.error).toBe('계획에 사용할 검증 결과를 다시 확인해주세요.'); expect(result.preserved).toBe(true)
  expect(result.after.sessions[0]).toMatchObject({ workspace: 'research', researchPlanTurnId: 'turn-1' })
  expect(result.after.sessions[0].researchPlanRecovery).toBeUndefined()
})

for (const variant of ['current', 'owner', 'result', 'write'] as const) test(`${variant}: 계획 열기 실패는 selector·방문 목록·초안을 publish하지 않는다`, async ({ page }) => {
  const state = fixture()
  if (variant === 'current') state.currentId = 'b'
  if (variant === 'owner') state.sessions[0].sharedCopy = { owner, nick: '원작자', active: false, confirmedAt: 500, returnId: null }
  await mount(page, state)
  const result = await page.evaluate(({ owner, variant, key }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(), raw = f.raw(); let error = ''
    if (variant === 'write') f.failKey = key
    try { f.store.openResearchPlan('a', variant === 'result' ? 'missing' : 'turn-1', variant === 'owner' ? 'other@example.test' : owner) } catch (e) { error = (e as Error).message }
    return { error, same: before === f.store.getSnapshot(), rawSame: raw === f.raw(), writes: f.writes, uncertain: f.store.commitUncertain() }
  }, { owner, variant, key })
  expect(result.error).not.toBe('')
  expect(result).toMatchObject({ same: true, rawSame: true, uncertain: false, writes: variant === 'write' ? [key] : [] })
})

test('세션 삭제는 legacy·방문 scope 캐시와 메모리만 제거하고 다른 세션은 보존한다', async ({ page }) => {
  const state = fixture()
  for (const s of state.sessions) Object.assign(s, { researchPlanTurnId: 'turn-2', researchPlanTurnIds: ['turn-1', 'turn-2'] })
  await mount(page, state)
  const result = await page.evaluate(() => {
    const f = Reflect.get(window, 'lifecycleFixture'), scopes = f.store.getSnapshot().sessions.flatMap((s: ClientSession) => f.lifecycle.researchScopes(s))
    const originals = scopes.map((scope: string) => {
      const replay = f.replay(scope); replay.view('plan')
      f.documents.writeResearchDocumentCache(scope, { note: scope })
      return { scope, replay, bytes: f.raw(`teth-research-preview:restored:${scope}`), document: f.raw(`teth-client-research-documents:${scope}`) }
    })
    f.reset(); const removed = f.store.remove('a')
    return { removed, sessions: f.store.getSnapshot().sessions, rows: originals.map(({ scope, replay, bytes, document }: { scope: string; replay: unknown; bytes: string; document: string }) => ({
      scope, bytes, document, now: f.raw(`teth-research-preview:restored:${scope}`), docNow: f.raw(`teth-client-research-documents:${scope}`),
      sameMemory: replay === f.replay(scope), documentMemory: f.documents.readResearchDocumentCache(scope),
    })) }
  })
  expect(result.removed).toBe(true); expect(result.sessions.map((s: ClientSession) => s.id)).toEqual(['b'])
  for (const row of result.rows) {
    if (['a', scopeOf('a', 'turn-1'), scopeOf('a', 'turn-2')].includes(row.scope)) {
      expect(row.now).toBeNull(); expect(row.docNow).toBeNull(); expect(row.sameMemory).toBe(false); expect(row.documentMemory).toBeNull()
    } else {
      expect(row.now).toBe(row.bytes); expect(row.docNow).toBe(row.document); expect(row.sameMemory).toBe(true)
      expect(row.documentMemory).toEqual({ note: row.scope })
    }
  }
})

test('과거 결과만 손상되어도 방문 scope의 실행 잠금과 삭제 대상은 보존한다', async ({ page }) => {
  const state = fixture(), oldScope = scopeOf('a', 'turn-1'), currentScope = scopeOf('a', 'turn-2')
  Object.assign(state.sessions[0], { researchPlanTurnId: 'turn-2', researchPlanTurnIds: ['turn-1', 'turn-2'], researchStatus: '진행 중' })
  const oldRecord = state.sessions[0].inlineResults![0]
  Object.assign(oldRecord, { parameters: { ...oldRecord.parameters, sl: 'damaged' } })
  const oldKey = replayKey(oldScope), documentKey = `teth-client-research-documents:${oldScope}`
  await mount(page, state, { [oldKey]: playing(), [documentKey]: { note: '보존할 이전 연구 문서' }, [replayKey('b')]: playing(now, 'idle') })
  const read = await page.evaluate(({ oldScope, oldKey, documentKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), snapshot = f.store.getSnapshot()
    return { snapshot, raw: f.raw(), writes: [...f.writes], scopes: f.lifecycle.researchScopes(snapshot.sessions[0]),
      oldRaw: f.raw(oldKey), documentRaw: f.raw(documentKey), old: f.replay(oldScope).getSnapshot() }
  }, { oldScope, oldKey, documentKey })
  expect(read.snapshot.recoveryWarning).toBe(true)
  expect(read.snapshot.sessions[0].inlineResults.map((record: { turnId: string }) => record.turnId)).toEqual(['turn-2'])
  expect(read.snapshot.sessions[0]).toMatchObject({ researchPlanTurnId: 'turn-2', researchPlanTurnIds: ['turn-1', 'turn-2'], researchStatus: '진행 중' })
  expect(read.scopes).toEqual(['a', oldScope, currentScope])
  expect(read.raw).toBe(JSON.stringify(state)); expect(read.writes).toEqual([])
  expect(read.old).toMatchObject({ status: 'playing', clockStartedAt: now })

  const result = await page.evaluate(({ owner, now, currentScope, oldScope, oldKey, documentKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(), raw = f.raw()
    const oldReplay = f.replay(oldScope), bRaw = f.raw('teth-research-preview:restored:b'); let error = ''
    try { f.store.startResearch('a', currentScope, owner, now) } catch (e) { error = (e as Error).message }
    const blocked = { error, same: before === f.store.getSnapshot(), rawSame: raw === f.raw(), writes: [...f.writes],
      oldRaw: f.raw(oldKey), documentRaw: f.raw(documentKey), next: f.replay(currentScope).getSnapshot() }
    const removed = f.store.remove('a')
    return { blocked, removed, oldRaw: f.raw(oldKey), documentRaw: f.raw(documentKey), oldMemoryRemoved: oldReplay !== f.replay(oldScope),
      bSame: bRaw === f.raw('teth-research-preview:restored:b'), remaining: f.store.getSnapshot().sessions.map((s: ClientSession) => s.id) }
  }, { owner, now, currentScope, oldScope, oldKey, documentKey })
  expect(result.blocked.error).toContain('다른 연구가 진행 중')
  expect(result.blocked).toMatchObject({ same: true, rawSame: true, writes: [], oldRaw: read.oldRaw, documentRaw: read.documentRaw })
  expect(result.blocked.next.status).toBe('idle')
  expect(result).toMatchObject({ removed: true, oldRaw: null, documentRaw: null, oldMemoryRemoved: true, bSame: true, remaining: ['b'] })
})

test('legacy replay 읽기 실패는 진행 상태와 원문을 유지하고 새 map에서 정상 복원한다', async ({ page }) => {
  const state = fixture(); state.sessions[0].researchStatus = '진행 중'
  const oldKey = replayKey('a'), original = playing(now - 10_000)
  await mount(page, state, { [oldKey]: original }, oldKey)
  const blocked = await page.evaluate(({ owner, now, oldKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), raw = f.raw(oldKey)
    const unknown = f.replay('a').getSnapshot()
    f.store.syncResearchStatus('a')
    const afterSync = f.store.getSnapshot().sessions[0].researchStatus
    // Opening the new plan may be refused or may remain read-only. Neither
    // policy may reclassify the unknown prior run as an idle completed read.
    let openError = '', startError = ''
    try { f.store.openResearchPlan('a', 'turn-2', owner) } catch (e) { openError = (e as Error).message }
    const current = f.store.getSnapshot().sessions[0], scope = f.lifecycle.researchScope(current)
    try { f.store.startResearch('a', scope, owner, now) } catch (e) { startError = (e as Error).message }
    return { unknown, afterSync, openError, startError, scope, status: f.store.getSnapshot().sessions[0].researchStatus,
      raw, sameBytes: raw === f.raw(oldKey), writes: [...f.writes], replayAfter: f.replay('a').getSnapshot() }
  }, { owner, now, oldKey })
  expect(blocked.unknown).toMatchObject({ recoveryRequired: true, storageError: true })
  expect(blocked.afterSync).toBe('진행 중'); expect(blocked.status).toBe('진행 중')
  expect(blocked.startError).not.toBe('')
  expect(blocked.raw).toBe(JSON.stringify(original)); expect(blocked.sameBytes).toBe(true)
  expect(blocked.writes).not.toContain(oldKey)
  // No fabricated start timestamp from a failed read is accepted as recovery.
  expect(blocked.replayAfter.clockStartedAt).not.toBe(now)

  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
  const recovered = await page.evaluate(({ owner, now, oldKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'); f.readFailure.key = ''
    // Fresh preview map + fresh experience store is the reload boundary;
    // sessionStorage is deliberately left untouched.
    for (const s of f.store.getSnapshot().sessions) {
      for (const scope of f.lifecycle.researchScopes(s)) f.preview.forgetMockResearchPreview(`restored:${scope}`)
    }
    const observedAt = Date.now()
    const fresh = f.experience.createClientExperienceStore(), restored = f.replay('a').getSnapshot()
    fresh.select('b'); let error = ''
    try { fresh.startResearch('b', 'b', owner, now) } catch (e) { error = (e as Error).message }
    return { observedAt, restored, error, status: fresh.getSnapshot().sessions[0].researchStatus, raw: f.raw(oldKey), b: f.replay('b').getSnapshot() }
  }, { owner, now, oldKey })
  expect(recovered.restored).toMatchObject({ status: 'playing', seconds: (recovered.observedAt - (now - 10_000)) / 1000, clockStartedAt: now - 10_000, storageError: false })
  expect(recovered.error).toContain('다른 연구가 진행 중')
  expect(recovered.status).toBe('진행 중'); expect(recovered.raw).toBe(JSON.stringify(original)); expect(recovered.b.status).toBe('idle')
})

for (const anchor of [0, -1, now + 10_000_000, now - 0.5, undefined]) test(`손상된 실행 anchor ${anchor}는 완료·새 시작으로 승격하지 않는다`, async ({ page }) => {
  const state = fixture(); state.sessions[0].researchStatus = '진행 중'
  const oldKey = replayKey('a'), original = { ...playing(), clockStartedAt: anchor, seconds: 5 }
  await mount(page, state, { [oldKey]: original })
  const result = await page.evaluate(({ owner, now, oldKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), raw = f.raw(oldKey), replay = f.replay('a')
    f.store.syncResearchStatus('a')
    replay.view('plan'); replay.start(now); replay.finish()
    let error = ''
    try { f.store.startResearch('a', 'a', owner, now) } catch (e) { error = (e as Error).message }
    return { error, preview: replay.getSnapshot(), status: f.store.getSnapshot().sessions[0].researchStatus, preserved: raw === f.raw(oldKey), writes: f.writes }
  }, { owner, now, oldKey })
  expect(result.error).toContain('새로고침')
  expect(result.preview).toMatchObject({ recoveryRequired: true, storageError: true, seconds: 0 })
  expect(result).toMatchObject({ status: '진행 중', preserved: true, writes: [] })
})

test('정상 anchor는 95초보다 오래 화면을 떠나 있어도 원래 시각에서 완료로 복원한다', async ({ page }) => {
  const state = fixture(); state.sessions[0].researchStatus = '진행 중'
  await mount(page, state, { [replayKey('a')]: playing(now - 180_000) })
  const result = await page.evaluate(() => {
    const f = Reflect.get(window, 'lifecycleFixture'); f.store.syncResearchStatus('a')
    return { preview: f.replay('a').getSnapshot(), status: f.store.getSnapshot().sessions[0].researchStatus }
  })
  expect(result.preview).toMatchObject({ status: 'completed', seconds: 95, clockStartedAt: now - 180_000, storageError: false })
  expect(result.preview.recoveryRequired).toBeUndefined(); expect(result.status).toBe('검토 필요')
})

const baseDocumentKey = 'teth-client-research-documents:a'
const baseDocument = { active: 'plan', tabs: ['plan'], drafts: { plan: '원래 연구 계획 초안' }, positions: { plan: 80 }, replies: [] }
function selectedResearchFixture() {
  const state = fixture()
  Object.assign(state.sessions[0], { researchPlanTurnId: 'turn-2', researchPlanTurnIds: ['turn-1', 'turn-2'] })
  return state
}

test('openBaseResearch는 정상 base 문서를 복원하면서 selector만 제거하고 방문 기록·초안·시계를 보존한다', async ({ page }) => {
  const state = selectedResearchFixture(); state.sessions[0].researchStatus = '진행 중'
  const selectedScope = scopeOf('a', 'turn-2'), selectedDocumentKey = `teth-client-research-documents:${selectedScope}`
  const caches = { [baseDocumentKey]: baseDocument, [replayKey('a')]: playing(),
    [selectedDocumentKey]: { ...baseDocument, drafts: { plan: '별도 인라인 문서 초안' } },
    [replayKey(selectedScope)]: { ...playing(), status: 'completed', seconds: 95 } }
  await mount(page, state, caches)
  const result = await page.evaluate(({ owner, cacheKeys }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot()
    const beforeCaches = cacheKeys.map(name => f.raw(name))
    f.store.openBaseResearch('a', owner)
    const after = f.store.getSnapshot(), refreshed = f.experience.createClientExperienceStore().getSnapshot()
    return { before, after, refreshed, ownsSelector: Object.hasOwn(after.sessions[0], 'researchPlanTurnId'),
      refreshedOwnsSelector: Object.hasOwn(refreshed.sessions[0], 'researchPlanTurnId'), beforeCaches, caches: cacheKeys.map(name => f.raw(name)), writes: f.writes }
  }, { owner, cacheKeys: Object.keys(caches) })
  const expected = { ...result.before.sessions[0] }; delete expected.researchPlanTurnId
  expect(result.ownsSelector).toBe(false); expect(result.refreshedOwnsSelector).toBe(false)
  expect(result.after.sessions[0]).toEqual(expected)
  expect(result.after.sessions[0].researchPlanTurnIds).toEqual(['turn-1', 'turn-2'])
  expect(result.after.sessions.slice(1)).toEqual(result.before.sessions.slice(1))
  expect(result.after.homeDraft).toBe(result.before.homeDraft)
  expect(result.after.sharedFollows).toEqual(result.before.sharedFollows)
  expect(result.refreshed.sessions).toEqual(result.after.sessions)
  expect(result.caches).toEqual(result.beforeCaches); expect(result.writes).toEqual([key])
})

for (const variant of ['wrong-current', 'foreign-owner', 'no-cache', 'unknown-active', 'broken-json'] as const) {
  test(`openBaseResearch ${variant}는 현재 selector와 저장 원문을 바꾸지 않는다`, async ({ page }) => {
    const state = selectedResearchFixture()
    if (variant === 'wrong-current') state.currentId = 'b'
    if (variant === 'foreign-owner') state.sessions[0].sharedCopy = { owner, nick: '원작자', active: false, confirmedAt: 500, returnId: null }
    const cache = variant === 'unknown-active' ? { ...baseDocument, active: 'unknown-document', tabs: ['unknown-document'] } : baseDocument
    await mount(page, state, variant === 'no-cache' ? {} : { [baseDocumentKey]: cache })
    const result = await page.evaluate(({ owner, variant, baseDocumentKey }) => {
      const f = Reflect.get(window, 'lifecycleFixture')
      if (variant === 'broken-json') { sessionStorage.setItem(baseDocumentKey, '{broken'); f.reset() }
      const before = f.store.getSnapshot(), raw = f.raw(), cacheRaw = f.raw(baseDocumentKey); let error = ''
      try { f.store.openBaseResearch('a', variant === 'foreign-owner' ? 'other@example.test' : owner) } catch (e) { error = (e as Error).message }
      return { error, same: f.store.getSnapshot() === before, rawSame: raw === f.raw(), cacheSame: cacheRaw === f.raw(baseDocumentKey), writes: f.writes, removes: f.removes }
    }, { owner, variant, baseDocumentKey })
    expect(result.error).not.toBe('')
    expect(result).toMatchObject({ same: true, rawSame: true, cacheSame: true, writes: [], removes: [] })
  })
}

for (const variant of ['missing-active-tab', 'missing-tabs', 'missing-drafts', 'array-drafts', 'risk-phase'] as const) {
  test(`openBaseResearch ${variant}: 알려진 기존 문서는 Workspace 정규화 경로로 복귀할 수 있다`, async ({ page }) => {
    const state = selectedResearchFixture()
    if (variant === 'risk-phase') state.sessions[0].phase = 'risk'
    const cache: Record<string, unknown> = { ...baseDocument }
    if (variant === 'missing-active-tab') cache.tabs = []
    if (variant === 'missing-tabs') delete cache.tabs
    if (variant === 'missing-drafts') delete cache.drafts
    if (variant === 'array-drafts') cache.drafts = []
    await mount(page, state, { [baseDocumentKey]: cache })
    const result = await page.evaluate(({ owner, baseDocumentKey }) => {
      const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(), cacheRaw = f.raw(baseDocumentKey)
      const allowed = f.lifecycle.canOpenBaseResearch(before.sessions[0])
      f.store.openBaseResearch('a', owner)
      const after = f.store.getSnapshot()
      return { allowed, before, after, ownsSelector: Object.hasOwn(after.sessions[0], 'researchPlanTurnId'),
        cacheSame: cacheRaw === f.raw(baseDocumentKey), writes: f.writes, removes: f.removes }
    }, { owner, baseDocumentKey })
    expect(result.allowed).toBe(true)
    const expected = { ...result.before.sessions[0] }; delete expected.researchPlanTurnId
    expect(result.after.sessions[0]).toEqual(expected)
    expect(result.after.sessions[0]).toMatchObject({ workspace: 'research', researchPlanTurnIds: ['turn-1', 'turn-2'], phase: variant === 'risk-phase' ? 'risk' : 'plan' })
    expect(result.after.sessions.slice(1)).toEqual(result.before.sessions.slice(1))
    expect(result.after.homeDraft).toBe(result.before.homeDraft)
    expect(result).toMatchObject({ ownsSelector: false, cacheSame: true, writes: [key], removes: [] })
  })
}

test('openBaseResearch의 setItem throw-before-write는 전환하지 않고 명시 재시도만 성공한다', async ({ page }) => {
  await mount(page, selectedResearchFixture(), { [baseDocumentKey]: baseDocument })
  const failed = await page.evaluate(({ owner, key, baseDocumentKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot(), raw = f.raw(), cacheRaw = f.raw(baseDocumentKey)
    f.failKey = key; let error = ''
    try { f.store.openBaseResearch('a', owner) } catch (e) { error = (e as Error).message }
    return { error, same: before === f.store.getSnapshot(), rawSame: raw === f.raw(), cacheSame: cacheRaw === f.raw(baseDocumentKey),
      selected: f.store.getSnapshot().sessions[0].researchPlanTurnId, uncertain: f.store.commitUncertain(), writes: [...f.writes] }
  }, { owner, key, baseDocumentKey })
  expect(failed.error).not.toBe('')
  expect(failed).toMatchObject({ same: true, rawSame: true, cacheSame: true, selected: 'turn-2', uncertain: false, writes: [key] })
  const retried = await page.evaluate(({ owner }) => {
    const f = Reflect.get(window, 'lifecycleFixture'); f.failKey = ''; f.store.openBaseResearch('a', owner)
    return { ownsSelector: Object.hasOwn(f.store.getSnapshot().sessions[0], 'researchPlanTurnId'), writes: f.writes, uncertain: f.store.commitUncertain() }
  }, { owner })
  expect(retried).toEqual({ ownsSelector: false, writes: [key, key], uncertain: false })
})

test('openBaseResearch readback 실패는 publish하지 않고 후속 전환·삭제·flush를 격리한다', async ({ page }) => {
  const selectedScope = scopeOf('a', 'turn-2')
  await mount(page, selectedResearchFixture(), { [baseDocumentKey]: baseDocument,
    [replayKey(selectedScope)]: playing(now, 'paused'), [`teth-client-research-documents:${selectedScope}`]: { ...baseDocument, drafts: { plan: '선택 계획 초안' } } })
  const result = await page.evaluate(({ owner, selectedScope, baseDocumentKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), before = f.store.getSnapshot()
    const keys = [baseDocumentKey, `teth-research-preview:restored:${selectedScope}`, `teth-client-research-documents:${selectedScope}`]
    const cacheBytes = keys.map(name => f.raw(name))
    f.mode = 'readback'; f.attempted = false; let initialError = ''
    try { f.store.openBaseResearch('a', owner) } catch (e) { initialError = (e as Error).message }
    const durable = f.raw(), initiallySame = before === f.store.getSnapshot(), initialWrites = [...f.writes]
    f.mode = ''; f.reset()
    const errors = [
      () => f.store.openBaseResearch('a', owner),
      () => f.store.openResearchPlan('a', 'turn-1', owner),
      () => f.store.startResearch('a', selectedScope, owner),
      () => f.store.startConversation('새 연구 요청'),
    ].map(invoke => { try { invoke(); return '' } catch (e) { return (e as Error).message } })
    const removed = f.store.remove('a'); f.store.flush(); f.store.syncResearchStatus('a')
    return { initialError, initiallySame, initialWrites, errors, removed, same: before === f.store.getSnapshot(),
      uncertain: f.store.commitUncertain(), durableSame: durable === f.raw(), cacheBytes, afterCaches: keys.map(name => f.raw(name)), writes: f.writes, removes: f.removes }
  }, { owner, selectedScope, baseDocumentKey })
  expect(result).toMatchObject({ initialError: uncertain, initiallySame: true, initialWrites: [key], errors: [uncertain, uncertain, uncertain, uncertain],
    removed: false, same: true, uncertain: true, durableSame: true, writes: [], removes: [] })
  expect(result.afterCaches).toEqual(result.cacheBytes)
  await page.clock.fastForward(1000)
  expect(await page.evaluate(() => Reflect.get(window, 'lifecycleFixture').writes)).toEqual([])
})

for (const variant of ['missing-replay', 'broken-json', 'playing-21', 'completed-21', 'completed-95'] as const) {
  test(`openBaseResearch report ${variant}: 완료 문서의 진입 근거를 확인하고 부족하면 원문을 보존한다`, async ({ page }) => {
    const document = { ...baseDocument, active: 'report', tabs: ['plan', 'report'],
      drafts: { plan: '기존 계획 질문', report: '완료 보고서에 남긴 질문' } }
    const cachedReplay = variant === 'playing-21'
      ? { ...playing(now - 21_000), seconds: 21 }
      : { seconds: variant === 'completed-95' ? 95 : 21, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }
    await mount(page, selectedResearchFixture(), { [baseDocumentKey]: document,
      ...(variant === 'missing-replay' || variant === 'broken-json' ? {} : { [replayKey('a')]: cachedReplay }) })
    const result = await page.evaluate(({ owner, variant, baseDocumentKey, clockKey }) => {
      const f = Reflect.get(window, 'lifecycleFixture')
      if (variant === 'broken-json') { sessionStorage.setItem(clockKey, '{broken-research-clock'); f.reset() }
      const before = f.store.getSnapshot(), raw = f.raw(), documentRaw = f.raw(baseDocumentKey), clockRaw = f.raw(clockKey)
      const visible = f.lifecycle.canOpenBaseResearch(before.sessions[0]); let error = ''
      try { f.store.openBaseResearch('a', owner) } catch (e) { error = (e as Error).message }
      const after = f.store.getSnapshot()
      return { visible, error, before, after, same: before === after, rawSame: raw === f.raw(),
        documentSame: documentRaw === f.raw(baseDocumentKey), clockSame: clockRaw === f.raw(clockKey),
        ownsSelector: Object.hasOwn(after.sessions[0], 'researchPlanTurnId'), writes: f.writes, removes: f.removes }
    }, { owner, variant, baseDocumentKey, clockKey: replayKey('a') })
    // Existing document discovery is intentionally not a completion claim.
    expect(result.visible).toBe(true)
    expect(result.documentSame).toBe(true); expect(result.clockSame).toBe(true); expect(result.removes).toEqual([])
    expect(result.after.sessions[0].researchPlanTurnIds).toEqual(['turn-1', 'turn-2'])
    expect(result.after.sessions[0].draft).toBe(result.before.sessions[0].draft)
    expect(result.after.sessions[0].turns).toEqual(result.before.sessions[0].turns)
    expect(result.after.sessions[0].inlineResults).toEqual(result.before.sessions[0].inlineResults)
    expect(result.after.sessions.slice(1)).toEqual(result.before.sessions.slice(1))
    expect(result.after.homeDraft).toBe(result.before.homeDraft)
    if (variant === 'completed-95') {
      expect(result).toMatchObject({ error: '', ownsSelector: false, writes: [key] })
      expect(result.after.sessions[0]).toMatchObject({ workspace: 'research', researchStatus: '검토 필요' })
    } else {
      expect(result.error).not.toBe('')
      expect(result).toMatchObject({ same: true, rawSame: true, ownsSelector: true, writes: [] })
      expect(result.after).toEqual(result.before)
    }
  })
}

test('base Critic 복원은 37.5초 pure 경과가 아닌 tick 정수 경계로 판정하고 38초에 허용한다', async ({ page }) => {
  const document = { ...baseDocument, active: 'critic', tabs: ['plan', 'critic'],
    drafts: { plan: '원래 계획 초안', critic: '사라지면 안 되는 Critic 질문' } }
  await mount(page, selectedResearchFixture(), { [baseDocumentKey]: document, [replayKey('a')]: playing() })
  await page.clock.setFixedTime(new Date(now))
  const initial = await page.evaluate(({ baseDocumentKey, clockKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), replay = f.replay('a')
    Object.assign(window, { criticBoundarySnapshot: f.store.getSnapshot(), criticBoundaryReplay: replay })
    return { replay: replay.getSnapshot(), raw: f.raw(), document: f.raw(baseDocumentKey), clock: f.raw(clockKey) }
  }, { baseDocumentKey, clockKey: replayKey('a') })
  expect(initial.replay).toMatchObject({ seconds: 0, status: 'playing', clockStartedAt: now })

  await page.clock.setFixedTime(new Date(now + 37_500))
  const blocked = await page.evaluate(({ owner, baseDocumentKey, clockKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), target = f.store.getSnapshot().sessions[0]
    const restorable = f.lifecycle.canRestoreBaseResearch(target); let error = ''
    try { f.store.openBaseResearch('a', owner) } catch (e) { error = (e as Error).message }
    return { time: Date.now(), restorable, error, same: f.store.getSnapshot() === Reflect.get(window, 'criticBoundarySnapshot'),
      raw: f.raw(), document: f.raw(baseDocumentKey), clock: f.raw(clockKey), writes: [...f.writes],
      replay: f.replay('a').getSnapshot(), sameReplay: f.replay('a') === Reflect.get(window, 'criticBoundaryReplay') }
  }, { owner, baseDocumentKey, clockKey: replayKey('a') })
  expect(blocked).toMatchObject({ time: now + 37_500, restorable: false, same: true, sameReplay: true,
    raw: initial.raw, document: initial.document, clock: initial.clock, writes: [] })
  expect(blocked.error).not.toBe('')
  expect(blocked.replay).toEqual(initial.replay)

  await page.clock.setFixedTime(new Date(now + 38_000))
  const accepted = await page.evaluate(({ owner, baseDocumentKey }) => {
    const f = Reflect.get(window, 'lifecycleFixture'), restorable = f.lifecycle.canRestoreBaseResearch(f.store.getSnapshot().sessions[0])
    f.store.openBaseResearch('a', owner)
    const selected = f.store.getSnapshot().sessions[0]
    return { time: Date.now(), restorable, selected, ownsSelector: Object.hasOwn(selected, 'researchPlanTurnId'), document: f.raw(baseDocumentKey),
      replay: f.replay('a').getSnapshot(), sameReplay: f.replay('a') === Reflect.get(window, 'criticBoundaryReplay'), writes: f.writes }
  }, { owner, baseDocumentKey })
  expect(accepted).toMatchObject({ time: now + 38_000, restorable: true, ownsSelector: false, document: initial.document, sameReplay: true })
  expect(accepted.selected).toMatchObject({ workspace: 'research', researchStatus: '진행 중', researchPlanTurnIds: ['turn-1', 'turn-2'] })
  expect(accepted.replay).toMatchObject({ seconds: 38, status: 'playing', clockStartedAt: now })
  expect(accepted.writes).toEqual([replayKey('a'), key])
})
