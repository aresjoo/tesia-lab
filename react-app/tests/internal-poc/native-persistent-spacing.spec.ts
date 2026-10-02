import { expect, test } from '@playwright/test'

test('비어 있는 승인·결과 portal이 대화 행 사이에 여백을 추가하지 않는다', async ({ page }) => {
  await page.route('**/persistent-spacing.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="fixture"></div></body></html>' }))
  await page.goto('/persistent-spacing.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', rp = '/@id/react', dp = '/@id/react-dom/client'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const path = '/src/internal-poc/NativePersistentRegion.tsx', { NativePersistentRegion } = await import(/* @vite-ignore */ path)
    const h = react.createElement ?? react.default.createElement
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
      h('div', { id: 'before', style: { height: 40 } }, '질문'),
      h(NativePersistentRegion, {}, null), h(NativePersistentRegion, {}, h('div', { hidden: true })),
      h('div', { id: 'after', style: { height: 40 } }, '답변')))
  })
  await expect(page.locator('#after')).toBeVisible()
  const before = await page.locator('#before').boundingBox(), after = await page.locator('#after').boundingBox()
  expect(after!.y - before!.y - before!.height).toBe(16)
})

test('StrictMode 재연결은 입력 초점을 보존하고 이동·해제는 외부 초점을 빼앗지 않는다', async ({ page }) => {
  await page.route('**/persistent-focus.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="fixture"></div><div id="destination"></div></body></html>' }))
  await page.goto('/persistent-focus.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/tests/fixtures/persistent-focus-harness.tsx'
    const { mountPersistentFocus } = await import(/* @vite-ignore */ path)
    mountPersistentFocus(document.getElementById('fixture'))
  })
  await expect(page.locator('#show')).toBeVisible()
  await page.locator('#show').click()
  const input = page.getByRole('textbox', { name: 'Persistent input' })
  await expect(input).toBeFocused()
  await expect.poll(() => input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([2, 5])
  await input.evaluate(el => Reflect.set(window, 'originalPersistentInput', el))
  // Clicking an outside control legitimately transfers focus. Moving the same
  // portal must not use the remembered focus to steal it back from that button.
  await page.locator('#move').click()
  await expect(page.locator('#move')).toBeFocused()
  await expect(page.locator('#destination input')).toHaveCount(1)
  expect(await input.evaluate(el => el === Reflect.get(window, 'originalPersistentInput'))).toBe(true)
  await input.focus()
  // A caller-driven relocation (no new focus target) retains the input/caret.
  await page.locator('#move').evaluate(el => (el as HTMLButtonElement).click())
  await expect(input).toBeFocused()
  await expect.poll(() => input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([2, 5])
  await page.locator('#show').click()
  await expect(input).toHaveCount(0)
  await expect(page.locator('.client-persistent-region')).toHaveCount(0)
  await expect(page.locator('#show')).toBeFocused()
})
