import { expect, test, type Page } from '@playwright/test'
import { clientResearchRegistration } from '../src/client-research-registration'
import { createClientUserStrategyStore, clientUserStrategyKey } from '../src/client-user-strategy-store'

// Actual Main + auth dialog + account-bound preview store. These registrations
// are local source-preview records, not authentication or execution authority.
const id = 'research-auth-base', otherId = 'research-auth-other'
const owner = 'research-auth@example.test', otherOwner = 'another-owner@example.test'
const ownerKey = clientUserStrategyKey(owner), otherOwnerKey = clientUserStrategyKey(otherOwner)
const experienceKey = 'teth-client-experience'

function registrationBytes(kind: 'empty' | 'other-origin' | 'paused') {
  const data = new Map<string, string>()
  const port = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const store = createClientUserStrategyStore(owner, port)
  if (kind !== 'empty') {
    const record = store.register(id, { ...clientResearchRegistration(), name: '기존 이름 유지', origin: kind === 'paused' ? 'research' : 'delegation' }, 1000)
    if (kind === 'paused') store.control(record.id, 'pause')
    // The selected research must not fall back to the most recent other record.
    store.register('unrelated-owner-session', { ...clientResearchRegistration(), name: '다른 전략', origin: 'delegation' }, 2000)
  }
  createClientUserStrategyStore(otherOwner, port).register(id, { ...clientResearchRegistration(), name: '다른 계정의 기록' }, 3000)
  return Object.fromEntries(data)
}

async function setup(page: Page, kind: 'empty' | 'other-origin' | 'paused' = 'empty') {
  const bytes = registrationBytes(kind)
  const posts: string[] = [], errors: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') posts.push(`${request.method()} ${request.url()}`) })
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ bytes, id, otherId, ownerKey, experienceKey }) => {
    if (!sessionStorage.getItem('research-auth-seeded')) {
      sessionStorage.setItem('research-auth-seeded', '1')
      localStorage.setItem('tethCurrency', 'KRW'); localStorage.setItem('tethLang', 'ko')
      sessionStorage.removeItem('teth-client-profile-preview')
      Object.entries(bytes).forEach(([key, value]) => sessionStorage.setItem(key, value))
      sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: id, homeDraft: '홈 초안 유지', sharedFollows: [],
        sessions: [id, otherId].map((sessionId, index) => ({ id: sessionId, title: index ? '다른 연구 대화' : '가입 전 연구 대화',
          idea: '비트코인 과매도 반등', draft: `${sessionId} 대화 초안`, pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉',
          risk: '−3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: index + 1 })) }))
      for (const sessionId of [id, otherId]) {
        sessionStorage.setItem(`teth-research-preview:restored:${sessionId}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
        sessionStorage.setItem(`teth-client-research-documents:${sessionId}`, JSON.stringify({ active: 'run', tabs: ['report', 'run'],
          drafts: { run: `${sessionId} 실행 질문` }, paper: false, paused: false }))
      }
    }
    const set = Storage.prototype.setItem, writes: string[] = []
    Storage.prototype.setItem = function (key, value) { if (key === ownerKey) writes.push(value); set.call(this, key, value) }
    Object.assign(window, { researchAuthWrites: writes })
  }, { bytes, id, otherId, ownerKey, experienceKey })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '가상 검증으로 시작', exact: true })).toBeVisible()
  return { bytes, posts, errors }
}

async function beginPending(page: Page) {
  await page.getByRole('button', { name: '가상 검증으로 시작', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await expect(page.locator('#root')).toHaveAttribute('inert')
  await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(owner)
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '코드', exact: true })).toBeVisible()
}
async function finishLogin(page: Page) {
  await page.getByRole('textbox', { name: '코드', exact: true }).fill('123456')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
}
async function openSidebar(page: Page) {
  const home = page.locator('.client-sidebar .client-drawer-brand').getByRole('button', { name: 'TETH AI 홈', exact: true })
  if (!await home.isVisible()) {
    await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  }
  await expect(home).toBeVisible()
}
async function saved(page: Page) {
  return page.evaluate(({ ownerKey, otherOwnerKey, experienceKey }) => ({
    raw: sessionStorage.getItem(ownerKey), otherRaw: sessionStorage.getItem(otherOwnerKey),
    writes: Reflect.get(window, 'researchAuthWrites') as string[],
    experience: JSON.parse(sessionStorage.getItem(experienceKey)!),
    profile: JSON.parse(sessionStorage.getItem('teth-client-profile-preview') || 'null'),
  }), { ownerKey, otherOwnerKey, experienceKey })
}

test('게스트의 완료된 base 연구는 이메일 인증 완료 후 정확히 한 번 등록하고 해당 기록을 선택한다', async ({ page }) => {
  const { bytes, posts, errors } = await setup(page)
  await beginPending(page)
  expect((await saved(page)).raw).toBeNull()
  await finishLogin(page)
  await expect(page).toHaveURL(/#\/trade$/)
  const after = await saved(page), entries = JSON.parse(after.raw!)
  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({ sessionId: id, record: clientResearchRegistration() })
  expect(after.writes).toHaveLength(1)
  expect(after.profile.email).toBe(owner)
  expect(after.otherRaw).toBe(bytes[otherOwnerKey])
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${entries[0].record.id}`)
  expect(after.experience.sessions.find((s: { id: string }) => s.id === id)).toMatchObject({ workspace: 'research', tradingReady: true, draft: `${id} 대화 초안` })
  await page.goBack()
  await expect(page.getByLabel('실행 확인에 질문')).toHaveValue(`${id} 실행 질문`)
  await page.getByRole('button', { name: 'AI 트레이딩에서 열기', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${entries[0].record.id}`)
  expect((await saved(page)).raw).toBe(after.raw)
  await page.reload()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  expect((await saved(page)).raw).toBe(after.raw)
  expect(posts).toEqual([]); expect(errors).toEqual([])
})

test('인증으로 복원된 계정의 다른 origin 기록은 연구 pending 등록이 덮어쓰거나 자동 선택하지 않는다', async ({ page }) => {
  const { bytes, posts, errors } = await setup(page, 'other-origin')
  await beginPending(page)
  await finishLogin(page)
  await expect(page.locator('.client-global-notice').filter({ hasText: '이 대화에는 다른 전략이 등록되어 있어요. AI 트레이딩에서 확인해주세요.' })).toBeVisible()
  await expect(page).not.toHaveURL(/#\/trade/)
  await expect(page.locator('.client-account-terminal')).not.toBeVisible()
  await expect(page.getByLabel('실행 확인에 질문')).toHaveValue(`${id} 실행 질문`)
  const after = await saved(page)
  expect(after.raw).toBe(bytes[ownerKey]); expect(after.otherRaw).toBe(bytes[otherOwnerKey]); expect(after.writes).toEqual([])
  expect(after.experience.sessions.find((s: { id: string }) => s.id === id).tradingReady).not.toBe(true)
  expect(posts).toEqual([]); expect(errors).toEqual([])
})

test('인증 후 기존 일시정지 연구를 exact 선택하며 상태·이름·다른 등록을 변경하지 않는다', async ({ page }) => {
  const { bytes, posts, errors } = await setup(page, 'paused')
  const previous = JSON.parse(bytes[ownerKey]), research = previous.find((entry: { sessionId: string }) => entry.sessionId === id)
  await beginPending(page)
  await finishLogin(page)
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${research.record.id}`)
  await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible()
  const after = await saved(page)
  expect(after.raw).toBe(bytes[ownerKey]); expect(after.otherRaw).toBe(bytes[otherOwnerKey]); expect(after.writes).toEqual([])
  expect(research.record).toMatchObject({ name: '기존 이름 유지', status: 'off', origin: 'research' })
  await page.goBack()
  await expect(page.getByLabel('실행 확인에 질문')).toHaveValue(`${id} 실행 질문`)
  await page.getByRole('button', { name: 'AI 트레이딩에서 열기', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${research.record.id}`)
  await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible()
  expect((await saved(page)).raw).toBe(bytes[ownerKey])
  expect(posts).toEqual([]); expect(errors).toEqual([])
})

test('인증 대기 중 실제 경로 이탈은 pending을 버리고 홈에서 로그인해도 이전 연구를 등록하지 않는다', async ({ page }) => {
  const { bytes, posts, errors } = await setup(page)
  await beginPending(page)
  // Browser navigation is a supported event seam; no inert DOM is clicked and
  // no private Main state is replaced to manufacture an impossible stale scope.
  await page.evaluate(() => { history.pushState(null, '', '#research-auth-navigation'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
  await openSidebar(page)
  await page.locator('.client-sidebar .client-drawer-brand').getByRole('button', { name: 'TETH AI 홈', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toHaveValue('홈 초안 유지')
  await page.locator('.client-login').click()
  await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(owner)
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await finishLogin(page)
  const after = await saved(page)
  expect(after.raw).toBeNull(); expect(after.writes).toEqual([]); expect(after.otherRaw).toBe(bytes[otherOwnerKey])
  // The original header login submits the current composer draft after auth.
  // That normal new conversation must not resume the cancelled research run.
  expect([id, otherId]).not.toContain(after.experience.currentId)
  expect(after.experience.sessions).toHaveLength(3)
  expect(after.experience.sessions.find((session: { id: string }) => session.id === after.experience.currentId)).toMatchObject({ idea: '홈 초안 유지' })
  for (const sessionId of [id, otherId]) {
    expect(after.experience.sessions.find((session: { id: string }) => session.id === sessionId)).toMatchObject({ draft: `${sessionId} 대화 초안`, turns: [] })
  }
  await expect(page).not.toHaveURL(/#\/trade/)
  await expect(page.locator('.g-composer textarea')).toHaveValue('')
  expect(posts).toEqual([]); expect(errors).toEqual([])
})

test('owner A 로그아웃 후 같은 계정의 일반 트레이딩 진입은 과거 연구 선택 요청을 재생하지 않는다', async ({ page }) => {
  const { bytes, posts, errors } = await setup(page, 'paused')
  await beginPending(page); await finishLogin(page)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  await openSidebar(page)
  await page.locator('.client-sidebar [data-sidebar-action="profile-settings"]').click()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.locator('.client-login')).toBeVisible()
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  await page.locator('.client-login').click()
  await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(owner)
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await finishLogin(page)
  await openSidebar(page)
  await page.locator('.client-sidebar').getByRole('button', { name: 'AI 트레이딩', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:2000')
  const after = await saved(page)
  expect(after.raw).toBe(bytes[ownerKey]); expect(after.otherRaw).toBe(bytes[otherOwnerKey]); expect(after.writes).toEqual([])
  expect(posts).toEqual([]); expect(errors).toEqual([])
})
