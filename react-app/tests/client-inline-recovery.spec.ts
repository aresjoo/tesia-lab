import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import type { InlineBacktestRecord } from '../src/client-inline-backtest'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { sourceTerminalPrices, type NormalizedSourceTerminalParameters } from '../src/client-terminal-source-fixture'

// Local 621cbed source-preview recovery only. These fixtures are not native
// validation, exchange evidence, credentials or execution authority.
const experienceKey = 'teth-client-experience'
const owner = 'inline-recovery@example.test'
const strategyKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const parameters: NormalizedSourceTerminalParameters = {
  sl: -5,
  tp: 12,
  rsiTh: 44,
  trendFilter: true,
  startI: 61,
  endI: sourceTerminalPrices.length - 1,
}

function inlineTurn(id: string, startedAt: number, finishedAt = startedAt + 2_000): ClientTurn {
  return {
    id,
    question: 'ETH 추세 1시간봉 손절 5%, 익절 12%',
    answer: '조건을 정리했습니다. 화면 이동 없이 여기서 바로 과거 데이터로 검증할게요.',
    fullAnswer: '조건을 정리했습니다. 화면 이동 없이 여기서 바로 과거 데이터로 검증할게요.',
    startedAt,
    finishedAt,
    status: 'done',
    suggestions: [],
    phase: 'plan',
    inlineRequest: { pair: 'ETH/USDT', timeframe: '1시간봉', parameters },
  }
}

function inlineRecord(turn: ClientTurn, ordinal: number): InlineBacktestRecord {
  return {
    pair: 'ETH/USDT',
    timeframe: '1시간봉',
    parameters,
    turnId: turn.id,
    ordinal,
    completedAt: turn.finishedAt! + 1_100,
  }
}

function session(id: string, turns: ClientTurn[], records: InlineBacktestRecord[] = [], workspace: ClientSession['workspace'] = 'conversation'): ClientSession {
  return {
    id,
    title: '인라인 복구 대화',
    renamed: false,
    idea: 'ETH 추세 1시간봉 손절 5%, 익절 12%',
    draft: '',
    pair: 'ETH/USDT',
    mode: 'trend',
    timeframe: '1시간봉',
    risk: '−5%',
    takeProfit: '+12%',
    researchStatus: '초안',
    phase: 'plan',
    turns,
    updatedAt: 1_700_000_100_000,
    workspace,
    tradingReady: false,
    inlineResults: records,
  }
}

async function open(page: Page, sessions: unknown[], currentId: string, options: { signedIn?: boolean; delegation?: unknown; storedStrategies?: unknown } = {}) {
  await page.route('**/api/**', route => route.abort('failed'))
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.addInitScript(({ experienceKey, owner, strategyKey, sessions, currentId, signedIn, delegation, storedStrategies }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId, homeDraft: '', sessions }))
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '인라인 복구', email: owner }))
    if (delegation !== undefined) sessionStorage.setItem(`teth:client-delegation:${currentId}`, JSON.stringify(delegation))
    if (storedStrategies !== undefined) sessionStorage.setItem(strategyKey, JSON.stringify(storedStrategies))
  }, { experienceKey, owner, strategyKey, sessions, currentId, signedIn: options.signedIn !== false, delegation: options.delegation, storedStrategies: options.storedStrategies })
  await page.goto('/')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
}

async function savedSessions(page: Page): Promise<ClientSession[]> {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions, experienceKey)
}

function connectionSnapshot(turnId: string, assetIndex = 1, nextParameters = parameters) {
  return {
    page: 'connect',
    answers: {
      asset: { index: assetIndex },
      style: { index: 1 },
      budget: { index: 1 },
      period: { index: 2 },
      stop: { index: 1 },
    },
    questionIndex: 5,
    attempt: 1,
    workStep: 5,
    expert: false,
    chartInterval: '1D',
    parameters: nextParameters,
    inlineResult: true,
    inlineTurnId: turnId,
  }
}

test('인라인 선택의 정본 저장 실패는 이전 위임 메모리·디스크를 덮어쓰지 않고 대화 결과를 유지한다', async ({ page }) => {
  const turn = inlineTurn('durable-inline', 1_700_000_000_000)
  const current = session('durable-session', [turn], [inlineRecord(turn, 1)])
  const old = { ...connectionSnapshot('previous-turn'), parameters: { ...parameters, sl: -7 } }
  await open(page, [current], current.id, { delegation: old })
  await page.getByRole('button', { name: '이 전략 실행하기', exact: true }).focus()
  await page.clock.fastForward(350) // Finish viewport persistence before targeting the explicit handoff write.
  const before = await page.evaluate(async id => {
    const path = '/src/client-delegation-fixtures.ts'
    const m = await import(/* @vite-ignore */ path)
    const key = `teth:client-delegation:${id}`
    const before = { raw: sessionStorage.getItem(key), read: m.readDelegationUi(id) }
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, value: string) {
      // Selection now commits in the conversation's single authoritative key.
      // The old delegation value remains an untouched presentation cache.
      if (name === 'teth-client-experience') throw new DOMException('Synthetic storage limit', 'QuotaExceededError')
      return set.call(this, name, value)
    }
    return before
  }, current.id)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: '검증 결과를 연결하지 못했어요. 기록은 대화에 남아 있으니 다시 시도해주세요.' })).toBeVisible()
  expect(await page.evaluate(async id => {
    const path = '/src/client-delegation-fixtures.ts'
    const m = await import(/* @vite-ignore */ path)
    return { raw: sessionStorage.getItem(`teth:client-delegation:${id}`), read: m.readDelegationUi(id) }
  }, current.id)).toEqual(before)
  await expect(page.locator('.gbt[data-rpt="1"]')).toBeVisible()
  await expect(page.locator('.client-next-actions')).toHaveCount(0)
})

test('인라인 임의 손절 라벨·6차 이상 차수·불변 입력을 보존한다', async ({ page }) => {
  const turn = inlineTurn('custom-inline', 1_700_000_000_000)
  const current = session('custom-session', [turn], [inlineRecord(turn, 1)])
  const ui = { ...connectionSnapshot(turn.id, 1, { ...parameters, sl: -7 }), attempt: 7 }
  await open(page, [current], current.id, { delegation: ui })
  const actual = await page.evaluate(async ({ id, request }) => {
    const fixtures = '/src/client-delegation-fixtures.ts', inline = '/src/client-inline-backtest.ts'
    const m = await import(/* @vite-ignore */ fixtures), n = await import(/* @vite-ignore */ inline)
    const input = n.decodeInlineInput(request)
    return { snapshot: m.readDelegationUi(id), frozen: Object.isFrozen(input) && Object.isFrozen(input.parameters) }
  }, { id: current.id, request: turn.inlineRequest })
  expect(actual.snapshot).toMatchObject({ attempt: 7, parameters: { sl: -7 }, answers: { stop: { label: '-7%까지' } } })
  expect(actual.frozen).toBe(true)
})

test('완료 시각이 누락되거나 손상된 done 입력은 중단 복구되어 전송을 잠그거나 결과를 재생성하지 않는다', async ({ page }) => {
  const missing = inlineTurn('missing-finished-at', 1_700_000_000_000) as ClientTurn & { finishedAt?: unknown }
  delete missing.finishedAt
  const corrupt = { ...inlineTurn('corrupt-finished-at', 1_700_000_010_000), finishedAt: 'broken' }
  const first = session('missing-session', [missing as ClientTurn])
  const second = session('corrupt-session', [corrupt as unknown as ClientTurn])
  await open(page, [first, second], first.id)

  const warning = page.locator('.client-global-notice').filter({ hasText: '일부 대화 기록을 복원하지 못했습니다.' })
  await expect(warning).toBeVisible()
  const composer = page.locator('.g-composer textarea')
  await expect(composer).toBeEnabled()
  await warning.getByRole('button').click()
  const recovered = await savedSessions(page)
  expect(recovered.map(item => item.turns[0].inlineStopped)).toEqual([true, true])

  await composer.fill('이 기록 뒤에도 질문을 보낼 수 있어요')
  await composer.press('Enter')
  await page.clock.fastForward(60_000)
  await expect(page.locator('.client-inline-backtest .gbt[data-bt]')).toHaveCount(0)
  const after = (await savedSessions(page)).find(item => item.id === first.id)!
  expect(after.turns).toHaveLength(2)
  expect(after.turns[0].inlineStopped).toBe(true)
  expect(after.inlineResults).toEqual([])
})

test('완료 시각과 정확히 결속되지 않은 결과만 격리하고 정상 결과는 보존한다', async ({ page }) => {
  const firstTurn = inlineTurn('valid-turn', 1_700_000_000_000)
  const secondTurn = inlineTurn('detached-time-turn', 1_700_000_010_000)
  const valid = inlineRecord(firstTurn, 1)
  const detached = { ...inlineRecord(secondTurn, 2), completedAt: secondTurn.finishedAt! + 1_099 }
  const current = session('result-time-recovery', [firstTurn, secondTurn], [valid, detached])
  await open(page, [current], current.id)

  const warning = page.locator('.client-global-notice').filter({ hasText: '일부 대화 기록을 복원하지 못했습니다.' })
  await expect(warning).toBeVisible()
  await expect(page.locator('.client-inline-backtest .gbt[data-bt="1"]')).toBeVisible()
  await expect(page.locator('.client-inline-backtest .gbt[data-bt="2"]')).toHaveCount(0)
  await warning.getByRole('button').click()
  await page.clock.fastForward(60_000)

  const recovered = (await savedSessions(page))[0]
  expect(recovered.inlineResults).toEqual([valid])
  expect(recovered.turns[0].inlineStopped).toBeUndefined()
  expect(recovered.turns[1].inlineStopped).toBe(true)
  await expect(page.locator('.client-inline-backtest .gbt[data-bt]')).toHaveCount(1)
})

for (const mismatch of [
  { name: '자산', assetIndex: 0, nextParameters: parameters },
  { name: '파라미터', assetIndex: 1, nextParameters: { ...parameters, sl: -3 } },
]) test(`inlineTurnId가 같아도 ${mismatch.name}가 원 결과와 다르면 연결 화면에 진입하지 않는다`, async ({ page }) => {
  const turn = inlineTurn(`connection-${mismatch.name}`, 1_700_000_000_000)
  const record = inlineRecord(turn, 1)
  const current = session(`connection-mismatch-${mismatch.name}`, [turn], [record], 'delegation')
  await open(page, [current], current.id, {
    delegation: connectionSnapshot(turn.id, mismatch.assetIndex, mismatch.nextParameters),
  })

  await expect(page.getByRole('alert').filter({ hasText: '검증 결과와 연결 조건을 다시 확인해주세요' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.client-inline-backtest .gbt[data-bt="1"]')).toBeVisible()
  await page.locator('.client-inline-backtest .gbt[data-bt="1"] > details > summary').click()
  await expect(page.locator('.client-inline-backtest .gbt[data-bt="1"]')).toContainText('ETH/USDT · 요청 간격 1시간봉')
  await expect(page.locator('.client-inline-backtest .gbt[data-bt="1"]')).toContainText('손절 -5%, 익절 +12%')
  await page.clock.fastForward(300)
  expect((await savedSessions(page))[0]).toMatchObject({ workspace: 'conversation', inlineResults: [record] })
})

test('게스트 pending 등록은 로그인 계정의 같은 세션 기존 전략을 덮어쓰지 않고 그 상세로 이동한다', async ({ page }) => {
  const turn = inlineTurn('reauth-existing-turn', 1_700_000_000_000)
  const record = inlineRecord(turn, 1)
  const current = session('reauth-existing-session', [turn], [record], 'delegation')
  const evaluated = evaluateDelegation(parameters, 5_000_000)
  const createdAt = 1_700_000_200_000
  const existing = {
    sessionId: current.id,
    record: {
      id: String(createdAt),
      createdAt,
      name: '보존해야 할 기존 전략',
      status: 'live',
      environment: 'paper',
      parameters,
      score: evaluated.score,
      ret: evaluated.result.ret,
      mdd: evaluated.result.mdd,
      n: evaluated.result.n,
      winRate: evaluated.result.winRate,
      exchangeName: 'OKX',
      asset: '이더리움',
      exchangeId: 'okx',
      capital: 5_000_000,
      chartSymbol: 'BINANCE:ETHUSDT',
      version: 'v0.9',
    },
  }
  await open(page, [current], current.id, {
    signedIn: false,
    delegation: connectionSnapshot(turn.id),
    storedStrategies: [existing],
  })
  const originalBytes = await page.evaluate(key => sessionStorage.getItem(key), strategyKey)

  await page.getByRole('button', { name: '무료로 시작', exact: true }).click()
  await page.getByRole('button', { name: '추천 Binance', exact: true }).click()
  await page.getByRole('button', { name: '가입 완료했어요', exact: true }).click()
  await page.getByLabel('Binance UID', { exact: true }).fill('123456')
  await page.getByRole('button', { name: '연동 확인하기', exact: true }).click()
  await page.clock.fastForward(1_800)
  await page.getByLabel('API Key', { exact: true }).fill('UI_ONLY_RECOVERY_KEY')
  await page.getByLabel('Secret Key', { exact: true }).fill('UI_ONLY_RECOVERY_SECRET')
  await page.getByRole('button', { name: '권한 확인하고 연결하기', exact: true }).click()
  await page.clock.fastForward(1_900)
  await page.getByRole('button', { name: '나중에 시작', exact: true }).click()

  const auth = page.getByRole('dialog')
  await auth.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(owner)
  await auth.getByRole('button', { name: '계속', exact: true }).click()
  await auth.getByRole('button', { name: '비밀번호로 계속하기', exact: true }).click()
  await auth.getByLabel('비밀번호', { exact: true }).fill('preview-password')
  await auth.getByRole('button', { name: '계속', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`#/trade/bot/${createdAt}$`))
  // Resume the intentionally paused fixture clock so React's lazy-route paint
  // can run after the imported detail module arrives. Product timers are not
  // replaced or bypassed, and the registered record must remain byte-identical.
  await page.clock.resume()
  await expect(page.getByRole('heading', { name: '보존해야 할 기존 전략', exact: true })).toBeVisible()
  await expect(page.locator('.nfxb-st')).toHaveText('가상 실행')
  expect(await page.evaluate(key => sessionStorage.getItem(key), strategyKey)).toBe(originalBytes)
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), strategyKey)).toEqual([existing])
})
