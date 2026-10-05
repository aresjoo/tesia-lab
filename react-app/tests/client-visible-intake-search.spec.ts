import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const firstQuestion = '기록에 표시된 첫 투자 질문'
const shownAnswer = '기록에 표시된 거래 비용 설명'
const hiddenInterpretation = '해석 전용으로 보존된 고유 문구'
const visibleDelegationIdea = '전에 표시된 위임 아이디어'
const title = '고객이 직접 정한 연구 제목'
const id = 'visible-intake-search-fixture'

async function mount(page: Page, baseURL: string | undefined, workspace: 'research' | 'delegation', foreign = false) {
  if (!baseURL) throw new Error('Local baseURL required')
  const origin = new URL(baseURL).origin, errors: string[] = [], blocked: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname === '/api' || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ workspace, foreign, firstQuestion, shownAnswer, hiddenInterpretation, visibleDelegationIdea, title, id }) => {
    if (sessionStorage.getItem('visible-intake-seeded')) return
    sessionStorage.setItem('visible-intake-seeded', '1')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '명시 UI 검수', email: 'visible-intake@example.test' }))
    localStorage.setItem('tethLang', 'ko')
    const now = Date.now()
    // 명시 UI 복원 fixture. 실제 모델/연구 완료/계정 인증을 만들지 않습니다.
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title, renamed: true, idea: workspace === 'delegation' ? visibleDelegationIdea : hiddenInterpretation,
      draft: '', pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', phase: 'plan',
      workspace, tradingReady: false, researchStatus: '초안', updatedAt: now,
      ...(foreign ? { sharedCopy: { owner: 'different-owner@example.test', nick: '보존된 원작자', active: false, confirmedAt: now, returnId: null } } : {}),
      turns: [{ id: 'visible-first-turn', question: firstQuestion, requestText: hiddenInterpretation,
        answer: shownAnswer, fullAnswer: shownAnswer, phase: 'plan', status: 'done', suggestions: [], startedAt: now - 10_000, finishedAt: now - 5_000 }],
    }] }))
  }, { workspace, foreign, firstQuestion, shownAnswer, hiddenInterpretation, visibleDelegationIdea, title, id })
  await page.goto('/')
  return { errors, blocked }
}

async function history(page: Page) {
  const control = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  if (!await control.isVisible()) {
    const opener = page.locator(page.viewportSize()!.width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button')
    await opener.focus(); await opener.click()
  }
  await control.click()
  return page.getByRole('searchbox', { name: '연구 기록 검색', exact: true })
}

async function archivedSearch(page: Page) {
  const search = await history(page)
  for (const query of [firstQuestion, shownAnswer, title]) {
    await search.fill(query)
    await expect(page.locator('.g-hist-row')).toHaveCount(1)
  }
  await search.fill(hiddenInterpretation)
  await expect(page.locator('.g-hist-row')).toHaveCount(0)
  return search
}

test('연구 문서와 대화 왕복 후 첫 질문·답변 기록은 검색되고 문서 질문과 숨은 해석은 섞이지 않는다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'research')
  await expect(page.locator('.rw-heading')).toContainText(title)
  await expect(page.locator('.client-source-main')).not.toContainText(hiddenInterpretation)
  const documentQuestion = '문서에서만 보낸 고유 질문'
  await page.locator('.rw-composer textarea').fill(documentQuestion)
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await expect(page.locator('.rw-user-message')).toHaveText(documentQuestion)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-umsg')).toHaveText(firstQuestion)
  await expect(page.locator('.client-source-main')).toContainText(shownAnswer)
  await page.getByRole('button', { name: /연구 계획.*(?:확인|크게 보기)/ }).click()
  await expect(page.locator('.rw-user-message')).toHaveText(documentQuestion)
  await page.screenshot({ path: info.outputPath('research-document-roundtrip.png') })
  const search = await archivedSearch(page)
  // 원본 gHistText는 convo만 검색하고 doc thread는 포함하지 않습니다.
  await search.fill(documentQuestion)
  await expect(page.locator('.g-hist-row')).toHaveCount(0)
  await search.fill(firstQuestion)
  await page.locator('.g-hist-row').click()
  await expect(page.locator('.rw-user-message')).toHaveText(documentQuestion)
  await page.reload()
  await expect(page.locator('.rw-user-message')).toHaveText(documentQuestion)
  await archivedSearch(page)
  expect(audit).toEqual({ errors: [], blocked: [] })
})

for (const workspace of ['research', 'delegation'] as const) {
  test(`다른 계정 ${workspace}: intake는 보호하며 기존 첫 질문·답변 기록은 삭제하거나 해석 문구로 대체하지 않는다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, workspace, true)
    await expect(page.locator('.client-inline-recovery')).toContainText('현재 계정의 전략 기록을 다시 확인해주세요.')
    await expect(page.locator('.tf-intake,.rw-header')).toHaveCount(0)
    await expect(page.locator('.client-source-main')).not.toContainText(hiddenInterpretation)
    await expect(page.locator('.client-source-main')).not.toContainText(visibleDelegationIdea)
    const saved = await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))
    await page.screenshot({ path: info.outputPath('foreign-owner-intake-protected.png') })
    const search = await archivedSearch(page)
    if (workspace === 'delegation') {
      // 이전에 실제 표시된 위임 idea는 과거 기록으로 유지합니다. 계정 권한을 변경하지 않습니다.
      await search.fill(visibleDelegationIdea)
      await expect(page.locator('.g-hist-row')).toHaveCount(1)
    }
    await search.fill(firstQuestion)
    await page.locator('.g-hist-row').click()
    await expect(page.locator('.client-inline-recovery')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(saved)
    await page.reload()
    await expect(page.locator('.client-inline-recovery')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(saved)
    expect(audit).toEqual({ errors: [], blocked: [] })
  })
}
