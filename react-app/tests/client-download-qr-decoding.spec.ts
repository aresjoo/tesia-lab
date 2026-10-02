import { expect, test } from '@playwright/test'
import jsQR from 'jsqr'

// Independent decoder, not a second call to the production encoder.
const examples = [
  ['ordinary', 'https://apps.apple.com/kr/app/example-test/id1234567890', 'https://play.google.com/store/apps/details?id=org.example.test&hl=ko'],
  ['encoded', 'https://apps.apple.com/kr/app/%ED%85%8C%EC%8A%A4%ED%8A%B8/id123?l=ko', 'https://play.google.com/store/apps/details?id=org.example.test&hl=zh_TW&gl=TW'],
  ['maximum', `https://apps.apple.com/app/${'a'.repeat(512 - 'https://apps.apple.com/app//id123'.length)}/id123`, `https://play.google.com/store/apps/details?id=org.example.${'a'.repeat(512 - 'https://play.google.com/store/apps/details?id=org.example.'.length)}`],
] as const

for (const [kind, iosStoreUrl, androidStoreUrl] of examples) test(`${kind} URL QR을 실제 렌더 크기에서 독립 복호화한다`, async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 740 })
  await page.addInitScript(config => Object.assign(window, { TETH_CONFIG: config }), { iosStoreUrl, androidStoreUrl })
  await page.goto('/download/')
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('#store-ios .qr')).toBeHidden()
    await expect(page.locator('#store-ios a.link')).toBeVisible()
    await page.setViewportSize({ width: 768, height: 900 })
  }
  for (const [store, expected] of [['ios', iosStoreUrl], ['android', androidStoreUrl]]) {
    const image = page.locator(`#store-${store} .qr img`)
    await expect(image).toBeVisible()
    const png = await image.screenshot({ animations: 'disabled', scale: 'css' })
    const pixels = await page.evaluate(async base64 => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return { data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data), width: canvas.width, height: canvas.height }
    }, png.toString('base64'))
    const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)
    expect(decoded?.data, `${kind}/${store} rendered ${pixels.width}×${pixels.height}`).toBe(expected)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  if (kind === 'maximum') {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `/tmp/teth-download-qr-${testInfo.project.name}.png`, fullPage: true })
  }
})
