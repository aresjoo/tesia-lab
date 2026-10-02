import { expect, test, type Page } from '@playwright/test'

type Options = { context?: 'follow' | 'backtest' | 'quota' | 'plan' | 'bk'; name?: string; freeUsed?: number; uid?: boolean; subscribe?: boolean; later?: boolean; underlyingInert?: boolean; nested?: boolean }
async function mount(page: Page, options: Options = {}) {
  await page.route('**/upgrade-sheet-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:sans-serif;background:#0f1012"><div id="root"><div id="fixture"></div></div></body></html>' }))
  await page.goto('/upgrade-sheet-test.html')
  await page.evaluate(async options => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientUpgradeSheet.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), { ClientUpgradeSheet } = await import(/* @vite-ignore */ cp)
    const react = rm.default ?? rm, h = react.createElement
    const fixture = document.getElementById('fixture')!
    if (options.nested) {
      const parent = document.createElement('dialog'); parent.id = 'upgrade-parent'; parent.setAttribute('aria-label', '부모 화면')
      document.body.append(parent); parent.append(fixture); parent.showModal(); document.body.style.overflow = 'hidden'
    }
    const state = { calls: [] as string[], behavior: 'success', settle: (failed: boolean) => { void failed } }
    const link = async () => {
      state.calls.push('uid')
      if (state.behavior === 'error') throw new Error('PRIVATE_TOKEN_SHOULD_NOT_RENDER')
      if (state.behavior === 'pending') await new Promise<void>((resolve, reject) => { state.settle = failed => failed ? reject(new Error('PRIVATE_TOKEN_SHOULD_NOT_RENDER')) : resolve() })
    }
    function Host() {
      const [open, setOpen] = react.useState(false), [anchor, setAnchor] = react.useState(null), [context, setContext] = react.useState(options.context ?? 'plan')
      Object.assign(window, { upgradeState: state, replaceUpgrade: setContext, hideUpgrade: () => setOpen(false) })
      return h(react.Fragment, null,
        h('button', { id: 'upgrade-trigger', onClick: (event: { currentTarget: HTMLElement }) => {
          if (options.underlyingInert) { document.getElementById('root')!.inert = true; document.body.style.overflow = 'hidden' }
          setAnchor(event.currentTarget); setOpen(true)
        } }, '업그레이드 열기'), h('button', { id: 'background' }, '배경'),
        open && h(ClientUpgradeSheet, { context, name: options.name, freeUsed: options.freeUsed, trigger: anchor,
          onClose: () => { state.calls.push('close'); setOpen(false) }, onLater: options.later ? () => state.calls.push('later') : undefined,
          onSubscribe: options.subscribe ? () => state.calls.push('subscribe') : undefined, onLinkUid: options.uid ? link : undefined }))
    }
    const root = (dm.createRoot ?? dm.default.createRoot)(fixture)
    Object.assign(window, { unmountUpgrade: () => root.unmount() })
    root.render(h(react.StrictMode, null, h(Host)))
  }, options)
  await page.getByRole('button', { name: '업그레이드 열기' }).click()
  await expect(page.locator('.client-upgrade-sheet')).toBeVisible()
}
async function calls(page: Page) { return page.evaluate(() => Reflect.get(window, 'upgradeState').calls) }
async function behavior(page: Page, value: string) { await page.evaluate(value => { Reflect.get(window, 'upgradeState').behavior = value }, value) }
async function settle(page: Page, failed = false) { await page.evaluate(value => Reflect.get(window, 'upgradeState').settle(value), failed) }
async function preference(page: Page, key: 'language' | 'currency', value: string) {
  await page.evaluate(async ({ key, value }) => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference(key, value)
  }, { key, value })
}

test('열린 공통 시트의 모든 문구는 7언어를 따르고 원문 이름·크레딧·동일 DOM을 보존한다', async ({ page }) => {
  await mount(page, { context: 'bk', name: '<원문 거래소 {used}>', freeUsed: 3 })
  const sheet = page.locator('.client-upgrade-sheet')
  await sheet.evaluate(el => Reflect.set(window, 'sameUpgradeSheet', el))
  const original = await sheet.innerText()
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await preference(page, 'language', language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    if (language !== 'ko') await expect.poll(async () => /[가-힣]/.test((await sheet.innerText()).replace('<원문 거래소 {used}>', ''))).toBe(false)
    else await expect(sheet).toHaveText(original.replace(/\n/g, ' '), { useInnerText: true })
    const text = await sheet.innerText()
    if (language !== 'ko') expect(text.replace('<원문 거래소 {used}>', '')).not.toMatch(/[가-힣]/)
    else expect(text).toBe(original)
    await expect(sheet.locator('h2')).toContainText('<원문 거래소 {used}>')
    await expect(sheet.locator('.big').first()).toContainText('1,000C')
    expect(await sheet.evaluate(el => el === Reflect.get(window, 'sameUpgradeSheet'))).toBe(true)
    await expect(sheet.locator('.nfx-btn')).toHaveCount(2)
    for (const button of await sheet.locator('.nfx-btn').all()) await expect(button).toBeDisabled()
  }
  await preference(page, 'currency', 'BTC')
  expect(await sheet.innerText()).toBe(original)
  expect(await calls(page)).toEqual([])
})

test('언어 변경은 UID 요청·오류·초점을 유지하고 원본 상태를 다시 요청하지 않는다', async ({ page }) => {
  await mount(page, { uid: true, subscribe: true, later: true })
  const sheet = page.locator('.client-upgrade-sheet')
  await behavior(page, 'pending')
  await sheet.locator('.nfx-btn.pri').click()
  await sheet.locator('.x').focus()
  await preference(page, 'language', 'en')
  await expect(sheet.getByRole('status')).not.toContainText('연동 요청 중')
  await expect(sheet.locator('.x')).toBeFocused()
  await expect(sheet.locator('.nfx-btn.pri')).toBeDisabled()
  expect(await calls(page)).toEqual(['uid'])
  await settle(page, true)
  await expect(sheet.getByRole('alert')).toBeVisible()
  expect(await sheet.getByRole('alert').innerText()).not.toMatch(/[가-힣]/)
  await preference(page, 'language', 'ko')
  await expect(sheet.getByRole('alert')).toHaveText('요청을 완료하지 못했습니다. 다시 시도해주세요.')
  expect(await calls(page)).toEqual(['uid'])
  await behavior(page, 'success')
  await sheet.locator('.nfx-btn.pri').click()
  await expect(sheet).toHaveCount(0)
  expect(await calls(page)).toEqual(['uid', 'uid', 'close'])
})

for (const width of [320, 640, 641, 768, 1440]) test(`${width}px 다국어 긴 문구와 사용량 누락은 잘림 없이 읽히고 모든 진입점을 번역한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 600 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page)
  await page.evaluate(async () => {
    for (const path of ['/src/styles.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
  })
  const sheet = page.locator('.client-upgrade-sheet')
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await preference(page, 'language', language)
    for (const context of ['follow', 'backtest', 'quota', 'plan', 'bk']) {
      await page.evaluate(context => Reflect.get(window, 'replaceUpgrade')(context), context)
      await expect(sheet).toBeVisible()
      if (language !== 'ko') await expect.poll(async () => /[가-힣]/.test(await sheet.innerText())).toBe(false)
      expect(await sheet.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
      if (context === 'quota') {
        await expect(sheet.locator('.quota-unavailable')).toBeVisible()
        await expect(sheet.locator('.nfxu-quota b')).toContainText('—')
        await expect(sheet.locator('.nfxu-later')).toHaveCount(0)
      }
      for (const button of await sheet.locator('.nfx-btn').all()) {
        expect(await button.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
        expect(await button.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(0)
      }
      await sheet.evaluate(el => { el.scrollTop = el.scrollHeight })
      await expect(sheet.locator('.nfxu-foot')).toBeInViewport({ ratio: .95 })
      if (language === 'fr' && context === 'plan') {
        await page.screenshot({ path: info.outputPath(`upgrade-fr-bottom-${width}.png`) })
        await sheet.evaluate(el => { el.scrollTop = 0 })
        await expect(sheet).toHaveJSProperty('scrollTop', 0)
        await expect(sheet.locator('.nfxu-hd')).toBeInViewport({ ratio: 1 })
        await page.screenshot({ path: info.outputPath(`upgrade-fr-top-${width}.png`) })
        if (width > 640) {
          const tops = await sheet.locator('.nfx-btn').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top))
          expect(Math.abs(tops[0] - tops[1])).toBeLessThanOrEqual(1)
        }
      }
    }
  }
})

test('641px CTA는 대기·진행·실패와 빈 상태 행 모두 같은 높이를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 641, height: 600 })
  await mount(page, { uid: true, subscribe: true, later: true })
  const sheet = page.locator('.client-upgrade-sheet')
  const aligned = async () => {
    // Hover lifts the pointed card/button intentionally. Measure the shared
    // resting baseline after moving away, not midway through that transition.
    await page.mouse.move(1, 1)
    await expect.poll(async () => {
      const tops = await sheet.locator('.nfx-btn').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top))
      return Math.abs(tops[0] - tops[1])
    }).toBeLessThanOrEqual(1)
    const rectangles = await sheet.locator('.nfx-btn').evaluateAll(elements => elements.map(el => ({ top: el.getBoundingClientRect().top, overflow: el.scrollWidth - el.clientWidth })))
    expect(Math.abs(rectangles[0].top - rectangles[1].top)).toBeLessThanOrEqual(1)
    expect(rectangles.every(rect => rect.overflow <= 1)).toBe(true)
  }
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await preference(page, 'language', language)
    await behavior(page, 'pending')
    await aligned()
    await sheet.locator('.nfx-btn.pri').click()
    await expect(sheet.getByRole('status')).toBeVisible()
    await aligned()
    await settle(page, true)
    await expect(sheet.getByRole('alert')).toBeVisible()
    await aligned()
  }
  expect(await calls(page)).toEqual(Array(7).fill('uid'))
})

test('공용 시트는 닫기와 나중에 이후 기존 스크롤 스타일 우선순위를 복원한다', async ({ page }) => {
  await mount(page, { context: 'follow', later: true })
  await page.keyboard.press('Escape')
  for (const action of ['닫기', '나중에 하기']) {
    await page.evaluate(() => document.body.style.setProperty('overflow', 'auto', 'important'))
    await page.getByRole('button', { name: '업그레이드 열기', exact: true }).click()
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await page.getByRole('button', { name: action, exact: true }).click()
    await expect(page.locator('.client-upgrade-sheet')).toHaveCount(0)
    expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual(['auto', 'important'])
  }
})

test('시트가 열린 뒤 다른 소유자가 바꾼 important 잠금은 닫을 때 덮지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => document.body.style.setProperty('overflow', 'hidden', 'important'))
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-upgrade-sheet')).toHaveCount(0)
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual(['hidden', 'important'])
})

test('다섯 진입점 원문과 두 상품·원본 SVG·시뮬레이션 경계를 표시한다', async ({ page }) => {
  const headings = { follow: '이 전략을 따라하려면 연결이 필요해요', backtest: '검증을 통과했어요. 실행하려면 연결하세요', quota: '무료 분석 사용량을 모두 썼어요', plan: 'PRO 로 업그레이드', bk: '거래소 연결에는 플랜이 필요해요' }
  for (const context of ['follow', 'backtest', 'quota', 'plan', 'bk'] as const) {
    await mount(page, { context, name: '거래소', freeUsed: 12 })
    await expect(page.getByRole('dialog', { name: headings[context] })).toBeVisible()
    await expect(page.locator('.nfxu-cards .nfxu-card')).toHaveCount(2)
    await expect(page.locator('.nfxu-card').first()).toContainText('PRO 심층 분석 100회분 크레딧')
    await expect(page.locator('.nfxu-card').first()).toContainText('1,000C')
    await expect(page.locator('.nfxu-foot')).toContainText('체험 모드예요. 결제와 연동은 시뮬레이션이에요.')
    await expect(page.locator('.nfx-btn.pri polygon')).toHaveAttribute('points', '13 2 3 14 12 14 11 22 21 10 12 10 13 2')
    if (context === 'quota') {
      await expect(page.locator('.nfxu-quota')).toContainText('10 / 10회 사용')
      await expect(page.getByRole('button', { name: '나중에 하기' })).toHaveCount(0)
    }
    await page.keyboard.press('Escape')
  }
})

test('미공급 UID·구독은 disabled이며 결제·연결 성공을 만들지 않는다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('button', { name: '무료로 연동하기' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '무료로 연동하기' })).toHaveAccessibleDescription('UID 연동 기능을 준비 중이에요.')
  await expect(page.getByRole('button', { name: '구독으로 업그레이드' })).toBeDisabled()
  await expect(page.locator('.client-upgrade-sheet')).not.toContainText('연동 완료')
  expect(await calls(page)).toEqual([])
  await page.getByRole('button', { name: '나중에 하기' }).click()
  expect(await calls(page)).toEqual(['close'])
})

test('따라하기 나중에·구독은 닫은 뒤 제공 콜백으로만 이어진다', async ({ page }) => {
  await mount(page, { context: 'follow', later: true })
  await page.getByRole('button', { name: '나중에 하기' }).click()
  expect(await calls(page)).toEqual(['close', 'later'])
  await mount(page, { subscribe: true })
  await page.getByRole('button', { name: '구독으로 업그레이드' }).click()
  expect(await calls(page)).toEqual(['close', 'subscribe'])
})

test('UID pending은 중복·다른 행동을 잠그고 실패 후 같은 시트에서 재시도한다', async ({ page }) => {
  await mount(page, { uid: true, subscribe: true, later: true })
  await behavior(page, 'pending')
  const uid = page.getByRole('button', { name: '무료로 연동하기' })
  await uid.click(); await uid.dispatchEvent('click')
  expect(await calls(page)).toEqual(['uid'])
  await expect(uid).toBeDisabled()
  await expect(page.getByRole('button', { name: '나중에 하기' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '구독으로 업그레이드' })).toBeDisabled()
  await expect(page.getByRole('status')).toHaveText('연동 요청 중…')
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveText('요청을 완료하지 못했습니다. 다시 시도해주세요.')
  await expect(page.locator('body')).not.toContainText('PRIVATE_TOKEN')
  await expect(uid).toBeEnabled()
  await behavior(page, 'success'); await uid.click()
  await expect(page.locator('.client-upgrade-sheet')).toHaveCount(0)
  expect(await calls(page)).toEqual(['uid', 'uid', 'close'])
  await expect(page.locator('#upgrade-trigger')).toBeFocused()
})

test('pending 중 Esc·외부 언마운트 후 늦은 resolve와 reject는 새 콜백을 만들지 않는다', async ({ page }) => {
  for (const failed of [false, true]) {
    await mount(page, { uid: true }); await behavior(page, 'pending')
    await page.getByRole('button', { name: '무료로 연동하기' }).click()
    await page.keyboard.press('Escape')
    await settle(page, failed)
    await expect(page.locator('.client-upgrade-sheet')).toHaveCount(0)
    expect(await calls(page)).toEqual(['uid', 'close'])
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  }
  await mount(page, { uid: true }); await behavior(page, 'pending')
  await page.getByRole('button', { name: '무료로 연동하기' }).click()
  await page.evaluate(() => Reflect.get(window, 'unmountUpgrade')())
  await settle(page, true)
  expect(await calls(page)).toEqual(['uid'])
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('이전 context UID 응답은 교체된 quota 시트를 닫거나 변경하지 않는다', async ({ page }) => {
  await mount(page, { context: 'follow', uid: true }); await behavior(page, 'pending')
  await page.getByRole('button', { name: '무료로 연동하기' }).click()
  await page.evaluate(() => Reflect.get(window, 'replaceUpgrade')('quota'))
  await expect(page.getByRole('dialog', { name: '무료 분석 사용량을 모두 썼어요' })).toBeVisible()
  await settle(page)
  await expect(page.getByRole('dialog', { name: '무료 분석 사용량을 모두 썼어요' })).toBeVisible()
  expect(await calls(page)).toEqual(['uid'])
  await expect(page.locator('.nfxu-quota')).toContainText('사용량이 제공되지 않았습니다.')
  await page.keyboard.press('Escape')
})

test('이미 inert인 앱·중첩 부모의 잠금을 해제하지 않고 안전하게 닫는다', async ({ page }) => {
  await mount(page, { underlyingInert: true })
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  await expect(page.locator('#root')).toHaveAttribute('inert')
  await page.keyboard.press('Escape')
  await expect(page.locator('#root')).toHaveAttribute('inert')
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[inert]')))).toBe(false)
  await mount(page, { nested: true })
  await expect(page.locator('#upgrade-parent .client-upgrade-sheet')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('#upgrade-parent')).toHaveAttribute('open', '')
  await expect(page.locator('#upgrade-trigger')).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})

test('320px 긴 이름·resize·감소 모션에서 44px 버튼과 끝까지 읽기를 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 480 })
  await mount(page, { context: 'follow', name: '<img onerror=alert(1)>'.repeat(30), uid: true, subscribe: true, later: true })
  const sheet = page.locator('.client-upgrade-sheet')
  await expect(sheet.locator('img')).toHaveCount(0)
  await expect(sheet).toHaveCSS('animation-name', 'none')
  expect(await sheet.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeInViewport({ ratio: 1 })
  expect(await page.getByRole('button', { name: '닫기', exact: true }).evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44)
  await page.getByRole('button', { name: '나중에 하기' }).focus()
  await expect(page.getByRole('button', { name: '나중에 하기' })).toBeInViewport({ ratio: .95 })
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(sheet).toHaveCSS('width', '680px')
  expect(await sheet.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('#upgrade-trigger')).toBeFocused()
})

test('Tab은 modal 밖으로 나가지 않고 조합 Escape·안쪽 드래그는 닫지 않는다', async ({ page }) => {
  await mount(page, { uid: true, subscribe: true })
  const close = page.getByRole('button', { name: '닫기', exact: true })
  await close.dispatchEvent('keydown', { key: 'Escape', isComposing: true })
  await expect(page.locator('.client-upgrade-sheet')).toBeVisible()
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.client-upgrade-sheet')) || document.activeElement === document.body)).toBe(true)
  }
  await page.locator('#background').evaluate(el => (el as HTMLElement).focus())
  await expect(page.locator('#background')).not.toBeFocused()
  const sheet = page.locator('.client-upgrade-sheet')
  const bounds = await sheet.boundingBox()
  if (!bounds) throw new Error('Sheet must be visible')
  await sheet.dispatchEvent('pointerdown', { clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 })
  await sheet.dispatchEvent('click', { clientX: -10, clientY: -10 })
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#upgrade-trigger')).toBeFocused()
})
