import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { nativeResearchPlanText } from '../../src/internal-poc/native-research-plan-copy'
import { nativeRowText } from '../../src/internal-poc/native-row-copy'

// Actual NativeServiceApp/row controller/installed SDK with explicit synthetic
// wire data. No real server research, compiler, approval, market or order proof.
test.use({ trace: 'off', video: 'off' })
const ready = fixture.snapshots.ready
const changed = { ...ready, conversationStateRevision: '5', conversationStateHash: 'a'.repeat(64), draftRevision: '3', projectionHash: 'b'.repeat(64), semanticHash: 'c'.repeat(64),
  draftState: { ...ready.draftState, revision: 3, projectionHash: 'b'.repeat(64), projection: { ...ready.draftState.projection,
    exitRules: ready.draftState.projection.exitRules.map(rule => rule.kind === 'stop_loss' ? { ...rule, distanceFraction: '0.03' } : rule) } } }
const owner = 'session_plan_fixture_000001'
const keys = ['target', 'entry', 'stopLoss', 'takeProfit', 'researchRange', 'holdoutRange', 'costs', 'validation'] as const
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_plan_fixture_000001', traceId: 'trace_plan_fixture_000001', resourceRevision: revision })
const plan = (page: Page) => page.locator('.native-research-plan')
const row = (page: Page, key: string) => plan(page).locator(`.g-row[data-k="${key}"]`)
const composer = (page: Page) => page.locator('.g-composer textarea')
const comment = (page: Page) => row(page, 'stopLoss').locator('.native-row-form input')
const status = (page: Page) => row(page, 'stopLoss').getByRole('status')
async function openPlan(page: Page) {
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await expect(plan(page)).toBeVisible()
}
async function back(page: Page) { await page.locator('.rw-title > button').first().click(); await expect(plan(page)).toBeHidden() }
async function language(page: Page, code: string) { await page.evaluate(async code => {
  const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code)
}, code) }

async function setup(page: Page) {
  const state = { snapshot: structuredClone(ready), loseFirstTurn: false, unauthorizedTurn: false, turnGate: null as Promise<void> | null, requests: [] as string[],
    wire: [] as { path: string; body: { message: string; clientMessageId: string; expectedConversationStateRevision: string }; key: string; match: string; csrf: string }[] }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    state.requests.push(`${request.method()} ${path}`)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: '"plan_session_etag_fixture_0001"' }
    let data: unknown, status = 200, version = '0.1.0', revision: string | null = '1'
    if (path === '/api/v1/auth/session') data = { sessionId: owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    else if (path === '/api/v1/auth/csrf') { data = { csrfToken: 'csrf_plan_fixture_000001', expiresAt: '2030-01-02T00:00:00Z' }; revision = null; delete headers.ETag }
    else if (path.startsWith('/api/v3/')) {
      version = '0.3.0'; revision = state.snapshot.conversationStateRevision
      if (request.method() === 'GET') data = state.snapshot
      else {
        const body = request.postDataJSON()
        state.wire.push({ path, body, key: request.headers()['idempotency-key'], match: request.headers()['if-match'], csrf: request.headers()['x-csrf-token'] })
        if (path.endsWith('/messages')) {
          if (state.unauthorizedTurn) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({
            meta: meta('0.3.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session unavailable' },
          }) })
          state.snapshot = structuredClone(changed); revision = state.snapshot.conversationStateRevision
          const turnId = 'turn_plan_fixture_000001', message = body.message as string
          data = { turnId, conversation: state.snapshot,
            compilerTurnResult: { contractVersion: '0.1.0', status: 'PATCH_PROPOSED', source: { turnId, textSha256: createHash('sha256').update(message.normalize('NFC')).digest('hex'), normalization: 'unicode_nfc_codepoint_v1' },
              draftPatch: { contractVersion: '0.1.0', baseDraftVersion: 2, atomic: true, patches: [{ op: 'replace', target: { entity: 'exit_rule', id: 'exit_stop', field: 'distanceFraction' },
                precondition: { expectedValueHash: 'e'.repeat(64) }, value: '0.03', reasonCode: 'user_correction', evidenceSpan: { text: message, start: 0, end: Array.from(message).length, offsetUnit: 'unicode_code_point' } }] } },
            mergeResult: { contractVersion: '0.2.0', status: 'APPLIED', sourceTurnId: turnId, baseDraftRevision: 2, resultDraftRevision: 3,
              beforeProjectionHash: ready.projectionHash, afterProjectionHash: changed.projectionHash, appliedPatchCount: 1, draftState: state.snapshot.draftState, issues: [] } }
          // Commit happened, only the response was lost. GET can observe the
          // new snapshot; exact replay still returns the original committed TURN.
          if (state.turnGate) await state.turnGate
          if (state.loseFirstTurn && state.wire.filter(item => item.path.endsWith('/messages')).length === 1) return route.abort('failed')
        } else if (path.endsWith('/validate')) data = fixture.documents.find(item => item.name === 'validation-receipt')!.value
        else if (path.endsWith('/approval-challenges')) { data = fixture.documents.find(item => item.name === 'approval-challenge')!.value; status = 201 }
        else return route.abort('failed')
      }
      headers.ETag = `"plan_conversation_etag_fixture_${revision}"`
    } else return route.abort('failed')
    return route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return state
}

const thread = (page: Page, id = 'plan') => page.locator(`.native-research-thread[data-document-id="${id}"]`)
async function artifact(page: Page, id: string) {
  const workspace = page.locator('.native-research-workspace')
  if (!await workspace.locator('.rw-aux').isVisible()) await workspace.locator('.rw-title .rw-mobile-artifacts').click()
  const names: Record<string, string> = { plan: '연구 계획', activity: '연구 과정', hypo: '가설' }
  await workspace.locator('.rw-artifact').filter({ has: page.locator('span', { hasText: names[id] }) }).first().click()
}

test('문서 대화는 같은 입력창·실제 TURN을 유지하고 그 문서에 답변을 표시한다', async ({ page }) => {
  const state = await setup(page)
  await openPlan(page)
  await expect(page.locator('.g-composer .g-ctx')).toHaveText('컨텍스트, 연구 계획')
  await expect(page.locator('.rw-context')).toHaveCount(0)
  await composer(page).evaluate(element => element.dataset.identityProbe = 'retained')
  await composer(page).fill('손절을 3%로 바꿔주세요')
  await composer(page).press('Enter')
  await expect(thread(page).locator('.g-umsg')).toHaveText('손절을 3%로 바꿔주세요')
  await expect(thread(page).locator('.g-amsg[data-response-state="done"]')).toBeVisible()
  await expect(plan(page)).toBeVisible()
  await expect(composer(page)).toHaveCount(1)
  await expect(composer(page)).toHaveAttribute('data-identity-probe', 'retained')
  expect(state.wire).toHaveLength(1)
  expect(state.wire[0].body.message).toBe('손절을 3%로 바꿔주세요')
  expect(state.wire[0].body).not.toHaveProperty('researchThread')
  await back(page)
  await expect(page.locator('.client-conversation-frame .g-umsg')).toHaveCount(0)
  await openPlan(page)
  await expect(thread(page).locator('.g-umsg')).toHaveCount(1)
})

test('문서 전환 중 도착한 응답은 원래 문서에만 남고 화면을 빼앗지 않는다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  state.turnGate = new Promise<void>(resolve => { release = resolve })
  await openPlan(page)
  await composer(page).fill('손절 3%로 변경')
  await composer(page).press('Enter')
  await expect(thread(page).locator('.g-umsg')).toHaveCount(1)
  await expect(thread(page).locator('[data-native-thread-pending]')).toBeVisible()
  await artifact(page, 'activity')
  await expect(page.locator('.g-composer .g-ctx')).toHaveText('컨텍스트, 연구 과정')
  release()
  await expect(thread(page).locator('[data-native-thread-pending]')).toHaveCount(0)
  await expect(page.locator('.rw-tabs [aria-selected="true"]')).toHaveText('연구 과정')
  await expect(thread(page, 'activity').locator('.g-umsg')).toHaveCount(0)
  await artifact(page, 'plan')
  await expect(thread(page).locator('.g-amsg[data-response-state="done"]')).toBeVisible()
  await thread(page).locator('.g-amsg[data-response-state="done"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `/tmp/teth-document-thread-answer-${test.info().project.name}.png` })
  expect(state.wire).toHaveLength(1)
})

for (const recheck of [false, true]) test(`문서 대화 응답유실은 같은 키로 복구하며 질문·답변을 중복하지 않는다 recheck=${recheck}`, async ({ page }) => {
  const state = await setup(page); state.loseFirstTurn = true
  await openPlan(page)
  await composer(page).fill('손절을 3%로 변경')
  await composer(page).press('Enter')
  await expect(thread(page).locator('[data-delivery="uncertain"]')).toBeVisible()
  if (recheck) {
    await back(page)
    await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await openPlan(page)
  }
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(thread(page).locator('.g-amsg[data-response-state="done"]')).toBeVisible()
  await expect(thread(page).locator('.g-umsg')).toHaveCount(1)
  await expect(thread(page).locator('[data-delivery="uncertain"]')).toHaveCount(0)
  expect(state.wire).toHaveLength(2)
  expect(state.wire[1]).toEqual(state.wire[0])
})

test('다른 문서 질문은 서로 섞이지 않고 언어 변경과 질문 편집 후에도 문서가 유지된다', async ({ page }) => {
  const state = await setup(page)
  await openPlan(page)
  await composer(page).fill('계획 손절 3%')
  await composer(page).press('Enter')
  await expect(thread(page).locator('.g-amsg[data-response-state="done"]')).toBeVisible()
  await artifact(page, 'activity')
  await composer(page).fill('진행 중 손절 3%')
  await composer(page).press('Enter')
  await expect(thread(page, 'activity').locator('.g-amsg[data-response-state="done"]')).toBeVisible()
  await expect(thread(page, 'activity').locator('.g-umsg')).toHaveText('진행 중 손절 3%')
  await artifact(page, 'plan')
  await expect(thread(page).locator('.g-umsg')).toHaveText('계획 손절 3%')
  await language(page, 'fr')
  await thread(page).locator('.g-uacts button').first().click()
  await expect(composer(page)).toHaveValue('계획 손절 3%')
  await expect(composer(page)).toBeFocused()
  await expect(plan(page)).toBeVisible()
  expect(state.wire).toHaveLength(2)
  await page.setViewportSize({ width: 320, height: 780 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: `/tmp/teth-document-thread-${test.info().project.name}.png` })
})

test('문서 목록의 키보드 초점은 데스크톱에 남고 모바일 닫힘에는 선택 탭으로 돌아온다', async ({ page }) => {
  await setup(page); await openPlan(page)
  const workspace = page.locator('.native-research-workspace')
  const collapsed = !await workspace.locator('.rw-aux').isVisible()
  if (collapsed) await workspace.locator('.rw-title .rw-mobile-artifacts').click()
  const target = workspace.locator('.rw-artifact').filter({ has: page.locator('span', { hasText: '가설' }) }).first()
  await target.focus(); await page.keyboard.press('Enter')
  if (collapsed) await expect(workspace.getByRole('tab', { name: '가설', exact: true })).toBeFocused()
  else await expect(target).toBeFocused()
  await expect(page.locator('.g-composer .g-ctx')).toHaveText('컨텍스트, 가설')
})

test('401로 연구화면이 닫혀도 확인하지 못한 문서 질문은 복구 화면에서 유지한다', async ({ page }) => {
  const state = await setup(page); state.unauthorizedTurn = true
  await openPlan(page); await composer(page).fill('미확정 문서 질문 보존'); await composer(page).press('Enter')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(page.locator('.client-conversation-frame .g-umsg')).toHaveText('미확정 문서 질문 보존')
  await expect(page.locator('.client-conversation-frame [data-delivery="uncertain"]')).toBeVisible()
})

test('문서 왕복은 작성란 DOM과 선택 범위를 보존한다', async ({ page }) => {
  await setup(page)
  await composer(page).fill('왕복 중 보존할 입력')
  await composer(page).evaluate(element => { Reflect.set(window, 'composerBeforeDocument', element); element.setSelectionRange(2, 5) })
  await openPlan(page)
  expect(await composer(page).evaluate(element => element === Reflect.get(window, 'composerBeforeDocument'))).toBe(true)
  expect(await composer(page).evaluate(element => [element.selectionStart, element.selectionEnd])).toEqual([2, 5])
  await back(page)
  expect(await composer(page).evaluate(element => element === Reflect.get(window, 'composerBeforeDocument'))).toBe(true)
})

test('같은 문서를 닫고 다시 열면 스크롤 위치를 유지한다', async ({ page }) => {
  await setup(page); await openPlan(page)
  const scroll = page.locator('.rw-scroll')
  await scroll.evaluate(element => { element.scrollTop = 280 })
  const position = await scroll.evaluate(element => element.scrollTop)
  expect(position).toBeGreaterThan(0)
  await back(page); await openPlan(page)
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBe(position)
})

test('다른 문서에서 도착한 답변은 새 응답으로 찾고 직접 이동할 수 있다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  state.turnGate = new Promise<void>(resolve => { release = resolve })
  await openPlan(page); await composer(page).fill('지연 문서 답변'); await composer(page).press('Enter')
  await expect(thread(page).locator('[data-native-thread-pending]')).toBeVisible()
  await page.locator('.rw-scroll').evaluate(element => { element.scrollTop = 0 })
  await artifact(page, 'activity'); release()
  await expect(thread(page).locator('.g-amsg[data-response-state="done"]')).toHaveCount(1)
  const workspace = page.locator('.native-research-workspace')
  if (!await workspace.locator('.rw-aux').isVisible()) await workspace.locator('.rw-title .rw-mobile-artifacts').click()
  await expect(workspace.locator('.rw-artifact').filter({ hasText: '연구 계획' }).locator('small')).toHaveText('새 응답')
  await artifact(page, 'plan')
  await page.getByRole('button', { name: '↓ 새 응답', exact: true }).click()
  await expect(thread(page).locator('.g-amsg[data-response-state="done"]')).toBeInViewport()
  await expect(page.getByRole('button', { name: '↓ 새 응답', exact: true })).toHaveCount(0)
  expect(state.wire).toHaveLength(1)
})

test('활성 탭을 다시 선택한 뒤 모바일 문서목록 Escape는 트리거로 돌아간다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page); await openPlan(page)
  await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
  const trigger = page.locator('.rw-title .rw-mobile-artifacts')
  await trigger.click(); await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('실제 앱 연구계획은 원본8행·서버조건·미공급4행·전체SDK조건을 표시한다', async ({ page }) => {
  const state = await setup(page), before = [...state.requests]
  await openPlan(page)
  await expect(plan(page).locator(':scope > h3')).toHaveText('연구 계획')
  await expect(plan(page).locator('.g-row > .k')).toHaveText(keys.map(key => nativeResearchPlanText('ko', key)))
  await expect(row(page, 'target').locator('.v')).toHaveText('BTCUSDT · binance · 15m · usd_m_perpetual')
  await expect(row(page, 'entry').locator('.v')).toContainText('28')
  await expect(row(page, 'entry').locator('.v')).toContainText('RSI')
  await expect(row(page, 'stopLoss').locator('.v')).toContainText('2%')
  await expect(row(page, 'takeProfit').locator('.v')).toContainText('5%')
  for (const key of keys.slice(4)) { await expect(row(page, key).locator('.v')).toHaveText('미제공'); await expect(row(page, key).getByRole('button')).toBeDisabled() }
  await expect(plan(page).locator(':scope > .g-note')).toHaveText('미제공')
  expect(await plan(page).innerText()).not.toMatch(/2023\.01|2025\.07|2026\.08|7단계|수수료, 슬리피지 포함/)
  await expect(plan(page).locator('.native-row-comment')).toHaveCount(14)
  await expect(plan(page).locator('.native-plan-technical')).not.toHaveAttribute('open', '')
  await plan(page).locator('.native-plan-technical > summary').click()
  await plan(page).locator('.native-strategy-source > summary').click()
  await expect(plan(page).locator('.native-strategy-source pre')).toHaveText(JSON.stringify(ready.draftState.projection, null, 2))
  expect(state.requests).toEqual(before); expect(state.wire).toEqual([])
})

for (const mode of ['draft', 'uncertain'] as const) test(`계획 손절 조건 제거 후 ${mode} 메모는 이전 항목에서 복구할 수 있다`, async ({ page }) => {
  const uncertain = mode !== 'draft'
  const state = await setup(page)
  await openPlan(page)
  await row(page, 'stopLoss').locator('.native-row-trigger').click()
  const text = '손절 메모 보존 4% $&'
  await comment(page).fill(text)
  if (uncertain) {
    state.loseFirstTurn = true
    await comment(page).press('Enter')
    await expect(status(page)).toContainText(nativeRowText('ko', 'uncertain'))
  }
  await back(page)
  state.snapshot = { ...structuredClone(changed), draftState: { ...structuredClone(changed.draftState), projection: {
    ...structuredClone(changed.draftState.projection), exitRules: changed.draftState.projection.exitRules.filter(rule => rule.kind !== 'stop_loss'),
  } } }
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await openPlan(page)
  await expect(row(page, 'stopLoss').locator('.v')).toHaveText(nativeResearchPlanText('ko', 'unavailable'))
  await plan(page).locator('.native-plan-technical > summary').click()
  const previous = plan(page).locator('.native-row-previous')
  await expect(previous.getByText(text, { exact: true })).toBeVisible()
  if (uncertain) await expect(previous.getByRole('status')).toContainText(nativeRowText('ko', 'uncertain'))
  expect(state.wire).toHaveLength(uncertain ? 1 : 0)
})

test('계획 손절 행은 실제 TURN 한건으로만 갱신되고 별도 composer 초안은 보존된다', async ({ page }) => {
  const state = await setup(page)
  await composer(page).fill('별도 대화 초안 $&')
  await openPlan(page)
  await row(page, 'stopLoss').locator('.native-row-trigger').click()
  await comment(page).fill('3%로 변경해주세요'); await comment(page).press('Enter')
  await expect(status(page)).toContainText(nativeRowText('ko', 'applied'))
  await expect(row(page, 'stopLoss').locator('.v')).toContainText('3%')
  await expect(comment(page)).toHaveValue('')
  await expect(composer(page)).toHaveValue('별도 대화 초안 $&')
  expect(state.wire).toHaveLength(1)
  expect(state.wire[0].body).toMatchObject({ message: '손절: 3%로 변경해주세요', expectedConversationStateRevision: ready.conversationStateRevision })
  expect(state.wire[0].path).toBe(`/api/v3/conversations/${ready.conversationId}/messages`)
  await back(page); await openPlan(page)
  await expect(row(page, 'stopLoss').locator('.v')).toContainText('3%')
  await expect(composer(page)).toHaveValue('별도 대화 초안 $&')
})

test('확정TURN 응답유실·현재snapshot재조회·동일키복구는 행 원문과 요청결속을 유지한다', async ({ page }) => {
  const state = await setup(page); state.loseFirstTurn = true
  await openPlan(page); await row(page, 'stopLoss').locator('.native-row-trigger').click()
  await comment(page).fill('3%로'); await comment(page).press('Enter')
  await expect(status(page)).toContainText(nativeRowText('ko', 'uncertain'))
  await expect(row(page, 'stopLoss').locator('.v')).toContainText('2%')
  await expect(comment(page)).toHaveValue('3%로')
  await back(page)
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await openPlan(page)
  await expect(comment(page)).toHaveValue('3%로')
  await expect(row(page, 'stopLoss').locator('.v')).toContainText('3%')
  await expect(status(page)).toContainText(nativeRowText('ko', 'uncertain'))
  await back(page)
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await openPlan(page)
  await expect(status(page)).toContainText(nativeRowText('ko', 'applied'))
  await expect(comment(page)).toHaveValue('')
  expect(state.wire).toHaveLength(2); expect(state.wire[0].key).toBeTruthy(); expect(state.wire[1]).toEqual(state.wire[0])
})

test('320px 7언어 계획은 행순서·값·단일editor DOM·선택·미전송초안을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const state = await setup(page)
  await composer(page).fill('별도 composer 초안')
  await openPlan(page); await row(page, 'stopLoss').locator('.native-row-trigger').click()
  await comment(page).fill('보존할 초안 $& {id} 0.000000000001')
  await comment(page).evaluate(node => (node as HTMLInputElement).setSelectionRange(2, 8))
  const node = await comment(page).elementHandle(), before = [...state.requests]
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, code)
    await expect(plan(page).locator('.g-row > .k')).toHaveText(keys.map(key => nativeResearchPlanText(code, key)))
    await expect(comment(page)).toHaveValue('보존할 초안 $& {id} 0.000000000001')
    await expect(comment(page)).toBeFocused()
    expect(await comment(page).evaluate((current, original) => current === original, node)).toBe(true)
    expect(await comment(page).evaluate(node => [(node as HTMLInputElement).selectionStart, (node as HTMLInputElement).selectionEnd])).toEqual([2, 8])
    await expect(row(page, 'stopLoss').locator('input')).toHaveCount(1)
    await expect(composer(page)).toHaveValue('별도 composer 초안')
    await expect(row(page, 'target').locator('.v')).toHaveText('BTCUSDT · binance · 15m · usd_m_perpetual')
    await expect(row(page, 'stopLoss').locator('.v')).toContainText('2%')
    for (const key of keys.slice(4)) await expect(row(page, key).locator('.v')).toHaveText(nativeResearchPlanText(code, 'unavailable'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(state.requests).toEqual(before); expect(state.wire).toEqual([])
  await page.screenshot({ path: info.outputPath('research-plan-320-fr.png') })
})

test('미전송 계획행은 재조회한 새revision에 자동제출되지 않는다', async ({ page }) => {
  const state = await setup(page)
  await openPlan(page); await row(page, 'stopLoss').locator('.native-row-trigger').click()
  await comment(page).fill('4%로')
  await back(page); state.snapshot = structuredClone(changed)
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await openPlan(page); await comment(page).press('Enter')
  await expect(status(page)).toContainText(nativeRowText('ko', 'stale'))
  await expect(comment(page)).toHaveValue('4%로')
  await expect(row(page, 'stopLoss').locator('.v')).toContainText('3%')
  expect(state.wire).toEqual([])
})

test('계획의 실제 검증·승인내용확인은 동일controller이며 열기만으로 승인하지 않는다', async ({ page }) => {
  const state = await setup(page)
  await openPlan(page)
  await expect(page.getByRole('button', { name: '전략 검증', exact: true })).toBeVisible()
  expect(state.wire).toEqual([])
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
  const checkbox = page.getByRole('checkbox')
  await expect(checkbox).not.toBeChecked()
  const node = await checkbox.elementHandle()
  expect(state.wire.map(item => item.path.split('/').at(-1))).toEqual(['validate', 'approval-challenges'])
  await back(page)
  await expect(checkbox).not.toBeChecked()
  expect(await checkbox.evaluate((current, original) => current === original, node)).toBe(true)
  await openPlan(page)
  await expect(checkbox).not.toBeChecked()
  expect(await checkbox.evaluate((current, original) => current === original, node)).toBe(true)
  expect(state.wire).toHaveLength(2)
})
