import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { clientCoinIcon } from '../src/client-coin-icon'
import { marketPickerIcon } from '../src/client-market-picker'

const directory = new URL('../public/assets/coins/', import.meta.url)
const indexBytes = readFileSync(new URL('index.json', directory))
const sourceIndex: Record<string, string> = JSON.parse(indexBytes.toString())
const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')
const bytes = (name: string) => readFileSync(new URL(encodeURIComponent(name), directory))
const aliases = { 'VET.jpg': 'VET.png', 'SKL.png': 'SKL.jpg', 'API3.jpg': 'API3.png', 'APE.jpg': 'APE.png',
  'SUI.jpg': 'SUI.png', 'XAI.jpg': 'XAI.png', 'ME.jpg': 'ME.png', 'VTHO.jpg': 'VTHO.png',
  'SHELL.jpg': 'SHELL.png', 'ATH.jpg': 'ATH.png', 'MEGA.jpg': 'MEGA.png' } as const
function format(data: Uint8Array) {
  const buffer = Buffer.from(data)
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpg'
  if (buffer.subarray(0, 4096).toString().includes('<svg')) return 'svg'
  return null
}

test('fixed source index and all 717 original image bytes match the independently exported source hashes', () => {
  expect(Object.keys(sourceIndex)).toHaveLength(717)
  expect(sha256(indexBytes)).toBe('2324d193391a785a4322caa963e5ab3b91cea07588cb63bb5072782eb06e60bd')
  const originalHashes = Object.values(sourceIndex).sort().map(name => `${name}\0${sha256(bytes(name))}\n`).join('')
  expect(sha256(originalHashes)).toBe('f71b643e6bb0625ce14ed112b0e5b34087fd39a6e2c8c0fb28738d2c5380ebc6')
  for (const [symbol, original] of Object.entries(sourceIndex)) {
    const renderName = aliases[original as keyof typeof aliases] ?? original
    expect(clientCoinIcon(symbol)).toBe(`/assets/coins/${encodeURIComponent(renderName)}`)
    expect(format(bytes(renderName))).toBe(renderName.split('.').at(-1))
  }
})

test('11 extension repairs preserve original bytes and expose only same-byte render aliases', () => {
  expect(Object.keys(aliases)).toHaveLength(11)
  for (const [original, alias] of Object.entries(aliases)) {
    expect(bytes(alias).equals(bytes(original))).toBe(true)
    expect(format(bytes(alias))).toBe(alias.split('.').at(-1))
  }
})

test('known ASCII and Unicode symbols map locally; traversal, remote URLs and confusable unknowns stay absent', () => {
  expect(clientCoinIcon(' btc ')).toBe('/assets/coins/BTC.png')
  expect(clientCoinIcon('4')).toBe('/assets/coins/4.svg')
  expect(clientCoinIcon('牛来')).toBe('/assets/coins/%E7%89%9B%E6%9D%A5.png')
  expect(clientCoinIcon('币安人生')).toBe('/assets/coins/%E5%B8%81%E5%AE%89%E4%BA%BA%E7%94%9F.png')
  for (const invalid of ['', 'NO_SUCH_SOURCE_COIN', '../BTC', 'BTC/USDT', 'BTCUSDT', '__proto__', 'constructor',
    'https://example.test/BTC.png', '//example.test/BTC.png', '/assets/coins/BTC.png', '%2e%2e', 'BTC?x=1',
    'BTC#x', 'BTC\0', 'ＢＴＣ', 'ſOL', 'ΒTC', '\u202eBTC', '币安人生/../BTC']) expect(clientCoinIcon(invalid), invalid).toBeNull()
  expect(marketPickerIcon(clientCoinIcon('牛来')!)).toBe(clientCoinIcon('牛来'))
  for (const invalid of ['/assets/coins/../BTC.png', '/assets/coins/%2e%2e%2fBTC.png', '/assets/coins/BTC.png?remote=1',
    '/assets/coins/NO_SUCH_SOURCE_COIN.png', '/assets/coins/%ZZ.png', '/assets/coins/ſOL.png',
    'https://example.test/BTC.png']) expect(marketPickerIcon(invalid), invalid).toBeUndefined()
})

test('Chromium actually decodes every mapped local image and canonical mismatch responses use the correct MIME', async ({ page, request }) => {
  await page.route('**/coin-icon-assets-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/coin-icon-assets-test')
  const urls = Object.keys(sourceIndex).map(symbol => ({ symbol, url: clientCoinIcon(symbol)! }))
  const failures = await page.evaluate(async urls => {
    let next = 0
    const failures: string[] = []
    await Promise.all(Array.from({ length: 12 }, async () => {
      while (next < urls.length) {
        const { symbol, url } = urls[next++]
        const image = new Image()
        try {
          image.src = url; await image.decode()
          if (!image.naturalWidth || !image.naturalHeight) failures.push(symbol)
        } catch { failures.push(symbol) }
        image.src = ''
      }
    }))
    return failures
  }, urls)
  expect(failures).toEqual([])
  for (const alias of Object.values(aliases)) {
    const response = await request.get(`/assets/coins/${alias}`)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain(alias.endsWith('.jpg') ? 'image/jpeg' : 'image/png')
    expect(sha256(await response.body())).toBe(sha256(bytes(alias)))
  }
})

/** Real picker consumer, supplied display rows only: no prices or provider calls. */
async function mountPicker(page: Page) {
  await page.route('**/coin-icon-picker-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="coin-picker-root"></div></body></html>' }))
  await page.goto('/coin-icon-picker-test')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const pickerPath = '/src/components/ClientMarketPicker.tsx', iconsPath = '/src/client-coin-icon.ts'
    const { ClientMarketPicker } = await import(/* @vite-ignore */ pickerPath)
    const { clientCoinIcon } = await import(/* @vite-ignore */ iconsPath)
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath, rootPath = runtimePaths.rootPath
    const reactModule = await import(/* @vite-ignore */ reactPath), React = reactModule.default ?? reactModule
    const dom = await import(/* @vite-ignore */ rootPath)
    localStorage.setItem('tethLang', 'ko')
    const rows = ['BTC', '牛来', 'NO_SUCH_SOURCE_COIN'].map(symbol => ({ id: symbol, symbol,
      icon: clientCoinIcon(symbol) ?? undefined, categories: [], price: null, change: null, volume: null }))
    rows.push({ id: 'ETH', symbol: 'ETH', icon: 'https://example.test/ETH.png', categories: [], price: null, change: null, volume: null })
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('coin-picker-root')).render(React.createElement(ClientMarketPicker, {
      symbol: 'BTC', presentation: { identity: 'coin-source-test', selectedId: 'BTC', favorites: [],
        rows: { state: 'ready', value: rows }, onSelect: () => {}, onFavorite: () => {} },
    }, 'BTC'))
  })
  await page.locator('.cmp-trigger').click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('actual picker restores known local icons, preserves unknown letter fallback and image-error fallback', async ({ page }) => {
  await mountPicker(page)
  const known = page.locator('.cmp-rows li').filter({ has: page.locator('b', { hasText: /^BTC$/ }) })
  const unicode = page.locator('.cmp-rows li').filter({ has: page.locator('b', { hasText: /^牛来$/ }) })
  const unknown = page.locator('.cmp-rows li').filter({ has: page.locator('b', { hasText: /^NO_SUCH_SOURCE_COIN$/ }) })
  const badSupplied = page.locator('.cmp-rows li').filter({ has: page.locator('b', { hasText: /^ETH$/ }) })
  await expect(known.locator('img')).toHaveAttribute('src', '/assets/coins/BTC.png')
  await expect.poll(() => known.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await expect(unicode.locator('img')).toHaveAttribute('src', clientCoinIcon('牛来')!)
  await expect(unknown.locator('img')).toHaveCount(0)
  await expect(unknown.locator('.cmp-icon')).toHaveText('N')
  await expect(badSupplied.locator('img')).toHaveCount(0)
  await expect(badSupplied.locator('.cmp-icon')).toHaveText('E')
  await page.route('**/assets/coins/BTC.png*', route => route.abort())
  await known.locator('img').evaluate((image: HTMLImageElement) => { image.src = '/assets/coins/BTC.png?retry=broken' })
  await expect(known.locator('img')).toBeHidden()
  await expect(known.locator('.cmp-icon')).toHaveText('B')
})
