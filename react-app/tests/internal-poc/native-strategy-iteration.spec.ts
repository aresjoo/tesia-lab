import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import { recoverNativeAfterJournalFailure } from './native-session-recovery-test-helpers'
import { openNativeAccountMenu as openObservedNativeAccountMenu } from './native-account-test-helpers'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import nativeFixture from './fixtures/native-service-contracts.json' with { type: 'json' }
import { nativeWorkflowText } from '../../src/internal-poc/native-workflow-copy'

test.use({ trace: 'off', video: 'off' })
async function openNativeAccountMenu(page: Page) {
  if (!await page.locator('.client-settings-page').isVisible()) await revealSourceNavigation(page)
  return openObservedNativeAccountMenu(page)
}

const ready = conversationFixture.snapshots.ready
const originalApproval = { ...conversationFixture.documents.find(item => item.name === 'approval')!.value,
  strategyVersionId: 'sv_v03_11111111111111111111111111111111' }
const queued = nativeFixture.sources[3].fixture.cases![0].response
const completedSchema = nativeFixture.sources[3].fixture.cases!.find(item => item.name === 'COMPLETED')!.response.data
const ownerId = 'session_iteration_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_iteration_fixture_0001', traceId: 'trace_iteration_fixture_0001', resourceRevision: revision })
const envelope = (data: unknown, revision = '4') => ({ meta: meta('0.3.0', revision), data })
const changed = { ...ready, conversationStateRevision: '5', conversationStateHash: 'a'.repeat(64), draftRevision: '3', projectionHash: 'b'.repeat(64), semanticHash: 'c'.repeat(64),
  draftState: { ...ready.draftState, revision: 3, projectionHash: 'b'.repeat(64), projection: { ...ready.draftState.projection, execution: { ...ready.draftState.projection.execution, leverage: 3 } } } }

async function setup(page: Page, withJob: boolean | 'completed' = false, detailState: 'ready' | 'error' = 'ready') {
  page.setDefaultTimeout(15_000)
  // Synthetic wire/SDK/UI integration only. These hashes and the patch response
  // do not certify a compiler, approval authority, source data or a real job.
  const controls = { snapshot: structuredClone(ready) as typeof ready, sessionId: ownerId, revision: '1', sessionEtag: '"iteration_session_etag_0001"',
    sessionAbsent: false, failDraft: false, failTurn: false, draftReads: 0, jobReads: 0, historyReads: 0,
    holdDraft: undefined as (() => Promise<void>) | undefined, holdJob: undefined as (() => Promise<void>) | undefined,
    posts: [] as { path: string; body: Record<string, unknown>; key: string | undefined; match: string | undefined }[],
    approvals: [structuredClone(originalApproval)] }
  const selectedJob = { ...(withJob === 'completed' ? completedSchema : queued.data), strategyVersionId: originalApproval.strategyVersionId, semanticHash: originalApproval.semanticHash }
  // Controller isolation only: the existing unissued COMPLETED schema example
  // is NOT relabelled into an issued report. Replace the result component at the
  // test transport boundary, never the SDK validator or a product code path.
  // Real report/chart rendering has separate native-fill-markers coverage.
  if (withJob === 'completed') await page.route('**/src/internal-poc/NativeServiceResult.tsx*', async route => {
    const source = await (await route.fetch()).text()
    const reactPath = source.match(/from "([^"\n]*\/react\.js\?[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('CONTROLLER_TEST_REACT_IMPORT_MISSING')
    return route.fulfill({ contentType: 'application/javascript', body: `
    import React from ${JSON.stringify(reactPath)};
    import { NativeAnalysisInlineSummary, NativeAnalysisReportPortal } from '/src/internal-poc/NativeAnalysisLayout.tsx';
    export function NativeServiceResult({ job, onStatusChange, onEditDraft, editDisabled }) {
      React.useEffect(() => { onStatusChange?.({ backtestId: job.backtestId, state: ${JSON.stringify(detailState)}, reportReady: true }); }, [job.backtestId]);
      const action = () => onEditDraft ? React.createElement('button', { type: 'button', 'data-controller-edit': true, 'aria-disabled': editDisabled, onClick: event => { if(editDisabled) return; event.currentTarget.focus(); onEditDraft(); } }, '조건을 직접 수정할게요') : null;
      return React.createElement(React.Fragment, null,
        React.createElement(NativeAnalysisInlineSummary, null, action),
        React.createElement(NativeAnalysisReportPortal, null, action),
        React.createElement('div', { 'data-controller-result-stub': job.backtestId }, 'Controller-only result stub, not a report'));
    }
  ` }) })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner: ownerId })
  await page.route('**/api/v1/auth/session', route => controls.sessionAbsent
    ? route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic absent session' } }) })
    : route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: controls.sessionEtag }, body: JSON.stringify({ meta: meta('0.1.0', controls.revision),
      data: { sessionId: controls.sessionId, state: 'AUTHENTICATED', revision: controls.revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null),
    data: { csrfToken: 'csrf_iteration_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'GET') {
      controls.draftReads++
      if (controls.holdDraft) await controls.holdDraft()
      if (controls.failDraft) return route.abort('failed')
    } else {
      controls.posts.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'], match: request.headers()['if-match'] })
      if (path.endsWith('/messages') && controls.failTurn) return route.abort('failed')
    }
    let data: unknown = controls.snapshot
    const isChanged = controls.snapshot.conversationStateRevision === '5'
    const binding = { conversationId: controls.snapshot.conversationId, conversationStateRevision: controls.snapshot.conversationStateRevision,
      conversationStateHash: controls.snapshot.conversationStateHash, draftId: controls.snapshot.draftId, draftRevision: controls.snapshot.draftRevision,
      projectionHash: controls.snapshot.projectionHash, semanticHash: controls.snapshot.semanticHash }
    const receiptId = isChanged ? 'validation_receipt_iteration_0002' : originalApproval.validationReceiptId
    const challengeId = isChanged ? 'approval_challenge_iteration_0002' : originalApproval.approvalChallengeId
    if (path.endsWith('/messages')) {
      controls.snapshot = structuredClone(changed)
      const sourceTurnId = 'turn_iteration_fixture_0002'
      data = { turnId: sourceTurnId, conversation: controls.snapshot,
        compilerTurnResult: { contractVersion: '0.1.0', status: 'PATCH_PROPOSED', source: { turnId: sourceTurnId, textSha256: 'd'.repeat(64), normalization: 'unicode_nfc_codepoint_v1' },
          draftPatch: { contractVersion: '0.1.0', baseDraftVersion: 2, atomic: true, patches: [{ op: 'set', target: { entity: 'execution', field: 'leverage' },
            precondition: { expectedValueHash: 'e'.repeat(64) }, value: 3, evidenceSpan: { text: '레버리지 3배', start: 0, end: 7, offsetUnit: 'unicode_code_point' }, reasonCode: 'user_correction' }] } },
        mergeResult: { contractVersion: '0.2.0', status: 'APPLIED', sourceTurnId, baseDraftRevision: 2, resultDraftRevision: 3,
          beforeProjectionHash: ready.projectionHash, afterProjectionHash: changed.projectionHash, appliedPatchCount: 1, draftState: changed.draftState, issues: [] } }
    } else if (path.endsWith('/validate')) data = { ...conversationFixture.documents.find(item => item.name === 'validation-receipt')!.value, ...binding, validationReceiptId: receiptId }
    else if (path.endsWith('/approval-challenges')) data = { ...conversationFixture.documents.find(item => item.name === 'approval-challenge')!.value, ...binding, validationReceiptId: receiptId, approvalChallengeId: challengeId }
    else if (path.endsWith('/approve')) {
      const issued = { ...originalApproval, strategyVersionId: isChanged ? 'sv_v03_22222222222222222222222222222222' : originalApproval.strategyVersionId,
        sourceConversationStateRevision: binding.conversationStateRevision, sourceConversationStateHash: binding.conversationStateHash,
        sourceDraftRevision: binding.draftRevision, sourceProjectionHash: binding.projectionHash, semanticHash: binding.semanticHash!, validationReceiptId: receiptId, approvalChallengeId: challengeId }
      if (!controls.approvals.some(item => item.strategyVersionId === issued.strategyVersionId)) controls.approvals.push(issued)
      data = issued
    }
    return route.fulfill({ status: path.endsWith('/approve') || path.endsWith('/approval-challenges') ? 201 : 200, contentType: 'application/json', headers: { ETag: `"iteration_conversation_etag_000${controls.snapshot.conversationStateRevision}"` },
      body: JSON.stringify(envelope(data, path.endsWith('/approve') ? '1' : controls.snapshot.conversationStateRevision)) })
  })
  await page.route('**/api/v8/**', route => {
    controls.historyReads++
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"iteration_history_etag_0005"', 'cache-control': 'no-store' }, body: JSON.stringify({
      meta: meta('0.8.0', '5'), data: { conversationId: ready.conversationId, snapshotRevision: '5', limit: 50,
        rows: controls.approvals.map(approval => ({ approval, job: withJob && approval.strategyVersionId === originalApproval.strategyVersionId
          ? selectedJob : null })) } }) })
  })
  await page.route('**/api/v7/**', async route => {
    controls.jobReads++
    if (route.request().method() !== 'GET') throw new Error('UNEXPECTED_JOB_MUTATION')
    if (controls.holdJob) await controls.holdJob()
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"iteration_job_etag_0001"', 'cache-control': 'no-store' }, body: JSON.stringify({ ...queued,
      meta: meta('0.7.0', selectedJob.revision), data: selectedJob }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: withJob ? '작업 보기' : '이 승인 버전 선택', exact: true }).click()
  await expect(page.getByRole('button', { name: '현재 초안 수정하기', exact: true })).toBeEnabled()
  return controls
}
const edit = (page: Page) => page.getByRole('button', { name: '현재 초안 수정하기', exact: true })
const showPane = async (page: Page, pane: '대화' | '차트·분석') => {
  const tabs = page.getByRole('tablist', { name: '대화와 결과 보기' })
  if (await tabs.isVisible()) await tabs.getByRole('tab', { name: pane, exact: true }).click()
}

for (const surface of ['summary', 'report'] as const) test(`controller 단위: ${surface} 조건 수정은 SDK 확인 후에만 대화로 복귀한다`, async ({ page }) => {
  const controls = await setup(page, 'completed')
  const input = page.locator('.g-composer textarea')
  await input.evaluate(node => Reflect.set(window, 'iterationEditInput', node))
  if (surface === 'report') await page.locator('.g-chead [data-report-document-control]').click()
  let release!: () => void
  controls.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  const reads = controls.draftReads
  await page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await expect.poll(() => controls.draftReads).toBe(reads + 1)
  await expect(input).toBeDisabled()
  await expect(page.locator('[data-controller-edit]:visible')).toBeDisabled()
  await page.locator('[data-controller-edit]:visible').evaluate((node: HTMLButtonElement) => node.click())
  expect(controls.draftReads).toBe(reads + 1)
  release()
  await expect(input).toBeEnabled()
  await expect(input).toBeFocused()
  await expect(page.locator('.g-tab').filter({ hasText: /^대화$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.native-retained-result-notice')).toHaveCount(1)
  await expect(page.locator('[data-controller-edit]')).toHaveCount(0)
  expect(await input.evaluate(node => node === Reflect.get(window, 'iterationEditInput'))).toBe(true)
  expect(controls.posts).toEqual([])
})

for (const boundary of ['session-id', 'absent', 'draft-failure'] as const) test(`controller 단위: 결과 CTA ${boundary} 실패는 편집 복귀 성공으로 처리하지 않는다`, async ({ page }) => {
  const controls = await setup(page, 'completed')
  await page.locator('.g-chead [data-report-document-control]').click()
  if (boundary === 'session-id') controls.sessionId = 'session_iteration_other_00002'
  if (boundary === 'absent') controls.sessionAbsent = true
  if (boundary === 'draft-failure') controls.failDraft = true
  await page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toBeDisabled()
  await expect(page.locator('.native-retained-result-notice')).toHaveCount(0)
  if (boundary === 'draft-failure') {
    await expect(page.getByRole('tablist', { name: '열린 연구 문서', exact: true }).getByRole('tab', { name: '백테스트 결과', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-controller-edit]:visible')).toBeFocused()
  }
  else await expect(page.locator('[data-controller-result-stub]')).toHaveCount(0)
  expect(controls.posts).toEqual([])
})

test('controller 단위: 차트 상세 오류여도 검증된 보고서를 보존하며 현재 조건을 수정한다', async ({ page }) => {
  const controls = await setup(page, 'completed', 'error')
  const action = page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true })
  await expect(action).toBeEnabled()
  await action.click()
  await expect(page.locator('.g-composer textarea')).toBeEnabled()
  await expect(page.locator('.g-composer textarea')).toBeFocused()
  await expect(page.locator('.native-retained-result-notice')).toHaveCount(1)
  await expect(page.locator('[data-controller-result-stub]')).toHaveCount(1)
  expect(controls.posts).toEqual([])
})

for (const interaction of ['pointer', 'assistive-click', 'click-only'] as const) test(`controller 단위: 결과 수정 대기 중 ${interaction}으로 다른 탭을 선택하면 늦은 성공이 포커스를 빼앗지 않는다`, async ({ page }) => {
  const controls = await setup(page, 'completed')
  await page.locator('.g-chead [data-report-document-control]').click()
  let release!: () => void
  controls.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  const reads = controls.draftReads
  await page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await expect.poll(() => controls.draftReads).toBe(reads + 1)
  const draftTab = page.getByRole('tablist', { name: '열린 연구 문서', exact: true }).getByRole('tab', { name: '연구 계획', exact: true })
  if (interaction === 'pointer') await draftTab.click()
  else if (interaction === 'click-only') await draftTab.evaluate((node: HTMLButtonElement) => node.click())
  else await draftTab.evaluate((node: HTMLButtonElement) => { node.focus(); node.click() })
  release()
  await expect(page.locator('.g-composer textarea')).toBeEnabled()
  await expect(draftTab).toHaveAttribute('aria-selected', 'true')
  if (interaction !== 'click-only') await expect(draftTab).toBeFocused()
  await expect(page.locator('.g-composer textarea')).not.toBeFocused()
  expect(controls.posts).toEqual([])
})

test('controller 단위: 수정 대기 중 문서를 스크롤해도 성공 후 대화로 복귀한다', async ({ page }) => {
  const controls = await setup(page, 'completed')
  await page.locator('.g-chead [data-report-document-control]').click()
  let release!: () => void
  controls.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  const reads = controls.draftReads
  await page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await expect.poll(() => controls.draftReads).toBe(reads + 1)
  const documentScroll = page.locator('.native-research-workspace .rw-scroll')
  await expect(documentScroll).toBeVisible()
  await documentScroll.dispatchEvent('pointerdown', { pointerType: 'touch' })
  await page.keyboard.press('PageDown')
  release()
  await expect(page.locator('.g-composer textarea')).toBeFocused()
  await expect(page.locator('.g-tab').filter({ hasText: /^대화$/ })).toHaveAttribute('aria-pressed', 'true')
  expect(controls.posts).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 7언어 수정 안내·이전 결과 구분은 같은 초안과 결과 DOM을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  const controls = await setup(page, 'completed')
  await showPane(page, '대화')
  await edit(page).click()
  const input = page.locator('.g-composer textarea')
  await input.fill('아직 전송하지 않은 수정 원문')
  const originalInput = await input.elementHandle()
  const result = page.locator('[data-controller-result-stub]'), originalResult = await result.elementHandle()
  const notice = page.locator('.native-workflow-notice[role="status"]')
  const posts = structuredClone(controls.posts)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const preferences = await import(/* @vite-ignore */ path)
      preferences.setClientPreference('language', language)
    }, language)
    await expect(notice).toHaveText(nativeWorkflowText(language, 'editingReady'))
    await expect(page.locator('.native-retained-result-notice')).toContainText(nativeWorkflowText(language, 'priorResult'))
    await expect(page.locator('.native-retained-result-notice span')).toHaveText(originalApproval.strategyVersionId)
    await expect(input).toHaveValue('아직 전송하지 않은 수정 원문')
    expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true)
    expect(await result.evaluate((node, original) => node === original, originalResult)).toBe(true)
    expect(controls.posts).toEqual(posts)
    expect(await notice.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  }
  await notice.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`editing-notice-fr-${width}.png`) })
  await originalInput?.dispose(); await originalResult?.dispose()
})

test('controller 단위: 완료 결과를 보존한 채 같은 대화에서 SDK turn으로 초안을 수정한다', async ({ page }, info) => {
  const controls = await setup(page, 'completed')
  await showPane(page, '차트·분석')
  await expect(page.locator('[data-controller-result-stub]')).toBeVisible()
  await page.locator('[data-controller-result-stub]').evaluate(node => Reflect.set(window, 'iterationResultNode', node))
  await showPane(page, '대화')
  await edit(page).click()
  await expect(page.locator('.g-composer textarea')).toBeEnabled()
  await page.locator('.g-composer textarea').fill('레버리지 3배')
  await page.locator('.g-composer textarea').press('Enter')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toContainText('3배')
  expect(controls.posts).toHaveLength(1)
  expect(controls.posts[0].path).toContain('/messages')
  expect(controls.posts[0].body.expectedConversationStateRevision).toBe('4')
  await showPane(page, '차트·분석')
  await expect(page.locator('.native-retained-result-notice')).toContainText('현재 초안이나 새 작업의 검증 결과가 아닙니다')
  await expect(page.locator('[data-controller-result-stub]')).toHaveAttribute('data-controller-result-stub', completedSchema.backtestId)
  expect(await page.evaluate(() => Reflect.get(window, 'iterationResultNode') === document.querySelector('[data-controller-result-stub]'))).toBe(true)
  expect(await page.locator('.g-composer textarea').count()).toBe(1)
  await page.screenshot({ path: info.outputPath('native-analysis-conversation.png') })
})

for (const boundary of ['session-id', 'absent', 'draft-failure'] as const) test(`결과 유지 편집의 ${boundary}는 다른 owner나 미확인 초안에 결과를 이관하지 않는다`, async ({ page }) => {
  const controls = await setup(page, 'completed')
  await showPane(page, '차트·분석')
  await expect(page.locator('[data-controller-result-stub]')).toBeVisible()
  await showPane(page, '대화')
  if (boundary === 'session-id') controls.sessionId = 'session_iteration_different_0002'
  if (boundary === 'absent') controls.sessionAbsent = true
  if (boundary === 'draft-failure') controls.failDraft = true
  await edit(page).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('.native-retained-result-notice')).toHaveCount(0)
  if (boundary !== 'draft-failure') await expect(page.locator('[data-controller-result-stub]')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toBeDisabled()
  expect(controls.posts).toHaveLength(0)
})

for (const action of ['new-conversation', 'new-owner', 'logout'] as const) test(`controller 단위: 보존된 결과도 ${action} 경계에서 제거한다`, async ({ page }) => {
  const controls = await setup(page, 'completed')
  await edit(page).click()
  await showPane(page, '차트·분석')
  await expect(page.locator('.native-retained-result-notice')).toBeVisible()
  await showPane(page, '대화')
  if (action === 'new-owner') {
    controls.sessionId = 'session_iteration_new_owner_0002'
    await recoverNativeAfterJournalFailure(page)
    await expect(page.getByRole('alert')).toContainText('세션이 변경되어')
  } else if (action === 'logout') {
    await page.route('**/api/v1/auth/logout', route => route.abort('failed'))
    await (await openNativeAccountMenu(page)).click()
    await expect(page.getByRole('heading', { name: '로그아웃 요청 확인', exact: true })).toBeVisible()
  } else {
    if (await page.getByRole('button', { name: '새 전략', exact: true }).isVisible()) await page.getByRole('button', { name: '새 전략', exact: true }).click()
    else { await revealSourceNavigation(page); await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '＋ 새 전략', exact: true }).click() }
    await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  }
  await expect(page.locator('[data-controller-result-stub]')).toHaveCount(0)
  await expect(page.locator('.native-retained-result-notice')).toHaveCount(0)
  expect(controls.posts).toHaveLength(0)
})

test('기존 승인→명시 현재초안 편집→사용자 turn→재검증→새승인, 이전 이력은 불변이다', async ({ page }) => {
  const controls = await setup(page)
  const old = JSON.stringify(controls.approvals[0])
  await expect(page.locator('textarea').first()).toBeDisabled()
  await edit(page).click()
  await expect(page.locator('textarea').first()).toBeEnabled()
  await expect(page.getByText(/현재 서버 초안을 수정할 수 있습니다/)).toBeVisible()
  await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
  expect(controls.posts).toHaveLength(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
  await page.locator('textarea').first().fill('레버리지 3배')
  await page.locator('textarea').first().press('Enter')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toContainText('3배')
  await expect(page.getByText('변경 항목: execution', { exact: true })).toBeVisible()
  expect(controls.posts[0].body.expectedConversationStateRevision).toBe('4')
  expect(controls.posts[0].match).toBe('"iteration_conversation_etag_0004"')
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  expect(controls.posts).toHaveLength(3)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '이 전략 버전 승인', exact: true }).click()
  await expect(page.getByText('승인 버전: sv_v03_22222222222222222222222222222222', { exact: true })).toBeVisible()
  await expect(page.getByText(/현재 서버 초안을 수정할 수 있습니다/)).toHaveCount(0)
  await expect(page.locator('textarea').first()).toBeDisabled()
  expect(controls.posts.slice(1).every(item => item.body.expectedConversationStateRevision === '5')).toBe(true)
  expect(controls.posts.at(-1)!.body.acknowledgedSemanticHash).toBe(changed.semanticHash)
  expect(JSON.stringify(controls.approvals[0])).toBe(old)
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect(page.getByRole('region', { name: '실행 이력', exact: true })).toContainText(originalApproval.strategyVersionId)
  await expect(page.getByRole('region', { name: '실행 이력', exact: true })).toContainText('sv_v03_22222222222222222222222222222222')
  await expect(page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).first()).toBeDisabled()
  expect(controls.posts).toHaveLength(4)
  // The freshly issued local approval (not only history selection) can enter
  // another explicit edit cycle without issuing any additional mutation.
  await edit(page).click()
  await expect(page.locator('textarea').first()).toBeEnabled()
  expect(controls.posts).toHaveLength(4)
})

for (const change of ['session-id', 'session-revision', 'session-etag', 'absent'] as const) test(`편집 전 ${change} 교체는 다른 owner 초안을 열지 않는다`, async ({ page }) => {
  const controls = await setup(page)
  if (change === 'session-id') controls.sessionId = 'session_iteration_changed_0002'
  if (change === 'session-revision') controls.revision = '2'
  if (change === 'session-etag') controls.sessionEtag = '"iteration_session_etag_0002"'
  if (change === 'absent') controls.sessionAbsent = true
  await edit(page).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('textarea').first()).toBeDisabled()
  expect(controls.posts).toHaveLength(0)
})

test('fresh 초안 조회 실패는 승인 보기 유지·명시 재시도만 허용한다', async ({ page }) => {
  const controls = await setup(page)
  controls.failDraft = true
  await edit(page).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(`승인 버전: ${originalApproval.strategyVersionId}`, { exact: true })).toBeVisible()
  await expect(page.locator('textarea').first()).toBeDisabled()
  controls.failDraft = false
  await edit(page).click()
  await expect(page.locator('textarea').first()).toBeEnabled()
  expect(controls.posts).toHaveLength(0)
})

test('편집은 옛 승인과 다른 최신 서버 초안을 읽되 옛 결과로 표시하지 않는다', async ({ page }) => {
  const controls = await setup(page, true)
  controls.snapshot = structuredClone(changed)
  await edit(page).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toContainText('3배')
  await expect(page.locator('textarea').first()).toBeEnabled()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '백테스트 결과', exact: true })).toHaveCount(0)
  expect(controls.posts).toHaveLength(0)
})

test('편집 전송 뒤 owner 변경 및 이중 클릭은 늦은 조회를 편집 성공으로 승격하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  let release: () => void = () => undefined
  controls.holdDraft = () => new Promise<void>(resolve => { release = resolve })
  const before = controls.draftReads
  await edit(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect.poll(() => controls.draftReads).toBe(before + 1)
  await expect(edit(page)).toBeDisabled()
  controls.sessionId = 'session_iteration_late_owner_0002'
  release()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('textarea').first()).toBeDisabled()
  expect(controls.posts).toHaveLength(0)
})

test('실행 중 job 편집 이탈 후 늦은 poll은 옛 작업·결과를 다시 표시하지 않는다', async ({ page }) => {
  const controls = await setup(page, true)
  let release: () => void = () => undefined
  controls.holdJob = () => new Promise<void>(resolve => { release = resolve })
  await expect.poll(() => controls.jobReads).toBeGreaterThan(0)
  await edit(page).click()
  await expect(page.locator('textarea').first()).toBeEnabled()
  await expect(page.getByText(/실행 중인 서버 작업은 계속됩니다/)).toBeVisible()
  release()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect(page.getByRole('region', { name: '실행 이력', exact: true }).getByText('백테스트 대기 중', { exact: true })).toBeVisible()
  await expect(page.locator('textarea').first()).toBeEnabled()
  expect(controls.posts).toHaveLength(0)
})

test('편집 후 turn 응답 유실은 reload에서 원 key로 재개하고 자동 승인하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await edit(page).click()
  controls.failTurn = true
  await page.locator('textarea').first().fill('레버리지 3배')
  await page.locator('textarea').first().press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()
  const key = controls.posts[0].key
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toBeNull()
  await page.reload()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  expect(controls.posts).toHaveLength(1)
  controls.failTurn = false
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toContainText('3배')
  expect(controls.posts.map(item => item.key)).toEqual([key, key])
  expect(controls.posts.every(item => item.path.endsWith('/messages'))).toBe(true)
  await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
})

test('미확정 submit은 편집을 잠그고 원 journal bytes를 보존한다', async ({ page }) => {
  const controls = await setup(page)
  let submits = 0
  await page.route('**/api/v7/backtests', route => { submits++; return route.abort('failed') })
  await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toBeNull()
  await expect(edit(page)).toBeDisabled()
  await edit(page).evaluate(button => (button as HTMLButtonElement).click())
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(journal)
  expect(controls.posts).toHaveLength(0)
  expect(submits).toBe(1)
})

test('미확정 logout은 편집 진입을 숨기고 logout journal을 유지한다', async ({ page }) => {
  const controls = await setup(page)
  await page.route('**/api/v1/auth/logout', route => route.abort('failed'))
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('heading', { name: '로그아웃 요청 확인', exact: true })).toBeVisible()
  await expect(edit(page)).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))).not.toBeNull()
  expect(controls.posts).toHaveLength(0)
})

test('다른 draft graft는 현재 대화의 편집 권위로 사용하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  controls.snapshot = { ...ready, draftId: 'draft_iteration_graft_0002', draftState: { ...ready.draftState, draftId: 'draft_iteration_graft_0002' } }
  await edit(page).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('textarea').first()).toBeDisabled()
  expect(controls.posts).toHaveLength(0)
})
