import { expect, test, type Locator, type Page } from '@playwright/test'
import { sourceSharedStrategies, sharedHash } from '../src/client-shared-strategies'
import { delegationBudgets } from '../src/client-delegation-fixtures'
import { evaluateDelegation } from '../src/client-delegation-engine'

const priorId = 'shared-copy-original-conversation'
const owner = 'copy@example.test'
const original = { id: priorId, title: '기존 BTC 전략', renamed: true, idea: '비트코인 반등', draft: '기존 대화 미전송 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], updatedAt: 1 }
const homeDraft = '원래 홈 초안'
const seeds = sourceSharedStrategies()
const eth = seeds.find(row => row.asset === '이더리움')!
const nasdaq = seeds.find(row => row.asset === '나스닥')!
type Request = { nick: string; budgetIndex: number; sl: number; tp: number }
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function continueCopyAfterIntro(page: Page) {
  const intro = page.getByRole('dialog', { name: '이 전략을 따라하려면 연결이 필요해요', exact: true })
  const settings = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  // Exercise the actual first-use sheet, without seeding its seen state. A
  // subsequent entry in the same page session may go directly to settings.
  await expect(intro.or(settings).first()).toBeVisible()
  if (await intro.isVisible()) {
    await intro.getByRole('button', { name: '나중에 하기', exact: true }).click()
    await expect(intro).toHaveCount(0)
  }
  await expect(settings).toBeVisible()
}

async function setup(page: Page, signed = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ original, homeDraft, owner, signed }) => {
    if (!sessionStorage.getItem('copy-fixture-initialized')) {
      sessionStorage.setItem('copy-fixture-initialized', '1')
      if (signed) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복제 검수자', email: owner }))
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: original.id, homeDraft, sessions: [original] }))
    }
  }, { original, homeDraft, owner, signed })
}
async function openCopy(page: Page, request: Request) {
  await page.goto(`/${sharedHash({ nick: request.nick, period: 'all' })}`)
  await page.getByRole('button', { name: '따라하기', exact: true }).click()
  await continueCopyAfterIntro(page)
  await expect(page.getByRole('dialog', { name: '전략 따라하기', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: '시작 예산', exact: true }).selectOption(String(request.budgetIndex))
  await page.getByRole('combobox', { name: '손절선', exact: true }).selectOption(String(request.sl))
  await page.getByRole('combobox', { name: '익절 목표', exact: true }).selectOption(String(request.tp))
  await page.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '예상 결과 확인', exact: true })).toBeVisible()
}
async function saved(page: Page) {
  return page.evaluate(() => {
    const experience = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    const copy = experience.sessions.find((row: { sharedCopy?: unknown }) => row.sharedCopy)
    return { experience, copy, delegation: copy ? JSON.parse(sessionStorage.getItem(`teth:client-delegation:${copy.id}`)!) : null,
      keys: Object.keys(sessionStorage).filter(key => key.startsWith('teth:client-delegation:')) }
  })
}
async function fixedDialogControls(page: Page, dialog: Locator) {
  const header = dialog.locator('header'), initial = await header.boundingBox()
  const controls = dialog.locator('header h2, header button, .ss3-dacts > button')
  const check = async () => {
    for (const control of await controls.all()) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
      if (await control.evaluate(el => el.tagName === 'BUTTON')) expect(await control.evaluate(el => {
        const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return hit === el || el.contains(hit)
      })).toBe(true)
    }
  }
  await check()
  await dialog.locator('.ss3-dialog-body').evaluate(el => { el.scrollTop = el.scrollHeight })
  await check()
  expect((await header.boundingBox())!.y).toBeCloseTo(initial!.y, 1)
}

for (const [row, budgetIndex] of [[eth, 0], [nasdaq, 3]] as const) test(`${row.asset} 복제는 독립 세션·원본 설정·예산을 복원하고 초기 완료를 만들지 않는다`, async ({ page }, info) => {
  await page.clock.install()
  await setup(page)
  const request = { nick: row.nick, budgetIndex, sl: row.parameters.sl, tp: row.parameters.tp! }
  await openCopy(page, request)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${row.asset} 전략 검증`, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toHaveCount(0)
  const first = await saved(page)
  expect(first.experience.sessions).toHaveLength(2)
  expect(first.copy.id).not.toBe(priorId)
  expect(first.copy).toMatchObject({ workspace: 'delegation', tradingReady: false, turns: [], sharedCopy: { owner, nick: row.nick, returnId: priorId, active: true } })
  expect(first.copy.sharedCopy.confirmedAt).toBeGreaterThan(0)
  expect(first.experience.homeDraft).toBe(homeDraft)
  expect(first.experience.sessions.find((s: { id: string }) => s.id === priorId)).toMatchObject(original)
  expect(first.delegation).toMatchObject({ page: 'backtest', workStep: 0, answers: { asset: { index: row.asset === '이더리움' ? 1 : 3 }, budget: { index: budgetIndex } } })
  expect(first.delegation.parameters).toEqual(row.parameters)
  expect(first.delegation.pendingParameters).toEqual(row.parameters)
  await page.reload()
  await expect(page.getByRole('heading', { name: `${row.asset} 전략 검증`, exact: true })).toBeVisible()
  expect((await saved(page)).copy.id).toBe(first.copy.id)
  await page.clock.fastForward(5000)
  await expect(page.locator('.tf-scorebox')).toBeVisible()
  // The result mounts after the work timer settles; give its presentation-only
  // requestAnimationFrame the next frame, including reduced-motion duration 0.
  await page.clock.runFor(32)
  const expected = evaluateDelegation(row.parameters, delegationBudgets[budgetIndex])
  await expect(page.locator('.tf-scorebox')).toContainText(String(expected.score))
  expect((await saved(page)).delegation.parameters).toEqual(row.parameters)
  if (expected.score >= 80) {
    await page.getByRole('button', { name: '리포트 보기', exact: true }).click()
    await expect(page.locator('.tf-report-page')).toBeVisible()
    await expect(page.locator('.tf-report-page')).toContainText(`₩${delegationBudgets[budgetIndex].toLocaleString('ko-KR')}`)
    await page.reload()
    await expect(page.locator('.tf-report-page')).toBeVisible()
  } else {
    await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true })).toBeVisible()
  }
  expect((await saved(page)).copy.id).toBe(first.copy.id)
  await page.screenshot({ path: info.outputPath(`copy-result-${row.asset}.png`) })
})

test('복제 검증에서 뒤로·다시 검증은 원본 RSI·구간을 보존하고 원래 대화로 돌아간다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) requests.push(request.url()) })
  await setup(page)
  await openCopy(page, { nick: eth.nick, budgetIndex: 1, sl: -8, tp: 10 })
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.locator('.client-delegation .tfw')).toBeVisible()
  const id = (await saved(page)).copy.id
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(page.getByRole('heading', { name: '전략 계약서', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '전략 검증 시작', exact: true }).click()
  await expect(page.locator('.client-delegation .tfw')).toBeVisible()
  const after = await saved(page)
  expect(after.copy.id).toBe(id)
  expect(after.copy.sharedCopy.active).toBe(true)
  expect(after.delegation.parameters).toEqual({ ...eth.parameters, sl: -8, tp: 10 })
  expect(after.delegation.pendingParameters).toEqual({ ...eth.parameters, sl: -8, tp: 10 })
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue(original.draft)
  expect((await saved(page)).experience.currentId).toBe(priorId)
  expect((await saved(page)).experience.homeDraft).toBe(homeDraft)
  expect(requests).toEqual([])
})

for (const resetLabel of ['다시 답하기', '직접 수정']) test(`${resetLabel}는 복제 활성 귀속을 해제하고 원래 대화와 독립 ID는 보존한다`, async ({ page }) => {
  await page.clock.install()
  await setup(page)
  await openCopy(page, { nick: nasdaq.nick, budgetIndex: 1, sl: nasdaq.parameters.sl, tp: nasdaq.parameters.tp! })
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.locator('.client-delegation .tfw')).toBeVisible()
  const first = await saved(page)
  if (resetLabel === '다시 답하기') await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  else {
    await page.clock.fastForward(5000)
    await expect(page.locator('.tf-scorebox')).toBeVisible()
    await page.clock.runFor(32)
  }
  await page.getByRole('button', { name: resetLabel, exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떤 자산으로 할까요?', exact: true })).toBeVisible()
  const changed = await saved(page)
  expect(changed.copy.id).toBe(first.copy.id)
  expect(changed.copy.sharedCopy).toEqual({ ...first.copy.sharedCopy, active: false })
  expect(changed.experience.sessions.find((s: { id: string }) => s.id === priorId)).toMatchObject(original)
  expect(changed.experience.homeDraft).toBe(homeDraft)
  expect(changed.delegation).toMatchObject({ page: 'intake', answers: {}, questionIndex: 0, workStep: 0 })
  expect(changed.delegation.parameters).toBeUndefined()
  expect(changed.delegation.pendingParameters).toBeUndefined()
  await page.reload()
  await expect(page.getByRole('heading', { name: '어떤 자산으로 할까요?', exact: true })).toBeVisible()
  expect((await saved(page)).copy.sharedCopy.active).toBe(false)
})

test('같은 확인 버튼의 연속 DOM 클릭은 새 복제 세션을 한 개만 만든다', async ({ page }) => {
  await setup(page)
  await openCopy(page, { nick: eth.nick, budgetIndex: 1, sl: -5, tp: 12 })
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(page.locator('.client-delegation')).toBeVisible()
  const value = await saved(page)
  expect(value.experience.sessions.filter((s: { sharedCopy?: unknown }) => s.sharedCopy)).toHaveLength(1)
  expect(value.keys).toHaveLength(1)
})

for (const stage of ['delegation', 'experience'] as const) test(`${stage} 저장 실패는 기존 대화와 모달 조건을 지키며 명시 재시도만 새 세션을 만든다`, async ({ page }) => {
  await setup(page)
  await openCopy(page, { nick: eth.nick, budgetIndex: 2, sl: -3, tp: 15 })
  const before = await saved(page)
  await page.evaluate(stage => {
    const original = Storage.prototype.setItem
    Object.assign(window, { copyFail: true })
    Storage.prototype.setItem = function (key, value) {
      if (Reflect.get(window, 'copyFail') && (stage === 'delegation' ? key.startsWith('teth:client-delegation:') : key === 'teth-client-experience')) throw new Error('copy test storage blocked')
      return original.call(this, key, value)
    }
  }, stage)
  const confirm = page.getByRole('button', { name: '확정하고 검증 시작', exact: true })
  await confirm.click()
  await expect(page.getByRole('dialog', { name: '예상 결과 확인', exact: true })).toContainText('복제 조건을 저장하지 못했어요')
  const failed = await saved(page)
  expect(failed.experience).toEqual(before.experience)
  expect(failed.copy).toBeUndefined()
  expect(failed.keys).toEqual([])
  await expect(page.getByRole('dialog')).toContainText('1,000만원')
  await expect(page.getByRole('dialog')).toContainText('-3% / +15%')
  await page.evaluate(() => Reflect.set(window, 'copyFail', false))
  await confirm.click()
  await expect(page.locator('.client-delegation')).toBeVisible()
  expect((await saved(page)).experience.sessions).toHaveLength(2)
  expect((await saved(page)).delegation.parameters ?? (await saved(page)).delegation.pendingParameters).toEqual({ ...eth.parameters, sl: -3, tp: 15 })
})

test('320px 모달은 키보드 취소·닫기와 최초 포커스 복귀를 지키고 취소 시 저장하지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await setup(page)
  await page.goto(`/${sharedHash({ nick: nasdaq.nick, period: 'all' })}`)
  const trigger = page.getByRole('button', { name: '따라하기', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await continueCopyAfterIntro(page)
  const dialog = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await page.evaluate(() => document.fonts.ready)
  expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  for (const control of await dialog.locator('button,select').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await fixedDialogControls(page, dialog)
  await dialog.screenshot({ path: info.outputPath('copy-settings-320.png') })
  await dialog.getByRole('button', { name: '취소', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await continueCopyAfterIntro(page)
  await page.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const estimate = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  await expect.poll(() => estimate.locator('.ss3-dialog-body').evaluate(el => el.scrollTop)).toBe(0)
  await fixedDialogControls(page, estimate)
  await estimate.screenshot({ path: info.outputPath('copy-estimate-320.png') })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect((await saved(page)).experience.sessions).toHaveLength(1)
  expect((await saved(page)).keys).toEqual([])
})

test('게스트의 따라하기는 로그인만 열고 복제 세션이나 검증 스냅샷을 만들지 않는다', async ({ page }) => {
  await setup(page, false)
  await page.goto(`/${sharedHash({ nick: eth.nick, period: 'all' })}`)
  await page.getByRole('button', { name: '따라하기', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await expect(page.getByRole('button', { name: '확정하고 검증 시작', exact: true })).toHaveCount(0)
  expect((await saved(page)).experience.sessions).toHaveLength(1)
  expect((await saved(page)).keys).toEqual([])
})

test('현재 응답이 진행 중이면 복제 확정이 거절되고 원래 초안·선택이 유지된다', async ({ page }) => {
  await page.clock.install()
  await setup(page)
  await page.addInitScript(() => {
    const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    state.sessions[0].turns = [{ id: 'busy-turn', question: '진행 중 질문', answer: '', fullAnswer: '응답 중'.repeat(10000), startedAt: Date.now(), status: 'running', suggestions: [], phase: 'plan' }]
    sessionStorage.setItem('teth-client-experience', JSON.stringify(state))
  })
  await openCopy(page, { nick: eth.nick, budgetIndex: 0, sl: -5, tp: 12 })
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '예상 결과 확인', exact: true })).toContainText('응답이 끝난 뒤 다시 시도해주세요')
  const value = await saved(page)
  expect(value.experience.sessions).toHaveLength(1)
  expect(value.experience.currentId).toBe(priorId)
  expect(value.experience.sessions[0].draft).toBe(original.draft)
  expect(value.experience.homeDraft).toBe(homeDraft)
  expect(value.keys).toEqual([])
})

test('store는 두 저장 완료 전 emit하지 않으며 실패한 새 UUID의 메모리만 정리한다', async ({ page }) => {
  await setup(page)
  await page.route('**/copy-store-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Local store fixture</body></html>' }))
  await page.goto('/copy-store-test.html')
  const outcomes = await page.evaluate(async ({ request, owner }) => {
    const storePath = '/src/client-experience-store.ts', uiPath = '/src/client-delegation-fixtures.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ storePath)
    const { readDelegationUi } = await import(/* @vite-ignore */ uiPath)
    const store = createClientExperienceStore(), initial = store.getSnapshot(), stored = sessionStorage.getItem('teth-client-experience')
    const writes: string[] = [], emissions: unknown[] = []
    const nativeSet = Storage.prototype.setItem
    let fail: 'delegation' | 'experience' | null = 'delegation'
    Storage.prototype.setItem = function (key, value) {
      writes.push(key)
      if (fail === 'delegation' && key.startsWith('teth:client-delegation:') || fail === 'experience' && key === 'teth-client-experience') throw new Error('atomic test write failure')
      return nativeSet.call(this, key, value)
    }
    store.subscribe(() => emissions.push({ count: store.getSnapshot().sessions.length, writes: [...writes] }))
    const failures = []
    for (const stage of ['delegation', 'experience'] as const) {
      fail = stage; writes.length = 0
      let error = ''
      try { store.copySharedStrategy(owner, Object.freeze({ ...request })) } catch (cause) { error = (cause as Error).message }
      const key = writes.find(key => key.startsWith('teth:client-delegation:'))!
      failures.push({ stage, error, unchanged: initial === store.getSnapshot(), storageUnchanged: stored === sessionStorage.getItem('teth-client-experience'), emissions: emissions.length, orphan: sessionStorage.getItem(key), memory: readDelegationUi(key.slice('teth:client-delegation:'.length)), writes: [...writes] })
    }
    fail = null; writes.length = 0
    let guestError = ''
    try { store.copySharedStrategy('', request) } catch (cause) { guestError = (cause as Error).message }
    const beforeSuccess = writes.length
    const frozen = Object.freeze({ ...request }), id = store.copySharedStrategy(owner, frozen)
    const restored = createClientExperienceStore().getSnapshot()
    return { failures, guestError, beforeSuccess, id, emissions, writes, snapshot: store.getSnapshot(), restored, request: frozen }
  }, { request: { nick: eth.nick, budgetIndex: 2, sl: -3, tp: 15 }, owner })
  for (const failure of outcomes.failures) {
    expect(failure.error).toContain('복제 조건을 저장하지 못했어요')
    expect(failure.unchanged).toBe(true)
    expect(failure.storageUnchanged).toBe(true)
    expect(failure.emissions).toBe(0)
    expect(failure.orphan).toBeNull()
    expect(failure.memory).toBeUndefined()
    expect(failure.writes.length).toBe(failure.stage === 'delegation' ? 1 : 2)
  }
  expect(outcomes.guestError).toContain('로그인')
  expect(outcomes.beforeSuccess).toBe(0)
  expect(outcomes.writes).toEqual([`teth:client-delegation:${outcomes.id}`, 'teth-client-experience'])
  expect(outcomes.emissions).toEqual([{ count: 2, writes: outcomes.writes }])
  expect(outcomes.restored.sessions).toEqual(outcomes.snapshot.sessions)
  expect(outcomes.snapshot.sessions.find((row: { id: string }) => row.id === priorId)).toMatchObject(original)
  expect(outcomes.snapshot.homeDraft).toBe(homeDraft)
  expect(outcomes.request).toEqual({ nick: eth.nick, budgetIndex: 2, sl: -3, tp: 15 })
})
