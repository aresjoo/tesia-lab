import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import type { FollowupAction, FollowupSelection } from '../src/client-followup-presentation'

// Real public-preview store; acceptance here is not server or trading authority.
const key = 'teth-client-experience', id = 'followup-store-session', turnId = 'followup-store-turn', owner = 'followup-store@example.test'
const prompt = '이 조건을 다른 구간에서도 검증해줘'
const action: FollowupAction = { id: 'stored-action', type: 'backtest', label: '공급된 조건으로 다시 검증해줘' }
const original: ClientSession = {
  id, title: '공개 후속 저장 경계', renamed: true, idea: '원래 아이디어', draft: '전송하지 않은 초안',
  pair: 'BTC/USDT', mode: 'dip', timeframe: '1시간봉', risk: '−3%', takeProfit: '+8%', phase: 'plan',
  researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: 1700000002000,
  turns: [{ id: turnId, question: '원래 질문', answer: '공급된 답변', fullAnswer: '공급된 답변', status: 'done', phase: 'plan',
    startedAt: 1700000000000, finishedAt: 1700000002000, suggestions: [prompt], followupActions: [action] }],
}
const binding = { scopeId: JSON.stringify([owner, id]), messageId: turnId, observationId: `${turnId}:next` }
const question: FollowupSelection = { binding, kind: 'question', item: { id: 'next-0', label: prompt, text: prompt } }
const selectedAction = (type: FollowupAction['type']): FollowupSelection => ({ binding, kind: 'action', item: { ...action, type } })

async function mount(page: Page, options: { type?: FollowupAction['type']; consumed?: boolean; busy?: boolean; foreignCurrent?: boolean; workspace?: ClientSession['workspace']; result?: 'same' | 'foreign' | 'invalid' } = {}) {
  await page.route('**/followups-store-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>공개 후속 저장 경계 시험</body></html>' }))
  await page.goto('/followups-store-test.html')
  await page.evaluate(async ({ key, original, options }) => {
    const active = structuredClone(original)
    active.workspace = options.workspace ?? 'conversation'
    active.turns[0].followupActions![0].type = options.type ?? 'backtest'
    if (options.consumed) active.turns[0].followupsConsumed = true
    if (options.busy) { active.turns[0].status = 'running'; delete active.turns[0].finishedAt }
    if (options.result === 'invalid') active.turns[0].commonResultContextInvalid = true
    else if (options.result) {
      const path = '/src/client-common-revision.ts'
      const { COMMON_PREVIEW_REVISION } = await import(/* @vite-ignore */ path)
      active.turns[0].commonResultContext = {
        owner: options.result === 'same' ? 'followup-store@example.test' : 'another-owner@example.test',
        sourceSessionId: 'result-source-session', sourceTurnId: 'result-source-turn', title: '기존 결과 대화',
        input: { pair: 'BTC/USDT', timeframe: '1시간봉', parameters: { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 500 } },
        period: 365, amount: 10000, dataRevision: COMMON_PREVIEW_REVISION,
      }
    }
    const other = { ...structuredClone(original), id: 'other-session', title: '다른 대화', draft: '다른 대화 초안' }
    const state = { currentId: options.foreignCurrent ? other.id : active.id, sessions: [active, other], homeDraft: '홈 초안', sharedFollows: [] }
    sessionStorage.setItem(key, JSON.stringify(state))
    sessionStorage.setItem('followup-unrelated-bytes', '{"preserve":"그대로"}')
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    const fixture = { store, createClientExperienceStore, before: store.getSnapshot(), bytes: get.call(sessionStorage, key),
      writes: 0, mode: '', attempted: false,
      raw: () => get.call(sessionStorage, key),
      restore: () => { Storage.prototype.getItem = get; Storage.prototype.setItem = set },
    }
    Storage.prototype.setItem = function (name, value) {
      if (this !== sessionStorage || name !== key) return set.call(this, name, value)
      fixture.writes++; fixture.attempted = true
      if (fixture.mode === 'drop') return
      set.call(this, name, fixture.mode === 'corrupt' ? '{"unverified":"readback mismatch"}' : value)
    }
    Storage.prototype.getItem = function (name) {
      if (this === sessionStorage && name === key && fixture.mode === 'readback' && fixture.attempted) throw new Error('fixture readback denied')
      return get.call(this, name)
    }
    Object.assign(window, { followupStore: fixture })
  }, { key, original, options })
}

for (const fault of ['session', 'current-session', 'tail', 'scope', 'message', 'observation', 'missing-action', 'changed-action', 'consumed', 'busy'] as const) {
  test(`${fault}: 불일치하거나 이미 소진된 후속 요청은 저장·초안·다른 대화를 바꾸지 않는다`, async ({ page }) => {
    await mount(page, { foreignCurrent: fault === 'current-session', consumed: fault === 'consumed', busy: fault === 'busy' })
    const result = await page.evaluate(({ id, turnId, owner, question, action, fault }) => {
      const f = Reflect.get(window, 'followupStore')
      let selection: FollowupSelection = structuredClone(question)
      let sessionId = id, selectedTurn = turnId
      if (fault === 'session') sessionId = 'missing-session'
      if (fault === 'tail') selectedTurn = 'past-turn'
      if (fault === 'scope') selection.binding.scopeId = JSON.stringify(['other-owner', id])
      if (fault === 'message') selection.binding.messageId = 'other-message'
      if (fault === 'observation') selection.binding.observationId = 'other-observation'
      if (fault === 'missing-action' || fault === 'changed-action') selection = { binding: selection.binding, kind: 'action', item: { ...action, ...(fault === 'missing-action' ? { id: 'not-supplied' } : { label: '다른 조건으로 검증' }) } }
      const results = [f.store.activateFollowup(sessionId, selectedTurn, owner, selection), f.store.activateFollowup(sessionId, selectedTurn, owner, selection)]
      return { results, writes: f.writes, same: f.before === f.store.getSnapshot(), bytesSame: f.raw() === f.bytes,
        snapshot: f.store.getSnapshot(), before: f.before, unrelated: sessionStorage.getItem('followup-unrelated-bytes') }
    }, { id, turnId, owner, question, action, fault })
    expect(result.results).toEqual([false, false]); expect(result.writes).toBe(0)
    expect(result.same).toBe(true); expect(result.bytesSame).toBe(true)
    expect(result.snapshot).toEqual(result.before)
    expect(result.unrelated).toBe('{"preserve":"그대로"}')
  })
}

test('현재 owner와 다른 owner의 binding을 바꿔 끼워 수락하지 않는다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ id, turnId, question }) => {
    const f = Reflect.get(window, 'followupStore')
    return { accepted: f.store.activateFollowup(id, turnId, 'other-owner@example.test', question), writes: f.writes, unchanged: f.raw() === f.bytes }
  }, { id, turnId, question })
  expect(result).toEqual({ accepted: false, writes: 0, unchanged: true })
})

for (const method of ['default', 'followup'] as const) for (const context of ['same', 'foreign', 'invalid'] as const) test(`${method} 결과 맥락 ${context}: UI에서 숨긴 다른 소유자의 결과는 store에서도 재사용하지 않는다`, async ({ page }) => {
  await mount(page, { result: context, type: 'delegate_trade' })
  const result = await page.evaluate(({ id, turnId, owner, selection, method }) => {
    const f = Reflect.get(window, 'followupStore')
    const accepted = method === 'default' ? f.store.requestStrategyConversation(id, owner, '전략 맡기기', turnId) : f.store.activateFollowup(id, turnId, owner, selection)
    return { accepted, writes: f.writes, same: f.before === f.store.getSnapshot(), bytesSame: f.raw() === f.bytes,
      context: f.before.sessions[0].turns[0].commonResultContext, invalid: f.before.sessions[0].turns[0].commonResultContextInvalid }
  }, { id, turnId, owner, selection: selectedAction('delegate_trade'), method })
  if (context === 'invalid') expect(result.invalid).toBe(true)
  else expect(result.context?.owner).toBe(context === 'same' ? owner : 'another-owner@example.test')
  expect(result.accepted).toBe(context === 'same'); expect(result.writes).toBe(context === 'same' ? 1 : 0)
  expect(result.same).toBe(context !== 'same'); expect(result.bytesSame).toBe(context !== 'same')
})

for (const workspace of ['conversation', 'research'] as const) test(`${workspace}: 기본 실행도 같은 대화에 요청을 저장하고 연구·초안·이력을 보존한다`, async ({ page }) => {
  await mount(page, { workspace })
  const result = await page.evaluate(({ id, turnId, owner }) => {
    const f = Reflect.get(window, 'followupStore')
    const accepted = f.store.requestStrategyConversation(id, owner, '전략 맡기기', turnId)
    const repeat = f.store.requestStrategyConversation(id, owner, '전략 맡기기', turnId)
    return { accepted, repeat, writes: f.writes, before: f.before, after: f.store.getSnapshot(), stored: JSON.parse(f.raw()) }
  }, { id, turnId, owner })
  expect([result.accepted, result.repeat]).toEqual([true, false]); expect(result.writes).toBe(1)
  const active = result.after.sessions[0]
  expect(active).toEqual({ ...result.before.sessions[0], workspace: 'conversation', updatedAt: active.updatedAt, turns: [...result.before.sessions[0].turns, active.turns[1]] })
  expect(active.turns[1]).toMatchObject({ question: '전략 맡기기', status: 'running', answer: '' })
  expect(active.turns[1].sourceIntake).toBeUndefined()
  expect(result.after.sessions[1]).toEqual(result.before.sessions[1])
  expect(result.stored.sessions).toEqual(result.after.sessions)
})

for (const fault of ['current-session', 'session', 'tail', 'busy', 'workspace', 'blank', 'long'] as const) test(`기본 실행 ${fault}: 오래되거나 부적합한 요청은 상태와 저장을 변경하지 않는다`, async ({ page }) => {
  await mount(page, { foreignCurrent: fault === 'current-session', busy: fault === 'busy', workspace: fault === 'workspace' ? 'delegation' : 'conversation' })
  const result = await page.evaluate(({ id, turnId, owner, fault }) => {
    const f = Reflect.get(window, 'followupStore')
    const accepted = f.store.requestStrategyConversation(fault === 'session' ? 'missing' : id, owner,
      fault === 'blank' ? '  ' : fault === 'long' ? '가'.repeat(1001) : '전략 맡기기', fault === 'tail' ? 'stale' : turnId)
    return { accepted, writes: f.writes, same: f.before === f.store.getSnapshot(), bytesSame: f.raw() === f.bytes }
  }, { id, turnId, owner, fault })
  expect(result).toEqual({ accepted: false, writes: 0, same: true, bytesSame: true })
})

test('저장된 과거 양식이 없는 대화에는 다시 답하기로 새 고정5질문을 만들 수 없다', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ id, turnId, owner }) => {
    const f = Reflect.get(window, 'followupStore')
    return { accepted: f.store.restartSourceIntake(id, owner, '다시 답하기', turnId, turnId), writes: f.writes, same: f.before === f.store.getSnapshot(), bytesSame: f.raw() === f.bytes }
  }, { id, turnId, owner })
  expect(result).toEqual({ accepted: false, writes: 0, same: true, bytesSame: true })
})

for (const mode of ['drop', 'corrupt', 'readback'] as const) test(`기본 실행 ${mode}: 저장 재확인 실패를 대화 수락으로 처리하지 않는다`, async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ id, turnId, owner, mode }) => {
    const f = Reflect.get(window, 'followupStore'); f.mode = mode
    let failed = false
    try { f.store.requestStrategyConversation(id, owner, '전략 맡기기', turnId) } catch { failed = true }
    const same = f.before === f.store.getSnapshot(), uncertain = f.store.commitUncertain(), writes = f.writes
    f.mode = ''
    const retry = f.store.requestStrategyConversation(id, owner, '전략 맡기기', turnId)
    const repeat = f.store.requestStrategyConversation(id, owner, '전략 맡기기', turnId)
    f.restore()
    return { failed, same, uncertain, writes, retry, repeat, before: f.before, after: f.store.getSnapshot() }
  }, { id, turnId, owner, mode })
  expect(result.failed).toBe(true); expect(result.same).toBe(true); expect(result.writes).toBe(1)
  expect(result.uncertain).toBe(mode !== 'drop'); expect(result.retry).toBe(mode === 'drop'); expect(result.repeat).toBe(false)
  expect(result.after.sessions[0].draft).toBe(original.draft)
  expect(result.after.sessions[1]).toEqual(result.before.sessions[1])
})

for (const type of ['question', 'backtest', 'alert'] as const) test(`${type}: 정확한 로컬 수락은 한 번이며 초안과 다른 세션을 보존한다`, async ({ page }) => {
  await mount(page, { type: type === 'question' ? 'backtest' : type })
  const selection = type === 'question' ? question : selectedAction(type)
  const result = await page.evaluate(({ id, turnId, owner, selection }) => {
    const f = Reflect.get(window, 'followupStore')
    const first = f.store.activateFollowup(id, turnId, owner, selection)
    const second = f.store.activateFollowup(id, turnId, owner, selection)
    return { first, second, writes: f.writes, before: f.before, after: f.store.getSnapshot(), stored: JSON.parse(f.raw()), restored: f.createClientExperienceStore().getSnapshot() }
  }, { id, turnId, owner, selection })
  expect([result.first, result.second]).toEqual([true, false]); expect(result.writes).toBe(1)
  const active = result.after.sessions[0]
  expect(active.draft).toBe(original.draft); expect(active.workspace).toBe('conversation'); expect(active.tradingReady).toBe(false)
  expect(result.after.sessions[1]).toEqual(result.before.sessions[1]); expect(result.after.homeDraft).toBe('홈 초안')
  expect(active.turns).toHaveLength(type === 'alert' ? 1 : 2)
  if (type === 'alert') expect(active.turns[0].followupActions[0].saved).toBe(true)
  else expect(active.turns[1].question).toBe(type === 'question' ? prompt : action.label)
  expect(result.stored.sessions).toEqual(result.after.sessions); expect(result.restored.sessions).toEqual(result.after.sessions)
})

for (const type of ['delegate_trade', 'auto_trade'] as const) {
  test(`${type}: 최신 원본 label을 같은 대화로 한 번만 보내고 고정 양식을 만들지 않는다`, async ({ page }) => {
    await mount(page, { type })
    const result = await page.evaluate(({ id, turnId, owner, selection }) => {
      const f = Reflect.get(window, 'followupStore')
      const accepted = f.store.activateFollowup(id, turnId, owner, selection)
      const repeated = f.store.activateFollowup(id, turnId, owner, selection)
      return { accepted, repeated, writes: f.writes, before: f.before, after: f.store.getSnapshot(), stored: JSON.parse(f.raw()) }
    }, { id, turnId, owner, selection: selectedAction(type) })
    expect([result.accepted, result.repeated]).toEqual([true, false]); expect(result.writes).toBe(1)
    const active = result.after.sessions[0]
    expect(active).toEqual({ ...result.before.sessions[0], updatedAt: active.updatedAt, turns: [
      { ...result.before.sessions[0].turns[0], followupsConsumed: true }, active.turns[1],
    ] })
    expect(active.turns[1]).toMatchObject({ question: action.label, status: 'running', answer: '' })
    expect(active.turns[1].sourceIntake).toBeUndefined()
    expect(result.after.sessions[1]).toEqual(result.before.sessions[1]); expect(result.stored.sessions).toEqual(result.after.sessions)
  })
}

for (const mode of ['drop', 'corrupt', 'readback'] as const) test(`${mode}: 저장 확인 실패는 수락하지 않고 불확실 기록의 중복 실행을 막는다`, async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(({ id, turnId, owner, question, mode }) => {
    const f = Reflect.get(window, 'followupStore'); f.mode = mode
    let accepted = false, failed = false
    try { accepted = f.store.activateFollowup(id, turnId, owner, question) } catch { failed = true }
    const afterFailure = f.store.getSnapshot(), rawAfterFailure = f.raw(), uncertain = f.store.commitUncertain()
    const failureWrites = f.writes
    f.mode = ''
    const retry = f.store.activateFollowup(id, turnId, owner, question)
    const repeat = f.store.activateFollowup(id, turnId, owner, question)
    f.restore()
    return { accepted, failed, same: afterFailure === f.before, before: f.before, afterFailure, rawAfterFailure, beforeBytes: f.bytes,
      uncertain, failureWrites, retry, repeat, writes: f.writes, after: f.store.getSnapshot(), stored: f.raw() }
  }, { id, turnId, owner, question, mode })
  expect(result.accepted).toBe(false); expect(result.failed).toBe(true); expect(result.same).toBe(true)
  expect(result.afterFailure).toEqual(result.before); expect(result.failureWrites).toBe(1)
  expect(result.uncertain).toBe(mode !== 'drop')
  expect(result.retry).toBe(mode === 'drop'); expect(result.repeat).toBe(false)
  expect(result.writes).toBe(mode === 'drop' ? 2 : 1)
  expect(result.after.sessions[0].draft).toBe(original.draft); expect(result.after.sessions[1]).toEqual(result.before.sessions[1])
  if (mode === 'drop') {
    expect(result.rawAfterFailure).toBe(result.beforeBytes)
    expect(JSON.parse(result.stored).sessions[0].turns).toHaveLength(2)
  } else {
    expect(result.after).toEqual(result.before); expect(result.stored).toBe(result.rawAfterFailure)
    if (mode === 'readback') expect(JSON.parse(result.stored).sessions[0].turns).toHaveLength(2)
  }
})
