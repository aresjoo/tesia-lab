import { expect, test } from './legacy-fixture'

test('파비콘과 TETH 에이전트 표식은 하나의 브랜드 마크를 사용한다', async ({ page, request }) => {
  await page.goto('/')

  await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute('href', '/favicon.png')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest')

  for (const asset of ['/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/site.webmanifest']) {
    const response = await request.get(asset)
    expect(response.ok(), `${asset} 응답`).toBeTruthy()
  }

  await expect(page.locator('.tesia-brand .brand-mark .tesia-glyph')).toHaveCount(1)
  await expect(page.locator('.tesia-orb .tesia-glyph')).toHaveCount(1)
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('요즘 비트코인은 왜 오르는 거야?')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await expect(page.locator('.thinking-row .tesia-agent-avatar .tesia-glyph')).toBeVisible()
  await expect(page.locator('.unified-ai-bubble .tesia-agent-avatar .tesia-glyph').first()).toBeVisible()
})

test('TETH 전체 퍼널이 랜딩에서 실행 대시보드까지 연결된다', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /상상이 즉시 현실이 되는 거래를 위한 AI/ })).toBeVisible()
  await expect(page.getByText('결제수단 없음 · 질문과 전략 생성 무료 · MOCK')).toBeVisible()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI가 30 아래일 때 BTC를 나누어 사고 싶어')
  await page.getByRole('button', { name: '대화 시작' }).click()

  await expect(page.getByRole('heading', { name: '전략 조건 설정' })).toBeVisible()
  await expect(page.locator('#tesia-main')).toBeFocused()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await expect(page.getByText('지난 결과를 확인할 준비가 됐어요.')).toBeVisible()
  if (testInfo.project.name === 'desktop') await page.screenshot({ path: '/tmp/tesia-v1-build-desktop.png', fullPage: true })

  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await expect(page.getByRole('heading', { name: /보고서를 저장할/ })).toBeVisible()
  if (testInfo.project.name === 'desktop') await page.screenshot({ path: '/tmp/tesia-v1-signup-desktop.png', fullPage: true })

  await page.getByRole('button', { name: /Google로 계속/ }).click()
  await expect(page.getByText('BACKTEST IN PROGRESS · MOCK')).toBeVisible()
  await expect(page.getByRole('heading', { name: /기본 조건에서 검증 기준을/ })).toBeVisible({ timeout: 5_000 })
  if (testInfo.project.name === 'desktop') await page.screenshot({ path: '/tmp/tesia-v1-result-desktop.png', fullPage: true })

  await page.getByRole('button', { name: '스트레스 테스트' }).click()
  await expect(page.getByText('-3.8%')).toBeVisible()
  await expect(page.getByRole('button', { name: /수정안 적용/ })).toBeVisible()
  await page.getByRole('button', { name: '기본 시나리오' }).click()
  await page.getByRole('button', { name: /실행 환경 선택/ }).click()

  await expect(page.getByRole('heading', { name: /실행 환경을 선택하세요/ })).toBeVisible()
  await page.getByRole('radio', { name: /거래소 Gate/ }).click()
  if (testInfo.project.name === 'desktop') await page.screenshot({ path: '/tmp/tesia-v1-match-desktop.png', fullPage: true })
  await page.getByRole('button', { name: /Gate 무료 경로 확인/ }).click()

  await expect(page.getByRole('heading', { name: /Gate 연결 방식/ })).toBeVisible()
  await page.getByRole('button', { name: /직접 연결/ }).click()
  await expect(page.getByText('₩9,900', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /파트너 경로/ }).click()
  await expect(page.getByText('₩0', { exact: true })).toBeVisible()
  await expect(page.getByText(/거래 수수료 일부를 TETH가 받을 수/)).toBeVisible()
  await page.getByRole('button', { name: /Mock 가입 가이드 시작/ }).click()

  await expect(page.getByRole('heading', { name: /BTC 거래량은 늘고/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'RSI 과매도 진입형' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'API 연결' })).toBeVisible()
  await page.getByRole('button', { name: 'API 연결' }).click()
  await expect(page.getByLabel('선택된 실행 환경 Gate')).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('모바일 랜딩은 가로 오버플로 없이 첫 입력과 mock 경계를 보여준다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 프로젝트 전용')
  await page.goto('/')
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await expect(page.getByLabel('시장이나 전략에 대해 물어보세요')).toBeVisible()
  await expect(page.getByText('Enter로 시작')).toBeHidden()
  await expect(page.getByText('결제수단 없음 · 질문과 전략 생성 무료 · MOCK')).toBeVisible()
  await page.getByRole('button', { name: '대화 시작' }).click()
  await expect(page.getByRole('alert')).toHaveText('검증할 전략이나 시장 질문을 입력해주세요.')
})

test('mock 트레이더 인터뷰는 별도 선택 UI 없이 자동 롤링된다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '인터뷰 롤링 회귀 전용')
  await page.clock.install()
  await page.goto('/')

  const proof = page.locator('.landing-proof')
  await expect(proof).toContainText('김O진')
  await expect(proof.locator('.proof-controls')).toHaveCount(0)
  await expect(proof).not.toContainText('32,408')
  await expect(proof).toContainText('BETA TESTER · MOCK REVIEW')
  await page.clock.fastForward(7_600)
  await expect(proof).toContainText('박O수')

  await proof.hover()
  await page.clock.fastForward(7_600)
  await expect(proof).toContainText('박O수')
  await page.mouse.move(0, 0)
  await page.clock.fastForward(7_600)
  await expect(proof).toContainText('이O현')
})

test('트레이더 후기의 의미 구절은 화면 폭이 바뀌어도 중간에서 끊기지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '후기 반응형 타이포그래피 회귀 전용')
  await page.clock.install()
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const loadedAt = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(loadedAt + 1_000)

  const currentReview = page.locator('.proof-slide.is-current')
  const targetPhrase = currentReview.locator('.proof-phrase', { hasText: '결과가 안 좋다고' })
  await expect(currentReview).toHaveCount(1)
  await expect(currentReview.locator('.proof-count')).toHaveText('01 / 06')
  await expect(currentReview).toContainText('김O진')

  for (const width of [320, 390, 768, 1024, 1280, 1440, 1680]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(currentReview).toHaveCount(1)
    await expect(currentReview.locator('.proof-count')).toHaveText('01 / 06')
    await expect(currentReview).toContainText('김O진')
    await expect(targetPhrase).toBeAttached()
    await expect(targetPhrase).toBeVisible()

    const metrics = await currentReview.locator('.proof-quote').evaluate((element) => {
      const quote = element.querySelector('blockquote')!
      const phrase = Array.from(quote.querySelectorAll<HTMLElement>('.proof-phrase'))
        .find((node) => node.textContent === '결과가 안 좋다고')!
      const quoteRect = quote.getBoundingClientRect()
      const phraseRect = phrase.getBoundingClientRect()

      return {
        quoteOverflows: quote.scrollWidth > quote.clientWidth,
        phraseLineCount: phrase.getClientRects().length,
        phraseFitsQuote: phraseRect.width <= quoteRect.width,
        phraseWhiteSpace: getComputedStyle(phrase).whiteSpace,
      }
    })

    expect(metrics, `${width}px 후기 줄바꿈`).toEqual({
      quoteOverflows: false,
      phraseLineCount: 1,
      phraseFitsQuote: true,
      phraseWhiteSpace: 'nowrap',
    })
  }

  await page.setViewportSize({ width: 320, height: 900 })
  const reviewNames = ['김O진', '박O수', '이O현', '최O원', '정O훈', '한O서']
  for (let reviewIndex = 0; reviewIndex < 6; reviewIndex += 1) {
    await expect(currentReview).toHaveCount(1)
    await expect(currentReview.locator('.proof-count')).toHaveText(`${String(reviewIndex + 1).padStart(2, '0')} / 06`)
    await expect(currentReview).toContainText(reviewNames[reviewIndex])
    const reviewFits = await currentReview.locator('.proof-quote').evaluate((element) => {
      const quote = element.querySelector('blockquote')!
      const quoteWidth = quote.getBoundingClientRect().width
      const phrases = Array.from(quote.querySelectorAll<HTMLElement>('.proof-phrase'))
      return quote.scrollWidth <= quote.clientWidth && phrases.every((phrase) => (
        phrase.getClientRects().length === 1 && phrase.getBoundingClientRect().width <= quoteWidth
      ))
    })
    expect(reviewFits, `320px ${reviewIndex + 1}번째 후기`).toBe(true)
    if (reviewIndex < 5) await page.clock.fastForward(7_600)
  }
})

test('시장 질문은 전략 입력과 분리된 브리핑으로 안내된다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()

  await expect(page.getByText('TETH MARKET BRIEF · MOCK')).toBeVisible()
  await expect(page.getByRole('heading', { name: /아직 서두를 단계는 아니에요/ })).toBeVisible()
  await expect(page.getByText(/이해를 돕기 위한 mock 분석/)).toBeVisible()

  await page.getByRole('button', { name: 'ETH와 비교' }).click()
  await expect(page.getByRole('heading', { name: /이더리움보다 비트코인 쪽에 관심/ })).toBeVisible()
  await page.getByRole('button', { name: '무효화 가격 확인' }).click()
  await expect(page.getByRole('heading', { name: /\$64\.9K 아래/ })).toBeVisible()

  await page.getByRole('button', { name: /조건 초안 검토/ }).click()
  await expect(page.getByRole('heading', { name: '전략 조건 설정' })).toBeVisible()
  await expect(page.getByText('TETH · 이해한 내용')).toBeVisible()
  await expect(page.getByText(/이 흐름을 내 투자 기준으로/).last()).toBeVisible()
  await expect(page.getByText(/거래량이 정한 평균보다 많을 때 \+ 시장 주의 정도 40 이하/)).toBeVisible()
  await expect(page.getByLabel('전략 규칙 미리보기')).toContainText('market_risk <= 40')
  await expect(page.getByLabel('전략 규칙 미리보기')).not.toContainText('prior_high')

  await expect(page.locator('.unified-turn')).toHaveCount(3)
  await expect(page).toHaveURL(/#\/$/)

  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('시장이 상승세일 때 BTC에 진입하고 싶어')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await expect(page.getByRole('heading', { name: '전략 조건 설정' })).toBeVisible()
})

test('첫 질문과 후속 질문은 같은 대화 스테이지에서 사고·스트리밍·누적 순서로 이어진다', async ({ page }) => {
  await page.goto('/')
  const chatStage = page.locator('#tesia-main')
  await chatStage.evaluate((element) => { element.setAttribute('data-thread-identity', 'preserved') })
  const initialHash = new URL(page.url()).hash

  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('요즘 비트코인은 왜 오르는 거야?')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await expect(page.getByRole('status', { name: /시장 흐름과 관련 데이터를 살펴보고/ })).toBeVisible()
  await expect(page.locator('.unified-turn').getByText('요즘 비트코인은 왜 오르는 거야?', { exact: true })).toBeVisible()
  await expect(page.locator('.landing-pending-thread')).toHaveCount(0)

  await expect(page.locator('[data-phase="streaming"]')).toBeVisible()
  await expect(page.locator('[data-phase="streaming"] .stream-caret')).toBeVisible()
  await expect(page.locator('.unified-turn')).toHaveCount(1)
  await expect(chatStage).toHaveAttribute('data-thread-identity', 'preserved')
  expect(new URL(page.url()).hash).toBe(initialHash)

  const followup = page.getByLabel('TETH에게 이어서 질문')
  await followup.fill('RSI가 뭔지 쉽게 설명해줘')
  await followup.press('Enter')
  await expect(page.getByRole('status', { name: /시장 흐름과 관련 데이터를 살펴보고/ })).toBeVisible()
  await expect(page.locator('.unified-turn')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: /RSI는 가격이 너무 빠르게/ })).toBeVisible()
  await expect(chatStage).toHaveAttribute('data-thread-identity', 'preserved')
})

test('전략 질문 답변도 말풍선과 사고 상태를 거친 뒤 다음 질문으로 이어진다', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 아래에서 BTC를 사고 싶어')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await expect(page.getByRole('heading', { name: '어떤 코인으로 해볼까요?' })).toBeVisible()

  const composer = page.getByLabel('선택지 외 조건 직접 입력')
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await expect(page.getByText('BTC/USDT', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('status', { name: /답변을 기준에 반영하고/ })).toBeVisible()
  await expect(composer).toBeDisabled()
  await expect(page.getByRole('heading', { name: '얼마나 자주 확인할까요?' })).toBeVisible()
  await expect(composer).toBeEnabled()
})

test('투자 기초 질문은 같은 TETH 대화 안에서 매매 아이디어로 이어진다', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI가 뭐야? 초보자도 알게 설명해줘')
  await page.getByRole('button', { name: '대화 시작' }).click()

  await expect(page.getByRole('heading', { name: /RSI는 가격이 너무 빠르게/ })).toBeVisible()
  await expect(page.getByLabel('TETH 대화 메뉴').getByText('TETH와 대화 중')).toBeVisible()
  const followup = page.getByRole('textbox', { name: 'TETH에게 이어서 질문' })
  await followup.fill('그럼 RSI가 30 아래일 때 BTC를 사고 싶어')
  await page.getByRole('button', { name: '이어서 질문 보내기' }).click()

  await expect(page.getByRole('heading', { name: '전략 조건 설정' })).toBeVisible()
  await expect(page.getByLabel('TETH 대화 메뉴').getByText('TETH와 대화 중')).toBeVisible()
  await expect(page.locator('.funnel-progress')).toHaveCount(0)
})

test('취약한 전략은 실패 결과에서 AI 수정 후 재검증된다', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('BTC를 10배 레버리지로 매수하는 전략')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 3%/ }).click()
  await page.getByRole('button', { name: /RSI 30 이하/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await page.getByRole('button', { name: /Google로 계속/ }).click()

  await expect(page.getByText('-3.8%')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: /수정안 적용 후 재검증/ })).toBeVisible()
  await page.getByRole('button', { name: /수정안 적용 후 재검증/ }).click()

  await expect(page.getByText('+16.4%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('heading', { name: /하락 구간의 거래 횟수가 줄었습니다/ })).toBeVisible()
  await page.getByRole('button', { name: '스트레스 테스트' }).click()
  await expect(page.getByText(/재진입 간격을 넓혀야/)).toBeVisible()
  await expect(page.getByText(/-17\.9%에서 -8\.1%로/)).toBeVisible()
  await page.getByRole('button', { name: /수정안 적용 후 재검증/ }).click()
  await expect(page.getByText('+18.1%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /조건 다시 보기/ }).click()
  await expect(page.getByLabel('전략 규칙 미리보기')).toContainText('hours_since_stop >= 6')
})

test('로그인 사용자는 가입을 건너뛰고 새 전략에서 이전 답변이 초기화된다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await expect(page.getByRole('button', { name: '내 전략 대시보드 열기' })).toBeVisible()

  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI가 30 아래일 때 BTC를 사고 싶어')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()

  await expect(page.getByText('BACKTEST IN PROGRESS · MOCK')).toBeVisible()
  await expect(page.getByRole('heading', { name: /기본 조건에서 검증 기준을/ })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'TETH AI 홈' }).click()

  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('거래량 돌파 조건을 새로 만들고 싶어')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await expect(page.getByText(/TETH · 질문 1\/4/)).toBeVisible()
  await expect(page.getByText('지난 결과를 확인할 준비가 됐어요.')).toBeHidden()
  await expect(page.getByText('4시간봉', { exact: true })).toBeHidden()
})

test('전체 퍼널은 화면별 레이아웃·터치·Canvas 경계를 지킨다', async ({ page }) => {
  const consoleErrors: string[] = []
  const covered: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const auditScreen = async (name: string) => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    const audit = await page.evaluate(() => {
      const undersized = Array.from(document.querySelectorAll<HTMLElement>('button, a, input, textarea, [role="button"]'))
        .filter((element) => !element.closest('[inert]') && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            name: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        })
        .filter((target) => target.width < 44 || target.height < 44)
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        undersized,
        smallText: Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((element) => element.childElementCount === 0 && Boolean(element.textContent?.trim()))
          .filter((element) => !element.closest('[inert]') && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
          .map((element) => ({ text: element.textContent!.trim().replace(/\s+/g, ' ').slice(0, 42), size: Number.parseFloat(getComputedStyle(element).fontSize) }))
          .filter((item) => item.size < 11),
        unnamed: Array.from(document.querySelectorAll<HTMLElement>('button, a, input, textarea'))
          .filter((element) => !element.closest('[inert]') && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
          .filter((element) => {
            const id = element.id
            const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : ''
            return !(element.getAttribute('aria-label') || element.textContent?.trim() || label?.trim() || element.getAttribute('title'))
          })
          .map((element) => element.outerHTML.slice(0, 120)),
        duplicateIds: Array.from(document.querySelectorAll<HTMLElement>('[id]'))
          .map((element) => element.id)
          .filter((id, index, ids) => ids.indexOf(id) !== index),
      }
    })
    expect(audit.overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(0)
    expect(audit.undersized, `${name}: 44px touch targets`).toEqual([])
    expect(audit.smallText, `${name}: 11px text floor`).toEqual([])
    expect(audit.unnamed, `${name}: accessible names`).toEqual([])
    expect(audit.duplicateIds, `${name}: duplicate ids`).toEqual([])
    covered.push(name)
  }

  const expectCanvasResolution = async () => {
    const canvas = page.locator('canvas').last()
    await expect(canvas).toBeVisible()
    const size = await canvas.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { cssWidth: rect.width, cssHeight: rect.height, bitmapWidth: element.width, bitmapHeight: element.height, dpr: Math.min(window.devicePixelRatio || 1, 2) }
    })
    expect(size.bitmapWidth).toBeGreaterThanOrEqual(Math.floor(size.cssWidth * size.dpr) - 1)
    expect(size.bitmapHeight).toBeGreaterThanOrEqual(Math.floor(size.cssHeight * size.dpr) - 1)
  }

  await page.goto('/')
  await auditScreen('landing')
  await expectCanvasResolution()

  await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()
  await auditScreen('market briefing')
  await page.getByRole('button', { name: /조건 초안 검토/ }).click()
  await auditScreen('strategy builder')
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 3%/ }).click()
  await auditScreen('strategy ready')

  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await auditScreen('signup gate')
  await expectCanvasResolution()
  await page.getByRole('button', { name: /Google로 계속/ }).click()
  await auditScreen('backtest progress')
  await expect(page.getByRole('progressbar', { name: '백테스트 계산 진행률' })).toHaveAttribute('aria-valuenow', /\d+/)

  await expect(page.getByText('-3.8%')).toBeVisible({ timeout: 5_000 })
  await auditScreen('stress result')
  await expectCanvasResolution()
  await page.locator('canvas').last().hover({ position: { x: 180, y: 120 } })
  await expect(page.locator('.canvas-tooltip')).toBeVisible()
  await page.locator('canvas').last().focus()
  await page.keyboard.press('End')
  await expect(page.locator('.canvas-tooltip')).toBeVisible()

  await page.getByRole('button', { name: '추천 전략 비교' }).click()
  await auditScreen('recommended strategies')
  await page.getByRole('button', { name: /ATR 동적 손절/ }).click()
  await expect(page.getByText('+16.4%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await auditScreen('retested result')
  await page.getByRole('button', { name: /실행 환경 선택/ }).click()
  await auditScreen('execution match')
  await page.getByRole('radio', { name: /거래소 Gate/ }).click()
  await page.getByRole('button', { name: /Gate 무료 경로 확인/ }).click()
  await auditScreen('pricing onboarding')
  await page.getByRole('button', { name: /Mock 가입 가이드 시작/ }).click()
  await auditScreen('dashboard and reporting')
  await page.getByRole('button', { name: /BTC Bitcoin/ }).click()
  await expect(page.locator('.dashboard-conversation')).toBeVisible()
  await auditScreen('dashboard analysis')

  expect(covered).toEqual([
    'landing', 'market briefing', 'strategy builder', 'strategy ready', 'signup gate', 'backtest progress',
    'stress result', 'recommended strategies', 'retested result', 'execution match', 'pricing onboarding', 'dashboard and reporting',
    'dashboard analysis',
  ])
  expect(consoleErrors).toEqual([])
})

test('대시보드 Composer와 숫자 타이포는 뷰포트별 구조 경계를 지킨다', async ({ page }, testInfo) => {
  const originalViewport = page.viewportSize()!
  await page.goto('/')

  if (testInfo.project.name === 'mobile') {
    await page.setViewportSize({ width: 1024, height: 900 })
  }
  await page.getByRole('button', { name: /대시보드 미리보기/ }).click()
  if (testInfo.project.name === 'mobile') {
    await page.setViewportSize(originalViewport)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.evaluate(() => document.fonts.ready)

  const audit = await page.evaluate(() => {
    const icon = document.querySelector<HTMLElement>('.ask-icon')!.getBoundingClientRect()
    const input = document.querySelector<HTMLTextAreaElement>('.ask-input-row textarea')!.getBoundingClientRect()
    const metric = getComputedStyle(document.querySelector<HTMLElement>('.metric-grid strong')!)
    const score = getComputedStyle(document.querySelector<HTMLElement>('.regime-score')!)
    const overlaps = !(icon.right <= input.left || input.right <= icon.left || icon.bottom <= input.top || input.bottom <= icon.top)
    const main = document.querySelector<HTMLElement>('.app-shell > main')!.getBoundingClientRect()
    const bottomNavElement = document.querySelector<HTMLElement>('.bottom-nav')
    const bottomNav = bottomNavElement?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      ? bottomNavElement.getBoundingClientRect()
      : null
    return {
      overlaps,
      iconPosition: getComputedStyle(document.querySelector<HTMLElement>('.ask-icon')!).position,
      geistLoaded: document.fonts.check('16px "Geist Variable"'),
      metricFamily: metric.fontFamily,
      metricSpacing: Number.parseFloat(metric.letterSpacing),
      scoreSpacing: Number.parseFloat(score.letterSpacing),
      mobileNavSeparation: bottomNav ? bottomNav.top - main.bottom : 0,
    }
  })

  expect(audit.overlaps).toBe(false)
  expect(audit.iconPosition).toBe('static')
  expect(audit.geistLoaded).toBe(true)
  expect(audit.metricFamily).toContain('Geist Variable')
  expect(audit.metricSpacing).toBeGreaterThanOrEqual(-0.6)
  expect(audit.scoreSpacing).toBeGreaterThanOrEqual(-0.6)
  expect(audit.mobileNavSeparation).toBeGreaterThanOrEqual(0)

  const questionInput = page.getByRole('textbox', { name: 'TETH에게 무엇이든 물어보세요' })
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '질문', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'TETH에게 질문' }).first().click()
  }
  await expect(questionInput).toBeFocused()
})

test('파트너 노출은 제거되고 직접 입력은 조건 맥락에 맞게 저장된다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('BACKED BY', { exact: true })).toHaveCount(0)
  await expect(page.getByText('tetherMax', { exact: true })).toHaveCount(0)
  await expect(page.getByText('INVESTING 101', { exact: true })).toHaveCount(0)

  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('거래량이 늘면 분할 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  const directInput = page.getByRole('textbox', { name: '선택지 외 조건 직접 입력' })
  await expect(page.getByRole('button', { name: '답변 보내기' })).toBeDisabled()

  await directInput.fill('ATR 1.5배 손절')
  await page.keyboard.press('Enter')
  await expect(page.getByText('ATR 1.5배', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/TETH · 질문 1\/4/)).toBeVisible()

  await directInput.fill('BTC/USDT')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/TETH · 질문 2\/4/)).toBeVisible()
  await directInput.fill('4시간봉')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/TETH · 질문 4\/4/)).toBeVisible()
  await directInput.fill('거래량 20일 평균 상회')
  await page.keyboard.press('Enter')
  await expect(page.getByText('지난 결과를 확인할 준비가 됐어요.')).toBeVisible()

  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('거래량이 늘면 분할 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  const multiSlotInput = page.getByRole('textbox', { name: '선택지 외 조건 직접 입력' })
  await multiSlotInput.fill('BTC 4시간봉 자산 1%, 거래량이 20일 평균을 넘으면 진입')
  await page.keyboard.press('Enter')
  await expect(page.getByText('지난 결과를 확인할 준비가 됐어요.')).toBeVisible()
  await expect(page.locator('.inline-strategy-card')).toContainText('BTC/USDT')
  await expect(page.locator('.inline-strategy-card')).toContainText('4시간봉')
  await expect(page.locator('.inline-strategy-card')).toContainText('자산의 1%')
})

test('거래소 패널은 닫힌 뒤 호출 버튼으로 포커스를 복원한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '데스크톱 포커스 회귀 전용')
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByRole('button', { name: '내 전략 대시보드 열기' }).click()
  const trigger = page.getByRole('button', { name: 'API 연결' })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: '연결 패널 닫기' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.locator('.drawer-scrim').click({ position: { x: 8, y: 8 } })
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('button', { name: '연결 패널 닫기' }).click()
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('거래소 패널의 샘플 연결과 해제는 키보드·터치 경계를 지킨다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByRole('button', { name: '내 전략 대시보드 열기' }).click()
  await page.getByRole('button', { name: 'API 연결' }).click()
  await expect(page.getByLabel('선택된 실행 환경 Binance')).toBeVisible()
  await page.getByRole('button', { name: /Mock 연결 확인/ }).click()
  await expect(page.getByRole('alert')).toHaveText('API Key와 Secret Key를 모두 입력해주세요.')
  await expect(page.getByLabel('API Key', { exact: true })).toBeFocused()
  await page.getByRole('button', { name: /체험용 샘플 키/ }).click()
  await page.getByRole('button', { name: /Mock 연결 확인/ }).click()
  await expect(page.getByRole('heading', { name: /Binance Mock가 연결/ })).toBeVisible()

  const undersized = await page.locator('.connection-drawer').evaluate((drawer) =>
    Array.from(drawer.querySelectorAll<HTMLElement>('button, input'))
      .filter((element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return { name: (element.getAttribute('aria-label') || element.textContent || '').trim(), width: rect.width, height: rect.height }
      })
      .filter((target) => target.width < 44 || target.height < 44),
  )
  expect(undersized).toEqual([])
  await page.getByRole('button', { name: '연결 해제' }).click()
  await expect(page.getByRole('button', { name: /Mock 연결 확인/ })).toBeVisible()
})

test('대시보드 질문은 자산과 의도에 맞는 브리핑으로 바뀐다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByRole('button', { name: '내 전략 대시보드 열기' }).click()

  await page.getByRole('button', { name: '질문 보내기' }).click()
  await expect(page.getByRole('alert')).toHaveText('분석할 시장 질문을 입력해주세요.')
  await expect(page.getByRole('textbox', { name: 'TETH에게 무엇이든 물어보세요' })).toBeFocused()

  await page.getByRole('button', { name: /이번 주 변동성이 커진 자산은/ }).click()
  await expect(page.getByText(/SOL의 변동성 확대가 가장 컸습니다/)).toBeVisible()

  await page.getByRole('button', { name: /ETH Ethereum/ }).click()
  await expect(page.getByText(/ETH 거래량은 20일 평균보다 6\.2%/)).toBeVisible()

  await page.getByRole('button', { name: /BTC Bitcoin/ }).click()
  await expect(page.getByText(/BTC 거래량은 20일 평균보다 18\.4%/)).toBeVisible()
  await expect(page.getByText(/현재 변동성은 중간 구간/)).toBeVisible()

  await page.getByRole('button', { name: /XRP/ }).click()
  await expect(page.getByText(/XRP 거래량은 20일 평균보다 1\.7%/)).toBeVisible()

  await page.getByRole('button', { name: '어디서 흐름이 깨져?' }).click()
  await expect(page.getByText(/\$64\.9K를 종가로 이탈하면/)).toBeVisible()

  await page.getByRole('button', { name: /전체 시장 비교/ }).click()
  await expect(page.getByText(/주요 자산 중에는 BTC의 거래량 회복이 가장 뚜렷/)).toBeVisible()
})

test('선택한 자산과 주기는 실행 비교와 대시보드까지 유지된다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '조건 전파 회귀 전용')
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('SOL의 거래량 회복 전략을 만들고 싶어')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /SOL\/USDT/ }).click()
  await page.getByRole('button', { name: /1시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /거래량 20일 평균/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await expect(page.getByText('+16.1%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /실행 환경 선택/ }).click()
  await expect(page.getByText('SOL/USDT · 1H · 낮은 수수료')).toBeVisible()
  await page.getByRole('button', { name: /Binance 무료 경로 확인/ }).click()
  await page.getByRole('button', { name: /Mock 가입 가이드 시작/ }).click()
  await expect(page.getByRole('heading', { name: /SOL 거래량은 평균 아래고/ })).toBeVisible()
  await expect(page.getByText('SOL/USDT · 1시간봉 · 자산의 2%')).toBeVisible()
})

test('감소 모션과 감소 투명도 환경에서도 정보와 Canvas가 안정적이다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '환경 설정 회귀 전용')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const liquidCanvas = page.locator('.imagination-canvas')
  await expect(liquidCanvas).toBeVisible()
  const firstFrame = await liquidCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
  await page.waitForTimeout(120)
  const secondFrame = await liquidCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
  expect(secondFrame).toBe(firstFrame)

  const motionAudit = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('.landing-composer button')!
    const style = getComputedStyle(button)
    return { transitionDuration: style.transitionDuration, animationDuration: style.animationDuration }
  })
  expect(Number.parseFloat(motionAudit.transitionDuration)).toBeLessThanOrEqual(0.01)

  const materialAudit = await page.evaluate(() => {
    const reducedTransparencyRules = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try { return Array.from(sheet.cssRules) } catch { return [] }
      })
      .filter((rule) => rule.cssText.includes('prefers-reduced-transparency'))
      .map((rule) => rule.cssText)
    return {
      queryPresent: reducedTransparencyRules.length > 0,
      removesGlassFilter: reducedTransparencyRules.some((rule) =>
        rule.includes('.tesia-header') && rule.includes('backdrop-filter: none'),
      ),
      preservesOpaqueSurface: reducedTransparencyRules.some((rule) =>
        rule.includes('.landing-composer') && rule.includes('background:'),
      ),
    }
  })
  expect(materialAudit).toEqual({ queryPresent: true, removesGlassFilter: true, preservesOpaqueSurface: true })

  await page.evaluate(() => {
    const original = window.scrollTo.bind(window)
    ;(window as typeof window & { __tesiaScrollBehaviors?: string[] }).__tesiaScrollBehaviors = []
    window.scrollTo = ((options: ScrollToOptions) => {
      ;(window as typeof window & { __tesiaScrollBehaviors?: string[] }).__tesiaScrollBehaviors?.push(String(options?.behavior ?? 'auto'))
      original(options)
    }) as typeof window.scrollTo
  })
  await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()
  const scrollBehaviors = await page.evaluate(() => (window as typeof window & { __tesiaScrollBehaviors?: string[] }).__tesiaScrollBehaviors ?? [])
  expect(scrollBehaviors).not.toContain('smooth')
})

test('결과 카드와 Canvas 마지막 수치는 같은 시계열을 사용한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '수치 정합성 회귀 전용')
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 이하에서 BTC를 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  const replayShell = page.locator('.cinematic-backtest .equity-canvas-shell')
  await expect(replayShell).toHaveAttribute('data-reveal-state', 'playing')
  await expect(replayShell).toHaveAttribute('data-vfx', 'volume-execution-pulses')
  await expect(page.locator('[data-component="executionToast"]')).toBeVisible()
  await page.getByRole('button', { name: /백테스트 재생 건너뛰기/ }).click()
  const metric = page.locator('.result-metrics > div').first().locator('strong')
  await expect(metric).toHaveText('+21.7%', { timeout: 5_000 })
  const chartShell = page.locator('.equity-canvas-shell')
  await expect(chartShell).toHaveAttribute('data-vfx', 'volume-execution-pulses')
  await expect(chartShell).toHaveAttribute('data-checkpoint-values', '+9.8%,+16.3%,+21.7%')
  await expect(chartShell).toHaveAttribute('data-reveal-state', 'complete', { timeout: 5_000 })
  const chart = page.locator('.equity-result-canvas')
  await chart.focus()
  await page.keyboard.press('End')
  await expect(page.locator('.canvas-tooltip strong')).toHaveText(await metric.textContent() ?? '')
  await expect(page.locator('.canvas-tooltip small')).toHaveText('BTC +13.1%')
})

test('재생 중 OHLC와 거래량은 현재 mock 캔들과 함께 갱신된다', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.evaluate(() => {
    const observedIndices: string[] = []
    ;(window as typeof window & { __tethObservedCandleIndices?: string[] }).__tethObservedCandleIndices = observedIndices
    const attach = (quote: Element) => {
      const record = () => {
        const index = (quote as HTMLElement).dataset.candleIndex
        if (index !== undefined && observedIndices.at(-1) !== index) observedIndices.push(index)
      }
      record()
      new MutationObserver(record).observe(quote, { attributes: true, attributeFilter: ['data-candle-index'] })
    }
    const existing = document.querySelector('.replay-quote-line')
    if (existing) attach(existing)
    new MutationObserver(() => {
      const quote = document.querySelector('.replay-quote-line')
      if (quote && !quote.hasAttribute('data-test-observed')) {
        quote.setAttribute('data-test-observed', 'true')
        attach(quote)
      }
    }).observe(document.body, { childList: true, subtree: true })
  })
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 이하에서 BTC를 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /2시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()

  const quote = page.locator('.replay-quote-line')
  const ohlc = page.locator('.mock-ohlc')
  await expect(quote).toHaveAttribute('data-candle-index', /\d+/)
  await expect.poll(async () => page.evaluate(() =>
    (window as typeof window & { __tethObservedCandleIndices?: string[] }).__tethObservedCandleIndices?.length ?? 0
  )).toBeGreaterThan(1)
  const snapshot = await quote.evaluate((element) => ({
    open: Number((element as HTMLElement).dataset.candleOpen),
    high: Number((element as HTMLElement).dataset.candleHigh),
    low: Number((element as HTMLElement).dataset.candleLow),
    close: Number((element as HTMLElement).dataset.candleClose),
    volume: Number((element as HTMLElement).dataset.candleVolume),
    change: Number((element as HTMLElement).dataset.candleChange),
  }))
  expect(snapshot.high).toBeGreaterThanOrEqual(Math.max(snapshot.open, snapshot.close))
  expect(snapshot.low).toBeLessThanOrEqual(Math.min(snapshot.open, snapshot.close))
  expect(snapshot.volume).toBeGreaterThan(0)
  expect(snapshot.change).toBeCloseTo(((snapshot.close - snapshot.open) / snapshot.open) * 100, 5)
  await expect(page.locator('.trade-toolbar .active-timeframe')).toHaveText('2h')
  if (testInfo.project.name === 'mobile') {
    await expect(ohlc.locator('strong')).toHaveText(/C\d{2,3}(?:,\d{3})*\.\d/)
  } else {
    await expect(ohlc.locator('.mock-volume')).toBeVisible()
    await expect(ohlc.locator('.mock-volume')).toContainText('V')
  }
})

test('지원하지 않는 시간봉은 4시간봉으로 바꾸지 않고 같은 대화에서 다시 묻는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '시간봉 입력 경계 전용')
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 이하에서 BTC를 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByLabel('선택지 외 조건 직접 입력').fill('30분봉')
  await page.getByRole('button', { name: '답변 보내기' }).click()

  await expect(page.locator('.build-error')).toContainText('현재 Mock에서는 15분봉, 1시간봉, 2시간봉, 4시간봉, 일봉을 지원해요.')
  await expect(page.getByRole('heading', { name: '얼마나 자주 확인할까요?' })).toBeVisible()
  await expect(page.getByText('4시간봉', { exact: true })).toHaveCount(1)
  await page.getByLabel('선택지 외 조건 직접 입력').fill('2시간마다')
  await page.getByRole('button', { name: '답변 보내기' }).click()
  await expect(page.getByText('2시간봉', { exact: true }).first()).toBeVisible()
})

test('재생 중 화면 폭이 바뀌어도 캔들 인덱스는 처음으로 되감기지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '재생 리사이즈 연속성 전용')
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 이하에서 BTC를 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /2시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()

  const quote = page.locator('.replay-quote-line')
  await expect.poll(async () => Number(await quote.getAttribute('data-candle-index'))).toBeGreaterThan(12)
  const beforeResize = Number(await quote.getAttribute('data-candle-index'))
  const executionToast = page.locator('.execution-toast')
  await expect(executionToast).toBeVisible()
  const chartShell = page.locator('.equity-canvas-shell.cinematic')
  const executionBeforeResize = Number(await chartShell.getAttribute('data-execution-index'))
  await page.setViewportSize({ width: 820, height: 900 })
  await expect.poll(async () => Number(await quote.getAttribute('data-candle-index'))).toBeGreaterThanOrEqual(beforeResize)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(executionToast).toBeVisible()
  expect(Number(await chartShell.getAttribute('data-execution-index'))).toBeGreaterThanOrEqual(executionBeforeResize)

  const layout = await page.evaluate(() => {
    const lead = document.querySelector<HTMLElement>('.replay-quote-line > div:first-child')!.getBoundingClientRect()
    const values = document.querySelector<HTMLElement>('.mock-ohlc')!.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      separated: lead.right <= values.left,
    }
  })
  expect(layout).toEqual({ overflow: 0, separated: true })
})

test('1시간봉, 2시간봉, 4시간봉은 서로 다른 mock 결과와 캔들 구성을 사용한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '시간봉 데이터 의미 회귀 전용')
  const observations: Array<{ timeframe: string; seriesEnd: string | null; bars: string | null; result: string; winRate: string; trades: string }> = []

  for (const timeframe of ['1시간봉', '2시간봉', '4시간봉']) {
    await page.goto('/')
    await page.evaluate((selectedTimeframe) => {
      sessionStorage.setItem('tesia-funnel-session-v1', JSON.stringify({
        view: 'result',
        idea: 'RSI 30 이하에서 BTC를 매수',
        ideaSource: 'user',
        suggestedCondition: '',
        entryRule: '',
        briefingVariant: 'overview',
        buildStep: 3,
        answers: { market: 'BTC/USDT', timeframe: selectedTimeframe, risk: '자산의 2%' },
        resultMode: 'base',
        selectedRepair: null,
        selectedBroker: 'binance',
        executionPath: 'partner',
        signedIn: true,
        retryCount: 0,
        repairBaseline: null,
      }))
      window.location.hash = '#/result'
    }, timeframe)
    await page.reload()

    const shell = page.locator('.result-chart .equity-canvas-shell')
    await expect(shell).toHaveAttribute('data-reveal-state', 'complete')
    const metrics = page.locator('.result-metrics > div')
    observations.push({
      timeframe,
      seriesEnd: await shell.getAttribute('data-series-end'),
      bars: await shell.getAttribute('data-market-bars'),
      result: await metrics.nth(0).locator('strong').innerText(),
      winRate: await metrics.nth(1).locator('strong').innerText(),
      trades: await metrics.nth(3).locator('strong').innerText(),
    })
  }

  expect(new Set(observations.map((item) => item.seriesEnd)).size).toBe(3)
  expect(new Set(observations.map((item) => item.bars)).size).toBe(3)
  expect(new Set(observations.map((item) => item.result)).size).toBe(3)
  expect(new Set(observations.map((item) => item.winRate)).size).toBe(3)
  expect(new Set(observations.map((item) => item.trades)).size).toBe(3)
})

test('백테스트 실행 피드와 차트 라벨은 모든 화면에서 서로 침범하지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 이하에서 BTC를 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await expect(page.locator('[data-component="executionToast"]')).toBeVisible()

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
    const toast = rect('.execution-toast')
    const returnLabel = rect('.chart-return-label')
    const scaleLabel = rect('.chart-scale-label')
    const canvas = rect('.equity-result-canvas')
    const title = rect('.replay-header h1')
    const skip = rect('.replay-skip')
    const titleSkipOverlap = !(title.right <= skip.left || skip.right <= title.left || title.bottom <= skip.top || skip.bottom <= title.top)
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      eventRailClearance: Math.min(returnLabel.top, scaleLabel.top) - toast.bottom,
      labelCanvasDelta: Math.abs(returnLabel.top - canvas.top),
      titleSkipOverlap,
    }
  })

  expect(layout.overflow).toBeLessThanOrEqual(0)
  expect(layout.eventRailClearance).toBeGreaterThanOrEqual(6)
  expect(layout.labelCanvasDelta).toBeLessThanOrEqual(1)
  expect(layout.titleSkipOverlap).toBe(false)
})

test('세 추천 수정안은 카드에 약속한 서로 다른 결과를 재현한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '추천 결과 정합성 회귀 전용')
  test.setTimeout(60_000)
  const scenarios = [
    { name: /ATR 동적 손절/, returnRate: '+16.4%', drawdown: '-7.3%' },
    { name: /하락장 필터/, returnRate: '+13.8%', drawdown: '-6.3%' },
    { name: /재진입 쿨다운/, returnRate: '+18.1%', drawdown: '-8.1%' },
  ]

  for (const scenario of scenarios) {
    await page.goto('/')
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()
    await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
    await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('BTC를 10배 레버리지로 매수')
    await page.getByRole('button', { name: '대화 시작' }).click()
    await page.getByRole('button', { name: /BTC\/USDT/ }).click()
    await page.getByRole('button', { name: /4시간봉/ }).click()
    await page.getByRole('button', { name: /자산의 3%/ }).click()
    await page.getByRole('button', { name: /RSI 30 이하/ }).click()
    await page.getByRole('button', { name: /백테스트 시작/ }).click()
    await expect(page.getByText('-3.8%', { exact: true })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: '추천 전략 비교' }).click()
    await page.getByRole('button', { name: scenario.name }).click()
    await expect(page.getByText(scenario.returnRate, { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(scenario.drawdown, { exact: true })).toBeVisible()
    if (scenario.returnRate !== '+16.4%') {
      await page.getByRole('button', { name: '스트레스 테스트' }).click()
      await page.getByRole('button', { name: '추천 전략 비교' }).click()
      await page.getByRole('button', { name: scenario.name }).click()
      await expect(page.getByText(scenario.returnRate, { exact: true })).toBeVisible({ timeout: 5_000 })
    }
    if (scenario.returnRate === '+18.1%') {
      await page.getByRole('button', { name: '스트레스 테스트' }).click()
      await page.getByRole('button', { name: '추천 전략 비교' }).click()
      await page.getByRole('button', { name: /하락장 필터/ }).click()
      await expect(page.getByText('+13.8%', { exact: true })).toBeVisible({ timeout: 5_000 })
    }
    await page.getByRole('button', { name: /조건 다시 보기/ }).click()
    if (scenario.returnRate === '+16.4%') await expect(page.getByLabel('전략 규칙 미리보기')).toContainText('STOP atr(14) * 1.6')
    if (scenario.returnRate === '+13.8%') {
      const code = await page.getByLabel('전략 규칙 미리보기').textContent() ?? ''
      expect(code.match(/btc_close > sma\(btc_close, 200\)/g)).toHaveLength(1)
    }
    if (scenario.returnRate === '+18.1%') {
      const code = await page.getByLabel('전략 규칙 미리보기').textContent() ?? ''
      expect(code.match(/btc_close > sma\(btc_close, 200\)/g)).toHaveLength(1)
      expect(code).not.toContain('hours_since_stop >= 6')
    }
  }
})

test('브리핑 선택 상태·대시보드 차트·위험 고지는 키보드로 확인된다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '키보드 및 정책 경로 회귀 전용')
  await page.goto('/')
  await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()
  const invalidation = page.getByRole('button', { name: '무효화 가격 확인' })
  const comparison = page.getByRole('button', { name: 'ETH와 비교' })
  await invalidation.click()
  await expect(invalidation).toHaveAttribute('aria-pressed', 'true')
  const pressedStyles = await Promise.all([invalidation, comparison].map((locator) => locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, weight: style.fontWeight }
  })))
  expect(pressedStyles[0]).not.toEqual(pressedStyles[1])

  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByRole('button', { name: '내 전략 대시보드 열기' }).click()
  const dashboardChart = page.locator('.equity-chart svg')
  await dashboardChart.focus()
  await page.keyboard.press('End')
  await expect(page.locator('.dashboard-chart-tooltip')).toContainText('전략 +14.2%')

  const riskDisclosure = page.getByRole('button', { name: '위험 고지' })
  await riskDisclosure.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: /과거 결과는 미래 수익을 보장하지/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(riskDisclosure).toBeFocused()
  await riskDisclosure.click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(riskDisclosure).toBeFocused()
})

test('320px 빌더는 선택지와 직접 입력에서 가로 오버플로가 없다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '초소형 뷰포트 회귀 전용')
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()
  await page.getByRole('button', { name: /조건 초안 검토/ }).click()
  for (const state of ['timeframe', 'risk']) {
    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      answerRight: Math.max(...Array.from(document.querySelectorAll('.unified-choice-row button')).map((element) => element.getBoundingClientRect().right)),
      undersized: Array.from(document.querySelectorAll<HTMLElement>('.unified-choice-row button'))
        .map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
        .filter((button) => button.width < 44 || button.height < 44),
    }))
    expect(audit.overflow, `${state}: horizontal overflow`).toBeLessThanOrEqual(0)
    expect(audit.answerRight, `${state}: answer edge`).toBeLessThanOrEqual(320)
    expect(audit.undersized, `${state}: 44px answers`).toEqual([])
    await page.getByRole('button', { name: state === 'timeframe' ? /4시간봉/ : /자산의 2%/ }).click()
  }

  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('BTC 전략을 만들어줘')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await expect(page.getByRole('heading', { name: '언제 사고 싶나요?' })).toBeInViewport()
  const entryAudit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    labels: Array.from(document.querySelectorAll<HTMLElement>('.unified-choice-row button')).map((button) => ({ text: button.innerText, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, scrollWidth: button.scrollWidth })),
  }))
  expect(entryAudit.overflow, 'entry clarification: horizontal overflow').toBeLessThanOrEqual(0)
  expect(entryAudit.labels.filter((button) => button.scrollWidth > button.width + 1)).toEqual([])
  expect(entryAudit.labels.filter((button) => button.width < 44 || button.height < 44)).toEqual([])

  for (const width of [360, 361]) {
    await page.setViewportSize({ width, height: 900 })
    const boundary = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      buttons: Array.from(document.querySelectorAll<HTMLElement>('.unified-choice-row button')).map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, scrollWidth: button.scrollWidth })),
    }))
    expect(boundary.overflow, `${width}px entry clarification: horizontal overflow`).toBeLessThanOrEqual(0)
    expect(boundary.buttons.filter((button) => button.scrollWidth > button.width + 1 || button.width < 44 || button.height < 44)).toEqual([])
  }
})

test('주요 퍼널 CTA는 데스크톱 hover와 pressed 피드백이 연속된다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '정밀 포인터 상호작용 회귀 전용')
  const expectHoverFeedback = async (locator: ReturnType<typeof page.locator>) => {
    // A preceding click can leave the physical pointer on the CTA.  Start from
    // an explicitly unhovered state so this checks the visual transition.
    await page.mouse.move(0, 0)
    await expect.poll(() => locator.evaluate((element) => element.matches(':hover'))).toBe(false)
    const snapshot = async () => locator.evaluate((element) => {
      const style = getComputedStyle(element)
      return { border: style.borderColor, shadow: style.boxShadow, transform: style.transform }
    })
    const rest = await snapshot()
    await locator.hover()
    await page.waitForTimeout(190)
    const hover = await snapshot()
    expect(hover).not.toEqual(rest)
  }

  await page.goto('/')
  await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()
  const briefingCta = page.getByRole('button', { name: /조건 초안 검토/ })
  await expectHoverFeedback(briefingCta)
  await briefingCta.click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  const backtestCta = page.getByRole('button', { name: /백테스트 시작/ })
  await expectHoverFeedback(backtestCta)
  await backtestCta.click()
  await page.getByRole('button', { name: /Google로 계속/ }).click()
  await expect(page.getByText('+21.7%', { exact: true })).toBeVisible({ timeout: 5_000 })
  const resultCta = page.getByRole('button', { name: /실행 환경 선택/ })
  await expectHoverFeedback(resultCta)
  await resultCta.click()
  const matchCta = page.getByRole('button', { name: /Binance 무료 경로 확인/ })
  await expectHoverFeedback(matchCta)
  await matchCta.click()
  await expectHoverFeedback(page.getByRole('button', { name: /Mock 가입 가이드 시작/ }))
})

test('Liquid Glass는 떠 있는 정보 표면에만 적용된다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '재질 계층 회귀 전용')
  await page.goto('/')
  const landingMaterial = await page.evaluate(() => ({
    header: getComputedStyle(document.querySelector<HTMLElement>('.tesia-header')!).backdropFilter,
    nestedLogin: getComputedStyle(document.querySelector<HTMLElement>('.login-button')!).backdropFilter,
  }))
  expect(landingMaterial.header).not.toBe('none')
  expect(landingMaterial.nestedLogin).toBe('none')

  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 이하에서 BTC 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  const lockedPreviewFilter = await page.locator('.preview-lock').evaluate((element) => getComputedStyle(element).backdropFilter)
  expect(lockedPreviewFilter).not.toBe('none')

  await page.getByRole('button', { name: /Google로 계속/ }).click()
  await expect(page.getByText('+21.7%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('.result-mode')).toHaveCSS('backdrop-filter', 'none')

  await page.getByRole('button', { name: /실행 환경 선택/ }).click()
  await page.getByRole('button', { name: /Binance 무료 경로 확인/ }).click()
  await page.getByRole('button', { name: /Mock 가입 가이드 시작/ }).click()
  await page.getByRole('button', { name: 'API 연결' }).click()
  const overlayMaterial = await page.evaluate(() => ({
    drawer: getComputedStyle(document.querySelector<HTMLElement>('.connection-drawer')!).backdropFilter,
    scrim: getComputedStyle(document.querySelector<HTMLElement>('.drawer-scrim')!).backdropFilter,
    interactiveAsk: getComputedStyle(document.querySelector<HTMLElement>('.ask-glass')!).backdropFilter,
  }))
  expect(overlayMaterial.drawer).not.toBe('none')
  expect(overlayMaterial.scrim).not.toBe('none')
  expect(overlayMaterial.interactiveAsk).not.toBe('none')
})

test('브로커 radiogroup은 방향키로 이동하고 Alpaca 직접 경로를 연다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '실행 환경 키보드 회귀 전용')
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('RSI 30 이하에서 BTC 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await expect(page.getByText('+21.7%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /실행 환경 선택/ }).click()

  const binance = page.getByRole('radio', { name: /Binance/ })
  const gate = page.getByRole('radio', { name: /Gate/ })
  const alpaca = page.getByRole('radio', { name: /Alpaca/ })
  await binance.focus()
  await page.keyboard.press('ArrowDown')
  await expect(gate).toBeFocused()
  await expect(gate).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('End')
  await expect(alpaca).toBeFocused()
  await expect(alpaca).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: /Alpaca 월간 구독 확인/ }).click()
  await expect(page.getByRole('heading', { name: 'Alpaca 월간 실행 계획' })).toBeVisible()
  await expect(page.getByText('₩29,000', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mock 구독 확인' }).click()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.getByRole('button', { name: 'API 연결' }).click()
  await expect(page.getByLabel('선택된 실행 환경 Alpaca')).toBeVisible()
})

test('해시 딥링크와 새로고침은 안전한 화면과 전략 상태를 복구한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '세션 복구 회귀 전용')
  await page.goto('/#/dashboard')
  await expect(page.locator('.app-shell')).toBeVisible()
  await expect(page).toHaveURL(/#\/dashboard$/)

  await page.goto('/')
  const login = page.getByRole('button', { name: 'Mock 계정으로 로그인' })
  if (await login.isVisible()) await login.click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('SOL 거래량 회복 전략')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /SOL\/USDT/ }).click()
  await page.getByRole('button', { name: /1시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /거래량 20일 평균/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await expect(page.getByText('+16.1%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await page.goBack()
  await expect(page.getByRole('heading', { name: '전략 조건 설정' })).toBeVisible()
  await page.goForward()
  await expect(page.getByText('+16.1%', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('+16.1%', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /조건 다시 보기/ }).click()
  await expect(page.getByText('SOL/USDT', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1시간봉', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('자산의 2%', { exact: true }).first()).toBeVisible()
})

test('전략 복사 권한이 거부되면 조용히 실패하지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '클립보드 오류 회귀 전용')
  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('BTC 거래량 증가 시 매수')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('denied') } },
    })
  })
  await page.getByRole('button', { name: '전략 복사' }).click()
  await expect(page.getByRole('status').filter({ hasText: '복사 권한을 확인한 뒤 다시 시도해주세요.' })).toBeVisible()
  await expect(page.getByRole('button', { name: '전략 복사 실패, 다시 시도' })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    })
  })
  await page.getByRole('button', { name: '전략 복사 실패, 다시 시도' }).click()
  await expect(page.getByRole('status').filter({ hasText: '전략 규칙을 클립보드에 복사했습니다.' })).toBeVisible()
  await expect(page.getByRole('button', { name: '전략 복사 완료' })).toBeVisible()
})

test('진입 신호가 없는 아이디어는 임의 규칙을 만들지 않고 한 번 더 묻는다', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('BTC 전략을 하나 만들어줘')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await expect(page.getByText(/TETH · 질문 4\/4/)).toBeVisible()
  await expect(page.getByRole('heading', { name: '언제 사고 싶나요?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /백테스트 시작/ })).toHaveCount(0)
  await expect(page.getByLabel('전략 규칙 미리보기')).not.toContainText('prior_high')
  await page.getByRole('button', { name: /RSI 30 이하/ }).click()
  await expect(page.getByText('지난 결과를 확인할 준비가 됐어요.')).toBeVisible()
  await expect(page.getByLabel('전략 규칙 미리보기')).toContainText('rsi(14) < 30')
  await expect(page.getByRole('button', { name: /백테스트 시작/ })).toBeVisible()

  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('20일 평균 거래량을 넘으면 BTC에 진입')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await expect(page.getByText(/TETH · 질문 1\/3/)).toBeVisible()
  await expect(page.getByLabel('전략 규칙 미리보기')).toContainText('volume > user_volume_baseline')
})

test('본문 바로가기는 첫 화면과 딥링크 대시보드에서 실제 본문에 포커스한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '스킵 링크 키보드 회귀 전용')
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '본문으로 바로가기' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#tesia-main')).toBeFocused()

  const dashboardPage = await page.context().newPage()
  await dashboardPage.goto('/?legacy-fixture=1#/dashboard')
  await expect(dashboardPage.locator('#main')).toBeVisible()
  await dashboardPage.keyboard.press('Tab')
  await expect(dashboardPage.getByRole('link', { name: '본문으로 바로가기' })).toBeFocused()
  await dashboardPage.keyboard.press('Enter')
  await expect(dashboardPage.locator('#main')).toBeFocused()
  await dashboardPage.close()
})

test('전략과 Mock API 입력은 사용자 동작 중 외부 요청을 만들지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '개인정보 경계 회귀 전용')
  const actionRequests: Array<{ method: string; url: string }> = []
  let capture = false
  page.on('request', (request) => {
    if (capture) actionRequests.push({ method: request.method(), url: request.url() })
  })
  await page.goto('/')
  capture = true
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('BTC 거래량 회복 전략')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /거래량 20일 평균/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await expect(page.getByText('+21.7%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /실행 환경 선택/ }).click()
  await page.getByRole('button', { name: /Binance 무료 경로 확인/ }).click()
  await page.getByRole('button', { name: /Mock 가입 가이드 시작/ }).click()
  await page.getByRole('button', { name: 'API 연결' }).click()
  await page.getByRole('button', { name: /체험용 샘플 키/ }).click()
  await page.getByRole('button', { name: /Mock 연결 확인/ }).click()
  const unsafeRequests = actionRequests.filter((request) => request.method !== 'GET' || new URL(request.url).origin !== new URL(page.url()).origin)
  expect(unsafeRequests).toEqual([])
})

test('핵심 브레이크포인트는 오버플로와 작은 조작 영역이 없다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '다중 뷰포트 회귀 전용')
  for (const width of [320, 360, 361, 390, 768, 769, 1024, 1025, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      undersized: Array.from(document.querySelectorAll<HTMLElement>('button, a, input, textarea'))
        .filter((element) => !element.closest('[inert]') && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            name: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        })
        .filter((target) => target.width < 44 || target.height < 44),
    }))
    expect(audit.overflow, `${width}px horizontal overflow`).toBeLessThanOrEqual(0)
    expect(audit.undersized, `${width}px touch targets`).toEqual([])
  }
})

test('태블릿 경계에서도 전체 퍼널의 조작 영역과 레이아웃이 유지된다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '태블릿 경계 회귀 전용')

  const audit = async (width: number, state: string) => {
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      undersized: Array.from(document.querySelectorAll<HTMLElement>('button, a, input, textarea'))
        .filter((element) => !element.closest('[inert]') && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            name: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 38),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        })
        .filter((target) => target.width < 44 || target.height < 44),
    }))
    expect(result.overflow, `${width}px ${state}: overflow`).toBeLessThanOrEqual(0)
    expect(result.undersized, `${width}px ${state}: touch targets`).toEqual([])
  }

  for (const width of [768, 769, 1024, 1025]) {
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/')
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()
    await audit(width, 'landing')
    await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()
    await audit(width, 'briefing')
    await page.getByRole('button', { name: /조건 초안 검토/ }).click()
    await audit(width, 'builder')
    await page.getByRole('button', { name: /4시간봉/ }).click()
    await page.getByRole('button', { name: /자산의 2%/ }).click()
    await audit(width, 'ready')
    await page.getByRole('button', { name: /백테스트 시작/ }).click()
    await audit(width, 'signup')
    await page.getByRole('button', { name: /Google로 계속/ }).click()
    await expect(page.getByText('+21.7%', { exact: true })).toBeVisible({ timeout: 5_000 })
    await audit(width, 'result')
    await page.getByRole('button', { name: /실행 환경 선택/ }).click()
    await audit(width, 'match')
    await page.getByRole('button', { name: /Binance 무료 경로 확인/ }).click()
    await audit(width, 'onboarding')
    await page.getByRole('button', { name: /Mock 가입 가이드 시작/ }).click()
    await audit(width, 'dashboard')
  }
})

test('중간 폭 브로커 행은 가격·매칭 정보가 겹치지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '브로커 중간 폭 회귀 전용')
  await page.goto('/')
  await page.getByRole('button', { name: 'Mock 계정으로 로그인' }).click()
  await page.getByLabel('시장이나 전략에 대해 물어보세요').fill('BTC RSI 진입 전략')
  await page.getByRole('button', { name: '대화 시작' }).click()
  await page.getByRole('button', { name: /BTC\/USDT/ }).click()
  await page.getByRole('button', { name: /4시간봉/ }).click()
  await page.getByRole('button', { name: /자산의 2%/ }).click()
  await page.getByRole('button', { name: /백테스트 시작/ }).click()
  await expect(page.getByText('+21.7%', { exact: true })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /실행 환경 선택/ }).click()

  for (const width of [834, 900, 1150, 1151]) {
    await page.setViewportSize({ width, height: 900 })
    const audit = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>('.broker-row'))
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rowOverflow: rows.map((row) => {
          const rowRect = row.getBoundingClientRect()
          return Array.from(row.children).filter((child) => (child as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).some((child) => {
            const rect = child.getBoundingClientRect()
            return rect.left < rowRect.left - 1 || rect.right > rowRect.right + 1
          })
        }),
      }
    })
    expect(audit.overflow, `${width}px page overflow`).toBeLessThanOrEqual(0)
    expect(audit.rowOverflow, `${width}px broker content bounds`).not.toContain(true)
  }
})

test('모바일 대화는 하나의 헤더와 하나의 스크롤 영역만 사용한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 대화 셸 회귀 전용')
  await page.goto('/')
  await page.getByRole('button', { name: /지금 시장이 위험한지/ }).click()
  await expect(page.locator('.unified-chat-workspace')).toBeVisible()
  const shell = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: innerHeight,
    footer: Boolean(document.querySelector('.tesia-footer')),
    innerHeading: getComputedStyle(document.querySelector<HTMLElement>('.unified-chat-heading')!).display,
    duplicatedHeaderControls: document.querySelectorAll('.unified-chat-heading > button, .unified-chat-heading > .unified-agent-status').length,
  }))
  expect(shell.documentHeight).toBe(shell.viewportHeight)
  expect(shell.footer).toBe(false)
  expect(shell.innerHeading).toBe('block')
  expect(shell.duplicatedHeaderControls).toBe(2)
  await expect(page.locator('.unified-chat-heading > button')).toBeHidden()
  await expect(page.locator('.unified-chat-heading > .unified-agent-status')).toBeHidden()
})

test('대시보드는 이전 전략 요약을 이어받고 새로고침 후에도 보존한다', async ({ page }) => {
  await page.goto('/#/dashboard')
  const handoff = page.locator('.dashboard-conversation')
  await expect(handoff).toContainText('대시보드로 이어받았습니다')
  await expect(handoff).toContainText('6개월 누적 수익률 +14.2%')
  await page.reload()
  await expect(page.locator('.dashboard-conversation')).toContainText('대시보드로 이어받았습니다')
})
