import { expect, test, type Page } from '@playwright/test'

const owner = 'source-entry@example.test'

async function blank(page: Page) {
  await page.route('**/source-entry-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Source entry store fixture</body></html>' }))
  await page.goto('/source-entry-store.html')
}

test('새 source 질문은 원 세션·두 초안을 보존하고 선택을 바꿔도 자기 id로 완료된다', async ({ page }) => {
  await blank(page)
  const result = await page.evaluate(async () => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    store.send('비트코인 반등 조건을 정리해줘')
    store.tick(Date.now() + 100_000)
    const oldId = store.getSnapshot().currentId!
    store.draft('기존 대화에서 아직 보내지 않은 초안')
    store.home()
    store.draft('홈에서 아직 보내지 않은 별도 초안')
    store.select(oldId)
    const before = structuredClone(store.getSnapshot())
    const id = store.startConversation('BTC의 원문 source 질문', '비트코인에 대해 더 알려줘')
    const started = structuredClone(store.getSnapshot())
    const turn = started.sessions.find(session => session.id === id)!.turns[0]
    store.select(oldId)
    store.tick(turn.startedAt + 100_000)
    const ticked = structuredClone(store.getSnapshot())
    const restored = createClientExperienceStore().getSnapshot()
    return { before, id, started, ticked, restored }
  })
  expect(result.id).not.toBe(result.before.currentId)
  expect(result.started.currentId).toBe(result.id)
  expect(result.started.sessions).toHaveLength(result.before.sessions.length + 1)
  expect(result.started.homeDraft).toBe('홈에서 아직 보내지 않은 별도 초안')
  expect(result.started.sessions.find(session => session.id === result.before.currentId)).toEqual(result.before.sessions.find(session => session.id === result.before.currentId))
  expect(result.started.sessions.find(session => session.id === result.id)?.turns[0]).toMatchObject({
    question: '비트코인에 대해 더 알려줘',
    requestText: 'BTC의 원문 source 질문',
    status: 'running',
  })
  expect(result.ticked.currentId).toBe(result.before.currentId)
  expect(result.ticked.sessions.find(session => session.id === result.id)?.turns[0].status).toBe('done')
  expect(result.ticked.sessions.find(session => session.id === result.before.currentId)).toEqual(result.before.sessions.find(session => session.id === result.before.currentId))
  expect(result.restored.currentId).toBe(result.before.currentId)
  expect(result.restored.homeDraft).toBe('홈에서 아직 보내지 않은 별도 초안')
  // BF699 preserves absent optional result collections; durability only omits
  // undefined optional turn fields. Compare every persisted field unchanged.
  expect(result.restored.sessions).toEqual(JSON.parse(JSON.stringify(result.ticked.sessions)))
})

test('진행 중 중복과 저장 실패는 새 id·emit·선택을 만들지 않는다', async ({ page }) => {
  await blank(page)
  const result = await page.evaluate(async () => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    store.draft('보존할 홈 초안')
    const firstId = store.startConversation('첫 source 질문')
    const busyBefore = store.getSnapshot(), busyRaw = sessionStorage.getItem('teth-client-experience')
    let busyError = ''
    try { store.startConversation('중복 source 질문') } catch (cause) { busyError = (cause as Error).message }
    const busyAfter = store.getSnapshot()
    const busyRawUnchanged = busyRaw === sessionStorage.getItem('teth-client-experience')
    store.tick(Date.now() + 100_000)
    const durableBefore = store.getSnapshot(), durableRaw = sessionStorage.getItem('teth-client-experience')
    const nativeSet = Storage.prototype.setItem
    let emissions = 0
    store.subscribe(() => { emissions++ })
    Storage.prototype.setItem = function (key, value) {
      if (key === 'teth-client-experience') throw new Error('source entry storage failure')
      return nativeSet.call(this, key, value)
    }
    let storageError = ''
    try { store.startConversation('저장되면 안 되는 질문') } catch (cause) { storageError = (cause as Error).message }
    Storage.prototype.setItem = nativeSet
    return {
      firstId, busyError, busyIdentity: busyBefore === busyAfter, busyRawUnchanged,
      busyCount: busyAfter.sessions.length, durableIdentity: durableBefore === store.getSnapshot(), durableRawUnchanged: durableRaw === sessionStorage.getItem('teth-client-experience'),
      storageError, emissions, final: structuredClone(store.getSnapshot()),
    }
  })
  expect(result.busyError).toContain('이전 답변')
  expect(result.busyIdentity).toBe(true)
  expect(result.busyRawUnchanged).toBe(true)
  expect(result.busyCount).toBe(1)
  expect(result.storageError).toContain('새 대화를 저장하지 못했어요')
  expect(result.durableIdentity).toBe(true)
  expect(result.durableRawUnchanged).toBe(true)
  expect(result.emissions).toBe(0)
  expect(result.final.currentId).toBe(result.firstId)
  expect(result.final.sessions).toHaveLength(1)
  expect(result.final.homeDraft).toBe('보존할 홈 초안')
})

test('관망 gate가 인사이트 질문을 거절하면 dialog 입력·경로·대화 원장을 보존한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.addInitScript(owner => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'source 진입 검수', email: owner }))
  }, owner)
  await page.goto('/')
  const homeDraft = '홈에서 아직 보내지 않은 source 초안'
  await page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요', exact: true }).fill(homeDraft)
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).homeDraft)).toBe(homeDraft)
  const watch = await page.evaluate(async owner => {
    const path = '/src/client-billing-preview-store.ts'
    const { createBillingPreviewStore } = await import(/* @vite-ignore */ path)
    const result = createBillingPreviewStore(owner).dispatch({ kind: 'qa-watch' }, Date.now(), 'source-entry-watch')
    window.dispatchEvent(new Event('pageshow'))
    return result
  }, owner)
  expect(watch.ok).toBe(true)
  await page.evaluate(() => { location.hash = '/insight/bitcoin-miner-cashflow' })
  await page.locator('.nfz-ast').first().click()
  const dialog = page.getByRole('dialog')
  const extra = '이 추가 질문은 gate 거절 뒤에도 남아야 해요'
  await dialog.getByRole('textbox', { name: '추가로 궁금한 점', exact: true }).fill(extra)
  const before = await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))
  const hash = await page.evaluate(() => location.hash)
  await dialog.getByRole('button', { name: 'TETH에게 물어보기', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '추가로 궁금한 점', exact: true })).toHaveValue(extra)
  await expect(dialog.getByRole('alert')).toHaveText('크레딧이 소진되어 AI 기능이 잠시 멈춰 있어요')
  expect(await page.evaluate(() => location.hash)).toBe(hash)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(before)
  expect(JSON.parse(before!).sessions).toHaveLength(0)
})

test('읽지 못한 기존 원장은 새 source 질문으로 덮어쓰거나 복구 완료로 표시하지 않는다', async ({ page }) => {
  await blank(page)
  const result = await page.evaluate(async () => {
    const raw = '{"sessions":[{"id":"preserve-truncated-record"'
    sessionStorage.setItem('teth-client-experience', raw)
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore(), before = store.getSnapshot()
    let count = 0, error = ''
    store.subscribe(() => count++)
    try { store.startConversation('기존 원장을 덮으면 안 되는 질문') } catch (cause) { error = (cause as Error).message }
    return { count, error, same: before === store.getSnapshot(), rawSame: raw === sessionStorage.getItem('teth-client-experience'), storageError: store.getSnapshot().storageError }
  })
  expect(result).toEqual({ count: 0, error: '기존 대화 기록을 확인한 뒤 다시 시도해주세요.', same: true, rawSame: true, storageError: true })
})

test('보존된 구 인라인 검증 대기 중에는 답변 완료 이후에도 새 source 대화를 시작하지 않는다', async ({ page }) => {
  await blank(page)
  const result = await page.evaluate(async () => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const original = createClientExperienceStore()
    original.send('ETH 추세 1시간봉 손절 5%, 익절 12%')
    original.tick(Date.now() + 100_000)
    // New turns intentionally use the explicit common backtest route. This
    // guard covers old persisted inline jobs, not an unstarted common preview.
    const legacy = structuredClone(original.getSnapshot())
    delete legacy.sessions[0].turns[0].backtestFlow
    sessionStorage.setItem('teth-client-experience', JSON.stringify(legacy))
    const store = createClientExperienceStore()
    const before = store.getSnapshot(), raw = sessionStorage.getItem('teth-client-experience')
    let error = ''
    try { store.startConversation('다른 인사이트 질문') } catch (cause) { error = (cause as Error).message }
    return { error, unchanged: before === store.getSnapshot(), rawUnchanged: raw === sessionStorage.getItem('teth-client-experience'), session: before.sessions[0] }
  })
  expect(result.session.turns[0].status).toBe('done')
  expect(result.session.turns[0].inlineRequest).toBeDefined()
  expect(result.session.inlineResults ?? []).toHaveLength(0)
  expect(result.error).toContain('이전 답변')
  expect(result.unchanged).toBe(true)
  expect(result.rawUnchanged).toBe(true)
})

test('공통 백테스트 시작 전에는 원 조건을 보존하고 다른 source 대화를 열 수 있다', async ({page})=>{
  await blank(page)
  const result=await page.evaluate(async()=>{
    const path='/src/client-experience-store.ts', {createClientExperienceStore}=await import(path)
    const store=createClientExperienceStore()
    store.send('ETH 추세 1시간봉 손절 5%, 익절 12%');store.tick(Date.now()+100_000)
    const previous=structuredClone(store.getSnapshot().sessions[0])
    const id=store.startConversation('다른 인사이트 질문')
    return {previous,current:store.getSnapshot().currentId,id,preserved:store.getSnapshot().sessions.find(s=>s.id===previous.id)}
  })
  expect(result.previous.turns[0].backtestFlow).toBe('common')
  expect(result.current).toBe(result.id)
  expect(result.current).not.toBe(result.previous.id)
  expect(result.preserved).toEqual(result.previous)
})

test('인사이트 새 대화 저장 실패는 입력·기사에 남고 명시 재시도만 한 세션을 생성한다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'QA', email: 'save-entry@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ sessions: [], sharedFollows: [], currentId: null, homeDraft: '기존 홈 초안', storageError: false }))
  })
  await page.goto('/#/insight/bitcoin-miner-cashflow')
  await page.locator('.nfz-ast').first().click()
  const dialog = page.getByRole('dialog'), extra = '저장 실패 뒤에도 이 질문은 보존'
  await dialog.getByRole('textbox').fill(extra)
  const before = await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.assign(window, { restoreSourceStorage: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) {
      if (key === 'teth-client-experience') throw new Error('PRIVATE_STORAGE_DIAGNOSTIC')
      return original.call(this, key, value)
    }
    return sessionStorage.getItem('teth-client-experience')
  })
  await dialog.getByRole('button', { name: 'TETH에게 물어보기', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('작성한 내용은 유지됩니다')
  await expect(dialog).not.toContainText('PRIVATE_STORAGE_DIAGNOSTIC')
  await expect(dialog.getByRole('textbox')).toHaveValue(extra)
  expect(await page.evaluate(() => location.hash)).toBe('#/insight/bitcoin-miner-cashflow')
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(before)
  await page.evaluate(() => Reflect.get(window, 'restoreSourceStorage')())
  await dialog.getByRole('button', { name: 'TETH에게 물어보기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.g-umsg')).toHaveCount(1)
  await expect(page.locator('.g-umsg')).toContainText(extra)
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  expect(saved.sessions).toHaveLength(1)
  expect(saved.homeDraft).toBe('기존 홈 초안')
})
