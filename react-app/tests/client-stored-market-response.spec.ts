import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import type { StoredMarketResponse } from '../src/client-stored-market-response'

const key = 'teth-client-experience', owner = 'market-restore@example.test'
const sessionId = 'market-transcript', turnId = 'market-answer'
const binding = { scopeId: JSON.stringify([owner, sessionId]), messageId: turnId, observationId: 'market-observation' }
const view = { identity: 'daily-observation', market: 'BTC/USDT', resolutionSeconds: 86400, pricePrecision: 2,
  sourceLabel: '복원 검수용 합성 관측 · 실제 시세 아님', fills: [],
  bars: Array.from({ length: 30 }, (_, i) => ({ time: 1700000000 + i * 86400, open: 100 + i, high: 107 + i, low: 98 + i, close: 105 + i, volume: 50 + i })) }
function response(): StoredMarketResponse {
  return { version: 1, owner, blocks: [
    { id: 'price', kind: 'market-price', presentation: { binding, asset: '비트코인', priceLabel: '134 USDT', changeLabel: '+2.3%', changeBasis: '전일 대비', tone: 'up', sourceLabel: view.sourceLabel, observedAtLabel: '2026-09-20 12:00 UTC', intervalLabel: '1일' } },
    { id: 'timeline', kind: 'market-timeline', presentation: { binding, observedDaily: true, events: [{ id: 'event', dateLabel: '09/19', title: '제공된 시장 사건', sourceLabel: '검수 출처', priceLabel: '131 USDT', changeLabel: '+1%', tone: 'up' }] } },
    { id: 'evidence', kind: 'market-evidence', presentation: { binding, searches: 3, results: 5, pagesRead: 2, sources: [{ id: 'source', title: '검수 원문', url: 'https://example.test/research', description: '제공된 출처 설명' }] } },
    { id: 'direction', kind: 'market-direction', presentation: { binding, asset: '비트코인', up: 62.5, down: 37.5, sourceLabel: view.sourceLabel, observedAtLabel: '2026-09-20', hasMarketObservation: true } },
    { id: 'chart', kind: 'market-chart', presentation: { binding, seriesId: 'market-series', asset: view.market, assetLabel: '비트코인', resolutionSeconds: 86400, availableResolutions: [3600, 86400], state: 'ready', view,
      scenario: { binding, seriesId: 'market-series', viewIdentity: view.identity, asset: view.market, resolutionSeconds: 86400, upperPrice: 150, lowerPrice: 120, horizonTime: view.bars.at(-1)!.time + 7 * 86400, basisLabel: '제공된 관측 범위' } } },
    { id: 'question', kind: 'market-question', presentation: { binding, steps: [{ id: 'risk', title: '어느 정도 하락까지 생각하세요?', options: [{ id: 'small', label: '작은 하락', description: '자주 확인할 수 있어요' }, { id: 'large', label: '큰 하락' }] }] } },
  ] }
}
function session(value: unknown = response()): ClientSession {
  return { id: sessionId, title: '시장 대화 보존', renamed: true, idea: '시장 질문', draft: '작성 중이던 질문',
    pair: 'BTC/USDT', mode: 'dip', timeframe: '1일봉', risk: '-3%', takeProfit: '+8%', phase: 'plan',
    researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: 1700000002000,
    turns: [{ id: turnId, question: '최근 흐름을 알려주세요', answer: '제공된 시장 관측을 정리했습니다.', fullAnswer: '제공된 시장 관측을 정리했습니다.',
      status: 'done', phase: 'plan', startedAt: 1700000000000, finishedAt: 1700000002000, suggestions: [],
      ...(value === undefined ? {} : { marketResponse: value as StoredMarketResponse }) }] }
}
async function setup(page: Page, value: unknown = response(), account = owner) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ key, initial, account }) => {
    if (sessionStorage.getItem('market-restore-seeded')) return
    sessionStorage.setItem('market-restore-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복원 검수', email: account }))
    sessionStorage.setItem(key, JSON.stringify({ currentId: initial.id, sessions: [initial], homeDraft: '홈 초안', sharedFollows: [] }))
  }, { key, initial: session(value), account })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중이던 질문')
}
async function store(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/client-experience-store.ts'
    const module = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'marketRestoreStore', module.createClientExperienceStore())
  })
}
const snapshot = (page: Page) => page.evaluate(() => Reflect.get(window, 'marketRestoreStore').getSnapshot())

test('공개 실제 셸에서 6종 본문과 LWC 차트·시나리오를 같은 순서로 복원한다', async ({ page }, info) => {
  const errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url()) })
  await setup(page)
  for (let pass = 0; pass < 2; pass++) {
    await expect(page.locator('.g-pxcard .pv')).toHaveText('134 USDT')
    await expect(page.locator('.g-evtl')).toContainText('제공된 시장 사건')
    await expect(page.locator('.g-srcstrip')).toContainText('3')
    await expect(page.locator('.g-gauge .lg .u em')).toHaveText('62.5%')
    await expect(page.locator('.client-market-chart .cp-surface canvas').first()).toBeAttached()
    await expect(page.locator('.client-market-question')).toContainText('어느 정도 하락까지 생각하세요?')
    await expect(page.locator('.market-chart-intervals button').first()).toBeDisabled()
    expect(await page.locator('.g-pxcard,.g-evtl,.g-srcstrip,.g-gauge,.client-market-chart,.client-market-question').evaluateAll(nodes => nodes.map(node => node.classList[0])))
      .toEqual(['g-pxcard', 'g-evtl', 'g-srcstrip', 'g-gauge', 'g-chartcard', 'g-askcard'])
    await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중이던 질문')
    if (pass === 0) await page.reload()
  }
  await store(page)
  const restored = (await snapshot(page)).sessions[0].turns[0].marketResponse
  expect(restored.blocks[3].presentation.restored).toBe(true)
  expect(restored.blocks[4].presentation.scenario.restored).toBe(true)
  expect(restored.blocks[4].presentation.view).toEqual(view)
  await page.screenshot({ path: info.outputPath('stored-market-transcript.png'), fullPage: true })
  expect(errors).toEqual([]); expect(writes).toEqual([])
})

const mutations: Record<string, (x: StoredMarketResponse) => unknown> = {
  version: x => ({ ...x, version: 2 }),
  owner: x => ({ ...x, owner: [] }),
  blocks: x => ({ ...x, blocks: {} }),
  duplicate: x => ({ ...x, blocks: [...x.blocks, x.blocks[0]] }),
  unknown: x => ({ ...x, blocks: [{ ...x.blocks[0], kind: 'execute' }] }),
  binding: x => ({ ...x, blocks: [{ ...x.blocks[0], presentation: { ...x.blocks[0].presentation, binding: null } }] }),
  scope: x => ({ ...x, blocks: [{ ...x.blocks[0], presentation: { ...x.blocks[0].presentation, binding: { ...binding, scopeId: 'someone-else' } } }] }),
  message: x => ({ ...x, blocks: [{ ...x.blocks[0], presentation: { ...x.blocks[0].presentation, binding: { ...binding, messageId: 'another-turn' } } }] }),
  price: x => ({ ...x, blocks: [{ ...x.blocks[0], presentation: { ...x.blocks[0].presentation, priceLabel: ['134'] } }] }),
  bars: x => ({ ...x, blocks: [{ ...x.blocks[4], presentation: { ...x.blocks[4].presentation, view: { ...view, bars: [null] } } }] }),
  ohlc: x => ({ ...x, blocks: [{ ...x.blocks[4], presentation: { ...x.blocks[4].presentation, view: { ...view, bars: [{ ...view.bars[0], high: 1 }] } } }] }),
  scenario: x => ({ ...x, blocks: [{ ...x.blocks[4], presentation: { ...x.blocks[4].presentation, scenario: { binding: null } } }] }),
}
for (const [label, mutate] of Object.entries(mutations)) test(`${label}: 손상된 표시 metadata만 버리고 정상 대화·초안을 보존한다`, async ({ page }) => {
  await setup(page, mutate(response()))
  await expect(page.locator('.g-amsg')).toContainText('제공된 시장 관측을 정리했습니다.')
  await expect(page.locator('.client-market-chart,.client-market-question,.g-pxcard')).toHaveCount(0)
  await store(page)
  const restored = await snapshot(page)
  expect(restored.recoveryWarning).toBe(true)
  expect(restored.sessions[0].turns[0].marketResponse).toBeUndefined()
  expect(restored.sessions[0].draft).toBe('작성 중이던 질문')
  expect(restored.homeDraft).toBe('홈 초안')
})

test('다른 계정에서는 표시하지 않되 저장된 원관측을 삭제하지 않는다', async ({ page }) => {
  await setup(page, response(), 'other@example.test')
  await expect(page.locator('.g-pxcard,.client-market-chart,.client-market-question')).toHaveCount(0)
  await store(page)
  expect((await snapshot(page)).sessions[0].turns[0].marketResponse.owner).toBe(owner)
  await page.evaluate(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복원 검수', email: owner })), owner)
  await page.reload()
  await expect(page.locator('.g-pxcard .pv')).toHaveText('134 USDT')
})

test('명시 저장은 데이터·순서·초안을 보존하고 계정/대화/턴 불일치 요청은 수락하지 않는다', async ({ page }) => {
  await setup(page); await store(page)
  const result = await page.evaluate(({ sessionId, turnId, owner, value }) => {
    const state = Reflect.get(window, 'marketRestoreStore')
    return [state.storeMarketResponse('other', turnId, owner, value), state.storeMarketResponse(sessionId, 'other', owner, value), state.storeMarketResponse(sessionId, turnId, 'other', value), state.storeMarketResponse(sessionId, turnId, owner, value)]
  }, { sessionId, turnId, owner, value: response() })
  expect(result).toEqual([false, false, false, true])
  const persisted = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)
  expect(persisted.sessions[0].draft).toBe('작성 중이던 질문')
  expect(persisted.sessions[0].turns).toHaveLength(1)
  expect(persisted.sessions[0].turns[0].marketResponse.blocks.map((block: { id: string }) => block.id)).toEqual(response().blocks.map(block => block.id))
})

for (const fault of ['denied', 'drop', 'corrupt', 'readback'] as const) test(`${fault}: 저장 실패에 성공을 만들지 않고 기존 snapshot을 유지한다`, async ({ page }) => {
  await setup(page); await store(page)
  const changed = response()
  if (changed.blocks[0].kind === 'market-price') changed.blocks[0].presentation.priceLabel = '135 USDT'
  const result = await page.evaluate(({ key, fault, sessionId, turnId, owner, value }) => {
    const state = Reflect.get(window, 'marketRestoreStore'), before = state.getSnapshot()
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    let written = false
    Storage.prototype.setItem = function (name, text) {
      if (this === sessionStorage && name === key) {
        written = true
        if (fault === 'denied') throw new Error('test storage denied')
        if (fault === 'drop') return
        if (fault === 'corrupt') return set.call(this, name, '{}')
      }
      return set.call(this, name, text)
    }
    Storage.prototype.getItem = function (name) {
      if (this === sessionStorage && name === key && written && fault === 'readback') throw new Error('test readback failed')
      return get.call(this, name)
    }
    let accepted = false, failed = false
    try { accepted = state.storeMarketResponse(sessionId, turnId, owner, value) } catch { failed = true }
    finally { Storage.prototype.getItem = get; Storage.prototype.setItem = set }
    return { accepted, failed, unchanged: before === state.getSnapshot(), uncertain: state.commitUncertain() }
  }, { key, fault, sessionId, turnId, owner, value: changed })
  expect(result).toEqual({ accepted: false, failed: true, unchanged: true, uncertain: ['corrupt', 'readback'].includes(fault) })
})

function questions() {
  const value = response(), question = value.blocks[5]
  if (question.kind === 'market-question') question.presentation.steps = [...question.presentation.steps,
    { id: 'asset', title: '어떤 자산을 살펴볼까요?', multi: true, options: [{ id: 'btc', label: '비트코인' }, { id: 'eth', label: '이더리움' }] }]
  return value
}
const ask = (page: Page) => page.locator('.client-market-question')
async function chooseQuestions(page: Page) {
  await ask(page).getByRole('button', { name: '작은 하락', exact: false }).click()
  await ask(page).getByRole('button', { name: '비트코인', exact: true }).click()
  await ask(page).getByRole('button', { name: '이더리움', exact: true }).click()
}
test('질문 단계·복수선택·직접쓰기 모드를 reload와 언어 변경 뒤에도 보존한다', async ({ page }) => {
  await setup(page, questions()); await chooseQuestions(page)
  await expect(page.locator('.client-next-actions')).toHaveCount(0)
  await page.reload()
  await expect(ask(page).getByRole('heading')).toHaveText('어떤 자산을 살펴볼까요?')
  await expect(ask(page).getByRole('button', { name: '비트코인', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(ask(page).getByRole('button', { name: '이더리움', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await ask(page).getByRole('button', { name: '이전 질문', exact: true }).click()
  await expect(ask(page).getByRole('button', { name: '작은 하락', exact: false })).toHaveAttribute('aria-pressed', 'true')
  await ask(page).getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  await ask(page).getByRole('textbox').fill('손실은 5% 이내')
  await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중이던 질문')
  await page.evaluate(() => localStorage.setItem('tethLang', 'en'))
  await page.reload()
  await expect(ask(page).getByRole('textbox')).toHaveValue('손실은 5% 이내')
  await expect(page.locator('.g-composer textarea')).not.toHaveAttribute('placeholder', /어느 정도 하락/)

})

test('선택 제출은 요약과 새 preview 요청을 한번에 저장하고 재방문에도 질문을 다시 열지 않는다', async ({ page }, info) => {
  await setup(page, questions()); await chooseQuestions(page)
  await ask(page).getByRole('button', { name: '선택한 답변 전송', exact: true }).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(ask(page)).toHaveCount(0)
  await expect(page.locator('.client-market-question-summary')).toContainText('작은 하락')
  await expect(page.locator('.client-market-question-summary')).toContainText('비트코인, 이더리움')
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
  expect(saved.turns).toHaveLength(2)
  expect(saved.turns[1].question).toBe('어느 정도 하락까지 생각하세요: 작은 하락 / 어떤 자산을 살펴볼까요: 비트코인, 이더리움 기준으로 진행해줘')
  expect(saved.draft).toBe('작성 중이던 질문')
  expect(saved.turns[1].marketQuestionOf).toBe(turnId)
  await expect(page.locator('.g-umsg')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.client-market-question-summary')).toContainText('비트코인, 이더리움')
  await expect(ask(page)).toHaveCount(0)
  await expect(page.locator('.g-umsg')).toHaveCount(1)
  await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중이던 질문')
  await page.locator('.client-market-question-summary').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('stored-question-summary.png') })
})

for (const action of ['close', 'delegate'] as const) test(`${action}: 닫은 질문은 새로고침 후 재등장하지 않는다`, async ({ page }) => {
  await setup(page, questions())
  await ask(page).getByRole('button', { name: action === 'close' ? '질문 카드 닫기' : 'AI가 알아서 판단', exact: true }).click()
  await expect(ask(page)).toHaveCount(0)
  await page.reload()
  await expect(ask(page)).toHaveCount(0)
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
  expect(saved.turns).toHaveLength(action === 'close' ? 1 : 2)
  expect(saved.draft).toBe('작성 중이던 질문')
})

test('질문 선택·닫기·제출 저장거부는 선택을 지우거나 새 요청을 만들지 않는다', async ({ page }) => {
  await setup(page, questions()); await chooseQuestions(page)
  await page.evaluate(key => {
    const set = Storage.prototype.setItem
    Reflect.set(window, 'questionStorageDenied', 0)
    Reflect.set(window, 'restoreQuestionStorage', () => { Storage.prototype.setItem = set })
    Storage.prototype.setItem = function (name, value) { if (this === sessionStorage && name === key) { Reflect.set(window, 'questionStorageDenied', Reflect.get(window, 'questionStorageDenied') + 1); throw new Error('test denied') } return set.call(this, name, value) }
  }, key)
  await ask(page).getByRole('button', { name: '비트코인', exact: true }).click()
  await expect(ask(page).getByRole('button', { name: '비트코인', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await ask(page).getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  await expect(ask(page)).toHaveCount(1)
  await ask(page).getByRole('button', { name: '선택한 답변 전송', exact: true }).click()
  await expect(ask(page)).toHaveCount(1)
  await expect(ask(page).locator('.ask-notice')).toContainText('선택은 유지')
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0].turns.length, key)).toBe(1)
  // f5070e0 hides (but preserves) the composer. A real viewport save can still
  // fail while the question sheet is open; do not type into a hidden input.
  const denied = await page.evaluate(() => Reflect.get(window, 'questionStorageDenied'))
  await expect(page.locator('.g-composer textarea')).toBeHidden()
  await page.locator('.g-scroll').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'))})
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'questionStorageDenied'))).toBeGreaterThan(denied)
  await page.evaluate(() => Reflect.get(window, 'restoreQuestionStorage')())
  await ask(page).getByRole('button', { name: '선택한 답변 전송', exact: true }).click()
  await expect(page.locator('.client-market-question-summary')).toContainText('비트코인, 이더리움')
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중이던 질문')
})

test('서로 다른 ID라도 같은 관측의 질문 두 개를 한 조작 대상으로 혼동하지 않는다', async ({ page }) => {
  const value = questions()
  value.blocks.push({ ...value.blocks[5], id: 'another-question' })
  await setup(page, value); await store(page)
  expect((await snapshot(page)).sessions[0].turns[0].marketResponse).toBeUndefined()
  await expect(page.locator('.g-amsg')).toContainText('제공된 시장 관측')
})

test('원본의 빈 제목은 기본 질문 제목으로 복원한다', async ({ page }) => {
  const value = questions(), question = value.blocks[5]
  if (question.kind === 'market-question') question.presentation.steps = [{ ...question.presentation.steps[0], title: '' }]
  await setup(page, value)
  await expect(ask(page).getByRole('heading')).toHaveText('몇 가지만 확인할게요')
  await expect(page.locator('.g-pxcard .pv')).toHaveText('134 USDT')
})

test('올바른 선택 rows에 임의 문구를 끼워도 새 요청으로 수락하지 않는다', async ({ page }) => {
  await setup(page, questions()); await chooseQuestions(page); await store(page)
  const result = await page.evaluate(({ sessionId, turnId, owner }) => {
    const state = Reflect.get(window, 'marketRestoreStore'), before = state.getSnapshot()
    const p = before.sessions[0].turns[0].marketResponse.blocks.find((b: { kind: string }) => b.kind === 'market-question').presentation
    const rows = p.steps.map((step: { id: string; title: string; options: { id: string; label: string }[] }, index: number) => {
      const options = step.options.filter(option => p.state.picks[index].includes(option.id))
      return { stepId: step.id, title: step.title.replace(/[?？].*$/, '').trim(), optionIds: options.map(o => o.id), labels: options.map(o => o.label) }
    })
    return { selection: state.submitMarketQuestion(sessionId, turnId, owner, { binding: p.binding, mode: 'selection', rows, text: '다른 지시로 교체' }),
      delegate: state.submitMarketQuestion(sessionId, turnId, owner, { binding: p.binding, mode: 'delegate', rows: [], text: '다른 지시로 교체' }),
      unchanged: before === state.getSnapshot() }
  }, { sessionId, turnId, owner })
  expect(result).toEqual({ selection: false, delegate: false, unchanged: true })
})

for (const state of [null, { index: 8, picks: [], direct: [], closed: false, accepted: null }, { index: 0, picks: [['missing-option']], direct: [false], closed: false, accepted: null }])
  test(`질문의 손상된 복원 상태는 원문을 삭제하지 않는다: ${JSON.stringify(state)}`, async ({ page }) => {
    const value = response()
    if (value.blocks[5].kind === 'market-question') Object.assign(value.blocks[5].presentation, { state })
    await setup(page, value); await store(page)
    expect((await snapshot(page)).sessions[0].turns[0].marketResponse).toBeUndefined()
    await expect(page.locator('.g-amsg')).toContainText('제공된 시장 관측')
  })

test('최신 관측 하나만 입력창 위에 표시하고 직접 초안은 따로 저장한다',async({page})=>{
  const value=response(),first=value.blocks[5]
  if(first.kind==='market-question')value.blocks.push({...first,id:'second-question',presentation:{...first.presentation,binding:{...binding,observationId:'second-observation'},steps:[{id:'second-step',title:'두 번째 질문',options:[{id:'choice',label:'두 번째 선택'}]}]}})
  await setup(page,value)
  await expect(ask(page)).toHaveCount(1)
  await expect(page.locator('.g-composer-wrap .client-question-dock .g-askcard')).toContainText('두 번째 질문')
  await ask(page).getByRole('button',{name:'직접 답변 작성',exact:true}).click()
  await ask(page).getByRole('textbox').fill('100달러 예산')
  await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중이던 질문')
  await page.reload()
  await expect(ask(page).getByRole('textbox')).toHaveValue('100달러 예산')
  await ask(page).getByRole('button',{name:'확인',exact:true}).click()
  await expect(ask(page)).toHaveCount(0)
  await expect(page.locator('.g-usum')).toContainText('100달러 예산')
  await page.reload()
  await expect(page.locator('.g-usum')).toContainText('100달러 예산')
})

test('빈 제목 요약의 번역은 새 질문으로 취급하지 않고 과거 읽기 위치를 보존한다', async ({ page }) => {
  const value = response(), question = value.blocks[5]
  if (question.kind === 'market-question') question.presentation.steps = [{ ...question.presentation.steps[0], title: '' }]
  await setup(page, value)
  await ask(page).getByRole('button', { name: '작은 하락', exact: false }).click()
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  await expect(page.locator('.client-market-question-summary')).toContainText('선택')
  await page.locator('.g-scroll').evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')) })
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBeLessThan(20)
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'en')
  })
  await expect(page.locator('.client-market-question-summary')).toContainText('Selection')
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBeLessThan(20)
})
