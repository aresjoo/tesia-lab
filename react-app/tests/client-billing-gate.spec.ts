import { revealSourceNavigation } from './fixtures/source-offline-research-entry'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { billingPreviewStorageKey, createBillingPreviewStore, type BillingPreviewStoredNotification } from '../src/client-billing-preview-store'
import { billingPreviewBalance, billingPreviewMonthSpend, type BillingPreviewState } from '../src/client-billing-preview-state'

const owner = 'billing-gate@example.test', otherOwner = 'billing-other@example.test'
const key = billingPreviewStorageKey(owner), profileKey = 'teth-client-profile-preview', experienceKey = 'teth-client-experience'
const now = Date.UTC(2026, 8, 16, 12), day = Math.floor(now / 864e5)
const fullUsageNotice = '이번 달 AI 사용량을 모두 써서 새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.'
type Envelope = { v: 1; owner: string; state: BillingPreviewState; notifications: BillingPreviewStoredNotification[] }

/** Obtain valid serialized fixtures through the actual preview store. Yesterday's
 * notices let today's blocked action exercise daily notification dedup independently.
 */
function fixture(watch = true): string {
  const values = new Map<string, string>()
  const store = createBillingPreviewStore(owner, { getItem: name => values.get(name) ?? null, setItem: (name, value) => { values.set(name, value) } })
  const welcome = store.dispatch({ kind: 'welcome' }, now - 864e5, 'fixture-welcome')
  if (!welcome.ok) throw new Error(welcome.error)
  if (watch) {
    const stopped = store.dispatch({ kind: 'qa-watch' }, now - 864e5, 'fixture-watch')
    if (!stopped.ok) throw new Error(stopped.error)
  }
  const raw = values.get(key)
  if (!raw) throw new Error('Missing store fixture')
  return raw
}
async function open(page: Page, options: { raw?: string; profile?: string | null; hash?: string } = {}) {
  await page.clock.install({ time: new Date(now) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ raw, selectedOwner, key, profileKey, experienceKey }) => {
    // Reload must read the state written by the app, not overwrite it with the seed.
    if (sessionStorage.getItem('billing-gate-fixture-initialized')) return
    sessionStorage.setItem('billing-gate-fixture-initialized', '1')
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem(key, raw)
    if (selectedOwner !== null) sessionStorage.setItem(profileKey, JSON.stringify({ name: '이용 상태 검수', email: selectedOwner }))
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: null, homeDraft: '', sessions: [], sharedFollows: [] }))
  }, { raw: options.raw ?? fixture(), selectedOwner: options.profile === undefined ? owner : options.profile, key, profileKey, experienceKey })
  await page.goto(`/${options.hash ?? ''}`)
  await expect(page.locator('.client-source-app')).toBeVisible()
}
const raw = (page: Page) => page.evaluate(key => sessionStorage.getItem(key), key)
const saved = async (page: Page): Promise<Envelope> => JSON.parse((await raw(page))!)
const experience = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? '{"sessions":[],"homeDraft":""}'), experienceKey)
const input = (page: Page) => page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요', exact: true })
async function ask(page: Page, text: string) {
  await input(page).fill(text)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
}
async function route(page: Page, hash: string) {
  await page.evaluate(hash => { history.pushState(null, '', hash); window.dispatchEvent(new Event('teth:navigate')) }, hash)
}
function requestAudit(page: Page) {
  const requests: string[] = []
  page.on('request', request => {
    if (request.method() !== 'GET' || /\/(?:api|v[0-9]+|oauth|payments|orders)\//.test(new URL(request.url()).pathname)) requests.push(`${request.method()} ${request.url()}`)
  })
  return requests
}

test('watch 홈전송은초안보존·세션생성0이며reload후에도같은원장과관망을유지한다', async ({ page }) => {
  const requests = requestAudit(page)
  await open(page)
  await expect.poll(async () => (await saved(page)).state.mode).toBe('watch')
  const ledger = (await saved(page)).state.ledger
  const text = '이 초안은 관망 중에도 그대로 남아야 해요'
  await ask(page, text)
  await expect(page.locator('.client-global-notice')).toContainText(fullUsageNotice)
  expect(billingPreviewMonthSpend((await saved(page)).state, now)).toBe(100)
  expect(billingPreviewBalance((await saved(page)).state)).toBe(0)
  await expect(input(page)).toHaveValue(text)
  await expect(page.locator('.g-urow')).toHaveCount(0)
  await expect.poll(async () => (await experience(page)).homeDraft).toBe(text)
  expect((await experience(page)).sessions).toHaveLength(0)
  await page.reload()
  await expect(input(page)).toHaveValue(text)
  expect((await saved(page)).state.mode).toBe('watch')
  expect((await saved(page)).state.ledger).toEqual(ledger)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(input(page)).toHaveValue(text)
  expect((await experience(page)).sessions).toHaveLength(0)
  expect(requests).toEqual([])
})

test('blocked알림은동일일하나·다음날하나이며PLAN별칭과설정사용량은동일원장을보여준다', async ({ page }) => {
  const requests = requestAudit(page)
  await open(page)
  await ask(page, '같은 날 첫 요청')
  await ask(page, '같은 날 두 번째 요청')
  const todayKey = `bill.free.out:${day}`
  await expect.poll(async () => (await saved(page)).notifications.filter(record => record.intent.key === todayKey).length).toBe(1)
  await page.reload()
  await ask(page, '새로고침 후 같은 날 요청')
  expect((await saved(page)).notifications.filter(record => record.intent.key === todayKey)).toHaveLength(1)
  await route(page, '#/plan')
  await expect(page).toHaveURL(/#\/settings\/billing$/)
  await expect(page.getByRole('heading', { name: '결제', exact: true })).toBeVisible()
  expect((await saved(page)).state.mode).toBe('watch')
  await route(page, '#/settings/usage')
  await expect(page.getByRole('heading', { name: '사용량', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: '이번 달 AI 사용량', exact: true })).toHaveAttribute('aria-valuenow', '100')
  await expect(page.locator('.client-settings-usage .use-sub')).toContainText('새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.')
  await page.clock.setSystemTime(new Date(now + 864e5))
  await route(page, '#/')
  await expect(input(page)).toBeVisible()
  await ask(page, '다음 날 요청')
  expect((await saved(page)).notifications.filter(record => record.intent.key === `bill.free.out:${day + 1}`)).toHaveLength(1)
  expect((await saved(page)).notifications.filter(record => record.intent.key === todayKey)).toHaveLength(1)
  expect((await experience(page)).sessions).toHaveLength(0)
  expect(requests).toEqual([])
})

test('손상된과금저장원문은보존하고명시retry전에는정상복원데이터로도새요청을막는다', async ({ page }) => {
  const requests = requestAudit(page), broken = '{billing-corrupt:keep-this-exactly'
  await open(page, { raw: broken })
  const error = page.getByRole('alert').filter({ hasText: '이 브라우저의 이용 상태를 확인하지 못했어요.' })
  await expect(error).toBeVisible()
  await ask(page, '손상 복구 중에도 보존할 초안')
  await expect(input(page)).toHaveValue('손상 복구 중에도 보존할 초안')
  expect(await raw(page)).toBe(broken)
  expect((await experience(page)).sessions).toHaveLength(0)
  const repaired = fixture(false)
  await page.evaluate(({ key, repaired }) => sessionStorage.setItem(key, repaired), { key, repaired })
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  expect((await experience(page)).sessions).toHaveLength(0)
  await expect(error).toBeVisible()
  await error.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(error).toHaveCount(0)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-umsg')).toContainText('손상 복구 중에도 보존할 초안')
  await expect.poll(async () => (await experience(page)).sessions.length).toBe(1)
  expect(requests).toEqual([])
})

test('다른owner와guest는저장된타인watch상태를읽거나변경하지않는다', async ({ page }) => {
  const requests = requestAudit(page), original = fixture()
  await open(page, { raw: original, profile: otherOwner })
  await ask(page, '다른 계정은 자체 미리보기로 질문해요')
  await expect(page.locator('.g-umsg')).toContainText('다른 계정은 자체 미리보기로 질문해요')
  expect(await raw(page)).toBe(original)
  const other = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), billingPreviewStorageKey(otherOwner))
  expect(other.owner).toBe(otherOwner)
  expect(other.state.mode).toBe('active')
  await expect.poll(async () => (await experience(page)).sessions.length).toBe(1)
  // Conversation UI state is preserved independently of the preview identity.
  // Do not overwrite its storage behind the live store's debounced writer.
  await page.evaluate(profileKey => sessionStorage.removeItem(profileKey), profileKey)
  await page.reload()
  await expect(page.locator('.g-umsg')).toContainText('다른 계정은 자체 미리보기로 질문해요')
  if ((page.viewportSize()?.width ?? 1280) <= 860) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  else await page.locator('.client-rail-logo-row button').click()
  await page.getByRole('button', { name: 'TETH AI 홈', exact: true }).click()
  await expect(input(page)).toBeVisible()
  await ask(page, '게스트도 타인의 관망에 영향을 받지 않아요')
  await expect(page.locator('.g-umsg')).toContainText('게스트도 타인의 관망에 영향을 받지 않아요')
  expect(await raw(page)).toBe(original)
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), billingPreviewStorageKey(otherOwner))).toEqual(other)
  expect(requests).toEqual([])
})

test('유입으로복구한동일owner는새로고침없이보존초안을보내고지난차단안내를지운다', async ({ page }) => {
  const requests = requestAudit(page)
  await open(page)
  const draft = '관망 해제 후 이어 보낼 원래 초안'
  await ask(page, draft)
  const result = await page.evaluate(async owner => {
    const path = '/src/client-billing-preview-store.ts'
    const { createBillingPreviewStore } = await import(/* @vite-ignore */ path)
    return createBillingPreviewStore(owner).dispatch({ kind: 'qa-topup' }, Date.now(), 'integration-recovery')
  }, owner)
  expect(result.ok).toBe(true)
  await expect(input(page)).toHaveValue(draft)
  expect((await saved(page)).state.mode).toBe('active')
  // Source aiMeter FREE math: used100 / (used100 + remaining100) = 50%.
  // The separate store writer must be observed by the FIRST explicit send.
  expect(billingPreviewMonthSpend((await saved(page)).state, now)).toBe(100)
  expect(billingPreviewBalance((await saved(page)).state)).toBe(100)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-umsg')).toHaveText(draft)
  await expect(page.locator('.client-global-notice').filter({ hasText: fullUsageNotice })).toHaveCount(0)
  expect((await saved(page)).notifications.some(record => record.intent.titleKey === 'bill.recover.t')).toBe(true)
  expect(requests).toEqual([])
})

test('80%사용량은경고만표시하고첫요청을허용하며조회·전송이원장사용량을꾸며내지않는다', async ({ page }) => {
  const requests = requestAudit(page), values = new Map([[key, fixture(false)]])
  const store = createBillingPreviewStore(owner, { getItem: name => values.get(name) ?? null, setItem: (name, value) => { values.set(name, value) } })
  expect(store.dispatch({ kind: 'qa-drain', ratio: .2 }, now - 864e5, 'fixture-80').ok).toBe(true)
  await open(page, { raw: values.get(key) })
  const before = (await saved(page)).state
  expect(billingPreviewMonthSpend(before, now)).toBe(80)
  expect(billingPreviewBalance(before)).toBe(20)
  await ask(page, '경고 구간에서 직접 보낼 질문')
  await expect(page.locator('.g-umsg')).toHaveText('경고 구간에서 직접 보낼 질문')
  await expect(page.locator('#g-usebar')).toContainText('이번 달 AI 사용량의 80%를 썼습니다.')
  await expect(page.locator('#g-usebar .use-x')).toBeVisible()
  expect((await saved(page)).state.ledger).toEqual(before.ledger)
  expect((await experience(page)).sessions).toHaveLength(1)
  expect(requests).toEqual([])
})

test('서비스엔트리에는공개미리보기과금게이트를직접연결하지않는다', () => {
  // Bounded dependency assertion: this does not claim a live service test.
  for (const path of ['ClientServiceExperience.tsx', 'NativeServiceApp.tsx', 'service-main.tsx']) {
    const source = readFileSync(new URL(`../src/internal-poc/${path}`, import.meta.url), 'utf8')
    expect(source, path).not.toMatch(/(?:use-billing-preview|client-billing-preview|useBillingPreview|previewBillingMode)/)
  }
})
