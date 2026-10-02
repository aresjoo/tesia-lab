import { expect, test } from '@playwright/test'

for (const initiallyDisabled of [false, true]) test(`입력 잠금(${initiallyDisabled ? '진입 전' : '진입 후'}) 중 확대·축소는 보이는 조작부에 초점을 유지한다`, async ({ page }) => {
  await page.route('**/composer-focus-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.goto('/composer-focus-fixture.html')
  await page.evaluate(async disabled => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientComposer.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('React dependency was not resolved')
    const rm = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientComposer } = await import(/* @vite-ignore */ cp)
    const react = rm.default ?? rm
    const style = '/src/client-reference.css'
    await import(/* @vite-ignore */ style)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const inputRef = react.createRef()
    const render = (locked: boolean) => root.render(react.createElement(ClientComposer, {
      value: '검토 중인 질문\n추가 조건', disabled: locked, inputRef,
      onChange: () => {}, onSend: () => {}, onLogin: () => {}, onHeightChange: () => {},
    }))
    Object.assign(window, { lockComposer: () => render(true) })
    render(disabled)
  }, initiallyDisabled)
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  if (!initiallyDisabled) await page.evaluate(() => Reflect.get(window, 'lockComposer')())
  await expect(page.locator('#strategy-idea')).toBeDisabled()
  await page.getByRole('button', { name: '입력창 축소', exact: true }).click()
  await expect(page.locator('.client-composer-dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전체 화면', exact: true })).toBeFocused()
  await expect(page.locator('#strategy-idea')).toHaveValue('검토 중인 질문\n추가 조건')
})
