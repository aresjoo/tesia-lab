import { expect, type Page } from '@playwright/test'

/** Source catalogue retains a keyboard-only return action. Reveal it through
 * focus instead of clicking a clipped control or altering its presentation. */
export async function returnFromSourceSharing(page: Page) {
  const grid = page.locator('.strategy-list-grid')
  if (await grid.count()) await expect(grid).toHaveAttribute('aria-busy', 'false')
  const back = page.getByRole('button', { name: '대화로 돌아가기', exact: true })
  await back.focus()
  await expect(back).toBeFocused()
  await expect(back).toBeInViewport()
  await back.press('Enter')
}

/** Actual source list navigation only. The source repeats stable strategy IDs
 * up to 100 slots; unique definitions and their order remain independently
 * testable across the real ten-card pages. This does not change provider data. */
export async function traverseSourceSharingPages(page: Page, visit: () => Promise<void>) {
  const pager = page.locator('.client-strategy-sharing .mk-pager')
  if (!await pager.count()) { await visit(); return }
  const numbers = pager.locator('.mk-pg:not(.nav)')
  const pages = await numbers.count()
  const original = Number(await pager.locator('[aria-current="page"]').innerText())
  try {
    for (let index = 0; index < pages; index++) {
      await numbers.nth(index).click()
      await expect(numbers.nth(index)).toHaveAttribute('aria-current', 'page')
      await visit()
    }
  } finally {
    await numbers.nth(original - 1).click()
    await expect(numbers.nth(original - 1)).toHaveAttribute('aria-current', 'page')
  }
}

export async function sourceSharingNames(page: Page) {
  const names: string[] = []
  await traverseSourceSharingPages(page, async () => {
    names.push(...await page.locator('.client-strategy-sharing article.tfbk-card .skf-nm h3, .client-strategy-sharing article.tfbk-card button.nm').allTextContents())
  })
  return [...new Set(names)]
}

export async function revealSourceSharingCard(page: Page, selector: string) {
  const target = page.locator(selector)
  if (await target.count()) return target
  const numbers = page.locator('.client-strategy-sharing .mk-pager .mk-pg:not(.nav)')
  for (let index = 0; index < await numbers.count(); index++) {
    await numbers.nth(index).click()
    await expect(numbers.nth(index)).toHaveAttribute('aria-current', 'page')
    if (await target.count()) return target
  }
  throw new Error(`Source sharing card was not present on any actual page: ${selector}`)
}
