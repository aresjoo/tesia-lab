import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'

const recommendedParameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
async function setup(page: Page, signedIn = true, assetIndex = 0, budgetIndex = 1, verified = true) {
  await page.addInitScript(({ signed, assetIndex, budgetIndex, verified, parameters }) => {
    localStorage.setItem('tethCurrency', 'KRW')
    const id = 'user-strategy-flow'
    if (signed && !sessionStorage.getItem('teth-client-profile-preview')) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '전략 검수', email: 'strategy@example.test' }))
    if (sessionStorage.getItem('teth-client-experience')) return
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '내 위임 전략', idea: '비트코인 반등', draft: '이 질문은 그대로 남아야 해요', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'delegation', researchStatus: '초안', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth:client-delegation:${id}`, JSON.stringify({ page: 'connect', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: key === 'asset' ? assetIndex : key === 'budget' ? budgetIndex : key === 'period' && verified ? 2 : 1 }])), attempt: 1, workStep: 5, chartInterval: '1D', ...(verified ? { parameters } : {}) }))
  }, { signed: signedIn, assetIndex, budgetIndex, verified, parameters: recommendedParameters })
}
async function connected(page: Page, exchangeName = 'Binance') {
  await page.goto('/')
  await page.getByRole('button', { name: '무료로 시작', exact: true }).click()
  await page.getByRole('button', { name: exchangeName === 'Binance' ? '추천 Binance' : exchangeName, exact: true }).click()
  await page.getByRole('button', { name: '가입 완료했어요', exact: true }).click()
  await page.getByLabel(`${exchangeName} UID`, { exact: true }).fill('123456')
  await page.getByRole('button', { name: '연동 확인하기', exact: true }).click()
  await page.getByLabel('API Key', { exact: true }).fill('UI_ONLY_FIXTURE_KEY')
  await page.getByLabel('Secret Key', { exact: true }).fill('UI_ONLY_FIXTURE_SECRET')
  await page.getByRole('button', { name: '권한 확인하고 연결하기', exact: true }).click()
  await expect(page.getByRole('button', { name: '전략 시작', exact: true })).toBeVisible()
}
async function route(page: Page, hash: string) { await page.evaluate(hash => { history.pushState(null, '', hash); dispatchEvent(new Event('teth:navigate')) }, hash) }

test('위임 나중에 시작은 ready snapshot으로 등록되어 상세·새로고침·시작/중지/재개로 이어진다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await setup(page); await connected(page)
  await page.getByRole('button', { name: '나중에 시작', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/\d+$/)
  const hash = new URL(page.url()).hash
  await expect(page.getByRole('heading', { name: '비트코인 위임 전략', exact: true })).toBeVisible()
  await expect(page.locator('.nfxb-st')).toHaveText('시작 대기')
  await expect(page.locator('.nfxb-bigval').first()).toHaveText(`+${evaluateDelegation(recommendedParameters, 5000000).result.ret.toFixed(1)}%`)
  await expect(page.locator('.nfxb-chart')).toHaveCount(1)
  await expect(page.getByText('아직 체결이 없어요', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.g-composer textarea')).toHaveValue('이 질문은 그대로 남아야 해요')
  await expect(page.locator('.client-delegation .tf-strat,.client-delegation .tf-fill')).toHaveCount(0)
  await page.goForward()
  await page.reload(); await expect(page.locator('.nfxb-st')).toHaveText('시작 대기')
  await page.getByRole('button', { name: '지금 시작하기', exact: true }).first().click()
  await expect(page.locator('.nfxb-st')).toHaveText('라이브 (시뮬레이션)')
  await page.getByRole('button', { name: '실행 일시정지', exact: true }).click()
  await expect(page.locator('.nfxb-st')).toHaveText('중지됨')
  await page.getByRole('button', { name: '재개', exact: true }).click()
  await expect(page.locator('.nfxb-st')).toHaveText('라이브 (시뮬레이션)')
  await route(page, '#/trade'); await route(page, hash)
  await expect(page.locator('.nfxb-st')).toHaveText('라이브 (시뮬레이션)')
  const saved = await page.evaluate(() => ({ records: sessionStorage.getItem('teth-client-user-strategies:strategy%40example.test'), all: JSON.stringify(sessionStorage), chat: JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0] }))
  expect(JSON.parse(saved.records!)).toHaveLength(1)
  expect(JSON.parse(saved.records!)[0].record).toMatchObject({ environment: 'live', asset: '비트코인', exchangeId: 'binance', capital: 5000000, chartSymbol: 'BINANCE:BTCUSDT', version: 'v1.0', parameters: recommendedParameters, score: 80 })
  expect(saved.all).not.toContain('UI_ONLY_FIXTURE')
  expect(saved.chat.draft).toBe('이 질문은 그대로 남아야 해요')
  expect(errors).toEqual([])
})

async function savedRecord(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('teth-client-user-strategies:'))
    return key ? JSON.parse(sessionStorage.getItem(key)!)[0]?.record : null
  })
}

for (const item of [
  { asset: '비트코인', index: 0, symbol: 'BINANCE:BTCUSDT', exchange: 'Binance', exchangeId: 'binance' },
  { asset: '이더리움', index: 1, symbol: 'BINANCE:ETHUSDT', exchange: 'OKX', exchangeId: 'okx' },
  { asset: '테슬라', index: 2, symbol: 'NASDAQ:TSLA', exchange: 'WOO X', exchangeId: 'woox' },
  { asset: '나스닥', index: 3, symbol: null, exchange: 'Binance', exchangeId: 'binance' },
]) test(`${item.asset} 가상 시작은 정확한 등록 스냅샷과 차트 심볼 근거를 보존한다`, async ({ page }, testInfo) => {
  await setup(page, true, item.index, 2); await connected(page, item.exchange)
  await page.setViewportSize({ width: 320, height: 740 })
  const buttons = page.locator('.tf-donec > button')
  await expect(buttons).toHaveText(['전략 시작', '가상으로 먼저 시작', '나중에 시작'])
  for (const button of await buttons.all()) {
    const box = await button.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    if (testInfo.project.name === 'mobile') expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath(`done-${item.index}-320.png`) })
  await page.getByRole('button', { name: '가상으로 먼저 시작', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/trade\/bot\/\d+$/)
  await expect(page.locator('.nfxb-st')).toHaveText('가상 실행')
  const record = await savedRecord(page)
  expect(record).toMatchObject({ name: `${item.asset} 위임 전략`, asset: item.asset, exchangeId: item.exchangeId, exchangeName: item.exchange, capital: 10000000, chartSymbol: item.symbol, version: 'v1.0', environment: 'paper', status: 'live', parameters: recommendedParameters, score: 80 })
  const hash = new URL(page.url()).hash
  await route(page, '#/trade')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${record.id}`)
  await page.locator('.ctt-selector-button').click()
  await expect(page.locator('.ctt-selector-button')).toHaveAttribute('aria-expanded', 'true')
  const rail = page.locator(`[data-strategy-id="user:${record.id}"]`)
  await expect(rail).toContainText(`${item.asset}/KRW`)
  await expect(rail).toContainText('위임 실행 · 가상')
  await expect(rail).toContainText('$7,194.24')
  await expect(rail).toContainText(`${evaluateDelegation(recommendedParameters, 10000000).result.ret.toFixed(1)}%`)
  await route(page, hash)
  await page.reload()
  await expect(page.locator('.nfxb-st')).toHaveText('가상 실행')
  expect(await savedRecord(page)).toEqual(record)
  await expect(page.getByRole('heading', { name: `${item.asset} 위임 전략`, exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(`paper-${item.index}-320.png`) })
})

test('게스트가 선택한 가상 환경은 로그인과 새로고침 후에도 live로 바뀌지 않는다', async ({ page }) => {
  await setup(page, false, 1, 0); await connected(page, 'OKX')
  await page.getByRole('button', { name: '가상으로 먼저 시작', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  expect(await savedRecord(page)).toBeNull()
  await page.locator('.au-btns button').first().click()
  await expect(page).toHaveURL(/#\/trade\/bot\/\d+$/)
  await expect(page.locator('.nfxb-st')).toHaveText('가상 실행')
  const record = await savedRecord(page)
  expect(record).toMatchObject({ asset: '이더리움', exchangeId: 'okx', capital: 1000000, chartSymbol: 'BINANCE:ETHUSDT', environment: 'paper', status: 'live', parameters: recommendedParameters, score: 80 })
  await page.reload()
  await expect(page.locator('.nfxb-st')).toHaveText('가상 실행')
  expect(await savedRecord(page)).toEqual(record)
})

test('과거 attempt는 통과를 만들지 않고 52점에서 추천 pending을 복원해 실제 80점으로 검증한다', async ({ page }) => {
  await setup(page, true, 0, 1, false)
  await page.goto('/')
  await expect(page.locator('.tf-scorebox .n')).toHaveAttribute('aria-label', '52점')
  await expect(page.getByRole('button', { name: '무료로 시작', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toHaveCount(0)
  await expect(page.locator('.tf-diff .dr')).toHaveCount(2)
  await page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth:client-delegation:user-strategy-flow')!).pendingParameters)).toEqual(recommendedParameters)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth:client-delegation:user-strategy-flow')!).parameters)).toMatchObject({ trendFilter: false, startI: 604 })
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.tf-scorebox .n')).toHaveAttribute('aria-label', '80점')
  const snapshot = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth:client-delegation:user-strategy-flow')!))
  expect(snapshot.parameters).toEqual(recommendedParameters)
  expect(snapshot.pendingParameters).toBeUndefined()
  await page.getByRole('button', { name: '리포트 보기', exact: true }).click()
  await expect(page.locator('.tf-kpi .k').first()).toContainText('42개월 시뮬레이션 손익 (과거 시장)')
  await page.reload()
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await expect(page.locator('.tfw-hd .bdg')).toContainText('TETH 80')
})

test('추천 검증 중 조건을 초기화하면 이전 pending과 타이머가 새 선택에 적용되지 않는다', async ({ page }) => {
  await setup(page, true, 0, 1, false)
  await page.goto('/')
  await page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth:client-delegation:user-strategy-flow')!).pendingParameters)).toEqual(recommendedParameters)
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  await page.getByRole('button', { name: '다시 답하기', exact: true }).click()
  await page.getByRole('button', { name: '이더리움', exact: true }).click()
  await page.waitForTimeout(3000)
  await expect(page.getByRole('heading', { name: '어떤 성향이 편하세요?', exact: true })).toBeVisible()
  await expect(page.locator('.tf-scorebox,.tf-report-page')).toHaveCount(0)
  const snapshot = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth:client-delegation:user-strategy-flow')!))
  expect(snapshot.parameters).toBeUndefined()
  expect(snapshot.pendingParameters).toBeUndefined()
  expect(snapshot.answers.asset.index).toBe(1)
  await page.reload()
  await expect(page.getByRole('heading', { name: '어떤 성향이 편하세요?', exact: true })).toBeVisible()
})

test('게스트 등록은 로그인 뒤 동일 결과로 이어지고 OAuth 미리보기의 빈 이메일도 저장된다', async ({ page }) => {
  await setup(page, false); await connected(page)
  await page.getByRole('button', { name: '전략 시작', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.locator('.au-btns button').first().click()
  await expect(page).toHaveURL(/#\/trade\/bot\/\d+$/)
  await expect(page.locator('.nfxb-st')).toHaveText('라이브 (시뮬레이션)')
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
  await page.reload(); await expect(page.locator('.nfxb-st')).toHaveText('라이브 (시뮬레이션)')
  await route(page, '#/plan/alerts')
  const toggle = page.getByRole('switch', { name: '포지션 진입/청산', exact: true })
  await toggle.focus(); await page.keyboard.press('Space'); await expect(toggle).not.toBeChecked()
  await page.reload(); await expect(toggle).not.toBeChecked()
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].turns.length)).toBe(0)
})

test('기존PLAN주소는최신결제설정으로이어지고자동구독없이원대화초안을보존한다', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => {
    const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    state.sessions[0].workspace = 'conversation'
    sessionStorage.setItem('teth-client-experience', JSON.stringify(state))
  })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue('이 질문은 그대로 남아야 해요')
  await page.locator('.g-composer textarea').evaluate(el => el.setSelectionRange(2, 8))
  const input = await page.locator('.g-composer textarea').elementHandle()
  const subscription = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => /subscription|billing|user-strategies/.test(key))))
  await page.evaluate(() => { location.hash = '#/plan' })
  await expect(page).toHaveURL(/#\/settings\/billing$/)
  await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
  expect(await input!.evaluate(el => el.isConnected)).toBe(true)
  await expect(page.locator('.client-main-account')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '구독으로 업그레이드', exact: true })).toHaveCount(0)
  await expect(page.locator('.client-settings-page')).toContainText('아직 정보를 받아오지 못했습니다')
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    await page.locator('.client-settings-page .stg-mback').click()
    await expect(page).toHaveURL(/#\/settings$/)
    await expect(page.locator('.client-settings-page .stg-navigation')).toBeVisible()
  }
  await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue('이 질문은 그대로 남아야 해요')
  expect(await page.locator('.g-composer textarea').evaluate((node, original) => node === original, input)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toBeFocused()
  expect(await page.locator('.g-composer textarea').evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([2, 8])
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => /subscription|billing|user-strategies/.test(key))))).toEqual(subscription)
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
})

test('다른 계정·없는 전략은 기본 예시로 대체하지 않고 복귀 동작을 제공한다', async ({ page }) => {
  await setup(page); await page.goto('/#/trade/bot/1000')
  await expect(page.getByText('전략을 찾을 수 없어요', { exact: true })).toBeVisible()
  await expect(page.locator('.nfxb-bigval')).toHaveCount(0)
  await page.locator('.client-user-strategy').getByRole('button', { name: 'AI 트레이딩', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade$/)
})

test('다른 계정의 과거 tradingReady 표시가 새 위임을 막거나 고정 체결을 보여주지 않는다', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => {
    const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    state.sessions[0].tradingReady = true
    state.sessions[0].workspace = 'delegation'
    sessionStorage.setItem('teth-client-experience', JSON.stringify(state))
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: 'other@example.test' }))
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '무료로 시작', exact: true })).toBeVisible()
  await expect(page.locator('.client-delegation .tf-strat,.client-delegation .tf-fill')).toHaveCount(0)
})

test('여러 저장 오류와 안내는 겹치지 않고 깨진 원본 기록을 유지한다', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => {
    sessionStorage.setItem('teth-client-user-strategies:strategy%40example.test', '{')
    const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    state.sessions.push({ id: 'invalid-session-fixture' })
    sessionStorage.setItem('teth-client-experience', JSON.stringify(state))
  })
  await page.setViewportSize({ width: 320, height: 680 })
  await page.goto('/')
  const notices = page.locator('.client-notice-stack .client-global-notice')
  await expect(notices).toHaveCount(2)
  const first = await notices.nth(0).boundingBox(), second = await notices.nth(1).boundingBox()
  expect(first!.y + first!.height).toBeLessThanOrEqual(second!.y)
  expect(second!.x + second!.width).toBeLessThanOrEqual(320)
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-user-strategies:strategy%40example.test'))).toBe('{')
  const retained = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  expect(retained.sessions).toHaveLength(1)
  expect(retained.sessions[0]).toMatchObject({ id: 'user-strategy-flow', draft: '이 질문은 그대로 남아야 해요' })
})
