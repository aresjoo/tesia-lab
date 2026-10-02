import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'

// Browser-source navigation fixtures, not payment/connection authority.
const owner = 'upgrade-connection@example.test', sessionId = 'upgrade-eth-session'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const lowParameters = { ...parameters, trendFilter: false, startI: 604 }
const answers = Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: key === 'asset' ? 1 : key === 'period' ? 2 : 1 }]))
const result = evaluateDelegation(parameters, 5000000)
const record = { id: '1900', createdAt: 1900, name: '그대로 보존할 ETH 전략', parameters, score: result.score,
  ret: result.result.ret, mdd: result.result.mdd, n: result.result.n, winRate: result.result.winRate,
  status: 'off', environment: 'paper', asset: '이더리움', exchangeName: 'OKX', exchangeId: 'okx', capital: 5000000, chartSymbol: 'BINANCE:ETHUSDT', version: 'v3.7' }
const registrationKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const locatorKey = (identity: string) => `teth-client-delegation-location:account:${encodeURIComponent(identity)}`
const draft = 'ETH 대화에 남겨둔 미전송 초안', homeDraft = '홈에 남겨둔 입력'
type Options = { home?: boolean; otherConversation?: boolean; activeOwner?: string; sharedCopyOwner?: string; locator?: boolean; locatorSessionId?: string; workspace?: 'delegation'; snapshot?: Record<string, unknown> }

async function setup(page: Page, options: Options = {}, compatibility = true) {
  if (compatibility) await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (request.isNavigationRequest() && ['127.0.0.1', 'localhost'].includes(url.hostname)) await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/tests/fixtures/main-upgrade-connection-consumer.tsx");</script></body></html>' })
    else await route.fallback()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ options, owner, sessionId, parameters, answers, record, registrationKey, draft, homeDraft }) => {
    if (sessionStorage.getItem('upgrade-connection-initialized')) return
    sessionStorage.setItem('upgrade-connection-initialized', '1')
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'KRW')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '구독 동선 검수자', email: options.activeOwner ?? owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: options.home ? null : options.otherConversation ? 'upgrade-other-session' : sessionId, homeDraft, sessions: [
      { id: sessionId, title: 'ETH 검증 대화', renamed: true, idea: '이더리움 반등 전략', draft, pair: 'ETH/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-5%', takeProfit: '+12%', researchStatus: '초안', workspace: options.workspace ?? 'conversation', tradingReady: true, turns: [], updatedAt: 1, ...(options.sharedCopyOwner ? { sharedCopy: { owner: options.sharedCopyOwner, nick: '다른 소유자 원본', confirmedAt: 1, returnId: null, active: true } } : {}) },
      ...(options.otherConversation ? [{ id: 'upgrade-other-session', title: '별개의 BTC 대화', renamed: true, idea: '비트코인 추세', draft: '다른 대화의 초안', pair: 'BTC/USDT', mode: 'trend', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '', researchStatus: '초안', workspace: 'conversation', tradingReady: false, turns: [], updatedAt: 2 }] : []),
    ] }))
    sessionStorage.setItem(`teth:client-delegation:${sessionId}`, JSON.stringify({ page: 'report', answers, questionIndex: 5, attempt: 1, workStep: 5, chartInterval: '1D', parameters, ...options.snapshot }))
    sessionStorage.setItem(registrationKey, JSON.stringify([{ sessionId, record }]))
    if (options.locator !== false) sessionStorage.setItem(`teth-client-delegation-location:account:${encodeURIComponent(owner)}`, JSON.stringify({ sessionId: options.locatorSessionId ?? sessionId }))
  }, { options, owner, sessionId, parameters, answers, record, registrationKey, draft, homeDraft })
}

async function stored(page: Page) {
  return page.evaluate(({ registrationKey, sessionId }) => ({
    experience: JSON.parse(sessionStorage.getItem('teth-client-experience')!),
    ui: JSON.parse(sessionStorage.getItem(`teth:client-delegation:${sessionId}`)!),
    registered: sessionStorage.getItem(registrationKey),
    account: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-account'))),
  }), { registrationKey, sessionId })
}

async function subscribe(page: Page) {
  await page.goto('/#/plan')
  await page.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'PRO 로 업그레이드', exact: true })
  await expect(sheet).toBeVisible()
  const before = await stored(page)
  await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  return before
}

test('명시 archive 업그레이드 소비자: 플랜 공통 시트와 검증 전 후속 안내는 열린 상태에서 언어를 바꿔도 같은 대화를 유지한다', async ({ page }, info) => {
  await setup(page, { locator: false })
  await page.goto('/#/plan')
  await page.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  const sheet = page.locator('.client-upgrade-sheet')
  await expect(sheet).toBeVisible()
  const before = await stored(page)
  const preference = async (value: string) => page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, value)
  await preference('en')
  await expect(sheet).toHaveAccessibleName('Upgrade to PRO')
  await sheet.locator('.nfx-btn.sec').click()
  const notice = page.locator('.client-global-notice')
  await expect(notice).toBeVisible()
  expect(await notice.innerText()).not.toMatch(/[가-힣]/)
  await expect(notice.getByRole('button')).toHaveAccessibleName('Dismiss account notification')
  await page.screenshot({ path: info.outputPath('upgrade-followup-en.png') })
  await preference('ko')
  await expect(notice).toContainText('전략 검증을 통과하면 구독 단계로 이어져요. 채팅에서 전략을 맡겨보세요.')
  const after = await stored(page)
  expect(after.registered).toBe(before.registered)
  expect(after.account).toEqual(before.account)
  expect(after.ui).toEqual(before.ui)
  expect(after.experience.sessions).toEqual(before.experience.sessions)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
})

async function connected(page: Page) {
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  await expect(page.getByRole('button', { name: '무료로 시작', exact: true })).toBeVisible()
  await expect(page.locator('.client-delegation')).toContainText('전략 실행')
}

async function conserved(page: Page, before: Awaited<ReturnType<typeof stored>>) {
  const after = await stored(page)
  expect(after.registered).toBe(before.registered)
  expect(after.account).toEqual(before.account)
  expect(after.experience.sessions).toHaveLength(before.experience.sessions.length)
  expect(after.experience.sessions.find((item: { id: string }) => item.id === sessionId).draft).toBe(draft)
  expect(after.experience.homeDraft).toBe(homeDraft)
  expect(after.ui.parameters).toEqual(parameters)
  for (const key of ['payDone', 'uidLinked', 'plan', 'apiKey', 'secretKey']) expect(after.ui).not.toHaveProperty(key)
  return after
}

test('명시 archive 업그레이드 소비자: 검증 통과한 마지막 명시 ETH 위임은 요금제 구독 CTA에서 동일 세션 connect로 이어진다', async ({ page }, info) => {
  await setup(page)
  const mutations: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url()) })
  const before = await subscribe(page)
  await connected(page)
  const after = await conserved(page, before)
  expect(after.experience.currentId).toBe(sessionId)
  expect(after.ui.page).toBe('connect')
  expect(mutations).toEqual([])
  await page.screenshot({ path: info.outputPath('upgrade-same-eth-connect.png') })
})

test('명시 archive 업그레이드 소비자: 현재 별개 BTC 대화는 ETH 연결 대상으로 오인하거나 초안을 바꾸지 않는다', async ({ page }) => {
  await setup(page, { otherConversation: true })
  const before = await subscribe(page)
  await connected(page)
  const after = await conserved(page, before)
  expect(after.experience.currentId).toBe(sessionId)
  expect(after.experience.sessions.find((item: { id: string }) => item.id === 'upgrade-other-session')).toEqual(before.experience.sessions.find((item: { id: string }) => item.id === 'upgrade-other-session'))
})

test('명시 archive 업그레이드 소비자: 홈과 새로고침 뒤에도 현재 계정 locator의 동일 검증 결과로 돌아간다', async ({ page }) => {
  await setup(page, { home: true })
  await page.goto('/')
  await expect(page.locator('#strategy-idea')).toHaveValue(homeDraft)
  await page.reload()
  const before = await subscribe(page)
  await connected(page)
  await conserved(page, before)
  await page.reload()
  await connected(page)
  await conserved(page, before)
})

test('명시 archive 업그레이드 소비자: 완료된 pending 추천 결과를 사용하며 이전 미달 파라미터로 되돌리지 않는다', async ({ page }) => {
  await setup(page, { snapshot: { parameters: lowParameters, pendingParameters: parameters } })
  const before = await subscribe(page)
  await connected(page)
  const after = await conserved(page, before)
  expect(after.ui.pendingParameters).toBeUndefined()
})

for (const fixture of [
  { name: '아직 완료되지 않은 검증', options: { snapshot: { workStep: 4, pendingParameters: parameters } } },
  { name: '80점 미만 현재 결과', options: { snapshot: { parameters: lowParameters } } },
  { name: '다른 계정의 locator', options: { activeOwner: 'other-upgrade@example.test' } },
  { name: 'locator 없는 통과 대화', options: { locator: false } },
  { name: '미공급 파라미터', options: { snapshot: { parameters: null } } },
  { name: '미완성 질문', options: { snapshot: { questionIndex: 4, answers: Object.fromEntries(Object.entries(answers).filter(([key]) => key !== 'stop')) } } },
  { name: '복구가 필요한 손상 pending', options: { snapshot: { pendingParameters: { ...parameters, endI: 9000 } } } },
  { name: 'locator와 다른 sharedCopy 소유자', options: { sharedCopyOwner: 'foreign-copy@example.test' } },
] satisfies { name: string; options: Options }[]) test(`명시 archive 업그레이드 소비자: ${fixture.name}는 채팅 안내만 보여주고 연결·결제 권한을 만들지 않는다`, async ({ page }) => {
  await setup(page, fixture.options)
  const before = await subscribe(page)
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue(draft)
  await expect(page.getByRole('status').filter({ hasText: '전략 검증을 통과하면 구독 단계로 이어져요' })).toBeVisible()
  const after = await stored(page)
  expect(after.registered).toBe(before.registered)
  expect(after.account).toEqual(before.account)
  expect(after.ui).toEqual(before.ui)
  expect(after.experience.sessions).toEqual(before.experience.sessions)
  expect(after.experience.homeDraft).toBe(homeDraft)
  if (fixture.options.activeOwner) expect(await page.evaluate(key => sessionStorage.getItem(key), locatorKey(fixture.options.activeOwner))).toBeNull()
})

for (const width of [320, 1440]) test(`명시 archive 업그레이드 소비자: ${width}px 구독 연결 전환은 보이는 본문에 초점을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await setup(page)
  const before = await subscribe(page)
  await connected(page)
  await conserved(page, before)
  await expect.poll(() => page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    return Boolean(element && element !== document.body && element.getClientRects().length && !element.closest('[hidden],[inert],.client-sidebar')
      && (element.matches('.client-source-main') || element.closest('.client-delegation')))
  })).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`upgrade-connect-${width}.png`) })
})

for (const fixture of [
  { name: '다른 locator', options: { locatorSessionId: 'not-current-session', snapshot: { page: 'connect' } } },
  { name: '미완료 connect', options: { snapshot: { page: 'connect', workStep: 4 } } },
  { name: '완료 report', options: { snapshot: { page: 'report' } } },
  { name: '명시 복제 owner 불일치', options: { sharedCopyOwner: 'foreign-copy@example.test', snapshot: { page: 'connect' } } },
] satisfies { name: string; options: Options }[]) test(`명시 archive 업그레이드 소비자: ${fixture.name} 등록 세션은 초기 복원만으로 연결 화면을 열지 않는다`, async ({ page }) => {
  await setup(page, { ...fixture.options, workspace: 'delegation' })
  await page.goto('/')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  const before = await stored(page)
  await page.reload()
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  const after = await stored(page)
  expect(after.registered).toBe(before.registered)
  expect(after.account).toEqual(before.account)
  expect(after.ui).toEqual(before.ui)
})

// Source public plan URL is billing settings; the legacy upgrade above is an
// explicitly supplied component consumer and grants no current Main feature.
test('실제 Main 원본 PLAN alias는 결제 설정을 열고 기존 업그레이드·권한을 합성하지 않는다', async ({ page }) => {
  await setup(page, {}, false)
  const mutations: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  await page.goto('/#/plan')
  const settings = page.locator('.client-settings-page')
  await expect(settings.getByRole('heading', { name: '결제', exact: true })).toBeVisible()
  await expect(page.locator('.client-upgrade-sheet,.client-delegation')).toHaveCount(0)
  const before = await stored(page)
  await page.reload()
  await expect(settings.getByRole('heading', { name: '결제', exact: true })).toBeVisible()
  const after = await stored(page)
  expect(after.registered).toBe(before.registered)
  expect(after.ui).toEqual(before.ui)
  expect(after.experience.sessions).toEqual(before.experience.sessions)
  expect(mutations).toEqual([])
})
