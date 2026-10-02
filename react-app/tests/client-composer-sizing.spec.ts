import { expect, test } from '@playwright/test'

test('두 줄을 한 줄로 줄이면 원본 컴포저의 높이와 배치로 돌아온다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  const pill = page.locator('.client-home-pill')
  await input.fill('짧은 질문')
  const initialHeight = (await pill.boundingBox())!.height
  await input.fill('첫 줄 질문\n둘째 줄 질문')
  await expect(pill).toHaveClass(/is-multiline/)
  await input.fill('짧은 질문')
  await expect(pill).not.toHaveClass(/is-multiline/)
  await expect.poll(async () => Math.abs((await pill.boundingBox())!.height - initialHeight)).toBeLessThan(1)
  await expect(input).toHaveValue('짧은 질문')
  await expect(input).toBeFocused()
})

test('줄 경계에서 레이아웃이 진동하지 않고 넓히면 한 줄로 복귀한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  const pill = page.locator('.client-home-pill')
  await input.fill('비트코인과 이더리움의 최근 흐름을 비교해주세요')
  await expect(pill).toHaveClass(/is-multiline/)
  await page.evaluate(() => {
    const el = document.querySelector('.client-home-pill')!
    let last = el.classList.contains('is-multiline')
    const changes: boolean[] = []
    const observer = new MutationObserver(() => {
      const next = el.classList.contains('is-multiline')
      if (last !== next) { changes.push(next); last = next }
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    Object.assign(window, { sizingChanges: changes, stopSizingObservation: () => observer.disconnect() })
  })
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => Reflect.get(window, 'sizingChanges'))).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'stopSizingObservation')())
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(pill).not.toHaveClass(/is-multiline/)
  await expect(input).toHaveValue('비트코인과 이더리움의 최근 흐름을 비교해주세요')
})

test('템플릿·최대 높이·전체화면 왕복 후에도 짧은 초안 배치로 복귀한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.g-tpl[data-id="btc"]').click()
  const input = page.locator('#strategy-idea')
  await input.fill('긴 질문\n'.repeat(30))
  await expect.poll(() => input.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto')
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  await input.fill('짧은 질문')
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-home-pill')).not.toHaveClass(/is-multiline|is-fullscreen/)
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('짧은 질문')
  await expect.poll(() => input.evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden')
  await expect(page.getByRole('button', { name: 'BTC 선택 해제' })).toBeVisible()
})
