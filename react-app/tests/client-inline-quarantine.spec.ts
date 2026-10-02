import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

// Same real-store + controlled Storage seam as client-inline-handoff-store.
// Do not import another spec or substitute product store/validation methods.
// This is local preview persistence evidence, never account/execution authority.
const key = 'teth-client-experience', owner = 'quarantine@example.test', id = 'quarantine-session'
const message = '저장 여부를 확인할 수 없어요. 새로고침해 저장된 기록을 확인해주세요.'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
const seed = sourceSharedStrategies()[0]
const copyRequest = { nick: seed.nick, budgetIndex: 1, sl: seed.parameters.sl, tp: seed.parameters.tp }
function fixture() {
  const turn: ClientTurn = { id: 'result-turn', question: 'ETH 추세 손절 5%, 익절 12%', answer: '검증 완료', fullAnswer: '검증 완료',
    startedAt: 1000, finishedAt: 1100, status: 'done', suggestions: [], phase: 'plan',
    inlineRequest: { parameters, pair: 'ETH/USDT', timeframe: '1시간봉' } }
  const session: ClientSession = { id, title: '삭제하면 안 되는 대화', renamed: true, idea: '원작자 전략', draft: '보존할 초안', pair: 'BTC/USDT',
    mode: 'dip', timeframe: '일봉', risk: '−8%', takeProfit: '+15%', researchStatus: '초안', phase: 'plan', turns: [turn], updatedAt: 4000,
    workspace: 'conversation', tradingReady: false, conversationViewport: { top: 120, spacer: 30, follow: false, questionKey: turn.id },
    inlineResults: [{ ...turn.inlineRequest!, turnId: turn.id, ordinal: 1, completedAt: 2200 }],
    sharedCopy: { owner, nick: seed.nick, confirmedAt: 500, returnId: null, active: true, followId: 'active-follow' } }
  const follow = { id: 'active-follow', owner, nick: seed.nick, asset: seed.asset, parameters: { ...parameters, sl: -8, tp: 15 },
    budgetIndex: 1, confirmedAt: 500, sessionId: id, active: true }
  return { currentId: id, homeDraft: '홈 초안', sessions: [session], sharedFollows: [follow, { ...follow, id: 'archived-follow', active: false }] }
}

async function mount(page: Page, mode: 'readback' | 'corrupt') {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.route('**/inline-quarantine-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Local quarantine fixture</body></html>' }))
  await page.goto('/inline-quarantine-test.html')
  return page.evaluate(async ({ state, key, id, owner, parameters, mode }) => {
    sessionStorage.setItem(key, JSON.stringify(state))
    const storePath = '/src/client-experience-store.ts', uiPath = '/src/client-delegation-fixtures.ts'
    const documentPath = '/src/client-research-cache.ts', previewPath = '/src/mock-research-preview.ts'
    const [{ createClientExperienceStore }, ui, documents, previews] = await Promise.all([
      import(/* @vite-ignore */ storePath), import(/* @vite-ignore */ uiPath),
      import(/* @vite-ignore */ documentPath), import(/* @vite-ignore */ previewPath),
    ])
    const uiKey = `teth:client-delegation:${id}`, documentKey = `teth-client-research-documents:${id}`
    ui.saveDelegationUi(id, { page: 'report', questionIndex: 5, attempt: 1, workStep: 5, expert: true, chartInterval: '1D', parameters,
      answers: { asset: { index: 0 }, style: { index: 1 }, budget: { index: 1 }, period: { index: 2 }, stop: { index: 1 } } })
    documents.writeResearchDocumentCache(id, { note: 'memory-only document value' })
    const preview = previews.getMockResearchPreview(id), restoredPreview = previews.getMockResearchPreview(`restored:${id}`)
    preview.view('plan'); restoredPreview.view('plan')
    // Keep disk and memory deliberately distinct: re-reading equal persisted
    // bytes must not conceal an accidental forget*Memory call during removal.
    sessionStorage.setItem(uiKey, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(uiKey)!), expert: false }))
    sessionStorage.setItem(documentKey, JSON.stringify({ note: 'older disk document value' }))
    const cacheKeys = [uiKey, documentKey, `teth-research-preview:${id}`, `teth-research-preview:restored:${id}`]
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
    const uuid = crypto.randomUUID.bind(crypto)
    const store = createClientExperienceStore()
    const f = { store, before: store.getSnapshot(), writes: [] as string[], removes: [] as string[], emits: 0, ids: 0,
      attempted: false, mode: mode as string, raw: () => get.call(sessionStorage, key),
      cacheBytes: () => cacheKeys.map(name => get.call(sessionStorage, name)),
      memory: () => ({ document: documents.readResearchDocumentCache(id), ui: ui.readDelegationUi(id),
        previewSame: previews.getMockResearchPreview(id) === preview,
        restoredSame: previews.getMockResearchPreview(`restored:${id}`) === restoredPreview,
        viewport: store.conversationViewport(id) }) }
    store.subscribe(() => { f.emits++ })
    Storage.prototype.getItem = function (name) {
      if (name === key && f.attempted && f.mode === 'readback') throw new Error('fixture readback unavailable')
      return get.call(this, name)
    }
    Storage.prototype.setItem = function (name, value) {
      f.writes.push(name)
      if (name === key) { f.attempted = true; set.call(this, name, f.mode === 'corrupt' ? '{"unverified":"bytes"}' : value); return }
      set.call(this, name, value)
    }
    Storage.prototype.removeItem = function (name) { f.removes.push(name); remove.call(this, name) }
    crypto.randomUUID = () => { f.ids++; return uuid() }
    const initiallyUncertain = store.commitUncertain(), beforeMemory = f.memory(), beforeCache = f.cacheBytes()
    let error = ''
    try { store.connectInlineResult(id, 'result-turn', owner) } catch (e) { error = (e as Error).message }
    Object.assign(window, { quarantineFixture: f })
    return { initiallyUncertain, uncertain: store.commitUncertain(), error, sameSnapshot: store.getSnapshot() === f.before,
      beforeMemory, beforeCache, memory: f.memory(), caches: f.cacheBytes(), raw: f.raw(), writes: f.writes, emits: f.emits }
  }, { state: fixture(), key, id, owner, parameters, mode })
}

for (const mode of ['readback', 'corrupt'] as const) test(`${mode}: quarantine 삭제·후속 전환은 캐시와 원문을 보존하며 새로고침 안내를 유지한다`, async ({ page }) => {
  const entered = await mount(page, mode)
  expect(entered).toMatchObject({ initiallyUncertain: false, uncertain: true, error: message, sameSnapshot: true, writes: [key], emits: 0 })
  expect(entered.memory).toEqual(entered.beforeMemory)
  expect(entered.caches).toEqual(entered.beforeCache)
  expect(entered.beforeMemory.document).toEqual({ note: 'memory-only document value' })
  expect(entered.beforeMemory.ui.expert).toBe(true)

  const removal = await page.evaluate(({ id }) => {
    const f = Reflect.get(window, 'quarantineFixture'), before = f.store.getSnapshot()
    const removed = f.store.remove(id)
    return { removed, sameSnapshot: f.store.getSnapshot() === before, raw: f.raw(), caches: f.cacheBytes(), memory: f.memory(),
      uncertain: f.store.commitUncertain(), writes: f.writes, removes: f.removes, emits: f.emits }
  }, { id })
  expect(removal).toMatchObject({ removed: false, sameSnapshot: true, uncertain: true, writes: [key], removes: [], emits: 0 })
  expect(removal.raw).toBe(entered.raw)
  expect(removal.caches).toEqual(entered.beforeCache)
  expect(removal.memory).toEqual(entered.beforeMemory)

  const attempts = await page.evaluate(({ id, owner, copyRequest }) => {
    const f = Reflect.get(window, 'quarantineFixture'), before = f.store.getSnapshot()
    // Restore readability to prove quarantine needs a fresh store, not a silent
    // same-instance retry, and that callbacks cannot delete auxiliary caches.
    f.mode = ''
    const actions: [string, () => unknown][] = [
      ['archiveSharedFollow', () => f.store.archiveSharedFollow(owner, 'active-follow')],
      ['removeSharedFollow', () => f.store.removeSharedFollow(owner, 'archived-follow')],
      ['detachSharedCopy', () => f.store.detachSharedCopy(id)],
      ['startConversation', () => f.store.startConversation('ETH 추세 1시간봉 손절 5%, 익절 12%')],
      ['copySharedStrategy', () => f.store.copySharedStrategy(owner, copyRequest)],
      ['connectInlineResult', () => f.store.connectInlineResult(id, 'result-turn', owner)],
    ]
    const results = actions.map(([action, invoke]) => {
      let error = '', returned = false
      try { invoke(); returned = true } catch (e) { error = (e as Error).message }
      return { action, returned, error, sameSnapshot: f.store.getSnapshot() === before, uncertain: f.store.commitUncertain(),
        raw: f.raw(), caches: f.cacheBytes(), memory: f.memory() }
    })
    f.store.flush()
    return { results, writes: f.writes, removes: f.removes, ids: f.ids, emits: f.emits }
  }, { id, owner, copyRequest })
  expect(attempts.results).toHaveLength(6)
  for (const result of attempts.results) {
    expect(result, result.action).toMatchObject({ returned: false, error: message, sameSnapshot: true, uncertain: true })
    expect(result.raw, result.action).toBe(entered.raw)
    expect(result.caches, result.action).toEqual(entered.beforeCache)
    expect(result.memory, result.action).toEqual(entered.beforeMemory)
  }
  expect(attempts).toMatchObject({ writes: [key], removes: [], ids: 0, emits: 0 })
  await page.clock.fastForward(1000)
  const final = await page.evaluate(() => {
    const f = Reflect.get(window, 'quarantineFixture')
    return { raw: f.raw(), caches: f.cacheBytes(), writes: f.writes, removes: f.removes, uncertain: f.store.commitUncertain() }
  })
  expect(final).toEqual({ raw: entered.raw, caches: entered.beforeCache, writes: [key], removes: [], uncertain: true })
})
