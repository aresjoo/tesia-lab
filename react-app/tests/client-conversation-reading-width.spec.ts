import { expect, test, type Page } from '@playwright/test'

// 원본621cbed index.html:589 g-doc820 / :970 g-amsg720.
// 실제 공개 셸의 명시 저장 미리보기이며 서버 응답이나 Native 인수 증거가 아니다.
const draft = '폭이 바뀌어도 전송하지 않을 원문 초안 0123456789'
const answer = [
  '명시 미리보기 답변입니다. 원본의 읽기 폭을 유지하면서 긴 문장을 읽습니다. '.repeat(14),
  `긴영문단어 ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(18)}`,
  `긴한글문장 ${'공급된원문을삭제하거나바꾸지않고화면안에서줄바꿈합니다'.repeat(18)}`,
].join('\n\n')

async function mount(page: Page, baseURL: string | undefined, width: number) {
  if (!baseURL) throw new Error('로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin, blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.setViewportSize({ width, height: width <= 860 ? 844 : 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // 이전 문서의 pagehide 저장 이후, 새 문서 시작에서만 시드한다.
  await page.addInitScript(({ draft, answer }) => {
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    const id = 'conversation-reading-width'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title: '원본 답변 읽기 폭 검수', renamed: true, idea: '원본 답변 읽기 폭 검수', draft,
      pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%',
      researchStatus: '초안', workspace: 'conversation', updatedAt: 1700000000000,
      turns: [{ id: 'reading-turn', question: '긴 답변의 원문을 보여주세요.', answer, fullAnswer: answer,
        phase: 'plan', status: 'done', suggestions: [], startedAt: 1700000000000 }],
    }] }))
  }, { draft, answer })
  await page.goto('/')
  await expect(page.locator('.client-main-existing .client-conversation-frame')).toBeVisible()
  await expect(page.locator('.g-amsg[data-response-state="done"]')).toHaveCount(1)
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}

async function readingGeometry(page: Page, zoom = 1) {
  const response = page.locator('.g-amsg[data-response-state="done"]')
  const document = page.locator('.g-doc:visible').filter({ has: response })
  await expect(response).toHaveCSS('max-width', '720px')
  await expect(document).toHaveCSS('max-width', '820px')
  await expect(response.locator('p')).toHaveText(answer.split('\n\n'))
  const geometry = await response.evaluate(element => {
    const doc = element.closest('.g-doc')!, scroll = element.closest('.g-scroll')!
    const r = element.getBoundingClientRect(), d = doc.getBoundingClientRect(), css = getComputedStyle(doc)
    return { responseWidth: r.width, documentWidth: d.width, x: r.x, right: r.right,
      padding: [css.paddingLeft, css.paddingRight],
      overflow: [element, ...element.querySelectorAll('p'), doc, scroll, window.document.documentElement]
        .map(node => ({ scroll: node.scrollWidth, client: node.clientWidth })) }
  })
  expect(geometry.responseWidth).toBeGreaterThan(0)
  expect(geometry.responseWidth).toBeLessThanOrEqual(720 * zoom + 1)
  expect(geometry.documentWidth).toBeLessThanOrEqual(820 * zoom + 1)
  expect(geometry.x).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  for (const size of geometry.overflow) expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
  return geometry
}

for (const width of [320, 390, 860, 1440]) {
  test(`공개 대화 ${width}px: 원본 본문720·문서820과 긴 영어·한글의 줄바꿈 및 초안을 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, width)
    const input = page.locator('.g-composer textarea'), originalInput = await input.elementHandle()
    await expect(input).toHaveValue(draft)
    await input.focus()
    await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 12))
    const geometry = await readingGeometry(page)
    if (width === 1440) {
      expect(geometry.documentWidth).toBeCloseTo(820, 1)
      expect(geometry.responseWidth).toBeCloseTo(720, 1)
      expect(geometry.padding).toEqual(['28px', '28px'])
    }
    await page.locator('.g-scroll').evaluate(node => { node.scrollTop = 0 })
    await expect(input).toBeFocused()
    await expect(input).toHaveValue(draft)
    expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true)
    expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([3, 12])
    await page.screenshot({ path: info.outputPath(`conversation-reading-${width}.png`) })
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

test('공개 대화 확대·모바일 왕복은 본문만 재배치하고 같은 입력 DOM·원문·선택 영역을 유지한다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 1440)
  const input = page.locator('.g-composer textarea'), originalInput = await input.elementHandle()
  const edited = `${draft} 사용자가 추가한 문장`
  await input.fill(edited)
  await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(4, 15))
  const preserved = async () => {
    await expect(input).toHaveValue(edited)
    await expect(input).toBeFocused()
    expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true)
    expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([4, 15])
  }
  await readingGeometry(page)
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await readingGeometry(page, 2)
  await preserved()
  await page.evaluate(() => { document.documentElement.style.zoom = '' })
  for (const width of [860, 390, 320, 1440]) {
    await page.setViewportSize({ width, height: width <= 860 ? 844 : 900 })
    await readingGeometry(page)
    await preserved()
  }
  // CSS 확대 검사이며 브라우저 메뉴 확대/Native 차트 크기 검증으로 확대하지 않는다.
  expect(audit).toEqual({ blocked: [], errors: [] })
})
