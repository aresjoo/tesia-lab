import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'

// Controlled client-source preview fixtures. No service connection, payment,
// approval or exchange API is issued by this browser-only flow.
const owner = 'connection@example.test'
const sessionId = 'connection-session'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const lowParameters = { ...parameters, trendFilter: false, startI: 604 }
const registrationKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const locatorKey = (email: string) => `teth-client-delegation-location:account:${encodeURIComponent(email)}`
const draft = '이 연결과 별개로 보존할 질문'
const answers = Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: key === 'asset' ? 1 : key === 'period' ? 2 : 1 }]))
const result = evaluateDelegation(parameters, 5000000)
const record = { id: '1000', createdAt: 1000, name: '보존할 ETH 전략', parameters,
  score: result.score, ret: result.result.ret, mdd: result.result.mdd, n: result.result.n, winRate: result.result.winRate,
  status: 'off', environment: 'paper', exchangeName: 'OKX', exchangeId: 'okx', asset: '이더리움',
  capital: 5000000, chartSymbol: 'BINANCE:ETHUSDT', version: 'v3.7' }
type Options = { locator?: boolean; registered?: boolean; home?: boolean; completedTurn?: boolean; currentOther?: boolean; activeOwner?: string; snapshot?: Record<string, unknown> }
async function setup(page: Page, options: Options = {}, compatibility = true) {
  // The old sample terminal is now an explicit component consumer, not fresh Main.
  if (compatibility) await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (request.isNavigationRequest() && url.origin === new URL(page.url() === 'about:blank' ? request.url() : page.url()).origin) {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/tests/fixtures/main-terminal-connection-consumer.tsx");</script></body></html>' })
    } else await route.fallback()
  })
  await page.addInitScript(({ options, owner, sessionId, draft, answers, parameters, record, registrationKey }) => {
    if (sessionStorage.getItem('connection-test-initialized')) return
    sessionStorage.setItem('connection-test-initialized', 'true')
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'KRW')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연결 검수', email: options.activeOwner ?? owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: options.home ? null : options.currentOther ? 'other-session' : sessionId, homeDraft: '보존할 홈 입력', sessions: [
      { id: sessionId, title: 'ETH 검증 대화', renamed: true, idea: '이더리움 반등 전략', draft, pair: 'ETH/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-5%', takeProfit: '+12%', researchStatus: '초안', workspace: 'conversation', tradingReady: options.registered === true, turns: options.completedTurn ? [{ id: 'turn-1', question: '이더리움 전략을 검토해주세요', answer: '조건을 정리했어요.', fullAnswer: '조건을 정리했어요.', suggestions: [], phase: 'plan', status: 'done', startedAt: 1, finishedAt: 2 }] : [], updatedAt: 1 },
      ...(options.currentOther ? [{ id: 'other-session', title: '별개 BTC 대화', idea: '비트코인 추세', draft: '다른 대화 초안', pair: 'BTC/USDT', mode: 'trend', phase: 'plan', timeframe: '일봉', risk: '-3%', researchStatus: '초안', workspace: 'conversation', tradingReady: false, turns: [], updatedAt: 2 }] : []),
    ] }))
    sessionStorage.setItem(`teth:client-delegation:${sessionId}`, JSON.stringify({ page: 'report', answers, questionIndex: 5, attempt: 1, workStep: 5, chartInterval: '1D', parameters, ...options.snapshot }))
    if (options.locator !== false) sessionStorage.setItem(`teth-client-delegation-location:account:${encodeURIComponent(owner)}`, JSON.stringify({ sessionId }))
    if (options.registered) sessionStorage.setItem(registrationKey, JSON.stringify([{ sessionId, record }]))
  }, { options, owner, sessionId, draft, answers, parameters, record, registrationKey })
}
async function route(page: Page, hash: string) {
  await page.evaluate(hash => { history.pushState(null, '', hash || location.pathname); dispatchEvent(new Event('teth:navigate')) }, hash)
}
async function panel(page: Page, name: string) {
  if (name === '전략' && await page.locator('.ctt-selector-button').isVisible()) {
    await page.locator('.ctt-selector-button').click(); return
  }
  const tabs = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  if (await tabs.isVisible()) await tabs.getByRole('tab', { name: name === 'Agent' ? '판단' : name, exact: true }).click()
}
async function terminal(page: Page) {
  await route(page, '#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await panel(page, '차트')
}
async function connect(page: Page) {
  await panel(page, '차트')
  const pane = page.locator('.ctt-bottom-pane[data-selected="true"]')
  await pane.getByRole('button', { name: '거래소 연결하기', exact: true }).focus()
  await page.keyboard.press('Enter')
}
async function expectConnect(page: Page) {
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  await expect(page.getByRole('button', { name: '무료로 시작', exact: true })).toBeVisible()
  await expect(page.locator('.client-main-terminal')).toBeHidden()
}
async function previewOnboarding(page: Page) {
  await page.getByRole('button', { name: '무료로 시작', exact: true }).click()
  await page.getByRole('button', { name: '추천 Binance', exact: true }).click()
  await page.getByRole('button', { name: '가입 완료했어요', exact: true }).click()
  await page.getByLabel('Binance UID', { exact: true }).fill('123456')
  await page.getByRole('button', { name: '연동 확인하기', exact: true }).click()
  await page.getByLabel('API Key', { exact: true }).fill('ONLY_UI_SYNTHETIC_KEY')
  await page.getByLabel('Secret Key', { exact: true }).fill('ONLY_UI_SYNTHETIC_SECRET')
  await page.getByRole('button', { name: '권한 확인하고 연결하기', exact: true }).click()
  await expect(page.getByRole('button', { name: '전략 시작', exact: true })).toBeVisible()
}
const accountTabs = ['포지션', '미체결 주문', '주문 내역', '체결 내역', '종료 포지션', '자산']

for (const width of [320, 1440]) test(`[archive 소비자] ${width}px 명시 터미널 소비자의 6계좌 pane은 동일 연결 빈 상태이며 표·건수 없이 차트와 공존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await setup(page, { locator: false }); await page.goto('/#/trade'); await panel(page, '차트')
  await expect(page.locator('.ctt-bottom-pane .client-terminal-connection-empty')).toHaveCount(6)
  await expect(page.locator('.cat-evaluation')).toHaveCount(0)
  const headerGeometry = await page.locator('.cat-context-row').evaluate(element => {
    const status = element.querySelector('.cat-status')!.getBoundingClientRect(), button = element.querySelector('button')!.getBoundingClientRect()
    return { overflow: element.scrollWidth - element.clientWidth, statusRight: status.right, buttonRight: button.right, right: element.getBoundingClientRect().right }
  })
  expect(headerGeometry.overflow).toBeLessThanOrEqual(1)
  expect(headerGeometry.statusRight).toBeLessThanOrEqual(headerGeometry.right + 1)
  expect(headerGeometry.buttonRight).toBeLessThanOrEqual(headerGeometry.right + 1)
  await expect(page.locator('.ctt-bottom-pane table')).toHaveCount(0)
  await expect(page.locator('.ctt-bottom-tabs .ct')).toHaveCount(0)
  const sizes: number[] = []
  // Source mobile keeps six account tabs; rebates belong to the account ledger.
  for (const label of accountTabs) {
    await page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab', { name: label, exact: true }).click()
    const empty = page.locator('.ctt-bottom-pane[data-selected="true"] .client-terminal-connection-empty')
    await expect(empty.locator('b')).toHaveText('거래소를 연결하면 실계좌 데이터가 표시돼요')
    await expect(empty.locator('span')).toHaveText('포지션, 주문, 자산 내역은 API 연결 후 이 자리에 나타납니다.')
    const button = empty.getByRole('button', { name: '거래소 연결하기', exact: true })
    await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport()
    const box = (await button.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
    if (width === 320 || await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) expect(box.height).toBeGreaterThanOrEqual(44)
    sizes.push((await empty.boundingBox())!.height)
  }
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await expect(page.locator('.cst-close-chart canvas').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath(`connection-empty-${width}.png`) })
})

test('명시 archive 터미널 소비자: 거래소 미연결이어도 벨·PLAN 정산·미보관 보고서 경로를 열고 대화를 보존한다', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/#/trade')
  await expect(page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab')).toHaveText(accountTabs)
  const before = await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))
  await page.locator('.cat-heading').getByRole('button', { name: '알림', exact: true }).click()
  const pane = page.locator('.ctt-bottom-pane[data-selected="true"]')
  await expect(pane).toHaveAttribute('data-tab-id', 'alerts')
  await expect(pane.locator('.client-terminal-connection-empty')).toHaveCount(0)
  await pane.getByRole('button', { name: '수신 설정', exact: true }).click()
  await expect(page).toHaveURL(/#\/plan\/alerts$/)
  await page.getByRole('navigation', { name: 'PLAN 화면' }).getByRole('button', { name: '정산', exact: true }).click()
  await expect(page).toHaveURL(/#\/plan\/rebates$/)
  const account = page.locator('.client-main-account')
  await expect(account.getByText('아직 적립된 내역이 없어요', { exact: true })).toBeVisible()
  await expect(account.locator('.client-terminal-connection-empty')).toHaveCount(0)
  await route(page, '#/periodic/W:2000-01-01')
  await expect(account.getByText('보고서를 찾을 수 없습니다', { exact: true })).toBeVisible()
  await account.getByRole('button', { name: 'AI 트레이딩', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade$/)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(before)
})

test('명시 archive 터미널 소비자: 원본 모바일 6탭 정책을 유지하면서 알림 bell로 독립 받은 편지함을 연다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await setup(page); await page.goto('/#/trade'); await panel(page, '차트')
  await expect(page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab')).toHaveCount(6)
  await page.locator('.cat-heading').getByRole('button', { name: '알림', exact: true }).click()
  const pane = page.locator('.ctt-bottom-pane[data-selected="true"]')
  await expect(pane).toHaveAttribute('data-tab-id', 'alerts')
  await expect(pane.getByText('아직 알림이 없습니다', { exact: true })).toBeVisible()
  await expect(pane.locator('.client-terminal-connection-empty')).toHaveCount(0)
})

test('명시 archive 터미널 소비자: 명시적 전략 맡기기만 계정 locator를 만들고 홈·reload 뒤 이를 재사용한다', async ({ page }) => {
  await setup(page, { locator: false, completedTurn: true }); await page.goto('/')
  expect(await page.evaluate(key => sessionStorage.getItem(key), locatorKey(owner))).toBeNull()
  await page.getByRole('button', { name: /^전략 맡기기/ }).click()
  await expect(page.locator('.client-delegation')).toBeVisible()
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), locatorKey(owner))).toEqual({ sessionId })
  await terminal(page); await panel(page, '전략')
  await page.getByRole('button', { name: '새 전략', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toHaveValue('보존할 홈 입력')
  await page.reload(); await terminal(page); await connect(page); await expectConnect(page)
})

test('명시 archive 터미널 소비자: 등록된 대화의 일반 전략 맡기기는 연결 온보딩을 다시 열지 않고 기존 봇 상세로 간다', async ({ page }) => {
  await setup(page, { registered: true, completedTurn: true }); await page.goto('/')
  const before = await page.evaluate(key => sessionStorage.getItem(key), registrationKey)
  await page.getByRole('button', { name: /^전략 맡기기/ }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/1000$/)
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  await expect(page.locator('.nfxb-st')).toHaveText('중지됨')
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(before)
})

test('명시 archive 터미널 소비자: 별개 현재 BTC 대화와 선택 demo를 마지막 ETH 위임 대상으로 오인하지 않는다', async ({ page }) => {
  await setup(page, { currentOther: true }); await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'demo:d1')
  await connect(page); await expectConnect(page)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions.find((s: {id: string}) => s.id === 'other-session').draft)).toBe('다른 대화 초안')
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(page.locator('.tf-report-page')).toContainText('이더리움')
})

test('명시 archive 터미널 소비자: locator 없는 현재 통과 세션·선택 demo는 연결 근거가 아니며 brokers 왕복에 canvas·초안을 보존한다', async ({ page }) => {
  await setup(page, { locator: false }); await page.goto('/#/trade'); await panel(page, '차트')
  const canvas = await page.locator('.cst-close-chart canvas').first().elementHandle()
  await connect(page)
  await expect(page.locator('.bk2-page')).toBeVisible(); await expect(page.locator('.client-delegation')).toHaveCount(0)
  await terminal(page)
  expect(await canvas!.evaluate(element => element === document.querySelector('.cst-close-chart canvas'))).toBe(true)
  await route(page, '')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect(await page.evaluate(key => sessionStorage.getItem(key), locatorKey(owner))).toBeNull()
})

test('명시 archive 터미널 소비자: 현재 대화가 없어도 계정 locator는 홈·새로고침 뒤 같은 검증 대화 connect를 연다', async ({ page }) => {
  await setup(page, { home: true }); await page.goto('/'); await expect(page.locator('#strategy-idea')).toHaveValue('보존할 홈 입력')
  await page.reload(); await terminal(page); await connect(page); await expectConnect(page)
  await expect(page.locator('.client-delegation')).toContainText('전략 실행')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).currentId)).toBe(sessionId)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].draft)).toBe(draft)
})

test('명시 archive 터미널 소비자: 완료된 pending 추천 파라미터를 승계하며 낮은 이전 점수로 연결을 막지 않는다', async ({ page }) => {
  await setup(page, { snapshot: { parameters: lowParameters, pendingParameters: parameters } }); await page.goto('/#/trade'); await connect(page); await expectConnect(page)
  await expect.poll(() => page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!).parameters, sessionId)).toEqual(parameters)
  expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!).pendingParameters, sessionId)).toBeUndefined()
})

for (const fixture of [
  { name: '진행 중', snapshot: { workStep: 4, pendingParameters: parameters } },
  { name: '미달 점수', snapshot: { parameters: lowParameters } },
  { name: '파라미터 미공급', snapshot: { parameters: null } },
  { name: '손상된 pending', snapshot: { pendingParameters: { ...parameters, endI: 9000 } } },
  { name: '미완성 인테이크', snapshot: { answers: { asset: { index: 1 } } } },
]) test(`명시 archive 터미널 소비자: ${fixture.name} locator는 통과를 합성하지 않고 brokers로 이동한다`, async ({ page }) => {
  await setup(page, { snapshot: fixture.snapshot }); await page.goto('/#/trade'); await connect(page)
  await expect(page.locator('.bk2-page')).toBeVisible(); await expect(page.locator('.client-delegation')).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()
})

test('명시 archive 터미널 소비자: 등록 전략 재연결 완료는 기존 ID·환경·거래소·상태·버전을 변경하지 않는다', async ({ page }) => {
  const mutations: string[] = []; page.on('request', req => { if (!['GET', 'HEAD'].includes(req.method())) mutations.push(req.url()) })
  await setup(page, { registered: true }); await page.goto('/#/trade'); await connect(page); await expectConnect(page)
  const before = await page.evaluate(key => sessionStorage.getItem(key), registrationKey)
  await previewOnboarding(page)
  await page.getByRole('button', { name: '전략 시작', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/1000$/); await expect(page.locator('.nfxb-st')).toHaveText('중지됨')
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(before)
  await terminal(page); await expect(page.locator('.ctt-bottom-pane .client-terminal-connection-empty')).toHaveCount(6)
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain('ONLY_UI_SYNTHETIC')
  expect(mutations).toEqual([])
})

test('명시 archive 터미널 소비자: 미등록 재진입의 나중에 시작은 preview ready 한 건만 등록하며 실제 계좌 데이터는 계속 잠긴다', async ({ page }) => {
  await setup(page); await page.goto('/#/trade'); await connect(page); await expectConnect(page); await previewOnboarding(page)
  await page.getByRole('button', { name: '나중에 시작', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/\d+$/)
  const entries = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), registrationKey)
  expect(entries).toHaveLength(1); expect(entries[0]).toMatchObject({ sessionId, record: { status: 'ready', parameters, score: 80 } })
  await terminal(page); await expect(page.locator('.ctt-bottom-pane .client-terminal-connection-empty')).toHaveCount(6)
})

test('명시 archive 터미널 소비자: 다른 계정은 이전 계정 locator와 등록 기록을 사용하지 않는다', async ({ page }) => {
  await setup(page, { registered: true }); await page.goto('/#/trade'); await connect(page); await expectConnect(page)
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: 'another@example.test' })))
  await page.reload(); await terminal(page)
  await expect(page.locator('[data-strategy-id="user:1000"]')).toHaveCount(0)
  await connect(page); await expect(page.locator('.bk2-page')).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key), locatorKey('another@example.test'))).toBeNull()
  expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), registrationKey))!)[0].record).toEqual(record)
})

// Fresh Main deliberately has no synthetic sample account; compatibility above
// must not be mistaken for the current public source entry or a connection grant.
for (const remembered of [false, true]) test(`실제 Main 미등록 진입은 locator ${remembered ? '있어도' : '없어도'} 샘플 없이 원본 연결 계획으로 간다`, async ({ page }) => {
  await setup(page, { locator: remembered }, false)
  await page.goto('/#/trade')
  await expect(page.locator('.txh-hero')).toBeVisible()
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  const before = await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))
  const locatorBefore = await page.evaluate(key => sessionStorage.getItem(key), locatorKey(owner))
  await page.locator('.txh-hero').getByRole('button', { name: '시작하기', exact: true }).click()
  await expect(page.getByTestId('connection-plan')).toHaveAttribute('data-step', 'plan')
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(before)
  expect(await page.evaluate(key => sessionStorage.getItem(key), locatorKey(owner))).toBe(locatorBefore)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()
})

test('실제 Main 공급 등록 전략은 계정 locator 연결·재연결에서 기존 기록을 보존한다', async ({ page }) => {
  await setup(page, { registered: true }, false)
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  const before = await page.evaluate(key => sessionStorage.getItem(key), registrationKey)
  await connect(page); await expectConnect(page)
  await previewOnboarding(page)
  await page.getByRole('button', { name: '전략 시작', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/1000$/)
  await expect(page.locator('.nfxb-st')).toHaveText('중지됨')
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(before)
  await terminal(page)
  await expect(page.locator('.ctt-bottom-pane .client-terminal-connection-empty')).toHaveCount(6)
})
