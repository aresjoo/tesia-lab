import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'

const key = 'teth-client-experience', draft = '보내지 않은 나의 질문', owner = 'lazy-sharing@example.test'
const turns: ClientTurn[] = Array.from({ length: 16 }, (_, index) => {
  const answer = `시장 관측 ${index}\n\n` + '제공된 자료의 시점과 위험을 함께 살펴봅니다.\n\n'.repeat(5)
  return { id: `turn-${index}`, question: index === 5 ? '공유 전략 찾아줘' : `시장 질문 ${index}`, answer, fullAnswer: answer,
    status: 'done', phase: 'plan', suggestions: [], startedAt: 1700000000000, finishedAt: 1700000001000 }
})
const initial: ClientSession = { id: 'lazy-sharing-conversation', title: '공유 탐색 검수', renamed: true, idea: '다른 전략 알아보기', draft,
  pair: 'BTC/USDT', mode: 'dip', timeframe: '1시간봉', risk: '-3%', takeProfit: '+8%', phase: 'plan', researchStatus: '초안',
  workspace: 'conversation', tradingReady: false, updatedAt: 1700000001000, turns }

async function frames(page: Page) {
  // Native RAF and StrictMode remain enabled. No fake clock or artificial sleep.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}
async function setup(page: Page) {
  let release!: () => void, reached!: () => void
  const hold = new Promise<void>(resolve => { release = resolve }), requested = new Promise<void>(resolve => { reached = resolve })
  await page.route('**/src/components/ClientStrategySharing.tsx', async route => { reached(); await hold; await route.continue() })
  await page.addInitScript(({ initial, key, owner }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '공유 검수', email: owner }))
    localStorage.setItem(`teth-sharing-preferences:account:${encodeURIComponent(owner)}`, JSON.stringify({ tab: 'mine', sort: 'ret', dir: 'desc', asset: 'all' }))
    sessionStorage.setItem(key, JSON.stringify({ currentId: initial.id, sessions: [initial], homeDraft: '', sharedFollows: [] }))
    const events: { event: string; target: string; key?: string }[] = []
    Reflect.set(window, '__sharingFocusEvents', events)
    for (const type of ['focusin', 'keydown', 'click']) document.addEventListener(type, event => {
      const target = event.target
      if (target instanceof HTMLElement) events.push({ event: type, target: `${target.tagName}#${target.id}.${target.className}`, key: event instanceof KeyboardEvent ? event.key : undefined })
    }, true)
  }, { initial, key, owner })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  const chip = page.locator('.client-share-browse button')
  await chip.scrollIntoViewIfNeeded(); await frames(page)
  const scroll = await page.locator('.g-scroll').evaluate(el => el.scrollTop)
  expect(scroll).toBeGreaterThan(100)
  await chip.click()
  await requested
  await expect(page.getByRole('status')).toHaveText('전략 공유 화면을 불러오는 중이에요.')
  await expect(page.locator('#research-title')).toBeFocused()
  return { release, scroll, chip }
}
async function returned(page: Page, scroll: number) {
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page).not.toHaveURL(/#\/share/)
  await expect.poll(() => page.locator('.g-scroll').evaluate((el, offset) => Math.abs(el.scrollTop - offset), scroll)).toBeLessThanOrEqual(40)
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
  expect(saved.turns).toEqual(turns); expect(saved.draft).toBe(draft)
}

test('로딩 중 실제 Tab으로 선택한 복귀 버튼은 lazy 장착 후에도 초점과 Enter 한 번을 보존한다', async ({ page }, info) => {
  const posts: string[] = []; page.on('request', r => { if (r.method() !== 'GET') posts.push(r.method()) })
  const { release, scroll } = await setup(page)
  try {
    const back = page.getByRole('button', { name: '대화로 돌아가기', exact: true })
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused(); await expect(back).toBeInViewport()
    release()
    await expect(page.locator('.strategy-list-grid')).toBeAttached()
    await frames(page)
    await info.attach('focus-after-lazy-mount', { body: JSON.stringify(await page.evaluate(() => ({ active: document.activeElement?.tagName + '#' + document.activeElement?.id, events: Reflect.get(window, '__sharingFocusEvents') }))), contentType: 'application/json' })
    // Soft assertion allows recording the actual single key's target and return result.
    expect.soft(await back.evaluate(el => el === document.activeElement), 'loading must not steal a user-selected return action').toBe(true)
    await page.keyboard.press('Enter')
    await info.attach('single-enter-events', { body: JSON.stringify(await page.evaluate(() => Reflect.get(window, '__sharingFocusEvents'))), contentType: 'application/json' })
    await returned(page, scroll)
    expect(posts).toEqual([])
  } finally { release() }
})

test('사용자 선택이 없으면 초기 제목 초점과 다음 탐색의 제목 초점을 유지한다', async ({ page }) => {
  const { release, scroll, chip } = await setup(page)
  try {
    release()
    await expect(page.locator('.strategy-list-grid')).toBeAttached(); await frames(page)
    await expect(page.locator('#research-title')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '대화로 돌아가기', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await returned(page, scroll)
    await chip.click()
    await expect(page.locator('#research-title')).toBeFocused()
  } finally { release() }
})

test('같은 헤더가 남는 브라우저 앞으로 이동은 이전 경로의 선택 대신 새 보관함 제목으로 이동한다', async ({ page }) => {
  const { release } = await setup(page)
  try {
    release()
    await expect(page.locator('.strategy-list-grid')).toHaveAttribute('aria-busy', 'false')
    // Same-document address/history navigation is supported by the public router.
    // Use its persistent H1, independent of asynchronous strategy-detail data.
    await page.goto('/#/share/library')
    await expect(page.locator('#research-title')).toHaveText('따라가는 중')
    await expect(page.locator('#research-title')).toBeFocused()
    const libraryUrl = page.url()
    await page.goBack()
    await expect(page.locator('#research-title')).toBeFocused()
    await page.keyboard.press('Tab')
    const back = page.getByRole('button', { name: '대화로 돌아가기', exact: true })
    await expect(back).toBeFocused()
    await page.goForward()
    await expect(page).toHaveURL(libraryUrl)
    await expect(page.locator('#research-title')).toHaveText('따라가는 중')
    await expect(page.locator('#research-title')).toBeFocused()
  } finally { release() }
})
