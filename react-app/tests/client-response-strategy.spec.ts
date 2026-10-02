import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import { inlineInput } from '../src/client-inline-backtest'
import { readResponseStrategy, responseStrategyForTurn } from '../src/client-response-strategy'
import { readStoredResponseSequence, canAdvanceResponseSequence, type StoredResponseSequence } from '../src/client-stored-response-sequence'
import { commonBacktestInput, commonTurn, readCommonBacktest } from '../src/client-common-backtest-preview'

const key = 'teth-client-experience', owner = 'proposal@example.test', sid = 'proposal-session', tid = 'proposal-turn'
const now = new Date('2026-10-01T00:00:00Z').getTime()
const input = inlineInput({ pair: 'ETH/USDT', timeframe: '일봉', risk: '-4%', takeProfit: '+9%', mode: 'trend', requestedRsi: 31 })!
const proposal = { input, name: '직접 정한 반등 전략', period: 365 as const,
  excludedConditions: ['거래량 급증', '뉴스 발표 직전', '주말 제외', '<img src=x onerror=alert(1)>'] }
function sequence(revision = 1, done = false): StoredResponseSequence {
  return { version: 1, owner, sessionId: sid, turnId: tid, revision, status: done ? 'done' : 'running',
    blocks: [{ id: 'answer', kind: 'text', status: done ? 'done' : 'streaming', text: done ? '조건을 정리했습니다.' : '조건을' }],
    ...(done ? { strategyProposal: proposal } : {}) }
}
function session(): ClientSession {
  return { id: sid, title: '사용자가 바꾼 대화 제목', renamed: true, idea: '전략을 정리해줘', draft: '별도로 작성한 질문',
    pair: 'BTC/USDT', mode: 'dip', timeframe: '1시간봉', risk: '-3%', takeProfit: '+8%', phase: 'plan',
    researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: now,
    turns: [{ id: tid, question: '전략을 정리해줘', answer: '', fullAnswer: '로컬 응답을 대체할 관측',
      phase: 'plan', status: 'running', startedAt: now, suggestions: [] }] }
}
function completed(): ClientSession {
  const s = session()
  s.turns[0] = { ...s.turns[0], status: 'done', responseSequence: structuredClone(sequence(1, true)), strategyObservedAt: now,
    inlineRequest: input, backtestFlow: 'common' }
  return s
}

test('명시된 제목·최대4조건·입력을 분리 보존하며 없던 조건을 만들지 않는다', () => {
  const supplied = structuredClone(proposal), decoded = readResponseStrategy(supplied)!
  expect(decoded).toEqual(supplied); expect(decoded).not.toBe(supplied)
  supplied.excludedConditions[0] = '이후 변경'; supplied.input.parameters.sl = -12
  expect(decoded).toEqual(proposal)
  expect(readResponseStrategy({ input, period: 0, excludedConditions: [] })).toEqual({ input, period: 0, excludedConditions: [] })
  expect(readResponseStrategy({ ...proposal, ignored: 'not stored' })).not.toHaveProperty('ignored')
})

test('희소/비문자/초과 조건·범위 밖 기간·손상 입력을 조용히 보정하지 않는다', () => {
  for (const value of [null, [], {}, { ...proposal, period: '365' }, { ...proposal, period: 7 },
    { ...proposal, name: '' }, { ...proposal, name: {} }, { ...proposal, name: 'x'.repeat(129) },
    { ...proposal, input: { ...input, requestedRsi: 44 } }, { ...proposal, input: undefined },
    { ...proposal, input: { ...input, pair: ['ETH/USDT'] } }, { ...proposal, input: { ...input, timeframe: ['일봉'] } },
    ...[null, Array(1), [''], [false], ['a'.repeat(1001)], ['a', 'b', 'c', 'd', 'e']].map(excludedConditions => ({ ...proposal, excludedConditions })),
  ]) expect(readResponseStrategy(value)).toBeUndefined()
})

test('제안은 완료 응답에만 결속하며 일반 답변은 백테스트 입력이 아니다', () => {
  for (const status of ['running', 'stopped', 'failed'] as const) {
    expect(readStoredResponseSequence({ ...sequence(1, true), status }, sid, tid, undefined)).toBeNull()
  }
  expect(readStoredResponseSequence(sequence(1, true), sid, tid, undefined)).toEqual(sequence(1, true))
  expect(canAdvanceResponseSequence(sequence(), sequence(2, true))).toBe(true)
  expect(canAdvanceResponseSequence(sequence(1, true), sequence(2, true))).toBe(false)
  const s = completed(), t = s.turns[0]
  expect(commonTurn(t)).toBe(true)
  expect(responseStrategyForTurn(t)).toEqual(proposal)
  expect(commonTurn({ ...t, responseSequence: { ...sequence(1, true), strategyProposal: undefined } })).toBe(false)
  for (const strategyObservedAt of [undefined, now - 1, NaN, Date.now() + 60000]) {
    expect(commonTurn({ ...t, strategyObservedAt })).toBe(false)
  }
  expect(commonTurn({ ...t, inlineRequest: { ...input, parameters: { ...input.parameters, sl: -12 } } })).toBe(false)
  const state = { turnId: tid, amount: 1000 as const, period: 365 as const }
  expect(readCommonBacktest(state, s.turns)).toEqual(state)
  expect(readCommonBacktest({ ...state, startedAt: now - 1 }, s.turns)).toBeUndefined()
  expect(commonBacktestInput({ ...s, commonBacktest: state })?.input.parameters.rsiTh).toBe(31)
  expect(t.finishedAt).toBeUndefined()
})

async function mount(page: Page, initial = session(), account = owner) {
  await page.clock.install({ time: now }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ initial, account, key }) => {
    if (sessionStorage.getItem('proposal-seeded')) return
    sessionStorage.setItem('proposal-seeded', 'true'); localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '제안 검수', email: account }))
    sessionStorage.setItem(key, JSON.stringify({ currentId: initial.id, sessions: [initial], homeDraft: '홈 초안', sharedFollows: [] }))
  }, { initial, account, key })
  await page.route('**/proposal-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>' }))
  await page.goto('/proposal-test.html'); await boot(page, account)
}
async function boot(page: Page, account = owner) {
  await page.evaluate(async account => {
    const path = '/tests/fixtures/ordered-response-host.tsx', { mount } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'proposalHost', mount(account))
  }, account)
  await expect(page.locator('.client-source-app')).toBeVisible()
}
const saved = (page: Page): Promise<ClientSession> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
const deliver = (page: Page, value = sequence(2, true)) => page.evaluate(value => Reflect.get(window, 'proposalHost').deliver({
  sessionId: value.sessionId, turnId: value.turnId, expectedRevision: value.revision - 1, sequence: value,
}), value)

test('Main 공급→원본 카드→검증→복귀/새로고침에서 같은 조건과 제목을 유지한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await mount(page)
  expect(await deliver(page, sequence())).toBe(true)
  await expect(page.getByTestId('common-strategy-summary')).toHaveCount(0)
  expect(await deliver(page)).toBe(true)
  const card = page.getByTestId('common-strategy-summary')
  await expect(card.getByRole('heading')).toHaveText(proposal.name)
  await expect(card).toContainText(proposal.excludedConditions.join(', '))
  await expect(card.locator('img')).toHaveCount(0)
  await expect(card).toContainText('RSI가 31')
  expect((await saved(page)).title).toBe('사용자가 바꾼 대화 제목')
  expect((await saved(page)).turns[0].inlineRequest).toEqual(input)
  const observedAt = (await saved(page)).turns[0].strategyObservedAt!
  expect(observedAt).toBeGreaterThanOrEqual(now)
  expect(observedAt).toBeLessThanOrEqual(await page.evaluate(() => Date.now()))
  expect((await saved(page)).turns[0].finishedAt).toBeUndefined()
  expect((await saved(page)).commonBacktest).toBeUndefined()
  await page.reload(); await boot(page)
  expect((await saved(page)).turns[0].strategyObservedAt).toBe(observedAt)
  await expect(card.getByRole('heading')).toHaveText(proposal.name)
  await card.getByRole('heading').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('proposal-card.png'), fullPage: true })
  await card.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click()
  const bt = page.getByTestId('common-backtest-shell')
  await expect(bt.getByRole('heading', { name: proposal.name, exact: true })).toBeVisible()
  await expect(bt.getByRole('button', { name: '최근 1년', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const fold = bt.locator('details').filter({ has: page.getByRole('heading', { name: '이 전략의 규칙', exact: true }) }).first()
  if (await fold.getAttribute('open') === null) await fold.locator('summary').click()
  await expect(fold).toContainText(proposal.excludedConditions.join(', '))
  expect((await saved(page)).commonBacktest?.startedAt).toBeUndefined()
  await bt.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await expect(page.getByTestId('common-result')).toBeVisible()
  // Closed mobile details hide their heading from role queries. Match the
  // source summary itself, then retain the excluded-condition assertion.
  const resultRules = bt.locator('details').filter({ has: page.locator('summary').filter({ hasText: '이 전략의 규칙' }) }).first()
  // Source 9fb index.html:8206 hides mobile result folds. Setup above already
  // checks the visible conditions; result persistence must not force a click.
  if ((page.viewportSize()?.width ?? 0) <= 768) await expect(resultRules).toBeHidden()
  else await resultRules.locator('summary').click()
  await expect(resultRules).toContainText(proposal.excludedConditions.join(', '))
  await bt.getByRole('button', { name: '대화로 돌아가기', exact: true }).filter({ visible: true }).first().click()
  await expect(card.getByRole('button', { name: '이어서 보기', exact: true })).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue('별도로 작성한 질문')
  await page.reload(); await boot(page)
  expect((await saved(page)).turns[0].responseSequence?.strategyProposal).toEqual(proposal)
  await card.getByRole('button', { name: '이어서 보기', exact: true }).click()
  await expect(page.getByTestId('common-result')).toBeVisible()
  expect(errors).toEqual([])
})

test('열린 로컬 결과에는 늦은 공급 응답이 덮어쓰지 않는다', async ({ page }) => {
  const s = completed()
  s.turns[0] = { ...s.turns[0], responseSequence: undefined, strategyObservedAt: undefined, finishedAt: now, commonBacktestOpened: true }
  s.commonBacktest = { turnId: tid, amount: 1000, period: 730 }
  await mount(page, s)
  const before = await saved(page)
  expect(await deliver(page, sequence(1, true))).toBe(false)
  expect((await saved(page)).turns).toEqual(before.turns)
  expect((await saved(page)).commonBacktest).toEqual(before.commonBacktest)
})

for (const fault of ['input', 'receipt', 'proposal'] as const) test(`${fault}: 손상된 제안은 다른 기록을 지우거나 로컬 전략으로 재생하지 않는다`, async ({ page }) => {
  const s = completed()
  s.commonBacktest = { turnId: tid, period: 365, amount: 1000 }
  if (fault === 'input') s.turns[0].inlineRequest = { ...input, parameters: { ...input.parameters, sl: -12 } }
  if (fault === 'receipt') s.turns[0].strategyObservedAt = now - 1
  if (fault === 'proposal') s.turns[0].responseSequence!.strategyProposal!.excludedConditions = ['a', 'b', 'c', 'd', 'e']
  await mount(page, s)
  await expect(page.getByTestId('common-strategy-summary')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('별도로 작성한 질문')
  await page.evaluate(() => { location.hash = '/share/bt/mine' })
  await expect(page.getByTestId('common-backtest-shell')).toContainText('대화에서 백테스트할 전략을 먼저 선택해주세요.')
  await expect(page.getByTestId('common-result')).toHaveCount(0)
})

test('다른 계정에는 전략 카드/직접주소 결과가 노출되지 않고 원문은 보관한다', async ({ page }) => {
  const s = completed(); s.commonBacktest = { turnId: tid, period: 365, amount: 1000, startedAt: now, skipped: true }
  await mount(page, s, 'other@example.test')
  await expect(page.getByTestId('common-strategy-summary')).toHaveCount(0)
  await page.evaluate(() => { location.hash = '/share/bt/mine' })
  await expect(page.getByTestId('common-backtest-shell')).toContainText('대화에서 백테스트할 전략을 먼저 선택해주세요.')
  await expect(page.getByRole('heading', { name: proposal.name, exact: true })).toHaveCount(0)
  expect((await saved(page)).turns[0].responseSequence?.strategyProposal).toEqual(proposal)
})

test('거절된 저장은 제안 카드를 게시하지 않고 같은 관측을 재시도할 수 있다', async ({ page }) => {
  await mount(page); expect(await deliver(page, sequence())).toBe(true)
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Reflect.set(window, 'restoreProposalStorage', () => { Storage.prototype.setItem = original })
    Storage.prototype.setItem = function(k, value) { if (k === key) throw new Error('test denied'); return original.call(this, k, value) }
  }, key)
  expect(await deliver(page)).toBe(false)
  await expect(page.getByTestId('common-strategy-summary')).toHaveCount(0)
  expect((await saved(page)).turns[0].responseSequence?.revision).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'restoreProposalStorage')())
  expect(await deliver(page)).toBe(true)
  await expect(page.getByTestId('common-strategy-summary').getByRole('heading')).toHaveText(proposal.name)
})

test('7언어·좁은 화면·200%에서 긴 조건을 생략하거나 HTML로 실행하지 않는다', async ({ page }, info) => {
  const s = completed()
  const long = '공급된 제외 조건 '.repeat(16) + 'a'.repeat(120)
  s.turns[0].responseSequence!.strategyProposal = { ...proposal, excludedConditions: [long, ...proposal.excludedConditions.slice(1)] }
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page, s)
  for (const [language, label] of [['ko', '검증에서 뺀 조건'], ['en', 'Excluded conditions'], ['ja', '検証から除外した条件'],
    ['zh-CN', '验证排除条件'], ['zh-TW', '驗證排除條件'], ['es', 'Condiciones excluidas'], ['fr', 'Conditions exclues']]) {
    await page.evaluate(language => Reflect.get(window, 'proposalHost').language(language), language)
    const card = page.getByTestId('common-strategy-summary')
    await expect(card.locator('dt').last()).toHaveText(label)
    await expect(card.locator('dd').last()).toContainText(long)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(card.locator('img')).toHaveCount(0)
  }
  await page.getByTestId('common-strategy-summary').evaluate(el => {
    const sizes = [...el.querySelectorAll<HTMLElement>('h3,dt,dd,p,button')].map(node => ({ node, size: parseFloat(getComputedStyle(node).fontSize) * 2 }))
    sizes.forEach(({ node, size }) => { node.style.fontSize = `${size}px` })
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByTestId('common-strategy-summary').locator('dt').last().scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('proposal-fr-expanded.png'), fullPage: true })
})

test('다른 화면에서 완료 제안을 받아도 자동 이동하지 않으며 수정 클릭은 초안을 보존한다', async ({ page }) => {
  await mount(page); expect(await deliver(page, sequence())).toBe(true)
  await page.evaluate(() => { history.pushState(null, '', '#/share'); window.dispatchEvent(new Event('teth:navigate')) })
  await expect(page.locator('.client-sharing-hub')).toBeVisible()
  expect(await deliver(page)).toBe(true)
  await expect(page.locator('.client-sharing-hub')).toBeVisible()
  expect((await saved(page)).commonBacktest).toBeUndefined()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  const card = page.getByTestId('common-strategy-summary')
  await expect(card.getByRole('heading')).toHaveText(proposal.name)
  await card.locator('.summary-edit').click()
  await expect(page.locator('.g-composer textarea')).toHaveValue('별도로 작성한 질문')
  await expect(page.locator('.g-composer textarea')).toBeFocused()
  expect((await saved(page)).turns).toHaveLength(1)
})

test('store 직접 검증 선택도 소유자를 검사하며 수정 없이 원 입력을 보존한다', async ({ page }) => {
  await mount(page, completed())
  const result = await page.evaluate(async ({ sid, tid, owner }) => {
    const path = '/src/client-experience-store.ts', { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore(), selection = { turnId: tid, period: 365, amount: 1000 }
    const before = JSON.stringify(store.getSnapshot())
    let guestDenied = false, otherDenied = false
    try { store.commonBacktest(sid, selection) } catch { guestDenied = true }
    try { store.commonBacktest(sid, selection, 'other@example.test') } catch { otherDenied = true }
    const unchanged = JSON.stringify(store.getSnapshot()) === before
    const accepted = store.commonBacktest(sid, selection, owner)
    return { guestDenied, otherDenied, unchanged, accepted, turn: store.getSnapshot().sessions[0].turns[0] }
  }, { sid, tid, owner })
  expect(result).toMatchObject({ guestDenied: true, otherDenied: true, unchanged: true, accepted: true })
  expect(result.turn.inlineRequest).toEqual(input)
  expect(result.turn.responseSequence?.strategyProposal).toEqual(proposal)
})

test('선택적 제목/제외조건이 없는 제안에도 명시 RSI를 숨기거나 누락 조건을 합성하지 않는다', async ({ page }) => {
  const s = completed()
  const request = { ...input, requestedRsi: undefined, parameters: { ...input.parameters, rsiTh: 44 } }
  s.turns[0].inlineRequest = request
  s.turns[0].responseSequence!.strategyProposal = { input: request, period: 0, excludedConditions: [] }
  await mount(page, s)
  const card = page.getByTestId('common-strategy-summary')
  await expect(card).toContainText('RSI가 44 아래')
  await expect(card).not.toContainText('검증에서 뺀 조건')
  await card.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click()
  await expect(page.getByTestId('common-backtest-shell').getByRole('button', { name: '전체 기간', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
