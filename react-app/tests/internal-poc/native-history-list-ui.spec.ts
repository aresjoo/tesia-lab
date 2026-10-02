import { expect, test, type Page } from '@playwright/test'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import nativeFixture from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { ApiV080NativeConversationHistoryNativeConversationHistoryRow as HistoryRow } from '../../src/internal-poc/contracts/generated/api-v0.8/types'

test.use({ trace: 'off', video: 'off' })
const ready = conversationFixture.snapshots.ready
const approval = conversationFixture.documents.find(item => item.name === 'approval')!.value
const invalid = nativeFixture.sources[3].fixture.cases!.find(item => item.name === 'INVALID')!.response
const owner = 'session_history_list_fixture_0001'

for (const width of [320, 1440]) test(`${width}px 7언어 이력 목록은 행·포커스·원승인 식별자를 유지하고 번역 때문에 다시 조회하지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  await load(page)
  const list = page.locator('.native-history-list'), row = list.locator('button').first()
  await row.focus()
  const ids = await list.locator('.native-history-id').allTextContents()
  const times = await list.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')))
  const reads = [...state.historyReads], draftReads = state.draftReads
  await page.evaluate(() => Reflect.set(window, 'originalHistoryRow', document.querySelector('.native-history-list button')))
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(row).toBeFocused()
    expect(await page.evaluate(() => Reflect.get(window, 'originalHistoryRow') === document.querySelector('.native-history-list button'))).toBe(true)
    expect(await list.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')))).toEqual(times)
    for (const value of rows) await expect(list).toContainText(value.approval.strategyVersionId)
    if (language !== 'ko') {
      await expect(row).not.toHaveAttribute('aria-label', '이 승인 버전 선택')
      await expect(list.locator('.native-history-title').first()).not.toContainText('승인된 초안')
      await expect(list.locator('.native-history-state').last()).not.toContainText('백테스트 결과 무효')
      await expect(page.locator('.native-history-panel')).not.toContainText(/[가-힣]/)
    } else expect(await list.locator('.native-history-id').allTextContents()).toEqual(ids)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    for (const button of await list.locator('button.g-hist-row').all()) {
      const title = await button.locator('.t').boundingBox(), metadata = await button.locator('.native-history-meta').boundingBox()
      expect(title && metadata && (title.x + title.width <= metadata.x + 1 || title.y + title.height <= metadata.y + 1), language).toBe(true)
    }
    if (language === 'fr') await page.screenshot({ path: info.outputPath(`history-fr-${width}.png`), fullPage: true })
  }
  expect(state.historyReads).toEqual(reads)
  expect(state.draftReads).toBe(draftReads)
  expect(state.jobReads).toBe(0)
  expect(state.posts).toEqual([])
})

test('이력 조회 권한 상실은 이전 목록·탐색만 숨기고 안내 번역 중 초안과 요청 경계를 유지한다', async ({ page }) => {
  const state = await setup(page)
  await load(page)
  const composer = page.locator('.g-composer textarea')
  await composer.fill('유지할 미전송 초안')
  state.failure = 'FORBIDDEN'
  await next(page).click()
  const notice = page.locator('.native-workflow-notice[role="alert"]')
  await expect(notice).toHaveText('이력 조회 권한을 확인하지 못해 이전 이력과 탐색 기록을 숨겼습니다. 서버 작업을 삭제하지 않았습니다.')
  await expect(page.locator('.native-history-panel')).toHaveCount(0)
  await expect(composer).toHaveValue('유지할 미전송 초안')
  const reads = [...state.historyReads]
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'en')
  })
  await expect(notice).not.toContainText(/[가-힣]/)
  await expect(notice).toContainText('The server job has not been deleted.')
  expect(state.historyReads).toEqual(reads)
  expect(state.posts).toEqual([])
})

test('이미 열린 이력 실패 안내도 언어를 따르며 언어 변경만으로 재시도하지 않는다', async ({ page }) => {
  const state = await setup(page)
  await load(page)
  state.failure = 'INTERNAL_ERROR'
  await next(page).click()
  const notice = page.locator('.native-workflow-notice[role="alert"]')
  await expect(notice).toContainText('이력 페이지를 확인하지 못해 이동하지 않았습니다.')
  const reads = [...state.historyReads]
  for (const language of ['en', 'fr', 'ko']) {
    await page.evaluate(async value => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', value)
    }, language)
    await expect(notice).toBeVisible()
    if (language !== 'ko') await expect(notice).not.toContainText(/[가-힣]/)
    else await expect(notice).toContainText('마지막으로 조회한 페이지와 선택은 유지합니다.')
    expect(state.historyReads).toEqual(reads)
    expect(state.posts).toEqual([])
  }
  state.failure = ''
  await next(page).click()
  await expect(notice).toHaveCount(0)
  await expect(page.locator('.native-history-page')).toHaveText('현재 이력 페이지: 2')
})
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_history_list_fixture_0001', traceId: 'trace_history_list_fixture_0001' })
const approvalFor = (index: number) => ({ ...approval, strategyVersionId: 'sv_v03_' + index.toString(16).padStart(32, '0'), ...(index > 1 ? { sourceDraftRevision: '1' } : {}) })
const rows: HistoryRow[] = [
  { approval: approvalFor(1), job: null },
  { approval: approvalFor(2), job: null },
  { approval: approvalFor(3), job: { ...invalid.data, strategyVersionId: approvalFor(3).strategyVersionId, semanticHash: approvalFor(3).semanticHash } },
] as HistoryRow[]
const history = (page: Page) => page.getByRole('region', { name: '실행 이력', exact: true })
const load = async (page: Page) => {
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect(history(page)).toBeVisible()
}

async function setup(page: Page) {
  // Controlled generated-SDK fixtures exercise the actual native controller.
  // They do not issue a real approval/job or prove actual server execution.
  const state = { owner, rows: structuredClone(rows), snapshotRevision: '4', historyReads: [] as (string | null)[],
    nextCursor: 'history_list_next_fixture_0002' as string | undefined,
    failure: '' as '' | 'SNAPSHOT_CHANGED' | 'INTERNAL_ERROR' | 'FORBIDDEN',
    holdHistory: undefined as (() => Promise<void>) | undefined,
    posts: [] as { path: string; body: unknown }[], jobReads: 0, sessionReads: 0, draftReads: 0 }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    if (sessionStorage.getItem('history-list-fixture-initialized')) return
    sessionStorage.setItem('history-list-fixture-initialized', '1')
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  await page.route('**/api/v1/auth/session', route => { state.sessionReads++; return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_list_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: {
    sessionId: state.owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z',
  } }) }) })
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_history_list_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', route => {
    if (route.request().method() !== 'GET') { state.posts.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() }); return route.abort('failed') }
    state.draftReads++
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_list_draft_etag_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) })
  })
  await page.route('**/api/v8/**', async route => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    state.historyReads.push(cursor)
    const data = { conversationId: ready.conversationId, snapshotRevision: state.snapshotRevision, limit: 50, rows: structuredClone(state.rows), ...(state.nextCursor ? { nextCursor: state.nextCursor } : {}) }
    if (state.holdHistory) await state.holdHistory()
    if (state.failure) return route.fulfill({ status: state.failure === 'FORBIDDEN' ? 403 : state.failure === 'SNAPSHOT_CHANGED' ? 409 : 500, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.8.0', state.snapshotRevision), error: { code: state.failure, message: 'Native history request failed.' } }) })
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_list_snapshot_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.8.0', data.snapshotRevision), data }) })
  })
  await page.route('**/api/v7/**', route => {
    if (route.request().method() !== 'GET') { state.posts.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() }); return route.abort('failed') }
    state.jobReads++
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_list_job_etag_0008"', 'cache-control': 'no-store' }, body: JSON.stringify({ ...invalid, data: rows[2].job }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return state
}

const item = (page: Page, index: number) => history(page).locator('.native-history-item').nth(index)
const select = (page: Page, index: number) => item(page, index).locator('button.g-hist-row')
const first = (page: Page) => history(page).getByRole('button', { name: '첫 이력 페이지 다시 조회', exact: true })
const next = (page: Page) => history(page).getByRole('button', { name: '다음 이력 페이지', exact: true })

test('조회한 세 행의 승인 revision·발급 시각·작업 상태만 표시하며 미실행을 결과로 만들지 않는다', async ({ page }) => {
  const state = await setup(page)
  await expect(history(page)).toHaveCount(0)
  await load(page)
  await expect(history(page).getByRole('list', { name: '현재 대화 승인·실행 이력 목록' })).toBeVisible()
  await expect(history(page).locator('.native-history-item')).toHaveCount(3)
  for (let index = 0; index < rows.length; index++) {
    await expect(item(page, index).locator('.native-history-title')).toHaveText(`승인된 초안 · revision ${rows[index].approval.sourceDraftRevision}`)
    await expect(item(page, index).locator('time')).toHaveAttribute('datetime', rows[index].approval.issuedAt)
    await expect(item(page, index).locator('time')).toHaveText(rows[index].approval.issuedAt.replace('T', ' ').replace('Z', ' UTC'))
    await expect(item(page, index)).toContainText(rows[index].approval.strategyVersionId)
    await expect(select(page, index)).not.toHaveAttribute('aria-current', 'true')
  }
  await expect(item(page, 0).locator('.native-history-state')).toHaveText('미실행')
  await expect(item(page, 1).locator('.native-history-state')).toHaveText('미실행')
  await expect(item(page, 2).locator('.native-history-state')).toHaveText('백테스트 결과 무효')
  await expect(item(page, 2)).toContainText(rows[2].job!.backtestId)
  expect(await history(page).innerText()).not.toMatch(/수익률|승률|총\s*3|연구 제목|몇 초 전/)
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(state.posts).toEqual([]); expect(state.jobReads).toBe(0)
})

test('현재 승인 행을 키보드로 선택하면 aria-current와 보조 표시만 바뀌며 재승인·자동 실행하지 않는다', async ({ page }, testInfo) => {
  const state = await setup(page); await load(page)
  const button = select(page, 0)
  await button.focus(); await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-current', 'true')
  await testInfo.attach('post-selection-focus.json', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => ({
    tag: document.activeElement?.tagName, id: document.activeElement?.id, className: document.activeElement?.className,
  }))) })
  await expect(button).toBeFocused()
  await expect(button).toHaveAccessibleDescription(/승인된 초안 · revision 2.*미실행/)
  await expect(item(page, 0).locator('.native-history-selected')).toHaveText('선택됨')
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toBeEnabled()
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(1)
  expect(state.posts).toEqual([])
})

test('이전 초안의 기존 job 선택은 그 작업을 읽으며 현재 초안을 승인했다고 표시하지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await select(page, 2).click()
  await expect(select(page, 2)).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'INVALID')
  await expect(page.getByText(/승인 초안 revision: 1 · 현재 초안 revision: 2/)).toBeVisible()
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  await expect(page.locator('.native-job-problem')).toContainText('실행 결과 확인 필요')
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(1)
  await select(page, 0).click()
  await expect(select(page, 0)).toHaveAttribute('aria-current', 'true')
  await expect(select(page, 2)).not.toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
  expect(state.posts).toEqual([])
})

test('현재 초안과 다른 미실행 승인은 이유를 읽을 수 있고 프로그램 클릭으로도 실행 권위가 되지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  const button = select(page, 1)
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('aria-disabled', 'true')
  await expect(item(page, 1).locator('.native-history-notice')).toContainText('현재 초안과 다른 기존 승인')
  await expect(button).toHaveAccessibleDescription(/현재 초안과 다른 기존 승인/)
  const before = [state.sessionReads, state.draftReads, state.historyReads.length, state.jobReads]
  await button.evaluate(node => (node as HTMLButtonElement).click())
  await button.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space')
  await expect(button).toBeFocused()
  await page.waitForTimeout(80)
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(state.posts).toEqual([])
  expect([state.sessionReads, state.draftReads, state.historyReads.length, state.jobReads]).toEqual(before)
})

test('페이지 조회 중 기존 행과 탐색을 잠그고 이중 선택을 보내지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  let release!: () => void
  state.holdHistory = () => new Promise<void>(resolve => { release = resolve })
  await next(page).click()
  await expect.poll(() => state.historyReads.length).toBe(2)
  for (let index = 0; index < 3; index++) await expect(select(page, index)).toBeDisabled()
  await expect(next(page)).toBeDisabled(); await expect(first(page)).toBeDisabled()
  for (const control of [next(page), first(page)]) {
    await expect(control).toHaveAttribute('aria-disabled', 'true')
    await control.evaluate(node => (node as HTMLButtonElement).click())
    await control.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space')
  }
  expect(state.historyReads).toHaveLength(2)
  await select(page, 0).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  const documentTab = page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true })
  await documentTab.click()
  release()
  const workspace = page.locator('.native-research-workspace')
  const planTab = workspace.getByRole('tab', { name: '연구 계획', exact: true })
  await expect(workspace.getByRole('tabpanel', { name: '연구 계획 문서', exact: true })).toBeVisible()
  await expect(planTab).toHaveAttribute('aria-selected', 'true')
  await expect(planTab).toBeFocused()
  await workspace.locator('.native-plan-technical > summary').click()
  await expect(page.locator('.native-strategy-document')).toBeVisible()
  await workspace.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(history(page)).toContainText('현재 이력 페이지: 2')
  await expect(select(page, 0)).toBeEnabled()
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(0)
  expect(state.posts).toEqual([])
})

test('스냅샷 변경 거절은 이전 선택을 유지하되 첫 페이지 재확인 전 행 선택을 잠근다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await select(page, 0).click()
  state.failure = 'SNAPSHOT_CHANGED'
  await next(page).click()
  await expect(page.getByText(/이력 스냅샷이나 탐색 위치가 바뀌어/)).toBeVisible()
  await expect(select(page, 0)).toHaveAttribute('aria-current', 'true')
  await expect(select(page, 0)).toBeDisabled()
  await expect(select(page, 2)).toBeDisabled()
  await expect(history(page)).toContainText('첫 페이지를 다시 확인하기 전에는 새 행을 선택할 수 없습니다.')
  state.failure = ''; state.snapshotRevision = '5'
  await first(page).click()
  await expect(select(page, 0)).toBeEnabled()
  await expect(select(page, 0)).toHaveAttribute('aria-current', 'true')
  expect(state.historyReads).toEqual([null, 'history_list_next_fixture_0002', null])
  expect(state.posts).toEqual([])
})

test('일반 이력 조회 실패는 마지막 목록과 선택을 지우거나 새 작업으로 바꾸지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await select(page, 2).click()
  state.failure = 'INTERNAL_ERROR'
  await next(page).click()
  await expect(page.getByText(/이력 페이지를 확인하지 못해 이동하지 않았습니다/)).toBeVisible()
  await expect(history(page).locator('.native-history-item')).toHaveCount(3)
  await expect(select(page, 2)).toHaveAttribute('aria-current', 'true')
  await expect(select(page, 2)).toBeEnabled()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'INVALID')
  expect(state.posts).toEqual([])
})

test('늦은 이전 owner의 목록 응답은 새 계정에 표시하거나 선택 가능하게 남기지 않는다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  state.holdHistory = () => new Promise<void>(resolve => { release = resolve })
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect.poll(() => state.historyReads.length).toBe(1)
  state.owner = 'session_history_list_other_0002'; release()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(history(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(state.posts).toEqual([])
})

test('미확정 실행 요청 이후 목록은 읽되 행 선택을 잠그고 원 요청 journal을 보존한다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await select(page, 0).click()
  await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toBeNull()
  await load(page)
  await expect(select(page, 0)).toBeDisabled(); await expect(select(page, 2)).toBeDisabled()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  await select(page, 2).evaluate(node => (node as HTMLButtonElement).click())
  expect(state.posts).toHaveLength(1)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(journal)
})

test('빈 페이지는 반환된 페이지 범위만 설명하고 전체 이력 건수나 전략명을 발명하지 않는다', async ({ page }) => {
  const state = await setup(page); state.rows = []; state.nextCursor = undefined
  await load(page)
  await expect(history(page)).toContainText('이 페이지에 반환된 승인·실행 이력이 없습니다.')
  await expect(history(page).locator('.native-history-list')).toHaveCount(0)
  await expect(first(page)).toBeEnabled()
  await expect(history(page)).not.toContainText('총 0')
  expect(state.posts).toEqual([])
})

test('선택한 승인에 새 job이 붙어도 목록 재조회만으로 그 작업을 선택하거나 현재 표시하지 않는다', async ({ page }) => {
  const state = await setup(page); state.rows = [structuredClone(rows[0])]
  await load(page); await select(page, 0).click()
  await expect(select(page, 0)).toHaveAttribute('aria-current', 'true')
  const attached = { ...rows[2].job!, strategyVersionId: rows[0].approval.strategyVersionId, semanticHash: rows[0].approval.semanticHash }
  state.rows = [{ approval: structuredClone(rows[0].approval), job: attached }]
  state.snapshotRevision = '5'
  await first(page).click()
  await expect(select(page, 0)).toHaveAccessibleName('작업 보기')
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(0)
  await expect(page.getByText(`승인 버전: ${rows[0].approval.strategyVersionId}`, { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
  expect(state.jobReads).toBe(0); expect(state.posts).toEqual([])
  await select(page, 0).click()
  await expect(select(page, 0)).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'INVALID')
  expect(state.posts).toEqual([])
})

test('선택된 작업이 없는 다른 페이지는 선택 표시만 비우고 기존 서버 작업 뷰를 유지한다', async ({ page }) => {
  const state = await setup(page); await load(page); await select(page, 2).click()
  await expect(select(page, 2)).toHaveAttribute('aria-current', 'true')
  state.rows = [structuredClone(rows[0])]
  await next(page).click()
  await expect(history(page)).toContainText('현재 이력 페이지: 2')
  await expect(history(page).locator('.native-history-item')).toHaveCount(1)
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'INVALID')
  await expect(history(page)).toContainText('조회 당시의 기록입니다. 현재 작업 상태는 선택한 작업에서 확인하세요.')
  expect(state.posts).toEqual([])
})

test('페이지 탐색은 비활성 클릭·키보드 요청을 차단하고 활성 이동 후 포커스를 보존한다', async ({ page }) => {
  const state = await setup(page); await load(page)
  const previous = history(page).getByRole('button', { name: '이전 이력 페이지', exact: true })
  await expect(previous).toHaveAttribute('aria-disabled', 'true')
  await previous.click({ force: true })
  await previous.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space')
  await expect(previous).toBeFocused()
  expect(state.historyReads).toEqual([null])
  await next(page).focus(); await page.keyboard.press('Enter')
  await expect(history(page)).toContainText('현재 이력 페이지: 2')
  await expect(next(page)).toBeFocused()
  await first(page).focus(); await page.keyboard.press('Space')
  await expect(history(page)).toContainText('현재 이력 페이지: 1')
  await expect(first(page)).toBeFocused()
  expect(state.historyReads).toEqual([null, 'history_list_next_fixture_0002', null])
  expect(state.posts).toEqual([])
})

test('동일 승인에 서로 다른 두 job이 있으면 정확한 작업만 선택하며 행 위치와 페이지 변경에도 구분한다', async ({ page }) => {
  const duplicateKeyErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error' && /same key|unique.*key/i.test(message.text())) duplicateKeyErrors.push(message.text()) })
  const state = await setup(page)
  const sharedApproval = approvalFor(3)
  const failed = nativeFixture.sources[3].fixture.cases!.find(entry => entry.name === 'FAILED')!.response.data
  const a: HistoryRow = { approval: structuredClone(sharedApproval), job: { ...invalid.data, backtestId: 'backtest_history_shared_job_a', strategyVersionId: sharedApproval.strategyVersionId, semanticHash: sharedApproval.semanticHash } } as HistoryRow
  const b: HistoryRow = { approval: structuredClone(sharedApproval), job: { ...failed, backtestId: 'backtest_history_shared_job_b', strategyVersionId: sharedApproval.strategyVersionId, semanticHash: sharedApproval.semanticHash } } as HistoryRow
  // v0.8 requires approval bytes to match and rows to remain in canonical
  // issuedAt/version/createdAt/jobId order. A same-approval two-job list is legal;
  // reversing A/B would be an invalid fixture, not a UI reorder regression.
  state.rows = [a, b]
  await load(page)
  const jobButton = (id: string) => history(page).locator('.native-history-item').filter({ hasText: id }).locator('button.g-hist-row')
  const buttonA = jobButton(a.job!.backtestId), buttonB = jobButton(b.job!.backtestId)
  await expect(history(page).locator('.native-history-item')).toHaveCount(2)
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(0)
  await buttonA.click()
  await expect(buttonA).toHaveAttribute('aria-current', 'true')
  await expect(buttonB).not.toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'INVALID')
  await buttonB.focus(); await page.keyboard.press('Enter')
  await expect(buttonB).toHaveAttribute('aria-current', 'true')
  await expect(buttonA).not.toHaveAttribute('aria-current', 'true')
  await expect(buttonB).toBeFocused()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'FAILED')
  // Insert an earlier canonical row so both job rows move to new list indices.
  state.rows = [structuredClone(rows[0]), a, b]; state.snapshotRevision = '5'
  await first(page).click()
  await expect(history(page).locator('.native-history-item')).toHaveCount(3)
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(1)
  await expect(buttonB).toHaveAttribute('aria-current', 'true')
  await expect(buttonA).not.toHaveAttribute('aria-current', 'true')
  state.rows = [a]
  await next(page).click()
  await expect(history(page)).toContainText('현재 이력 페이지: 2')
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'FAILED')
  state.rows = [a, b]
  await first(page).click()
  await expect(buttonB).toHaveAttribute('aria-current', 'true')
  await expect(history(page).locator('[aria-current="true"]')).toHaveCount(1)
  expect(duplicateKeyErrors).toEqual([])
  expect(state.posts).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 이력 행의 문단·날짜·동작이 겹치지 않고 키보드 선택을 유지한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 960 })
  const state = await setup(page); await load(page)
  await page.evaluate(() => document.fonts.ready)
  const button = select(page, 0)
  await button.focus(); await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-current', 'true')
  await expect(button).toBeFocused()
  await button.evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }))
  const rects = []
  for (let index = 0; index < 3; index++) {
    const row = await select(page, index).boundingBox(), title = await item(page, index).locator('.t').boundingBox(), metadata = await item(page, index).locator('.native-history-meta').boundingBox()
    expect(row).not.toBeNull(); expect(title).not.toBeNull(); expect(metadata).not.toBeNull()
    expect(row!.height).toBeGreaterThanOrEqual(44)
    expect(row!.x).toBeGreaterThanOrEqual(0); expect(row!.x + row!.width).toBeLessThanOrEqual(width + 1)
    expect(title!.x + title!.width <= metadata!.x + 1 || title!.y + title!.height <= metadata!.y + 1).toBe(true)
    rects.push({ row, title, metadata })
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await testInfo.attach(`native-history-layout-${width}.json`, { body: JSON.stringify(rects, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: testInfo.outputPath(`native-history-list-${width}.png`), fullPage: true })
  await next(page).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const navigation = await next(page).boundingBox(), composer = await page.locator('.g-composer').boundingBox()
  expect(navigation).not.toBeNull(); expect(composer).not.toBeNull()
  expect(navigation!.y + navigation!.height).toBeLessThanOrEqual(composer!.y)
  await testInfo.attach(`native-history-navigation-${width}.json`, { body: JSON.stringify({ navigation, composer }, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: testInfo.outputPath(`native-history-navigation-${width}.png`), fullPage: true })
  await next(page).click()
  await expect(history(page)).toContainText('현재 이력 페이지: 2')
  expect(state.posts).toEqual([])
})
