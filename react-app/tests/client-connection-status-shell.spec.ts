import { expect, test, type Page } from '@playwright/test'

const owner = 'connection-shell@example.test'
async function mountShell(page: Page, shell: 'main' | 'service', mode: 'valid' | 'foreign' | 'anonymous' | 'wrong-source' | 'absent' = 'valid') {
  await page.route('**/connection-shell-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="connection-shell-root"></div></body></html>' }))
  await page.goto('/connection-shell-test.html')
  await page.evaluate(async ({ shell, mode, owner }) => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    localStorage.setItem('tethLang', 'ko')
    if (mode !== 'anonymous') sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연결 셸 검수', email: owner }))
    const path = shell === 'main' ? '/src/components/ClientMainExperience.tsx' : '/src/internal-poc/ClientServiceExperience.tsx'
    const transformed = await fetch(path).then(response => response.text())
    const reactPath = transformed.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ reactPath), React = reactModule.default ?? reactModule
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath), component = await import(/* @vite-ignore */ path)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('connection-shell-root'))
    const source = shell === 'main' ? 'mock' : 'service'
    const fixture = {
      accountScope: owner, anonymous: mode === 'anonymous', epoch: 0, closes: 0,
      calls: [] as unknown[], signals: [] as AbortSignal[], pending: [] as { resolve: () => void; reject: () => void }[],
      p: { scope: mode === 'foreign' ? 'foreign-owner' : owner, identity: 'shell-observation-a',
        source: mode === 'wrong-source' ? source === 'mock' ? 'service' : 'mock' : source,
        state: { kind: 'authorization_result', exchange: 'bitget', authorization: 'idle' }, actions: {} },
      render() {
        // Deliberately inject forbidden runtime overrides: the shell must still
        // derive scope/source itself after spreading the presentation props.
        const port = mode === 'absent' ? undefined : { presentation: fixture.p, scope: 'injected-scope',
          source: source === 'mock' ? 'service' : 'mock', onClose: () => { fixture.closes++ } }
        const state = { phase: 'ready', sessionState: fixture.anonymous ? 'ANONYMOUS' : 'AUTHENTICATED', messages: [],
          input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [],
          workflow: null, outcome: null, issue: null, onInput: () => {}, onSend: () => {}, onReset: () => false }
        root.render(React.createElement(React.StrictMode, null, React.createElement(shell === 'main' ? component.ClientMainExperience : component.ClientServiceExperience,
          shell === 'main' ? { key: fixture.epoch, connectionStatus: port } : { accountScope: fixture.accountScope,
            nativeAccounts: true, state, connectionStatus: port, onLogin: () => {}, onHistory: () => {} })))
      },
      setOwner(next: string) {
        fixture.accountScope = next
        if (shell === 'main') { sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '새 연결 셸', email: next })); fixture.epoch++ }
        fixture.p = { ...fixture.p, scope: next, identity: 'shell-observation-next' }; fixture.render()
      },
    }
    fixture.p.actions = { authorize: (request: unknown, signal: AbortSignal) => {
      fixture.calls.push(request); fixture.signals.push(signal)
      return new Promise<void>((resolve, reject) => fixture.pending.push({ resolve, reject: () => reject(new Error('PRIVATE_SHELL_ERROR')) }))
    } }
    Reflect.set(window, 'connectionShellFixture', fixture); fixture.render()
  }, { shell, mode, owner })
  await expect(page.locator('.tesia-shell')).toBeVisible()
}

for (const shell of ['main', 'service'] as const) {
  test(`${shell}: 실제 셸이 scope/source를 고정하고 callback 성공도 awaiting으로 남긴다`, async ({ page }) => {
    const writes: string[] = []
    page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()) })
    await mountShell(page, shell)
    await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-source', shell === 'main' ? 'mock' : 'service')
    await page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true }).click()
    await page.evaluate(() => Reflect.get(window, 'connectionShellFixture').pending[0].resolve())
    await expect(page.locator('.ccs-feedback')).toHaveText('최신 연결 상태를 확인하고 있습니다.')
    await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', 'authorization_result')
    await expect(page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })).toBeDisabled()
    expect(await page.evaluate(() => Reflect.get(window, 'connectionShellFixture').calls)).toEqual([
      { scope: owner, identity: 'shell-observation-a', source: shell === 'main' ? 'mock' : 'service', action: 'authorize', exchange: 'bitget' },
    ])
    expect(writes).toEqual([])
  })
  for (const mode of ['foreign', 'anonymous', 'wrong-source'] as const) test(`${shell}: ${mode}은 실제 셸에서 연결 상태와 callback을 열지 않는다`, async ({ page }) => {
    await mountShell(page, shell, mode)
    await expect(page.locator('.client-connection-status')).toHaveText('연결 상태를 확인할 수 없습니다.')
    await expect(page.locator('[data-connection-state]')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'connectionShellFixture').calls)).toEqual([])
  })
  test(`${shell}: port 미공급은 성공 상태·관측·동작을 생성하지 않는다`, async ({ page }) => {
    await mountShell(page, shell, 'absent')
    await expect(page.locator('.client-connection-status')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'connectionShellFixture').calls)).toEqual([])
  })
  test(`${shell}: 실제 owner 재바인딩은 이전 관측을 abort하고 늦은 callback을 폐기한다`, async ({ page }) => {
    await mountShell(page, shell)
    await page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true }).click()
    await page.evaluate(() => Reflect.get(window, 'connectionShellFixture').setOwner('next-shell-owner@example.test'))
    await expect(page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })).toBeEnabled()
    expect(await page.evaluate(() => Reflect.get(window, 'connectionShellFixture').signals[0].aborted)).toBe(true)
    await page.evaluate(() => Reflect.get(window, 'connectionShellFixture').pending[0].reject())
    await expect(page.locator('.ccs-feedback')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('PRIVATE_SHELL_ERROR')
  })
}
