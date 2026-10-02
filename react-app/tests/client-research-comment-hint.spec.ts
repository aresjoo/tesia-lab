import { expect, test, type Page } from '@playwright/test'

const sessionId = 'research-comment-hint'
const experienceKey = 'teth-client-experience'
const commentPath = 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z'
const conversationDraft = '연구 안내 검수 중에도 보존할 대화 초안'
const documentDraft = '행 코멘트와 별도로 보존할 문서 질문'
const rowDraft = '손절 조건에 남긴 미전송 코멘트'

async function seed(page: Page) {
  const requests: string[] = []
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort('failed') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ sessionId, experienceKey, conversationDraft }) => {
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    if (sessionStorage.getItem(experienceKey)) return
    // Same real Main/store boundary as client-research-storage; no component
    // replacement, research execution or manufactured result is involved.
    const turn = { id: 'comment-hint-turn', question: '비트코인 반등', answer: '계획', fullAnswer: '계획', startedAt: 1,
      status: 'done', suggestions: [], phase: 'plan' }
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: sessionId, homeDraft: '', sessions: [{
      id: sessionId, title: '연구 코멘트 안내 검수', idea: '비트코인 반등', draft: conversationDraft,
      pair: 'BTC/USDT', timeframe: '일봉', mode: 'dip', phase: 'plan', risk: '−3%', takeProfit: '+8%',
      workspace: 'research', researchStatus: '초안', turns: [turn], updatedAt: 1,
    }] }))
  }, { sessionId, experienceKey, conversationDraft })
  await page.goto('/')
  await expect(page.locator('.rw-scroll .g-doc > h3')).toHaveText('연구 계획')
  await page.evaluate(() => document.fonts.ready)
  return requests
}

for (const width of [320, 1280]) for (const fontSize of [12, 24]) {
  test(`${width}px 연구 계획 코멘트 안내 ${fontSize === 24 ? '200% 글자 확대' : '기본 글자'}는 동일 SVG와 초안을 보존한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const requests = await seed(page)
    const document = page.locator('.rw-scroll .g-doc')
    const hint = document.locator(':scope > .meta')
    const symbol = hint.locator('.rw-comment-symbol')
    const icon = hint.getByRole('img', { name: '코멘트 아이콘', exact: true })
    const row = page.getByRole('button', { name: '손절 수정 요청', exact: true })
    if (fontSize === 24) await hint.evaluate(element => { element.style.fontSize = '24px' })
    await expect(hint).toHaveText(/BTC\/USDT, 일봉, 행 위에서\s*로 수정 요청/)
    await expect(hint).not.toContainText('💬')
    await expect(icon).toHaveClass(/rw-comment-hint-icon/)
    await expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    await expect(icon).toHaveAttribute('focusable', 'false')
    await expect(icon).not.toHaveAttribute('tabindex')
    await expect(icon.locator('path')).toHaveAttribute('d', commentPath)
    await expect(row.locator('svg path')).toHaveAttribute('d', commentPath)
    await expect(row.locator('svg')).toHaveAttribute('aria-hidden', 'true')
    await expect(row.locator('svg')).toHaveAttribute('focusable', 'false')
    await expect(row.locator('svg')).not.toHaveAttribute('tabindex')
    await expect(symbol).toHaveText('로')
    await expect(symbol).toHaveCSS('white-space', 'nowrap')
    const geometry = await hint.evaluate(element => {
      const image = element.querySelector<SVGSVGElement>('.rw-comment-hint-icon')!
      const unit = element.querySelector<HTMLElement>('.rw-comment-symbol')!
      const bounds = element.getBoundingClientRect(), imageBox = image.getBoundingClientRect(), unitBox = unit.getBoundingClientRect()
      return { fontSize: parseFloat(getComputedStyle(element).fontSize), width: imageBox.width, height: imageBox.height,
        imageLeft: imageBox.left, imageRight: imageBox.right, unitLeft: unitBox.left, unitRight: unitBox.right,
        left: bounds.left, right: bounds.right, fits: element.scrollWidth <= element.clientWidth + 1 }
    })
    expect(geometry.fontSize).toBe(fontSize)
    expect(geometry.width).toBeCloseTo(fontSize * 14 / 12, 1)
    expect(geometry.height).toBeCloseTo(fontSize * 14 / 12, 1)
    expect(geometry.unitLeft).toBeGreaterThanOrEqual(geometry.left - 1)
    expect(geometry.unitRight).toBeLessThanOrEqual(geometry.right + 1)
    expect(geometry.imageLeft).toBeGreaterThanOrEqual(geometry.unitLeft - 1)
    expect(geometry.imageRight).toBeLessThanOrEqual(geometry.unitRight + 1)
    expect(geometry.fits).toBe(true)
    expect(await document.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => window.document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 320) await page.screenshot({ path: info.outputPath(`research-comment-hint-${fontSize}px.png`), fullPage: true })

    await page.locator('.rw-composer textarea').fill(documentDraft)
    await row.focus()
    await page.keyboard.press('Enter')
    const input = page.getByRole('textbox', { name: '손절 코멘트', exact: true })
    await expect(input).toBeFocused()
    await input.fill(rowDraft)
    await page.locator('.g-inline-input').getByRole('button', { name: '취소', exact: true }).click()
    await expect(input).toHaveCount(0)
    await expect(row).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(input).toHaveValue(rowDraft)
    await input.press('Escape')
    await expect(row).toBeFocused()
    await expect(page.locator('.rw-composer textarea')).toHaveValue(documentDraft)
    await expect(document.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^손절$/ }) }).locator('.v')).toHaveText('−3%')
    await expect(page.locator('.rw-user-message')).toHaveCount(0)
    await page.reload()
    await row.click()
    await expect(input).toHaveValue(rowDraft)
    await expect(page.locator('.rw-composer textarea')).toHaveValue(documentDraft)
    expect(await page.evaluate(({ experienceKey, sessionId }) => JSON.parse(sessionStorage.getItem(experienceKey)!).sessions.find((session: { id: string }) => session.id === sessionId).draft,
      { experienceKey, sessionId })).toBe(conversationDraft)
    expect(requests).toEqual([])
  })
}
