import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page) {
  await page.route('**/broker-pagination-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"><div id="root"></div></body></html>' }))
  await page.goto('/broker-pagination-audit.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/NativeBrokers.tsx', code = await (await fetch(cp)).text()
    const rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing transformed React instance')
    const dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const rm = await import(/* @vite-ignore */ rp), React = rm.default ?? rm, DOM = await import(/* @vite-ignore */ dp)
    const { NativeBrokers } = await import(/* @vite-ignore */ cp), preferences = await import(/* @vite-ignore */ pp)
    for (const css of ['/src/styles.css', '/src/client-reference.css']) await import(/* @vite-ignore */ css)
    preferences.setClientPreference('language', 'ko')
    const h = React.createElement, root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
    const reviews = Array.from({ length: 200 }, (_, i) => ({ id: i, rating: 5, text: `확인된 후기 ${i + 1}`, author: `작성자 ${i + 1}`, date: '공급 날짜', categories: ['고객 지원'] }))
    const render = (count = 200) => root.render(h(React.StrictMode, null, h(NativeBrokers, {
      onReturn: () => {}, shouldFocus: () => true, listRequest: 0, accountScope: 'pagination-owner', signedIn: true,
      presentation: { scope: 'pagination-owner', identity: 'pagination-data', catalog: [{
        broker: { id: 'binance', name: 'Pagination Broker', ord: 1, tag: '거래소', assets: 'BTC', assetsList: ['BTC'], conn: true, rating: 5, traders: '20', fw0: 0, rvN: count, col: '#aabbee', site: 'example.com' },
        connectionState: 'CONNECTED', reviews: reviews.slice(0, count),
      }] },
    })))
    render()
    Object.assign(window, { brokerPaginationRefresh: render, brokerPaginationLocale: (value: string) => preferences.setClientPreference('language', value) })
  })
  await expect(page.locator('.native-brokers')).toBeVisible()
  await page.locator('.bk2-card .obtn').click()
  await page.locator('[data-tab=reviews]').click()
}

test('200개 공급 후기에서 원본 first/last·모바일±1/desktop±2·말줄임과 이전다음을 유지한다', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile'
  await page.setViewportSize({ width: mobile ? 320 : 1440, height: 900 })
  await mount(page)
  const nav = page.locator('.bk2-pg'), numbers = nav.locator('button.n')
  await expect(numbers).toHaveText(mobile ? ['1', '2', '23'] : ['1', '2', '3', '23'])
  await expect(nav.locator('.el')).toHaveText(['...'])
  await expect(nav.getByRole('button', { name: '이전 페이지', exact: true })).toBeDisabled()
  for (let i = 1; i < 10; i++) await nav.getByRole('button', { name: '다음 페이지', exact: true }).click()
  await expect(numbers).toHaveText(mobile ? ['1', '9', '10', '11', '23'] : ['1', '8', '9', '10', '11', '12', '23'])
  await expect(nav.locator('.el')).toHaveText(['...', '...'])
  await expect(nav.locator('[aria-current=page]')).toHaveText('10')
  await expect(page.locator('.bk2-rvgrid .bk2-rvc')).toHaveCount(9)
  await expect(page.locator('.bk2-rvgrid .bk2-rvc').first()).toContainText('확인된 후기 82')
  await nav.getByRole('button', { name: '23', exact: true }).click()
  await expect(numbers).toHaveText(mobile ? ['1', '22', '23'] : ['1', '21', '22', '23'])
  await expect(nav.getByRole('button', { name: '다음 페이지', exact: true })).toBeDisabled()
  await expect(page.locator('.bk2-rvgrid .bk2-rvc')).toHaveCount(2)
  await nav.getByRole('button', { name: '이전 페이지', exact: true }).click()
  await expect(nav.locator('[aria-current=page]')).toHaveText('22')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('760px 경계 리사이즈·언어·동일 dataset 갱신에도 선택 페이지는 보존하고 번호만 축약한다', async ({ page }) => {
  await page.setViewportSize({ width: 761, height: 900 })
  await mount(page)
  const nav = page.locator('.bk2-pg')
  for (let i = 1; i < 10; i++) await nav.getByRole('button', { name: '다음 페이지', exact: true }).click()
  await expect(nav.locator('button.n')).toHaveText(['1', '8', '9', '10', '11', '12', '23'])
  await page.setViewportSize({ width: 760, height: 900 })
  await expect(nav.locator('button.n')).toHaveText(['1', '9', '10', '11', '23'])
  await page.evaluate(() => Reflect.get(window, 'brokerPaginationLocale')('fr'))
  await page.evaluate(() => Reflect.get(window, 'brokerPaginationRefresh')(200))
  await expect(nav.locator('[aria-current=page]')).toHaveText('10')
  await expect(page.locator('.bk2-rvgrid .bk2-rvc').first()).toContainText('확인된 후기 82')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(nav.locator('button.n')).toHaveText(['1', '8', '9', '10', '11', '12', '23'])
  await page.evaluate(() => Reflect.get(window, 'brokerPaginationRefresh')(9))
  await expect(nav).toHaveCount(0)
  await expect(page.locator('.bk2-rvgrid .bk2-rvc')).toHaveCount(9)
  await page.evaluate(() => Reflect.get(window, 'brokerPaginationRefresh')(200))
  await expect(nav.locator('[aria-current=page]')).toHaveText('1')
})
