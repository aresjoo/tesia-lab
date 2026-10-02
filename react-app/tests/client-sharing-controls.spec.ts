import { expect, test, type Page } from '@playwright/test'
import { catalogueStrategies } from '../src/client-catalogue'
import { sourceSharingNames } from './fixtures/source-sharing-page-helper'

const rows = catalogueStrategies.map(strategy => ({ nick: strategy.name, followers: strategy.fw, market: strategy.mkt }))
const cards = (page: Page) => page.locator('.strategy-list-card')
const names = sourceSharingNames
const sort = (page: Page) => page.getByRole('combobox', { name: '정렬 기준', exact: true })
const asset = (page: Page) => page.locator('.tfbk-dropwrap button[aria-haspopup="listbox"]')
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '공유 조작 검수자', email: 'sharing-controls@example.test' }))
  })
  await page.goto('/#/share')
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
}

test('목록은 폐기된 배너·합성 카운터 없이 원본 세 정렬을 제공한다', async ({ page }) => {
  await open(page)
  await expect(page.locator('.hub-header h1')).toHaveText('전략 복사')
  await expect(page.locator('.client-sharing-counter,.tfbk-cnt-reel,.client-strategy-sharing>.tfbk-hero')).toHaveCount(0)
  await expect(sort(page).locator('option')).toHaveText(['추천순', '최근 30일 수익률순', '복사한 사람순'])
  await expect(cards(page)).toHaveCount(10)
  await expect(page.locator('.mk-pager .mk-pg:not(.nav)')).toHaveCount(10)
  await expect(cards(page).first()).toBeInViewport({ ratio: 1 })
})

test('같은 수익·복사 정렬 재선택은 원본처럼 방향을 뒤집고 추천순은 공급 순서를 복원한다', async ({ page }) => {
  await open(page)
  expect(await names(page)).toEqual(rows.map(row => row.nick))
  await sort(page).selectOption('fw')
  const ordered = [...rows].sort((a,b) => b.followers-a.followers).map(row => row.nick)
  expect(await names(page)).toEqual(ordered)
  await sort(page).selectOption('fw')
  expect(await names(page)).toEqual([...rows].sort((a,b) => a.followers-b.followers).map(row => row.nick))
  await sort(page).selectOption('pick')
  expect(await names(page)).toEqual(rows.map(row => row.nick))
})

test('native 정렬은 Home·End·방향키로 선택하며 포커스와 입력을 보존한다', async ({ page }) => {
  await open(page)
  await sort(page).focus()
  await page.keyboard.press('End')
  await expect(sort(page)).toHaveValue('fw')
  await page.keyboard.press('Home')
  await expect(sort(page)).toHaveValue('pick')
  await page.keyboard.press('ArrowDown')
  await expect(sort(page)).toHaveValue('ret')
  await expect(sort(page)).toBeFocused()
})

test('시장 메뉴 Home·End·Enter·Escape는 선택과 초점을 보존한다', async ({ page }) => {
  await open(page)
  await asset(page).click()
  const menu = page.getByRole('listbox', { name: '시장', exact: true })
  await page.keyboard.press('End')
  await expect(menu.getByRole('option', { name: '여러 시장', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(menu.getByRole('option', { name: '시장 전체', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(asset(page)).toContainText('가상자산')
  await expect(asset(page)).toBeFocused()
  const before = await names(page)
  await asset(page).click()
  await page.keyboard.press('End'); await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(asset(page)).toBeFocused()
  expect(await names(page)).toEqual(before)
})

test('외부 클릭·탭 변경·정렬 조작은 열린 시장 메뉴를 정리한다', async ({ page }) => {
  await open(page)
  await asset(page).click()
  await page.locator('.hub-header h1').click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await asset(page).click()
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await asset(page).click()
  await sort(page).selectOption('fw')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('Tab과 ShiftTab은 시장 메뉴를 닫고 검색과 native 정렬로 이동한다', async ({ page }) => {
  await open(page)
  await asset(page).click(); await page.keyboard.press('Tab')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByRole('searchbox')).toBeFocused()
  await asset(page).click(); await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(sort(page)).toBeFocused()
})

test('시장과 검색 조건은 정렬 왕복에도 유지되며 초기화는 현재 정렬을 보존한다', async ({ page }) => {
  await open(page)
  await asset(page).click()
  await page.getByRole('option', { name: '가상자산', exact: true }).click()
  expect(await names(page)).toEqual(rows.filter(row => row.market === 'crypto').map(row => row.nick))
  const target = rows.find(row => row.market === 'crypto')!
  await page.getByRole('searchbox').fill(target.nick)
  await sort(page).selectOption('fw')
  expect(await names(page)).toEqual([target.nick])
  await expect(asset(page)).toContainText('가상자산')
  await page.getByRole('searchbox').fill('없는 전략 <script>')
  await expect(cards(page)).toHaveCount(0)
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await expect(sort(page)).toHaveValue('fw')
  await expect(asset(page)).toContainText('시장 전체')
  expect(await names(page)).toEqual([...rows].sort((a,b) => b.followers-a.followers).map(row => row.nick))
})

for (const width of [320, 1440]) test(width + 'px 목록 조작부는 보이고 메뉴의 마지막 항목도 누를 수 있다', async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await open(page)
  await page.evaluate(() => document.fonts.ready)
  await asset(page).click()
  const option = page.getByRole('option', { name: '여러 시장', exact: true })
  await option.scrollIntoViewIfNeeded()
  await expect(option).toBeInViewport({ ratio: 1 })
  expect(await option.evaluate(el => {
    const b = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2))
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('sharing-controls-' + width + '.png') })
  await page.keyboard.press('Escape')
  await expect(asset(page)).toBeFocused()
})
