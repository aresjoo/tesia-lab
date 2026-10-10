import { expect, test } from '@playwright/test'

test('source settings wrapper and mobile detail title retain their original positions', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const mutations: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') mutations.push(request.method() + ' ' + new URL(request.url()).pathname) })
  // Source 9fb final CSS: desktop #g-content contributes 40px before
  // .stg-main's 28px; mobile contributes 16px + original 40px back row + 6px.
  // The React back control keeps its approved 44px hit area.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const tab of ['general', 'account', 'notify', 'security', 'billing', 'usage']) {
      await page.goto(`/tests/fixtures/client-settings-identity.html#/settings/${tab}`)
      const root = page.locator('.client-settings-page'), heading = root.locator('h1')
      await expect(heading).toBeVisible()
      const geometry = await heading.evaluate(element => {
        const box = element.getBoundingClientRect(), page = element.closest('.client-settings-page')!
        const back = page.querySelector<HTMLElement>('.stg-mback')!, backBox = back.getBoundingClientRect()
        const firstSection = page.querySelector<HTMLElement>('.stg-main .stg-sec')
        return { x: box.x, y: box.y, height: box.height, rootY: page.getBoundingClientRect().y,
          backHeight: backBox.height, backBottom: backBox.bottom, sectionY: firstSection?.getBoundingClientRect().y,
          overflow: page.scrollWidth > page.clientWidth }
      })
      expect(geometry.y - geometry.rootY, `${width}px ${tab} source title offset`).toBeCloseTo(width > 900 ? 68 : 62, 1)
      expect(geometry.x, `${width}px ${tab} source horizontal position`).toBeCloseTo(width > 900 ? 598 : 16, 1)
      expect(geometry.overflow).toBe(false)
      if (width <= 900) {
        expect(geometry.backHeight).toBeGreaterThanOrEqual(44)
        expect(geometry.backBottom).toBeLessThanOrEqual(geometry.y)
        await expect(root.locator('.stg-mback')).toHaveCSS('margin-bottom', '-4px')
      }
      if (geometry.sectionY !== undefined) expect(geometry.sectionY).toBeGreaterThanOrEqual(geometry.y + geometry.height)
      await info.attach(`settings-${width}-${tab}-geometry`, { body: JSON.stringify(geometry), contentType: 'application/json' })
      if (tab === 'general') {
        const languageRow = root.locator('.stg-r').filter({ has: page.locator('.stg-sel') })
        const currencyRow = languageRow.locator('xpath=following-sibling::div[contains(@class,"stg-r")][1]')
        const selectBox = await root.locator('.stg-sel').boundingBox()
        const labelBox = await languageRow.locator('.k').boundingBox()
        expect(selectBox!.x).toBeGreaterThanOrEqual(labelBox!.x + labelBox!.width)
        await expect(currencyRow.locator('.v')).toHaveText('USD')
        if (width <= 900) {
          expect(selectBox!.height).toBeGreaterThanOrEqual(44)
          await expect(languageRow).toHaveCSS('row-gap', '6px')
          const hintBox = await currencyRow.locator('.k').boundingBox(), valueBox = await currencyRow.locator('.v').boundingBox()
          expect(valueBox!.x).toBeCloseTo(hintBox!.x, 1)
          expect(valueBox!.y - hintBox!.y - hintBox!.height).toBeCloseTo(6, 1)
        } else {
          const hintBox = await currencyRow.locator('.k').boundingBox(), valueBox = await currencyRow.locator('.v').boundingBox()
          expect(valueBox!.x).toBeGreaterThanOrEqual(hintBox!.x + hintBox!.width)
        }
        await page.screenshot({ path: info.outputPath(`settings-${width}.png`) })
      }
    }
    if (width <= 900) {
      await page.locator('.stg-mback').click()
      await expect(page.locator('.stg-navigation')).toBeVisible()
      await expect(page.locator('.stg-navigation')).toHaveCSS('padding-top', '24px')
    }
  }
  // Layout restoration must not regress locale persistence or narrow wrapping.
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/tests/fixtures/client-settings-identity.html#/settings/general')
    await page.locator('.stg-sel').selectOption('fr')
    await page.reload()
    await expect(page.locator('.stg-sel')).toHaveValue('fr')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    expect(await page.locator('.client-settings-page').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false)
    const row = page.locator('.stg-r').filter({ has: page.locator('.stg-sel') })
    const label = await row.locator('.k').boundingBox(), select = await row.locator('.stg-sel').boundingBox()
    expect(select!.x).toBeGreaterThanOrEqual(label!.x + label!.width)
    if (width <= 900) expect(select!.height).toBeGreaterThanOrEqual(44)
  }
  const app = page.locator('.client-source-app')
  await app.evaluate(element => (element as HTMLElement).style.setProperty('--client-inspection-height', '28px'))
  await expect(page.locator('.client-source-main')).toHaveCSS('height', '816px')
  await app.evaluate(element => (element as HTMLElement).style.setProperty('--client-inspection-height', '0px'))
  await expect(page.locator('.client-source-main')).toHaveCSS('height', '844px')
  expect(mutations).toEqual([])
})
