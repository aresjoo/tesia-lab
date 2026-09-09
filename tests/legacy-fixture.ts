import { test as base, expect } from '@playwright/test'
export type { Page } from '@playwright/test'

/** Pre-migration funnel/chart regressions use the DEV-only legacy fixture.
 * They do not validate the default source UI; its suites are separate.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, provide) => {
    const goto = page.goto.bind(page)
    page.goto = async (url, options) => {
      if (!baseURL) throw new Error('Legacy fixture requires a configured baseURL')
      const destination = new URL(url, baseURL)
      if (destination.origin === new URL(baseURL).origin && destination.pathname === '/') {
        destination.searchParams.set('legacy-fixture', '1')
      }
      const response = await goto(destination.href, options)
      if (destination.origin === new URL(baseURL).origin && destination.pathname === '/') {
        await page.locator('#tesia-main, #main').first().waitFor({ state: 'visible' })
      }
      return response
    }
    await provide(page)
  },
})
export { expect }
