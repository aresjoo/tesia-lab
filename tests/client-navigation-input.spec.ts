import { expect, test, type Page } from '@playwright/test'
import { parsePercentageEdit, readStoredPercentage } from '../src/client-percentage-input'

test('퍼센트 해석은 부분 숫자·복수 수치·잘못된 구분자·표현 불가능한 값에 닫혀 있다', () => {
  for (const input of ['3%에서 2%로 변경해주세요', '비중 50%만 남기고 2% 손절', '1,000%', '2..5%', '2.%', '2,5%', 'case1e2%', '--2%', '2%%', '2%로 하지 마세요', '1e-999%', '9'.repeat(400) + '%', 'Infinity%', 'NaN%']) {
    expect(parsePercentageEdit(input), input).toMatchObject({ kind: 'error' })
  }
  for (const [input, value] of [['2%', 2], ['-2%로', -2], ['2.5%로 변경해주세요', 2.5], ['−.75%', -.75], ['２．５％', 2.5], ['1e-2%', .01], ['0%', 0], ['-0e-400%', -0]] as const) {
    expect(parsePercentageEdit(input), input).toEqual({ kind: 'value', value })
  }
  expect(parsePercentageEdit('이 조건의 이유를 알려주세요')).toEqual({ kind: 'comment' })
  expect(readStoredPercentage('2%로')).toBeNull()
  expect(readStoredPercentage('1e-999%')).toBeNull()
  expect(readStoredPercentage('−2.5%')).toBe(-2.5)
  expect(parsePercentageEdit('Infinity%로 변경해주세요')).toEqual({ kind: 'error', message: '계산할 수 있는 숫자로 입력해주세요. 예: 2%' })
})

async function seedPlan(page: Page) {
  await page.addInitScript(() => {
    const id = 'numeric-review'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '숫자 검수', renamed: true, idea: '비트코인 반등 전략', draft: '', pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', researchStatus: '초안', phase: 'plan', workspace: 'research', tradingReady: false, updatedAt: 1, turns: [] }] }))
  })
  await page.goto('/')
}

for (const label of ['손절', '익절']) {
  test(`${label} 변경에서 모호한 문장은 값을 덮지 않고 한 값으로 정정하면 적용한다`, async ({ page }) => {
    await seedPlan(page)
    const row = page.locator('.g-row').filter({ has: page.locator('.k', { hasText: new RegExp(`^${label}$`) }) })
    const previous = await row.locator('.v').innerText()
    await page.getByRole('button', { name: `${label} 수정 요청` }).click()
    const input = page.getByRole('textbox', { name: `${label} 코멘트` })
    for (const value of ['3%에서 2%로 변경해주세요', '1,000%', '2..5%', '2%로 하지 마세요']) {
      await input.fill(value)
      await input.press('Enter')
      await expect(input).toHaveValue(value)
      await expect(input).toBeFocused()
      await expect(page.getByRole('alert')).toContainText('값 하나만')
      await expect(row.locator('.v')).toHaveText(previous)
      await expect(page.locator('.rw-notice')).toHaveCount(0)
    }
    await input.fill('2%로')
    await input.press('Enter')
    await expect(row.locator('.v')).toHaveText(`${label === '손절' ? '−' : '+'}2%`)
  })
}

for (const width of [390, 768, 1440]) {
  test(`사이드바 열린 상태의 공개 경로 왕복은 잠금·포커스를 남기지 않는다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/download/')
    await page.locator('a.web-start').click()
    await page.locator('.client-home-content textarea').fill('사이드바 왕복 초안')
    const open = () => page.locator(width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
    await open()
    await page.goBack()
    await expect(page.locator('.client-public-page')).toBeVisible()
    await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[hidden],[inert]'))).toBe(false)
    await page.evaluate(() => document.fonts.ready)
    // Stay outside the embedded phone's deliberately contained scroll area.
    await page.mouse.move(5, 300)
    await expect.poll(async () => { await page.mouse.wheel(0, 350); return page.evaluate(() => scrollY) }).toBeGreaterThan(0)
    await page.goForward()
    await expect(page.locator('.client-home-content textarea')).toHaveValue('사이드바 왕복 초안')
    await expect(page.locator('.client-source-main')).not.toHaveAttribute('inert', '')
    await open()
    await page.evaluate(() => { history.pushState({}, '', '/policies/#terms'); window.dispatchEvent(new Event('teth:navigate')) })
    await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await page.goBack()
    await expect(page.locator('.client-home-content textarea')).toHaveValue('사이드바 왕복 초안')
  })
}

test('사이드바 반응형 경계 전환은 숨겨진 메뉴 대신 보이는 열기 버튼에 포커스를 복원한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.client-hamburger').click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  await expect(page.locator('.client-rail-logo-row button')).toBeFocused()
  await page.locator('.client-rail-logo-row button').click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  await expect(page.locator('.client-hamburger')).toBeFocused()
})

for (const phase of ['risk', 'take']) {
  test(`기본 대화 ${phase}는 숫자 일부나 부정문을 원본 선택지로 오해하지 않는다`, async ({ page }) => {
    await page.clock.install()
    await page.addInitScript(phase => {
      const id = 'conversation-number-review'
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '대화 숫자 검수', renamed: true, idea: '비트코인 반등', draft: '', pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: phase === 'take' ? '−3%' : '', takeProfit: '', researchStatus: '초안', phase, workspace: 'conversation', tradingReady: false, updatedAt: 1, turns: [] }] }))
    }, phase)
    await page.goto('/')
    const input = page.locator('.g-composer textarea')
    const read = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0])
    for (const value of phase === 'risk' ? ['12%', '2.5%', '3%에서 2%로 변경해주세요'] : ['익절 +18% 설정', '익절 없이 진행하지 마세요']) {
      await input.fill(value)
      await input.press('Enter')
      await page.clock.fastForward(15_000)
      const session = await read()
      expect(session.phase).toBe(phase)
      expect(phase === 'risk' ? session.risk : session.takeProfit).toBe('')
    }
    await input.fill(phase === 'risk' ? '−3% (표준)' : '익절 +8% 설정')
    await input.press('Enter')
    await page.clock.fastForward(15_000)
    const session = await read()
    expect(phase === 'risk' ? session.risk : session.takeProfit).toBe(phase === 'risk' ? '−3%' : '+8%')
    expect(session.phase).toBe(phase === 'risk' ? 'take' : 'plan')
  })
}
