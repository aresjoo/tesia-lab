import { expect, test, type Page, type Route } from '@playwright/test'

// 가짜 SSE 프록시로 실 AI 턴 경로를 검증한다. 실제 네트워크·키는 절대 쓰지 않는다.
// 프록시 프로토콜: 본 호출 body 에 lite:true, ack 병렬 호출 body 에 think:true.
const PROXY = 'https://teth-fake-proxy.test'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const sse = (...events: object[]) => events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')
const sseHeaders = { ...CORS, 'Content-Type': 'text/event-stream' }
const isAckRequest = (route: Route) => (route.request().postData() ?? '').includes('"think":true')

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

const ACK_BODY = sse({ text: '비트코인 상황이군요, ' }, { text: '바로 볼게요.' }, { done: true })

const MAIN_BODY = sse(
  { think: '주봉과 일봉의 관계를 ' },
  { think: '먼저 확인한다.' },
  { text: '<sa' },
  { text: 'y>진입 타이밍 질문이시군요. 차트 구조부터 볼게요.</say><work model="gemini-agy-flash" role="차트 검토"><it' },
  { text: 'em>주봉 추세 구조 검토</item><item>일봉 조정 구간 점검</item></work>' },
  { text: '<say>두 신호가 어긋나 있어요.</say><work model="claude-fable-5" role="종합 판단"><item>반대 시나리오 점검</item></work>' },
  { text: '<say>결론: 분할 접근이 낫습니다.\n<prob up="6' },
  { text: '2" down="38"/>\n무효선은 아래에 있습니다.</say>' },
  { text: '<chips>{"suggest":["분할은 어떻게 나눠?"],"action":[{"type":"backtest","label":"이 전략 검증하기"}]}</chips>' },
  { done: true },
)

test('해피패스: ack 가 먼저 흐르고 say/work 교대·확률·칩이 태그 분할에도 정확히 렌더된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: ACK_BODY }); return }
    await new Promise(resolve => setTimeout(resolve, 600)) // 본 호출은 thinking 만큼 늦게 온다
    await route.fulfill({ status: 200, headers: sseHeaders, body: MAIN_BODY })
  })
  await ask(page, '비트코인 지금 사도 돼?')
  // ack 문장이 본 호출 도착 전에 먼저 보인다
  await expect(page.locator('.g-amsg').first()).toContainText('비트코인 상황이군요, 바로 볼게요.')
  // 본 호출 완료 후: say 세그먼트 교대 렌더
  await expect(page.locator('.g-amsg', { hasText: '진입 타이밍 질문이시군요' })).toBeVisible()
  await expect(page.locator('.g-amsg', { hasText: '두 신호가 어긋나 있어요' })).toBeVisible()
  await expect(page.locator('.g-amsg', { hasText: '결론: 분할 접근이 낫습니다' })).toBeVisible()
  await expect(page.locator('.g-act2 .hlb')).toHaveText('생각 완료')
  // 활동 패널: thinking 프로즈 + work item 스텝
  await page.locator('.g-act2 .hd').click()
  await expect(page.locator('.g-act2 .at', { hasText: '주봉 추세 구조 검토' })).toBeVisible()
  await expect(page.locator('.g-act2 .at', { hasText: '반대 시나리오 점검' })).toBeVisible()
  await page.locator('.g-act2 .arh', { hasText: 'TETH의 생각' }).click()
  await expect(page.locator('.g-act2 .ad')).toContainText('주봉과 일봉의 관계를 먼저 확인한다.')
  await expect(page.locator('.teth-prob')).toHaveAttribute('aria-label', '상승 확률 62%, 하락 확률 38%')
  await expect(page.locator('.g-qchip', { hasText: '분할은 어떻게 나눠?' })).toBeVisible()
  await expect(page.locator('.client-next-actions button', { hasText: '이 전략 검증하기' })).toBeVisible()
  const persisted = await page.evaluate(() => sessionStorage.getItem('teth-client-experience') ?? '')
  expect(persisted).toContain('"source":"ai"')
  expect(persisted).toContain('"kind":"work"')
  expect(errors).toEqual([])
})

test('ack 레이스: 본 say 가 먼저 도착하면 늦은 ack 는 통째로 생략된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) {
      await new Promise(resolve => setTimeout(resolve, 1500)) // ack 가 본 호출보다 늦는다
      await route.fulfill({ status: 200, headers: sseHeaders, body: ACK_BODY })
      return
    }
    await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ text: '<say>즉답입니다.</say>' }, { done: true }) })
  })
  await ask(page, '이더리움 어때?')
  await expect(page.locator('.g-amsg', { hasText: '즉답입니다.' })).toBeVisible()
  await page.waitForTimeout(1800)
  await expect(page.locator('.g-amsg', { hasText: '비트코인 상황이군요' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('무효 prob 과 깨진 chips 는 조용히 제외되고 렌더는 계속, 기본 진입점은 유지된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const body = sse(
    { text: '<say>결론만 유효합니다.<prob up="62" down="39"/></say>' },
    { text: '<chips>{"suggest": [broken</chips>' },
    { done: true },
  )
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    await route.fulfill({ status: 200, headers: sseHeaders, body })
  })
  await ask(page, '솔라나 어때?')
  await expect(page.locator('.g-amsg')).toContainText('결론만 유효합니다.')
  await expect(page.locator('.client-answer-actions')).toBeVisible()
  await expect(page.locator('.teth-prob')).toHaveCount(0)
  await expect(page.locator('.client-next-actions button')).toHaveCount(1)
  await expect(page.locator('.client-next-actions button')).toContainText('전략 맡기기')
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

test('중간 단절({done} 없이 종료)이어도 부분 say 를 보존하고 완료 처리한다', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ text: '<say>부분 답변까지는 도착했습니다.' }) })
  })
  await ask(page, '리플 어때?')
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
