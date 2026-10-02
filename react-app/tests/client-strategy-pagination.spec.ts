import { expect, test } from '@playwright/test'
import { catalogueStrategies } from '../src/client-catalogue'
import { paginateSourceStrategies } from '../src/client-strategy-pagination'

test('반복 목록은 원본 참조와 ID를 보존하고 내 전략은 반복하지 않는다', () => {
  const own = { id: 'own', me: true }, a = { id: 'a' }, b = { id: 'b' }
  const original = [own, a, b]
  const first = paginateSourceStrategies(original, true, 1)
  expect(first.pages).toBe(3)
  expect(first.rows.map(row => row.id)).toEqual(['own', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a'])
  const second = paginateSourceStrategies(original, true, 2)
  expect(second.rows).toHaveLength(10)
  expect(second.rows.every(row => row === a || row === b)).toBe(true)
  expect(paginateSourceStrategies(original, true, 3).rows).toEqual([b])
  expect(original).toEqual([own, a, b])
  expect(paginateSourceStrategies(original, false, 10)).toEqual({ rows: original, page: 1, pages: 1 })
  expect(paginateSourceStrategies([], true, Infinity)).toEqual({ rows: [], page: 1, pages: 1 })
})

for (const width of [320, 1440]) test(`${width}px 원본10페이지·같은31ID·검색/분류 초기화·상세 복귀를 유지한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()) })
  await page.goto('/#/share')
  const grid = page.locator('.strategy-list-grid'), pager = page.getByRole('navigation', { name: '페이지', exact: true })
  await expect(grid).toHaveAttribute('aria-busy', 'false')
  await expect(pager.getByRole('button')).toHaveCount(12)
  await expect(pager.getByLabel('이전 페이지', { exact: true })).toBeDisabled()
  const found = new Set<string>()
  for (let number = 1; number <= 10; number++) {
    await pager.getByLabel(`${number}페이지`, { exact: true }).click()
    await expect(pager.locator('[aria-current="page"]')).toHaveText(String(number))
    const expected = Array.from({ length: 10 }, (_, offset) => catalogueStrategies[((number - 1) * 10 + offset) % 31].name)
    await expect(grid.locator('h3')).toHaveText(expected)
    for (const link of await grid.getByRole('link').all()) found.add(new URL((await link.getAttribute('href'))!, page.url()).hash.split('/')[3])
  }
  expect([...found].sort()).toEqual(catalogueStrategies.map(row => row.id).sort())
  await expect(pager.getByLabel('다음 페이지', { exact: true })).toBeDisabled()
  await grid.getByRole('link').first().click()
  await expect(page.locator('.ss3-dtitle')).toBeVisible()
  await page.goBack()
  await expect(pager.locator('[aria-current="page"]')).toHaveText('10')
  await page.getByRole('searchbox', { name: '전략 검색', exact: true }).fill(catalogueStrategies[0].name)
  await expect(grid.locator('h3')).toHaveText([catalogueStrategies[0].name])
  await expect(pager).toHaveCount(0)
  await page.getByRole('searchbox', { name: '전략 검색', exact: true }).fill('')
  await expect(pager.locator('[aria-current="page"]')).toHaveText('1')
  await expect(pager.getByLabel('이전 페이지', { exact: true })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
  expect(writes).toEqual([])
})
