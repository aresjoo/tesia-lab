import { expect, test, type Page } from '@playwright/test'
import { commonRevisionDirectionQuestion, createCommonRevisionDirection, readCommonRevisionDirection, replyCommonRevisionDirection, type CommonRevisionDirection } from '../src/client-common-revision-direction'
import { onePreviewChange } from '../src/client-common-revision'
import { decodeInlineInput } from '../src/client-inline-backtest'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

function fixture() {
  const now = Date.now(), input = decodeInlineInput({ pair: 'BTC/USDT', timeframe: '일봉', parameters: { sl: -3, tp: 8, rsiTh: 44, trendFilter: false, startI: 61, endI: sourceTerminalPrices.length - 1 } })!
  const turn: ClientTurn = { id: 'base-turn', question: '원 조건', answer: '기존 답변', fullAnswer: '기존 답변', suggestions: [], phase: 'plan', status: 'done', startedAt: now - 120000, finishedAt: now - 100000, inlineRequest: input, backtestFlow: 'common' }
  const base = { turnId: turn.id, period: 365 as const, amount: 3000 as const, startedAt: now - 90000 }
  const session = { id: 'revision-session', turns: [turn], commonBacktest: base } as ClientSession
  return { session, turn, input, base, direction: createCommonRevisionDirection(session, base, 'owner-a')! }
}

test('완료한 현재 결과와 원 입력을 묶고 최초 질문에서는 제안을 만들지 않는다', () => {
  const { direction, session, input } = fixture(), before = JSON.stringify(session)
  expect(direction).toBeDefined()
  expect(direction.before).toEqual(input)
  expect(Object.isFrozen(direction)).toBe(true)
  expect(Object.isFrozen(direction.base)).toBe(true)
  expect(Object.isFrozen(direction.before.parameters)).toBe(true)
  expect(readCommonRevisionDirection(JSON.parse(JSON.stringify(direction)), session.turns)).toEqual(direction)
  const question = commonRevisionDirectionQuestion(direction)
  expect(question.answer).toMatch(/^이 결과에서 가장 크게 내려간 폭은 [\d,.]+%입니다\. 어느 쪽을/)
  expect(question.title).toBe('어느 조건을 바꿔 보겠습니까?')
  expect(question.options).toHaveLength(4)
  expect(question.options[0].description).toContain('(추천)')
  expect(Object.hasOwn(question, 'proposal')).toBe(false)
  expect(JSON.stringify(question)).not.toContain('[STRATEGY')
  expect(JSON.stringify(session)).toBe(before)
})

test('진행 중·다른 선택·손상·원본 불일치·다른 owner·공개 복사를 거부한다', () => {
  const { direction, session, base, turn } = fixture()
  for (const value of [null, [], { ...direction, extra: true }, { ...direction, dataRevision: 'stale' },
    { ...direction, owner: '' }, { ...direction, base: { ...base, startedAt: Date.now() } },
    { ...direction, before: { ...direction.before, parameters: { ...direction.before.parameters, tp: 9 } } },
    { ...direction, before: { ...direction.before, parameters: { ...direction.before.parameters, apiKey: 'invalid' } } }]) expect(readCommonRevisionDirection(value, session.turns)).toBeUndefined()
  expect(readCommonRevisionDirection(direction, [])).toBeUndefined()
  expect(readCommonRevisionDirection(direction, [{ ...turn, commonResultContext: { owner: 'foreign' } as never }])).toBeUndefined()
  expect(readCommonRevisionDirection(direction, [{ ...turn, status: 'running' }])).toBeUndefined()
  expect(createCommonRevisionDirection(session, { ...base, amount: 5000 }, 'owner-a')).toBeUndefined()
  expect(createCommonRevisionDirection({ ...session, sharedCopy: { owner: 'owner-a' } as never }, base, 'owner-a')).toBeUndefined()
})

test('4방향은 선택 후 정확히 한 조건만 바꾸고 원 기간·금액·다른 값을 보존한다', () => {
  const { direction } = fixture(), initial = JSON.stringify(direction)
  const expected = ['tp', 'rsiTh', 'sl', 'trendFilter']
  for (const [i, option] of commonRevisionDirectionQuestion(direction).options.entries()) {
    const reply = replyCommonRevisionDirection(direction, option.value)!
    expect(reply).not.toBeNull()
    expect(reply.change).toBe(expected[i])
    expect(onePreviewChange(direction.before, reply.proposal)).toBe(true)
    expect(reply.description).toContain('Mock 예시')
    expect(reply.description).toContain('비교해 볼 값')
    expect(reply.description).toContain('더 좋은 결과를 뜻하지 않습니다')
    expect(reply.proposal.pair).toBe(direction.before.pair)
    expect(reply.proposal.parameters.startI).toBe(direction.before.parameters.startI)
    expect(reply.proposal.parameters.endI).toBe(direction.before.parameters.endI)
  }
  expect(replyCommonRevisionDirection(direction, '파는 조건 넓히기')!.proposal.parameters.tp).toBe(11)
  expect(replyCommonRevisionDirection(direction, 'Mock 예시로 비교하기')!.proposal.parameters.tp).toBe(11)
  expect(JSON.stringify(direction)).toBe(initial)
})

test('없는 오름 조건과 켜져 있는 방향 조건도 한 조건 변경으로 제안한다', () => {
  const { direction } = fixture()
  const altered: CommonRevisionDirection = { ...direction, before: decodeInlineInput({ ...direction.before, parameters: { ...direction.before.parameters, tp: null, trendFilter: true } })! }
  const question = commonRevisionDirectionQuestion(altered)
  expect(question.options.map(option => option.label)).toContain('오르면 파는 조건 추가')
  expect(question.options.map(option => option.label)).toContain('방향 확인 끄기')
  expect(replyCommonRevisionDirection(altered, '파는 조건 넓히기')!.change).toBe('sl')
  expect(replyCommonRevisionDirection(altered, '오르면 파는 조건 추가')!.proposal.parameters.tp).toBe(8)
  expect(replyCommonRevisionDirection(altered, '방향 확인 끄기')!.proposal.parameters.trendFilter).toBe(false)
  expect(replyCommonRevisionDirection(altered, '방향 확인 켜기')).toBeNull()
})

test('명시 숫자·방향만 지원하며 복수 조건·모호함·secret·overflow·무변경은 거부한다', () => {
  const { direction } = fixture()
  for (const [question, key, value] of [['손절 5%로 바꿔', 'sl', -5], ['익절 12%로', 'tp', 12], ['RSI 30으로', 'rsiTh', 30], ['추세 켜기', 'trendFilter', true]] as const) {
    const reply = replyCommonRevisionDirection(direction, question)!
    expect(reply.proposal.parameters[key]).toBe(value)
    expect(onePreviewChange(direction.before, reply.proposal)).toBe(true)
    expect(reply.description).toContain('적어 주신')
  }
  for (const question of ['손절 3%', '익절 8%', '추세 끄기', '손절 좀 넓혀', '알아서 판단해', '손절 5달러', '손절 5', '손절 5% 익절 10%',
    'RSI -1', 'RSI 101', '익절 -5%', '익절 101%', '손절 100%', '손절 0%', '손절 1e999%', '익절 999999999999999999999999999999%',
    '손절 5% 하지마', '익절 10% 말고', '손절 5% 어때?', '손절 5% BTC', 'secret 손절 5%', '[STRATEGY {}]', 'x'.repeat(501)]) expect(replyCommonRevisionDirection(direction, question)).toBeNull()
  expect(replyCommonRevisionDirection({ ...direction, dataRevision: 'old' }, '손절 5%')).toBeNull()
  expect(replyCommonRevisionDirection({ ...direction, base: { ...direction.base, startedAt: Date.now() } }, '손절 5%')).toBeNull()
})

test('비교 예시의 경계값은 넓히기를 좁히기로 바꾸거나 없는 변경을 만들어내지 않는다', () => {
  const { direction } = fixture()
  const edge = (parameters: Partial<CommonRevisionDirection['before']['parameters']>) => ({ ...direction,
    before: decodeInlineInput({ ...direction.before, parameters: { ...direction.before.parameters, ...parameters } })! })
  expect(replyCommonRevisionDirection(edge({ tp: 100 }), '파는 조건 넓히기')).toBeNull()
  expect(replyCommonRevisionDirection(edge({ sl: -99 }), '내리면 파는 조건 넓히기')).toBeNull()
  expect(replyCommonRevisionDirection(edge({ tp: null, sl: -99.99 }), '파는 조건 넓히기')).toBeNull()
  expect(replyCommonRevisionDirection(edge({ rsiTh: 0 }), '사는 조건 까다롭게')).toBeNull()
  expect(replyCommonRevisionDirection(edge({ sl: -98 }), '내리면 파는 조건 넓히기')!.proposal.parameters.sl).toBe(-99)
})

async function mount(page: Page, mode: 'false' | 'throw' | 'pending' | 'ok' = 'false') {
  await page.route('**/common-direction-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#000;color:#eee;margin:0;font-family:sans-serif"><main class="client-source-app" style="padding:12px;max-width:600px"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/common-direction-test.html')
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.evaluate(async ({ direction, mode }) => {
    localStorage.setItem('tethLang', 'ko')
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCommonRevisionDirection.tsx', dp = '/@id/react-dom/client', css = '/src/client-main-experience.css'
    const transformed = await (await fetch(cp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    await import(/* @vite-ignore */ css)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    let active = true, current = direction, answerMode = mode, resolve: (value: boolean) => void = () => {}
    const calls: string[] = []
    const onAnswer = (text: string) => { calls.push(text); if (answerMode === 'throw') throw new Error('private failure'); if (answerMode === 'pending') return new Promise<boolean>(r => { resolve = r }); return answerMode === 'ok' }
    const render = () => root.render(react.createElement(react.StrictMode, null, react.createElement(component.ClientCommonRevisionDirection, { direction: current, active, onAnswer })))
    Reflect.set(window, 'directionFixture', { calls, render, resolve: () => resolve(true), switchOwner: () => { current = { ...direction, owner: 'owner-b' }; render() }, disabled: () => { active = false; render() }, ok: () => { answerMode = 'ok'; render() } })
    render()
  }, { direction: fixture().direction, mode })
  await expect(page.getByTestId('common-revision-direction')).toBeVisible()
  return errors
}

for (const mode of ['false', 'throw'] as const) test(`직접입력 ${mode} callback은 초안·포커스와 재시도를 보존한다`, async ({ page }) => {
  const errors = await mount(page, mode)
  await expect(page.locator('.gcl-options>.op:not(.direct-trigger)')).toHaveCount(4)
  await page.getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  const input = page.getByRole('textbox', { name: '직접 답변 작성', exact: true })
  await expect(input).toBeFocused()
  await input.fill('손절 5%')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(input).toHaveValue('손절 5%')
  await expect(input).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'directionFixture').ok())
  await input.press('Enter')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(input).toHaveValue('')
  expect(errors).toEqual([])
})

test('전송 중 중복 선택과 이전 owner 응답을 차단하고 새 owner 입력은 격리한다', async ({ page }) => {
  const errors = await mount(page, 'pending')
  const option = page.getByRole('button', { name: '파는 조건 넓히기', exact: true })
  await option.click()
  await expect(option).toBeDisabled()
  await page.evaluate(() => { const f = Reflect.get(window, 'directionFixture'); f.switchOwner(); f.resolve() })
  await expect(option).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'directionFixture').calls)).toEqual(['파는 조건 넓히기'])
  await page.evaluate(() => Reflect.get(window, 'directionFixture').disabled())
  await expect(option).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Mock 예시로 비교하기', exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})
