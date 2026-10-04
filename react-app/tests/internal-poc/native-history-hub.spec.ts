import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import type { ApiV080NativeConversationHistoryNativeConversationHistoryRow as HistoryRow } from '../../src/internal-poc/contracts/generated/api-v0.8/types'
import { sharingCopy } from '../../src/client-sharing-copy'
import nativeFixture from './fixtures/native-service-contracts.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
const ready = conversationFixture.snapshots.ready
const approval = conversationFixture.documents.find(item => item.name === 'approval')!.value
const owner = 'session_history_hub_fixture_0001'
const cursor = 'history_hub_next_fixture_0002'
const rows = [
  { approval: { ...approval, strategyVersionId: 'sv_v03_' + '1'.padStart(32, '0') }, job: null },
  { approval: { ...approval, strategyVersionId: 'sv_v03_' + '2'.padStart(32, '0'), sourceDraftRevision: '1' }, job: null },
] as HistoryRow[]
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_history_hub_fixture_0001', traceId: 'trace_history_hub_fixture_0001' })
const hub = (page: Page) => page.locator('#research-main')
const scope = (page: Page) => hub(page).locator('.native-history-scope')
const panel = (page: Page) => scope(page).locator('.native-history-panel')
const row = (page: Page, index = 0) => panel(page).locator('button.g-hist-row').nth(index)
const composer = (page: Page) => page.locator('.g-composer textarea')
const reads = (state: Awaited<ReturnType<typeof setup>>) => [state.sessionReads, state.draftReads, state.historyReads.length]

async function openStrategies(page: Page, mine = true) {
  await revealSourceNavigation(page)
  const entry = page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true })
  if (!await entry.isVisible()) await page.locator('.client-hamburger').click()
  await entry.click()
  await expect(page.locator('.native-strategies')).toBeVisible()
  if (mine) await hub(page).getByRole('button', { name: '내 전략', exact: true }).click()
}

async function openHub(page: Page) {
  await revealSourceNavigation(page)
  const entry = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  if (!await entry.isVisible()) await page.locator('.client-hamburger').click()
  await entry.click()
  // The native history integration keeps this conversation's execution history
  // in a collapsed disclosure. Open it explicitly; retain the product default.
  const disclosure = hub(page).locator('details.native-history-details')
  await expect(disclosure).toBeVisible()
  if (!await disclosure.evaluate(element => (element as HTMLDetailsElement).open)) await disclosure.locator('summary').click()
  await expect(scope(page).getByRole('heading', { name: '현재 대화의 실행 이력', exact: true })).toBeVisible()
}

test('연구 기록 lazy 로딩 중 후속 키보드 이동의 초점을 빼앗지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/components/ClientResearchHistory.tsx*', async route => { await gate; await route.continue() })
  const entry = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  await revealSourceNavigation(page)
  if (!await entry.isVisible()) await page.locator('.client-hamburger').click()
  await entry.click()
  try {
    await expect(page.locator('.site-page-loading')).toBeVisible()
    await page.locator('.site-page-loading').press('Shift+Tab')
    // Insights moved to the account menu; retain the same focus non-interference
    // assertion using a remaining source sidebar control during the held load.
    const target = page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'brokers'), exact: true })
    await target.focus()
    release()
    await expect(hub(page).locator('details.native-history-details')).toBeVisible()
    await expect(target).toBeFocused()
    await hub(page).locator('details.native-history-details > summary').click()
    await expect(scope(page)).toBeVisible()
  } finally { release() }
})

for (const width of [320, 1440]) test(`전략들 ${width}px: 명시 공급 세 탭과 실제 현재 대화 이력 조회·선택을 연결한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  await composer(page).fill('전략 목록 왕복에 유지할 초안')
  const initial = reads(state)
  await openStrategies(page, false)
  await expect(hub(page).getByRole('heading', { level: 1 })).toBeFocused()
  await expect(hub(page).getByRole('heading', { name: '전략 복사', exact: true })).toBeVisible()
  const tabs = hub(page).getByRole('group', { name: '전략 공유 영역', exact: true })
  await expect(tabs.getByRole('button')).toHaveCount(3)
  await expect(hub(page)).toContainText('공개 전략 목록이 아직 연결되어 있지 않습니다.')
  await tabs.getByRole('button', { name: '따라가는 중', exact: true }).click()
  await expect(hub(page)).toContainText('따라가는 전략 목록이 아직 연결되어 있지 않습니다.')
  await expect(hub(page).locator('.ss3-matrix, .tfbk-card, canvas, .ss3-search')).toHaveCount(0)
  await expect(hub(page).locator('.cnt')).toHaveCount(0)
  expect(reads(state)).toEqual(initial)
  await tabs.getByRole('button', { name: '내 전략', exact: true }).click()
  await expect(scope(page)).toContainText('계정 전체 연구 기록은 포함하지 않습니다.')
  await load(page)
  await expect(page.locator('.native-history-panel')).toHaveCount(1)
  await expect(panel(page).locator('.native-history-item')).toHaveCount(2)
  await expect(row(page, 1)).toHaveAttribute('aria-disabled', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`strategies-${width}.png`), fullPage: true })
  await row(page).click()
  await expect(hub(page)).toHaveCount(0)
  await expect(page.locator('[data-native-history-selection]')).toBeFocused()
  await expect(composer(page)).toHaveValue('전략 목록 왕복에 유지할 초안')
  await expect(composer(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toBeEnabled()
  expect(state.historyReads).toEqual([null])
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

for (const destination of ['history', 'sharing', 'tab'] as const) test(`전략들 선택의 늦은 성공은 ${destination} 새 방문을 닫지 않는다`, async ({ page }) => {
  const state = await setup(page)
  if (destination === 'sharing') await openHub(page)
  else await openStrategies(page)
  await load(page)
  const before = state.draftReads
  let release!: () => void
  state.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  await row(page).click()
  try {
    await expect.poll(() => state.draftReads).toBe(before + 1)
    if (destination === 'history') await openHub(page)
    else if (destination === 'sharing') await openStrategies(page)
    else await hub(page).getByRole('button', { name: '전략 찾기', exact: true }).click()
    release()
    await expect.poll(() => state.sessionReads).toBeGreaterThan(2)
    if (destination === 'tab') {
      await expect(hub(page)).toContainText('공개 전략 목록이 아직 연결되어 있지 않습니다.')
      await expect(page.locator('.native-history-panel')).toHaveCount(0)
      await hub(page).getByRole('button', { name: '내 전략', exact: true }).click()
    }
    await expect(row(page)).toHaveAttribute('aria-current', 'true')
    await expect(hub(page)).toBeVisible()
    await expect(page.locator('.native-service-content')).toBeHidden()
    expect(state.historyReads).toEqual([null])
    expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
  } finally { release() }
})

test('전략들 선택 실패는 그 화면에 남고 재확인 성공 후에만 복귀한다', async ({ page }) => {
  const state = await setup(page)
  await openStrategies(page); await load(page)
  state.draftFailure = true
  await row(page).click()
  await expect(hub(page).getByRole('alert')).toBeVisible()
  await expect(hub(page)).toBeVisible()
  await expect(panel(page).locator('[aria-current="true"]')).toHaveCount(0)
  state.draftFailure = false
  await row(page).click()
  await expect(hub(page)).toHaveCount(0)
  await expect(page.locator('[data-native-history-selection]')).toBeFocused()
  expect(state.posts).toEqual([])
})

test('내 전략의 조회 오류는 다른 탭 왕복 후에도 남고 명시 재조회로만 해제된다', async ({ page }) => {
  const state = await setup(page)
  await openStrategies(page); await load(page)
  state.failure = 'INTERNAL_ERROR'
  await panel(page).getByRole('button', { name: '다음 이력 페이지', exact: true }).click()
  const feedback = scope(page).getByRole('alert')
  await expect(feedback).toContainText('이력 페이지를 확인하지 못해 이동하지 않았습니다.')
  const before = reads(state)
  await hub(page).getByRole('button', { name: '전략 찾기', exact: true }).click()
  await expect(page.locator('.native-history-panel')).toHaveCount(0)
  await hub(page).getByRole('button', { name: '내 전략', exact: true }).click()
  await expect(feedback).toContainText('이력 페이지를 확인하지 못해 이동하지 않았습니다.')
  expect(reads(state)).toEqual(before)
  state.failure = ''
  await panel(page).getByRole('button', { name: '다음 이력 페이지', exact: true }).click()
  await expect(feedback).toHaveCount(0)
  await expect(panel(page).locator('.native-history-page')).toHaveText('현재 이력 페이지: 2')
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('전략들에서 언어 전환은 탭과 기존 조회 행을 유지하며 재조회하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const state = await setup(page)
  await openStrategies(page); await load(page)
  const before = reads(state)
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, code)
    await expect(hub(page).locator('.ss3-tabs button[aria-pressed="true"]')).toHaveCount(1)
    await expect(panel(page).locator('.native-history-item')).toHaveCount(2)
    await expect(hub(page).locator('.ss3-tabs button[aria-pressed="true"]')).toHaveText(sharingCopy(code, '내 전략'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(reads(state)).toEqual(before)
  await returnToChat(page)
  await expect(composer(page)).toBeFocused()
})

test('내 전략의 기존 종료 작업 선택은 서버 상태를 표시하고 승인·백테스트를 새로 만들지 않는다', async ({ page }) => {
  const state = await setup(page)
  const invalid = nativeFixture.sources[3].fixture.cases!.find(item => item.name === 'INVALID')!.response
  const job = { ...invalid.data, strategyVersionId: rows[0].approval.strategyVersionId, semanticHash: rows[0].approval.semanticHash } as NonNullable<HistoryRow['job']>
  state.rows = [{ approval: structuredClone(rows[0].approval), job }]
  let jobReads = 0
  await page.route('**/api/v7/**', route => {
    expect(route.request().method()).toBe('GET')
    expect(new URL(route.request().url()).pathname).toContain(job.backtestId)
    jobReads++
    return route.fulfill({ contentType: 'application/json', headers: { ETag: '"strategy_job_fixture_0008"', 'cache-control': 'no-store' }, body: JSON.stringify({ ...invalid, data: job }) })
  })
  await openStrategies(page); await load(page)
  await expect(row(page)).toHaveAccessibleName('작업 보기')
  expect(jobReads).toBe(0)
  await row(page).click()
  await expect(hub(page)).toHaveCount(0)
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'INVALID')
  // A terminal job already supplied by the accepted history does not poll.
  expect(jobReads).toBe(0)
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

for (const failure of ['FORBIDDEN', 'AUTHENTICATION_REQUIRED'] as const) test(`내 전략 ${failure}은 기존 권한 경계에 따라 이전 행을 제거한다`, async ({ page }) => {
  const state = await setup(page)
  await openStrategies(page); await load(page)
  state.failure = failure
  await scope(page).getByRole('button', { name: '실행 이력 불러오기', exact: true }).click()
  if (failure === 'AUTHENTICATION_REQUIRED') await expect(hub(page)).toHaveCount(0)
  else await expect(hub(page)).toBeVisible()
  await expect(page.locator('.native-history-item')).toHaveCount(0)
  await expect(page.locator('.native-history-feedback')).toBeVisible()
  expect(state.posts).toEqual([])
})
async function load(page: Page) {
  await scope(page).getByRole('button', { name: /^실행 이력 불러오기$/ }).click()
  await expect(panel(page)).toBeVisible()
}
async function returnToChat(page: Page) {
  await hub(page).locator('.hub-header button').click()
  await expect(hub(page)).toHaveCount(0)
  await expect(composer(page)).toBeVisible()
}
async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, value)
}
async function expectSourcePills(page: Page) {
  // Inspect the resting source appearance, not the legitimate hover color
  // left behind by clicking the query button.
  await page.mouse.move(0, 0)
  const controls = scope(page).locator('button.g-qchip')
  await expect(controls).toHaveCount(4)
  for (const control of await controls.all()) {
    await expect(control).toHaveCSS('appearance', 'none')
    await expect(control).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(control).toHaveCSS('border-radius', '999px')
    await expect(control).toHaveCSS('border-top-width', '1px')
    await expect(control).toHaveCSS('border-top-style', 'solid')
    await expect(control).toHaveCSS('min-height', '44px')
    expect(await control.evaluate(node => {
      const box = node.getBoundingClientRect()
      const parent = node.closest('.native-history-scope')!.getBoundingClientRect()
      return box.height >= 44 && box.left >= Math.max(0, parent.left) - 1
        && box.right <= Math.min(innerWidth, parent.right) + 1
        && node.scrollWidth <= node.clientWidth + 1
    }), await control.innerText()).toBe(true)
  }
}

async function setup(page: Page, authenticated = true) {
  // Synthetic responses pass through the real generated SDK and native owner
  // checks. This is UI regression evidence, never a real approval/server run.
  const state = { owner, authenticated, rows: structuredClone(rows), historyReads: [] as (string | null)[],
    sessionReads: 0, draftReads: 0, failure: '' as '' | 'INTERNAL_ERROR' | 'FORBIDDEN' | 'AUTHENTICATION_REQUIRED', draftFailure: false,
    holdHistory: undefined as (() => Promise<void>) | undefined,
    holdDraft: undefined as (() => Promise<void>) | undefined,
    posts: [] as string[], unexpected: [] as string[] }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  await page.route('**/api/**', route => {
    const request = route.request()
    if (request.method() !== 'GET') state.posts.push(new URL(request.url()).pathname)
    else state.unexpected.push(new URL(request.url()).pathname)
    return route.abort('failed')
  })
  await page.route('**/api/v1/auth/session', route => {
    state.sessionReads++
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_hub_session_etag_0001"' },
      body: JSON.stringify({ meta: meta('0.1.0', '1'), data: { sessionId: state.owner,
        state: state.authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1',
        issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
  })
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_history_hub_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', async route => {
    if (route.request().method() !== 'GET') { state.posts.push(new URL(route.request().url()).pathname); return route.abort('failed') }
    state.draftReads++
    if (state.holdDraft) await state.holdDraft()
    if (state.draftFailure) return route.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ meta: meta('0.3.0', null), error: { code: 'INTERNAL_ERROR', message: 'Fixture draft read failed.' } }) })
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_hub_draft_etag_0004"' },
      body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) })
  })
  await page.route('**/api/v8/**', async route => {
    if (route.request().method() !== 'GET') { state.posts.push(new URL(route.request().url()).pathname); return route.abort('failed') }
    state.historyReads.push(new URL(route.request().url()).searchParams.get('cursor'))
    const data = { conversationId: ready.conversationId, snapshotRevision: '4', limit: 50,
      rows: structuredClone(state.rows), nextCursor: cursor }
    if (state.holdHistory) await state.holdHistory()
    if (state.failure) return route.fulfill({ status: state.failure === 'AUTHENTICATION_REQUIRED' ? 401 : state.failure === 'FORBIDDEN' ? 403 : 500, contentType: 'application/json',
      headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.8.0', '4'),
        error: { code: state.failure, message: 'Native history request failed.' } }) })
    return route.fulfill({ status: 200, contentType: 'application/json',
      headers: { ETag: '"history_hub_snapshot_etag_0004"', 'cache-control': 'no-store' },
      body: JSON.stringify({ meta: meta('0.8.0', '4'), data }) })
  })
  // Source9fb index:24605 removes public catalogue tabs. This suite exercises
  // the separate explicitly supplied service presentation and its v8 history
  // controls, not the no-producer catalogue fallback. Keep the real app, SDK,
  // StrictMode and owner/authentication guards, supplying display input only.
  await page.route('**/internal-poc.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="tesia-owner-local-service-url" content=""></head><body><div id="internal-poc-root"></div></body></html>' }))
  await page.goto('/internal-poc.html#/native-client')
  await page.evaluate(async owner => {
    const refreshPath = '/@react-refresh'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/node_modules/@fontsource-variable/geist/wght.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/src/internal-poc/internal-poc.css']) await import(/* @vite-ignore */ path)
    const appPath = '/src/internal-poc/NativeServiceApp.tsx'
    const source = await (await fetch(appPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Native service React instance unavailable')
    const reactModule = await import(/* @vite-ignore */ reactPath), react = reactModule.default ?? reactModule
    const domPath = '/@id/react-dom/client', presentationPath = '/src/client-sharing-presentation.ts'
    const dom = await import(/* @vite-ignore */ domPath)
    const { NativeServiceApp } = await import(/* @vite-ignore */ appPath)
    const { unavailableSharingPresentation } = await import(/* @vite-ignore */ presentationPath)
    const root = document.getElementById('internal-poc-root')!
    ;(dom.createRoot ?? dom.default.createRoot)(root).render(react.createElement(react.StrictMode, null,
      react.createElement(NativeServiceApp, { presentations: { sharingPresentation: { scope: owner, identity: 'explicit-history-test', data: unavailableSharingPresentation } } })))
  }, owner)
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return state
}

for (const width of [320, 1440]) test(`${width}px 연구 기록 진입은 조회하지 않고 7언어·왕복이 원 대화 DOM과 초안을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  await composer(page).fill('아직 보내지 않은 전략 조건')
  await page.evaluate(() => Reflect.set(window, 'historyHubComposer', document.querySelector('.g-composer textarea')))
  const initialReads = reads(state)
  await openHub(page)
  expect(reads(state)).toEqual(initialReads)
  await expect(hub(page).getByRole('searchbox')).toBeDisabled()
  await expect(hub(page).locator('.native-history-unavailable')).toBeVisible()
  await expect(panel(page)).toHaveCount(0)
  await expect(page.locator('.native-service-content')).toBeHidden()
  await load(page)
  await row(page).focus()
  await page.evaluate(() => document.fonts.ready)
  await expectSourcePills(page)
  await page.screenshot({ path: info.outputPath(`history-hub-ko-${width}.png`), fullPage: false })
  const loadedReads = reads(state)
  await page.evaluate(() => Reflect.set(window, 'historyHubRow', document.querySelector('.native-history-scope .g-hist-row')))
  for (const value of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await language(page, value)
    await expect(row(page)).toBeFocused()
    expect(await page.evaluate(() => Reflect.get(window, 'historyHubRow') === document.querySelector('.native-history-scope .g-hist-row'))).toBe(true)
    await expect(panel(page)).toContainText(rows[0].approval.strategyVersionId)
    if (value !== 'ko') await expect(scope(page)).not.toContainText(/[가-힣]/)
    expect(reads(state)).toEqual(loadedReads)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (value === 'fr') {
      await expectSourcePills(page)
      await page.screenshot({ path: info.outputPath(`history-hub-fr-${width}.png`), fullPage: false })
    }
  }
  await returnToChat(page)
  await expect(composer(page)).toHaveValue('아직 보내지 않은 전략 조건')
  await expect(composer(page)).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'historyHubComposer') === document.querySelector('.g-composer textarea'))).toBe(true)
  await openHub(page)
  await expect(panel(page).locator('.native-history-item')).toHaveCount(2)
  expect(reads(state)).toEqual(loadedReads)
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('이력 조회 중 대화로 돌아가도 조회는 완료되며 재진입은 추가 조회 없이 같은 페이지를 보여준다', async ({ page }, info) => {
  const state = await setup(page)
  await composer(page).fill('조회 중에도 유지되는 초안')
  await openHub(page)
  let release!: () => void
  state.holdHistory = () => new Promise<void>(resolve => { release = resolve })
  await scope(page).getByRole('button', { name: /^실행 이력 불러오기$/ }).click()
  await expect.poll(() => state.historyReads.length).toBe(1)
  const activity = scope(page).locator('.g-act2[data-source="service"]')
  await expect(activity).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(activity.locator('.hd')).toHaveCSS('display', 'flex')
  await expect(activity.locator('.hd')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(activity.locator('.hd')).toHaveCSS('border-width', '0px')
  await expect(activity.locator('.activity-logo')).toHaveCSS('width', '22px')
  await expect(activity.locator('.activity-logo')).toHaveCSS('height', '14px')
  await expect(activity.locator('.activity-announcer')).toHaveCSS('height', '1px')
  await expect(activity.locator('.activity-announcer')).toHaveCSS('overflow', 'hidden')
  await expect(activity.locator('.activity-announcer')).toHaveCSS('clip-path', 'inset(50%)')
  await expect(scope(page).getByRole('button', { name: /^실행 이력 불러오기$/ })).toBeDisabled()
  await page.screenshot({ path: info.outputPath('history-hub-loading.png'), fullPage: false })
  await returnToChat(page)
  release()
  await expect(page.locator('.native-service-content .native-history-panel')).toBeVisible()
  await expect(composer(page)).toHaveValue('조회 중에도 유지되는 초안')
  const completedReads = reads(state)
  await openHub(page)
  await expect(panel(page).locator('.native-history-item')).toHaveCount(2)
  expect(reads(state)).toEqual(completedReads)
  expect(state.historyReads).toEqual([null])
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('이전 방문의 행 선택 응답은 다시 연 기록 화면을 닫지 않으며 확인된 선택만 반영한다', async ({ page }) => {
  const state = await setup(page)
  await composer(page).fill('기록 재방문 중 유지할 초안')
  await openHub(page); await load(page)
  const before = reads(state)
  let release!: () => void
  state.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  await row(page).click()
  await expect.poll(() => state.draftReads).toBe(before[1] + 1)
  await expect(panel(page).locator('[aria-current="true"]')).toHaveCount(0)
  await returnToChat(page)
  await openHub(page)
  await expect(panel(page).locator('[aria-current="true"]')).toHaveCount(0)
  expect(state.historyReads).toEqual([null])
  release()
  await expect(row(page)).toHaveAttribute('aria-current', 'true')
  await expect(hub(page)).toBeVisible()
  await expect(page.locator('.native-service-content')).toBeHidden()
  await expect(panel(page).locator('[aria-current="true"]')).toHaveCount(1)
  // One selection performs the existing before/after owner checks and one
  // draft GET. Return/reopen neither repeats that request nor reloads history.
  expect(reads(state)).toEqual([before[0] + 2, before[1] + 1, before[2]])
  await expect(composer(page)).toHaveValue('기록 재방문 중 유지할 초안')
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('이미 열린 연구 기록 메뉴를 다시 눌러도 진행 중인 선택의 정상 복귀를 무효화하지 않는다', async ({ page }) => {
  const state = await setup(page)
  await openHub(page); await load(page)
  const before = reads(state)
  let release!: () => void
  state.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  await row(page).click()
  await expect.poll(() => state.draftReads).toBe(before[1] + 1)
  // This is the same open visit, unlike Return → reopen in the test above.
  await openHub(page)
  await expect(panel(page).locator('[aria-current="true"]')).toHaveCount(0)
  expect(state.historyReads).toEqual([null])
  release()
  await expect(hub(page)).toHaveCount(0)
  await expect(page.locator('[data-native-history-selection]')).toBeFocused()
  await expect(composer(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toBeEnabled()
  expect(reads(state)).toEqual([before[0] + 2, before[1] + 1, before[2]])
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('전략 선택 중 연 설정은 완료가 초점을 빼앗지 않으며 닫을 때 사용자 진입점으로 복귀한다', async ({ page }) => {
  const state = await setup(page)
  await openStrategies(page); await load(page)
  const before = state.draftReads
  let release!: () => void
  state.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  await row(page).click()
  await expect.poll(() => state.draftReads).toBe(before + 1)
  try {
    await revealSourceNavigation(page)
    const settings = page.locator('[data-sidebar-action="settings"], [data-sidebar-action="profile-settings"]')
    if (!await settings.isVisible()) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
    await settings.click()
    await expect(page.locator('.ca-settings')).toBeVisible()
    release()
    await expect(hub(page)).toHaveCount(0)
    const selection = page.locator('[data-native-history-selection]')
    await expect(selection).not.toBeFocused()
    await expect.poll(() => page.locator('.ca-settings').evaluate(element => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator('.ca-settings')).toHaveCount(0)
    await expect(selection).not.toBeFocused()
    await expect.poll(() => page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null
      return Boolean(active && active !== document.body && active.getClientRects().length && !active.closest('[inert],[hidden]'))
    })).toBe(true)
    expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
  } finally { release() }
})

test('선택 안내 포커스는 한 번만 소비하며 이후 PLAN 복귀는 비활성 입력 대신 메인에 초점을 둔다', async ({ page }) => {
  const state = await setup(page)
  await composer(page).fill('선택과 PLAN 왕복 뒤 유지할 초안')
  await openHub(page); await load(page)
  await row(page).click()
  const selection = page.locator('[data-native-history-selection]')
  await expect(hub(page)).toHaveCount(0)
  await expect(selection).toBeFocused()
  await expect(composer(page)).toBeDisabled()
  const before = reads(state)
  await revealSourceNavigation(page)
  const settings = page.locator('[data-sidebar-action="settings"], [data-sidebar-action="profile-settings"]')
  if (!await settings.isVisible()) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  await settings.click()
  await page.locator('.ca-settings').getByRole('button', { name: '이용 현황', exact: true }).click()
  const plan = page.locator('.client-settings-page')
  await expect(plan.getByRole('heading', { name: '결제', exact: true })).toBeFocused()
  if (!await plan.getByRole('button', { name: '앱으로 돌아가기', exact: true }).isVisible()) await plan.locator('.stg-mback').click()
  await plan.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await expect(plan).toHaveCount(0)
  await expect(page.locator('#tesia-main')).toBeFocused()
  await expect(selection).not.toBeFocused()
  await expect(composer(page)).toBeDisabled()
  await expect(composer(page)).toHaveValue('선택과 PLAN 왕복 뒤 유지할 초안')
  expect(reads(state)).toEqual(before)
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('처음부터 비로그인인 세션은 계정 연구 기록과 현재 대화 이력을 조회하지 않는다', async ({ page }) => {
  const state = await setup(page, false)
  await composer(page).fill('로그인 전에 유지할 초안')
  await expect(page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })).toHaveCount(0)
  await expect(page.locator('.native-history-scope')).toHaveCount(0)
  await expect(page.locator('.native-history-panel')).toHaveCount(0)
  const before = reads(state)
  // The original guest sidebar has no research-history entry. The existing
  // conversation utility still enforces authentication without issuing v8 GET.
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('로그인 후 실행 이력을 확인할 수 있습니다.')
  await expect(composer(page)).toHaveValue('로그인 전에 유지할 초안')
  await expect(page.locator('.native-history-scope')).toHaveCount(0)
  expect(reads(state)).toEqual(before)
  expect(state.historyReads).toEqual([])
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('조회·선택 확인 실패는 기록 화면에 남고 검증된 선택만 대화로 복귀하며 현재 선택·페이지를 보존한다', async ({ page }) => {
  const state = await setup(page)
  await composer(page).fill('선택 전 미전송 초안')
  await openHub(page); await load(page)
  state.failure = 'INTERNAL_ERROR'
  await panel(page).getByRole('button', { name: '다음 이력 페이지', exact: true }).click()
  await expect(scope(page).getByRole('alert')).toContainText('이력 페이지를 확인하지 못해 이동하지 않았습니다.')
  await expect(panel(page).locator('.native-history-page')).toHaveText('현재 이력 페이지: 1')
  state.failure = ''
  await panel(page).getByRole('button', { name: '다음 이력 페이지', exact: true }).click()
  await expect(panel(page).locator('.native-history-page')).toHaveText('현재 이력 페이지: 2')
  await expect(row(page, 1)).toBeDisabled()
  state.draftFailure = true
  await row(page).click()
  await expect(hub(page)).toBeVisible()
  await expect(hub(page).locator('.client-service-issue')).toBeVisible()
  await expect(panel(page).locator('[aria-current="true"]')).toHaveCount(0)
  state.draftFailure = false
  let release!: () => void
  state.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  const draftReads = state.draftReads
  await row(page).click()
  await expect.poll(() => state.draftReads).toBe(draftReads + 1)
  await expect(hub(page)).toBeVisible()
  await expect(panel(page).locator('[aria-current="true"]')).toHaveCount(0)
  release()
  await expect(hub(page)).toHaveCount(0)
  await expect(composer(page)).toHaveValue('선택 전 미전송 초안')
  await expect(composer(page)).toBeDisabled()
  const selection = page.locator('[data-native-history-selection]')
  await expect(selection).toHaveAttribute('tabindex', '-1')
  await expect(selection).toHaveAttribute('role', 'status')
  await expect(selection).toBeFocused()
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toBeEnabled()
  const selectedReads = reads(state)
  await openHub(page)
  await expect(row(page)).toHaveAttribute('aria-current', 'true')
  await expect(panel(page).locator('.native-history-page')).toHaveText('현재 이력 페이지: 2')
  expect(reads(state)).toEqual(selectedReads)
  expect(state.historyReads).toEqual([null, cursor, cursor])
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('v8 인증 만료는 기록 화면을 닫고 이전 목록을 숨겨도 권한 상실 안내를 대화에 유지한다', async ({ page }) => {
  const state = await setup(page)
  await openHub(page); await load(page)
  state.failure = 'AUTHENTICATION_REQUIRED'
  await panel(page).getByRole('button', { name: '다음 이력 페이지', exact: true }).click()
  const notice = page.getByRole('alert').filter({ hasText: '이력 조회 권한을 확인하지 못해 이전 이력과 탐색 기록을 숨겼습니다.' })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('서버 작업을 삭제하지 않았습니다.')
  await expect(hub(page)).toHaveCount(0)
  await expect(page.locator('.native-history-panel')).toHaveCount(0)
  await expect(page.locator('.native-history-item')).toHaveCount(0)
  await expect(page.locator('[data-native-history-selection]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(state.historyReads).toEqual([null, cursor])
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

for (const change of ['owner', 'authentication'] as const) test(`늦은 이력 응답 도중 ${change} 변경은 이전 계정 행을 게시하거나 실행 권위로 만들지 않는다`, async ({ page }) => {
  const state = await setup(page)
  await openHub(page)
  let release!: () => void
  state.holdHistory = () => new Promise<void>(resolve => { release = resolve })
  await scope(page).getByRole('button', { name: /^실행 이력 불러오기$/ }).click()
  await expect.poll(() => state.historyReads.length).toBe(1)
  if (change === 'owner') state.owner = 'session_history_hub_other_0002'
  else state.authenticated = false
  release()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('.native-history-panel')).toHaveCount(0)
  await expect(page.locator('.native-history-item')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})
