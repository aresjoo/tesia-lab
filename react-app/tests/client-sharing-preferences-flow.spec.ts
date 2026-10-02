import { sourceSidebarNavigationLabel } from '../src/client-shell-copy'
import { expect, test, type Page } from '@playwright/test'
import preferenceCopy from '../src/client-sharing-preference-copy.json' with { type: 'json' }
import { upgradeText } from '../src/client-upgrade-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { catalogueStrategies } from '../src/client-catalogue'
import { sourceSharingNames } from './fixtures/source-sharing-page-helper'

const owner = 'sharing-preferences@example.test'
const otherOwner = 'sharing-preferences-other@example.test'
const keyFor = (identity = owner) => `teth-sharing-preferences:account:${encodeURIComponent(identity)}`
const defaults = { tab: 'find', sort: 'pick', dir: 'desc', asset: 'all' }
const errorCopy = '공유 화면의 선택을 저장하거나 불러오지 못했어요. 현재 선택은 유지됩니다.'
const clearErrorCopy = '공유 화면의 선택을 지우지 못했어요. 이 기기에 저장된 선택이 남아 있을 수 있어요.'
const original = { id: 'sharing-preferences-chat', title: '보존할 대화', renamed: true, idea: '원래 질문', draft: '원래 미전송 초안', pair: 'BTC/USDT', mode: 'trend', phase: 'plan', timeframe: '일봉', risk: '-3%', researchStatus: '초안', workspace: 'conversation', tradingReady: false, turns: [], updatedAt: 1 }
const trigger = (page: Page, label: string) => label === '정렬 기준' ? page.getByRole('combobox', { name: label, exact: true }) : page.getByRole('button', { name: new RegExp(`^${label}:`) })
type Options = { guest?: boolean; raw?: string; otherRaw?: string; failure?: 'get' | 'set' | 'remove' }
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function setup(page: Page, options: Options = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, original, options, key, otherKey }) => {
    if (!sessionStorage.getItem('sharing-preferences-fixture')) {
      sessionStorage.setItem('sharing-preferences-fixture', '1')
      localStorage.setItem('tethLang', 'ko')
      if (!options.guest) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '공유 선호 검수자', email: owner }))
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: original.id, homeDraft: '홈 초안', sessions: [original], sharedFollows: [] }))
      sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, '[]')
      sessionStorage.setItem(`teth-client-subscription-intent:account:${encodeURIComponent(owner)}`, JSON.stringify({ sessionId: original.id, cycle: 'month' }))
      const accountPreferences = JSON.stringify({ owner, prefs: { pos: true, loss: true, review: false, rebate: true, watch: false, chW: true, chK: false, chT: false, chM: false } })
      sessionStorage.setItem('teth-client-account-preferences', accountPreferences)
      sessionStorage.setItem(`teth-client-account-preferences:${encodeURIComponent(owner)}`, accountPreferences)
      if (options.raw !== undefined) localStorage.setItem(key, options.raw)
      if (options.otherRaw !== undefined) localStorage.setItem(otherKey, options.otherRaw)
    }
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
    const calls: { action: string; key: string }[] = []
    Object.assign(window, { sharingStorageFailure: options.failure, sharingStorageCalls: calls, readRawSharingPreference: () => get.call(localStorage, key) })
    Storage.prototype.getItem = function (target) { if (this === localStorage && target.startsWith('teth-sharing-preferences:')) { calls.push({ action: 'get', key: target }); if (target === key && Reflect.get(window, 'sharingStorageFailure') === 'get') throw new Error('fixture get failure') } return get.call(this, target) }
    Storage.prototype.setItem = function (target, value) { if (this === localStorage && target.startsWith('teth-sharing-preferences:')) { calls.push({ action: 'set', key: target }); if (target === key && Reflect.get(window, 'sharingStorageFailure') === 'set') throw new Error('fixture set failure') } return set.call(this, target, value) }
    Storage.prototype.removeItem = function (target) { if (this === localStorage && target.startsWith('teth-sharing-preferences:')) { calls.push({ action: 'remove', key: target }); if (target === key && Reflect.get(window, 'sharingStorageFailure') === 'remove') throw new Error('fixture remove failure') } return remove.call(this, target) }
  }, { owner, original, options, key: keyFor(), otherKey: keyFor(otherOwner) })
  await page.goto('/#/share')
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
}

async function pick(page: Page, label: string, option: string) {
  if (label === '정렬 기준') { await trigger(page, label).selectOption({ label: option }); return }
  await trigger(page, label).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

for (const dir of ['asc', 'desc'] as const) test(`원본 복사순 ${dir} 저장방향·3페이지를 소비하고 필터 변경은 첫 페이지로 복원한다`, async ({ page }) => {
  const initial = JSON.stringify({ ...defaults, sort: 'fw', dir, page: 3 })
  await setup(page, { raw: initial })
  const expected = [...catalogueStrategies].sort((a, b) => dir === 'asc' ? a.fw - b.fw : b.fw - a.fw)
  await expect(page.locator('.mk-pager [aria-current="page"]')).toHaveText('3')
  await expect(page.locator('.strategy-list-card h3')).toHaveText(expected.slice(20, 30).map(row => row.name))
  expect(await sourceSharingNames(page)).toEqual(expected.map(row => row.name))
  expect(await raw(page)).toBe(initial)
  await page.reload()
  await expect(page.locator('.mk-pager [aria-current="page"]')).toHaveText('3')
  // Browser scroll restoration can leave page-three controls above the fold.
  // Reveal the trigger before opening the scroll-dismissed source menu.
  await trigger(page, '시장').scrollIntoViewIfNeeded()
  await trigger(page, '시장').click()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('.mk-pager [aria-current="page"]')).toHaveText('1')
  expect(JSON.parse(await raw(page))).toEqual({ ...defaults, sort: 'fw', dir, page: 1, market: 'crypto' })
})

async function sidebar(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 0) <= 860) {
    await page.locator('.client-hamburger').click()
    const drawer = page.getByRole('complementary', { name: 'TETH 메뉴', exact: true })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: name === '새 전략' ? '＋ 새 전략' : name, exact: true }).click()
    return
  }
  const button = page.locator('.client-sidebar').getByRole('button', { name, exact: true }).filter({ visible: true }).first()
  if (!await button.isVisible()) await page.locator('.client-rail-logo-row button').click()
  await button.click()
}

test('공유 정렬·시장·검색어는 대화 왕복 후 명시 공유 재진입에도 유지된다', async ({ page }) => {
  await setup(page)
  await pick(page, '정렬 기준', '복사한 사람순')
  await pick(page, '시장', '가상자산')
  await page.getByRole('searchbox', { name: '전략 검색', exact: true }).fill('그대로 둘 검색어')
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue(original.draft)
  await sidebar(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  await expect(trigger(page, '정렬 기준')).toHaveValue('fw')
  await expect(trigger(page, '시장')).toContainText('가상자산')
  await expect(page.getByRole('searchbox', { name: '전략 검색', exact: true })).toHaveValue('그대로 둘 검색어')
  await page.reload()
  await expect(trigger(page, '정렬 기준')).toHaveValue('fw')
  await expect(trigger(page, '시장')).toContainText('가상자산')
  await expect(page.getByRole('searchbox', { name: '전략 검색', exact: true })).toHaveValue('')
})

async function publishing(page: Page) {
  await page.evaluate(() => { location.hash = '#/share/publishing' })
  await expect(page.locator('#research-title')).toHaveText('내 전략')
  await expect(page.locator('.client-strategy-creator')).toBeVisible()
}

test('내 전략 관리 주소는 새로고침에 복원되고 홈의 전략들 진입은 목록을 연다', async ({ page }) => {
  const initial = JSON.stringify({ ...defaults, tab: 'mine' })
  await setup(page, { raw: initial })
  await publishing(page)
  await page.reload()
  await expect(page.locator('#research-title')).toHaveText('내 전략')
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await sidebar(page, '새 전략')
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await sidebar(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  await expect(page).toHaveURL(/#\/share$/)
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  expect(await raw(page)).toBe(initial)
})

const raw = (page: Page) => page.evaluate(() => Reflect.get(window, 'readRawSharingPreference')())
const notice = (page: Page) => page.getByRole('status').filter({ hasText: errorCopy })

test('모바일공유저장오류안내는판단방식·시장·검색조작을가리지않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await setup(page, { failure: 'get' })
  const message = notice(page), filters = page.locator('.strategy-filters')
  await expect(message).toBeVisible()
  const box = (await message.boundingBox())!, controls = (await filters.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(controls.y)
  expect(box.x).toBeCloseTo(controls.x, 0)
  expect(box.width).toBeCloseTo(controls.width, 0)
  const choice = page.getByRole('group', { name: '판단 방식' }).getByRole('button', { name: '혼합 전략', exact: true })
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await pick(page, '시장', '미국 주식')
  await page.getByRole('searchbox').fill('원문')
  await expect(page.getByRole('searchbox')).toHaveValue('원문')
  await expect(message).toBeVisible()
})

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    setClientPreference('language', value)
  }, value)
  await expect(page.locator('html')).toHaveAttribute('lang', value)
}

for (const width of [320, 1440]) test(`${width}px 저장실패안내와재시도는7언어변경에원문·선택·검색·초점을보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const initial = JSON.stringify(defaults)
  await setup(page, { raw: initial, failure: 'set' })
  await pick(page, '정렬 기준', '복사한 사람순')
  const search = page.getByRole('searchbox')
  await search.fill('원문 <keep>')
  const retry = notice(page).getByRole('button')
  await retry.focus()
  const handle = await retry.elementHandle()
  const writes = await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls').length)
  const message = page.locator('.client-sharing-preference-notice')
  for (const locale of Object.keys(preferenceCopy) as ClientLanguage[]) {
    await language(page, locale)
    await expect(message).toContainText(preferenceCopy[locale].loadSave)
    await expect(message.getByRole('button')).toHaveText(preferenceCopy[locale].retry)
    if (locale !== 'ko') expect(await message.innerText()).not.toMatch(/[가-힣]/)
    await expect(message.getByRole('button')).toBeFocused()
    expect(await message.getByRole('button').evaluate((node, original) => node === original, handle)).toBe(true)
    await expect(search).toHaveValue('원문 <keep>')
    await expect(page.locator('.strategy-list-sort select')).toHaveValue('fw')
    expect(await raw(page)).toBe(initial)
    expect(await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls').length)).toBe(writes)
    const box = (await message.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect((await message.getByRole('button').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(box.y + box.height).toBeLessThanOrEqual((await page.locator('.strategy-filters').boundingBox())!.y)
  }
  await page.screenshot({ path: info.outputPath(`sharing-retry-fr-${width}.png`) })
  await message.evaluate(element => { (element as HTMLElement).style.fontSize = '28px' })
  await message.getByRole('button').scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(await message.getByRole('button').evaluate(element => {
    const box = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
  })).toBe(true)
  await page.screenshot({ path: info.outputPath(`sharing-retry-fr-${width}-text-200.png`) })
  await page.evaluate(() => Reflect.set(window, 'sharingStorageFailure', undefined))
  await message.getByRole('button').click()
  await expect(message).toHaveCount(0)
  await expect(page.locator('#research-title')).toBeFocused()
  expect(JSON.parse(await raw(page))).toEqual({ ...defaults, sort: 'fw' })
})

test('로그아웃삭제실패안내도7언어에즉시반영되고닫기는삭제를재시도하지않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const initial = JSON.stringify({ ...defaults, market: 'crypto' })
  await setup(page, { raw: initial, failure: 'remove' })
  await logout(page)
  const message = page.locator('.client-global-notice')
  const writes = await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls').length)
  for (const locale of Object.keys(preferenceCopy) as ClientLanguage[]) {
    await language(page, locale)
    await expect(message).toContainText(preferenceCopy[locale].clear)
    await expect(message.getByRole('button')).toHaveAccessibleName(upgradeText(locale, 'closeAccountNotice'))
    expect(await raw(page)).toBe(initial)
    expect(await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls').length)).toBe(writes)
  }
  await message.getByRole('button').click()
  await expect(message).toHaveCount(0)
  expect(await raw(page)).toBe(initial)
  expect(await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls').length)).toBe(writes)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-profile-preview'))).toBeNull()
})

test('보존된위임결과의다른전략보기는저장된내전략탭과무관하게목록을연다', async ({ page }) => {
  await page.addInitScript(({ owner, original, key, defaults }) => {
    const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: false, startI: 604, endI: 1334 }
    const answers = Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1 }]))
    sessionStorage.setItem('sharing-preferences-fixture', '1')
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem(key, JSON.stringify({ ...defaults, tab: 'mine' }))
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '위임 메뉴 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: original.id, homeDraft: '홈 초안', sessions: [{ ...original, workspace: 'delegation' }] }))
    sessionStorage.setItem(`teth:client-delegation:${original.id}`, JSON.stringify({ page: 'backtest', answers, questionIndex: 5, attempt: 0, workStep: 5, parameters }))
  }, { owner, original, key: keyFor(), defaults })
  await setup(page)
  await publishing(page)
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await page.getByRole('button', { name: '다른 전략 보기', exact: true }).click()
  await expect(page).toHaveURL(/#\/share$/)
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  expect(JSON.parse(await raw(page))).toEqual(defaults)
})

test('목록과관리주소왕복은구선택원문을덮어쓰지않고목록진입을보존한다', async ({ page }) => {
  const initial = JSON.stringify({ ...defaults, tab: 'mine' })
  await setup(page, { raw: initial })
  await publishing(page)
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await expect(page).toHaveURL(/#\/share$/)
  expect(await raw(page)).toBe(initial)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await sidebar(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await publishing(page)
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await sidebar(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  expect(await raw(page)).toBe(initial)
})

test('표시선호JSON은시장선택과원본같은정렬재선택방향을저장하고검색입력은저장하지않는다', async ({ page }) => {
  await setup(page)
  await pick(page, '정렬 기준', '복사한 사람순')
  await pick(page, '정렬 기준', '복사한 사람순')
  await pick(page, '시장', '가상자산')
  const before = await raw(page)
  expect(JSON.parse(before)).toEqual({ ...defaults, sort: 'fw', dir: 'asc', market: 'crypto' })
  const writes = await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls').filter((call: { action: string }) => call.action === 'set').length)
  await page.getByRole('searchbox', { name: '전략 검색', exact: true }).fill('메모리에만 둘 문장 <script>')
  expect(await raw(page)).toBe(before)
  expect(await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls').filter((call: { action: string }) => call.action === 'set').length)).toBe(writes)
  await page.reload()
  await expect(trigger(page, '정렬 기준')).toHaveValue('fw')
  await expect(trigger(page, '시장')).toContainText('가상자산')
  await expect(page.getByRole('searchbox', { name: '전략 검색', exact: true })).toHaveValue('')
})

async function logout(page: Page) {
  await page.locator('[data-sidebar-action="account"]').filter({ visible: true }).click()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toBeVisible()
}

async function login(page: Page, email: string) {
  await page.getByRole('button', { name: '로그인', exact: true }).filter({ visible: true }).first().click()
  await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(email)
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await page.getByRole('button', { name: '비밀번호로 계속하기', exact: true }).click()
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-only-password')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '이메일 주소', exact: true })).toHaveCount(0)
}

test('명시로그아웃은본인새키만지우고타인선호·전략·구독기록을보존하며검색어를분리한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const other = JSON.stringify({ ...defaults, sort: 'mdd', asset: '나스닥' })
  await setup(page, { otherRaw: other })
  await pick(page, '정렬 기준', '복사한 사람순')
  await page.getByRole('searchbox', { name: '전략 검색', exact: true }).fill('A 계정 검색어')
  const protectedKeys = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-user-strategies:') || key.startsWith('teth-client-subscription-intent:') || key.startsWith('teth-client-account'))))
  await logout(page)
  expect(await raw(page)).toBeNull()
  expect(await page.evaluate(key => localStorage.getItem(key), keyFor(otherOwner))).toBe(other)
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-user-strategies:') || key.startsWith('teth-client-subscription-intent:') || key.startsWith('teth-client-account'))))).toEqual(protectedKeys)
  await login(page, otherOwner)
  await sidebar(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  await expect(trigger(page, '정렬 기준')).toHaveValue('pick')
  expect(await page.evaluate(key => localStorage.getItem(key), keyFor(otherOwner))).toBe(other)
  await expect(trigger(page, '시장')).toContainText('시장 전체')
  await expect(page.getByRole('searchbox', { name: '전략 검색', exact: true })).toHaveValue('')
  expect(await raw(page)).toBeNull()
})

test('게스트의공유화면조작은계정선호storageIO를발생시키지않는다', async ({ page }) => {
  await setup(page, { guest: true, raw: JSON.stringify({ ...defaults, tab: 'mine' }) })
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  await pick(page, '정렬 기준', '복사한 사람순')
  await pick(page, '시장', '가상자산')
  await page.getByRole('searchbox', { name: '전략 검색', exact: true }).fill('guest search')
  await publishing(page)
  expect(await page.evaluate(() => Reflect.get(window, 'sharingStorageCalls'))).toEqual([])
})

for (const failure of ['get', 'set'] as const) test(`localStorage ${failure} 실패는현재선택과원bytes를보존하고명시재시도로저장한다`, async ({ page }) => {
  const initial = JSON.stringify(defaults)
  await setup(page, { raw: initial, failure })
  await pick(page, '정렬 기준', '복사한 사람순')
  await expect(trigger(page, '정렬 기준')).toHaveValue('fw')
  await expect(notice(page)).toBeVisible()
  expect(await raw(page)).toBe(initial)
  await page.evaluate(() => Reflect.set(window, 'sharingStorageFailure', undefined))
  await notice(page).getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(notice(page)).toHaveCount(0)
  expect(JSON.parse(await raw(page))).toEqual({ ...defaults, sort: 'fw' })
  await expect(page.locator('#research-title')).toBeFocused()
})

test('손상원문은명시재시도에도보존하고외부정상복구뒤현재선택만병합한다', async ({ page }) => {
  await setup(page, { raw: '{broken' })
  await expect(notice(page)).toBeVisible()
  expect(await raw(page)).toBe('{broken')
  await pick(page, '정렬 기준', '복사한 사람순')
  await publishing(page)
  expect(await raw(page)).toBe('{broken')
  await notice(page).getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(notice(page)).toBeVisible()
  expect(await raw(page)).toBe('{broken')
  await page.evaluate(({ key, defaults }) => localStorage.setItem(key, JSON.stringify({ ...defaults, asset: '이더리움' })), { key: keyFor(), defaults })
  await notice(page).getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(notice(page)).toHaveCount(0)
  expect(JSON.parse(await raw(page))).toEqual({ ...defaults, sort: 'fw', asset: '이더리움' })
  await expect(page.locator('#research-title')).toBeFocused()
})

test('로그아웃삭제실패는계정로그아웃을막지않고원키를보존하며다음명시로그아웃에서재시도한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const initial = JSON.stringify({ ...defaults, sort: 'fw' })
  await setup(page, { raw: initial, failure: 'remove' })
  await logout(page)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-profile-preview'))).toBeNull()
  await expect(page.getByRole('status').filter({ hasText: clearErrorCopy })).toBeVisible()
  expect(await raw(page)).toBe(initial)
  await page.evaluate(() => Reflect.set(window, 'sharingStorageFailure', undefined))
  await login(page, owner)
  await sidebar(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  await expect(trigger(page, '정렬 기준')).toHaveValue('fw')
  await expect(page.getByRole('searchbox', { name: '전략 검색', exact: true })).toHaveValue('')
  await logout(page)
  expect(await raw(page)).toBeNull()
})

for (const width of [320, 1440]) test(`${width}px복원된선택과메뉴는읽히며키보드로변경가능하다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  await setup(page, { raw: JSON.stringify({ ...defaults, sort: 'score', dir: 'asc', asset: '이더리움' }) })
  await expect(trigger(page, '정렬 기준')).toHaveValue('pick')
  expect(JSON.parse(await raw(page))).toEqual({ ...defaults, sort: 'score', dir: 'asc', asset: '이더리움' })
  await expect(trigger(page, '시장')).toContainText('시장 전체')
  await page.evaluate(() => document.fonts.ready)
  await trigger(page, '정렬 기준').focus()
  await page.keyboard.press('End')
  await expect(trigger(page, '정렬 기준')).toHaveValue('fw')
  expect(JSON.parse(await raw(page))).toEqual({ ...defaults, sort: 'fw', dir: 'desc', asset: '이더리움' })
  await expect(trigger(page, '정렬 기준')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`sharing-preferences-${width}.png`) })
})
