import { expect, test, type Page } from '@playwright/test'
import { lifecycleText } from '../src/client-trade-lifecycle-copy'

const titles = ['진입 결정', '주문 생성', '체결', '포지션 관리', '청산 결정', '청산 체결', '최종 결과']

test('언어 설정은 열린 거래 추적의 접근성 안내에 적용되고 공급 원문·초점은 유지된다', async ({ page }) => {
  await mount(page)
  const root = page.locator('.client-trade-lifecycle'), element = await root.elementHandle()
  const values = await root.locator('.v2').allTextContents(), descriptions = await root.locator('.b2 p').allTextContents()
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'en') })
  await expect(root.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await expect(root.getByRole('region', { name: 'Trade decision log', exact: true })).toBeVisible()
  expect(await element!.evaluate(el => el === document.querySelector('.client-trade-lifecycle'))).toBe(true)
  expect(await root.locator('.v2').allTextContents()).toEqual(values)
  expect(await root.locator('.b2 p').allTextContents()).toEqual(descriptions)
  await page.keyboard.press('Escape')
  await expect(page.locator('#trade-trigger')).toBeFocused()
})

async function mount(page: Page, options: { nested?: boolean; long?: boolean; empty?: boolean; nullTrigger?: boolean } = {}) {
  await page.route('**/trade-lifecycle-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:sans-serif"><div id="fixture"></div></body></html>' }))
  await page.goto('/trade-lifecycle-test.html')
  await page.evaluate(async ({ options, titles }) => {
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/node_modules/@fontsource-variable/noto-sans-sc/wght.css', '/node_modules/@fontsource-variable/geist/wght.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientTradeLifecycle.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), { ClientTradeLifecycle } = await import(/* @vite-ignore */ cp)
    const react = rm.default ?? rm, h = react.createElement
    const fixture = document.getElementById('fixture')!
    let parent: HTMLDialogElement | null = null
    if (options.nested) {
      parent = document.createElement('dialog'); parent.id = 'parent-dialog'; parent.setAttribute('aria-label', '부모 터미널')
      Object.assign(parent.style, { width: '100%', height: '100dvh', maxWidth: 'none', maxHeight: 'none', margin: '0', padding: '0', border: '0' })
      document.body.append(parent); parent.append(fixture); parent.showModal(); document.body.style.overflow = 'hidden'
    }
    const state = { closes: 0 }
    function Host() {
      const [open, setOpen] = react.useState(false), [trigger, setTrigger] = react.useState(null), [hide, setHide] = react.useState(false), [remove, setRemove] = react.useState(false), [revision, setRevision] = react.useState(0)
      Object.assign(window, { hideTradeTrigger: () => setHide(true), removeTradeTrigger: () => setRemove(true), rerenderTrade: () => setRevision((n: number) => n + 1) })
      const steps = options.empty ? [] : titles.map((title, index) => ({ title, value: options.long ? '매우긴공급값'.repeat(50) : `공급 값 ${index + 1}`, description: options.long ? '공급된 판단 기록입니다. '.repeat(150) : index === 0 ? '<script>원문</script>\n두 번째 줄' : `공급 설명 ${index + 1}` }))
      return h('main', { className: 'client-account-terminal', 'data-revision': revision },
        !remove && h('button', { id: 'trade-trigger', hidden: hide, onClick: (event: { currentTarget: HTMLElement }) => { setTrigger(event.currentTarget); setOpen(true) } }, '전체 판단 기록 →'),
        h('div', { inert: true }, h('button', null, '숨은 대체 대상')),
        h('button', { id: 'trade-fallback' }, '전략 분석'),
        open && h(ClientTradeLifecycle, { title: options.long ? 'BTC LONG 거래 추적 '.repeat(8) : 'BTC LONG 거래 추적', steps, trigger: options.nullTrigger ? null : trigger, onClose: () => { state.closes++; setOpen(false) } }))
    }
    const root = (dm.createRoot ?? dm.default.createRoot)(fixture)
    Object.assign(window, { tradeState: state, unmountTrade: () => root.unmount(), closeTradeParent: () => { parent?.close(); document.body.style.overflow = '' } })
    root.render(h(react.StrictMode, null, h(Host)))
  }, { options, titles })
  await page.getByRole('button', { name: '전체 판단 기록 →' }).click()
  await expect(page.locator('.client-trade-lifecycle')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })
}

test('공급된 일곱 단계·값·설명을 순서대로 이스케이프하여 표시한다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('dialog', { name: 'BTC LONG 거래 추적' })).toBeVisible()
  await expect(page.locator('.lc1')).toHaveCount(7)
  await expect(page.locator('.lc1 b')).toHaveText(titles)
  await expect(page.locator('.n2')).toHaveText(['1', '2', '3', '4', '5', '6', '7'])
  await expect(page.locator('.lc1').first()).toContainText('<script>원문</script>')
  await expect(page.locator('.client-trade-lifecycle script')).toHaveCount(0)
  await expect(page.locator('.lc1').last()).toContainText('공급 값 7')
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})

test('StrictMode·부모 재렌더에서 포커스를 유지하고 Esc로 원래 버튼에 복귀한다', async ({ page }) => {
  await mount(page)
  const close = page.getByRole('button', { name: '닫기', exact: true })
  await expect(close).toBeFocused()
  await page.getByRole('region', { name: '거래 판단 기록' }).focus()
  await page.evaluate(() => Reflect.get(window, 'rerenderTrade')())
  await expect(page.getByRole('region', { name: '거래 판단 기록' })).toBeFocused()
  for (let index = 0; index < 4; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.client-trade-lifecycle')) || document.activeElement === document.body)).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-trade-lifecycle')).toHaveCount(0)
  await expect(page.locator('#trade-trigger')).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'tradeState').closes)).toBe(1)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('320px 긴 제목·값·설명은 가로 넘침 없이 키보드로 끝까지 읽는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 })
  await mount(page, { long: true })
  const region = page.getByRole('region', { name: '거래 판단 기록' })
  expect(await region.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeInViewport({ ratio: 1 })
  expect(await page.getByRole('button', { name: '닫기', exact: true }).evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44)
  await region.focus(); await page.keyboard.press('Control+End')
  await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(100)
  await expect(page.locator('.lc1').last()).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(page.locator('#trade-trigger')).toBeFocused()
})

test('전체화면 위에서 자식 Esc만 닫고 부모의 스크롤 잠금을 유지한다', async ({ page }) => {
  await mount(page, { nested: true })
  await expect(page.locator('#parent-dialog .client-trade-lifecycle')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('#parent-dialog')).toHaveAttribute('open', '')
  await expect(page.locator('.client-trade-lifecycle')).toHaveCount(0)
  await expect(page.locator('#trade-trigger')).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})

for (const nested of [false, true]) test(`거래 추적 IME Escape는 닫히지 않고 조합 후 Escape만 닫힌다 nested=${nested}`, async ({ page }) => {
  await mount(page, { nested })
  for (const composing of [true, false]) {
    const prevented = await page.locator('.client-trade-lifecycle .dx').evaluate((el, composing) => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: composing, keyCode: composing ? 27 : 229 })
      el.dispatchEvent(event)
      return event.defaultPrevented
    }, composing)
    expect(prevented).toBe(true)
    await expect(page.locator('.client-trade-lifecycle')).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, 'tradeState').closes)).toBe(0)
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-trade-lifecycle')).toHaveCount(0)
  await expect(page.locator('#trade-trigger')).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'tradeState').closes)).toBe(1)
  if (nested) await expect(page.locator('#parent-dialog')).toHaveAttribute('open', '')
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(nested ? 'hidden' : '')
})

for (const mode of ['hide', 'remove', 'null'] as const) test(`${mode} trigger는 숨김·inert가 아닌 안전한 대상으로 복귀한다`, async ({ page }) => {
  await mount(page, { nested: mode !== 'null', nullTrigger: mode === 'null' })
  if (mode !== 'null') await page.evaluate(action => Reflect.get(window, action)(), mode === 'hide' ? 'hideTradeTrigger' : 'removeTradeTrigger')
  await page.keyboard.press('Escape')
  await expect(page.locator(mode === 'null' ? '#trade-trigger' : '#trade-fallback')).toBeFocused()
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[inert],[hidden]')))).toBe(false)
})

test('빈 공급은 일곱 단계나 체결 성공을 생성하지 않는다', async ({ page }) => {
  await mount(page, { empty: true })
  const dialog = page.locator('.client-trade-lifecycle'), element = await dialog.elementHandle()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ p)).setClientPreference('language', language) }, language)
    await expect(page.locator('.lc1')).toHaveCount(0)
    await expect(dialog.locator('.empty')).toHaveText(lifecycleText(language, 'empty'))
    await expect(dialog.getByRole('button', { name: lifecycleText(language, 'close'), exact: true })).toBeFocused()
    expect(await element!.evaluate(el => el === document.querySelector('.client-trade-lifecycle'))).toBe(true)
  }
})

test('부모 닫힘·언마운트·경로 이탈은 모달과 스크롤 잠금을 해제한다', async ({ page }) => {
  await mount(page, { nested: true })
  await page.evaluate(() => Reflect.get(window, 'closeTradeParent')())
  await expect(page.locator('.client-trade-lifecycle')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'unmountTrade')())
  await expect(page.locator('.client-trade-lifecycle')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await mount(page)
  await page.evaluate(() => { location.hash = '#/elsewhere' })
  await expect(page.locator('.client-trade-lifecycle')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})
