import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const logo = '/teth-logo-f260167.png'
const favicon = '/favicon-f260167.png'
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

test('approved source logo/favicon bytes and compatibility assets are identical', async ({ request }) => {
  for (const [name, hash] of [
    ['teth-logo', 'b7ee2a704fc9868586cc3c077d54fb9bdfffcc75971224840959169a651c7fa8'],
    ['favicon', 'ed2f8722fe6ba17c63b2dfde65a3db7f041a6c36f1af11d0155f4768acb38246'],
  ]) {
    for (const suffix of ['', '-f260167']) {
      const response = await request.get(`/${name}${suffix}.png`)
      expect(response.ok()).toBe(true)
      expect(response.headers()['content-type']).toContain('image/png')
      expect(digest(await response.body())).toBe(hash)
    }
  }
  const svg = await readFile('public/favicon.svg', 'utf8')
  expect(svg).not.toContain('ellipse')
  expect(digest(Buffer.from(svg.match(/base64,([^"]+)/)![1], 'base64'))).toBe('ed2f8722fe6ba17c63b2dfde65a3db7f041a6c36f1af11d0155f4768acb38246')
})

test('installation icons preserve the source mark inside the maskable safe circle', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', favicon)
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon-f260167.png')
  const manifest = await (await request.get('/site.webmanifest')).json()
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual(['/icon-192-f260167.png', '/icon-512-f260167.png'])
  for (const [name, size] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]] as const) {
    const data = await page.evaluate(async ({ name, size }) => {
      const img = new Image()
      img.src = `/${name}-f260167.png`
      await img.decode()
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0)
      const rgba = ctx.getImageData(0, 0, size, size).data
      let marked = 0, outside = 0, transparent = 0
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        if (rgba[i + 3] !== 255) transparent++
        if (rgba[i] + rgba[i + 1] + rgba[i + 2] > 12) {
          marked++
          if (Math.hypot(x + .5 - size / 2, y + .5 - size / 2) > size * .4) outside++
        }
      }
      return { width: img.naturalWidth, height: img.naturalHeight, marked, outside, transparent }
    }, { name, size })
    expect(data).toMatchObject({ width: size, height: size, outside: 0, transparent: 0 })
    expect(data.marked).toBeGreaterThan(size * size * .08)
    expect(await readFile(`public/${name}.png`)).toEqual(await readFile(`public/${name}-f260167.png`))
  }
})

for (const width of [320, 1440]) test(`${width}px source brand on home, drawer and three document headers`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator(width === 320 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  const brand = page.locator('.client-sidebar.mobile-open .client-drawer-brand')
  await expect(brand.locator('strong')).toHaveCSS('color', 'rgb(0, 240, 255)')
  await expect(brand.locator('img')).toHaveAttribute('src', logo)
  await page.keyboard.press('Escape')
  const footer = page.locator('.client-site-footer')
  await expect(footer).toHaveCSS('background-color', 'rgb(0, 240, 255)')
  await expect(footer.locator('.gft-in')).toHaveCSS('border-top-width', '2px')
  await expect(footer.locator('.gft-rule')).toHaveCSS('height', '2px')
  await expect(footer.locator('.gft-wm')).toHaveCSS('fill', 'rgb(12, 13, 15)')
  await footer.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('home-cyan-footer.png') })
  for (const path of ['/about/', '/download/', '/policies/']) {
    await page.goto(path)
    await expect(page.locator('.client-public-page .hd .brand')).toHaveCSS('color', 'rgb(0, 240, 255)')
    await expect(page.locator('.client-public-page .hd .brand img')).toHaveAttribute('src', logo)
    await expect(footer).toHaveCSS('background-color', 'rgb(0, 0, 0)')
    await expect(footer.locator('.gft-wm')).toHaveCSS('fill', 'rgb(0, 240, 255)')
    expect(await page.locator('.client-public-page .hd .brand img').evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 256)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})
