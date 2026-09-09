import { expect, test, type Page, type Route } from '@playwright/test'

// 가짜 SSE 프록시로 실 AI 턴 경로를 검증한다. 실제 네트워크·키는 절대 쓰지 않는다.
const PROXY = 'https://teth-fake-proxy.test'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const sse = (...events: object[]) => events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')

async function openWithProxy(page: Page, handler: (route: Route) => Promise<void> | void) {
  await page.route(`${PROXY}/api/chat`, async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return }
    await handler(route)
  })
  await page.addInitScript(origin => localStorage.setItem('tethAiProxy', origin), PROXY)
  await page.goto('/')
}

function collectPageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  return errors
}

async function ask(page: Page, question: string) {
  const box = page.locator('textarea').first()
  await box.fill(question)
  await box.press('Enter')
}

const HAPPY_BODY = sse(
  { think: '주봉과 일봉의 관계를 ' },
  { think: '먼저 확인한다.' },
  { text: '<tr' },
  { text: 'ace>주봉 흐름 확인</trace>' },
  { text: '<trace>반대 시나리오 검증</tr' },
  { text: 'ace><answer>결론: 분할 접근이 낫습니다.\n<prob up="6' },
  { text: '2" down="38"/>\n근거는 주봉 추세입니다.</answer>' },
  { text: '<chips>{"suggest":["분할은 어떻게 나눠?"],"action":[{"type":"backtest","label":"이 전략 검증하기"}]}</chips>' },
  { done: true },
)

test('해피패스: 사고 패널·트레이스 스텝·확률·칩이 태그 분할에도 정확히 렌더된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openWithProxy(page, route => route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'text/event-stream' }, body: HAPPY_BODY }))
  await ask(page, '비트코인 지금 사도 돼?')
  await expect(page.locator('.g-amsg')).toContainText('결론: 분할 접근이 낫습니다.')
  await expect(page.locator('.g-amsg')).toContainText('근거는 주봉 추세입니다.')
  await expect(page.locator('.g-act2 .hlb')).toHaveText('생각 완료')
  // 활동 패널을 펼쳐 트레이스 스텝과 thinking 프로즈를 확인한다.
  await page.locator('.g-act2 .hd').click()
  await expect(page.locator('.g-act2 .at', { hasText: '주봉 흐름 확인' })).toBeVisible()
  await expect(page.locator('.g-act2 .at', { hasText: '반대 시나리오 검증' })).toBeVisible()
  await page.locator('.g-act2 .arh', { hasText: 'TETH의 생각' }).click()
  await expect(page.locator('.g-act2 .ad')).toContainText('주봉과 일봉의 관계를 먼저 확인한다.')
  await expect(page.locator('.teth-prob')).toHaveAttribute('aria-label', '상승 확률 62%, 하락 확률 38%')
  await expect(page.locator('.g-qchip', { hasText: '분할은 어떻게 나눠?' })).toBeVisible()
  await expect(page.locator('.client-next-actions button', { hasText: '이 전략 검증하기' })).toBeVisible()
  const persisted = await page.evaluate(() => sessionStorage.getItem('teth-client-experience') ?? '')
  expect(persisted).toContain('"source":"ai"')
  expect(errors).toEqual([])
})

test('무효 prob 과 깨진 chips 는 조용히 제외되고 답변 렌더는 계속된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const body = sse(
    { text: '<answer>결론만 유효합니다.<prob up="62" down="39"/></answer>' },
    { text: '<chips>{"suggest": [broken</chips>' },
    { done: true },
  )
  await openWithProxy(page, route => route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'text/event-stream' }, body }))
  await ask(page, '이더리움 어때?')
  await expect(page.locator('.g-amsg')).toContainText('결론만 유효합니다.')
  await expect(page.locator('.client-answer-actions')).toBeVisible()
  await expect(page.locator('.teth-prob')).toHaveCount(0)
  await expect(page.locator('.client-next-actions')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('프록시 429 는 스크립트 응답으로 폴백해 기존 리빌로 답한다', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openWithProxy(page, route => route.fulfill({ status: 429, headers: CORS, body: 'rate limited' }))
  await ask(page, '비트코인 지금 사도 돼?')
  await expect(page.locator('.g-amsg')).toContainText('진입 방식을 선택하세요', { timeout: 15_000 })
  await expect(page.locator('.g-qchip', { hasText: '내려왔을 때 반등 매수' })).toBeVisible()
  expect(errors).toEqual([])
})

test('중간 단절({done} 없이 종료)이어도 부분 답변을 보존하고 완료 처리한다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const body = sse({ text: '<answer>부분 답변까지는 도착했습니다.' })
  await openWithProxy(page, route => route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'text/event-stream' }, body }))
  await ask(page, '솔라나 어때?')
  await expect(page.locator('.g-amsg')).toContainText('부분 답변까지는 도착했습니다.')
  await expect(page.locator('.client-answer-actions')).toBeVisible()
  expect(errors).toEqual([])
})

test('스트림 중 중지: 요청을 끊고 턴은 중지 상태로 남는다', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openWithProxy(page, () => new Promise<never>(() => { /* 응답을 보류해 진행 중 상태를 만든다 */ }))
  await ask(page, '비트코인 지금 사도 돼?')
  const stop = page.locator('.g-send[aria-label="응답 중지"]')
  await expect(stop).toBeVisible()
  await stop.click()
  await expect(page.locator('.client-stopped')).toHaveText('응답이 중지되었습니다.')
  await expect(page.locator('.g-send[aria-label="메시지 보내기"]')).toBeVisible()
  expect(errors).toEqual([])
})

test('스트림 중 리로드: 실행 중 AI 턴은 조용히 중지로 복원된다', async ({ page }) => {
  await openWithProxy(page, () => new Promise<never>(() => { /* hold */ }))
  await ask(page, '비트코인 지금 사도 돼?')
  await expect(page.locator('.g-act2')).toBeVisible()
  await page.reload()
  await expect(page.locator('.client-stopped')).toHaveText('응답이 중지되었습니다.')
  // 복원 경고(recoveryWarning)는 AI 스트림 강등에는 뜨지 않아야 한다.
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
})

test('설정이 없으면 /api/chat 요청 없이 기존 스크립트 응답 그대로다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/')
  await ask(page, '비트코인 지금 사도 돼?')
  await expect(page.locator('.g-amsg')).toContainText('진입 방식을 선택하세요', { timeout: 15_000 })
  expect(requests.filter(url => url.includes('/api/chat'))).toEqual([])
})
