import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { nativeStrategyText } from '../../src/internal-poc/native-strategy-copy'
import { nativeShellText } from '../../src/internal-poc/native-shell-copy'
import { nativeRowText } from '../../src/internal-poc/native-row-copy'

// Synthetic approved wire fixtures through the real native controller/SDK.
// No external authentication, model, market feed or execution is exercised.
test.use({ trace: 'off', video: 'off' })
const ready = fixture.snapshots.ready
const changed = { ...ready, conversationStateRevision: '5', conversationStateHash: 'a'.repeat(64), draftRevision: '3', projectionHash: 'b'.repeat(64), semanticHash: 'c'.repeat(64),
  draftState: { ...ready.draftState, revision: 3, projectionHash: 'b'.repeat(64), projection: { ...ready.draftState.projection, execution: { ...ready.draftState.projection.execution, leverage: 3 } } } }
const owner = 'session_document_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_document_fixture_0001', traceId: 'trace_document_fixture_0001', resourceRevision: revision })

async function setup(page: Page, previous = false) {
  const controls = { snapshot: structuredClone(ready), outcome: 'applied' as 'applied' | 'clarification' | 'unsupported' | 'rejected' | 'proposed',
    tamperHash: false, tamperDraft: false, removeExit: false, requests: [] as string[], posts: [] as { path: string; body: unknown }[] }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner, previous }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
    if (previous) sessionStorage.setItem('tesia.native.previous-conversation', JSON.stringify({ sessionId: owner, conversationId: 'conversation_document_other_0002' }))
  }, { id: ready.conversationId, owner, previous })
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) controls.requests.push(`${request.method()} ${path}`) })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"document_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
    data: { sessionId: owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null),
    data: { csrfToken: 'csrf_document_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let data: unknown = path.endsWith('/conversation_document_other_0002') ? { ...ready, conversationId: 'conversation_document_other_0002' } : controls.snapshot, status = 200
    if (request.method() !== 'GET') controls.posts.push({ path, body: request.postDataJSON() })
    if (path.endsWith('/messages')) {
      controls.snapshot = structuredClone(changed)
      if (controls.removeExit) controls.snapshot.draftState.projection = { ...structuredClone(ready.draftState.projection), exitRules: ready.draftState.projection.exitRules.slice(1) }
      const sourceTurnId = 'turn_document_fixture_0002'
      // Same PATCH_PROPOSED/APPLIED fixture shape exercised by native-strategy-iteration.
      const turn = { turnId: sourceTurnId, conversation: controls.snapshot,
        compilerTurnResult: { contractVersion: '0.1.0', status: 'PATCH_PROPOSED', source: { turnId: sourceTurnId, textSha256: controls.tamperHash ? 'd'.repeat(64) : createHash('sha256').update(request.postDataJSON().message.normalize('NFC')).digest('hex'), normalization: 'unicode_nfc_codepoint_v1' },
          draftPatch: { contractVersion: '0.1.0', baseDraftVersion: 2, atomic: true, patches: [{ op: 'set', target: { entity: 'execution', field: 'leverage' },
            precondition: { expectedValueHash: 'e'.repeat(64) }, value: 3, evidenceSpan: { text: '레버리지 3배', start: 0, end: 7, offsetUnit: 'unicode_code_point' }, reasonCode: 'user_correction' }] } },
        mergeResult: { contractVersion: '0.2.0', status: 'APPLIED', sourceTurnId, baseDraftRevision: 2, resultDraftRevision: 3,
          beforeProjectionHash: ready.projectionHash, afterProjectionHash: changed.projectionHash, appliedPatchCount: 1, draftState: controls.snapshot.draftState, issues: [] } }
      data = turn
      if (controls.removeExit) data = { ...turn, compilerTurnResult: { ...turn.compilerTurnResult, draftPatch: { ...turn.compilerTurnResult.draftPatch, patches: [{
        op: 'remove', target: { entity: 'exit_rule', id: ready.draftState.projection.exitRules[0].id }, precondition: { expectedValueHash: 'e'.repeat(64) },
        evidenceSpan: { text: request.postDataJSON().message, start: 0, end: Array.from(request.postDataJSON().message).length, offsetUnit: 'unicode_code_point' }, reasonCode: 'user_removal',
      }] } } }
      if (controls.outcome !== 'applied') {
        controls.snapshot = { ...structuredClone(ready), conversationStateRevision: '5', conversationStateHash: 'a'.repeat(64) }
        const question = { questionId: 'q_document_row_0001', targetField: 'stop_loss', reasonCode: 'RELATIVE_EXPRESSION', prompt: '손절 거리를 몇 퍼센트로 변경할까요?', options: ['2%', '3%'] }
        data = { ...turn, conversation: { ...controls.snapshot, ...(controls.outcome === 'clarification' ? { candidateState: 'INCOMPLETE', semanticHash: null, nextQuestion: question } : { nextQuestion: null }) },
          compilerTurnResult: controls.outcome === 'clarification' ? { contractVersion: '0.1.0', status: 'CLARIFICATION_REQUIRED', source: turn.compilerTurnResult.source, question }
            : controls.outcome === 'unsupported' ? { contractVersion: '0.1.0', status: 'UNSUPPORTED', source: turn.compilerTurnResult.source, reasonCode: 'RISK_POLICY_CONFLICT', message: '지원하지 않는 조건입니다.' } : turn.compilerTurnResult,
          mergeResult: controls.outcome === 'rejected' ? { ...turn.mergeResult, status: 'REJECTED', resultDraftRevision: 2, afterProjectionHash: ready.projectionHash,
            appliedPatchCount: 0, draftState: ready.draftState, issues: [{ code: 'PRECONDITION_FAILED', instancePath: '/execution/leverage' }] } : null }
      }
      if (controls.tamperDraft) data = { ...(data as Record<string, unknown>), conversation: changed }
    } else if (path.endsWith('/validate')) data = fixture.documents.find(item => item.name === 'validation-receipt')!.value
    else if (path.endsWith('/approval-challenges')) { data = fixture.documents.find(item => item.name === 'approval-challenge')!.value; status = 201 }
    else if (request.method() !== 'GET') return route.abort('failed')
    return route.fulfill({ status, contentType: 'application/json', headers: { ETag: `"document_conversation_etag_000${controls.snapshot.conversationStateRevision}"` }, body: JSON.stringify({ meta: meta('0.3.0', controls.snapshot.conversationStateRevision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return controls
}
const doc = (page: Page) => page.getByRole('article', { name: '현재 서버 전략 초안', exact: true })
const docTab = (page: Page) => page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true })
async function openDetailedDocument(page: Page) {
  if (!await page.locator('.native-research-workspace').isVisible()) await page.locator('.g-tabs button').nth(1).click()
  // The original eight-row research plan is the primary surface. These tests
  // deliberately inspect the full SDK conditions through its disclosure.
  const details = page.locator('.native-plan-technical')
  if (await details.isVisible() && !await details.evaluate(node => (node as HTMLDetailsElement).open)) await details.locator(':scope > summary').click()
}
const chatTab = (page: Page) => page.locator('.g-tabs').getByRole('button', { name: '대화', exact: true })
async function backToConversation(page: Page) {
  const workspace = page.locator('.native-research-workspace')
  if (await workspace.isVisible()) await workspace.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  else await chatTab(page).click()
}
const input = (page: Page) => page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
test('원본 행 코멘트는 실제 TURN으로 보내고 서버 초안만 갱신하며 별도 composer를 보존한다', async ({ page }) => {
  const controls = await setup(page)
  const composer = page.locator('.g-composer textarea')
  await composer.fill('별도로 작성 중인 질문')
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await expect(field).toBeFocused()
  await field.fill('3배로 변경해주세요')
  await field.press('Enter')
  await expect(doc(page)).toHaveAttribute('data-draft-revision', '3')
  await expect(doc(page).getByRole('status')).toContainText('서버 초안')
  await expect(field).toHaveValue('')
  await expect(composer).toHaveValue('별도로 작성 중인 질문')
  expect(controls.posts).toHaveLength(1)
  expect(controls.posts[0].body).toMatchObject({ message: '레버리지: 3배로 변경해주세요', expectedConversationStateRevision: ready.conversationStateRevision })
  await backToConversation(page)
  await expect(page.getByText('레버리지: 3배로 변경해주세요', { exact: true })).toBeVisible()
})

test('행 코멘트는 IME Escape와 취소·문서 왕복에 원문을 유지한다', async ({ page }) => {
  const controls = await setup(page)
  await openDetailedDocument(page)
  const trigger = doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true })
  await trigger.click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('미전송 $& {id} 원문')
  await field.dispatchEvent('keydown', { key: 'Escape', isComposing: true })
  await expect(field).toBeVisible()
  await field.press('Escape')
  await expect(trigger).toBeFocused()
  await backToConversation(page)
  await openDetailedDocument(page)
  await trigger.click()
  await expect(field).toHaveValue('미전송 $& {id} 원문')
  expect(controls.posts).toEqual([])
})

for (const outcome of ['clarification', 'unsupported', 'rejected', 'proposed'] as const) test(`행 요청 ${outcome}은 서버 응답을 구별하며 원문·기존 수치를 유지한다`, async ({ page }) => {
  const controls = await setup(page); controls.outcome = outcome
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('조건을 바꿔주세요 $& {id}')
  await field.press('Enter')
  // PATCH_PROPOSED with a null merge is rejected by the generated SDK even
  // though the structural TypeScript union permits it. Never relax validation.
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', outcome === 'proposed' ? 'uncertain' : outcome))
  await expect(field).toHaveValue('조건을 바꿔주세요 $& {id}')
  await expect(doc(page)).toHaveAttribute('data-draft-revision', ready.draftRevision)
  if (outcome === 'clarification') await expect(doc(page).getByRole('status')).toContainText('손절 거리를 몇 퍼센트로 변경할까요?')
  expect(controls.posts).toHaveLength(1)
})

test('행 요청 응답 유실·세션 재확인·같은 키 재개는 원문과 요청 결속을 유지한다', async ({ page }) => {
  const controls = await setup(page)
  const wire: { id: string | undefined; body: unknown }[] = []
  await page.route('**/api/v3/conversations/*/messages', async route => {
    wire.push({ id: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
    if (wire.length === 1) await route.abort('failed'); else await route.fallback()
  })
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('3배로'); await field.press('Enter')
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', 'uncertain'))
  await expect(field).toHaveValue('3배로')
  await backToConversation(page)
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await openDetailedDocument(page)
  await expect(field).toHaveValue('3배로')
  await backToConversation(page)
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toContainText('3배')
  await openDetailedDocument(page)
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', 'applied'))
  await expect(field).toHaveValue('')
  expect(wire).toHaveLength(2); expect(wire[0].id).toBeTruthy(); expect(wire[1]).toEqual(wire[0])
  expect(controls.posts).toHaveLength(1)
})

test('서버 재조회로 초안이 바뀌면 오래된 행 요청을 자동 전송하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('2배로')
  await backToConversation(page)
  controls.snapshot = structuredClone(changed)
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await openDetailedDocument(page); await field.press('Enter')
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', 'stale'))
  await expect(field).toHaveValue('2배로'); expect(controls.posts).toEqual([])
})

test('행 요청 저장 실패는 적용 성공이 아니며 입력과 별도 composer를 보존한다', async ({ page }) => {
  const controls = await setup(page)
  await page.locator('.g-composer textarea').fill('별도 원문')
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('3배로')
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('synthetic storage failure', 'QuotaExceededError') } })
  await field.press('Enter')
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', 'notSent'))
  await expect(field).toHaveValue('3배로')
  await expect(page.locator('.g-composer textarea')).toHaveValue('별도 원문')
  expect(controls.posts).toEqual([])
})

test('4000자를 넘는 행 요청은 journal 전에 거절하고 원문을 유지한다', async ({ page }) => {
  const controls = await setup(page)
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('가'.repeat(4000)); await field.press('Enter')
  await expect(doc(page).getByRole('status')).toContainText('4000')
  await expect(field).toHaveValue('가'.repeat(4000))
  expect(controls.posts).toEqual([])
  await expect(field).not.toHaveAttribute('readonly')
})

test('다른 원문 hash의 APPLIED 응답은 해당 행 수정 성공으로 처리하지 않는다', async ({ page }) => {
  const controls = await setup(page); controls.tamperHash = true
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('3배로'); await field.press('Enter')
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', 'uncertain'))
  await expect(field).toHaveValue('3배로')
  await expect(doc(page)).toHaveAttribute('data-draft-revision', ready.draftRevision)
  expect(controls.posts).toHaveLength(1)
})

test('이전 대화 왕복은 각 문서의 미전송 행 초안을 분리해 보존한다', async ({ page }) => {
  const controls = await setup(page, true)
  const restore = page.getByRole('button', { name: '이전 대화 서버에서 다시 확인', exact: true })
  for (const text of ['첫 문서의 원문', '다른 문서의 원문']) {
    await openDetailedDocument(page)
    await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
    await doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true }).fill(text)
    await backToConversation(page); await restore.click()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  }
  await openDetailedDocument(page)
  await expect(doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })).toHaveValue('첫 문서의 원문')
  await backToConversation(page); await restore.click(); await openDetailedDocument(page)
  await expect(doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })).toHaveValue('다른 문서의 원문')
  expect(controls.posts).toEqual([])
})

for (const tamper of [false, true]) test(`행 요청 reload 뒤 동일 키 재개는 원문 hash 검사를 유지한다: 변조=${tamper}`, async ({ page }) => {
  const controls = await setup(page)
  let calls = 0
  const bodies: unknown[] = []
  await page.route('**/api/v3/conversations/*/messages', async route => {
    bodies.push(route.request().postDataJSON())
    if (++calls === 1) await route.abort('failed'); else await route.fallback()
  })
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('3배로'); await field.press('Enter')
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', 'uncertain'))
  controls.tamperHash = tamper
  await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  if (tamper) {
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).not.toBeNull()
  } else {
    await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toContainText('3배')
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
  }
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0])
})

test('추가 질문 응답이 임의로 초안 값을 변경하면 반영하지 않는다', async ({ page }) => {
  const controls = await setup(page); controls.outcome = 'clarification'; controls.tamperDraft = true
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('3배로'); await field.press('Enter')
  await expect(doc(page).getByRole('status')).toContainText(nativeRowText('ko', 'uncertain'))
  await expect(doc(page)).toHaveAttribute('data-draft-revision', ready.draftRevision)
  await expect(field).toHaveValue('3배로')
})

test('수정으로 서버 규칙 행이 사라져도 요청 원문과 결과 안내를 문서에 남긴다', async ({ page }) => {
  const controls = await setup(page); controls.removeExit = true
  await openDetailedDocument(page)
  await page.locator('[data-row-key^="exit:"]').first().getByRole('button').click()
  const field = page.locator('[data-row-key^="exit:"] input').first()
  await field.fill('손절 없애줘'); await field.press('Enter')
  const previous = doc(page).getByRole('region', { name: nativeRowText('ko', 'previous'), exact: true })
  await expect(previous).toBeVisible()
  await expect(previous).toContainText('손절 없애줘')
  await expect(previous.getByRole('status')).toContainText(nativeRowText('ko', 'applied'))
  expect(controls.posts).toHaveLength(1)
})

test('전송 대기 중 행 닫기는 트리거 초점을 보존하고 중복 전송하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  let release!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v3/conversations/*/messages', async route => { await waiting; await route.fallback() })
  await openDetailedDocument(page)
  const trigger = doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true })
  await trigger.click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('3배로'); await field.press('Enter')
  await expect(field).toHaveAttribute('readonly')
  await field.press('Escape')
  await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute('aria-disabled', 'true')
  release()
  await expect(trigger).toHaveAttribute('aria-disabled', 'false')
  await expect(doc(page)).toHaveAttribute('data-draft-revision', '3')
  expect(controls.posts).toHaveLength(1)
})

test('조합 종료 직후 keyCode229 Enter는 기본 제출을 막는다', async ({ page }) => {
  const controls = await setup(page)
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const field = doc(page).getByRole('textbox', { name: '레버리지 코멘트', exact: true })
  await field.fill('삼 배로')
  await field.dispatchEvent('compositionend')
  expect(await field.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })))).toBe(false)
  expect(controls.posts).toEqual([])
  await expect(field).toHaveValue('삼 배로')
})

for (const width of [320, 1440]) test(`${width}px 행 입력은 7언어·200% 글자에서도 겹침 없이 원문과 초점을 유지한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  const controls = await setup(page)
  await openDetailedDocument(page)
  await doc(page).getByRole('button', { name: '레버리지 수정 요청', exact: true }).click()
  const form = page.locator('[data-row-key="leverage"] .native-row-form')
  const field = form.locator('input')
  await field.fill('아직 보내지 않은 원문 $&')
  const node = await field.elementHandle()
  await page.addStyleTag({ content: '.native-row-form {font-size:26px!important} .native-row-form :is(input,button,p){font-size:inherit!important}' })
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(field).toHaveAttribute('placeholder', nativeRowText(language, 'placeholder'))
    await expect(field).toHaveValue('아직 보내지 않은 원문 $&')
    await expect(field).toBeFocused()
    expect(await field.evaluate((element, original) => element === original, node)).toBe(true)
    const rects = await form.locator('input,button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom } }))
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j]; expect(a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await field.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath(`row-${width}.png`), animations: 'disabled' })
  expect(controls.posts).toEqual([])
})

test('전략 문서 언어 변경은 문서 제목과 원본 JSON·입력·동일 DOM을 보존한다', async ({ page }) => {
  const controls = await setup(page)
  const composer = page.locator('.g-composer textarea')
  await composer.fill('아직 보내지 않은 원문')
  await openDetailedDocument(page)
  const article = page.locator('.native-strategy-document')
  await article.locator('.native-strategy-source > summary').click()
  await article.locator('.native-strategy-binding > summary').click()
  const source = article.locator('pre'), original = await article.elementHandle()
  await source.focus()
  const requests = [...controls.requests]
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'en') })
  await expect(article.locator('h2')).toHaveText('Strategy draft')
  await expect(source).toHaveText(JSON.stringify(ready.draftState.projection, null, 2))
  await expect(source).toBeFocused()
  await expect(composer).toHaveValue('아직 보내지 않은 원문')
  expect(await article.evaluate((node, previous) => node === previous, original)).toBe(true)
  expect(controls.requests).toEqual(requests)
  expect(controls.posts).toEqual([])
})

test('7언어·통화 전환은 문서 행·열린 규칙·원문 선택과 서버 수치를 보존한다', async ({ page }, testInfo) => {
  const controls = await setup(page)
  const composer = page.locator('.g-composer textarea')
  await composer.fill('미전송 사용자 원문 $& {id}')
  await openDetailedDocument(page)
  const article = page.locator('.native-strategy-document')
  const details = article.locator('details')
  for (const detail of await details.all()) await detail.locator('summary').click()
  const source = article.locator('pre')
  await source.focus()
  const selected = await source.evaluate(node => {
    const text = node.firstChild!, range = document.createRange()
    range.setStart(text, 0); range.setEnd(text, 36)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
    return selection.toString()
  })
  const originalRows = await article.locator('dl > div').elementHandles()
  const originalSource = await source.elementHandle()
  const originalCodes = await article.locator('code').allTextContents()
  const requests = [...controls.requests]
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts', module = await import(/* @vite-ignore */ path)
      module.setClientPreference('language', language)
      module.setClientPreference('currency', language === 'ko' ? 'USD' : 'KRW')
    }, language)
    await expect(article.locator('h2')).toHaveText(nativeShellText(language, 'strategyDraft'))
    await expect(article).toHaveAttribute('aria-label', nativeStrategyText(language, 'article'))
    if (language !== 'ko') expect((await article.locator('dt').allTextContents()).join(' ')).not.toMatch(/[\uAC00-\uD7A3]/)
    await expect(article.getByText(nativeStrategyText(language, 'distanceNotice'), { exact: true })).toBeVisible()
    await expect(article.locator(':scope > dl > div').nth(3).locator('dd')).toHaveText('100 USDT')
    await expect(article.locator('.native-rule-value')).toHaveText(['2%', '5%'])
    await expect(source).toHaveText(JSON.stringify(ready.draftState.projection, null, 2))
    await expect(source).toBeFocused()
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selected)
    expect(await source.evaluate((node, original) => node === original, originalSource)).toBe(true)
    for (const [index, original] of originalRows.entries()) expect(await article.locator('dl > div').nth(index).evaluate((node, previous) => node === previous, original)).toBe(true)
    for (const detail of await details.all()) await expect(detail).toHaveAttribute('open', '')
    expect(await article.locator('code').allTextContents()).toEqual(originalCodes)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await expect(composer).toHaveValue('미전송 사용자 원문 $& {id}')
    expect(controls.requests).toEqual(requests)
    expect(controls.posts).toEqual([])
    if (language === 'fr') {
      await article.locator('h2').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath('strategy-document-fr.png') })
    }
  }
})
async function field(page: Page, label: string) {
  if (label.includes('revision') && await doc(page).locator('.native-strategy-binding:not([open])').count()) await doc(page).getByText('초안 식별 정보', { exact: true }).click()
  return doc(page).locator('dt').filter({ hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]')
}

test('native 서버 초안은 원본 문서 탭에서 같은 projection을 표시하고 읽기만으로 요청하지 않는다', async ({ page }) => {
  const controls = await setup(page), before = [...controls.requests]
  await input(page).fill('전송 전 보존할 입력')
  for (let i = 0; i < 2; i++) {
    await openDetailedDocument(page)
    await expect(doc(page)).toBeVisible()
    await expect(await field(page, '초안 revision')).toHaveText(ready.draftRevision)
    await expect(await field(page, '대화 revision')).toHaveText(ready.conversationStateRevision)
    await expect(await field(page, '레버리지')).toContainText('1')
    await expect(await field(page, '고정 주문 금액')).toContainText('100')
    await expect(doc(page)).toContainText('BTCUSDT')
    await expect(input(page)).toHaveValue('전송 전 보존할 입력')
    await doc(page).getByText('전체 조건과 시스템 위험 제한 보기', { exact: true }).click()
    await expect(doc(page).locator('pre')).toHaveText(JSON.stringify(ready.draftState.projection, null, 2))
    await backToConversation(page)
    await expect(doc(page)).toBeHidden()
    await expect(input(page)).toHaveValue('전송 전 보존할 입력')
  }
  await expect(page.getByText('Research Team', { exact: true })).toBeHidden()
  await page.waitForTimeout(100)
  expect(controls.requests).toEqual(before)
  expect(controls.posts).toEqual([])
})

test('문서의 요청도 같은 대화로 전송하고 변경된 서버 revision만 새 문서에 반영한다', async ({ page }) => {
  const controls = await setup(page)
  await openDetailedDocument(page)
  await input(page).fill('레버리지 3배')
  await input(page).press('Enter')
  await expect(page.locator('.native-research-workspace')).toBeVisible()
  await expect(page.locator('.native-research-thread[data-document-id="plan"] .g-umsg')).toHaveText('레버리지 3배')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toContainText('3배')
  await expect(input(page)).toHaveValue('')
  expect(controls.posts).toHaveLength(1)
  expect(controls.posts[0].path).toBe(`/api/v3/conversations/${ready.conversationId}/messages`)
  expect(JSON.stringify(controls.posts[0].body)).toContain('레버리지 3배')
  await backToConversation(page); await openDetailedDocument(page)
  await expect(await field(page, '초안 revision')).toHaveText('3')
  await expect(await field(page, '대화 revision')).toHaveText('5')
  await expect(await field(page, '레버리지')).toContainText('3')
  await doc(page).getByText('전체 조건과 시스템 위험 제한 보기', { exact: true }).click()
  await expect(doc(page).locator('pre')).toHaveText(JSON.stringify(changed.draftState.projection, null, 2))
})

test('영어 문서에서 보낸 한국어 수정은 원문 그대로 전송되고 새 서버 초안만 반영한다', async ({ page }) => {
  const controls = await setup(page)
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'en') })
  const tabs = page.locator('.g-tabs button'), composer = page.locator('.g-composer textarea')
  await openDetailedDocument(page)
  await composer.fill('레버리지 3배'); await composer.press('Enter')
  await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => controls.snapshot.draftRevision).toBe('3')
  await expect(composer).toHaveValue('')
  expect(controls.posts).toHaveLength(1)
  expect(controls.posts[0].path).toBe(`/api/v3/conversations/${ready.conversationId}/messages`)
  expect(JSON.stringify(controls.posts[0].body)).toContain('레버리지 3배')
  await openDetailedDocument(page)
  const article = page.locator('.native-strategy-document')
  await expect(article.locator('h2')).toHaveText('Strategy draft')
  await expect(article).toHaveAttribute('data-draft-revision', '3')
  await expect(article.locator(':scope > dl > div').nth(4).locator('dd')).toHaveText('3x')
  await article.locator('.native-strategy-source summary').click()
  await expect(article.locator('pre')).toHaveText(JSON.stringify(changed.draftState.projection, null, 2))
  const calls = [...controls.requests]
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'ko') })
  await expect(article.locator(':scope > dl > div').nth(4).locator('dd')).toHaveText('3배')
  expect(controls.requests).toEqual(calls)
  expect(controls.posts).toHaveLength(1)
})

test('서버에서 새 revision을 다시 읽어도 미전송 입력은 보존되고 문서는 최신 서버 값만 표시한다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill('보존할 미전송 질문')
  await openDetailedDocument(page); await backToConversation(page)
  controls.snapshot = structuredClone(changed)
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await openDetailedDocument(page)
  await expect(await field(page, '초안 revision')).toHaveText('3')
  await expect(await field(page, '레버리지')).toContainText('3')
  await expect(input(page)).toHaveValue('보존할 미전송 질문')
  expect(controls.posts).toEqual([])
})

test('새 전략을 명시 시작하면 이전 서버 초안과 문서 선택 상태가 홈으로 새어나오지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await openDetailedDocument(page)
  await input(page).fill('이전 대화의 질문')
  if (await page.getByRole('button', { name: '새 전략', exact: true }).isVisible()) await page.getByRole('button', { name: '새 전략', exact: true }).click()
  else { await revealSourceNavigation(page); await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '＋ 새 전략', exact: true }).click() }
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
  await expect(doc(page)).toHaveCount(0)
  await expect(docTab(page)).toHaveCount(0)
  await expect(page.locator('textarea').first()).toHaveValue('')
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBeNull()
  expect(controls.posts).toEqual([])
})

test('원본 연구 계획의 서버 검증과 명시 승인 체크는 문서 왕복만으로 실행되지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await openDetailedDocument(page)
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  expect(controls.posts).toHaveLength(2)
  const before = [...controls.requests]
  await expect(doc(page).getByRole('button', { name: /승인|백테스트|전략 검증/ })).toHaveCount(0)
  await backToConversation(page)
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await openDetailedDocument(page)
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  expect(controls.requests).toEqual(before)
  expect(controls.posts.some(post => post.path.endsWith('/approve'))).toBe(false)
})

for (const width of [320, 390, 844, 1440]) test(`${width}px 번역 문서의 라벨과 값은 겹치지 않고 원문 폭을 넘지 않는다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  const controls = await setup(page)
  // Keep the actual Vite module and its exported setter reachable during all locale changes.
  // Chromium can collect a pending dynamic-import promise between evaluate calls.
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const modulePromise = import(/* @vite-ignore */ path)
    Reflect.set(window, 'nativeDocumentPreferenceModule', modulePromise)
    const module = await modulePromise
    Reflect.set(window, 'nativeDocumentSetPreference', module.setClientPreference)
  })
  await openDetailedDocument(page)
  const article = page.locator('.native-strategy-document')
  for (const detail of await article.locator('details').all()) await detail.locator('summary').click()
  const requests = [...controls.requests]
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(language => Reflect.get(window, 'nativeDocumentSetPreference')('language', language), language)
    await expect(article.locator('h2')).toHaveText(nativeShellText(language, 'strategyDraft'))
    await page.evaluate(() => document.fonts.ready)
    // Text assertions can pass before the inherited-language layout has painted.
    // Measure the displayed frame, keeping the same width/overlap requirements.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const geometry = await article.evaluate(node => ({
      language: document.documentElement.lang,
      overflow: node.scrollWidth - node.clientWidth,
      rows: Array.from(node.querySelectorAll('dl > div')).map(row => {
        const label = row.querySelector('dt')!, value = row.querySelector('dd')!, a = label.getBoundingClientRect(), b = value.getBoundingClientRect()
        return { labelWidth: a.width, horizontal: Math.min(a.right, b.right) - Math.max(a.left, b.left), vertical: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
          labelOverflow: label.scrollWidth - label.clientWidth, valueOverflow: value.scrollWidth - value.clientWidth }
      }),
    }))
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    for (const row of geometry.rows) {
      expect(Math.min(row.horizontal, row.vertical)).toBeLessThanOrEqual(0)
      expect(row.labelOverflow).toBeLessThanOrEqual(1)
      expect(row.valueOverflow).toBeLessThanOrEqual(1)
      if (width >= 844 && ['en', 'es', 'fr'].includes(language)) expect(row.labelWidth, JSON.stringify({ width, language, geometry })).toBeGreaterThan(120)
    }
    expect(controls.requests).toEqual(requests)
    if (language === 'fr') {
      await article.locator('h2').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`strategy-document-fr-${width}.png`) })
      await article.locator('.native-strategy-rules').nth(1).scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`strategy-conditions-fr-${width}.png`) })
    }
  }
})

for (const width of [320, 390, 844, 1440]) test(`${width}px 서버 전략 문서의 표·원문·컴포저를 읽고 같은 위치에서 대화로 복귀한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  await setup(page)
  await page.locator('.g-title').click()
  await page.locator('.g-title-input').fill('비트코인 장기 투자 조건을 함께 검토하는 현재 서버 전략 초안')
  await page.locator('.g-title-input').press('Enter')
  await openDetailedDocument(page)
  await doc(page).getByText('전체 조건과 시스템 위험 제한 보기', { exact: true }).click()
  await expect(doc(page).locator('pre')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const sizes = await doc(page).evaluate(node => ({ scroll: node.scrollWidth, width: node.clientWidth }))
  expect(sizes.scroll - sizes.width).toBeLessThanOrEqual(1)
  const header = await page.locator('.native-research-workspace .rw-header').evaluate(node => {
    const buttons = Array.from(node.querySelectorAll('button')).filter(button => button.getClientRects().length > 0)
    const bounds = buttons.map(button => {
      const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { label: button.getAttribute('aria-label') || button.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, clickable: !!hit && button.contains(hit) }
    })
    const title = node.querySelector('.rw-title')!, text = node.querySelector('.rw-heading [title]')!, tabs = node.querySelector('.rw-tabs')!
    return { bounds, minWidth: getComputedStyle(title).minWidth, ellipsis: getComputedStyle(text).textOverflow, scrollbar: getComputedStyle(tabs).scrollbarWidth,
      titleWidth: text.clientWidth, titleFullWidth: text.scrollWidth, tabsHeight: tabs.clientHeight, tabsContentHeight: tabs.scrollHeight }
  })
  expect(header.minWidth).toBe('0px')
  expect(header.ellipsis).toBe('ellipsis')
  // The restored source-shaped header has no decorative scrollbar. It still
  // scrolls horizontally; the keyboard/reachability checks below remain.
  expect(header.scrollbar).toBe('none')
  expect(header.tabsContentHeight).toBeLessThanOrEqual(header.tabsHeight)
  for (const [i, button] of header.bounds.entries()) {
    expect(button.clickable, JSON.stringify(button)).toBe(true)
    expect(button.left).toBeGreaterThanOrEqual(0)
    expect(button.right).toBeLessThanOrEqual(width)
    for (const other of header.bounds.slice(i + 1)) expect(Math.min(Math.min(button.right, other.right) - Math.max(button.left, other.left), Math.min(button.bottom, other.bottom) - Math.max(button.top, other.top)), `${button.label} / ${other.label}`).toBeLessThanOrEqual(0)
  }
  await testInfo.attach(`header-geometry-${width}.json`, { body: JSON.stringify(header, null, 2), contentType: 'application/json' })
  await page.evaluate(() => document.fonts.ready)
  await doc(page).getByRole('heading', { name: '전략 초안', exact: true }).scrollIntoViewIfNeeded()
  await expect(doc(page).getByRole('heading', { name: '전략 초안', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath(`native-document-${width}.png`), fullPage: true })
  await input(page).fill('문서에서 이어갈 질문')
  await backToConversation(page)
  await expect(input(page)).toHaveValue('문서에서 이어갈 질문')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
})
