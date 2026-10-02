import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import qrcode from 'qrcode-generator'
import { resolveDownloadConfig, validateStoreUrl } from '../src/client-download-config'
import publicCopy from '../src/client-public-copy.json' with { type: 'json' }
import { downloadText } from '../src/client-download-copy'

test.use({ actionTimeout: 10_000 })

// Synthetic public identifiers, never production publication claims.
const stores = {
  iosStoreUrl: 'https://apps.apple.com/kr/app/example-test/id1234567890',
  androidStoreUrl: 'https://play.google.com/store/apps/details?id=org.example.test&hl=ko',
}

test('공급된 공식 스토어 URL만 실제 링크와 로컬 QR로 표시한다', async ({ page }) => {
  const external: string[] = []
  page.on('request', request => {
    if (/qrserver|apps\.apple|play\.google/.test(request.url())) external.push(request.url())
  })
  await page.addInitScript(config => { Object.assign(window, { TETH_CONFIG: config }) }, stores)
  await page.goto('/download/')
  for (const [store, url] of [['android', stores.androidStoreUrl], ['ios', stores.iosStoreUrl]]) {
    const row = page.locator(`#store-${store}`)
    await expect(row.locator('a.link')).toHaveAttribute('href', url)
    await expect(row.locator('a.link')).toHaveAttribute('target', '_blank')
    await expect(row.locator('a.link')).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(row.locator('.qr img')).toHaveAttribute('src', /^data:image\/gif;base64,/)
    expect(await row.locator('.qr img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    const qr = qrcode(0, 'M')
    qr.addData(url, 'Byte')
    qr.make()
    await expect(row.locator('.qr img')).toHaveAttribute('src', qr.createDataURL(4, 16))
    await row.locator('a.link').focus()
    await expect(row.locator('a.link')).toBeFocused()
  }
  await expect(page.locator('.qr.todo')).toHaveCount(0)
  expect(external).toEqual([])
})

test('공식 app 경로만 허용하고 credentials·우회 authority·비밀 query·중복 query를 거절한다', () => {
  for (const [store, url] of [['ios', stores.iosStoreUrl], ['android', stores.androidStoreUrl]] as const) {
    expect(validateStoreUrl(store, url)).toBe(url)
    for (const value of [undefined, null, {}, [], 1, '', ` ${url}`, `${url}\n`, `${url}#`, `${url}#token=secret`, url.replace('https:', 'http:'), url.replace('https:', 'javascript:'), url.replace('https://', '//'), url.replace('.com/', '.com.evil.invalid/'), url.replace('.com/', '.com:443/'), url.replace('https://', 'https://user:secret@'), url.replace('.com/', '.com\\'), `${url}${url.includes('?') ? '&' : '?'}token=secret`, `${url}${url.includes('?') ? '&' : '?'}redirect=https://evil.invalid`, url.replace('/app/', '/other/'), url + 'a'.repeat(513)]) {
      // '/app/' does not occur in the Android path.
      if (value !== url) expect(validateStoreUrl(store, value), String(value)).toBeNull()
    }
  }
  for (const suffix of ['?id=org.example.a&id=org.example.b', '?id=org.example.a&hl=en&hl=ko', '?id=org.example.a&hl=%0A', '?id=org.example.a&gl=secret', '?id=single', '?id=org.%2Fsecret', '?id=org.example.a&referrer=token']) expect(validateStoreUrl('android', `https://play.google.com/store/apps/details${suffix}`)).toBeNull()
  for (const path of ['/kr/app/name/id0', '/kr/app/../app/id123', '/kr/app/%2e%2e/id123', '/kr/app/%2fhidden/id123', '/kr/app/%00hidden/id123', '/kr/app/%E2%80%AEhidden/id123', '/kr/app/%FF/id123', '/kr/app/id123?l=en&l=ko', '/kr/app/id123?l=secret']) expect(validateStoreUrl('ios', `https://apps.apple.com${path}`)).toBeNull()
  for (const path of ['/app/id123', '/kr/app/id123', '/kr/app/%ED%85%8C%EC%8A%A4%ED%8A%B8/id123?l=ko']) expect(validateStoreUrl('ios', `https://apps.apple.com${path}`)).toBe(`https://apps.apple.com${path}`)
  expect(validateStoreUrl('android', stores.androidStoreUrl + '&gl=KR')).toBe(stores.androidStoreUrl + '&gl=KR')
  expect(validateStoreUrl('ios', stores.androidStoreUrl)).toBeNull()
  expect(validateStoreUrl('android', stores.iosStoreUrl)).toBeNull()
  const longest = `https://apps.apple.com/app/${'a'.repeat(512 - 'https://apps.apple.com/app//id123'.length)}/id123`
  expect(longest).toHaveLength(512)
  expect(validateStoreUrl('ios', longest)).toBe(longest)
  expect(validateStoreUrl('ios', longest.replace('/id123', 'a/id123'))).toBeNull()
})

test('runtime 명시값은 빈값·오류도 build보다 우선하고 미공급은 null이다', () => {
  expect(resolveDownloadConfig(undefined)).toEqual({ iosStoreUrl: null, androidStoreUrl: null })
  expect(resolveDownloadConfig(undefined, stores)).toEqual(stores)
  expect(resolveDownloadConfig({ iosStoreUrl: '' }, stores)).toEqual({ iosStoreUrl: null, androidStoreUrl: stores.androidStoreUrl })
  expect(resolveDownloadConfig({ androidStoreUrl: 'https://evil.invalid' }, stores)).toEqual({ iosStoreUrl: stores.iosStoreUrl, androidStoreUrl: null })
  expect(resolveDownloadConfig({ iosStoreUrl: null, androidStoreUrl: undefined }, stores)).toEqual({ iosStoreUrl: null, androidStoreUrl: null })
  expect(resolveDownloadConfig(Object.create(stores))).toEqual({ iosStoreUrl: null, androidStoreUrl: null })
})

test('설치된 encoder는 저자 배포 GIF golden을 그대로 만들고 생성된 URL 이미지는 서로 다르다', async () => {
  const reference = await readFile('node_modules/qrcode-generator/test/qrcode-test-impl.js', 'utf8')
  const golden = /var correctImgData = '([^']+)'/.exec(reference)?.[1]
  expect(golden).toBeTruthy()
  const qr = qrcode(0, 'M')
  // The author's UTF-8 byte-string example; production URL input is ASCII.
  qr.addData(Buffer.from('http://www.example.com/ążśźęćńół', 'utf8').toString('latin1'))
  qr.make()
  expect(qr.createDataURL()).toBe('data:image/gif;base64,' + golden)
  const images = Object.values(stores).map(url => {
    const value = qrcode(0, 'M')
    value.addData(url, 'Byte'); value.make()
    return value.createDataURL(4, 16)
  })
  expect(images[0]).not.toBe(images[1])
})

test('명시적인 클릭과 키보드 Enter만 새 스토어 창을 열고 opener를 공유하지 않는다', async ({ page }) => {
  const opened: string[] = []
  await page.context().route(/^https:\/\/(?:apps\.apple\.com|play\.google\.com)\//, route => {
    opened.push(route.request().url())
    return route.fulfill({ contentType: 'text/html', body: '<title>Test destination, not a published app</title>' })
  })
  await page.addInitScript(config => { Object.assign(window, { TETH_CONFIG: config }) }, stores)
  await page.goto('/download/')
  await expect(page.locator('.store a')).toHaveCount(2)
  expect(opened).toEqual([])
  for (const store of ['ios', 'android']) {
    const next = page.waitForEvent('popup')
    const link = page.locator(`#store-${store} a.link`)
    if (store === 'ios') await link.click()
    else { await link.focus(); await page.keyboard.press('Enter') }
    const popup = await next
    await popup.waitForLoadState('domcontentloaded')
    expect(await popup.evaluate(() => window.opener === null)).toBe(true)
    expect(popup.url()).toBe(store === 'ios' ? stores.iosStoreUrl : stores.androidStoreUrl)
    await popup.close()
  }
  expect(opened).toEqual([stores.iosStoreUrl, stores.androidStoreUrl])
})

test('위험한 설정은 DOM·QR·요청에 유출되지 않고 준비 중 상태를 유지한다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { requests.push(request.url()) })
  await page.addInitScript(() => { Object.assign(window, { TETH_CONFIG: { iosStoreUrl: 'https://user:fake-secret@apps.apple.com/kr/app/id123', androidStoreUrl: 'https://play.google.com/store/apps/details?id=org.example.test&token=fake-secret' } }) })
  await page.goto('/download/')
  await expect(page.locator('.qr.todo')).toHaveCount(2)
  await expect(page.locator('.store a, .qr img')).toHaveCount(0)
  expect(await page.locator('.stores').innerHTML()).not.toContain('fake-secret')
  expect(requests.some(url => /fake-secret|qrserver|apps\.apple|play\.google/.test(url))).toBe(false)
})

test('기본 미출시와 공급 상태 모두 7언어·320px에서 원본 SVG와 모바일 미리보기를 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 850 })
  await page.goto('/download/')
  const labels = ['한국어', 'English', '日本語', '简体中文', '繁體中文', 'Español', 'Français']
  const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
  const expectedPending = ['출시 준비 중', 'Preparing for launch', '公開準備中', '即将推出', '即將推出', 'Preparando el lanzamiento', 'Lancement en préparation']
  for (const [index, language] of languages.entries()) {
    await page.locator('.public-language-trigger').click()
    await page.getByRole('button', { name: labels[index], exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('.qr.todo').first()).toContainText(expectedPending[index])
    if (index !== 0) await expect(page.locator('.stores')).not.toContainText('준비')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  await page.addInitScript(config => { Object.assign(window, { TETH_CONFIG: config }) }, stores)
  await page.reload()
  const initialImage = await page.locator('#store-ios img').getAttribute('src')
  for (const [index, language] of languages.entries()) {
    await page.locator('.public-language-trigger').click()
    await page.getByRole('button', { name: labels[index], exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('#store-ios .store-copy .mo')).toHaveText(downloadText(language, 'install'))
    await expect(page.locator('#store-android .store-copy .mo')).toHaveText(downloadText(language, 'install'))
    await expect(page.locator('.store a.link').first()).toHaveText(publicCopy.download.linkOpen[index])
    await expect(page.locator('.store>svg')).toHaveCount(2)
    await expect(page.locator('#store-android>svg path')).toHaveCount(4)
    await expect(page.locator('#store-ios img')).toHaveAttribute('src', initialImage!)
    await expect(page.locator('.phone-preview')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  await page.screenshot({ path: info.outputPath('download-ready-320-fr.png'), fullPage: true })
})

test('실제 service 빌드도 같은 다운로드 컴포넌트에서 build URL과 runtime 비활성화를 사용한다', async ({ page }, info) => {
  test.setTimeout(180_000)
  const output = await mkdtemp(join(tmpdir(), 'teth-download-service-'))
  const result = await promisify(execFile)('npm', ['run', 'build:service', '--', '--outDir', output], {
    env: { ...process.env, VITE_TETH_IOS_STORE_URL: stores.iosStoreUrl, VITE_TETH_ANDROID_STORE_URL: '', TETH_LOCAL_BACKEND_URL: '', TETH_OWNER_LOCAL_SERVICE_URL: '' },
    timeout: 150_000, maxBuffer: 8 * 1024 * 1024,
  })
  await info.attach('service-build', { body: output + '\n' + result.stdout, contentType: 'text/plain' })
  const requests: string[] = []
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    const file = path === '/' ? 'internal-poc.html' : path.slice(1)
    if (file.includes('..')) return route.abort()
    try {
      const body = await readFile(join(output, file))
      const contentType = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream'
      return route.fulfill({ contentType, body })
    } catch { return route.abort() }
  })
  await page.goto('/#/site/download')
  await expect(page.locator('#store-ios a.link')).toHaveAttribute('href', stores.iosStoreUrl)
  await expect(page.locator('#store-android .store-copy')).toContainText('앱을 준비하고 있습니다.')
  await page.addInitScript(config => { Object.assign(window, { TETH_CONFIG: { ...config, iosStoreUrl: '' } }) }, stores)
  await page.reload()
  await expect(page.locator('#store-ios .store-copy')).toContainText('앱을 준비하고 있습니다.')
  await expect(page.locator('#store-android a.link')).toHaveAttribute('href', stores.androidStoreUrl)
  expect(requests.some(path => path.startsWith('/api/'))).toBe(false)
})
