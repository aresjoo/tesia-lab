import { expect, test, type Page } from '@playwright/test'

async function expectVisibleFocus(page: Page, selector: string) {
  await expect.poll(() => page.evaluate(selector => {
    const element = document.activeElement as HTMLElement | null
    return Boolean(element?.closest(selector) && element.getClientRects().length && getComputedStyle(element).visibility === 'visible' && !element.closest('[inert],[hidden]'))
  }, selector)).toBe(true)
}

for (const width of [390, 1440]) {
  test(`설정 계층의 진입·Tab 순환·Escape 복귀는 보이는 항목에 포커스를 둔다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    if (width <= 860) await page.locator('.client-hamburger').click()
    await page.locator('[data-sidebar-action="settings"]').click()
    await expectVisibleFocus(page, '.ca-settings')
    for (const name of ['settings', 'help']) {
      const trigger = page.locator(`[aria-controls="ca-sub-${name}"]`)
      await trigger.focus()
      await page.keyboard.press('Enter')
      await expectVisibleFocus(page, `#ca-sub-${name}`)
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab')
        await expectVisibleFocus(page, '.ca-settings')
      }
      await page.keyboard.press('Escape')
      await expect(page.locator(`#ca-sub-${name}`)).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }
    await page.keyboard.press('Escape')
    await expect(page.locator('.ca-settings')).toHaveCount(0)
    await expectVisibleFocus(page, '.client-sidebar-bottom,.client-hamburger')
  })
}

test('행 코멘트 전송은 별도 문서 질문 초안을 지우지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const id = 'independent-drafts'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '입력 보존 검수', renamed: true, idea: '비트코인 반등', draft: '', pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', researchStatus: '초안', phase: 'plan', workspace: 'research', tradingReady: false, updatedAt: 1, turns: [] }] }))
  })
  await page.goto('/')
  const composer = page.locator('.rw-composer textarea')
  await composer.fill('아직 보내지 않은 별도 문서 질문')
  await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click()
  const comment = page.getByRole('textbox', { name: '진입 코멘트' })
  await comment.fill('진입 조건의 이유를 설명해주세요')
  await comment.press('Enter')
  await expect(page.locator('.rw-user-message')).toHaveText('진입: 진입 조건의 이유를 설명해주세요')
  await expect(composer).toHaveValue('아직 보내지 않은 별도 문서 질문')
  await page.reload()
  await expect(composer).toHaveValue('아직 보내지 않은 별도 문서 질문')
  await composer.press('Enter')
  await expect(composer).toHaveValue('')
  await expect(page.locator('.rw-user-message').last()).toHaveText('아직 보내지 않은 별도 문서 질문')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    const button = page.getByRole('button', { name: '진입 수정 요청', exact: true })
    await button.focus()
    const gap = await button.evaluate(element => {
      const label = element.parentElement!.querySelector('.k')!.getBoundingClientRect()
      const button = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const paintedRight = button.right + Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset))
      return label.left - paintedRight
    })
    expect(gap, `${width}px 코멘트 포커스 테두리와 라벨 간격`).toBeGreaterThanOrEqual(1)
  }
})

test('설정 하위 메뉴의 모바일·데스크톱 전환은 숨겨진 뒤로가기 버튼에 포커스를 남기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.client-hamburger').click()
  await page.locator('[data-sidebar-action="settings"]').click()
  await page.locator('[aria-controls="ca-sub-settings"]').click()
  await expectVisibleFocus(page, '#ca-sub-settings')
  for (const width of [1440, 390, 768, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expectVisibleFocus(page, '#ca-sub-settings')
    await page.keyboard.press('Tab')
    await expectVisibleFocus(page, '.ca-settings')
    await page.locator('#ca-sub-settings button').filter({ hasText: '언어 및 통화' }).focus()
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('[aria-controls="ca-sub-settings"]')).toBeFocused()
})

for (const mode of ['partial', 'complete-running', 'empty-running', 'older-running']) {
  test(`손상·불일치 대화 복원은 정상 기록과 초안을 보존하고 전송 가능하다 (${mode})`, async ({ page }) => {
    await page.clock.install()
    await page.addInitScript(mode => {
      const key = 'teth-client-experience'
      if (sessionStorage.getItem(key)) return
      const turn = { id: 'good', question: '보존할 정상 질문', answer: '정상 답변', fullAnswer: '정상 답변', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }
      const turns = mode === 'partial' ? [turn, { ...turn, id: 'broken', suggestions: null }]
        : mode === 'older-running' ? [{ ...turn, status: 'running', answer: '정상' }, { ...turn, id: 'last', question: '최신 질문' }]
        : [{ ...turn, status: 'running', ...(mode === 'empty-running' ? { answer: '', fullAnswer: '' } : {}) }]
      const session = { id: 'recover-turns', title: '복원 검수', renamed: true, idea: '비트코인 반등', draft: '보존할 대화 초안', pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', researchStatus: '초안', phase: 'plan', workspace: 'conversation', updatedAt: 1, tradingReady: false, turns }
      sessionStorage.setItem(key, JSON.stringify({ currentId: session.id, homeDraft: '보존할 홈 초안', sessions: [session] }))
    }, mode)
    await page.goto('/')
    await page.clock.fastForward(12_000)
    const input = page.locator('.g-composer textarea')
    await expect(input).toHaveValue('보존할 대화 초안')
    const read = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
    let saved = await read()
    expect(saved.sessions).toHaveLength(1)
    expect(saved.homeDraft).toBe('보존할 홈 초안')
    expect(saved.sessions[0].turns.some((t: { status: string }) => t.status === 'running')).toBe(false)
    expect(saved.sessions[0].turns[0].question).toBe('보존할 정상 질문')
    if (mode === 'partial' || mode === 'older-running') await expect(page.locator('.client-global-notice')).toContainText('일부 대화 기록')
    if (mode === 'partial') expect(saved.sessions[0].turns).toHaveLength(1)
    if (mode === 'older-running') expect(saved.sessions[0].turns[0]).toMatchObject({ status: 'stopped', answer: '정상' })
    await page.reload()
    await expect(input).toHaveValue('보존할 대화 초안')
    await input.fill('이어서 확인할 질문')
    await input.press('Enter')
    await page.clock.fastForward(12_000)
    saved = await read()
    expect(saved.sessions[0].turns.at(-1)).toMatchObject({ question: '이어서 확인할 질문', status: 'done' })
  })
}
