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
  // ack 문장 + 꼬리 로더가 본 호출 도착 전에 먼저 보인다
  await expect(page.locator('.g-amsg').first()).toContainText('비트코인 상황이군요, 바로 볼게요.')
  await expect(page.locator('.teth-tail-loader')).toBeVisible()
  // 본 호출 완료 후: say 세그먼트 교대 렌더 — 첫 본 say 가 ack 를 대체해 도입부는 한 줄만 남는다
  await expect(page.locator('.g-amsg', { hasText: '진입 타이밍 질문이시군요' })).toBeVisible()
  await expect(page.locator('.g-amsg', { hasText: '비트코인 상황이군요, 바로 볼게요.' })).toHaveCount(0)
  await expect(page.locator('.g-amsg', { hasText: '두 신호가 어긋나 있어요' })).toBeVisible()
  await expect(page.locator('.g-amsg', { hasText: '결론: 분할 접근이 낫습니다' })).toBeVisible()
  // work 는 인라인 카드로 릴레이 렌더 — 완료 후 한 줄 접힘 + (DEMO on) 모델 표기
  const workCards = page.locator('.teth-work')
  await expect(workCards).toHaveCount(2)
  await expect(workCards.first()).toHaveClass(/fin/)
  await expect(workCards.first().locator('.twk-sum')).toContainText('주봉 추세 구조 검토, 일봉 조정 구간 점검')
  await expect(workCards.first().locator('.twk-model-tail')).toHaveText('gemini-agy-flash')
  await workCards.first().locator('.twk-head').click()
  await expect(workCards.first().locator('.twk-items li', { hasText: '일봉 조정 구간 점검' })).toBeVisible()
  // 상단 활동 패널은 thinking 전용으로 축소
  await expect(page.locator('.g-act2 .hlb')).toHaveText('작업 완료 · 1단계')
  await page.locator('.g-act2 .hd').click()
  await expect(page.locator('.g-act2 .at')).toHaveCount(1)
  await page.locator('.g-act2 .arh', { hasText: 'TETH의 생각' }).click()
  await expect(page.locator('.g-act2 .ad')).toContainText('주봉과 일봉의 관계를 먼저 확인한다.')
  await expect(page.locator('.teth-prob')).toHaveAttribute('aria-label', '상승 확률 62%, 하락 확률 38%')
  // 후속 질문 = Genspark 풀폭 로우, 액션 = 기존 next-actions 디자인
  await expect(page.locator('.teth-followup', { hasText: '분할은 어떻게 나눠?' })).toBeVisible()
  await expect(page.locator('.client-next-actions button', { hasText: '이 전략 검증하기' })).toBeVisible()
  // 가로 오버플로 없음 (모바일 프로젝트 포함 양 프로젝트에서 확인)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  const persisted = await page.evaluate(() => sessionStorage.getItem('teth-client-experience') ?? '')
  expect(persisted).toContain('"source":"ai"')
  expect(persisted).toContain('"kind":"work"')
  expect(errors).toEqual([])
})

test('DEMO_MODE off: 모델 뱃지·라우팅 선언 없이 role 라벨만으로 정상 렌더된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.addInitScript(() => localStorage.setItem('tethDemoMode', 'off'))
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    await route.fulfill({ status: 200, headers: sseHeaders, body: MAIN_BODY })
  })
  await ask(page, '비트코인 지금 사도 돼?')
  await expect(page.locator('.g-amsg', { hasText: '결론: 분할 접근이 낫습니다' })).toBeVisible()
  await expect(page.locator('.teth-work')).toHaveCount(2)
  await expect(page.locator('.twk-badge')).toHaveCount(0)
  await expect(page.locator('.twk-model-tail')).toHaveCount(0)
  await expect(page.locator('.twk-route')).toHaveCount(0)
  await expect(page.locator('.teth-work').first().locator('.twk-sum')).toContainText('주봉 추세 구조 검토')
  const bodyText = await page.locator('.client-source-main').textContent() ?? ''
  expect(bodyText).not.toContain('gemini-agy-flash')
  expect(bodyText).not.toContain('claude-fable-5')
  expect(errors).toEqual([])
})

test('라우팅 표 밖 모델명은 뱃지를 만들지 않고 role 만 렌더된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const body = sse(
    { text: '<say>확인해볼게요.</say><work model="gpt-9000-ultra" role="차트 검토"><item>추세 확인</item></work><say>끝.</say>' },
    { done: true },
  )
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    await route.fulfill({ status: 200, headers: sseHeaders, body })
  })
  await ask(page, '비트코인 어때?')
  await expect(page.locator('.g-amsg', { hasText: '끝.' })).toBeVisible()
  await expect(page.locator('.teth-work')).toHaveCount(1)
  await expect(page.locator('.twk-badge')).toHaveCount(0)
  await expect(page.locator('.twk-model-tail')).toHaveCount(0)
  const bodyText = await page.locator('.client-source-main').textContent() ?? ''
  expect(bodyText).not.toContain('gpt-9000-ultra')
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

test('사고 패널 tool 활동: 번역·집계되고 쿼리 원문·URL·내부 ID 가 새지 않는다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const body = sse(
    { tool: { name: 'web_search', q: 'bitcoin price today weekly trend' } },
    { tool: { name: 'code_execution', q: 'import json' } },
    { tool: { name: 'code_execution', q: 'run()' } },
    { tool: { name: 'code_execution', q: 'calc()', p: '지지선 레벨 계산' } },
    { tool: { name: 'web_fetch', q: 'https://www.cryptorank.io/news/feed/bf7c2-eth' } },
    { text: '<say>확인을 끝냈어요. 결론은 관망입니다.</say>' },
    { done: true },
  )
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    await route.fulfill({ status: 200, headers: sseHeaders, body })
  })
  await ask(page, '비트코인 어때?')
  await expect(page.locator('.g-amsg', { hasText: '결론은 관망입니다' })).toBeVisible()
  await page.locator('.g-act2 .hd').click()
  await expect(page.locator('.g-act2 .at', { hasText: '시장 뉴스 확인: 비트코인' })).toBeVisible()
  await expect(page.locator('.g-act2 .at', { hasText: '데이터 계산 2회' })).toBeVisible()
  await expect(page.locator('.g-act2 .at', { hasText: '지지선 레벨 계산' })).toBeVisible()
  await expect(page.locator('.g-act2 .at', { hasText: '출처 확인: cryptorank.io' })).toBeVisible()
  const panelText = await page.locator('.g-act2').textContent() ?? ''
  expect(panelText).not.toContain('bitcoin price')
  expect(panelText).not.toContain('https://')
  expect(panelText).not.toContain('code_execution')
  expect(errors).toEqual([])
})

test('<ask> 질문 폼: 선택→자동 이동→제출 시 답변이 다음 메시지로 전송된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const askBody = sse(
    { text: '<say>맞춤 전략을 위해 몇 가지만 확인할게요.</say><ask>{"questions":[{"title":"투자 가능한 시드 규모는 어느 정도인가요?","hint":"분할 매수 단위가 달라집니다","options":[{"label":"500만원 이하","desc":"소액"},{"label":"500만~3천만원","desc":"중간 시드"}]},{"title":"투자 기간은 어느 정도로 보세요?","options":[{"label":"단기 스윙"},{"label":"장기 보유"}]}]}</ask>' },
    { done: true },
  )
  const followupBody = sse({ text: '<say>답변 기준으로 정리했습니다.</say>' }, { done: true })
  let mainCalls = 0
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    mainCalls++
    await route.fulfill({ status: 200, headers: sseHeaders, body: mainCalls === 1 ? askBody : followupBody })
  })
  await ask(page, '반감기 사이클 내 시드에 맞춰서 알려줘')
  await expect(page.locator('.tak-banner')).toContainText('질문 2개에 답변하세요')
  await expect(page.locator('.tak-title')).toContainText('시드 규모')
  // 직접 답변 CTA: 타이핑 전 회색·비활성, 타이핑하면 액센트 점등
  await page.locator('.tak-custom-toggle').click()
  await expect(page.locator('.tak-custom-send')).toBeDisabled()
  await page.locator('.tak-custom textarea').fill('1천만원 정도')
  await expect(page.locator('.tak-custom-send')).toHaveClass(/on/)
  await expect(page.locator('.tak-custom-send')).toBeEnabled()
  await page.locator('.tak-custom textarea').fill('')
  await page.locator('.tak-options > button', { hasText: '500만원 이하' }).click()
  await expect(page.locator('.tak-title')).toContainText('투자 기간')
  // 마지막 선택지를 고르는 순간 제출 버튼 없이 즉시 전송된다
  await page.locator('.tak-options > button', { hasText: '단기 스윙' }).click()
  await expect(page.locator('.g-umsg').last()).toContainText('500만원 이하')
  await expect(page.locator('.g-amsg', { hasText: '답변 기준으로 정리했습니다' })).toBeVisible()
  // 답변 완료 요약 = 우측 라이트 카드 (라벨 굵게 + 값)
  await expect(page.locator('.tak-answered-card .tak-pair-label').first()).toContainText('시드 규모')
  await expect(page.locator('.tak-answered-card .tak-pair-value').first()).toHaveText('500만원 이하')
  expect(mainCalls).toBe(2)
  expect(errors).toEqual([])
})

test('소스 읽기: 검색 결과·페이지 열기가 도메인 행으로 렌더되고 전체 URL 은 새지 않는다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const body = sse(
    { tool: { name: 'web_search', q: 'bitcoin support levels' } },
    { sres: { n: 2, results: [{ t: 'Bitcoin Four Year Cycle', u: 'https://www.galaxy.com/insights/research/bitcoin-four-year' }, { t: '사이클 반복 차트', u: 'https://charts.bitbo.io/cycle-repeat/' }] } },
    { tool: { name: 'web_fetch', q: 'https://www.galaxy.com/insights/research/bitcoin-four-year' } },
    { fres: { u: 'https://www.galaxy.com/insights/research/bitcoin-four-year' } },
    { text: '<say>확인 결과를 정리했습니다.</say>' },
    { done: true },
  )
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    await route.fulfill({ status: 200, headers: sseHeaders, body })
  })
  await ask(page, '비트코인 지지선 알려줘')
  await expect(page.locator('.g-amsg', { hasText: '확인 결과를 정리했습니다' })).toBeVisible()
  const card = page.locator('.teth-work').first()
  await card.locator('.twk-head').click()
  await expect(card.locator('.twk-sources li', { hasText: 'Bitcoin Four Year Cycle' })).toBeVisible()
  await expect(card.locator('.twk-src-domain', { hasText: 'galaxy.com' }).first()).toBeVisible()
  const cardText = await card.textContent() ?? ''
  expect(cardText).not.toContain('https://')
  expect(cardText).not.toContain('/insights/')
  expect(errors).toEqual([])
})

test('say 본문 마크다운: 표·굵게·리스트·인용이 렌더된다', async ({ page }) => {
  const errors = collectPageErrors(page)
  const body = sse(
    { text: '<say>정리해드릴게요.\n\n| 항목 | 값 |\n|---|---|\n| 지지선 | **$2,438** |\n| 저항선 | $2,546 |\n\n- 첫째 규칙\n- 둘째 규칙\n\n> 본 내용은 정보 제공 목적입니다.</say>' },
    { done: true },
  )
  await openWithProxy(page, async route => {
    if (isAckRequest(route)) { await route.fulfill({ status: 200, headers: sseHeaders, body: sse({ done: true }) }); return }
    await route.fulfill({ status: 200, headers: sseHeaders, body })
  })
  await ask(page, '표로 정리해줘')
  await expect(page.locator('.teth-rich th', { hasText: '항목' })).toBeVisible()
  await expect(page.locator('.teth-rich td strong', { hasText: '$2,438' })).toBeVisible()
  await expect(page.locator('.teth-rich li', { hasText: '첫째 규칙' })).toBeVisible()
  await expect(page.locator('.teth-rich blockquote')).toContainText('정보 제공 목적')
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
