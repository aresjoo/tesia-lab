import { expect, test, type Page } from '@playwright/test'
import { CLIENT_RESEARCH_FIXTURE as FIXTURE } from '../src/client-research-fixtures'

const key = 'teth-client-experience'
const session = {
  id: 'audit-A', title: '정상 대화', renamed: true, idea: '비트코인 반등 전략', draft: '유지할 대화 초안',
  pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
  researchStatus: '검토 필요', phase: 'plan', workspace: 'conversation', tradingReady: false, updatedAt: 1,
  turns: [{ id: 'audit-turn', question: '비트코인 반등 전략', answer: '연구 계획을 확인하세요.', fullAnswer: '연구 계획을 확인하세요.', startedAt: 1, finishedAt: 2, status: 'done', suggestions: [], phase: 'plan' }],
}
async function read(page: Page) {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)
}
async function chart(page: Page) {
  await page.addInitScript(({ key, session }) => {
    sessionStorage.setItem(key, JSON.stringify({ sessions: [{ ...session, workspace: 'research' }], currentId: session.id, homeDraft: '' }))
    sessionStorage.setItem('teth-client-research-documents:' + session.id, JSON.stringify({ active: 'bt2', tabs: ['plan', 'bt2'] }))
    sessionStorage.setItem('teth-research-preview:restored:' + session.id, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }))
  }, { key, session })
  await page.goto('/')
  const svg = page.getByRole('slider', { name: 'Backtest v2 가격과 매수·매도 시점' })
  await expect(svg).toBeVisible()
  return svg
}

for (const currentId of [session.id, 'broken']) {
  test(`부분 손상 복원은 정상 대화·초안을 보존하고 오류를 알린다 (${currentId})`, async ({ page }) => {
    await page.addInitScript(({ key, session, currentId }) => {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, JSON.stringify({ sessions: [session, { id: 'broken' }], currentId, homeDraft: '유지할 홈 초안' }))
    }, { key, session, currentId })
    await page.goto('/')
    await expect(page.locator('.client-global-notice')).toContainText('일부 대화 기록을 복원하지 못했습니다')
    const saved = await read(page)
    expect(saved.sessions.map((s: { id: string }) => s.id)).toEqual([session.id])
    expect(saved.sessions[0].draft).toBe('유지할 대화 초안')
    expect(saved.homeDraft).toBe('유지할 홈 초안')
    expect(saved.currentId).toBe(currentId === session.id ? session.id : null)
    await page.reload()
    await expect(page.locator('.client-global-notice')).toBeVisible()
    await page.getByRole('button', { name: '알림 닫기' }).click()
    await page.reload()
    await expect(page.locator('.client-global-notice')).toHaveCount(0)
    expect((await read(page)).sessions).toHaveLength(1)
  })
}

test('늦게 정한 전략 유형에 맞춰 제목을 갱신한다', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.locator('.client-home-content textarea').fill('비트코인 전략 만들어줘')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await page.clock.fastForward(12_000)
  expect((await read(page)).sessions[0].title).not.toContain('Pullback')
  await page.getByRole('button', { name: '오르는 흐름에 진입', exact: true }).click()
  await page.clock.fastForward(12_000)
  expect((await read(page)).sessions[0]).toMatchObject({ mode: 'trend', title: 'BTC Trend Strategy' })
})

test('사용자가 정한 제목은 후속 대화가 끝나도 덮어쓰지 않는다', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(({ key, session }) => {
    sessionStorage.setItem(key, JSON.stringify({ sessions: [{ ...session, title: '내가 정한 이름', mode: '', phase: 'mode', draft: '', turns: [] }], currentId: session.id, homeDraft: '' }))
  }, { key, session })
  await page.goto('/')
  await page.locator('.g-composer textarea').fill('오르는 흐름에 진입')
  await page.locator('.g-composer textarea').press('Enter')
  await page.clock.fastForward(12_000)
  expect((await read(page)).sessions[0]).toMatchObject({ title: '내가 정한 이름', mode: 'trend' })
})

test('불규칙한 가격 표본도 실제 X 좌표에서 가장 가까운 봉을 조회한다', async ({ page }) => {
  const svg = await chart(page)
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await svg.scrollIntoViewIfNeeded()
    await expect.poll(() => svg.evaluate(el => Math.abs(el.getBoundingClientRect().width - el.viewBox.baseVal.width))).toBeLessThan(2)
    const box = (await svg.boundingBox())!
    for (const fraction of [.01, .25, .5, .7, .99]) {
      const target = Math.max(0, Math.min(1, (box.width * fraction - 4) / (box.width - 8))) * (FIXTURE.priceCount - 1)
      const nearest = FIXTURE.prices.reduce((best, p) => Math.abs(p[0] - target) < Math.abs(best[0] - target) ? p : best)
      await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2)
      await expect(svg).toHaveAttribute('aria-valuenow', String(nearest[0] + 1))
      await expect(svg.locator('.rw-chart-value')).toHaveText('$' + nearest[1].toLocaleString('en-US', { maximumFractionDigits: 0 }))
      const actualX = Number(await svg.locator('line[stroke="#767d8c"]').getAttribute('x1'))
      expect(Math.abs(actualX - (4 + nearest[0] / (FIXTURE.priceCount - 1) * (box.width - 8)))).toBeLessThan(2)
    }
  }
})

test('차트는 키보드로 봉·매수·매도 정보를 조회하고 Tab으로 빠져나온다', async ({ page }) => {
  const svg = await chart(page)
  await svg.focus()
  await expect(svg).toBeFocused()
  await expect(svg).toHaveAttribute('aria-valuenow', '1')
  await svg.press('End')
  await expect(svg).toHaveAttribute('aria-valuenow', String(FIXTURE.priceCount))
  await expect(svg).toHaveAttribute('aria-valuetext', /Holdout 봉인 구간/)
  await svg.press('ArrowRight')
  await expect(svg).toHaveAttribute('aria-valuenow', String(FIXTURE.priceCount))
  await svg.press('Home')
  for (let i = 0; i < FIXTURE.prices.findIndex(p => p[0] === 118); i++) await svg.press('ArrowRight')
  await expect(svg).toHaveAttribute('aria-valuetext', /BUY 매수/)
  for (let i = FIXTURE.prices.findIndex(p => p[0] === 118); i < FIXTURE.prices.findIndex(p => p[0] === 143); i++) await svg.press('ArrowRight')
  await expect(svg).toHaveAttribute('aria-valuetext', /SELL 매도, 거래 손익/)
  await page.mouse.move(0, 0)
  await expect(svg.locator('.rw-chart-value')).toBeVisible()
  await svg.press('Tab')
  await expect(svg).not.toBeFocused()
  await expect(svg.locator('.rw-chart-value')).toHaveCount(0)
  await expect(svg).toHaveAttribute('aria-valuetext', /SELL 매도, 거래 손익/)
  await svg.focus()
  await expect(svg).toHaveAttribute('aria-valuenow', '144')
  await svg.press('ArrowLeft')
  await expect(svg).toHaveAttribute('aria-valuetext', /포지션 보유 중/)
})

test('코드 재전송은 브라우저 중단 후 경과 시간에 맞춰 풀리고 다시 30초를 센다', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: '로그인', exact: true }).first().click()
  await page.getByRole('textbox', { name: '이메일 주소' }).fill('audit@example.test')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  const resend = page.getByRole('button', { name: /다시 보내기/ })
  await expect(resend).toBeDisabled()
  await page.clock.fastForward(60_000)
  await expect(resend).toBeEnabled()
  await resend.click()
  await expect(resend).toHaveText('다시 보내기 (30초)')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.fastForward(60_000)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(resend).toBeEnabled()
})

for (const overlay of ['login', 'locale']) {
  test(`뒤로가기는 ${overlay} 포털을 닫고 공개 페이지 클릭을 복원한다`, async ({ page }) => {
    await page.goto('/download/')
    await page.locator('a.web-start').click()
    await page.locator('.client-home-content textarea').fill('공개 페이지 왕복 후 유지할 초안')
    if (overlay === 'login') await page.getByRole('button', { name: '로그인', exact: true }).first().click()
    else if ((page.viewportSize()?.width ?? 0) <= 860) {
      await page.locator('.client-hamburger').click()
      await page.locator('.client-sidebar-bottom').getByRole('button', { name: '설정', exact: true }).click()
      await page.getByRole('button', { name: '설정', exact: true }).click()
      await page.getByRole('button', { name: /언어 및 통화/ }).click()
    } else await page.locator('.client-globe').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/download\//)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => page.locator('#root').evaluate(el => el.inert)).toBe(false)
    await page.locator('a.web-start').click()
    await expect(page.locator('.client-home-content textarea')).toHaveValue('공개 페이지 왕복 후 유지할 초안')
  })
}
