import { expect, test, type Page } from '@playwright/test'

const id = 'continuation-reading-audit'
const originalDraft = '보존할 대화 원문 초안'
const planDraft = '보존할 연구 계획 질문'

async function mountResearch(page: Page, playing = false, signedIn = false) {
  const errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => route.abort())
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.method() + ' ' + new URL(request.url()).pathname) })
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, originalDraft, planDraft, playing, signedIn }) => {
    if (sessionStorage.getItem('continuation-reading-seeded')) return
    sessionStorage.setItem('continuation-reading-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연구 복귀 검수', email: 'continuation-audit@example.test' }))
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    // Explicit archived Mock consumer state, never a service producer result.
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title: '연구 기록 읽기 검수', renamed: true, idea: '과매도 반등 연구', draft: originalDraft,
      pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
      researchStatus: playing ? '진행 중' : '검토 필요', workspace: 'research',
      turns: [{ id: 'archive-turn', question: '원 질문', answer: '명시 Mock 답변', fullAnswer: '명시 Mock 답변', phase: 'plan', status: 'done', suggestions: [], startedAt: 1700000000000 }],
      updatedAt: 1700000000000,
    }] }))
    const saved = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    saved.sessions.push({ ...saved.sessions[0], id: 'continuation-independent-session', title: '독립 대화 검수', draft: '독립 대화의 초안', workspace: 'conversation', researchStatus: '초안' })
    sessionStorage.setItem('teth-client-experience', JSON.stringify(saved))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({
      seconds: playing ? 55 : 95, status: playing ? 'playing' : 'completed', view: 'activity', questions: [], clockVersion: 1,
      ...(playing ? { clockStartedAt: Date.now() - 55_000 } : {}),
    }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({
      active: playing ? 'activity' : 'plan', tabs: ['activity', 'plan', 'strat1'],
      drafts: { plan: planDraft, strat1: '전략 v1 독립 초안' }, positions: {}, replies: [], edits: {}, rowDrafts: {},
    }))
  }, { id, originalDraft, planDraft, playing, signedIn })
  await page.goto('/')
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  return { errors, mutations }
}

test('연구 기록을 90px 위로 읽는 사용자의 위치는 새 기록 도착 후에도 유지된다', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 600 })
  const audit = await mountResearch(page, true)
  const scroll = page.locator('.rw-scroll')
  // Establish real bottom-following intent; a restored document may start at 0.
  await scroll.hover()
  await page.mouse.wheel(0, 10000)
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(200)
  const bottom = await scroll.evaluate(node => node.scrollTop)
  await scroll.hover()
  await page.mouse.wheel(0, -90)
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeLessThan(bottom - 70)
  const reading = await scroll.evaluate(node => node.scrollTop)
  const before = await scroll.evaluate(node => ({ top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight }))
  await page.clock.fastForward(4000)
  await expect(page.locator('.g-act-row').last()).toContainText('파라미터 안정성 검사')
  const after = await scroll.evaluate(node => ({ top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight }))
  console.info('RESEARCH_READING_BASELINE', JSON.stringify({ before, after, audit }))
  await info.attach('reading-position.json', { body: JSON.stringify({ before, after, audit }, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('research-reading-arrival.png') })
  expect(audit).toEqual({ errors: [], mutations: [] })
  expect(after.total).toBeGreaterThan(before.total)
  expect(after.top, '원본 index10684~10709·11632~11638: 사용자의 상향 읽기 의도는 새 기록으로 해제하지 않는다').toBeCloseTo(reading, 0)
})

test('수정 입력 취소·문서 왕복·대화 재진입은 초안과 원문 SVG를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 })
  const audit = await mountResearch(page)
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  const comment = page.getByRole('textbox', { name: '손절 코멘트', exact: true })
  await comment.fill('-2%로 바꿀지 검토')
  await comment.press('Escape')
  await expect(page.getByRole('button', { name: '손절 수정 요청', exact: true })).toBeFocused()
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await expect(comment).toHaveValue('-2%로 바꿀지 검토')
  await page.getByRole('tab', { name: '전략 v1', exact: true }).click()
  await expect(page.locator('.g-inline-input')).toHaveCount(0)
  await expect(page.locator('.rw-composer textarea')).toHaveValue('전략 v1 독립 초안')
  await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
  await expect(page.locator('.rw-composer textarea')).toHaveValue(planDraft)
  await page.getByRole('button', { name: '연구 문서 열기', exact: true }).click()
  await expect(page.locator('.rw-artifact svg path').first()).toHaveAttribute('d', 'M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(originalDraft)
  expect(audit).toEqual({ errors: [], mutations: [] })
})

async function beginReading(page: Page, signedIn = false) {
  await page.setViewportSize({ width: 390, height: 600 })
  const audit = await mountResearch(page, true, signedIn)
  const scroll = page.locator('.rw-scroll')
  await scroll.hover()
  await page.mouse.wheel(0, 10000)
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(200)
  const bottom = await scroll.evaluate(node => node.scrollTop)
  await page.mouse.wheel(0, -90)
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeLessThan(bottom - 70)
  return { audit, scroll, reading: await scroll.evaluate(node => node.scrollTop) }
}

test('높이 변경은 상향 읽기를 취소하지 않고 실제 바닥 복귀 뒤 새 기록은 다시 추적한다', async ({ page }) => {
  const { audit, scroll, reading } = await beginReading(page)
  await page.setViewportSize({ width: 390, height: 660 })
  await expect.poll(() => scroll.evaluate(node => node.clientHeight)).toBe(540)
  // Resizing alone brings the old tail within 40px, without a downward gesture.
  await page.clock.fastForward(4000)
  await expect(page.locator('.g-act-row').last()).toContainText('파라미터 안정성 검사')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  await scroll.hover()
  await page.mouse.wheel(0, 10000)
  await expect.poll(() => scroll.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2)
  const bottom = await scroll.evaluate(node => node.scrollTop)
  await page.clock.fastForward(6000)
  await expect(page.locator('.g-act-row').last()).toContainText('스트레스 테스트 완료')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(bottom)
  expect(await scroll.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2)
  expect(audit).toEqual({ errors: [], mutations: [] })
})

test('키보드 PageUp으로 연구 기록을 읽어도 다음 기록이 위치를 빼앗지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  const audit = await mountResearch(page, true)
  const scroll = page.locator('.rw-scroll')
  await scroll.hover()
  await page.mouse.wheel(0, 10000)
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(200)
  const bottom = await scroll.evaluate(node => node.scrollTop)
  await scroll.focus()
  await page.keyboard.press('PageUp')
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeLessThan(bottom - 60)
  // Chromium animates native PageUp independently of React. Finish that
  // gesture before freezing its location and delivering the next Mock record.
  await expect.poll(async () => {
    const top = await scroll.evaluate(node => node.scrollTop)
    await page.waitForTimeout(250)
    return await scroll.evaluate(node => node.scrollTop) === top
  }).toBe(true)
  const reading = await scroll.evaluate(node => node.scrollTop)
  await page.clock.fastForward(4000)
  await expect(page.locator('.g-act-row').last()).toContainText('파라미터 안정성 검사')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  await expect(scroll).toBeFocused()
  expect(audit).toEqual({ errors: [], mutations: [] })
})

test('다른 문서·대화로 나간 사이 기록이 늘어도 연구 재진입의 읽기 위치와 초안은 유지한다', async ({ page }) => {
  const { audit, scroll, reading } = await beginReading(page)
  await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
  await expect(page.locator('.rw-composer textarea')).toHaveValue(planDraft)
  await page.clock.fastForward(4000)
  await page.getByRole('tab', { name: '연구 과정', exact: true }).click()
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(originalDraft)
  await page.clock.fastForward(6000)
  await page.getByRole('button', { name: /연구 계획.*확인/ }).click()
  await page.clock.runFor(32)
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await expect(page.locator('.g-act-row').last()).toContainText('스트레스 테스트 완료')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  await page.clock.fastForward(6000)
  await expect(page.locator('.g-act-row').last()).toContainText('수익 집중도')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
  await expect(page.locator('.rw-composer textarea')).toHaveValue(planDraft)
  expect(audit).toEqual({ errors: [], mutations: [] })
})

test('실제 사이드바로 독립 세션을 선택한 뒤 돌아와도 진행 연구의 읽기 위치를 보존한다', async ({ page }) => {
  const { audit, scroll, reading } = await beginReading(page, true)
  await page.getByRole('button', { name: '메뉴', exact: true }).click()
  await page.locator('.client-sidebar .client-session[title="독립 대화 검수"]').click()
  await expect(page.locator('.g-composer textarea')).toHaveValue('독립 대화의 초안')
  await page.clock.fastForward(4000)
  await page.getByRole('button', { name: '메뉴', exact: true }).click()
  await page.locator('.client-sidebar .client-session[title="연구 기록 읽기 검수"]').click()
  await page.clock.runFor(32)
  await expect(page.locator('.g-act-row').last()).toContainText('파라미터 안정성 검사')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  await page.clock.fastForward(6000)
  await expect(page.locator('.g-act-row').last()).toContainText('스트레스 테스트 완료')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
  await expect(page.locator('.rw-composer textarea')).toHaveValue(planDraft)
  expect(audit).toEqual({ errors: [], mutations: [] })
})

for (const destination of ['conversation', 'session'] as const) test(`바닥을 따라가던 연구의 ${destination} 왕복은 부재 중 새 기록과 다음 기록도 계속 추적한다`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  const audit = await mountResearch(page, true, true)
  const scroll = page.locator('.rw-scroll')
  await scroll.hover()
  await page.mouse.wheel(0, 10000)
  await expect.poll(() => scroll.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2)
  if (destination === 'session') {
    // The source hides the hamburger on a downward reading scroll, then
    // reveals it on keyboard focus. Use that real accessible continuation.
    const menu=page.getByRole('button', { name: '메뉴', exact: true })
    await menu.focus()
    await expect(menu).not.toHaveClass(/client-hamburger-scroll-hidden/)
    await menu.press('Enter')
    await page.locator('.client-sidebar .client-session[title="독립 대화 검수"]').click()
    await expect(page.locator('.g-composer textarea')).toHaveValue('독립 대화의 초안')
  } else {
    await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
    await expect(page.locator('.g-composer textarea')).toHaveValue(originalDraft)
  }
  await page.clock.fastForward(4000)
  if (destination === 'session') {
    const menu=page.getByRole('button', { name: '메뉴', exact: true })
    await menu.focus()
    await menu.press('Enter')
    await page.locator('.client-sidebar .client-session[title="연구 기록 읽기 검수"]').click()
  } else await page.getByRole('button', { name: /연구 계획.*확인/ }).click()
  await page.clock.runFor(32)
  await expect(page.locator('.g-act-row').last()).toContainText('파라미터 안정성 검사')
  expect(await scroll.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2)
  await page.clock.fastForward(6000)
  await expect(page.locator('.g-act-row').last()).toContainText('스트레스 테스트 완료')
  expect(await scroll.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2)
  expect(audit).toEqual({ errors: [], mutations: [] })
})

test('따라가기 메모리는 기존 문서 entry와 함께 삭제되며 같은 id 새 연구에 남지 않는다', async ({ page }) => {
  const audit=await mountResearch(page)
  const result=await page.evaluate(async()=>{
    const path='/src/client-research-cache.ts',cache=await import(path)
    const id='continuation-follow-owner',other='continuation-follow-other'
    const old=cache.createResearchDocumentWriter(id)
    const memory=cache.researchDocumentFollowing(id)
    memory.activity=true
    cache.researchDocumentFollowing(other).activity=false
    const same=cache.researchDocumentFollowing(id)===memory
    old({draft:'saved document'})
    const stored=JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!)
    cache.forgetResearchDocumentMemory(id)
    const fresh=cache.researchDocumentFollowing(id)
    memory.activity=false
    return {same,stored,fresh:{...fresh},newEntry:fresh!==memory,other:cache.researchDocumentFollowing(other).activity,staleWrite:old({draft:'late old entry'})}
  })
  expect(result).toEqual({same:true,stored:{draft:'saved document'},fresh:{},newEntry:true,other:false,staleWrite:false})
  expect(audit).toEqual({errors:[],mutations:[]})
})

test('브라우저의 실제 터치 스크롤로 위를 읽는 동안 새 기록은 읽기 위치를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  const audit = await mountResearch(page, true)
  const scroll = page.locator('.rw-scroll')
  await scroll.hover()
  await page.mouse.wheel(0, 10000)
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(200)
  const bottom = await scroll.evaluate(node => node.scrollTop)
  const bounds = await scroll.boundingBox()
  if (!bounds) throw new Error('연구 스크롤 영역을 찾지 못했습니다.')
  const cdp = await page.context().newCDPSession(page)
  const x = bounds.x + bounds.width / 2, y = bounds.y + 180
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let offset = 20; offset <= 100; offset += 20) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + offset }] })
    await page.waitForTimeout(40)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeLessThan(bottom - 60)
  await expect.poll(async () => {
    const top = await scroll.evaluate(node => node.scrollTop)
    await page.waitForTimeout(250)
    return await scroll.evaluate(node => node.scrollTop) === top
  }).toBe(true)
  const reading = await scroll.evaluate(node => node.scrollTop)
  await page.clock.fastForward(4000)
  await expect(page.locator('.g-act-row').last()).toContainText('파라미터 안정성 검사')
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(reading, 0)
  expect(audit).toEqual({ errors: [], mutations: [] })
})
