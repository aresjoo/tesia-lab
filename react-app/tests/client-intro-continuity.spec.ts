import { expect, test, type Page } from '@playwright/test'

async function returnToIntro(page: Page) {
  await page.evaluate(() => { window.location.hash = '' })
  await expect(page.locator('.txh')).toHaveCount(0)
  await page.evaluate(() => { window.location.hash = '#/trade' })
  await expect(page.locator('.txh-floor')).toBeVisible()
  await page.locator('.txh-floor').scrollIntoViewIfNeeded()
}

for (const width of [320, 1440]) test(`최신 소개 ${width}px 시작 방법과 실행 설정의 윤곽과 간격`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/trade')
  await expect(page.locator('.txh-step')).toHaveCount(3)
  const step = page.locator('.txh-step').first(), safety = page.locator('.txh-safe ul')
  for (const card of [step, safety]) {
    await expect(card).toHaveCSS('border-top-width', '1px')
    await expect(card).toHaveCSS('border-left-width', '1px')
    await expect(card).toHaveCSS('border-radius', width === 320 ? '20px' : '26px')
  }
  await expect(page.locator('.txh-sec').nth(2)).toHaveCSS('padding-top', width === 320 ? '88px' : '128px')
  await expect(page.locator('.txh-sec.first')).toHaveCSS('padding-top', '64px')
  await expect(page.locator('.txh-steps')).toHaveCSS('gap', width === 320 ? '12px' : '16px')
  await expect(page.locator('.txh-steps')).toHaveCSS('margin-top', '36px')
  await page.locator('.txh-steps').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`intro-steps-${width}.png`) })
  await safety.scrollIntoViewIfNeeded()
  expect(await safety.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`intro-safe-${width}.png`) })
})

test('짧은 소개 재진입은 영상 위치를 이어 받고 언어 변경은 같은 영상을 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/#/trade')
  const video = page.locator('.txh-floor video')
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1)
  const original = await video.elementHandle()
  await video.evaluate((el: HTMLVideoElement) => { el.currentTime = 2 })
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'fr') })
  expect(await original!.evaluate(el => el === document.querySelector('.txh-floor video'))).toBe(true)
  await page.evaluate(() => {
    const times: number[] = []
    Reflect.set(window, 'introPlayingTimes', times)
    document.addEventListener('playing', event => {
      if (event.target instanceof HTMLVideoElement && event.target.closest('.txh-floor')) times.push(event.target.currentTime)
    }, true)
  })
  await returnToIntro(page)
  await expect(video).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, 'introPlayingTimes') as number[]).length)).toBeGreaterThan(0)
  expect(await page.evaluate(() => (Reflect.get(window, 'introPlayingTimes') as number[])[0])).toBeGreaterThanOrEqual(2)
  expect(await original!.evaluate(el => el.isConnected)).toBe(false)
})

test('끝난 영상은 즉시 재진입해도 다시 로드하지 않으며 원본 20초 유효기간 뒤에만 시작한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/#/trade')
  const video = page.locator('.txh-floor video')
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => Number.isFinite(el.duration))).toBe(true)
  await video.evaluate((el: HTMLVideoElement) => { el.currentTime = el.duration - .2 })
  await expect(video).toHaveJSProperty('ended', true)
  await returnToIntro(page)
  await expect(video).toHaveCount(0)
  await expect(page.locator('.txh-floor img')).toHaveCSS('opacity', '1')
  await page.clock.install()
  // The source window is measured from leaving, not from time spent reading
  // the page with its completed poster still visible.
  for (let visit = 0; visit < 2; visit++) {
    await page.evaluate(() => { window.location.hash = '' })
    await expect(page.locator('.txh')).toHaveCount(0)
    await page.clock.fastForward(15_000)
    await page.evaluate(() => { window.location.hash = '#/trade' })
    await expect(page.locator('.txh-floor')).toBeVisible()
    await expect(video).toHaveCount(0)
  }
  await page.evaluate(() => { window.location.hash = '' })
  await expect(page.locator('.txh')).toHaveCount(0)
  await page.clock.fastForward(21_000)
  await page.evaluate(() => { window.location.hash = '#/trade' })
  await page.locator('.txh-floor').scrollIntoViewIfNeeded()
  await expect(video).toHaveCount(1)
})
