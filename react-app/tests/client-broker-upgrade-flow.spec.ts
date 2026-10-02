import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { openLegacySourceConsumer } from './fixtures/legacy-source-entry'

// Archive consumer/store assembly only: current Main uses ClientConnectionPlan
// and cannot enter this broker-to-legacy-subscription callback route.
test.describe('현재 Main 밖: 보존된 거래소 consumer와 caller 조립', () => {

const owner = 'broker-upgrade@example.test'
const heading = (name = 'Binance') => `${name} 연결에는 플랜이 필요해요`
const sessionId = 'broker-eth-result', parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const evaluation = evaluateDelegation(parameters, 5000000)
const original = { id: 'broker-original-chat', title: '보존할 별개 대화', renamed: true, idea: '비트코인 질문', draft: '별개 대화의 미전송 초안', pair: 'BTC/USDT', mode: 'trend', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '', researchStatus: '초안', workspace: 'conversation', tradingReady: false, turns: [], updatedAt: 1 }
const record = { id: '1900', createdAt: 1900, name: '보존할 등록 전략', parameters, score: evaluation.score, ret: evaluation.result.ret, mdd: evaluation.result.mdd, n: evaluation.result.n, winRate: evaluation.result.winRate, status: 'off', environment: 'paper', asset: '이더리움', exchangeName: 'OKX' }
type Options = { guest?: boolean; validated?: boolean; otherOwner?: boolean; incomplete?: boolean }
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function setup(page: Page, options: Options = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, options, original, sessionId, parameters, record }) => {
    if (sessionStorage.getItem('broker-upgrade-initialized')) return
    sessionStorage.setItem('broker-upgrade-initialized', '1')
    localStorage.setItem('tethLang', 'ko')
    if (!options.guest) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '거래소 검수자', email: options.otherOwner ? 'another-broker@example.test' : owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: original.id, homeDraft: '보존할 홈 초안', sessions: [original,
      ...(options.validated ? [{ ...original, id: sessionId, title: 'ETH 검증', pair: 'ETH/USDT', draft: 'ETH 미전송 초안', tradingReady: true }] : []),
    ], sharedFollows: [] }))
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify([{ sessionId, record }]))
    if (options.validated) {
      sessionStorage.setItem(`teth:client-delegation:${sessionId}`, JSON.stringify({ page: 'report', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: key === 'asset' ? 1 : key === 'period' ? 2 : 1 }])), questionIndex: 5, workStep: options.incomplete ? 3 : 5, attempt: 1, chartInterval: '1D', parameters }))
      sessionStorage.setItem(`teth-client-delegation-location:account:${encodeURIComponent(owner)}`, JSON.stringify({ sessionId }))
    }
  }, { owner, options, original, sessionId, parameters, record })
}

async function openDetail(page: Page, name = 'Binance') {
  await openLegacySourceConsumer(page)
  await page.getByRole('button', { name: `${name} 자세히`, exact: true }).click()
  await expect(page.locator('.bk2-head h2')).toHaveText(name)
  await expect(page.getByText('전략 기록을 이 브라우저에 저장하거나 불러오지 못했어요.', { exact: true })).toHaveCount(0)
}

async function gate(page: Page, name = 'Binance') {
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: heading(name), exact: true })
  await expect(sheet).toBeVisible()
  return sheet
}

async function stored(page: Page) {
  return page.evaluate(() => ({
    experience: JSON.parse(sessionStorage.getItem('teth-client-experience')!),
    authority: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-user-strategies:') || key.startsWith('teth-client-account'))),
  }))
}

test('현재 Main 밖의 호환 거래소 consumer는 거래소별 플랜 시트를 표시한다', async ({ page }) => {
  await setup(page)
  await openDetail(page)
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  await expect(page.getByRole('dialog', { name: heading(), exact: true })).toBeVisible()
})

for (const close of ['닫기', '나중에 하기', 'Escape', 'backdrop']) test(`${close}는 거래소 상세 DOM·리뷰 설정·스크롤을 보존하고 재클릭은 다시 안내한다`, async ({ page }) => {
  await setup(page)
  await openDetail(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: /^리뷰 정렬:/ }).click()
  await page.getByRole('option', { name: '최신순', exact: true }).click()
  await expect(page.getByRole('listbox', { name: '리뷰 정렬' })).toHaveCount(0)
  await page.getByRole('group', { name: '리뷰 카테고리' }).getByRole('button', { name: '거래 조건', exact: true }).click()
  const detail = await page.locator('.bk2-det').elementHandle(), before = await stored(page)
  const sheet = await gate(page)
  const scroll = await page.locator('#research-main').evaluate(el => el.scrollTop)
  if (close === 'Escape') await page.keyboard.press('Escape')
  else if (close === 'backdrop') await page.mouse.click(2, 2)
  else await sheet.getByRole('button', { name: close, exact: true }).click()
  await expect(sheet).toHaveCount(0)
  expect(await detail!.evaluate(el => el === document.querySelector('.bk2-det'))).toBe(true)
  await expect(page.getByRole('tab', { name: '리뷰', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '리뷰 정렬: 최신순', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: '리뷰 카테고리' }).getByRole('button', { name: '거래 조건', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.locator('#research-main').evaluate(el => el.scrollTop)).toBe(scroll)
  await expect(page.getByRole('button', { name: 'TETH로 연결', exact: true })).toBeFocused()
  expect(await stored(page)).toEqual(before)
  await gate(page)
})

test('UID 미공급은 강제 클릭에도 비활성이고 연결·결제·등록 상태나 외부 요청을 만들지 않는다', async ({ page }) => {
  await setup(page)
  await openDetail(page, 'OKX')
  const before = await stored(page), requests: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) requests.push(request.url()) })
  const sheet = await gate(page, 'OKX')
  const link = sheet.getByRole('button', { name: '무료로 연동하기', exact: true })
  await expect(link).toBeDisabled()
  await link.evaluate(el => (el as HTMLButtonElement).click())
  await expect(sheet).toBeVisible()
  expect(await stored(page)).toEqual(before)
  expect(requests).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.locator('.bk2-head')).not.toContainText('TETH에 연결됨')
})

test('구독은 마지막 검증된 ETH의 동일 조건 connect로 이동하며 별개 대화·등록·계정은 보존한다', async ({ page }) => {
  await setup(page, { validated: true })
  await openDetail(page)
  const before = await stored(page), sheet = await gate(page)
  await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  await expect(page.getByRole('heading', { name: '결제 주기를 선택해주세요', exact: true })).toBeVisible()
  const after = await stored(page)
  expect(after.authority).toEqual(before.authority)
  expect(after.experience.sessions.find((item: { id: string }) => item.id === original.id)).toEqual(before.experience.sessions.find((item: { id: string }) => item.id === original.id))
  expect(after.experience.sessions.find((item: { id: string }) => item.id === original.id)).toMatchObject(original)
  expect(after.experience.homeDraft).toBe(before.experience.homeDraft)
  expect(after.experience.currentId).toBe(sessionId)
  expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!).parameters, sessionId)).toEqual(parameters)
})

for (const [label, options] of [['검증 결과 없음', {}], ['미완료 결과', { validated: true, incomplete: true }], ['다른 계정 locator', { validated: true, otherOwner: true }]] as const) test(`${label} 구독은 기존 대화와 초안을 유지한 안내로 돌아간다`, async ({ page }) => {
  await setup(page, options)
  await openDetail(page)
  const before = await stored(page), sheet = await gate(page)
  await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue(original.draft)
  await expect(page.getByRole('status').filter({ hasText: '전략 검증을 통과하면 구독 단계로 이어져요. 채팅에서 전략을 맡겨보세요.' })).toBeVisible()
  expect(await stored(page)).toEqual(before)
  await expect(page.locator('.client-delegation')).toHaveCount(0)
})

test('경로 이탈은 시트를 취소하고 제거된 구독 버튼의 늦은 클릭도 이전 거래소로 이어지지 않는다', async ({ page }) => {
  await setup(page, { validated: true })
  await openDetail(page)
  const before = await stored(page), sheet = await gate(page)
  const stale = await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).elementHandle()
  await page.evaluate(() => { location.hash = '#/plan' })
  await expect(page.locator('.client-account-activity').first()).toBeVisible()
  await expect(sheet).toHaveCount(0)
  await stale!.evaluate(el => (el as HTMLButtonElement).click())
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  expect(await stored(page)).toEqual(before)
})

for (const width of [320, 1440]) test(`${width}px 거래소 플랜 시트는 원문·초점·터치 영역과 상세 복귀를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  await setup(page)
  await openDetail(page)
  const sheet = await gate(page)
  await page.evaluate(() => document.fonts.ready)
  await expect(sheet.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  await expect(sheet).toHaveCSS('word-break', 'keep-all')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`broker-upgrade-${width}-top.png`) })
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const later = sheet.getByRole('button', { name: '나중에 하기', exact: true })
  await expect(later).toBeFocused()
  const box = (await later.boundingBox())!
  const coarse = await page.evaluate(() => matchMedia('(pointer:coarse), (max-width:640px)').matches)
  expect(box.height).toBeGreaterThanOrEqual(coarse ? 44 : 24)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  expect(await later.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit) })).toBe(true)
  await page.screenshot({ path: info.outputPath(`broker-upgrade-${width}-later.png`) })
  await page.keyboard.press('Enter')
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'TETH로 연결', exact: true })).toBeFocused()
})

// Isolated real component with caller-controlled authority. Main has no guest
// brokers menu; this seam does not invent an entry or exercise real auth/API.
async function mountCaller(page: Page) {
  await page.route('**/broker-upgrade-caller.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3"><main id="research-main"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/broker-upgrade-caller.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', componentPath = '/src/components/ClientBrokers.tsx', domPath = '/@id/react-dom/client'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const source = await (await fetch(componentPath)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ reactPath), dm = await import(/* @vite-ignore */ domPath)
    const { ClientBrokers } = await import(/* @vite-ignore */ componentPath), react = rm.default ?? rm
    for (const path of ['/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    const state = { scope: 'owner-a:session-a', authenticated: true, connection: 'NEEDS_PLAN', override: false, generation: 1, calls: [] as string[] }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const render = () => {
      const generation = state.generation
      root.render(react.createElement(ClientBrokers, { onTitleChange: () => {}, authenticated: state.authenticated, presentationScope: state.scope,
        connectionState: () => state.connection, onLogin: () => state.calls.push('login'), onSubscribe: () => state.calls.push(`subscribe:${generation}`),
        onConnect: state.override ? (id: string, status: string) => state.calls.push(`connect:${id}:${status}`) : undefined,
      }))
    }
    Object.assign(window, { brokerUpgradeCaller: state, patchBrokerUpgradeCaller: (patch: object) => { Object.assign(state, patch); render() } })
    render()
  })
  await page.getByRole('button', { name: 'Binance 자세히', exact: true }).click()
  await expect(page.locator('.bk2-head h2')).toHaveText('Binance')
}

const patchCaller = (page: Page, patch: object) => page.evaluate(patch => Reflect.get(window, 'patchBrokerUpgradeCaller')(patch), patch)
const callerCalls = (page: Page) => page.evaluate(() => Reflect.get(window, 'brokerUpgradeCaller').calls)

for (const [label, patch] of [['계정·세션 scope', { scope: 'owner-b:session-b' }], ['인증 해제', { authenticated: false }], ['NEEDS_LINK', { connection: 'NEEDS_LINK' }], ['onConnect 공급', { override: true }]] as const) test(`caller 경계 ${label} 교체는 시트만 취소하고 상세 상태·늦은 콜백을 분리한다`, async ({ page }) => {
  await mountCaller(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: /^리뷰 정렬:/ }).click()
  await page.getByRole('option', { name: '최신순', exact: true }).click()
  await expect(page.getByRole('listbox', { name: '리뷰 정렬' })).toHaveCount(0)
  const detail = await page.locator('.bk2-det').elementHandle(), sheet = await gate(page)
  const stale = await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).elementHandle()
  await patchCaller(page, patch)
  await expect(sheet).toHaveCount(0)
  await stale!.evaluate(el => (el as HTMLButtonElement).click())
  expect(await callerCalls(page)).toEqual([])
  expect(await detail!.evaluate(el => el === document.querySelector('.bk2-det'))).toBe(true)
  await expect(page.getByRole('tab', { name: '리뷰', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '리뷰 정렬: 최신순', exact: true })).toBeVisible()
})

test('caller 게스트는 로그인만 요청하며 인증 결과 공급 후 같은 상세의 명시 연결로 안내한다', async ({ page }) => {
  await mountCaller(page)
  await patchCaller(page, { authenticated: false, connection: 'GUEST' })
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  expect(await callerCalls(page)).toEqual(['login'])
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const detail = await page.locator('.bk2-det').elementHandle()
  await patchCaller(page, { authenticated: true, connection: 'NEEDS_PLAN', scope: 'owner-b' })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await detail!.evaluate(el => el === document.querySelector('.bk2-det'))).toBe(true)
  await gate(page)
})

test('caller onConnect는 기존 상태를 그대로 받고 NEEDS_LINK에는 플랜 시트를 합성하지 않는다', async ({ page }) => {
  await mountCaller(page)
  await patchCaller(page, { override: true })
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await patchCaller(page, { connection: 'NEEDS_LINK' })
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  expect(await callerCalls(page)).toEqual(['connect:binance:NEEDS_PLAN', 'connect:binance:NEEDS_LINK'])
  await patchCaller(page, { override: false })
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'TETH로 연결', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: heading(), exact: true })).toHaveCount(0)
})

test('caller 시트는 최신 구독 함수만 한 번 호출하고 이전 함수는 재사용하지 않는다', async ({ page }) => {
  await mountCaller(page)
  const sheet = await gate(page)
  await patchCaller(page, { generation: 2 })
  await expect(sheet).toBeVisible()
  const subscribe = await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).elementHandle()
  await subscribe!.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(sheet).toHaveCount(0)
  expect(await callerCalls(page)).toEqual(['subscribe:2'])
})
})
