import { expect, test, type Page } from '@playwright/test'

async function menu(page: Page) {
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
}
async function start(page: Page) {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '로컬 검수', email: 'review@example.test' })))
  await page.goto('/')
  await page.locator('.client-home-content textarea').fill('비트코인 하락 후 반등 전략')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
}
async function research(page: Page) {
  await start(page)
  await page.clock.fastForward(12_000)
  for (const choice of ['1시간', '−3% (표준)', '익절 +8% 설정']) {
    await page.getByRole('button', { name: choice, exact: true }).click()
    await page.clock.fastForward(12_000)
  }
  await page.getByRole('button', { name: /Research Plan.*연구 계획/ }).click()
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
}
async function visibility(page: Page, hidden: boolean) {
  // Deterministic visibility lifecycle test; not a claim of a physical iOS tab test.
  await page.evaluate(hidden => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

test('일반 연구 화면에는 재생 조작부가 없고 320~1440px 본문·입력이 겹치지 않는다', async ({ page }) => {
  await research(page)
  await expect(page.locator('.rw-preview-tools')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /계속 재생|샘플 재생 완료/ })).toHaveCount(0)
  await expect(page.locator('.client-development-boundary')).toContainText('서비스 미연결')
  await page.clock.fastForward(40_000)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 600 })
    await page.getByRole('tab', { name: 'Research Plan', exact: true }).click()
    const body = await page.locator('.rw-scroll').boundingBox()
    const input = await page.locator('.rw-composer').boundingBox()
    const boundary = await page.locator('.client-development-boundary').boundingBox()
    expect(body!.height).toBeGreaterThan(150)
    expect(body!.y + body!.height).toBeLessThanOrEqual(input!.y)
    expect(input!.y + input!.height).toBeLessThanOrEqual(boundary!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('탭이 숨겨지면 렌더만 쉬고 복귀 즉시 경과 시점의 결과를 표시한다', async ({ page }) => {
  await research(page)
  await page.clock.fastForward(16_000)
  const rows = await page.locator('.g-act-row').count()
  await visibility(page, true)
  await page.clock.fastForward(40_000)
  await expect(page.locator('.g-act-row')).toHaveCount(rows)
  await visibility(page, false)
  await expect(page.locator('.g-finding')).toContainText('저변동성 구간 과잉 거래')
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  await visibility(page, true)
  await page.clock.fastForward(60_000)
  await visibility(page, false)
  await expect(page.getByRole('button', { name: '최종 보고서 열기' })).toBeVisible()
  await expect(page.locator('.g-act-row')).toHaveCount(19)
  await expect(page.locator('.g-act-row.work')).toHaveCount(0)
})

test('연구 기록으로 나가 있어도 완료 상태가 갱신되고 결과가 중복되지 않는다', async ({ page }) => {
  await research(page)
  await page.clock.fastForward(20_000)
  await menu(page)
  await page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true }).click()
  await expect(page.locator('.rw-workspace')).toHaveCount(0)
  await page.clock.fastForward(90_000)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].researchStatus)).toBe('검토 필요')
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-act-row')).toHaveCount(19)
  await expect(page.getByRole('button', { name: '최종 보고서 열기' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.g-act-row')).toHaveCount(19)
  await expect(page.locator('.rw-title')).not.toContainText('연구 진행 중')
})

test('새로고침과 페이지 재진입은 연구를 초기화하거나 일시 정지하지 않는다', async ({ page }) => {
  await research(page)
  await page.clock.fastForward(22_000)
  await page.reload()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  await page.clock.fastForward(18_000)
  await expect(page.locator('.g-finding')).toBeVisible()
  await page.goto('/download/')
  await page.clock.fastForward(60_000)
  await page.goto('/')
  await expect(page.locator('.g-act-row')).toHaveCount(19)
  await expect(page.getByRole('button', { name: '최종 보고서 열기' })).toBeVisible()
})

test('답변 생성 중 새 전략을 열어도 앞선 대화를 완료하고 새 입력을 보존한다', async ({ page }) => {
  await start(page)
  await menu(page)
  await page.locator('.client-new-strategy').click()
  await page.locator('.client-home-content textarea').fill('다음 연구 초안')
  await page.clock.fastForward(12_000)
  await expect(page.locator('.client-home-content textarea')).toHaveValue('다음 연구 초안')
  const turn = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].turns[0])
  expect(turn.status).toBe('done')
  expect(turn.answer).toBe(turn.fullAnswer)
  expect(turn.finishedAt).toBe(turn.startedAt + 1800 + turn.fullAnswer.length * 26)
})

test('답변 생성 중 새로고침·탭 복귀는 자동 진행하며 명시적인 중지는 유지한다', async ({ page }) => {
  await start(page)
  await page.clock.fastForward(500)
  await page.reload()
  await expect(page.getByRole('button', { name: '응답 중지' })).toBeVisible()
  await visibility(page, true)
  await page.clock.fastForward(12_000)
  await visibility(page, false)
  await expect(page.getByRole('button', { name: '1시간', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '1시간', exact: true }).click()
  await page.getByRole('button', { name: '응답 중지' }).click()
  await page.reload()
  await page.clock.fastForward(12_000)
  await expect(page.locator('.client-stopped')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '응답 중지' })).toHaveCount(0)
})

test('저장소가 차단되어도 같은 탭의 화면 왕복은 연구를 잃지 않는다', async ({ page }) => {
  await research(page)
  await page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem('teth-client-experience')!).currentId
    sessionStorage.removeItem(`teth-research-preview:restored:${id}`)
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError') }
  })
  await page.clock.fastForward(20_000)
  await menu(page)
  await page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true }).click()
  await page.clock.fastForward(90_000)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-act-row')).toHaveCount(19)
  await expect(page.locator('.client-global-notice')).toBeVisible()
})

test('이전 자동 일시정지 캐시는 한 번 자동 복구하고 진행을 저장한다', async ({ page }) => {
  await research(page)
  await page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem('teth-client-experience')!).currentId
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 40, status: 'paused', view: 'activity', questions: [] }))
  })
  await page.reload()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  await page.clock.fastForward(56_000)
  await expect(page.getByRole('button', { name: '최종 보고서 열기' })).toBeVisible()
})

test('전략 위임 검증도 숨김·기록 왕복·새로고침 후 경과한 단계를 복원한다', async ({ page }) => {
  await start(page)
  await page.clock.fastForward(12_000)
  await page.getByRole('button', { name: /^전략 맡기기/ }).click()
  for (const name of ['비트코인', '중립적으로', '500만원', '최근 2년', '-5%까지']) await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: '전략 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
  await visibility(page, true)
  await page.clock.fastForward(10_000)
  await visibility(page, false)
  await expect(page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true }).click()
  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
  await menu(page)
  await page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true }).click()
  await page.clock.fastForward(10_000)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toBeVisible()
})
