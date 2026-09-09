import { expect, test, type Page } from '@playwright/test'

async function begin(page: Page, question = '비트코인 하락 후 반등 전략') {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요' }).fill(question)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '응답 중지' })).toBeVisible()
  await page.clock.fastForward(8_000)
  await expect(page.locator('.g-amsg')).toBeVisible()
}

async function login(page: Page) {
  await page.getByRole('button', { name: '사이드바 로그인', exact: true }).click()
  await page.getByRole('button', { name: /Google/ }).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
}
async function drawer(page: Page) {
  if ((page.viewportSize()?.width || 0) <= 860) await page.locator('.client-hamburger').click()
  else await page.locator('.client-rail-logo-row button').click()
}

test('기본 진입은 원본 홈→동일 대화→스트리밍이며 완료 작업을 펼쳐볼 수 있다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await begin(page)
  await expect(page.locator('.client-source-app')).toHaveCount(1)
  await expect(page.locator('.market-briefing,.tesia-header,.build-progress')).toHaveCount(0)
  const activity = page.locator('.g-act2 .hd')
  await expect(activity).toHaveAttribute('aria-expanded', 'false')
  await activity.click()
  await expect(page.locator('.g-act2 .ar')).toBeVisible()
  await page.getByRole('button', { name: /생각 완료/ }).click()
  await expect(page.locator('.g-act2 .ad')).toContainText('아이디어 확인 중')
  await page.reload()
  await expect(page.locator('.g-umsg')).toHaveText('비트코인 하락 후 반등 전략')
  await expect(page.locator('.g-act2 .hd')).toHaveAttribute('aria-expanded', 'false')
  expect(errors).toEqual([])
})

test('응답 중지·후속 초안·한국어 조합과 사용자 제목이 보존된다', async ({ page }) => {
  await begin(page)
  await page.getByRole('button', { name: '대화 제목 수정' }).click()
  await page.getByRole('textbox', { name: '대화 제목 수정' }).fill('내 반등 연구')
  await page.getByRole('textbox', { name: '대화 제목 수정' }).press('Enter')
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요' })
  await input.fill('1시간으로 부탁해요')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await expect(input).toHaveValue('1시간으로 부탁해요')
  await input.press('Enter')
  await page.clock.fastForward(2_100)
  await page.getByRole('button', { name: '응답 중지' }).click()
  await expect(page.locator('.client-stopped')).toBeVisible()
  await input.fill('다음에 이어갈 초안')
  await page.clock.fastForward(500)
  await page.reload()
  await expect(input).toHaveValue('다음에 이어갈 초안')
  await expect(page.getByRole('button', { name: '대화 제목 수정' })).toHaveText('내 반등 연구')
})

test('대화별 초안·제목·기록은 분리되며 삭제는 두 번 확인한다', async ({ page }) => {
  await begin(page)
  if ((page.viewportSize()?.width || 0) <= 860) await drawer(page)
  await login(page)
  await drawer(page)
  await page.locator('.client-new-strategy').click()
  await page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요' }).fill('이더리움 추세 전략')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await page.clock.fastForward(8_000)
  await expect(page.getByRole('button', { name: '대화 제목 수정' })).toHaveText('ETH Trend Strategy')
  await drawer(page)
  await page.locator('.client-session').filter({ hasText: 'BTC Pullback Strategy' }).click()
  await expect(page.locator('.g-umsg')).toHaveText('비트코인 하락 후 반등 전략')
  await page.getByRole('button', { name: '대화 메뉴', exact: true }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.locator('.g-umsg')).toBeVisible()
  await page.getByRole('button', { name: '정말 삭제할까요? 되돌릴 수 없어요' }).click()
  await expect(page.locator('.client-hero-title')).toBeVisible()
  await page.reload()
  await drawer(page)
  await expect(page.locator('.client-session')).toHaveCount(1)
  await expect(page.locator('.client-session')).toContainText('ETH Trend Strategy')
})

test('연구 계획→95초 Activity→Critic→최종 문서가 한 셸 안에서 이어진다', async ({ page }) => {
  await begin(page)
  for (const text of ['1시간', '−3% (표준)', '익절 +8% 설정']) {
    await page.getByRole('button', { name: text, exact: true }).click()
    await page.clock.fastForward(8_000)
  }
  await page.getByRole('button', { name: /Research Plan.*연구 계획/ }).click()
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await page.clock.fastForward(40_000)
  await expect(page.locator('.g-finding')).toContainText('저변동성 구간 과잉 거래')
  await page.clock.fastForward(56_000)
  await page.clock.fastForward(1_300)
  await expect(page.getByRole('heading', { name: 'Research Integrity', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('반응형 홈·대화의 버튼과 본문이 320~1440px에서 겹치지 않는다', async ({ page }) => {
  await page.goto('/')
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.client-hero-title')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    const terms = await page.locator('.client-home-terms').boundingBox()
    const boundary = await page.locator('.client-development-boundary').boundingBox()
    if (width <= 860) await expect.poll(async () => {
      const input = await page.locator('.client-home-pill').boundingBox()
      const legal = await page.locator('.client-home-terms').boundingBox()
      return Boolean(input && legal && input.y + input.height + 8 <= legal.y)
    }).toBe(true)
    expect(terms!.y + terms!.height).toBeLessThanOrEqual(boundary!.y)
  }
})

test('저장 실패에서도 대화는 진행되며 외부 인증·거래 요청은 없다', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError') } })
  const writes: string[] = []
  page.on('request', r => { if (!['GET','HEAD'].includes(r.method())) writes.push(r.url()) })
  await begin(page)
  await expect(page.getByRole('status').filter({ hasText: '이 탭에 변경 내용을 저장하지 못했습니다.' })).toBeVisible()
  await page.getByRole('button', { name: '1시간', exact: true }).click()
  await page.clock.fastForward(8_000)
  await expect(page.locator('.g-umsg')).toHaveCount(2)
  expect(writes).toEqual([])
})

test('존재하지 않는 세션 ID는 홈으로 복구하고 입력을 지우지 않는다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-experience', JSON.stringify({ sessions: [], currentId: 'missing-id', homeDraft: '저장된 초안' })))
  await page.goto('/')
  const input = page.locator('.client-home-content textarea')
  await expect(input).toHaveValue('저장된 초안')
  await input.fill('복구 뒤 이어 쓰는 내용')
  await expect(input).toHaveValue('복구 뒤 이어 쓰는 내용')
})

test('세션 삭제는 그 ID의 문서·연구·위임 캐시만 제거한다', async ({ page }) => {
  await begin(page)
  const keys = await page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem('teth-client-experience')!).currentId
    const keys = ['teth-client-research-documents:', 'teth-research-preview:', 'teth-research-preview:restored:', 'teth:client-delegation:'].map(prefix => prefix + id)
    keys.forEach(key => sessionStorage.setItem(key, 'test-cache'))
    sessionStorage.setItem('unrelated-session', 'preserve')
    return keys
  })
  await page.getByRole('button', { name: '대화 메뉴', exact: true }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('button', { name: '정말 삭제할까요? 되돌릴 수 없어요' }).click()
  expect(await page.evaluate(keys => keys.map(key => sessionStorage.getItem(key)), keys)).toEqual(keys.map(() => null))
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated-session'))).toBe('preserve')
})

test('일시적인 저장 실패가 복구되면 경고가 해제된다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__restorePreviewStorage', { value: Storage.prototype.setItem })
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError') }
  })
  await begin(page)
  await expect(page.locator('.client-global-notice')).toBeVisible()
  await page.evaluate(() => { Storage.prototype.setItem = (window as unknown as { __restorePreviewStorage: typeof Storage.prototype.setItem }).__restorePreviewStorage })
  await page.getByRole('textbox', { name: 'TETH에게 물어보세요' }).fill('저장을 다시 시도합니다')
  await page.clock.fastForward(500)
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
})
