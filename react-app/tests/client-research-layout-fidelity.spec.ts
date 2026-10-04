import { expect, test, type Locator, type Page } from '@playwright/test'

// 원본 621cbed의 g-workspace/header와 index.html:1303–1317 composer.
// 실제 공개 앱의 로컬 표시 fixture이며 서버 연구·백테스트 성공 근거가 아니다.
// Native는 다른 표시 수명을 갖는다. 이 파일은 data-source=client-fixture만 검증한다.
const widths = [320, 390, 1440] as const
const idea = '비트코인이 떨어졌을 때 사는 전략, 긴 제목과 여러 문서 탭 및 손절 조건을 함께 검토하는 합성 미리보기'
const question = '문서와 함께 보존할 사용자 질문'
const answer = '연구 문서 아래에 이어지는 원문 답변입니다.\n조건과 검증 범위를 구분합니다.'
const draft = '전환 전부터 작성하던 문서 초안'
const publicRoot = '.client-restored-research[data-source="client-fixture"]'

for (const { width, height } of [
  { width: 320, height: 360 }, { width: 360, height: 360 },
  { width: 361, height: 360 }, { width: 390, height: 360 },
  { width: 844, height: 390 }, { width: 667, height: 375 },
]) for (const playing of [false, true]) {
  test(`로그인 연구 짧은 화면 ${width}×${height} playing=${playing}: 제목 편집과 계정 조작부를 보존한다`, async ({ page, baseURL }, info) => {
    await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
    const audit = await openResearch(page, baseURL, width, 'plan', playing)
    await page.setViewportSize({ width, height })
    const root = page.locator(publicRoot)
    const composer = root.locator('.rw-composer textarea')
    const longDraft = Array.from({ length: 8 }, (_, i) => `${i + 1}. 로그인 연구 문서에서 보존할 긴 질문`).join('\n')
    await composer.fill(longDraft)
    await expect(composer).toHaveCSS('max-height', '40px')
    const heading = root.locator('.rw-heading .g-title')
    const menu = root.getByRole('button', { name: '대화 메뉴', exact: true })
    const bell = page.locator('.client-account-utility button').first()
    const documentButton = root.getByRole('button', { name: '연구 문서 열기', exact: true })
    const selectedTab = root.getByRole('tab', { selected: true })
    for (const target of [heading, menu, bell, documentButton, selectedTab]) await reachable(target)
    expect((await rect(root.locator('.rw-heading'))).width).toBeGreaterThanOrEqual(60)
    console.info('Signed short geometry', width, playing, JSON.stringify({ header: await rect(root.locator('.rw-header')), body: await rect(root.locator('.rw-scroll')) }))
    expect.soft((await rect(root.locator('.rw-scroll'))).height, '로그인 상태에서도 본문 최소 100px을 유지한다').toBeGreaterThanOrEqual(100)
    await artifacts(page, width)
    await heading.click()
    const editor = root.locator('.g-title-input')
    await editor.fill('로그인 상태의 짧은 화면에서도 보존하는 연구 제목')
    for (const target of [editor, menu, bell, documentButton, selectedTab]) await reachable(target)
    console.info('Signed editing geometry', width, playing, JSON.stringify({ header: await rect(root.locator('.rw-header')), body: await rect(root.locator('.rw-scroll')) }))
    expect.soft((await rect(root.locator('.rw-scroll'))).height, '로그인 제목 편집 중에도 본문 최소 100px을 유지한다').toBeGreaterThanOrEqual(100)
    await page.screenshot({ path: info.outputPath(`signed-research-${width}-${playing}-editing.png`) })
    await editor.press('Escape')
    await expect(heading).toBeFocused()
    await menu.click()
    await reachable(root.locator('.client-session-pop').getByRole('button', { name: '이름 변경', exact: true }))
    await page.keyboard.press('Escape')
    await expect(menu).toBeFocused()
    await expect(composer).toHaveValue(longDraft)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`signed-research-${width}-${playing}.png`) })
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

async function openResearch(page: Page, baseURL: string | undefined, width: number, active: 'plan' | 'report', playing = false) {
  if (!baseURL) throw new Error('로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin
  const blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // 공개 preview의 진행 상태만 고정한다. 서버 상태/응답을 생성하지 않는다.
  // Date만 고정하고 실제 rAF/타이머는 유지해 차트 로딩과 탭 초점을 멈추지 않는다.
  await page.clock.setFixedTime(new Date('2026-09-20T00:00:00Z'))
  await page.addInitScript(({ active, playing, idea, question, answer, draft }) => {
    if (sessionStorage.getItem('research-layout-fixture-seeded')) return
    sessionStorage.setItem('research-layout-fixture-seeded', '1')
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    const id = 'research-layout-fidelity'
    // Seed before the store is created, not before reload's pagehide flush.
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '홈 초안', sessions: [{
      id, title: idea, renamed: true, idea, draft: '원래 대화 초안', pair: 'BTC/USDT', mode: 'dip',
      phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research',
      researchStatus: playing ? '진행 중' : active === 'report' ? '검토 필요' : '초안', turns: [], updatedAt: 1,
    }] }))
    const seconds = playing ? 10 : active === 'report' ? 95 : 0
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({
      seconds, status: playing ? 'playing' : active === 'report' ? 'completed' : 'idle', view: 'activity', questions: [],
      clockVersion: 1, ...(playing ? { clockStartedAt: Date.now() - seconds * 1000 } : {}),
    }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({
      active, tabs: active === 'report' ? ['plan', 'report', 'bt2', 'holdout', 'critic'] : ['plan', 'activity'],
      drafts: { plan: draft, report: draft }, replies: [{ doc: active, question, answer }],
      rowDrafts: {}, positions: {}, edits: {}, paper: false, paused: false,
    }))
  }, { active, playing, idea, question, answer, draft })
  await page.goto('/')
  await expect(page.locator(publicRoot)).toBeVisible()
  await expect(page.locator(`${publicRoot} .rw-composer textarea`)).toHaveValue(draft)
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}

async function rect(locator: Locator) {
  await expect(locator).toBeVisible()
  const result = await locator.boundingBox()
  expect(result, '노출된 원본 조작부에 실제 레이아웃 상자가 있어야 한다').not.toBeNull()
  return result!
}

async function reachable(locator: Locator) {
  await expect(locator).toBeVisible()
  const hitTest = await locator.evaluate(element => {
    const r = element.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const nav = element.closest('.rw-tabs')
    return { reachable: hit !== null && (hit === element || element.contains(hit)),
      rect: r.toJSON(), hit: hit?.className, nav: nav?.getBoundingClientRect().toJSON(), scrollLeft: nav?.scrollLeft }
  })
  expect(hitTest.reachable, `다른 헤더 요소가 조작부 중앙을 덮지 않아야 한다: ${JSON.stringify(hitTest)}`).toBe(true)
}

async function artifacts(page: Page, width: number) {
  const root = page.locator(publicRoot), aux = root.locator('.rw-aux')
  if (width === 1440) {
    expect((await rect(aux)).width).toBeCloseTo(300, 1)
    await expect(aux.locator('.rw-artifact').first()).toBeVisible()
    return
  }
  const trigger = root.getByRole('button', { name: '연구 문서 열기', exact: true })
  const hit = await rect(trigger)
  expect(hit.width).toBeGreaterThanOrEqual(44)
  expect(hit.height).toBeGreaterThanOrEqual(44)
  await reachable(trigger)
  await trigger.click()
  await expect(aux).toBeVisible()
  const panel = await rect(aux)
  expect(panel.x).toBeGreaterThanOrEqual(0)
  expect(panel.x + panel.width).toBeLessThanOrEqual(width + 1)
  await expect(aux.locator('.rw-artifact').first()).toBeVisible()
  await root.getByRole('button', { name: '연구 문서 닫기', exact: true }).click()
  await expect(aux).toBeHidden()
  await expect(trigger).toBeFocused()
}

for (const width of widths) for (const active of ['plan', 'report'] as const) {
  test(`공개 연구 ${active} ${width}px: 원본 한줄 헤더·문서 안 대화·컴포저와 실제 조작을 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await openResearch(page, baseURL, width, active)
    const root = page.locator(publicRoot), header = root.locator('.rw-header')
    // At 320px the restored session menu shares a second row with the tabs,
    // preserving the title instead of reducing its readable width to 20px.
    expect((await rect(header)).height).toBeCloseTo(width <= 360 ? 92 : 44, 1)
    await expect(root.locator('.rw-heading [title]').first()).toHaveAttribute('title', idea)
    const selected = root.getByRole('tab', { selected: true })
    await expect(selected).toHaveText(active === 'plan' ? '연구 계획' : '검증 결과')
    await reachable(selected)
    expect((await rect(selected)).height).toBeGreaterThanOrEqual(44)
    const back = root.getByRole('button', { name: '대화로 돌아가기', exact: true })
    expect((await rect(back)).width).toBeGreaterThanOrEqual(44)
    expect((await rect(back)).height).toBeGreaterThanOrEqual(44)

    const composer = root.locator('form.rw-composer'), input = composer.locator('textarea')
    await expect(composer.locator('.rw-context')).toContainText(active === 'plan' ? '연구 계획' : '검증 결과')
    await expect(input).toHaveAttribute('placeholder', '시장에 대해 무엇이든 물어보세요')
    await expect(input).toHaveCSS('font-size', width === 1440 ? '14.5px' : '16px')
    await expect(input).toHaveCSS('line-height', width === 1440 ? '21px' : '22px')
    const composerRect = await rect(composer), contextRect = await rect(composer.locator('.rw-context'))
    if (width === 1440) expect(composerRect.width).toBeCloseTo(840, 1)
    else {
      expect(composerRect.x).toBeGreaterThanOrEqual(0)
      expect(composerRect.x + composerRect.width).toBeLessThanOrEqual(width)
      await expect(composer).toHaveCSS('border-radius', '10px')
    }
    expect(contextRect.y).toBeGreaterThanOrEqual(composerRect.y)
    expect(contextRect.y + contextRect.height).toBeLessThanOrEqual(composerRect.y + composerRect.height)
    const send = composer.getByRole('button', { name: '문서 질문 보내기', exact: true })
    expect((await rect(send)).width).toBeGreaterThanOrEqual(44)
    expect((await rect(send)).height).toBeGreaterThanOrEqual(44)
    await reachable(send)

    const thread = root.locator('.rw-thread'), response = thread.locator('.rw-answer')
    await response.scrollIntoViewIfNeeded()
    await expect(thread.locator('.rw-user-message')).toHaveText(question)
    await expect(response).toHaveText(answer)
    await expect(response).toHaveCSS('font-size', '15.5px')
    await expect(response).toHaveCSS('line-height', '27.9px')
    await expect(response).toHaveCSS('color', 'rgb(227, 227, 227)')
    await page.screenshot({ path: info.outputPath(`research-${active}-${width}-thread.png`) })
    await artifacts(page, width)

    if (active === 'plan') {
      const comment = root.getByRole('button', { name: '손절 수정 요청', exact: true })
      await comment.click()
      const edit = root.getByRole('textbox', { name: '손절 코멘트', exact: true })
      await expect(edit).toBeFocused()
      await edit.fill('기존 조건은 바꾸지 않는 댓글 초안')
      await edit.press('Escape')
      await expect(comment).toBeFocused()
      await selected.focus(); await selected.press('End')
      await expect(root.getByRole('tab', { selected: true })).toHaveText('연구 과정')
      await root.getByRole('tab', { selected: true }).press('Home')
      await expect(input).toHaveValue(draft)
      await expect(response).toHaveText(answer)
    } else {
      const chart = root.getByRole('button', { name: '차트로 자세히 보기' })
      await chart.click()
      await expect(root.locator('.ra-analysis')).toBeVisible()
      await expect(root.locator('.ra-chart canvas').first()).toBeVisible()
      await root.getByRole('button', { name: '검증 결과로 돌아가기', exact: true }).click()
      await expect(root.locator('.ra-analysis')).toHaveCount(0)
      await expect(chart).toBeFocused()
      await expect(input).toHaveValue(draft)
      await expect(response).toHaveText(answer)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

for (const width of widths) {
  test(`공개 연구 진행 중 ${width}px: 긴 제목에서도 배지 전체·탭·문서 열기를 숨기거나 겹치지 않는다`, async ({ page, baseURL }, info) => {
    const audit = await openResearch(page, baseURL, width, 'plan', true)
    const root = page.locator(publicRoot), header = root.locator('.rw-header')
    const badge = header.locator('.g-tag').filter({ hasText: '연구 진행 중' })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('연구 진행 중')
    expect(await badge.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight), '진행 상태 원문을 말줄임/클리핑하지 않는다').toBe(true)
    const badgeBox = await rect(badge), headerBox = await rect(header)
    if (width === 1440) expect(headerBox.height).toBeCloseTo(44, 1)
    expect(badgeBox.y).toBeGreaterThanOrEqual(headerBox.y)
    expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height)
    const tabsBox = await rect(header.getByRole('tablist'))
    expect(Math.min(badgeBox.x + badgeBox.width, tabsBox.x + tabsBox.width) <= Math.max(badgeBox.x, tabsBox.x)
      || Math.min(badgeBox.y + badgeBox.height, tabsBox.y + tabsBox.height) <= Math.max(badgeBox.y, tabsBox.y), '배지와 탭은 같은 픽셀을 차지하지 않는다').toBe(true)
    await reachable(header.getByRole('tab', { selected: true }))
    await artifacts(page, width)
    await expect(badge).toBeVisible()
    const plan = header.getByRole('tab', { name: '연구 계획', exact: true })
    await plan.focus(); await plan.press('End')
    await expect(header.getByRole('tab', { selected: true })).toHaveText('연구 과정')
    await expect(root.locator('.rw-composer')).toHaveCount(0)
    await header.getByRole('tab', { selected: true }).press('Home')
    await expect(root.locator('.rw-composer textarea')).toHaveValue(draft)
    await expect(badge).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`research-playing-${width}.png`) })
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

test('선택한 연구 탭은 화면 회전 뒤에도 보이고 입력 초점·선택과 수동 탭 탐색을 빼앗지 않는다', async ({ page, baseURL }) => {
  const audit = await openResearch(page, baseURL, 1440, 'report')
  const root = page.locator(publicRoot), nav = root.getByRole('tablist')
  const selected = nav.getByRole('tab', { selected: true }), input = root.locator('.rw-composer textarea')
  await input.focus()
  await input.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(2, 6))
  for (const width of [320, 390, 1440, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(async () => {
      const tab = await rect(selected), strip = await rect(nav)
      return tab.x >= strip.x - 1 && tab.x + tab.width <= strip.x + strip.width + 1
    }).toBe(true)
    await reachable(selected)
    await expect(input).toBeFocused()
    expect(await input.evaluate((field: HTMLTextAreaElement) => [field.selectionStart, field.selectionEnd])).toEqual([2, 6])
    await expect(input).toHaveValue(draft)
  }
  // Reading other document tabs by horizontal scrolling must not be undone
  // by an unrelated input render. No scroll listener snaps back to selection.
  await nav.evaluate(element => { element.scrollLeft = element.scrollWidth })
  const manualLeft = await nav.evaluate(element => element.scrollLeft)
  await input.press('ArrowRight')
  await input.press('a')
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await nav.evaluate(element => element.scrollLeft)).toBe(manualLeft)
  expect(audit).toEqual({ blocked: [], errors: [] })
})

for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 400 }, { width: 320, height: 360 }, { width: 360, height: 360 }, { width: 361, height: 360 }, { width: 375, height: 360 }, { width: 390, height: 360 }]) {
  for (const playing of [false, true]) {
    test(`짧은 연구 화면 ${viewport.width}×${viewport.height} 진행=${playing}: 긴 입력에도 본문·전송·문서가 함께 사용 가능하다`, async ({ page, baseURL }, info) => {
      const audit = await openResearch(page, baseURL, viewport.width, 'plan', playing)
      await page.setViewportSize(viewport)
      const root = page.locator(publicRoot), input = root.locator('.rw-composer textarea')
      const longDraft = Array.from({ length: 8 }, (_, i) => `조건 ${i + 1}: 기존 원문과 입력 중인 내용을 보존해주세요.`).join('\n')
      await input.fill(longDraft)
      await expect(input).toBeFocused()
      await expect(input).toHaveValue(longDraft)
      await expect(input).toHaveCSS('max-height', '40px')
      expect((await rect(input)).height).toBeLessThanOrEqual(40)
      const body = await rect(root.locator('.rw-scroll'))
      expect(body.height, '짧은 화면에서도 연구 본문을 읽고 스크롤할 공간을 남긴다').toBeGreaterThanOrEqual(100)
      console.info('Short research geometry', viewport.width, viewport.height, playing, JSON.stringify({ header: await rect(root.locator('.rw-header')), body }))
      const send = root.getByRole('button', { name: '문서 질문 보내기', exact: true })
      await reachable(send)
      const sendBox = await rect(send)
      expect(sendBox.y + sendBox.height).toBeLessThanOrEqual(viewport.height)
      if (playing) await expect(root.locator('.rw-header .g-tag')).toHaveText('연구 진행 중')
      await artifacts(page, viewport.width)
      await expect(input).toHaveValue(longDraft)
      await root.locator('.rw-heading .g-title').click()
      const titleInput = root.locator('.g-title-input')
      await titleInput.fill('짧은 화면에서도 문서 맥락을 유지하는 제목')
      await reachable(titleInput)
      expect((await rect(root.locator('.rw-scroll'))).height, '제목 편집 중에도 본문 최소 공간은 유지한다').toBeGreaterThanOrEqual(100)
      await titleInput.press('Escape')
      await expect(root.locator('.rw-heading .g-title')).toBeFocused()
      const sessionMenu = root.getByRole('button', { name: '대화 메뉴', exact: true })
      await reachable(sessionMenu)
      await sessionMenu.click()
      await reachable(root.locator('.client-session-pop').getByRole('button', { name: '이름 변경', exact: true }))
      await page.keyboard.press('Escape')
      await expect(sessionMenu).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`research-short-${viewport.width}-${viewport.height}-${playing}.png`) })
      expect(audit).toEqual({ blocked: [], errors: [] })
    })
  }
}
