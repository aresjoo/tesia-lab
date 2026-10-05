import { expect, test, type Page } from '@playwright/test'

// Public source Mock replay only. These fixtures are supplied before mount;
// no real research/job state, provider response or completion is manufactured.
const owner = 'research-follow-intent'
const now = Date.UTC(2026, 9, 4, 12)
const root = '.client-restored-research[data-source="client-fixture"]'

async function mount(page: Page, baseURL: string | undefined, active: 'plan' | 'activity', status: 'playing' | 'paused', position?: number) {
  if (!baseURL) throw new Error('Local fixture baseURL required')
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
  await page.clock.install({ time: new Date(now) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, active, status, position, now }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: owner, homeDraft: '', sessions: [{
      id: owner, title: '따라가기 검수용 명시 Mock 연구', renamed: true, idea: '따라가기 검수용 명시 Mock 연구', draft: '',
      pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', phase: 'plan',
      workspace: 'research', researchStatus: '진행 중', turns: [], updatedAt: 1,
    }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${owner}`, JSON.stringify({
      seconds: 65, status, view: 'activity', questions: [], clockVersion: 1,
      ...(status === 'playing' ? { clockStartedAt: now - 65_000 } : {}),
    }))
    sessionStorage.setItem(`teth-client-research-documents:${owner}`, JSON.stringify({
      active, tabs: active === 'plan' ? ['plan'] : ['activity', 'plan'], drafts: {}, rowDrafts: {}, replies: [],
      positions: position === undefined ? {} : { activity: position }, edits: {}, paper: false, paused: false,
    }))
  }, { owner, active, status, position, now })
  await page.goto('/?ui-debug=1')
  await expect(page.locator(root)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(80)
  return { blocked, errors }
}

async function geometry(page: Page) {
  return page.locator(`${root} .rw-scroll`).evaluate(element => ({
    top: element.scrollTop, height: element.clientHeight, total: element.scrollHeight,
    gap: element.scrollHeight - element.clientHeight - element.scrollTop,
  }))
}

for (const entry of ['mount', 'plan-button'] as const) test(`진행 중 첫 activity ${entry}: 읽기 위치가 없으면 원본처럼 최신 기록을 따라간다`, async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, entry === 'mount' ? 'activity' : 'plan', 'playing')
  if (entry === 'plan-button') await page.getByRole('button', { name: '연구 과정 보기', exact: true }).click()
  await expect(page.getByRole('tab', { name: '연구 과정', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(80)
  const initial = await geometry(page)
  console.info('FIRST_ACTIVITY', entry, JSON.stringify(initial))
  expect(initial.total - initial.height, 'Fixture must overflow by more than the following threshold').toBeGreaterThan(60)
  await page.screenshot({ path: info.outputPath('first-activity.png') })
  await info.attach('first-activity.json', { body: JSON.stringify({ entry, initial, audit }), contentType: 'application/json' })
  expect.soft(initial.gap, 'Source G.stick !== false follows without a prior reading gesture').toBeLessThan(2)
  await page.clock.runFor(7_000)
  const next = await geometry(page)
  console.info('NEXT_ACTIVITY', entry, JSON.stringify(next))
  await info.attach('next-activity.json', { body: JSON.stringify({ entry, next, audit }), contentType: 'application/json' })
  expect(next.total).toBeGreaterThan(initial.total)
  expect(next.gap, 'Later Mock entries must continue following the latest record').toBeLessThan(2)
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('저장된 activity 읽기 위치는 첫 진입 follow 기본값으로 덮지 않는다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'activity', 'playing', 0)
  const before = await geometry(page)
  expect(before.gap).toBeGreaterThan(60)
  await page.clock.runFor(7_000)
  const after = await geometry(page)
  expect(after.total).toBeGreaterThan(before.total)
  expect(after.top).toBe(before.top)
  await info.attach('saved-reading.json', { body: JSON.stringify({ before, after, audit }), contentType: 'application/json' })
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('가설 L5 관측: 정지 중 질문의 자동 bottom은 원본에 없는 강제 follow 의도를 만들지 않는다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'activity', 'paused', 0)
  const before = await geometry(page)
  expect(before.gap).toBeGreaterThan(60)
  await page.getByLabel('연구 과정에 질문').fill('현재 문서에 남기는 명시 Mock 질문')
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await page.clock.runFor(80)
  const asked = await geometry(page)
  expect(asked.top).toBe(before.top)
  await page.locator('.rw-preview-tools summary').click()
  await page.getByRole('button', { name: '계속 재생', exact: true }).click()
  await page.clock.runFor(7_000)
  const resumed = await geometry(page)
  console.info('PAUSED_ASK_RESUME', JSON.stringify({ before, asked, resumed }))
  expect(resumed.total).toBeGreaterThan(asked.total)
  expect(resumed.top).toBe(asked.top)
  expect(resumed.gap).toBeGreaterThan(40)
  await page.screenshot({ path: info.outputPath('paused-ask-resume.png') })
  await info.attach('paused-ask-resume.json', { body: JSON.stringify({ before, asked, resumed, audit }), contentType: 'application/json' })
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('원본 nonforce 질문: 실제 상향 읽기 뒤 paused activity에 질문해도 읽던 위치를 빼앗지 않는다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'activity', 'paused')
  const scroll = page.locator(`${root} .rw-scroll`)
  const initial = await geometry(page)
  expect(initial.gap).toBeLessThan(2)
  await scroll.hover()
  await page.mouse.wheel(0, -180)
  await page.clock.runFor(250)
  await expect.poll(async () => (await geometry(page)).gap).toBeGreaterThan(60)
  const reading = await geometry(page)
  expect(reading.gap).toBeGreaterThan(60)
  expect(reading.top).toBeLessThan(initial.top - 60)
  await page.getByLabel('연구 과정에 질문').fill('위에서 읽던 기록과 함께 남기는 명시 Mock 질문')
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await page.clock.runFor(80)
  const asked = await geometry(page)
  console.info('NONFORCE_ASK_READING', JSON.stringify({ initial, reading, asked }))
  await page.screenshot({ path: info.outputPath('nonforce-ask-reading.png') })
  await info.attach('nonforce-ask-reading.json', { body: JSON.stringify({ initial, reading, asked, audit }), contentType: 'application/json' })
  expect(asked.total).toBeGreaterThan(reading.total)
  expect(asked.top, 'Source gScrollBottom() respects explicit stick=false').toBe(reading.top)
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('질문 직후 같은 event 경계의 문서 이동은 오래된 RAF로 다른 문서를 스크롤하지 않는다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'activity', 'paused')
  await page.getByLabel('연구 과정에 질문').fill('연구 과정에만 남기는 명시 Mock 질문')
  // Explicit DOM event-boundary fixture. Native RAF and rendering remain intact;
  // this does not claim two trusted user actions happened simultaneously.
  await page.evaluate(() => {
    const workspace = document.querySelector('.client-restored-research')!
    workspace.querySelector<HTMLFormElement>('.rw-composer')!.requestSubmit()
    Array.from(workspace.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(tab => tab.textContent === '연구 계획')!.click()
  })
  await expect(page.getByRole('tab', { name: '연구 계획', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.clock.runFor(80)
  const plan = await geometry(page)
  console.info('ASK_STALE_DOCUMENT', JSON.stringify(plan))
  await info.attach('ask-stale-document.json', { body: JSON.stringify({ plan, audit }), contentType: 'application/json' })
  expect(plan.top).toBe(0)
  await expect(page.locator('.rw-user-message')).toHaveCount(0)
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('원본 새 응답 버튼은 composer가 보일 때만 노출되고 명시 클릭만 follow를 재장착한다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'activity', 'paused')
  const scroll = page.locator(`${root} .rw-scroll`)
  await scroll.hover()
  await page.mouse.wheel(0, -180)
  await expect.poll(async () => (await geometry(page)).gap).toBeGreaterThan(60)
  const reading = await geometry(page)
  await page.getByLabel('연구 과정에 질문').fill('읽기 위치를 유지하고 새 응답 버튼으로 확인하는 명시 Mock 질문')
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await page.clock.runFor(80)
  expect((await geometry(page)).top).toBe(reading.top)
  const chip = page.getByRole('button', { name: '↓ 새 응답 보기', exact: true })
  await page.screenshot({ path: info.outputPath('new-response-chip.png') })
  await expect(chip).toBeVisible()
  await expect(chip).toHaveText('↓ 새 응답 보기')
  await expect(chip.locator('svg')).toHaveCount(0)
  const placement = await chip.evaluate(element => {
    const chip = element.getBoundingClientRect(), composer = element.closest('.rw-center')!.querySelector('.rw-composer-wrap')!.getBoundingClientRect()
    const hit = document.elementFromPoint(chip.left + chip.width / 2, chip.top + chip.height / 2)
    return { chip: chip.toJSON(), composer: composer.toJSON(), gap: composer.top - chip.bottom, hit: Boolean(hit && element.contains(hit)) }
  })
  await info.attach('new-response-chip-placement.json', { body: JSON.stringify(placement), contentType: 'application/json' })
  expect.soft(placement.gap, 'The original response pill must sit above the existing composer').toBeGreaterThanOrEqual(7.5)
  expect(placement.hit).toBe(true)
  await page.locator('.rw-preview-tools summary').click()
  await page.getByRole('button', { name: '계속 재생', exact: true }).click()
  await expect(page.locator('.rw-composer')).toHaveCount(0)
  await expect(chip).toHaveCount(0)
  await page.clock.runFor(2_000)
  await page.getByRole('button', { name: '일시 정지', exact: true }).click()
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(chip).toHaveCount(0)
  const clicked = await geometry(page)
  expect(clicked.gap).toBeLessThan(2)
  await page.getByRole('button', { name: '계속 재생', exact: true }).click()
  await page.clock.runFor(7_000)
  const next = await geometry(page)
  expect(next.total).toBeGreaterThan(clicked.total)
  expect(next.gap).toBeLessThan(2)
  await info.attach('new-response-chip.json', { body: JSON.stringify({ reading, clicked, next, audit }), contentType: 'application/json' })
  expect(audit).toEqual({ blocked: [], errors: [] })
})
