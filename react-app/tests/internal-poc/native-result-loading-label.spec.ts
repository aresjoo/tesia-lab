import { expect, test } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'

// Real React/SDK with synthetic wire data, not a source-custody assertion.
for (const reader of [true, false]) for (const skipEarly of [true, false]) {
  test(`${reader ? '시간순' : '기존'} 재생 준비는 이전 마커 집계를 숨기고 ${skipEarly ? '조기 Skip' : '첫 프레임'}까지 대화와 차트를 보존한다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
    const control = await resultHost(page, { replayReader: reader, boundedReplayPrices: reader })
    const result = page.locator('.native-service-result')
    const start = result.getByRole('button', { name: '차트로 결과 보기', exact: true, includeHidden: true })
    await expect(start).toHaveAttribute('aria-disabled', 'false')
    const analysis = page.locator('[data-analysis-tab="analysis"]')
    if (await analysis.isVisible()) await analysis.click()
    const markers = result.locator('[data-native-controls="fill-markers"]')
    await markers.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
    await expect(markers).toContainText('조회한 체결 마커 2개')
    const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
    const input = await page.locator('.g-composer textarea').elementHandle()
    const draft = await page.locator('.g-composer textarea').inputValue()
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    control.heldPath = reader ? 'chronological-fill-markers' : 'fill-markers'
    control.hold = () => held
    const before = control.requests.filter(url => url.pathname.endsWith(`/${control.heldPath}`)).length
    try {
      await start.click()
      await expect.poll(() => control.requests.filter(url => url.pathname.endsWith(`/${control.heldPath}`)).length).toBe(before + 1)
      await expect(page.getByRole('status').filter({ hasText: '체결 데이터 확인 중' })).toBeVisible()
      await expect(result.getByText(/체결 첫 페이지 중 현재 표시 범위.*전체 체결 아님/)).toHaveCount(0)
      await expect(result.getByText(/현재 차트 표시 체결.*전체 체결 아님/)).toHaveCount(0)
      await page.clock.runFor(1600)
      await expect(result.getByText(/체결 첫 페이지 중 현재 표시 범위.*전체 체결 아님/)).toHaveCount(0)
      expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
      if (!skipEarly) {
        release()
        await expect.poll(() => control.settled.filter(url => url.pathname.endsWith(`/${control.heldPath}`)).length).toBe(before + 1)
        if (reader) await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chart-window')).length).toBe(3)
        await page.clock.runFor(80)
        await expect(result.getByText(reader ? /현재 차트 표시 체결.*전체 체결 아님/ : /체결 첫 페이지 중 현재 표시 범위.*전체 체결 아님/)).toBeVisible()
      }
      await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
      release()
      await page.clock.runFor(800)
      await expect(page.getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toHaveCount(0)
      expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
      expect(await input!.evaluate(node => node === document.querySelector('.g-composer textarea'))).toBe(true)
      await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
      expect(control.errors).toEqual([])
    } finally { release() }
  })
}
