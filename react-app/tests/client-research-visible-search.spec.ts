import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, baseURL: string | undefined) {
  if (!baseURL) throw new Error('로컬 Mock 검수 주소가 필요합니다.')
  const origin = new URL(baseURL).origin, errors: string[] = [], blocked: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검색 Mock 검수', email: 'visible-search@example.test' }))
  })
  return { errors, blocked }
}

async function openHistory(page: Page) {
  const button = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  if (!await button.isVisible()) {
    const menu = page.locator('.client-hamburger')
    // 원본 계승 메뉴는 아래로 읽는 동안 접힙니다. 키보드 포커스의 기존 노출 동작을 사용합니다.
    await menu.focus()
    await expect(menu).not.toHaveClass(/client-hamburger-scroll-hidden/)
    await menu.click()
  }
  await button.click()
  return page.getByRole('searchbox', { name: '연구 기록 검색', exact: true })
}

test('CAT-RESEARCH-HIDDEN-SEARCH-01: 템플릿 해석에만 있는 문구는 가시 대화 기록 검색에 포함하지 않는다', async ({ page, baseURL }, info) => {
  const audit = await setup(page, baseURL)
  await page.goto('/')
  await page.locator('.g-tpl[data-k="acts"][data-id="anal"]').click()
  await page.locator('#strategy-idea').fill('간단히 설명')
  await page.locator('#strategy-idea').press('Enter')
  await page.clock.runFor(22_000)
  await expect(page.locator('.g-umsg')).toHaveText('간단히 설명')
  const visible = await page.locator('.client-source-main').innerText()
  expect(visible).not.toContain('시장 전반')
  await page.screenshot({ path: info.outputPath('visible-conversation.png') })
  const search = await openHistory(page)
  await search.fill('시장 전반')
  const rows = await page.locator('.g-hist-row').count()
  await info.attach('visible-search-boundary.json', { body: JSON.stringify({ key: 'CAT-RESEARCH-HIDDEN-SEARCH-01', needle: '시장 전반', visible: false, expectedOriginal: 0, actual: rows, audit }), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('hidden-command-search.png') })
  expect(rows, '원본 final gHistText/gHistRows는 제목과 가시 convo만 검색합니다.').toBe(0)
  await search.fill('간단히 설명')
  await expect(page.locator('.g-hist-row')).toHaveCount(1)
  expect(audit).toEqual({ errors: [], blocked: [] })
})

test('템플릿만 전송하여 실제 말풍선에 표시된 합성 질문은 검색과 새로고침에도 보존한다', async ({ page, baseURL }) => {
  const audit = await setup(page, baseURL)
  await page.goto('/')
  await page.locator('.g-tpl[data-k="acts"][data-id="anal"]').click()
  await expect(page.locator('#strategy-idea')).toHaveValue('')
  await page.locator('#strategy-idea').press('Enter')
  await page.clock.runFor(22_000)
  await expect(page.locator('.g-umsg')).toContainText('시장 전반')
  await page.reload()
  await expect(page.locator('.g-umsg')).toContainText('시장 전반')
  await (await openHistory(page)).fill('시장 전반')
  await expect(page.locator('.g-hist-row')).toHaveCount(1)
  expect(audit).toEqual({ errors: [], blocked: [] })
})

test('제목·가시 원문·이미 표시된 답변은 AND 검색하며 미출력 답변은 검색하지 않는다', async ({ page, baseURL }) => {
  const audit = await setup(page, baseURL)
  await page.addInitScript(() => {
    const now = Date.now()
    // 명시적인 과거 Mock 표시 입력. 실제 모델 출력이나 실행 결과가 아닙니다.
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'visible-answer-fixture', homeDraft: '', sessions: [{
      id: 'visible-answer-fixture', title: '검수 제목', renamed: true, idea: '내부 해석 메모', draft: '', pair: '', mode: '',
      timeframe: '', risk: '', takeProfit: '', researchStatus: '초안', phase: 'mode', workspace: 'conversation', updatedAt: now,
      turns: [{ id: 'visible-answer-turn', question: '표시된 사용자 질문', answer: '표시된 수수료 설명', fullAnswer: '미출력 합성 검수값',
        suggestions: [], phase: 'mode', status: 'done', startedAt: now - 10_000, finishedAt: now - 5_000 }],
    }] }))
  })
  await page.goto('/')
  await expect(page.locator('.g-umsg')).toHaveText('표시된 사용자 질문')
  await expect(page.locator('.client-source-main')).toContainText('표시된 수수료 설명')
  await expect(page.locator('.client-source-main')).not.toContainText('미출력 합성 검수값')
  const search = await openHistory(page)
  for (const query of ['검수 수수료', '사용자 수수료', '표시된 질문']) {
    await search.fill(query)
    await expect(page.locator('.g-hist-row')).toHaveCount(1)
  }
  await search.fill('미출력 합성 검수값')
  await expect(page.locator('.g-hist-row')).toHaveCount(0)
  expect(audit).toEqual({ errors: [], blocked: [] })
})

test('위임 intake에 실제 표시된 idea는 question에 없는 문구도 검색 가능하다', async ({ page, baseURL }, info) => {
  const audit = await setup(page, baseURL)
  await page.addInitScript(() => {
    const now = Date.now()
    // 위임 시작 화면의 명시 Mock 입력만 공급합니다. 검증/완료/거래 상태는 만들지 않습니다.
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'visible-delegation-fixture', homeDraft: '', sessions: [{
      id: 'visible-delegation-fixture', title: '위임 검수', renamed: true, idea: '가시위임아이디어고유단어', draft: '', pair: '', mode: '',
      timeframe: '', risk: '', takeProfit: '', researchStatus: '초안', phase: 'mode', workspace: 'delegation', updatedAt: now,
      turns: [{ id: 'delegation-visible-turn', question: '다음 질문', answer: '표시 답변', fullAnswer: '표시 답변',
        suggestions: [], phase: 'mode', status: 'done', startedAt: now - 10_000, finishedAt: now - 5_000 }],
    }] }))
  })
  await page.goto('/')
  await expect(page.locator('.tf-intake .tf-user-message')).toHaveText('가시위임아이디어고유단어')
  const question = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].turns[0].question as string)
  expect(question).not.toContain('가시위임아이디어고유단어')
  await page.screenshot({ path: info.outputPath('visible-delegation-idea.png') })
  await (await openHistory(page)).fill('가시위임아이디어고유단어')
  await expect(page.locator('.g-hist-row')).toHaveCount(1)
  await info.attach('visible-delegation-idea.json', { body: JSON.stringify({ source: 'explicit-mock', ideaVisible: true, questionContainsIdea: false, rows: 1, audit }), contentType: 'application/json' })
  expect(audit).toEqual({ errors: [], blocked: [] })
})
