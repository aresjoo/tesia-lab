import { expect, test, type Page } from '@playwright/test'
import { readSharedLocation, sharedHash } from '../src/client-shared-navigation'
import { accountTerminalText } from '../src/client-account-terminal-copy'
import { createCopyPreviewState, startCopyPreview, copyPreviewPairs } from '../src/client-copy-preview-state'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'
import { sourceSharedStrategies } from '../src/client-shared-strategies'

const owner = 'sharing-routes@example.test'
const preferenceKey = `teth-sharing-preferences:account:${encodeURIComponent(owner)}`
const preferences = { tab: 'mine', sort: 'fw', dir: 'desc', asset: 'all', market: 'crypto', kind: 'all' }
async function open(page: Page, hash = '#/share', guest = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, preferenceKey, preferences, guest }) => {
    if (sessionStorage.getItem('sharing-routes-fixture')) return
    sessionStorage.setItem('sharing-routes-fixture', '1')
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem(preferenceKey, JSON.stringify(preferences))
    if (!guest) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '경로 검수자', email: owner }))
  }, { owner, preferenceKey, preferences, guest })
  await page.goto('/' + hash)
}
async function terminal(page: Page) {
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  const agent = page.getByRole('tab', { name: accountTerminalText('ko', 'agent'), exact: true })
  if (await agent.isVisible()) await agent.click()
  await expect(page.locator('.client-terminal-copies')).toBeVisible()
}
async function seedTerminal(page: Page) {
  const source = sourceSharedStrategies()[0]
  const started = startCopyPreview(createCopyPreviewState(owner), { owner, id: 'route-copy', amount: 200, pairs: [copyPreviewPairs(source)[0]], mode: 'ratio', at: 1000 }, source)
  if (!started.ok) throw Error(started.message)
  await page.addInitScript(({ key, raw }) => {
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, raw)
  }, { key: copyPreviewStorageKey(owner), raw: JSON.stringify(started.state) })
}
test('관리 주소는 명시 해석하며 카탈로그·legacy 상세 식별과 충돌하지 않는다', () => {
  for (const section of ['library', 'publishing'] as const) {
    const location = { section, period: 'all' as const }
    expect(readSharedLocation(sharedHash(location))).toEqual(location)
    expect(readSharedLocation(`#/share/s/${section}`)).toEqual({ nick: section, period: 'all' })
  }
  for (const hash of ['#/share/library/extra', '#/share/publishing/extra', '#/share/library%2Fpublishing']) {
    expect(readSharedLocation(hash)).toEqual({ period: 'all' })
  }
})
test('저장된 내 전략 선택과 무관하게 목록을 열고 필터·원본 저장값을 유지한다', async ({ page }) => {
  await open(page)
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: '정렬 기준' })).toHaveValue('fw')
  await expect(page.locator('.tfbk-dropwrap button[aria-haspopup="listbox"]')).toContainText('가상자산')
  const search = page.getByRole('searchbox', { name: '전략 검색' })
  await search.fill('비트코인')
  await page.evaluate(() => { location.hash = '#/share/publishing' })
  await expect(page.locator('#research-title')).toHaveText('내 전략')
  await expect(page.locator('#research-title')).toBeFocused()
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await expect(page).toHaveURL(/#\/share$/)
  await expect(search).toHaveValue('비트코인')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual(preferences)
  await page.reload()
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('combobox', { name: '정렬 기준' })).toHaveValue('fw')
})
for (const width of [320, 1440]) test(`${width}px 터미널에서 보존 관리 화면 왕복·새로고침·브라우저 뒤로가기`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await seedTerminal(page); await open(page, '#/trade'); await terminal(page)
  for (const [name, section, title] of [['관심 전략', 'library', '따라가는 중'], ['내 전략', 'publishing', '내 전략']]) {
    await page.locator('.client-terminal-copies').getByRole('button', { name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`#/share/${section}$`))
    await expect(page.locator('#research-title')).toHaveText(title)
    await expect(page.locator('.ss3-tabs')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('#research-title')).toHaveText(title)
    await expect(page.locator(section === 'publishing' ? '.client-strategy-creator' : '.cpd')).toBeVisible()
    await expect(page.locator('#research-title')).toBeFocused()
    await page.screenshot({ path: info.outputPath(`${section}-${width}.png`) })
    await page.locator('.hub-header').getByRole('button', { name: '내 트레이딩', exact: true }).click()
    await terminal(page)
    await page.goBack()
    await expect(page.locator('#research-title')).toHaveText(title)
    await page.goForward(); await terminal(page)
  }
  await page.locator('.client-terminal-copies').getByRole('button', { name: '전략 더 찾기', exact: true }).click()
  await expect(page).toHaveURL(/#\/share$/)
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.strategy-list-grid')).toHaveAttribute('aria-busy', 'false')
  await page.screenshot({ path: info.outputPath(`list-${width}.png`) })
  expect(errors).toEqual([])
})
for (const width of [320, 1440]) test(`${width}px 원본 최후override 지연 로딩에도 벨은 숨기고 복귀 버튼 기하·클릭 영역을 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  let release!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/components/ClientStrategySharing.tsx*', async route => { await blocked; await route.continue() })
  try {
    await open(page, '#/share/publishing')
    await expect(page.getByText('전략 공유 화면을 불러오는 중이에요.', { exact: true })).toBeVisible()
    const button = page.locator('.hub-header > button')
    // Compare the same loaded font on both sides of the lazy chunk boundary.
    // font-display:swap can otherwise change the return label's width in flight.
    await button.evaluate(async node => {
      const text = node.textContent ?? '', font = getComputedStyle(node).font
      await document.fonts.load(font, text)
      await document.fonts.ready
    })
    expect(await button.evaluate(node => document.fonts.check(getComputedStyle(node).font, node.textContent ?? ''))).toBe(true)
    const bounds = await button.boundingBox()
    expect(bounds).not.toBeNull()
    await expect(page.locator('.client-account-utility')).toHaveCount(0)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(await button.evaluate(node => {
      const r = node.getBoundingClientRect()
      return [.15, .5, .85].map(fraction => node.contains(document.elementFromPoint(r.left + r.width * fraction, r.top + r.height / 2)))
    })).toEqual([true, true, true])
    release()
    await expect(page.locator('.client-strategy-creator')).toBeVisible()
    const loaded = await button.boundingBox()
    expect(loaded).toEqual(bounds)
  } finally { release() }
})
for (const section of ['library', 'publishing']) test(`비로그인 ${section} 직접 진입도 빈 화면 없이 목록으로 복귀한다`, async ({ page }) => {
  await open(page, `#/share/${section}`, true)
  await expect(page.locator('#research-title')).toHaveText(section === 'library' ? '따라가는 중' : '내 전략')
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-profile-preview'))).toBeNull()
})
