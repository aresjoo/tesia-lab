import { expect, test, type Page } from '@playwright/test'

const now = Date.UTC(2026, 9, 5, 12)
const documents = { plan: '연구 계획', report: '검증 결과', bt2: '백테스트 v2' } as const
const root = '.client-restored-research[data-source="client-fixture"]'

async function mount(page: Page, baseURL: string | undefined, doc: keyof typeof documents, saved = false) {
  if (!baseURL) throw new Error('Loopback fixture baseURL required')
  // A real short desktop viewport makes the unchanged plan overflow too.
  if ((page.viewportSize()?.width ?? 0) > 700) await page.setViewportSize({ width: 1280, height: 640 })
  const origin = new URL(baseURL).origin, owner = `document-first-question-${doc}`
  const errors: string[] = [], blocked: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort()
    }
    return route.continue()
  })
  await page.clock.install({ time: new Date(now) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, doc, now, saved }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    // An explicitly supplied historical Mock UI, not a fabricated real job.
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: owner, homeDraft: '', sessions: [{
      id: owner, title: '첫 문서 질문용 명시 Mock', renamed: true, idea: '첫 문서 질문용 명시 Mock', draft: '',
      pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', phase: 'plan',
      workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: now,
    }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${owner}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }))
    sessionStorage.setItem(`teth-client-research-documents:${owner}`, JSON.stringify({ active: doc, tabs: [doc], drafts: {}, rowDrafts: {}, replies: [],
      positions: saved ? { [doc]: 0 } : {}, edits: {}, paper: false, paused: false }))
  }, { owner, doc, now, saved })
  await page.goto('/?ui-debug=1')
  await expect(page.locator(root)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(80)
  return { errors, blocked }
}

async function geometry(page: Page) {
  return page.locator(`${root} .rw-scroll`).evaluate(element => ({ top: element.scrollTop, total: element.scrollHeight, height: element.clientHeight,
    gap: element.scrollHeight - element.scrollTop - element.clientHeight }))
}

test('global false 의도 뒤 새 미방문 문서를 열고 질문해도 따라가기를 임의 재장착하지 않는다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'report')
  const scroll = page.locator(`${root} .rw-scroll`)
  await scroll.hover(); await page.mouse.wheel(0, 10_000)
  await expect.poll(async () => (await geometry(page)).gap).toBeLessThan(2)
  await scroll.hover(); await page.mouse.wheel(0, -180)
  await expect.poll(async () => (await geometry(page)).gap).toBeGreaterThan(60)
  const reportReading = await geometry(page)
  const trigger = page.locator('.rw-mobile-artifacts[aria-expanded]')
  if (await trigger.isVisible()) await trigger.click()
  await page.locator('.rw-artifact').filter({ hasText: /^연구 계획$/ }).click()
  await page.clock.runFor(80)
  const opened = await geometry(page)
  expect(opened.top).toBe(0); expect(opened.gap).toBeGreaterThan(60)
  await page.getByLabel('연구 계획에 질문', { exact: true }).fill('기존 전역 상향 읽기 의도로 새 문서 질문, 명시 Mock')
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await page.clock.runFor(80)
  const asked = await geometry(page)
  await info.attach('new-document-inherited-reading.json', { body: JSON.stringify({ reportReading, opened, asked, audit }), contentType: 'application/json' })
  expect(asked.top).toBe(opened.top)
  await expect(page.getByRole('button', { name: '↓ 새 응답 보기', exact: true })).toBeVisible()
  expect(audit).toEqual({ errors: [], blocked: [] })
})


for (const doc of Object.keys(documents) as (keyof typeof documents)[]) {
  test(`${doc} 새 긴 문서의 첫 질문은 위에서 열렸다는 이유만으로 nonforce follow를 잃지 않는다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, doc)
    const before = await geometry(page)
    expect(before.top).toBe(0)
    expect(before.gap, 'The unchanged document must itself overflow').toBeGreaterThan(60)
    await page.getByLabel(`${documents[doc]}에 질문`, { exact: true }).fill('새 문서 첫 질문의 따라가기 확인, 명시 Mock')
    await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
    await page.clock.runFor(80)
    const asked = await geometry(page)
    console.info('FIRST_DOCUMENT_QUESTION', doc, JSON.stringify({ before, asked }))
    await info.attach('first-document-question.json', { body: JSON.stringify({ doc, before, asked, audit }), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('first-document-question.png') })
    expect(asked.total).toBeGreaterThan(before.total)
    expect(asked.gap, 'Original G.stick remains unset/true after gOpen top=0; gDocThread nonforce follows').toBeLessThan(2)
    await expect(page.getByRole('button', { name: '↓ 새 응답 보기', exact: true })).toHaveCount(0)
    expect(audit).toEqual({ errors: [], blocked: [] })
  })

  test(`${doc} 저장된 상향 읽기 위치는 첫 질문 기본 follow로 덮지 않는다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, doc, true)
    const before = await geometry(page)
    expect(before.gap).toBeGreaterThan(60)
    await page.getByLabel(`${documents[doc]}에 질문`, { exact: true }).fill('저장된 읽기 의도를 유지하는 명시 Mock')
    await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
    await page.clock.runFor(80)
    const asked = await geometry(page)
    await info.attach('saved-document-reading.json', { body: JSON.stringify({ doc, before, asked, audit }), contentType: 'application/json' })
    expect(asked.top).toBe(before.top)
    await expect(page.getByRole('button', { name: '↓ 새 응답 보기', exact: true })).toBeVisible()
    expect(audit).toEqual({ errors: [], blocked: [] })
  })

  test(`${doc} 실제 위로 읽기와 같은 페이지 cache follow=false는 문서 왕복에도 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, doc)
    const scroll = page.locator(`${root} .rw-scroll`)
    await scroll.hover(); await page.mouse.wheel(0, 10_000)
    await expect.poll(async () => (await geometry(page)).gap).toBeLessThan(2)
    await scroll.hover(); await page.mouse.wheel(0, -180)
    await expect.poll(async () => (await geometry(page)).gap).toBeGreaterThan(60)
    const reading = await geometry(page)
    await page.getByLabel(`${documents[doc]}에 질문`, { exact: true }).fill('위로 읽기 뒤 첫 질문, 명시 Mock')
    await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
    await page.clock.runFor(80)
    expect((await geometry(page)).top).toBe(reading.top)
    const other = doc === 'plan' ? '가설' : '연구 계획'
    const trigger = page.locator('.rw-mobile-artifacts[aria-expanded]')
    if (await trigger.isVisible()) await trigger.click()
    await page.locator('.rw-artifact').filter({ hasText: new RegExp(`^${other}$`) }).click()
    await page.getByRole('tab', { name: documents[doc], exact: true }).click()
    await page.clock.runFor(80)
    const returned = await geometry(page)
    await page.getByLabel(`${documents[doc]}에 질문`, { exact: true }).fill('같은 페이지 문서 cache의 false 유지, 명시 Mock')
    await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
    await page.clock.runFor(80)
    const asked = await geometry(page)
    await info.attach('document-reading-return.json', { body: JSON.stringify({ doc, reading, returned, asked, audit }), contentType: 'application/json' })
    expect(returned.top).toBe(reading.top)
    expect(asked.top).toBe(reading.top)
    expect(audit).toEqual({ errors: [], blocked: [] })
  })
}
