import { expect, test } from '@playwright/test'

test('an observed completed work record remains visible when legacy synthetic work is removed', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now(), sid = 'observed-session', tid = 'observed-turn', answer = '확인한 자료를 정리했습니다.'
    const turn = { id: tid, question: '시장을 확인해줘', answer, fullAnswer: answer, status: 'done', startedAt: now - 3000, finishedAt: now, suggestions: [], phase: 'plan',
      responseSequence: { version: 1, owner: null, sessionId: sid, turnId: tid, revision: 1, status: 'done', blocks: [
        { id: 'observed-work', kind: 'work', activity: { label: '자료 확인 완료', status: 'done', startedAt: now - 3000, finishedAt: now, steps: [{ id: 'read', title: '자료 확인', status: 'done' }] } },
        { id: 'observed-answer', kind: 'text', text: answer, status: 'done' },
      ] } }
    const session = { id: sid, title: '관측 기록', idea: turn.question, draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: now }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: sid, sessions: [session], homeDraft: '', sharedFollows: [] }))
  })
  await page.emulateMedia({ reducedMotion: 'reduce' });await page.goto('/')
  await expect(page.locator('.g-act2')).toHaveAttribute('data-activity-state', 'done')
  await expect(page.locator('.g-act2')).toContainText('자료 확인 완료')
  // Positive contrast: the supplied 3-second observed duration is displayed.
  await expect(page.locator('.g-act2 .els')).toHaveText('3초')
  await expect(page.locator('.g-amsg')).toHaveText('확인한 자료를 정리했습니다.')
})

test('legacy partial and interrupted answers preserve supplied states without fabricated completion times', async ({ browser }) => {
  for (const status of ['running', 'stopped', 'failed'] as const) {
    // Isolate each restored record: an active previous page persists its own
    // state on unload and must not overwrite the next fixture's storage.
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.clock.install()
    await page.addInitScript(status => {
      localStorage.setItem('tethLang', 'ko')
      const now = Date.now(), answer = '답변 일부를 받았습니다.'
      // Keep the internal replay unfinished at this restored timestamp.
      const turn = { id: 'legacy-state-turn', question: '시장 흐름을 확인해줘', answer, fullAnswer: (answer + ' 남은 답변').repeat(1000),
        status, startedAt: now - 10000, suggestions: [], phase: 'plan' }
      const session = { id: 'legacy-state-session', title: '상태 검수', idea: turn.question, draft: '', pair: 'BTC/USDT', mode: 'dip',
        phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: now }
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: session.id, sessions: [session], homeDraft: '', sharedFollows: [] }))
    }, status)
    await page.goto('/')
    await expect(page.locator('.g-act2')).toHaveAttribute('data-activity-state', status)
    await expect(page.locator('.g-act2 .ar')).toHaveClass(new RegExp(`\\b${status}\\b`))
    await expect(page.locator('.g-amsg')).toHaveAttribute('data-response-state', status === 'running' ? 'streaming' : 'interrupted')
    await expect(page.locator('.g-amsg')).not.toBeEmpty()
    await expect(page.locator('.client-answer-actions')).toHaveCount(0)
    if (status !== 'running') {
      await expect(page.locator('.g-act2 .els')).toHaveCount(0)
      await page.locator('.g-act2 .hd').click()
      await expect(page.locator('.g-act2 .at')).toHaveCount(1)
      await expect(page.locator('.g-act2 .at')).toHaveText(status === 'stopped' ? '작업 중단, 1단계' : '실패')
    }
    if (status === 'stopped') await expect(page.locator('.client-stopped')).toBeVisible()
    await context.close()
  }
})

test('default original canvas has no added inspection footer; explicit inspector keeps its clearance', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.locator('.client-hero-title')).toBeVisible()
    await expect(page.locator('.client-home-gallery .g-tpl').last()).toHaveCSS('opacity', '1')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('.client-development-boundary')).toHaveCount(0)
    await expect(page.locator('.client-home-band')).toHaveCSS('bottom', '0px')
    await expect.poll(() => page.locator('.client-home-terms').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 1440) await page.screenshot({ path: info.outputPath('home-source-canvas.png') })
    await page.goto('/?inspect=1')
    await expect(page.locator('.client-development-boundary')).toBeVisible()
    await expect(page.locator('.client-home-band')).toHaveCSS('bottom', '28px')
    await expect.poll(() => page.evaluate(() => document.querySelector('.client-home-terms')!.getBoundingClientRect().bottom <= document.querySelector('.client-development-boundary')!.getBoundingClientRect().top)).toBe(true)
  }
})

test('restoring a legacy answer does not invent finished work, but keeps source answer actions and the full-height composer', async ({ page }, info) => {
  const errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.method()) })
  await page.addInitScript(() => {
    const now = Date.now(), answer = '몇 가지만 여쭙겠습니다.'
    const turn = { id: 'legacy-turn', question: '비트코인 반등 전략', answer, fullAnswer: answer,
      status: 'done', startedAt: now - 2000, finishedAt: now - 1000, suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'legacy-session', homeDraft: '', sessions: [{
      id: 'legacy-session', title: '비트코인 반등 전략', idea: turn.question, draft: '', pair: 'BTC/USDT', mode: 'dip',
      phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: now,
    }] }))
  })
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.locator('.g-amsg')).toContainText('몇 가지만 여쭙겠습니다.')
    await expect(page.locator('.g-act2')).toHaveCount(0)
    await expect(page.locator('.client-answer-actions button')).toHaveCount(3)
    await expect(page.locator('.client-development-boundary')).toHaveCount(0)
    await expect.poll(() => page.locator('.client-source-main').evaluate(element => Math.abs(element.getBoundingClientRect().height - innerHeight))).toBeLessThan(1)
    const composer = await page.locator('.g-composer').boundingBox()
    expect(composer!.y + composer!.height).toBeLessThanOrEqual(1000)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 1440) await page.screenshot({ path: info.outputPath('conversation-no-invented-work.png') })
  }
  expect(errors).toEqual([])
  expect(mutations).toEqual([])
})
