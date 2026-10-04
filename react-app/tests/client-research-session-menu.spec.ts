import { expect, test, type Locator, type Page } from '@playwright/test'

// Source 9fbff821: gOpen/gShowActivity call gChead (11831/11644), which
// retains g-chead-dots for the current session (10633). This is UI parity,
// not permission to add native service mutations or a research producer.
const id = 'research-session-menu'
const title = '연구 계획의 긴 제목과 문서 초안을 유지하면서 현재 연구를 관리합니다 '.repeat(3)
const draft = '문서에서 아직 보내지 않은 질문'

async function mount(page: Page, baseURL: string | undefined, width: number, signedIn = true, withPlanTurn = false) {
  if (!baseURL) throw new Error('Local baseURL required')
  const errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method())
    return url.origin === new URL(baseURL).origin && !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(request.method())
      ? route.continue() : route.abort()
  })
  await page.clock.install()
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, title, draft, signedIn, withPlanTurn }) => {
    if (sessionStorage.getItem('research-menu-seeded')) return
    sessionStorage.setItem('research-menu-seeded', '1')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수', email: 'menu@example.test' }))
    localStorage.setItem('tethLang', 'ko')
    const session = { id, title, renamed: true, idea: '원래 연구 아이디어', draft: '대화 초안', pair: 'BTC/USDT', mode: 'dip',
      phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'research', researchStatus: '초안',
      turns: withPlanTurn ? [{ id: 'plan-turn', question: '원래 연구 아이디어', answer: '계획', fullAnswer: '계획', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }] : [], updatedAt: 1 }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [session, { ...session, id: 'other', title: '다른 연구', workspace: 'conversation' }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 0, status: 'idle', view: 'activity', questions: [], clockVersion: 1 }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'plan', tabs: ['plan'], drafts: { plan: draft }, replies: [], rowDrafts: {}, positions: {}, edits: {}, paper: false, paused: false }))
    for (const prefix of ['teth-client-research-documents:', 'teth-research-preview:restored:']) sessionStorage.setItem(prefix + 'other', sessionStorage.getItem(prefix + id)!)
  }, { id, title, draft, signedIn, withPlanTurn })
  await page.goto('/')
  await expect(page.locator('.rw-header')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { errors, writes }
}

const menu = (page: Page) => page.locator('.rw-header').getByRole('button', { name: '대화 메뉴', exact: true })
async function reachable(control: Locator) {
  expect(await control.evaluate(node => {
    const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return r.width >= 32 && r.height >= 32 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && !!hit && node.contains(hit)
  })).toBe(true)
}
async function stored(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions)
}
async function caches(page: Page, sessionId = id) {
  return page.evaluate(id => ['teth-client-research-documents:', 'teth-research-preview:restored:'].map(prefix => sessionStorage.getItem(prefix + id)), sessionId)
}
async function titleGeometry(page: Page) {
  return page.locator('.rw-heading').evaluate(node => ({
    heading: node.getBoundingClientRect().width,
    text: node.querySelector('.g-title span')!.getBoundingClientRect().width,
    flex: getComputedStyle(node).flex,
    wrap: getComputedStyle(node.closest('.rw-header')!).flexWrap,
    padding: getComputedStyle(node.closest('.rw-header')!).padding,
  }))
}

for (const width of [320, 390, 1440]) {
  test(`연구 메뉴 ${width}px: 긴 제목·키보드 이름 변경/취소와 문서 초안 보존`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, width), trigger = menu(page)
    await expect(trigger).toBeVisible()
    await reachable(trigger)
    const geometry = await titleGeometry(page)
    await info.attach('idle-title-geometry.json', { body: JSON.stringify(geometry), contentType: 'application/json' })
    expect(geometry.heading).toBeGreaterThanOrEqual(60)
    expect(geometry.text).toBeGreaterThanOrEqual(32)
    const documentNode = await page.locator('.rw-workspace .g-doc').elementHandle()
    await trigger.focus(); await trigger.press('Enter')
    const popup = page.locator('.client-session-pop')
    await expect(popup.getByRole('button', { name: '이름 변경', exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(popup.getByRole('button', { name: '삭제', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(popup.getByRole('button', { name: '이름 변경', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(popup.getByRole('button', { name: '삭제', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await popup.getByRole('textbox').fill('취소할 제목')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    expect((await stored(page)).find((s: { id: string }) => s.id === id).title).toBe(title)
    await trigger.press('Enter'); await page.keyboard.press('Enter')
    await popup.getByRole('textbox').fill('문서에서 변경한 제목')
    await popup.getByRole('textbox').press('Enter')
    await expect(trigger).toBeFocused()
    await expect(page.locator('.rw-heading')).toContainText('문서에서 변경한 제목')
    await expect(page.locator('.rw-composer textarea')).toHaveValue(draft)
    expect(await page.locator('.rw-workspace .g-doc').evaluate((node, old) => node === old, documentNode)).toBe(true)
    expect((await stored(page)).find((s: { id: string }) => s.id === 'other').title).toBe('다른 연구')
    await trigger.click(); await reachable(popup.getByRole('button', { name: '이름 변경', exact: true }))
    await page.screenshot({ path: info.outputPath(`research-menu-${width}.png`) })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
    await expect(page.locator('.g-composer textarea')).toHaveValue('대화 초안')
    await expect(page.locator('.g-title')).toContainText('문서에서 변경한 제목')
    expect(JSON.parse((await caches(page))[0]!).drafts.plan).toBe(draft)
    expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([])
  })

  test(`연구 메뉴 ${width}px: 삭제 확인 취소·다시 열기·명시 삭제의 세션 격리`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, width), trigger = menu(page)
    const otherCache = await caches(page, 'other')
    await expect(trigger).toBeVisible()
    await trigger.click()
    const popup = page.locator('.client-session-pop')
    await popup.getByRole('button', { name: '삭제', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    expect((await stored(page)).map((s: { id: string }) => s.id)).toEqual([id, 'other'])
    await expect(page.locator('.rw-composer textarea')).toHaveValue(draft)
    await trigger.click()
    await popup.getByRole('button', { name: '삭제', exact: true }).click()
    await reachable(popup.locator('.danger'))
    await popup.locator('.danger').click()
    await expect(page.locator('.client-home-content textarea')).toBeVisible()
    expect((await stored(page)).map((s: { id: string }) => s.id)).toEqual(['other'])
    expect.soft(await caches(page)).toEqual([null, null])
    await page.clock.fastForward(120_000)
    expect(await caches(page)).toEqual([null, null])
    expect(await caches(page, 'other')).toEqual(otherCache)
    expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([])
  })

  test(`연구 메뉴 ${width}px: 진행 중 메뉴를 조작해도 활동·문서 맥락을 재시작하지 않는다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, width)
    await page.getByRole('button', { name: '연구 시작', exact: true }).click()
    await page.clock.fastForward(12_000)
    await expect(menu(page)).toBeVisible()
    await reachable(menu(page))
    const artifacts = page.getByRole('button', { name: '연구 문서 열기', exact: true })
    if (await artifacts.isVisible()) {
      await reachable(artifacts)
      await artifacts.click()
      await page.keyboard.press('Escape')
      await expect(artifacts).toBeFocused()
      await expect(artifacts).toHaveAttribute('aria-expanded', 'false')
    }
    const log = page.locator('.g-research-log'), original = await log.elementHandle()
    const count = await log.locator('.g-act-row').count()
    expect(count).toBeGreaterThan(0)
    await menu(page).click()
    await reachable(page.locator('.client-session-pop').getByRole('button', { name: '이름 변경', exact: true }))
    await page.keyboard.press('Escape')
    await expect(menu(page)).toBeFocused()
    await page.clock.fastForward(10_000)
    expect(await log.evaluate((node, old) => node === old, original)).toBe(true)
    expect(await log.locator('.g-act-row').count()).toBeGreaterThan(count)
    await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
    expect((await stored(page)).find((s: { id: string }) => s.id === id).workspace).toBe('research')
    expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([])
  })
}

for (const width of [320, 360, 361, 375, 390, 1440]) test(`게스트 연구 ${width}px: idle 제목과 메뉴가 읽히고 가려지지 않는다`, async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, width, false)
  const geometry = await titleGeometry(page)
  await info.attach('guest-title-geometry.json', { body: JSON.stringify(geometry), contentType: 'application/json' })
  console.info('Guest title geometry', width, JSON.stringify(geometry))
  expect(geometry.heading).toBeGreaterThanOrEqual(60)
  expect(geometry.text).toBeGreaterThanOrEqual(32)
  await reachable(menu(page))
  if (width === 320) await page.screenshot({ path: info.outputPath('guest-research-title-320.png') })
  await menu(page).click()
  await reachable(page.locator('.client-session-pop').getByRole('button', { name: '이름 변경', exact: true }))
  await page.keyboard.press('Escape')
  await expect(menu(page)).toBeFocused()
  expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([])
})

test('문서 writer는 삭제 전 소유권만 무효화하고 동일 id의 새 소유자와 다른 연구를 보존한다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 1440)
  const result = await page.evaluate(async () => {
    const path = '/src/client-research-cache.ts'
    const cache = await import(/* @vite-ignore */ path)
    const id = 'writer-lifecycle', other = 'writer-other'
    const old = cache.createResearchDocumentWriter(id)
    const first = old({ draft: 'before deletion' })
    const separate = cache.createResearchDocumentWriter(other)
    separate({ draft: 'separate' })
    cache.forgetResearchDocumentMemory(id)
    sessionStorage.removeItem(`teth-client-research-documents:${id}`)
    const staleAfterDelete = old({ draft: 'stale cleanup' })
    const afterDelete = cache.readResearchDocumentCache(id)
    const next = cache.createResearchDocumentWriter(id)
    const newSaved = next({ draft: 'new owner' })
    const staleAfterReopen = old({ draft: 'stale delayed callback' })
    return { first, staleAfterDelete, afterDelete, newSaved, staleAfterReopen, current: cache.readResearchDocumentCache(id), other: cache.readResearchDocumentCache(other) }
  })
  expect(result).toEqual({ first: true, staleAfterDelete: false, afterDelete: null, newSaved: true, staleAfterReopen: false, current: { draft: 'new owner' }, other: { draft: 'separate' } })
  await page.locator('.rw-composer textarea').fill('정상 pagehide 저장')
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  expect(JSON.parse((await caches(page))[0]!).drafts.plan).toBe('정상 pagehide 저장')
  expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([])
})

test('진행 중 연구 삭제 후 unmount와 시간이 캐시를 부활시키지 않는다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 320)
  const otherCache = await caches(page, 'other')
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await page.clock.fastForward(12_000)
  await menu(page).click()
  await page.locator('.client-session-pop').getByRole('button', { name: '삭제', exact: true }).click()
  await page.locator('.client-session-pop .danger').click()
  await expect(page.locator('.client-home-content textarea')).toBeVisible()
  expect.soft(await caches(page)).toEqual([null, null])
  await page.clock.fastForward(120_000)
  expect(await caches(page)).toEqual([null, null])
  expect(await caches(page, 'other')).toEqual(otherCache)
  expect((await stored(page)).map((s: { id: string }) => s.id)).toEqual(['other'])
  expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([])
})

test('스크롤 저장 지연 250ms 이전 정상 대화 왕복은 읽던 위치와 초안을 보존한다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 390, true, true)
  await page.setViewportSize({ width: 390, height: 360 })
  const otherCache = await caches(page, 'other')
  const scroll = page.locator('.rw-scroll')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const before = JSON.parse((await caches(page))[0]!).positions.plan ?? 0
  await scroll.hover()
  await page.mouse.wheel(0, 300)
  await page.clock.runFor(32)
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(100)
  const position = await scroll.evaluate(node => node.scrollTop)
  expect(JSON.parse((await caches(page))[0]!).positions.plan ?? 0).toBe(before)
  const back = page.getByRole('button', { name: '대화로 돌아가기', exact: true })
  await back.focus()
  await back.press('Enter')
  await expect(page.locator('.g-composer textarea')).toHaveValue('대화 초안')
  const saved = JSON.parse((await caches(page))[0]!)
  expect(saved.positions.plan).toBeCloseTo(position, 0)
  expect(saved.drafts.plan).toBe(draft)
  const reopen = page.getByRole('button', { name: /연구 계획.*(?:확인|크게 보기)/ })
  await reopen.focus()
  await reopen.press('Enter')
  await page.clock.runFor(32)
  await expect(scroll).toBeVisible()
  expect(await scroll.evaluate(node => node.scrollTop)).toBeCloseTo(position, 0)
  await expect(page.locator('.rw-composer textarea')).toHaveValue(draft)
  expect(await caches(page, 'other')).toEqual(otherCache)
  expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([])
})
