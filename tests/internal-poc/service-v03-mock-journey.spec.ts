import { expect, test, type Page } from '@playwright/test'

const JOURNEY_URL = '/internal-poc-fixture.html#/v03-journey'
const FIXTURE_NOTICE = '입력과 무관한 고정 계약 fixture 시연이며, 표시된 값은 해당 입력의 해석·보존 또는 실제 전략 결과가 아닙니다.'

const collectSafetySignals = (page: Page) => {
  const requests: string[] = []
  const consoleErrors: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  return { requests, consoleErrors }
}

const enterFixtureIdea = async (page: Page) => {
  await page.getByRole('button', { name: '예시 전략 채우기' }).click()
  await page.getByRole('button', { name: '전략 만들기' }).click()
}

const reachApprovedStrategy = async (page: Page) => {
  await enterFixtureIdea(page)
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeFocused()
  await page.getByRole('button', { name: '수정안 적용' }).click()
  await expect(page.getByText('수정안 적용 완료', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeFocused()
  await page.getByRole('button', { name: '전략 검증하기' }).click()
  await expect(page.getByRole('heading', { name: '계약 검증 통과' })).toBeFocused()
  await page.getByRole('button', { name: '승인 절차 시작' }).click()
  await expect(page.getByRole('heading', { name: '전략 버전 생성을 명시적으로 승인해 주세요' })).toBeFocused()
  const approve = page.getByRole('button', { name: '전략 승인' })
  await expect(approve).toBeDisabled()
  await page.getByRole('checkbox', { name: '위 전략 내용과 Mock-only 제한을 확인했습니다.' }).check()
  await expect(approve).toBeEnabled()
  await approve.click()
  await expect(page.getByRole('heading', { name: 'Mock 전략 버전 생성 완료' })).toBeFocused()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
})

test('자연어에서 명시 승인과 제한된 Mock 결과까지 generated v0.3 경로로 연결한다', async ({ page }) => {
  const safety = collectSafetySignals(page)
  await page.goto(JOURNEY_URL)

  await expect(page.getByTestId('v03-journey')).toHaveAttribute('data-source', 'SERVICE_V03_MOCK_JOURNEY_MEMORY_ONLY')
  await expect(page.getByRole('note')).toContainText(FIXTURE_NOTICE)
  await reachApprovedStrategy(page)
  await page.getByRole('button', { name: 'Mock 백테스트 시작' }).click()
  await expect(page.getByRole('progressbar', { name: 'Mock 백테스트 준비 진행률' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '검증 결과 화면' })).toBeFocused()

  await expect(page.getByText('실제 replay 미연결', { exact: true })).toBeVisible()
  await expect(page.getByText('계산 미연결', { exact: true })).toHaveCount(6)
  await expect(page.getByText('currentMmrVerified=false', { exact: true })).toBeVisible()
  await expect(page.getByText('liquidationCheckStatus=UNAVAILABLE', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trade list 미연결' })).toBeVisible()
  await expect(page.getByRole('button', { name: '실거래 실행 잠김' })).toBeDisabled()
  await expect(page.locator('.v03j-footer')).toContainText('호출 단계 6')
  await expect(page.locator('.v03j-footer')).toHaveAttribute(
    'data-operations',
    'createConversationV3,createConversationTurnV3,patchStrategyDraftV3,validateStrategyDraftV3,createApprovalChallengeV3,approveStrategyDraftV3',
  )

  const browserState = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookie: document.cookie,
    html: document.body.innerHTML,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  expect(browserState).toMatchObject({ local: 0, session: 0, cookie: '', overflow: 0 })
  expect(browserState.html).not.toMatch(/csrf_journey|idempotency_0001|api[_-]?key|secret[_-]?key/i)
  expect(safety.requests.filter((url) => /\/api\/v3\//.test(url))).toEqual([])
  const sameOrigin = await page.evaluate(() => location.origin)
  expect(safety.requests.filter((url) => new URL(url).origin !== sameOrigin)).toEqual([])
  expect(safety.consoleErrors).toEqual([])
})

test('빈 입력·loading·키보드 승인과 focus 이동을 명확히 처리한다', async ({ page }) => {
  await page.goto(JOURNEY_URL)
  const submit = page.getByRole('button', { name: '전략 만들기' })
  await expect(submit).toBeDisabled()
  await page.getByRole('button', { name: '예시 전략 채우기' }).press('Enter')
  await submit.click()
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('heading', { name: '아이디어를 계약 fixture에 맞춰 구조화하고 있어요' })).toBeFocused()
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeVisible()
  await expect(page.getByText('execution.leverage · set', { exact: true })).toBeVisible()
  await expect(page.getByText('기존 값 없음', { exact: true })).toBeVisible()
  await expect(page.getByText('2배', { exact: true })).toBeVisible()
})

test('turn 오류는 conversation을 다시 만들지 않고 동일 turn만 재시도한다', async ({ page }) => {
  const safety = collectSafetySignals(page)
  await page.goto(`${JOURNEY_URL}?scenario=turn-error-once`)
  await enterFixtureIdea(page)
  await expect(page.getByRole('heading', { name: 'Mock 흐름을 완료하지 못했습니다' })).toBeVisible()
  await expect(page.getByText('TRANSPORT_UNAVAILABLE', { exact: true })).toBeVisible()
  await expect(page.getByText('실제 요청이나 주문은 전송되지 않았습니다.')).toBeVisible()
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeVisible()
  await expect(page.locator('.v03j-footer')).toContainText('호출 단계 3')
  await expect(page.locator('.v03j-footer')).toHaveAttribute(
    'data-operations',
    'createConversationV3,createConversationTurnV3,createConversationTurnV3',
  )
  expect(safety.requests.filter((url) => /\/api\/v3\//.test(url))).toEqual([])
  expect(safety.consoleErrors).toEqual([])
})

test('conversation 생성 오류도 동일 create 단계 재시도로 복구한다', async ({ page }) => {
  await page.goto(`${JOURNEY_URL}?scenario=error-once`)
  await enterFixtureIdea(page)
  await expect(page.getByRole('heading', { name: 'Mock 흐름을 완료하지 못했습니다' })).toBeVisible()
  await expect(page.getByText('TRANSPORT_UNAVAILABLE', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeVisible()
  await expect(page.locator('.v03j-footer')).toHaveAttribute(
    'data-operations',
    'createConversationV3,createConversationV3,createConversationTurnV3',
  )
})

test('turn 처리 중 처음으로를 누르면 늦은 응답이 새 EMPTY session을 바꾸지 않는다', async ({ page }) => {
  await page.goto(`${JOURNEY_URL}?scenario=slow`)
  await enterFixtureIdea(page)
  await expect(page.locator('.v03j-footer')).toContainText('호출 단계 1')
  await page.getByRole('button', { name: 'TESIA AI 내부 Mock 처음으로' }).click()
  await expect(page.getByRole('heading', { name: '어떤 전략을 만들고 싶으세요?' })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByRole('heading', { name: '어떤 전략을 만들고 싶으세요?' })).toBeVisible()
  await expect(page.locator('.v03j-footer')).toContainText('호출 단계 0')
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0)

  await enterFixtureIdea(page)
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeVisible()
})

test('375px와 desktop 모두 가로 넘침 없이 핵심 안전 상태를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(JOURNEY_URL)
  await enterFixtureIdea(page)
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeVisible()
  const audit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    noticeVisible: document.querySelector('.v03j-notice')?.getBoundingClientRect().height !== 0,
    minTarget: Math.min(...Array.from(document.querySelectorAll<HTMLElement>('button, a, textarea, .v03j-checkbox')).map((item) => item.getBoundingClientRect().height)),
  }))
  expect(audit.overflow).toBe(0)
  expect(audit.noticeVisible).toBe(true)
  expect(audit.minTarget).toBeGreaterThanOrEqual(44)

  await page.getByRole('button', { name: '수정안 적용' }).click()
  await page.getByRole('button', { name: '전략 검증하기' }).click()
  await expect(page.getByRole('heading', { name: '계약 검증 통과' })).toBeVisible()
  await page.getByRole('button', { name: '승인 절차 시작' }).click()
  await expect(page.getByRole('heading', { name: '전략 버전 생성을 명시적으로 승인해 주세요' })).toBeVisible()
  expect(await page.locator('.v03j-checkbox').evaluate((item) => item.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)

  await page.setViewportSize({ width: 1440, height: 1000 })
  const desktopAudit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    noticeVisible: document.querySelector('.v03j-notice')?.getBoundingClientRect().height !== 0,
  }))
  expect(desktopAudit).toEqual({ overflow: 0, noticeVisible: true })
})

test('muted·placeholder·disabled 텍스트가 실제 계산 색상에서 WCAG AA 대비를 충족한다', async ({ page }) => {
  await page.goto(JOURNEY_URL)
  const ratios = await page.evaluate(() => {
    const rgb = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []
    const luminance = (value: string) => {
      const channels = rgb(value).map((channel) => {
        const normalized = channel / 255
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0)
    }
    const ratio = (foreground: string, background: string) => {
      const a = luminance(foreground)
      const b = luminance(background)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    const footnote = document.querySelector<HTMLElement>('.v03j-footnote')!
    const textarea = document.querySelector<HTMLTextAreaElement>('.v03j-composer textarea')!
    const disabled = document.querySelector<HTMLButtonElement>('.v03j-primary:disabled')!
    const brand = document.querySelector<HTMLButtonElement>('.v03j-brand')!
    brand.focus()
    return {
      muted: ratio(getComputedStyle(footnote).color, getComputedStyle(document.querySelector<HTMLElement>('.v03j-shell')!).backgroundColor),
      placeholder: ratio(getComputedStyle(textarea, '::placeholder').color, getComputedStyle(document.querySelector<HTMLElement>('.v03j-composer')!).backgroundColor),
      disabled: ratio(getComputedStyle(disabled).color, getComputedStyle(disabled).backgroundColor),
      focusRing: ratio(getComputedStyle(brand).outlineColor, getComputedStyle(document.querySelector<HTMLElement>('.v03j-shell')!).backgroundColor),
      disabledOpacity: getComputedStyle(disabled).opacity,
    }
  })
  expect(ratios.muted).toBeGreaterThanOrEqual(4.5)
  expect(ratios.placeholder).toBeGreaterThanOrEqual(4.5)
  expect(ratios.disabled).toBeGreaterThanOrEqual(4.5)
  expect(ratios.focusRing).toBeGreaterThanOrEqual(3)
  expect(ratios.disabledOpacity).toBe('1')
})

test('임의 ETH·1시간 입력을 해석한 것처럼 주장하지 않고 고정 fixture를 명시한다', async ({ page }) => {
  await page.goto(JOURNEY_URL)
  await page.getByLabel('매매 전략 아이디어').fill('ETHUSDT 1시간 MACD 골든크로스 전략')
  await page.getByRole('button', { name: '전략 만들기' }).click()
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText(FIXTURE_NOTICE)
  await expect(page.getByText('아래 내용은 입력을 해석한 결과가 아닌 고정 계약 fixture입니다.')).toBeVisible()
  await expect(page.locator('.v03j-facts')).toContainText('BTCUSDT')
  await expect(page.locator('.v03j-facts')).toContainText('15m')
})

test('4000자 단일 토큰 입력도 375px에서 메시지 영역을 넘지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(JOURNEY_URL)
  await page.getByLabel('매매 전략 아이디어').fill('X'.repeat(4000))
  await page.getByRole('button', { name: '전략 만들기' }).click()
  await expect(page.getByRole('heading', { name: '전략 요약' })).toBeVisible()
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    message: Array.from(document.querySelectorAll<HTMLElement>('.v03j-message p'))
      .some((item) => item.scrollWidth > item.clientWidth),
  }))
  expect(overflow).toEqual({ page: 0, message: false })
})

test('처음부터 다시 시작하면 session과 memory audit이 초기 상태로 돌아간다', async ({ page }) => {
  await page.goto(JOURNEY_URL)
  await reachApprovedStrategy(page)
  await page.getByRole('button', { name: 'Mock 백테스트 시작' }).click()
  await expect(page.getByRole('heading', { name: '검증 결과 화면' })).toBeVisible()
  await page.getByRole('button', { name: '처음부터 다시 시작' }).click()
  await expect(page.getByRole('heading', { name: '어떤 전략을 만들고 싶으세요?' })).toBeVisible()
  await expect(page.locator('.v03j-footer')).toContainText('호출 단계 0')
  await expect(page.getByLabel('매매 전략 아이디어')).toHaveValue('')
})

test('기본 fixture URL은 기존 InternalPocApp 경로를 유지한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await expect(page.getByRole('heading', { name: /아이디어를 말하면/ })).toBeVisible()
  await expect(page.getByTestId('v03-journey')).toHaveCount(0)
})
