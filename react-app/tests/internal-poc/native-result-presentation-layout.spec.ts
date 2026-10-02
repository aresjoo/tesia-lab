import { expect, test } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'
import { nativeResultText } from '../../src/internal-poc/native-result-copy'

// Actual result consumer/SDK, synthetic source-bound fixtures. This proves
// layout and continuity, not a live backtest or complete-period coverage.
for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const)
for (const width of [320, 390, 768, 1440]) test(`${language}: presentation plot is visible without scrolling at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 664 })
  await page.clock.install()
  const control = await resultHost(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', language)
  }, language)
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  await page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
  const dialog = page.locator('.ctt-modal[open]')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.cp-replay progress')).toBeVisible()
  await page.clock.runFor(100)
  await page.evaluate(() => document.fonts.ready)
  // Measure the resting layout, not a frame inside the entry/first-fill motion.
  await dialog.evaluate(async element => {
    await Promise.all(document.getAnimations().filter(animation => {
      const effect = animation.effect as KeyframeEffect | null
      return effect?.target instanceof Node && element.contains(effect.target)
        && effect.getTiming().iterations !== Infinity
    }).map(animation => animation.finished.catch(() => {})))
  })
  const measurements = await dialog.evaluate(element => {
    const selectors = ['.ctt-header', '.ctt-header h2', '.ctt-header-tools', '.ctt-notice', '.ctt-context', '.cp-toolbar', '.cp-source', '.cp-quote', '.cp-quote dd', '.cp-replay', '.cp-surface']
    return Object.fromEntries(selectors.map(selector => {
      const node = element.querySelector(selector)!, rect = node.getBoundingClientRect(), style = getComputedStyle(node)
      return [selector, { top: rect.top, bottom: rect.bottom, height: rect.height, margin: style.margin, fontSize: style.fontSize }]
    }))
  })
  await info.attach('layout-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('presentation-layout.png') })
  const plot = measurements['.cp-surface']
  expect(Math.min(plot.bottom, 664) - Math.max(0, plot.top), JSON.stringify(measurements)).toBeGreaterThanOrEqual(240)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await expect(dialog.locator('.ctt-notice')).toContainText(nativeResultText(language, 'syntheticNotice'))
  const skip = dialog.getByRole('button', { name: nativeResultText(language, 'skipToResult'), exact: true })
  const skipBounds = await skip.boundingBox()
  expect(skipBounds!.y + skipBounds!.height).toBeLessThanOrEqual(664)
  expect(skipBounds!.height).toBeGreaterThanOrEqual(44)
  const closeBounds = await dialog.locator('[data-terminal-close]').boundingBox()
  expect(skipBounds!.x + skipBounds!.width).toBeLessThanOrEqual(closeBounds!.x)
  // Full provenance and limitations stay reachable; no truncation or fake data.
  const source = dialog.locator('.cp-source'), sourceText = await source.textContent()
  expect(sourceText).toContain('SYNTHETIC_UI_FIXTURE')
  await source.scrollIntoViewIfNeeded()
  await expect(source).toBeInViewport()
  expect(await source.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  // A replay describes this supplied window, not complete historical coverage.
  // These notices and the actual marker-page count must remain readable below
  // the plot, including in PARTIAL fixtures; hiding them is not responsive UI.
  const disclosures = dialog.locator('.ctt-chart > p')
  expect(await disclosures.count()).toBeGreaterThanOrEqual(4)
  for (const disclosure of await disclosures.all()) {
    await expect(disclosure).toBeVisible()
    await disclosure.scrollIntoViewIfNeeded()
    await expect(disclosure).toBeInViewport()
    expect(await disclosure.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  }
  await expect(dialog.getByText(nativeResultText(language, 'missingRanges', { count: 2 }), { exact: true })).toBeVisible()
  if (width === 320 || width === 1440) await page.screenshot({ path: info.outputPath('presentation-disclosures.png') })
  const markerPage = dialog.locator('[data-native-controls="fill-markers"]')
  await expect(markerPage).toBeVisible()
  const rangeTools = dialog.locator('.native-chart-toolbar')
  await expect(rangeTools).toBeVisible()
  await rangeTools.scrollIntoViewIfNeeded()
  await expect(rangeTools).toBeInViewport()
  await expect(dialog.locator('.cp-controls')).toBeVisible()
  // CSS presentation order must not leave a keyboard user focused offscreen.
  const fit = dialog.locator('.cp-toolbar > button').first()
  await fit.focus()
  await expect(fit).toBeInViewport()
  const between = await fit.evaluate(first => {
    const surface = first.closest('dialog')!.querySelector('.cp-surface')!
    return Array.from(first.closest('dialog')!.querySelectorAll<HTMLElement>('button,input,select,a[href],[tabindex],.cp-drawing-tools'))
      .filter(el => el !== surface && (el.tabIndex >= 0 || el.matches('.cp-drawing-tools')
        && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
        && !el.querySelector('button:not(:disabled)')) && !el.matches(':disabled')
        && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
        && !el.closest('[hidden],[inert]')
        && Boolean(first.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
        && Boolean(el.compareDocumentPosition(surface) & Node.DOCUMENT_POSITION_FOLLOWING))
      .map(el => el.getAttribute('aria-label') || el.textContent?.trim() || '')
  })
  // The source toolbar now includes export, indicators and drawing controls.
  // Chromium also tabs into the scrollable drawing group while replay disables
  // its controls. Keep that real scroll destination and every enabled control.
  for (const label of between) {
    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '')).toBe(label)
    await expect.poll(() => page.evaluate(() => {
      const r = document.activeElement!.getBoundingClientRect()
      return r.top >= 0 && r.bottom <= innerHeight + 1
    })).toBe(true)
  }
  await page.keyboard.press('Tab')
  await expect(dialog.locator('.cp-surface')).toBeFocused()
  await expect(dialog.locator('.cp-surface')).toBeInViewport()
  for (let i = 0; i <= between.length; i++) await page.keyboard.press('Shift+Tab')
  await expect(fit).toBeFocused()
  await expect(fit).toBeInViewport()
  await dialog.locator('.ctt-notice summary').first().click()
  await expect(dialog.locator('.ctt-notice details[open]').first()).toBeAttached()
  await skip.click()
  await expect(dialog).toHaveCount(0)
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(control.errors).toEqual([])
})
