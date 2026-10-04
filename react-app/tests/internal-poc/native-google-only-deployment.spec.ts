import { expect, test } from '@playwright/test'

// Presentation configuration only. No provider login or issued identity proof.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

for (const googleOnly of [true, false]) {
  test(`deployment provider options preserve recovery and default compatibility: googleOnly=${googleOnly}`, async ({ page }) => {
    const calls: string[] = []
    await page.route('**/api/**', route => { calls.push(route.request().url()); return route.abort('failed') })
    await page.route('**/google-only-view.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><main id="fixture"></main></body></html>' }))
    await page.goto('/google-only-view.html')
    await page.evaluate(async googleOnly => {
      const refreshPath = '/@react-refresh'
      const refresh = (await import(/* @vite-ignore */ refreshPath)).default
      refresh.injectIntoGlobalHook(window)
      Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
      const componentPath = '/src/internal-poc/NativeLoginPanel.tsx'
      const source = await (await fetch(componentPath)).text()
      const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
      if (!reactPath) throw new Error('Missing Vite React')
      const reactModule = await import(/* @vite-ignore */ reactPath)
      const react = reactModule.default ?? reactModule
      const domPath = '/@id/react-dom/client'
      const dom = await import(/* @vite-ignore */ domPath)
      const { NativeLoginPanel } = await import(/* @vite-ignore */ componentPath)
      ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(NativeLoginPanel, {
        enabledProviders: googleOnly ? ['GOOGLE'] : undefined,
        emailAvailable: !googleOnly,
        onAuthenticated: () => { throw new Error('No authentication performed in presentation test') },
        onSessionRecovered: () => {},
        onEmailAuthenticated: () => {},
      }))
    }, googleOnly)
    const panel = page.locator('.cs-native-login')
    await expect(panel.getByRole('button', { name: 'Google로 계속하기', exact: true })).toBeVisible()
    const apple = panel.getByRole('button', { name: /^Apple로 계속하기/ })
    const email = panel.getByRole('button', { name: /^이메일로 로그인/ })
    await expect(apple).toBeVisible()
    await expect(email).toBeVisible()
    await expect(apple).toHaveAttribute('aria-disabled', String(googleOnly))
    if (googleOnly) {
      await expect(email).toBeDisabled()
      await expect(apple).toContainText('준비 중')
      await apple.focus()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Space')
    } else await expect(email).toBeEnabled()
    const recovery = panel.locator('.native-auth-recovery')
    await recovery.locator('summary').click()
    await expect(recovery.getByRole('button', { name: /Google/ })).toHaveCount(2)
    const appleRecovery = recovery.getByRole('button', { name: /Apple/ })
    await expect(appleRecovery).toHaveCount(2)
    for (const button of await appleRecovery.all()) {
      if (googleOnly) await expect(button).toBeDisabled()
      else await expect(button).toBeEnabled()
    }
    expect(calls).toEqual([])
  })
}
