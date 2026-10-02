import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import nativeFixture from './fixtures/native-service-contracts.json' with { type: 'json' }
import { nativeWorkflowCopy, nativeWorkflowText, nativeWorkflowLeverage } from '../../src/internal-poc/native-workflow-copy'
import { nativeStrategyCopy } from '../../src/internal-poc/native-strategy-copy'
import type { ClientLanguage } from '../../src/client-preferences'

// Real native controller + published SDK, controlled contract fixtures only.
// No issued approval, authenticated external account, source result or trade.
// Keep the large baseline lightweight, but allow a retained diagnostic run
// without changing assertions or racing a development-server rebuild.
test.use({ trace: process.env.TETH_WORKFLOW_TRACE === '1' ? 'on' : 'off', video: 'off' })
test.setTimeout(30_000)
const ready = fixture.snapshots.ready
const documentValue = (name: string) => fixture.documents.find(item => item.name === name)!.value
const approval = { ...documentValue('approval'), strategyVersionId: 'sv_v03_11111111111111111111111111111111' }
const queued = nativeFixture.sources[3].fixture.cases![0].response
const owner = 'session_workflow_ui_fixture_0001'
type Stage = 'VALIDATE' | 'CHALLENGE' | 'APPROVE' | 'SUBMIT'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_workflow_ui_fixture_0001', traceId: 'trace_workflow_ui_fixture_0001' })
const workflow = (page: Page) => page.getByRole('region', { name: '전략 요약', exact: true })
const action = (page: Page, label: string) => workflow(page).getByRole('button', { name: label, exact: true })
const labels: Record<Stage, string> = { VALIDATE: '전략 검증', CHALLENGE: '승인 내용 확인', APPROVE: '이 전략 버전 승인', SUBMIT: '과거 데이터 백테스트 시작' }
async function setup(page: Page, sessionState: 'AUTHENTICATED' | 'ANONYMOUS' = 'AUTHENTICATED') {
  const state = { owner, invalid: false, loss: null as Stage | null, hold: null as Stage | null, release: undefined as (() => void) | undefined,
    submitFailure: null as 'not-ready' | 'wrong-status' | 'malformed' | 'wrong-message' | null,
    posts: [] as { stage: Stage; body: unknown; key: string | undefined; match: string | undefined }[], reads: [] as string[] }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => { sessionStorage.setItem('tesia.native.conversation', id); sessionStorage.setItem('tesia.native.conversation-session', owner) }, { id: ready.conversationId, owner })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"workflow_ui_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
    data: { sessionId: state.owner, state: sessionState, revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_workflow_ui_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route(/\/api\/v[37]\//, async route => {
    const request = route.request(), path = new URL(request.url()).pathname, native = path.startsWith('/api/v7/')
    const stage: Stage | null = request.method() !== 'POST' ? null : path.endsWith('/validate') ? 'VALIDATE' : path.endsWith('/approval-challenges') ? 'CHALLENGE' : path.endsWith('/approve') ? 'APPROVE' : path === '/api/v7/backtests' ? 'SUBMIT' : null
    if (stage) {
      state.posts.push({ stage, body: request.postDataJSON(), key: request.headers()['idempotency-key'], match: request.headers()['if-match'] })
      // A changed HttpOnly owner is adjudicated by the server mutation route,
      // not by inventing an extra frontend session GET before every action.
      if (state.owner !== owner) return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'cache-control': 'no-store' },
        body: JSON.stringify({ meta: meta(native ? '0.7.0' : '0.3.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: native ? 'Native job request failed.' : 'Synthetic changed session' } }) })
      if (state.hold === stage) await new Promise<void>(resolve => { state.release = resolve })
      if (state.loss === stage) { state.loss = null; return route.abort('failed') }
      if (stage === 'SUBMIT' && state.submitFailure) return route.fulfill({
        status: state.submitFailure === 'wrong-status' ? 500 : 409,
        contentType: 'application/json', headers: { 'cache-control': 'no-store' },
        body: JSON.stringify({ ...(state.submitFailure === 'malformed' ? {} : { meta: meta('0.7.0', null) }), error: { code: 'NOT_READY', message: state.submitFailure === 'wrong-message' ? 'Synthetic invalid error text' : 'Native job request failed.' } }),
      })
    } else { if (request.method() !== 'GET') throw new Error('Unexpected workflow mutation'); state.reads.push(path) }
    const binding = Object.fromEntries(['conversationId', 'conversationStateRevision', 'conversationStateHash', 'draftId', 'draftRevision', 'projectionHash'].map(key => [key, ready[key as keyof typeof ready]]))
    const data = stage === 'VALIDATE' ? state.invalid ? { ...binding, status: 'INVALID', issues: [{ code: 'RISK_POLICY_CONFLICT', path: '/execution/leverage' }] } : documentValue('validation-receipt')
      : stage === 'CHALLENGE' ? documentValue('approval-challenge') : stage === 'APPROVE' ? approval : ready
    const body = native ? { ...queued, data: { ...queued.data, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash } }
      : { meta: meta('0.3.0', stage === 'APPROVE' ? '1' : ready.conversationStateRevision), data }
    return route.fulfill({ status: stage === 'SUBMIT' ? 202 : stage === 'CHALLENGE' || stage === 'APPROVE' ? 201 : 200,
      contentType: 'application/json', headers: { ETag: '"workflow_ui_response_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify(body) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(workflow(page)).toBeVisible()
  return state
}
async function reach(page: Page, stage: Stage) {
  if (stage === 'VALIDATE') return
  await action(page, labels.VALIDATE).click()
  if (stage === 'CHALLENGE') return
  await action(page, labels.CHALLENGE).click()
  if (stage === 'APPROVE') return
  await workflow(page).getByRole('checkbox').check()
  await action(page, labels.APPROVE).click()
  await expect(action(page, labels.SUBMIT)).toBeEnabled()
}

const workflowLanguages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
async function setWorkflowLanguage(page: Page, language: ClientLanguage) {
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */ path)
    preferences.setClientPreference('language', language)
  }, language)
}

test('전략 조작부 번역은 7언어·치환자·원본 값과 제어 의미를 보존한다', () => {
  const originalKorean = {"summary":"전략 요약","draft":"전략 초안","target":"대상","pairUnset":"거래쌍 미정","timeframeUnset":"주기 미정","unset":"미정","leverage":"{value}배","orderAmount":"고정 주문 금액","changes":"변경 항목: {changes}","noChanges":"변경 없음 또는 복원된 초안","source":"전체 조건과 시스템 위험 제한 보기","blockers":"지원 범위 확인 필요: {reasons}","validate":"전략 검증","validated":"검증 완료 · 만료: {expiresAt}. 아직 사용자 승인 전입니다.","reviewApproval":"승인 내용 확인","loginContinue":"로그인 후 백테스트 계속","consent":"현재 전략·MMR 미검증 제한을 확인했습니다. 실제 주문을 승인하는 것이 아닙니다.","costs":"비용은 서버 실행 프로필의 가정을 따르며 결과에 분리 표시됩니다.","approvalTarget":"승인 대상:","approve":"이 전략 버전 승인","approvedVersion":"승인 버전:","submit":"과거 데이터 백테스트 시작","paper":"기록 Paper 열기","smoke":"합성 구조 시험 열기","edit":"현재 초안 수정하기","editNotice":"현재 초안만 수정합니다. 이전 승인 버전·결과는 보존되며, 실행 중인 서버 작업을 취소하지 않습니다.","recoveryLabel":"요청 복구","recoveryTitle":"요청 상태 확인","recoveryNotice":"아래 안내를 확인해주세요. 저장 기록만으로 승인이나 실행 완료를 표시하지 않습니다.","editingReady":"현재 서버 초안을 수정할 수 있습니다. 이전 승인 버전과 결과는 바뀌지 않으며, 실행 중인 서버 작업은 계속됩니다. 화면 전환은 취소가 아닙니다. 수정 내용을 입력한 뒤 다시 검증하고 새 버전을 명시적으로 승인해주세요.","priorResult":"이전 승인 버전의 결과입니다. 현재 초안이나 새 작업의 검증 결과가 아닙니다."}
  expect(Object.fromEntries(Object.entries(nativeWorkflowCopy).map(([key, translations]) => [key, translations[0]]))).toEqual(originalKorean)
  expect(Object.keys(nativeWorkflowCopy)).toHaveLength(31)
  const variables: Record<string, string[]> = { changes: ['changes'], blockers: ['reasons'], validated: ['expiresAt'], leverage: ['value'] }
  for (const [key, translations] of Object.entries(nativeWorkflowCopy)) expect([...translations[0].matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()).toEqual(variables[key] ?? [])
  for (const [key, original] of [['unset', 'unknown'], ['leverage', 'leverageValue'], ['orderAmount', 'amount'], ['source', 'source']] as const) expect(nativeWorkflowCopy[key]).toBe(nativeStrategyCopy[original])
  for (const translations of Object.values(nativeWorkflowCopy)) {
    expect(translations).toHaveLength(7)
    const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()
    for (const text of translations) {
      expect(text.trim()).not.toBe('')
      expect(placeholders(text)).toEqual(placeholders(translations[0]))
    }
    for (const text of translations.slice(1)) expect(text).not.toMatch(/[가-힣]/)
  }
  for (const language of workflowLanguages) {
    expect(nativeWorkflowText(language, 'validated', { expiresAt: '$& $1 <time>2030-01-01T00:00:00Z</time>' })).toContain('$& $1 <time>2030-01-01T00:00:00Z</time>')
    expect(nativeWorkflowText(language, 'leverage', { value: '01.000000' })).toContain('01.000000')
    expect(nativeWorkflowLeverage(language, undefined)).toBe(nativeWorkflowText(language, 'unset'))
    expect(nativeWorkflowLeverage(language, null)).toBe(nativeWorkflowText(language, 'unset'))
    expect(nativeWorkflowLeverage(language, 0)).toContain('0')
    expect(nativeWorkflowText(language, 'changes', { changes: '$& {reasons} <raw>' })).toContain('$& {reasons} <raw>')
    expect(nativeWorkflowText(language, 'blockers', { reasons: '$1 {changes} CODE' })).toContain('$1 {changes} CODE')
  }
  expect(nativeWorkflowCopy.consent[0]).toBe('현재 전략·MMR 미검증 제한을 확인했습니다. 실제 주문을 승인하는 것이 아닙니다.')
})

for (const width of [320, 481, 860, 1440]) test(`${width}px 7언어 전환은 검증·동의·승인·제출의 같은 DOM과 원 계약을 유지한다`, async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width, height: 960 })
  const state = await setup(page), section = page.locator('.native-strategy-workflow')
  const raw = section.locator('pre'), details = section.locator('.native-workflow-source')
  await details.locator('summary').click()
  const sectionHandle = await section.elementHandle(), rawHandle = await raw.elementHandle()
  const storage = await page.evaluate(() => ({ ...sessionStorage }))
  const local = await page.evaluate(() => ({ ...localStorage }))
  const url = page.url()
  const actionKey = { VALIDATE: 'validate', CHALLENGE: 'reviewApproval', APPROVE: 'approve', SUBMIT: 'submit' } as const
  for (const stage of ['VALIDATE', 'CHALLENGE', 'APPROVE', 'SUBMIT'] as const) {
    const count = state.posts.length
    const consent = section.getByRole('checkbox')
    if (stage === 'APPROVE') await consent.check()
    const consentHandle = stage === 'APPROVE' ? await consent.elementHandle() : null
    for (const language of workflowLanguages) {
      await setWorkflowLanguage(page, language)
      await expect(section).toHaveAttribute('aria-label', nativeWorkflowText(language, 'summary'))
      await expect(section.getByRole('heading', { level: 2 })).toHaveText(nativeWorkflowText(language, 'draft'))
      const button = section.getByRole('button', { name: nativeWorkflowText(language, actionKey[stage]), exact: true })
      await expect(button).toBeEnabled()
      await expect(details).toHaveAttribute('open', '')
      await expect(raw).toHaveText(JSON.stringify(ready.draftState.projection, null, 2))
      await expect(section.locator('.native-workflow-row').nth(1).locator('dd')).toHaveText(`${ready.draftState.projection.positionSizing.amount} USDT`)
      if (stage !== 'VALIDATE' && stage !== 'SUBMIT') await expect(section.locator('.native-workflow-stage [data-workflow-focus]')).toHaveText(nativeWorkflowText(language, 'validated', { expiresAt: String(documentValue('validation-receipt').expiresAt) }))
      if (stage === 'SUBMIT') {
        for (const key of ['paper', 'smoke', 'edit'] as const) await expect(section.getByRole('button', { name: nativeWorkflowText(language, key), exact: true })).toBeVisible()
        await expect(section.locator('.native-workflow-utilities')).toContainText(nativeWorkflowText(language, 'editNotice'))
      }
      expect(await section.evaluate((node, old) => node === old, sectionHandle)).toBe(true)
      expect(await raw.evaluate((node, old) => node === old, rawHandle)).toBe(true)
      if (stage === 'APPROVE') {
        await expect(consent).toBeChecked()
        expect(await consent.evaluate((node, old) => node === old, consentHandle)).toBe(true)
        await expect(section.locator('.native-workflow-consent span')).toHaveText(nativeWorkflowText(language, 'consent'))
        await expect(section.locator('.native-workflow-binding code')).toHaveText(ready.semanticHash)
      }
      expect(state.posts).toHaveLength(count)
      expect(await page.evaluate(() => ({ ...sessionStorage }))).toEqual(storage)
      expect(page.url()).toBe(url)
      expect(await section.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
      for (const control of await section.locator('button, summary').all()) {
        if (!await control.isVisible()) continue
        const box = await control.boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      }
    }
    await consentHandle?.dispose()
    if (stage === 'APPROVE') {
      await section.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`workflow-consent-fr-${width}.png`) })
    }
    await section.getByRole('button', { name: nativeWorkflowText('fr', actionKey[stage]), exact: true }).click()
    await expect.poll(() => state.posts.length).toBe(count + 1)
    if (stage !== 'SUBMIT') await expect(section.getByRole('button', { name: nativeWorkflowText('fr', actionKey[stage === 'VALIDATE' ? 'CHALLENGE' : stage === 'CHALLENGE' ? 'APPROVE' : 'SUBMIT']), exact: true })).toBeVisible()
  }
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE', 'APPROVE', 'SUBMIT'])
  expect(state.posts[2].body).toMatchObject({ acknowledgedSemanticHash: ready.semanticHash })
  expect(state.posts[3].body).toEqual({ strategyVersionId: approval.strategyVersionId, expectedSemanticHash: ready.semanticHash, profileId: 'INTERNAL_POC_FULL' })
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key !== 'tethLang')))).toEqual(Object.fromEntries(Object.entries(local).filter(([key]) => key !== 'tethLang')))
  await sectionHandle?.dispose(); await rawHandle?.dispose()
})

test('영어 설정은 전략 검증 조작부에도 적용되고 초안 원문과 요청은 바뀌지 않는다', async ({ page }) => {
  const state = await setup(page)
  const section = page.locator('.native-strategy-workflow')
  const button = section.locator('button[data-workflow-action]').first()
  const original = await section.locator('pre').textContent()
  const sameButton = await button.elementHandle()
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */ path)
    preferences.setClientPreference('language', 'en')
  })
  await expect(button).not.toHaveText('전략 검증')
  await expect(section).not.toHaveAttribute('aria-label', '전략 요약')
  expect(await section.locator('pre').textContent()).toBe(original)
  expect(await button.evaluate((element, previous) => element === previous, sameButton)).toBe(true)
  expect(state.posts).toEqual([])
  await sameButton?.dispose()
})

test('좁은 대화창은 언어 변경 직후 긴 placeholder 높이를 다시 측정하고 입력을 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const state = await setup(page)
  const input = page.locator('.g-composer textarea')
  const original = await input.elementHandle()
  for (const language of ['fr', 'en', 'es', 'ko'] as const) {
    await setWorkflowLanguage(page, language)
    await expect(input).toHaveValue('')
    await expect.poll(() => input.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
    expect(await input.evaluate((node, before) => node === before, original)).toBe(true)
  }
  expect(state.posts).toEqual([])
  await original?.dispose()
})

test('비로그인 검증의 7언어 다음 단계는 승인 버튼이 아니라 로그인 계속 안내다', async ({ page }) => {
  const state = await setup(page, 'ANONYMOUS')
  await action(page, labels.VALIDATE).click()
  for (const language of workflowLanguages) {
    await setWorkflowLanguage(page, language)
    const section = page.locator('.native-strategy-workflow')
    await expect(section.getByRole('button', { name: nativeWorkflowText(language, 'loginContinue'), exact: true })).toBeEnabled()
    await expect(section.getByRole('button', { name: nativeWorkflowText(language, 'approve'), exact: true })).toHaveCount(0)
    await expect(section.getByRole('checkbox')).toHaveCount(0)
    expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE'])
  }
})

test('초기 세션 조회 실패의 복구 안내 제목·설명도 7언어이며 새 요청을 만들지 않는다', async ({ page }) => {
  const state = await setup(page)
  await page.route('**/api/v1/auth/session', route => route.abort('failed'))
  await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  const posts = structuredClone(state.posts)
  for (const language of workflowLanguages) {
    await setWorkflowLanguage(page, language)
    const section = page.getByRole('region', { name: nativeWorkflowText(language, 'recoveryLabel'), exact: true })
    await expect(section.getByRole('heading')).toHaveText(nativeWorkflowText(language, 'recoveryTitle'))
    await expect(section.locator('p')).toHaveText(nativeWorkflowText(language, 'recoveryNotice'))
    expect(state.posts).toEqual(posts)
  }
})

test('검증 대기 중 언어 전환은 같은 버튼·초점·요청 기록을 유지하고 추가 요청을 보내지 않는다', async ({ page }) => {
  const state = await setup(page)
  state.hold = 'VALIDATE'
  const button = page.locator('.native-strategy-workflow button[data-workflow-action]').first()
  await button.focus(); await page.keyboard.press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  const pending = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  const handle = await button.elementHandle()
  for (const language of ['fr', 'ja', 'ko', 'en'] as const) {
    await setWorkflowLanguage(page, language)
    await expect(button).toHaveText(nativeWorkflowText(language, 'validate'))
    await expect(button).toBeDisabled()
    await expect(button).toBeFocused()
    await button.evaluate(node => (node as HTMLButtonElement).click())
    expect(await button.evaluate((node, previous) => node === previous, handle)).toBe(true)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(pending)
    expect(state.posts).toHaveLength(1)
  }
  state.release!()
  await expect(page.locator('.native-workflow-stage [data-workflow-focus]')).toHaveText(nativeWorkflowText('en', 'validated', { expiresAt: String(documentValue('validation-receipt').expiresAt) }))
  await expect(page.getByRole('button', { name: nativeWorkflowText('en', 'reviewApproval'), exact: true })).toBeEnabled()
  expect(state.posts).toHaveLength(1)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
  await handle?.dispose()
})

for (const reload of [false, true]) for (const mode of ['not-ready', 'wrong-status', 'malformed', 'wrong-message', 'transport'] as const) test(`FULL 접수 ${mode} reload=${reload}: 검증된 준비 미완료만 구분하고 같은 요청을 보존한다`, async ({ page }) => {
  const state = await setup(page)
  await reach(page, 'SUBMIT')
  if (mode === 'transport') state.loss = 'SUBMIT'
  else state.submitFailure = mode
  await action(page, labels.SUBMIT).click()
  const alert = page.getByRole('alert')
  if (mode === 'not-ready') {
    await expect(alert).toContainText('서버가 아직 실행 준비를 마치지 못해 백테스트를 시작하지 못했습니다.')
    await expect(alert).not.toContainText('응답을 확인하지 못했습니다.')
  } else {
    await expect(alert).toContainText('응답을 확인하지 못했습니다.')
    await expect(alert).not.toContainText('서버가 아직 실행 준비를')
  }
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toBeNull()
  await expect(page.locator('[data-native-job-state], .native-service-result')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toBeDisabled()
  if (reload) await page.reload()
  const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await expect(resume).toBeEnabled()
  expect(state.posts.filter(item => item.stage === 'SUBMIT')).toHaveLength(1)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(journal)
  state.submitFailure = null
  await resume.click()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'QUEUED')
  const submits = state.posts.filter(item => item.stage === 'SUBMIT')
  expect(submits).toHaveLength(2)
  expect(submits[1]).toEqual(submits[0])
  await expect(alert).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
})
test('검증·challenge·동의·승인·작업 제출은 각각 명시 동작이며 이전 단계를 자동 승격하지 않는다', async ({ page }) => {
  const state = await setup(page)
  await expect(workflow(page)).toHaveClass(/native-strategy-workflow/)
  expect(state.posts).toHaveLength(0)
  await action(page, labels.VALIDATE).click()
  await expect(action(page, labels.CHALLENGE)).toBeEnabled()
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE'])
  await expect(workflow(page)).toContainText('아직 사용자 승인 전입니다.')
  await expect(workflow(page).getByRole('checkbox')).toHaveCount(0)
  await action(page, labels.CHALLENGE).click()
  const consent = workflow(page).getByRole('checkbox')
  await expect(consent).not.toBeChecked()
  await expect(action(page, labels.APPROVE)).toBeDisabled()
  await action(page, labels.APPROVE).evaluate(node => (node as HTMLButtonElement).click())
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE'])
  await consent.focus(); await page.keyboard.press('Space'); await expect(consent).toBeChecked()
  await action(page, labels.APPROVE).focus(); await page.keyboard.press('Enter')
  await expect(action(page, labels.SUBMIT)).toBeEnabled()
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE', 'APPROVE'])
  expect(state.posts[2].body).toMatchObject({ acknowledgedSemanticHash: ready.semanticHash, expectedConversationStateRevision: ready.conversationStateRevision, expectedConversationStateHash: ready.conversationStateHash })
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
  await action(page, labels.SUBMIT).click()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'QUEUED')
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toBeVisible()
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE', 'APPROVE', 'SUBMIT'])
  expect(state.posts[3].body).toEqual({ strategyVersionId: approval.strategyVersionId, expectedSemanticHash: ready.semanticHash, profileId: 'INTERNAL_POC_FULL' })
  await expect(page.getByRole('region', { name: '백테스트 결과', exact: true })).toHaveCount(0)
})
test('INVALID 검증은 승인 동의를 만들지 않고 재검증 통과도 자동 승인하지 않는다', async ({ page }) => {
  const state = await setup(page); state.invalid = true
  await action(page, labels.VALIDATE).click()
  await expect(page.getByRole('alert')).toContainText('RISK_POLICY_CONFLICT')
  await expect(action(page, labels.CHALLENGE)).toHaveCount(0)
  await expect(workflow(page).getByRole('checkbox')).toHaveCount(0)
  state.invalid = false
  await action(page, labels.VALIDATE).click()
  await expect(action(page, labels.CHALLENGE)).toBeEnabled()
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'VALIDATE'])
})
test('검증 응답 대기 중 중복 클릭은 추가 요청을 만들지 않으며 기존 입력을 보존한다', async ({ page }) => {
  const state = await setup(page); state.hold = 'VALIDATE'
  const input = page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })
  await input.fill('검증 중에도 보존할 미전송 조건')
  await action(page, labels.VALIDATE).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(action(page, labels.VALIDATE)).toBeDisabled()
  await action(page, labels.VALIDATE).evaluate(node => (node as HTMLButtonElement).click())
  expect(state.posts).toHaveLength(1)
  state.release!()
  await expect(action(page, labels.CHALLENGE)).toBeEnabled()
  await expect(input).toHaveValue('검증 중에도 보존할 미전송 조건')
})
test('동의를 체크한 뒤 owner 변경으로 서버가 승인을 거절하면 승인·실행으로 승격하지 않는다', async ({ page }) => {
  const state = await setup(page); await reach(page, 'APPROVE')
  await workflow(page).getByRole('checkbox').check(); state.owner = 'session_workflow_ui_other_0002'
  await action(page, labels.APPROVE).click()
  await expect(page.getByRole('alert')).toContainText('AUTHENTICATION_REQUIRED')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE', 'APPROVE'])
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeDisabled()
  expect(JSON.parse((await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command')))!).kind).toBe('APPROVE')
  await expect(action(page, labels.SUBMIT)).toHaveCount(0)
})
test('키보드 연속성: 검증 Enter 후 대기·완료에도 실행한 버튼의 DOM 포커스를 보존한다', async ({ page }, testInfo) => {
  const state = await setup(page); state.hold = 'VALIDATE'
  const validate = action(page, labels.VALIDATE)
  await validate.focus(); await expect(validate).toBeFocused(); await page.keyboard.down('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(validate).toBeDisabled()
  const pending = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 100), className: document.activeElement?.className }))
  await testInfo.attach('validation-pending-focus', { body: JSON.stringify(pending), contentType: 'application/json' })
  await expect(validate, '검증 대기 중 실제 활성 요소가 원 검증 버튼이어야 한다').toBeFocused()
  await page.keyboard.down('Enter')
  await validate.evaluate(node => (node as HTMLButtonElement).click())
  expect(state.posts).toHaveLength(1)
  state.release!()
  await expect(action(page, labels.CHALLENGE)).toBeEnabled()
  const completed = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 100), className: document.activeElement?.className }))
  await testInfo.attach('validation-completed-focus', { body: JSON.stringify(completed), contentType: 'application/json' })
  await expect(validate, '검증 완료 후 의도하지 않은 body 포커스로 이동하지 않아야 한다').toBeFocused()
  await page.keyboard.down('Enter'); await page.keyboard.up('Enter')
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE'])
})
test('키보드 연속성: 승인 Enter 뒤 비동작 승인 상태에서 Tab·명시 Enter로만 실행한다', async ({ page }, testInfo) => {
  const state = await setup(page); await reach(page, 'APPROVE')
  const consent = workflow(page).getByRole('checkbox')
  await consent.focus(); await page.keyboard.press('Space')
  await expect(consent).toBeChecked()
  state.hold = 'APPROVE'
  const approve = action(page, labels.APPROVE)
  await approve.focus(); await page.keyboard.down('Enter')
  await expect.poll(() => state.posts.length).toBe(3)
  await expect(approve).toHaveAttribute('aria-disabled', 'true')
  await expect(approve).toBeFocused()
  await page.keyboard.down('Enter')
  await approve.evaluate(node => (node as HTMLButtonElement).click())
  expect(state.posts).toHaveLength(3)
  state.release!()
  const next = action(page, labels.SUBMIT)
  await expect(next).toBeEnabled()
  const completed = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 100), className: document.activeElement?.className }))
  await testInfo.attach('approval-completed-focus', { body: JSON.stringify(completed), contentType: 'application/json' })
  const status = workflow(page).locator('[data-workflow-focus]')
  await expect(status).toContainText(`승인 버전: ${approval.strategyVersionId}`)
  await expect(status).toBeFocused()
  await expect(status).toHaveAttribute('tabindex', '-1')
  await page.keyboard.down('Enter'); await page.keyboard.up('Enter')
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE', 'APPROVE'])
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('native-workflow-approval-state-focus.png') })
  await page.keyboard.press('Tab'); await expect(next).toBeFocused()
  expect(state.posts).toHaveLength(3)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveAttribute('data-native-job-state', 'QUEUED')
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE', 'APPROVE', 'SUBMIT'])
})
for (const choice of ['title-input', 'outside-pointer'] as const) test(`키보드 연속성 ${choice}: 승인 응답 동안 사용자가 고른 초점을 완료 시 빼앗지 않는다`, async ({ page }, testInfo) => {
  const state = await setup(page); await reach(page, 'APPROVE')
  await workflow(page).getByRole('checkbox').check(); state.hold = 'APPROVE'
  const approve = action(page, labels.APPROVE)
  await approve.focus(); await page.keyboard.press('Enter')
  await expect.poll(() => state.posts.length).toBe(3)
  await expect(approve).toBeFocused()
  if (choice === 'title-input') {
    await page.getByRole('button', { name: '대화 제목 수정', exact: true }).click()
    await page.locator('.g-title-input').fill('승인 응답 중 작성하는 제목')
    await expect(page.locator('.g-title-input')).toBeFocused()
  } else {
    const rect = await page.locator('.client-source-main').boundingBox()
    await page.mouse.click(rect!.x + 2, rect!.y + 70)
    expect(await workflow(page).evaluate(node => node.contains(document.activeElement))).toBe(false)
  }
  const chosen = await page.evaluateHandle(() => document.activeElement)
  await testInfo.attach('user-selected-focus-before-approval', { body: JSON.stringify(await page.evaluate(() => ({ tag: document.activeElement?.tagName, className: document.activeElement?.className }))), contentType: 'application/json' })
  state.release!()
  await expect(action(page, labels.SUBMIT)).toBeEnabled()
  if (choice === 'title-input') {
    await expect(page.locator('.g-title-input')).toBeFocused()
    await expect(page.locator('.g-title-input')).toHaveValue('승인 응답 중 작성하는 제목')
  }
  expect(await page.evaluate(selected => document.activeElement === selected, chosen)).toBe(true)
  await chosen.dispose()
  await expect(workflow(page).locator('[data-workflow-focus]')).not.toBeFocused()
  await testInfo.attach('user-selected-focus-after-approval', { body: JSON.stringify(await page.evaluate(() => ({ tag: document.activeElement?.tagName, className: document.activeElement?.className }))), contentType: 'application/json' })
  expect(state.posts.map(row => row.stage)).toEqual(['VALIDATE', 'CHALLENGE', 'APPROVE'])
})
for (const stage of ['VALIDATE', 'CHALLENGE', 'APPROVE', 'SUBMIT'] as const) test(`${stage} 응답 소실은 원 요청만 명시 재개하며 키·본문·사전조건을 바꾸지 않는다`, async ({ page }) => {
  const state = await setup(page); await reach(page, stage)
  if (stage === 'APPROVE') await workflow(page).getByRole('checkbox').check()
  state.loss = stage; await action(page, labels[stage]).click()
  const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await expect(resume).toBeEnabled()
  const first = state.posts.find(row => row.stage === stage)!
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(JSON.parse(journal!).kind).toBe(stage)
  const count = state.posts.length
  await page.reload(); await expect(resume).toBeEnabled()
  expect(state.posts).toHaveLength(count)
  await resume.click()
  await expect.poll(() => state.posts.filter(row => row.stage === stage).length).toBe(2)
  expect(state.posts.filter(row => row.stage === stage)).toEqual([first, first])
  await expect(resume).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
})
for (const width of [320, 1440]) test(`${width}px: 초안·동의·승인 버튼과 긴 hash의 줄바꿈 및 대화·문서 맥락`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 960 })
  const state = await setup(page), url = page.url()
  const capture = async (scenario: string) => {
    await workflow(page).evaluate((node, scenario) => node.setAttribute('data-scenario', scenario), scenario)
    await page.evaluate(() => document.fonts.ready)
    for (const button of await workflow(page).getByRole('button').all()) {
      if (!await button.isVisible()) continue
      const box = await button.boundingBox(); expect(box).not.toBeNull()
      const touch = await page.evaluate(() => matchMedia('(max-width: 860px), (pointer: coarse)').matches)
      expect(box!.height).toBeGreaterThanOrEqual(touch ? 44 : 34)
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
    }
    expect(await workflow(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await workflow(page).scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`native-workflow-${scenario}-${width}.png`) })
  }
  await capture('draft')
  const details = workflow(page).locator('.native-workflow-source')
  await details.locator('summary').click()
  await expect(details.locator('pre')).toHaveText(JSON.stringify(ready.draftState.projection, null, 2))
  await details.locator('summary').click(); expect(state.posts).toHaveLength(0)
  await reach(page, 'APPROVE'); await capture('consent')
  await expect(workflow(page).locator('.native-workflow-consent')).toContainText('실제 주문을 승인하는 것이 아닙니다.')
  const posts = state.posts.length
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await page.locator('.native-plan-technical > summary').click()
  await expect(page.getByRole('article', { name: '현재 서버 전략 초안', exact: true })).toBeVisible()
  await page.locator('.native-research-workspace').getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  expect(state.posts).toHaveLength(posts); expect(page.url()).toBe(url)
  await workflow(page).getByRole('checkbox').check(); await action(page, labels.APPROVE).click()
  await expect(action(page, labels.SUBMIT)).toBeEnabled(); await capture('approved')
})
