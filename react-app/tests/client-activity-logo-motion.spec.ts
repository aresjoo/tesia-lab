import { expect, test, type Locator } from '@playwright/test'

async function seekLogo(logo: Locator, time: number) {
  return logo.evaluate((element, currentTime) => {
    for (const animation of element.getAnimations({ subtree: true })) {
      animation.pause()
      animation.currentTime = currentTime
    }
    const path = element.querySelector('mask path')!
    return {
      opacity: Number(getComputedStyle(element).opacity),
      offset: Number.parseFloat(getComputedStyle(path).strokeDashoffset),
      animations: element.getAnimations({ subtree: true }).map(animation => ({
        duration: animation.effect!.getTiming().duration,
        iterations: animation.effect!.getTiming().iterations,
      })),
    }
  }, time)
}

for (const scope of ['public', 'native']) {
  test(`${scope}: 원본 로고를 2.1초 드로잉·유지·페이드로 표시한다`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`/tests/fixtures/research-activity.html?${scope === 'native' ? 'native' : ''}`)
    const logo = page.locator('svg.activity-logo')
    await expect(logo).toHaveCount(1)
    await expect(logo).toHaveAttribute('aria-hidden', 'true')
    await expect(logo).toHaveAttribute('viewBox', '0 0 52 32')
    await expect(logo.locator('image')).toHaveAttribute('href', '/teth-logo-f260167.png')
    await page.evaluate(async () => {
      const asset = new Image()
      asset.src = '/teth-logo-f260167.png'
      await asset.decode()
      if (!asset.naturalWidth || !asset.naturalHeight) throw new Error('Logo asset did not decode')
    })
    const box = await logo.boundingBox()
    expect(box?.width).toBeCloseTo(22, 3)
    expect(box?.height).toBeCloseTo(14, 3)
    const start = await seekLogo(logo, 0)
    expect(start.offset).toBe(150)
    expect(start.opacity).toBe(1)
    expect(start.animations).toHaveLength(2)
    expect(start.animations.every(value => value.duration === 2100 && value.iterations === Infinity)).toBe(true)
    const drawing = await seekLogo(logo, 600)
    expect(drawing.offset).toBeGreaterThan(0)
    expect(drawing.offset).toBeLessThan(150)
    for (const time of [1218, 1764]) {
      const hold = await seekLogo(logo, time)
      expect(hold.offset).toBeCloseTo(0, 4)
      expect(hold.opacity).toBe(1)
    }
    await page.locator('.g-act2').screenshot({ path: info.outputPath(`${scope}-logo-hold.png`) })
    const fade = await seekLogo(logo, 1900)
    expect(fade.opacity).toBeGreaterThan(0)
    expect(fade.opacity).toBeLessThan(1)
    expect((await seekLogo(logo, 2016)).opacity).toBeCloseTo(0, 4)
    expect((await seekLogo(logo, 2100)).offset).toBe(150)
    await expect(page.locator('.g-act2 .ar.running')).toHaveCount(1)
  })

  test(`${scope}: 모션 감소에서 마스크를 완전히 열고 즉시 설정을 반영한다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/tests/fixtures/research-activity.html?${scope === 'native' ? 'native' : ''}`)
    const logo = page.locator('svg.activity-logo')
    await expect(logo).toHaveCount(1)
    await expect(logo).toHaveCSS('opacity', '1')
    await expect(logo.locator('mask path')).toHaveCSS('stroke-dashoffset', '0px')
    expect(await logo.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect.poll(() => logo.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(2)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(logo.locator('mask path')).toHaveCSS('stroke-dashoffset', '0px')
    await expect(logo).toHaveCSS('opacity', '1')
  })
}

test('동시 연구의 마스크 ID가 독립적이며 상태 이벤트 후 로고 모션을 제거한다', async ({ page }) => {
  await page.goto('/tests/fixtures/research-activity.html?pair')
  const logos = page.locator('svg.activity-logo')
  await expect(logos).toHaveCount(2)
  const masks = await logos.evaluateAll(elements => elements.map(element => ({
    id: element.querySelector('mask')!.id,
    mask: element.querySelector('image')!.getAttribute('mask'),
  })))
  expect(new Set(masks.map(value => value.id)).size).toBe(2)
  for (const value of masks) expect(value.mask).toBe(`url(#${value.id})`)
  const first = page.locator('.g-act2').first()
  await first.locator('.hd').click()
  await expect(first.locator('.hd')).toHaveAttribute('aria-expanded', 'false')
  await expect(first.locator('svg.activity-logo')).toHaveCount(1)
  await page.getByRole('button', { name: '완료 이벤트 주입' }).click()
  await expect(first.locator('svg.activity-logo')).toHaveCount(0)
  await expect(first.locator('.hd > .tic.done')).toBeVisible()
  await expect(logos).toHaveCount(1)
  await expect(page.locator('.g-act2').last().locator('.hlb')).toHaveText('다른 연구 진행 중')
})
