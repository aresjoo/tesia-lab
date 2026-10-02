import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { nativeObservationCopy } from '../../src/internal-poc/native-observation-copy'
import type { ClientLanguage } from '../../src/client-preferences'

// Approved wire fixture shapes exercise the real native controller and SDK.
// No compiler/model, live backend, market data or execution is being certified.
test.use({ trace: 'off', video: 'off' })
test.setTimeout(30_000)
const ready = fixture.snapshots.ready
const changed = { ...ready, conversationStateRevision: '5', conversationStateHash: 'a'.repeat(64), draftRevision: '3', projectionHash: 'b'.repeat(64), semanticHash: 'c'.repeat(64),
  draftState: { ...ready.draftState, revision: 3, projectionHash: 'b'.repeat(64), projection: { ...ready.draftState.projection, execution: { ...ready.draftState.projection.execution, leverage: 3 } } } }
const ownerId = 'session_observation_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_observation_fixture_0001', traceId: 'trace_observation_fixture_0001', resourceRevision: revision })
const source = { turnId: 'turn_observation_fixture_0002', textSha256: 'd'.repeat(64), normalization: 'unicode_nfc_codepoint_v1' }
const patch = { contractVersion: '0.1.0', status: 'PATCH_PROPOSED', source,
  draftPatch: { contractVersion: '0.1.0', baseDraftVersion: 2, atomic: true, patches: [{ op: 'set', target: { entity: 'execution', field: 'leverage' },
    precondition: { expectedValueHash: 'e'.repeat(64) }, value: 3, evidenceSpan: { text: '레버리지 3배', start: 0, end: 7, offsetUnit: 'unicode_code_point' }, reasonCode: 'user_correction' }] } }
const applied = { turnId: source.turnId, conversation: changed, compilerTurnResult: patch,
  mergeResult: { contractVersion: '0.2.0', status: 'APPLIED', sourceTurnId: source.turnId, baseDraftRevision: 2, resultDraftRevision: 3,
    beforeProjectionHash: ready.projectionHash, afterProjectionHash: changed.projectionHash, appliedPatchCount: 1, draftState: changed.draftState, issues: [] } }
type Mode = 'applied' | 'rejected' | 'proposed' | 'clarification' | 'unsupported'
function turnFor(mode: Mode) {
  if (mode === 'applied') return structuredClone(applied)
  if (mode === 'unsupported') return structuredClone(fixture.documents.find(item => item.name === 'turn')!.value)
  if (mode === 'clarification') {
    const question = { questionId: 'q_observation_position', targetField: 'position_sizing', reasonCode: 'AMBIGUOUS_NOTIONAL_OR_MARGIN', prompt: '100 USDT는 주문 금액인가요, 증거금인가요?', options: ['주문 금액', '증거금'] }
    return { turnId: source.turnId, conversation: { ...ready, candidateState: 'INCOMPLETE', semanticHash: null, nextQuestion: question }, compilerTurnResult: { contractVersion: '0.1.0', status: 'CLARIFICATION_REQUIRED', source, question }, mergeResult: null }
  }
  return { ...applied, conversation: ready, mergeResult: mode === 'proposed' ? null : { ...applied.mergeResult, status: 'REJECTED', resultDraftRevision: 2,
    afterProjectionHash: ready.projectionHash, appliedPatchCount: 0, draftState: ready.draftState, issues: [{ code: 'PRECONDITION_FAILED', instancePath: '/execution/leverage', patchIndex: 0 }] } }
}
async function setup(page: Page, mode: Mode = 'applied') {
  const state = { owner: ownerId, mode, snapshot: structuredClone(ready), failTurn: false, invalid: false, holdTurn: undefined as (() => Promise<void>) | undefined,
    posts: [] as { path: string; body: Record<string, unknown>; key?: string; match?: string }[], reads: 0 }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    if (sessionStorage.getItem('observation-fixture-initialized')) return
    sessionStorage.setItem('observation-fixture-initialized', '1')
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner: ownerId })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"observation_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
    data: { sessionId: state.owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null),
    data: { csrfToken: 'csrf_observation_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'GET') state.reads++
    else state.posts.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'], match: request.headers()['if-match'] })
    let data: unknown = state.snapshot
    if (path.endsWith('/messages')) {
      if (state.holdTurn) await state.holdTurn()
      if (state.failTurn) return route.abort('failed')
      const turn = turnFor(state.mode)
      state.snapshot = structuredClone(turn.conversation) as typeof ready
      data = turn
    } else if (path.endsWith('/validate')) {
      const binding = Object.fromEntries(['conversationId', 'conversationStateRevision', 'conversationStateHash', 'draftId', 'draftRevision', 'projectionHash'].map(key => [key, state.snapshot[key as keyof typeof ready]]))
      data = state.invalid ? { ...binding, status: 'INVALID', issues: [{ code: 'RISK_POLICY_CONFLICT', path: '/execution/leverage' }] }
        : { ...fixture.documents.find(item => item.name === 'validation-receipt')!.value, ...binding, semanticHash: state.snapshot.semanticHash }
    } else if (path.endsWith('/approval-challenges')) data = fixture.documents.find(item => item.name === 'approval-challenge')!.value
    else if (request.method() !== 'GET') return route.abort('failed')
    return route.fulfill({ status: path.endsWith('/approval-challenges') ? 201 : 200, contentType: 'application/json', headers: { ETag: `"observation_conversation_etag_000${state.snapshot.conversationStateRevision}"` },
      body: JSON.stringify({ meta: meta('0.3.0', state.snapshot.conversationStateRevision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return state
}
// A pending operation uses the same visual shell, but is not a completed
// observation. Wait for the terminal class instead of racing the busy shell.
const works = (page: Page) => page.locator('.g-act2.fin[data-source="service"]')
async function changeLanguage(page: Page, language: string) {
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */ path)
    preferences.setClientPreference('language', language)
  }, language)
}

test('실제 controller의 확인된 대화 관측이 연구 문서로 이어지고 돌아와도 초안·요청 수를 보존한다', async ({ page }) => {
  const state = await setup(page)
  await send(page)
  await expect(works(page)).toHaveCount(1)
  await page.locator('.g-composer textarea').fill('문서를 검토한 뒤 추가할 질문')
  const posts = state.posts.length, reads = state.reads
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  const workspace = page.locator('.native-research-workspace')
  await expect(workspace).toBeVisible()
  await expect(workspace).toHaveAttribute('data-research-status', 'unavailable')
  await expect(workspace.locator('.rw-artifact')).toHaveCount(14)
  await expect(page.locator('.native-research-composer-host textarea')).toHaveValue('문서를 검토한 뒤 추가할 질문')
  await workspace.getByRole('tab', { name: '연구 과정', exact: true }).click()
  const log = workspace.locator('.g-research-log')
  await expect(log.locator('.g-act-row')).toHaveCount(2)
  await expect(log).toContainText('레버리지 3배')
  await expect(log.locator('time')).toHaveCount(0)
  await expect(log.locator('[data-agent="Strategy Critic"]')).toHaveCount(0)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue('문서를 검토한 뒤 추가할 질문')
  await expect(works(page)).toHaveCount(1)
  expect(state.posts).toHaveLength(posts); expect(state.reads).toBe(reads)
})

test('연구 문서에서 실제 검증·승인 확인을 진행하고 동의 상태를 대화 왕복에도 유지한다', async ({ page }) => {
  const state = await setup(page)
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  const workspace = page.locator('.native-research-workspace')
  await workspace.getByRole('button', { name: '전략 검증', exact: true }).click()
  await workspace.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
  const consent = workspace.getByRole('checkbox')
  await expect(consent).not.toBeChecked()
  await consent.check()
  await page.evaluate(() => Reflect.set(window, 'savedApprovalControl', document.querySelector('.native-workflow-consent input')))
  await workspace.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  await expect(workspace.getByRole('checkbox')).toBeChecked()
  expect(await page.evaluate(() => Reflect.get(window, 'savedApprovalControl') === document.querySelector('.native-workflow-consent input'))).toBe(true)
  expect(state.posts).toHaveLength(2)
  expect(state.posts.some(post => post.path.endsWith('/approve'))).toBe(false)
})

test('연구 문서 안의 행 수정 응답 유실도 같은 화면에서 동일 요청을 재개할 수 있다', async ({ page }) => {
  const state = await setup(page)
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  const workspace = page.locator('.native-research-workspace')
  const row = workspace.locator('.native-row-comment').first()
  await row.locator('.native-row-trigger').click()
  await row.locator('input').fill('레버리지 3배')
  state.failTurn = true
  await row.locator('button[type="submit"]').click()
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(workspace.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  state.failTurn = false
  await workspace.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect.poll(() => state.posts.length).toBe(2)
  expect(state.posts[1].key).toBe(state.posts[0].key)
  expect(state.posts[1].body).toEqual(state.posts[0].body)
})

test('언어 변경은 기존 관측의 문구만 바꾸고 펼침·초점·입력·원문·요청 수를 보존한다', async ({ page }) => {
  const state = await setup(page)
  await send(page); await expect(works(page)).toHaveCount(1)
  const record = await expand(page)
  const composer = page.locator('.g-composer textarea')
  await composer.fill('아직 전송하지 않은 조건')
  await record.locator('button.hd').focus()
  const posts = state.posts.length, reads = state.reads
  await changeLanguage(page, 'en')
  await expect(record.locator('button.hd')).toContainText('Strategy draft update confirmed')
  await expect(record.locator('button.hd')).toHaveAttribute('aria-expanded', 'true')
  await expect(record.locator('button.hd')).toBeFocused()
  await expect(record.locator('button.arh').first()).toHaveAttribute('aria-expanded', 'true')
  await expect(record).toContainText('레버리지 3배')
  await expect(record).toContainText('user_correction')
  await expect(record).toContainText('Conversation revision 5 · Draft revision 3')
  await expect(composer).toHaveValue('아직 전송하지 않은 조건')
  await expect(works(page)).toHaveCount(1)
  expect(state.posts).toHaveLength(posts); expect(state.reads).toBe(reads)
  await changeLanguage(page, 'ko')
  await expect(record.locator('button.hd')).toContainText('전략 초안 반영 확인')
  await expect(record.locator('button.hd')).toHaveAttribute('aria-expanded', 'true')
})

test('검증 안내와 복사 문구도 현재 언어를 따르며 receipt와 승인 상태는 그대로다', async ({ page }) => {
  const state = await setup(page)
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await expect(works(page)).toHaveCount(1)
  const record = await expand(page)
  const posts = state.posts.length, reads = state.reads
  await changeLanguage(page, 'en')
  await expect(record.locator('button.hd')).toContainText('Strategy validation complete')
  await expect(record).toContainText('Server draft validation passed')
  await expect(page.locator('.g-amsg[data-source="service"]').last()).toContainText('does not mean user approval or completed execution')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Object.assign(window, { copiedAnswer: text }) } } }))
  await page.locator('.client-answer-actions button').nth(2).click()
  expect(await page.evaluate(() => Reflect.get(window, 'copiedAnswer'))).toContain('does not mean user approval or completed execution')
  expect(state.posts).toHaveLength(posts); expect(state.reads).toBe(reads)
  await expect(record.locator('.els')).toHaveCount(0)
})

for (const mode of ['applied', 'rejected', 'clarification', 'unsupported'] as const) test(`${mode}: 7언어 왕복은 원문과 동일 작업 DOM·요청 수를 보존한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 320 : 1440, height: 900 })
  const state = await setup(page, mode)
  await send(page); await expect(works(page)).toHaveCount(1)
  const record = await expand(page)
  await record.evaluate(element => element.setAttribute('data-preserved-observation', 'yes'))
  const summary = mode !== 'applied' && mode !== 'rejected' ? await record.locator('.cot2').textContent() : null
  const posts = state.posts.length, reads = state.reads
  const label = mode === 'applied' ? 'appliedLabel' : mode === 'rejected' ? 'rejectedLabel' : mode === 'clarification' ? 'questionLabel' : 'unsupportedLabel'
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as ClientLanguage[]) {
    await changeLanguage(page, language)
    await expect(record.locator('button.hd')).toContainText(nativeObservationCopy[language][label])
    await expect(record).toHaveAttribute('data-preserved-observation', 'yes')
    await expect(record.locator('button.hd')).toHaveAttribute('aria-expanded', 'true')
    if (summary !== null) expect(await record.locator('.cot2').textContent()).toBe(summary)
    else await expect(record).toContainText('레버리지 3배')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    expect(await record.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    if (language === 'fr') await page.screenshot({ path: testInfo.outputPath(`observation-${mode}-fr.png`), fullPage: true })
  }
  expect(state.posts).toHaveLength(posts); expect(state.reads).toBe(reads)
})

test('응답 대기 중 언어 변경은 재전송하지 않고 수신 시 현재 언어로 관측한다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  state.holdTurn = () => held
  await send(page)
  await expect.poll(() => state.posts.length).toBe(1)
  await changeLanguage(page, 'fr')
  release()
  await expect(works(page)).toHaveCount(1)
  await expect(works(page).locator('button.hd')).toContainText(nativeObservationCopy.fr.appliedLabel)
  await expect(page.locator('.g-amsg[data-source="service"]').last()).toHaveText(nativeObservationCopy.fr.readyReply)
  expect(state.posts).toHaveLength(1)
})

test('같은 답변의 표시 언어 변경은 작성 중 의견을 지우지 않는다', async ({ page }) => {
  const state = await setup(page)
  await send(page); await expect(works(page)).toHaveCount(1)
  await page.locator('.client-answer-actions button').nth(1).click()
  await page.getByRole('button', { name: '기타', exact: true }).click()
  const opinion = page.locator('.client-answer-feedback textarea')
  await opinion.fill('작성 중 의견을 보존해주세요')
  await changeLanguage(page, 'fr')
  await expect(opinion).toHaveValue('작성 중 의견을 보존해주세요')
  await expect(opinion).toBeFocused()
  expect(state.posts).toHaveLength(1)
})
async function send(page: Page) { const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true }); await input.fill('레버리지 3배'); await input.press('Enter') }
async function expand(page: Page, index = 0) {
  const record = works(page).nth(index)
  await expect(record.locator('button.hd')).toHaveAttribute('aria-expanded', 'false')
  await record.locator('button.hd').click()
  for (const button of await record.locator('button.arh').all()) await button.click()
  return record
}

test('실제 SDK 답변 복사와 원본 의견 카드는 전략 요청·승인·저장을 생성하지 않는다', async ({ page }) => {
  const state = await setup(page)
  await expect(page.locator('.client-answer-actions')).toHaveCount(0)
  await send(page); await expect(works(page)).toHaveCount(1)
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{ configurable:true,value:{writeText:async(text:string)=>{ Object.assign(window,{copiedAnswer:text}) }} }))
  await page.getByRole('button',{name:'답변 복사',exact:true}).click()
  expect(await page.evaluate(()=>Reflect.get(window,'copiedAnswer'))).toBe('전략 조건을 정리했습니다. 초안과 변경 항목을 확인한 뒤 검증할 수 있습니다.')
  const posts=state.posts.length
  await page.locator('.client-answer-actions button').nth(1).click()
  await page.getByRole('button',{name:'사실과 다름',exact:true}).click()
  await expect(page.locator('.client-answer-feedback')).toContainText('서버로 보내거나 저장하지 않습니다')
  expect(state.posts).toHaveLength(posts)
  state.owner='session_observation_other_0001'
  await page.getByRole('button',{name:'세션 다시 확인',exact:true}).click()
  await expect(page.locator('.client-answer-feedback')).toHaveCount(0)
  await expect(page.locator('.client-answer-actions')).toHaveCount(0)
})

test('서버 APPLIED 관측만 접힌 작업 기록으로 표시하고 원문 답변·revision·변경 경로를 보존한다', async ({ page }) => {
  const state = await setup(page)
  await expect(works(page)).toHaveCount(0)
  await send(page)
  await expect(works(page)).toHaveCount(1)
  await expect(page.locator('.g-amsg[data-source="service"]').last()).toHaveText('전략 조건을 정리했습니다. 초안과 변경 항목을 확인한 뒤 검증할 수 있습니다.')
  const reads = state.reads, posts = state.posts.length
  const record = await expand(page)
  await expect(record).toContainText('초안 반영 1개 확인')
  await expect(record).toContainText('초안 revision 2 → 3')
  await expect(record).toContainText('대화 revision 5 · 초안 revision 3')
  await expect(record).toContainText('execution')
  await expect(record).toContainText('leverage')
  await expect(record.locator('.els')).toHaveCount(0)
  expect(state.reads).toBe(reads); expect(state.posts).toHaveLength(posts)
  expect(state.posts[0].body.expectedConversationStateRevision).toBe('4')
  expect(state.posts[0].match).toBe('"observation_conversation_etag_0004"')
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
})

for (const mode of ['rejected', 'clarification', 'unsupported'] as const) test(`${mode} 서버 관측은 적용 완료를 꾸미지 않고 실제 결과·후속 질문을 유지한다`, async ({ page }) => {
  const state = await setup(page, mode)
  await send(page)
  await expect(works(page)).toHaveCount(1)
  const record = await expand(page)
  await expect(record.locator('.els')).toHaveCount(0)
  if (mode === 'rejected') { await expect(record).toContainText('PRECONDITION_FAILED'); await expect(record).toContainText('/execution/leverage'); await expect(record).toContainText('초안 반영 거절'); await expect(record).toContainText('서버 보고 적용 수: 0개') }
  if (mode === 'clarification') {
    const question = page.getByRole('region', { name: '100 USDT는 주문 금액인가요, 증거금인가요?', exact: true })
    await expect(question).toHaveCount(1); await expect(question).toBeVisible()
    await expect(question.getByRole('button', { name: '주문 금액', exact: true })).toBeEnabled()
  }
  if (mode === 'unsupported') {
    await expect(record).toContainText('OUT_OF_SCOPE_CAPABILITY')
    const question = page.getByRole('region', { name: 'Remove or replace the unsupported capability.', exact: true })
    await expect(question).toHaveCount(1); await expect(question).toBeVisible()
  }
  if (mode !== 'unsupported') expect(state.snapshot.draftRevision).toBe('2')
  await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
  expect(state.posts).toHaveLength(1)
})

test('SDK 금지 조합 PATCH_PROPOSED·merge null은 정상 작업 기록으로 승격하지 않는다', async ({ page }) => {
  const state = await setup(page, 'proposed')
  await send(page)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(works(page)).toHaveCount(0)
  expect(state.posts).toHaveLength(1)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).not.toBeNull()
})

test('검증 INVALID와 명시 재검증 VALID 기록을 둘 다 유지하되 승인 요청은 자동 실행하지 않는다', async ({ page }) => {
  const state = await setup(page)
  state.invalid = true
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await expect(works(page)).toHaveCount(1)
  const failure = await expand(page)
  await expect(failure.locator('button.hd')).toContainText('전략 검증 확인 필요')
  await expect(failure).toContainText('RISK_POLICY_CONFLICT')
  await expect(failure).toContainText('/execution/leverage')
  await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toHaveCount(0)
  state.invalid = false
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await expect(works(page)).toHaveCount(2)
  const valid = await expand(page, 1)
  await expect(valid.locator('button.hd')).toContainText('전략 검증 완료')
  await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toBeEnabled()
  expect(state.posts).toHaveLength(2)
  await expect(works(page).locator('.els')).toHaveCount(0)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as ClientLanguage[]) {
    await changeLanguage(page, language)
    await expect(failure.locator('button.hd')).toContainText(nativeObservationCopy[language].invalid)
    await expect(valid.locator('button.hd')).toContainText(nativeObservationCopy[language].valid)
    await expect(failure).toContainText('RISK_POLICY_CONFLICT')
    await expect(failure).toContainText('/execution/leverage')
    expect(state.posts).toHaveLength(2)
  }
  await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  expect(state.posts).toHaveLength(3)
  expect(state.posts.some(post => post.path.endsWith('/approve'))).toBe(false)
})

test('응답 유실 뒤 동일 요청 재개는 확인 전 완료 기록 0, 확인 후 기록 1이며 원 요청을 보존한다', async ({ page }) => {
  const state = await setup(page)
  state.failTurn = true
  await send(page)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(works(page)).toHaveCount(0)
  const first = state.posts[0], journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toBeNull()
  await page.reload()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  await expect(works(page)).toHaveCount(0)
  state.failTurn = false
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(works(page)).toHaveCount(1)
  expect(state.posts).toHaveLength(2)
  expect(state.posts[1]).toEqual(first)
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(works(page)).toHaveCount(0)
  expect(state.posts).toHaveLength(2)
})

test('계정 경계 뒤 도착한 이전 TURN은 새 계정의 작업 기록이나 답변으로 승격하지 않는다', async ({ page }) => {
  const state = await setup(page)
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  state.holdTurn = () => held
  await send(page)
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(works(page)).toHaveCount(0)
  state.owner = 'session_observation_other_0001'
  // In-flight run() serializes the recovery button. Reload establishes an
  // actual new-owner boundary instead of pretending the ignored click did so.
  await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  // The old locator is deliberately retained for a possible explicit claim,
  // not attached as the current strategy. Assert the visible boundary instead.
  await expect(page.getByRole('alert')).toContainText('세션이 변경되어 이전 요청과 승인 표시를 무효화했습니다.')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toHaveCount(0)
  release()
  await page.waitForTimeout(150)
  await expect(works(page)).toHaveCount(0)
  await expect(page.locator('.g-amsg[data-source="service"]')).toHaveCount(0)
  expect(state.posts).toHaveLength(1)
})

test('이전 VALID 기록은 새 초안 revision의 검증 권한으로 재사용되지 않는다', async ({ page }) => {
  const state = await setup(page)
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await expect(works(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toBeEnabled()
  await send(page)
  await expect(works(page)).toHaveCount(2)
  const historical = await expand(page)
  await expect(historical).toContainText('초안 revision 2')
  const current = await expand(page, 1)
  await expect(current).toContainText('초안 revision 2 → 3')
  await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전략 검증', exact: true })).toBeEnabled()
  expect(state.posts).toHaveLength(2)
  expect(state.posts.some(post => post.path.endsWith('/approve'))).toBe(false)
})

for (const boundary of ['reload', 'new', 'owner'] as const) test(`${boundary} 경계에서는 GET snapshot으로 과거 작업 기록을 합성하거나 다른 대화에 노출하지 않는다`, async ({ page }) => {
  const state = await setup(page)
  await send(page); await expect(works(page)).toHaveCount(1)
  if (boundary === 'reload') await page.reload()
  else if (boundary === 'owner') { state.owner = 'session_observation_other_0001'; await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click() }
  else {
    if (await page.getByRole('button', { name: '새 전략', exact: true }).isVisible()) await page.getByRole('button', { name: '새 전략', exact: true }).click()
    else { await revealSourceNavigation(page); await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '＋ 새 전략', exact: true }).click() }
    await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  }
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(works(page)).toHaveCount(0)
  expect(state.posts).toHaveLength(1)
})

for (const width of [320, 1440]) test(`${width}px 관측 기록의 열기·상세·접기와 키보드 포커스를 확인한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  await setup(page); await send(page); await expect(works(page)).toHaveCount(1)
  const record = await expand(page)
  await record.locator('button.hd').focus()
  await page.keyboard.press('Enter')
  await expect(record.locator('button.hd')).toHaveAttribute('aria-expanded', 'false')
  await expect(record.locator('button.hd')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(record.locator('button.hd')).toHaveAttribute('aria-expanded', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.evaluate(() => document.fonts.ready)
  await record.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath(`native-observation-${width}.png`), fullPage: true })
})
