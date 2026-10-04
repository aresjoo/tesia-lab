import { expect, type Page, type Request } from '@playwright/test'

/** Reach the real recovery UI via a single pre-dispatch journal write failure.
 * Healthy source UI has no permanent retry action. No controller methods are
 * exposed, no HTTP failures/successes fabricated, and no mutation is sent by
 * this setup. Existing ambiguous requests use their already-visible recovery. */
export async function recoverNativeAfterJournalFailure(page: Page) {
  const recover = page.getByRole('button', { name: '세션 다시 확인', exact: true })
  if (!await recover.isVisible()) {
    const input = page.locator('.g-composer textarea')
    await expect(input).toBeEnabled()
    const draft = await input.inputValue()
    const before = await page.evaluate(() => ({ ...sessionStorage }))
    expect(before['tesia.native.pending-command']).toBeUndefined()
    const mutations: string[] = []
    const observe = (request: Request) => {
      if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.method())
    }
    page.on('request', observe)
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      let failed = 0
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === 'tesia.native.pending-command' && failed === 0) {
          failed++
          throw new DOMException('Explicit pre-dispatch journal fixture', 'QuotaExceededError')
        }
        return original.call(this, key, value)
      }
      Reflect.set(window, '__restoreRecoveryJournalFixture', () => { Storage.prototype.setItem = original; return failed })
    })
    let failures: number
    try {
      // A non-empty local attempt is necessary for a healthy empty composer.
      // Restore its exact original draft before invoking the actual recovery.
      if (!draft.trim()) await input.fill('전송 전 기록 실패 검수')
      const attempted = await input.inputValue()
      await input.press('Enter')
      await expect(recover).toBeVisible()
      await expect(input).toHaveValue(attempted)
      expect(await page.evaluate(() => ({ ...sessionStorage }))).toEqual(before)
      expect(mutations).toEqual([])
      if (attempted !== draft) await input.fill(draft)
      await expect(input).toHaveValue(draft)
    } finally {
      failures = await page.evaluate(() => {
        const count = Reflect.get(window, '__restoreRecoveryJournalFixture')()
        Reflect.deleteProperty(window, '__restoreRecoveryJournalFixture')
        return count
      })
      page.off('request', observe)
    }
    expect(failures).toBe(1)
  }
  await recover.click()
}
