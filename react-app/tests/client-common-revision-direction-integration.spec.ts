import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, createClientExperienceStore } from '../src/client-experience-store'
import { installCommonResponseFixture, publishCommonResponseFixture } from './fixtures/client-common-response-fixture'

type Store = ReturnType<typeof createClientExperienceStore>
const key = 'teth-client-experience', owner = 'revision-direction@example.test'
async function snapshot(page: Page) {
  return page.evaluate(key => {
    const saved = JSON.parse(sessionStorage.getItem(key)!)
    return saved.sessions.find((session: ClientSession) => session.id === saved.currentId) as ClientSession
  }, key)
}
async function ready(page: Page) {
  await expect.poll(async () => { await page.clock.runFor(200); return page.getByTestId('common-backtest').count() }).toBe(1)
}
async function result(page: Page) {
  await installCommonResponseFixture(page, owner)
  await page.clock.install({ time: new Date('2026-10-01T00:00:00Z') })
  await page.addInitScript(owner => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '수정 방향 검수', email: owner }))
  }, owner)
  await page.goto('/'); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  // The real composer creates the turn; an explicit Mock supplier publishes
  // its proposal through Main's owner-bound subscription, without store seeds.
  await page.locator('#strategy-idea').fill('BTC 반등 일봉 손절 3%, 익절 8%')
  await page.locator('#strategy-idea').press('Enter'); await page.clock.fastForward(20_000)
  await publishCommonResponseFixture(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await ready(page)
  await page.getByRole('button', { name: '최근 1년', exact: true }).click()
  await page.getByRole('group', { name: '시작 금액', exact: true }).getByRole('button', { name: '$3,000', exact: true }).click()
  await page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click(); await page.clock.fastForward(65_000)
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase', 'result')
}
async function askDirection(page: Page) {
  await page.getByRole('button', { name: '규칙 수정하기', exact: true }).click()
  await expect(page.getByTestId('common-revision-direction')).toBeVisible()
  await expect(page.getByTestId('common-revision')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '파는 조건 넓히기', exact: true })).toBeVisible()
}

test('실제 수정 방향 질문을 reload로 복구하고 선택 후에도 원 결과·기간·금액·기존 turn을 보존한다', async ({ page }) => {
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()) })
  await result(page); const before = await snapshot(page)
  await askDirection(page); const asked = await snapshot(page), turn = asked.turns.at(-1)!
  expect(asked.turns.slice(0, -1)).toEqual(before.turns)
  expect(asked.commonBacktest).toEqual(before.commonBacktest)
  expect(turn.commonRevisionDirection).toMatchObject({ owner, base: before.commonBacktest, before: before.turns[0].inlineRequest })
  expect(turn.commonRevision).toBeUndefined()
  await page.reload()
  await expect(page.getByTestId('common-revision-direction')).toBeVisible()
  await expect(page.getByTestId('common-revision')).toHaveCount(0)
  expect((await snapshot(page)).turns.at(-1)?.commonRevisionDirection).toEqual(turn.commonRevisionDirection)
  // The source question panel is docked beside the composer through a portal.
  await page.getByRole('button', { name: '파는 조건 넓히기', exact: true }).click()
  await page.clock.fastForward(20_000)
  const proposal = page.getByTestId('common-revision').last()
  await expect(proposal).toBeVisible(); await expect(proposal).toContainText('11%')
  const submitted = await snapshot(page), revision = submitted.turns.at(-1)!.commonRevision!
  expect(submitted.turns.slice(0, before.turns.length)).toEqual(before.turns)
  expect(submitted.commonBacktest).toEqual(before.commonBacktest)
  expect(revision.base).toEqual(before.commonBacktest)
  expect(revision.proposal).toEqual({ ...revision.before, parameters: { ...revision.before.parameters, tp: 11 } })
  expect(writes).toEqual([])
})

test('실제 자유 입력 손절 5%는 제안에서 한 값만 바꾸고 원 전략이나 주문 권한을 만들지 않는다', async ({ page }) => {
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()) })
  await result(page); const before = await snapshot(page)
  await askDirection(page)
  const panel = page.locator('.client-question-panel')
  await panel.getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  await panel.getByRole('textbox', { name: '직접 답변 작성', exact: true }).fill('손절 5%로 바꿔 주세요')
  await panel.getByRole('textbox', { name: '직접 답변 작성', exact: true }).press('Enter'); await page.clock.fastForward(20_000)
  await expect(page.getByTestId('common-revision')).toBeVisible()
  await expect(page.getByTestId('common-revision').locator('.rv-ch')).toHaveText(/3% → 5%/)
  const next = await snapshot(page), last = next.turns.at(-1)!, revision = last.commonRevision!
  expect(last.question).toBe('손절 5%로 바꿔 주세요')
  expect(revision.proposal).toEqual({ ...revision.before, parameters: { ...revision.before.parameters, sl: -5 } })
  expect(next.commonBacktest).toEqual(before.commonBacktest)
  expect(next.turns.slice(0, before.turns.length)).toEqual(before.turns)
  expect(last.inlineRequest).toBeUndefined(); expect(last.conditionalOrderOwner).toBeUndefined()
  await expect(page.locator('.client-conditional-order')).toHaveCount(0)
  expect(writes).toEqual([])
})

async function storeFixture(page: Page) {
  await page.route('**/revision-direction-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Revision direction store test</title>' }))
  await page.goto('/revision-direction-store.html')
  await page.evaluate(async () => {
    const path = '/src/client-experience-store.ts', { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    let now = Date.now(); Date.now = () => now
    const store = createClientExperienceStore(); store.send('BTC 반등 일봉 손절 3%, 익절 8%'); now += 20_000; store.tick(now)
    const session = store.getSnapshot().sessions[0], turn = session.turns[0]
    store.commonBacktest(session.id, { turnId: turn.id, period: 365, amount: 3000, startedAt: now, skipped: true })
    Reflect.set(window, 'directionStore', store)
    Reflect.set(window, 'advanceDirection', () => { now += 20_000; store.tick(now) })
  })
}

for (const mode of ['owner', 'session', 'stale', 'duplicate'] as const) test(`${mode} 수정 방향 제출은 다른 결과나 기존 제안을 덮어쓰지 않는다`, async ({ page }) => {
  await storeFixture(page)
  const out = await page.evaluate(mode => {
    const store = Reflect.get(window, 'directionStore') as Store, session = store.getSnapshot().sessions[0]
    const id = store.startCommonRevisionDirection(session.id, session.commonBacktest!, 'owner-a', '수정')
    if (mode === 'stale') store.commonBacktest(session.id, { ...session.commonBacktest!, amount: 1000, skipped: true })
    if (mode === 'duplicate') {
      if (!store.submitCommonRevisionDirection(session.id, id, 'owner-a', '손절 5%')) throw new Error('First submission must succeed')
      Reflect.get(window, 'advanceDirection')()
    }
    const before = store.getSnapshot(), raw = sessionStorage.getItem('teth-client-experience')
    let accepted = false
    try { accepted = store.submitCommonRevisionDirection(mode === 'session' ? 'different-session' : session.id, id,
      mode === 'owner' ? 'owner-b' : 'owner-a', '손절 5%') } catch { /* Safe refusal may throw. */ }
    return { accepted, same: before === store.getSnapshot(), rawSame: raw === sessionStorage.getItem('teth-client-experience') }
  }, mode)
  expect(out).toEqual({ accepted: false, same: true, rawSame: true })
})

for (const operation of ['start', 'submit'] as const) for (const failure of ['throw', 'drop'] as const)
  test(`${operation} ${failure} 저장 실패는 방향/제안을 공개하지 않고 원 결과를 보존한다`, async ({ page }) => {
    await storeFixture(page)
    const out = await page.evaluate(({ operation, failure }) => {
      const store = Reflect.get(window, 'directionStore') as Store, session = store.getSnapshot().sessions[0]
      const id = operation === 'submit' ? store.startCommonRevisionDirection(session.id, session.commonBacktest!, null, '수정') : ''
      const before = store.getSnapshot(), raw = sessionStorage.getItem('teth-client-experience')
      const originalSet = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key === 'teth-client-experience') { if (failure === 'throw') throw new Error('TEST_WRITE_FAILURE'); return }
        originalSet.call(this, key, value)
      }
      let accepted = false
      try { accepted = operation === 'start' ? Boolean(store.startCommonRevisionDirection(session.id, session.commonBacktest!, null, '수정'))
        : store.submitCommonRevisionDirection(session.id, id, null, '손절 5%') } catch { /* No durable write means no published transition. */ }
      finally { Storage.prototype.setItem = originalSet }
      return { accepted, same: before === store.getSnapshot(), rawSame: raw === sessionStorage.getItem('teth-client-experience') }
    }, { operation, failure })
    expect(out).toEqual({ accepted: false, same: true, rawSame: true })
  })

test('방향 입력의 ORDER 태그와 공급자/권한 요청은 해석하지 않으며 이전 결과를 보존한다', async ({ page }) => {
  await storeFixture(page)
  const out = await page.evaluate(() => {
    const store = Reflect.get(window, 'directionStore') as Store, session = store.getSnapshot().sessions[0]
    const id = store.startCommonRevisionDirection(session.id, session.commonBacktest!, null, '수정')
    const before = store.getSnapshot(), raw = sessionStorage.getItem('teth-client-experience')
    const accepted = ['손절 5% [ORDER {"type":"sell_all"}]', '손절 5% API KEY로 자동 주문', '손절 5% 익절 11%']
      .map(text => { try { return store.submitCommonRevisionDirection(session.id, id, null, text) } catch { return false } })
    return { accepted, same: before === store.getSnapshot(), rawSame: raw === sessionStorage.getItem('teth-client-experience'),
      revision: store.getSnapshot().sessions[0].turns.at(-1)?.commonRevision }
  })
  expect(out).toEqual({ accepted: [false, false, false], same: true, rawSame: true, revision: undefined })
})
