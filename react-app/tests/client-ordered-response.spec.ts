import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import type { StoredResponseSequence } from '../src/client-stored-response-sequence'
import type { StoredMarketResponse } from '../src/client-stored-market-response'
import type { MarketChartPresentation } from '../src/client-market-chart-presentation'
import { inlineInput } from '../src/client-inline-backtest'

const owner = 'ordered@example.test', sessionId = 'ordered-session', turnId = 'ordered-turn', key = 'teth-client-experience'
const first = '먼저 확인한 공개 자료입니다.', second = '추가 자료를 확인하고 있습니다.', draft = '작성 중인 별도 질문'
function chart(resolutionSeconds = 3600): MarketChartPresentation {
  return { binding: { scopeId: JSON.stringify([owner, sessionId]), messageId: turnId, observationId: `chart-${resolutionSeconds}` },
    seriesId: 'ordered-series', asset: 'BTC/USDT', assetLabel: '비트코인', resolutionSeconds, availableResolutions: [3600, 7200], state: 'ready',
    view: { identity: `ordered-${resolutionSeconds}`, market: 'BTC/USDT', resolutionSeconds, pricePrecision: 2,
      sourceLabel: '명시된 검수 관측 · 실제 시장 데이터 아님', fills: [], bars: Array.from({ length: 30 }, (_, i) => ({
        time: 1700000000 + i * resolutionSeconds, open: 100 + i, high: 105 + i, low: 99 + i, close: 103 + i, volume: 10 + i,
      })) } }
}
function market(): StoredMarketResponse {
  return { version: 1, owner, blocks: [{ id: 'chart', kind: 'market-chart', presentation: chart() },
    { id: 'question', kind: 'market-question', presentation: { binding: { ...chart().binding, observationId: 'question' },
      steps: [{ id: 'asset', title: '어느 자산을 살펴볼까요?', multi: true, options: [{ id: 'btc', label: '비트코인' }, { id: 'eth', label: '이더리움' }] }] } }] }
}
function sequence(revision = 1, done = false): StoredResponseSequence {
  return { version: 1, owner, sessionId, turnId, revision, status: done ? 'done' : 'running', blocks: [
    { id: 'work-a', kind: 'work', activity: { label: '처음 자료 확인', status: 'done', startedAt: 1700000000000, finishedAt: 1700000001000,
      steps: [{ id: 'search-a', title: '공개 자료 확인 완료', status: 'done', publicSummary: '출처에서 제공한 공개 요약입니다.' }] } },
    { id: 'text-a', kind: 'text', text: first, status: 'done' },
    { id: 'chart', kind: 'market-ref', blockId: 'chart' },
    { id: 'work-b', kind: 'work', activity: { label: '추가 자료 확인', status: done ? 'done' : 'running',
      steps: [{ id: 'search-b', title: '추가 자료 확인', status: done ? 'done' : 'running' }] } },
    { id: 'text-b', kind: 'text', text: done ? `${second} 확인을 마쳤습니다.` : second, status: done ? 'done' : 'streaming' },
    ...(done ? [{ id: 'question', kind: 'market-ref' as const, blockId: 'question' }] : []),
  ] }
}
function session(value: unknown = sequence()): ClientSession {
  return { id: sessionId, title: '순서 복원 검수', renamed: true, idea: '자료를 확인해줘', draft, pair: 'BTC/USDT', mode: 'dip',
    timeframe: '1시간봉', risk: '-3%', takeProfit: '+8%', phase: 'plan', researchStatus: '초안', workspace: 'conversation', tradingReady: false,
    updatedAt: 1700000001000, turns: [{ id: turnId, question: '자료를 확인해줘', answer: '원래 본문 보존', fullAnswer: '가상 타이머가 만들면 안 되는 본문',
      phase: 'plan', status: 'running', startedAt: new Date('2026-09-20T12:00:00Z').getTime(), suggestions: [],
      marketResponse: market(), ...(value === undefined ? {} : { responseSequence: value as StoredResponseSequence }) }] }
}
async function mount(page: Page, initial = session(), account = owner, others: ClientSession[] = []) {
  await page.clock.install({ time: new Date('2026-09-20T12:00:00Z') }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ key, initial, account, others }) => {
    if (sessionStorage.getItem('ordered-seeded')) return
    sessionStorage.setItem('ordered-seeded', 'true'); localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '순서 검수', email: account }))
    sessionStorage.setItem(key, JSON.stringify({ currentId: initial.id, sessions: [initial, ...others], homeDraft: '홈 초안', sharedFollows: [] }))
  }, { key, initial, account, others })
  await page.route('**/ordered-response-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>' }))
  await page.goto('/ordered-response-test.html'); await boot(page, account)
}
async function boot(page: Page, account = owner) {
  await page.evaluate(async account => {
    const path = '/tests/fixtures/ordered-response-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'orderedHost', mount(account))
  }, account)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
}
// Lazy StrictMode setup can attach a canvas before initial runtime cleanup.
// The drawing cursor is enabled only after its real chart API is available.
// Only continuity tests require this readiness; negative cases need none.
async function expectDrawableMarketCanvas(page: Page) {
  await expect(page.locator('.client-market-chart .cp-drawing-tools button').first()).toBeEnabled()
  const canvas = page.locator('.client-market-chart .cp-surface canvas').first()
  await expect(canvas).toHaveAttribute('width', /^[1-9]\d*$/)
  await expect(canvas).toHaveAttribute('height', /^[1-9]\d*$/)
}
const saved = (page: Page): Promise<ClientSession> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
const deliver = (page: Page, value = sequence(2, true), expectedRevision = value.revision - 1, index?: number) => page.evaluate(({ value, expectedRevision, index }) =>
  Reflect.get(window, 'orderedHost').deliver({ sessionId: value.sessionId, turnId: value.turnId, expectedRevision, sequence: value }, index), { value, expectedRevision, index })
async function order(page: Page) {
  return page.locator('.g-act2,.g-amsg,.client-market-chart,.client-market-question').evaluateAll(nodes => nodes.map(node =>
    node.classList.contains('g-act2') ? 'work' : node.classList.contains('g-amsg') ? 'text' : node.classList.contains('client-market-chart') ? 'chart' : 'question'))
}

test('공개 부모가 작업·본문·차트 교차 순서를 저장/복원하고 시간이 지나도 관측을 만들지 않는다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  expect(await order(page)).toEqual(['work', 'text', 'chart', 'work', 'text'])
  await expect(page.locator('.g-amsg')).toHaveText([first, second])
  await page.clock.fastForward(120000)
  expect((await saved(page)).turns[0].responseSequence).toEqual(sequence())
  expect((await saved(page)).turns[0].status).toBe('running')
  await page.reload(); await boot(page)
  expect(await order(page)).toEqual(['work', 'text', 'chart', 'work', 'text'])
  await expect(page.locator('.g-amsg')).toHaveText([first, second])
  await expect(page.locator('.client-clarification-card,.client-next-actions')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('ordered-running.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('다음 관측은 기존 본문 DOM·작업 펼침·canvas·초안을 유지하며 마지막 본문만 전개한다', async ({ page }, info) => {
  await mount(page)
  await page.locator('.g-act2 .hd').first().click()
  await page.locator('.g-amsg').first().evaluate(el => Reflect.set(window, 'firstObservedText', el))
  await expectDrawableMarketCanvas(page)
  await page.locator('.client-market-chart canvas').first().evaluate(el => Reflect.set(window, 'observedCanvas', el))
  const beforeSubscriptions = await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)
  await page.evaluate(() => Reflect.get(window, 'orderedHost').render())
  expect(await deliver(page)).toBe(true)
  expect(await order(page)).toEqual(['work', 'text', 'chart', 'work', 'text', 'question'])
  await expect(page.locator('.g-act2 .hd').first()).toHaveAttribute('aria-expanded', 'true')
  expect(await page.locator('.g-amsg').first().evaluate(el => el === Reflect.get(window, 'firstObservedText'))).toBe(true)
  expect(await page.locator('.client-market-chart canvas').first().evaluate(el => el === Reflect.get(window, 'observedCanvas'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)).toBe(beforeSubscriptions)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.locator('.g-askcard').getByText('이더리움', { exact: true }).click()
  await page.locator('.market-chart-intervals').getByRole('button', { name: '2시간', exact: true }).click()
  await page.evaluate(value => Reflect.get(window, 'orderedHost').charts[0].resolve(value), chart(7200))
  await expect(page.locator('.market-chart-intervals').getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.locator('.client-market-chart canvas').first().evaluate(el => el === Reflect.get(window, 'observedCanvas'))).toBe(true)
  await page.reload(); await boot(page)
  expect(await order(page)).toEqual(['work', 'text', 'chart', 'work', 'text', 'question'])
  expect((await saved(page)).turns[0].marketResponse!.blocks[1]).toMatchObject({ presentation: { state: { picks: [['eth']] } } })
  await expect(page.locator('.market-chart-intervals').getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: info.outputPath('ordered-complete.png'), fullPage: true })
})

for (const boundary of ['disconnect', 'source', 'owner', 'unmount'] as const) test(`${boundary}: 닫힌 공급자의 늦은 관측은 현재 대화에 적용되지 않는다`, async ({ page }) => {
  await mount(page)
  const index = await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length - 1)
  await page.evaluate(boundary => {
    const host = Reflect.get(window, 'orderedHost')
    if (boundary === 'disconnect') host.connected(false)
    else if (boundary === 'source') host.source('another-source')
    else if (boundary === 'owner') host.source('ordered-source', 'foreign@example.test')
    else host.unmount()
  }, boundary)
  expect(await page.evaluate(index => Reflect.get(window, 'orderedHost').subscriptions[index].signal.aborted, index)).toBe(true)
  expect(await deliver(page, sequence(2, true), 1, index)).toBe(false)
  expect((await saved(page)).turns[0].responseSequence?.revision).toBe(1)
})

for (const fault of ['denied', 'drop', 'readback'] as const) test(`${fault}: 저장 미확인은 순서·본문·초안을 그대로 유지한다`, async ({ page }) => {
  await mount(page)
  const refused = await page.evaluate(({ key, fault, packet }) => {
    const set = Storage.prototype.setItem, get = Storage.prototype.getItem; let wrote = false
    Reflect.set(window, 'restoreOrderedStorage', () => { Storage.prototype.setItem = set; Storage.prototype.getItem = get })
    Storage.prototype.setItem = function (name, value) {
      if (this === sessionStorage && name === key) {
        wrote = true
        if (fault === 'denied') throw new Error('PRIVATE_STORAGE_EXCEPTION')
        if (fault === 'drop') return
      }
      set.call(this, name, value)
    }
    Storage.prototype.getItem = function (name) {
      if (this === sessionStorage && name === key && wrote && fault === 'readback') throw new Error('PRIVATE_READBACK_EXCEPTION')
      return get.call(this, name)
    }
    // Fault only the response transaction, not unrelated scheduled viewport
    // persistence; restoration cannot clear an uncertain committed readback.
    try { return Reflect.get(window, 'orderedHost').deliver(packet) }
    finally { Storage.prototype.setItem = set; Storage.prototype.getItem = get }
  }, { key, fault, packet: { sessionId, turnId, expectedRevision: 1, sequence: sequence(2, true) } })
  expect(refused).toBe(false)
  await expect(page.locator('.g-amsg')).toHaveText([first, second])
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('body')).not.toContainText('PRIVATE_')
  await page.evaluate(() => Reflect.get(window, 'restoreOrderedStorage')())
  if (fault === 'readback') { await page.reload(); await boot(page); expect((await saved(page)).turns[0].status).toBe('done') }
  else expect(await deliver(page)).toBe(true)
})

test('다른 화면에서도 소유 대화의 순서 기록이 이어지며 돌아왔을 때 완성된 관측을 보여준다', async ({ page }) => {
  await mount(page)
  const before = await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)
  await page.evaluate(() => { history.pushState(null, '', '#/share'); window.dispatchEvent(new Event('teth:navigate')) })
  await expect(page.locator('.client-sharing-hub')).toBeVisible()
  expect(await deliver(page)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)).toBe(before)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-amsg')).toHaveText([first, `${second} 확인을 마쳤습니다.`])
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
})

test('손상된 순서 자료는 보존 본문을 가상 재생하지 않고 다른 대화와 초안을 유지한다', async ({ page }) => {
  const initial = session({ ...sequence(), blocks: [{ id: 'bad', kind: 'unknown' }] })
  await mount(page, initial)
  await expect(page.locator('.client-global-notice')).toContainText('복원하지 못했습니다')
  await page.clock.fastForward(120000)
  const result = await saved(page)
  expect(result.turns[0].answer).toBe('원래 본문 보존'); expect(result.turns[0].responseSequenceInvalid).toBe(true)
  await expect(page.locator('.g-act2,.g-amsg')).toHaveCount(0)
  expect(await deliver(page, sequence(1), 0)).toBe(false)
  await page.reload(); await boot(page); await page.clock.fastForward(120000)
  expect((await saved(page)).turns[0].answer).toBe('원래 본문 보존')
})

test('명시 중단은 관측을 보존하며 늦은 완료나 fixture 재시도로 되살리지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  expect(await deliver(page)).toBe(false)
  const result = await saved(page)
  expect(result.turns[0].responseSequence?.status).toBe('stopped')
  await expect(page.getByRole('button', { name: '이어서 계속', exact: true })).toHaveCount(0)
  await page.reload(); await boot(page); await page.clock.fastForward(120000)
  expect((await saved(page)).turns[0].responseSequence?.status).toBe('stopped')
})

test('최초 공급은 시장 자료와 순서를 함께 저장하고 오래된 revision·다른 owner는 거절한다', async ({ page }) => {
  const initial = session()
  delete initial.turns[0].responseSequence; delete initial.turns[0].marketResponse
  await mount(page, initial)
  const packet = { sessionId, turnId, expectedRevision: 0, sequence: sequence(), marketResponse: market() }
  expect(await page.evaluate(packet => Reflect.get(window, 'orderedHost').deliver(packet), packet)).toBe(true)
  expect(await order(page)).toEqual(['work', 'text', 'chart', 'work', 'text'])
  const rejected = await page.evaluate(({ key, packets }) => {
    const before = JSON.parse(sessionStorage.getItem(key)!).sessions[0]
    const accepted = packets.map(packet => Reflect.get(window, 'orderedHost').deliver(packet))
    return { before, accepted, after: JSON.parse(sessionStorage.getItem(key)!).sessions[0] }
  }, { key, packets: [
    { sessionId, turnId, expectedRevision: 0, sequence: sequence(1) },
    { sessionId, turnId, expectedRevision: 1, sequence: { ...sequence(2), owner: 'another@example.test' } },
    { sessionId, turnId, expectedRevision: 1, sequence: { ...sequence(2), turnId: 'another-turn' } },
  ] })
  expect(rejected.accepted).toEqual([false, false, false])
  expect(rejected.after).toEqual(rejected.before)
  await page.reload(); await boot(page)
  expect((await saved(page)).turns[0].responseSequence).toEqual(sequence())
})

test('새 시장 카드가 기존 질문 관측과 충돌하면 병합 전체를 거절하고 원기록을 보존한다', async ({ page }) => {
  await mount(page)
  const duplicate = { ...market().blocks[1], id: 'duplicate-question' }
  const next = sequence(2, true)
  next.blocks.push({ id: duplicate.id, kind: 'market-ref', blockId: duplicate.id })
  const packet = { sessionId, turnId, expectedRevision: 1, sequence: next,
    marketResponse: { version: 1, owner, blocks: [duplicate] } }
  // Keep the rejected synchronous delivery and whole-record comparison in one
  // browser task; unrelated scheduled viewport persistence must not interleave.
  const atomic = await page.evaluate(({ packet, key }) => {
    const before = JSON.parse(sessionStorage.getItem(key)!).sessions[0]
    const accepted = Reflect.get(window, 'orderedHost').deliver(packet)
    const after = JSON.parse(sessionStorage.getItem(key)!).sessions[0]
    return { before, accepted, after }
  }, { packet, key })
  expect(atomic.accepted).toBe(false)
  expect(atomic.after).toEqual(atomic.before)
  await page.reload(); await boot(page)
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  expect((await saved(page)).turns[0].responseSequence).toEqual(sequence())
})

test('관측된 응답에 남은 preview 검증 입력은 가상 결과·영구 busy·복원 경고를 만들지 않는다', async ({ page }) => {
  const initial = session()
  initial.turns[0].inlineRequest = inlineInput(initial)
  expect(initial.turns[0].inlineRequest).toBeDefined()
  await mount(page, initial)
  await page.clock.fastForward(120000)
  expect((await saved(page)).inlineResults ?? []).toEqual([])
  expect(await deliver(page)).toBe(true)
  await page.clock.fastForward(120000)
  expect((await saved(page)).inlineResults ?? []).toEqual([])
  await expect(page.getByRole('button', { name: '응답 중지', exact: true })).toHaveCount(0)
  await page.reload(); await boot(page)
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await page.clock.fastForward(120000)
  expect((await saved(page)).inlineResults ?? []).toEqual([])
  expect((await saved(page)).turns[0].responseSequence?.status).toBe('done')
})

test('320px 언어 변경과 후속 관측은 선택한 본문·canvas·초안·공급 구독을 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await mount(page)
  await expectDrawableMarketCanvas(page)
  await page.locator('.g-amsg').first().evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  })
  await page.locator('.client-market-chart canvas').first().evaluate(el => Reflect.set(window, 'selectedCanvas', el))
  const before = await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await page.evaluate(language => Reflect.get(window, 'orderedHost').language(language), language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('.g-amsg')).toHaveText([first, second])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(await page.locator('.client-market-chart canvas').first().evaluate(el => el === Reflect.get(window, 'selectedCanvas'))).toBe(true)
  }
  expect(await deliver(page)).toBe(true)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(first)
  expect(await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)).toBe(before)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.screenshot({ path: info.outputPath('ordered-320.png'), fullPage: true })
})

test('다른 대화를 선택해도 원대화 관측을 계속 저장하며 현재 대화와 초안은 건드리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const other = session()
  other.id = 'other-session'; other.title = '다른 대화 검수'; other.draft = '다른 대화의 작성 중 질문'
  other.turns = [{ ...other.turns[0], id: 'other-turn', status: 'done', answer: '다른 대화 본문', fullAnswer: '다른 대화 본문' }]
  delete other.turns[0].responseSequence; delete other.turns[0].marketResponse
  await mount(page, session(), owner, [other])
  const before = await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)
  await page.locator('.client-rail-logo-row button').click()
  await page.locator('.client-session').filter({ hasText: other.title }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(other.draft)
  expect(await deliver(page)).toBe(true)
  await expect(page.locator('.g-amsg')).toHaveText('다른 대화 본문')
  await expect(page.locator('.g-composer textarea')).toHaveValue(other.draft)
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).currentId, key)).toBe(other.id)
  expect(await page.evaluate(() => Reflect.get(window, 'orderedHost').subscriptions.length)).toBe(before)
  await page.locator('.client-rail-logo-row button').click()
  await page.locator('.client-session').filter({ hasText: '순서 복원 검수' }).click()
  await expect(page.locator('.g-amsg')).toHaveText([first, `${second} 확인을 마쳤습니다.`])
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
})

test('답변을 드래그 선택해 읽는 동안 새 본문이 길어져도 읽기 위치를 강제로 이동하지 않는다', async ({ page }) => {
  const initial = sequence()
  initial.blocks = initial.blocks.filter(block => block.kind === 'text')
  await mount(page, session(initial))
  await page.clock.runFor(100)
  await page.locator('.g-amsg').first().evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  })
  const top = await page.locator('.g-scroll').evaluate(el => el.scrollTop)
  const next = structuredClone(initial)
  next.revision = 2
  const last = next.blocks.at(-1)!
  if (last.kind === 'text') last.text += '\n\n' + Array.from({ length: 40 }, () => '후속으로 공급된 공개 자료를 표시합니다.').join('\n\n')
  expect(await deliver(page, next)).toBe(true)
  await page.clock.runFor(200)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(first)
  expect(Math.abs(await page.locator('.g-scroll').evaluate(el => el.scrollTop) - top)).toBeLessThan(2)
  await expect(page.locator('.g-newmsg')).toBeVisible()
  await page.locator('.g-newmsg').focus()
  await page.locator('.g-newmsg').press('Enter')
  await page.clock.runFor(100)
  expect(await page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(top + 100)
  await expect(page.locator('.g-newmsg')).toHaveCount(0)
  const resumedTop = await page.locator('.g-scroll').evaluate(el => el.scrollTop)
  next.revision = 3
  if (last.kind === 'text') last.text += '\n\n' + '명시 복귀 뒤 새로 공급된 본문입니다.\n\n'.repeat(10)
  expect(await deliver(page, next)).toBe(true)
  await page.clock.runFor(200)
  expect(await page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(resumedTop + 100)
  await expect(page.locator('.g-newmsg')).toHaveCount(0)
})
