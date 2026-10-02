import { expect, test, type Page } from '@playwright/test'
import { delegationExchanges } from '../src/client-delegation-fixtures'

// Frozen projection of teth-copy.js exchanges at source 621cbedcdd6b8f30b9b678763d8ed0bf2767e8bb.
// Source display copy, not current exchange documentation or a connection grant.
const sourceExchanges = [
  { id: 'binance', name: 'Binance', apiGuide: ['바이낸스 로그인 후 프로필 아이콘, 계정 설정으로 이동', 'API 관리(API Management) 메뉴에서 Create API 선택', '라벨에 TETH 입력 후 생성, 보안 인증 완료', 'Enable Reading과 Enable Spot Trading만 체크 (출금 권한은 켜지 마세요)', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
  { id: 'bybit', name: 'Bybit', apiGuide: ['Bybit 로그인 후 프로필, API 메뉴로 이동', 'API 키 생성 선택, 이름에 TETH 입력', '권한은 읽기와 거래(현물, 파생)만 선택 (출금 제외)', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
  { id: 'bitget', name: 'Bitget', apiGuide: ['Bitget 로그인 후 프로필, API 관리로 이동', 'API 키 생성, 이름에 TETH 입력, 패스프레이즈 설정', '권한은 읽기 전용과 거래만 선택 (출금 제외)', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
  { id: 'mexc', name: 'MEXC', apiGuide: ['MEXC 로그인 후 계정, API 관리로 이동', 'API 키 생성, 메모에 TETH 입력', '권한은 시세 조회와 거래만 선택 (출금 제외)', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
  { id: 'okx', name: 'OKX', apiGuide: ['OKX 로그인 후 프로필, API 메뉴로 이동', 'API 키 생성 선택, 이름에 TETH 입력', '권한은 읽기와 거래만 선택 (출금 제외)', '패스프레이즈 설정 후 생성', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
  { id: 'woox', name: 'WOO X', apiGuide: ['WOO X 로그인 후 계정, API 관리로 이동', 'Create API Key 선택', '권한은 Read와 Trade만 허용 (Withdraw 제외)', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
] as const
const owner = 'exchange-source@example.test'
const sessionId = 'exchange-source-flow'
const registrationKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const uid = '98765432109'
const apiKey = 'SOURCE_ONLY_FAKE_KEY_Z9Q7'
const secret = 'SOURCE_ONLY_FAKE_SECRET_R8V6'

async function openSelection(page: Page) {
  await page.addInitScript(({ owner, sessionId, parameters }) => {
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    if (sessionStorage.getItem('exchange-source-initialized')) return
    sessionStorage.setItem('exchange-source-initialized', 'true')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '거래소 원본 검수', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: sessionId, homeDraft: '', sessions: [{
      id: sessionId, title: '거래소 선택 검수', idea: '비트코인 반등', draft: '보존할 질문', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-5%', takeProfit: '+12%', workspace: 'delegation', researchStatus: '초안', turns: [], updatedAt: 1,
    }] }))
    const answers = Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: key === 'asset' ? 0 : key === 'period' ? 2 : 1 }]))
    sessionStorage.setItem(`teth:client-delegation:${sessionId}`, JSON.stringify({ page: 'connect', answers, questionIndex: 5, attempt: 1, workStep: 5, expert: false, chartInterval: '1D', parameters }))
  }, { owner, sessionId, parameters })
  await page.goto('/')
  await page.getByRole('button', { name: '무료로 시작', exact: true }).click()
  await expect(page.locator('.tf-exs .lg')).toHaveText(sourceExchanges.map(item => item.name))
  await expect(page.locator('.tf-exs .rb')).toHaveCount(1)
  await expect(page.locator('.tf-exs .tf-ex').first()).toHaveText('추천Binance')
  await expect(page.getByLabel('API Key', { exact: true })).toHaveCount(0)
}

async function noSensitiveStorage(page: Page) {
  const values = await page.evaluate(() => Object.values({ ...localStorage, ...sessionStorage }).join('\n'))
  for (const value of [uid, apiKey, secret, 'Z9Q7', 'R8V6']) expect(values).not.toContain(value)
}

test('위임 거래소 6종은 원본 배열 순서·이름·API 가이드를 정확히 보존한다', () => {
  expect(delegationExchanges).toEqual(sourceExchanges)
  expect(new Set(delegationExchanges.map(item => item.id)).size).toBe(6)
})

for (const item of sourceExchanges) test(`${item.name}: 선택→UID→API 가이드→등록·새로고침은 거래소만 보존하고 민감값·외부 요청은 남기지 않는다`, async ({ page }) => {
  const mutations: string[] = [], exchangeRequests: string[] = []
  page.on('request', request => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url())
  })
  // Reject any accidental external exchange transport before it leaves the browser.
  await page.route(/https?:\/\/([^/]+\.)?(binance\.com|bybit\.com|bitget\.com|mexc\.com|okx\.com|woo\.org)(\/|$)/, route => {
    exchangeRequests.push(route.request().url())
    return route.abort()
  })
  await page.setViewportSize({ width: 320, height: 900 })
  await openSelection(page)
  await page.evaluate(() => document.fonts.ready)
  for (const button of await page.locator('.tf-exs .tf-ex').all()) {
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(321)
  }
  await page.locator('.tf-exs .tf-ex').filter({ has: page.locator('.lg', { hasText: new RegExp(`^${item.name}$`) }) }).click()
  await expect(page.getByRole('heading', { name: `${item.name} 가입`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: '가입 완료했어요', exact: true }).click()
  await page.getByLabel(`${item.name} UID`, { exact: true }).fill(uid)
  await page.getByRole('button', { name: 'UID가 어디 있어요?', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(`${item.name} 기준이며 다른 거래소도 위치가 비슷해요.`)
  await expect(dialog.locator('.tf-guide .g')).toHaveText(['거래소 앱 또는 웹에서 로그인', '우측 상단 프로필 아이콘 선택', '프로필 화면 상단에 표시된 숫자가 UID예요'])
  await page.getByRole('button', { name: '가이드 닫기', exact: true }).click()
  await expect(page.getByRole('button', { name: 'UID가 어디 있어요?', exact: true })).toBeFocused()
  await noSensitiveStorage(page)
  await page.getByRole('button', { name: '연동 확인하기', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${item.name} API 연결`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: '발급 방법 보기', exact: true }).click()
  await expect(dialog.getByRole('heading')).toHaveText(`${item.name} API Key 발급 방법`)
  await expect(dialog.locator('.tf-guide .g')).toHaveText([...item.apiGuide])
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.getByRole('button', { name: '가이드 닫기', exact: true }).click()
  await page.getByLabel('API Key', { exact: true }).fill(apiKey)
  await page.getByLabel('Secret Key', { exact: true }).fill(secret)
  await noSensitiveStorage(page)
  await page.getByRole('button', { name: '권한 확인하고 연결하기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '준비가 끝났어요', exact: true })).toBeVisible()
  await expect(page.locator('.tf-donec')).toContainText(`${item.name} (API •••• Z9Q7)`)
  await noSensitiveStorage(page)
  await page.getByRole('button', { name: '나중에 시작', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/\d+$/)
  const raw = await page.evaluate(key => sessionStorage.getItem(key), registrationKey)
  const entries = JSON.parse(raw!)
  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({ sessionId, record: { exchangeId: item.id, exchangeName: item.name, status: 'ready', parameters } })
  await noSensitiveStorage(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: '비트코인 위임 전략', exact: true })).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(raw)
  await noSensitiveStorage(page)
  expect(mutations).toEqual([])
  expect(exchangeRequests).toEqual([])
})

test('거래소 재선택은 새 거래소 가이드로 전환하며 320px 선택 목록을 넘치게 하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await openSelection(page)
  for (const name of ['Bybit', 'Bitget', 'MEXC']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: '가입 안내 보기', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText(`${name} 기준이며 다른 거래소도 위치가 비슷해요.`)
    await page.getByRole('button', { name: '가이드 닫기', exact: true }).click()
    await page.getByRole('button', { name: '다른 거래소 선택', exact: true }).click()
    await expect(page.locator('.tf-exs .lg')).toHaveText(sourceExchanges.map(item => item.name))
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()
})
