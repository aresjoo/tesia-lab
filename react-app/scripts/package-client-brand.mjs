// Package the approved f260167 source pixels. No recoloring or logo redrawing.
// Usage: node scripts/package-client-brand.mjs /path/to/source/assets
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (!process.argv[2]) throw new Error('Provide the approved source assets directory.')
const input = resolve(process.argv[2])
const expected = {
  'logo.png': 'fd7407e411685a3c45cc75156fc77bfc3fe1a9f310800e58b13853aede63b2dc',
  'logo-sm.png': 'b7ee2a704fc9868586cc3c077d54fb9bdfffcc75971224840959169a651c7fa8',
  'favicon.png': 'ed2f8722fe6ba17c63b2dfde65a3db7f041a6c36f1af11d0155f4768acb38246',
}
const assets = {}
for (const [file, hash] of Object.entries(expected)) {
  const bytes = await readFile(resolve(input, file))
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Unapproved source: ${file}`)
  assets[file] = bytes
}
const browser = await chromium.launch({ headless: true })
let icons
try {
  const page = await browser.newPage()
  icons = await page.evaluate(async data => {
    const logo = new Image()
    logo.src = data
    await logo.decode()
    return [180, 192, 512].map(size => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, size, size)
      // All logo pixels lie within the central 80%-diameter maskable safe circle.
      const width = size * .64, height = width * logo.naturalHeight / logo.naturalWidth
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(logo, (size - width) / 2, (size - height) / 2, width, height)
      return { size, png: canvas.toDataURL('image/png').split(',')[1] }
    })
  }, `data:image/png;base64,${assets['logo.png'].toString('base64')}`)
} finally { await browser.close() }
const publish = async (file, bytes) => {
  await writeFile(resolve(root, 'public', file), bytes)
  await writeFile(resolve(root, 'public', file.replace('.png', '-f260167.png')), bytes)
}
await publish('teth-logo.png', assets['logo-sm.png'])
await publish('favicon.png', assets['favicon.png'])
for (const { size, png } of icons) {
  const file = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
  await publish(file, Buffer.from(png, 'base64'))
}
// Compatibility URL: embedded approved favicon, never the retired atom mark.
await writeFile(resolve(root, 'public/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${assets['favicon.png'].toString('base64')}"/></svg>\n`)
console.log('Approved logo/favicon and three installation icons packaged.')
