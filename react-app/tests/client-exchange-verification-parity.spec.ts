import { expect, test, type Page } from '@playwright/test'

type VerificationStatus = 'waiting' | 'checking' | 'verified'
type Controls = {
  renderVerification: (input?: { account?: VerificationStatus; invitation?: VerificationStatus; masked?: string; explicit?: boolean; exchangeId?: string; owner?: string }) => void
  renderList: (input?: { callbacks?: boolean; facts?: boolean; masked?: string; access?: boolean; exchangeId?: string; owner?: string }) => void
  settle: (index: number) => void
  calls: string[]
}

async function mount(page: Page, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  await page.route('**/exchange-verification-parity.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#000"></body></html>' }))
  await page.emulateMedia({ reducedMotion })
  await page.goto('/exchange-verification-parity.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeConnectionOnboarding.tsx', pp = '/src/client-preferences.ts'
    const React = await import(/* @vite-ignore */rp), DOM = await import(/* @vite-ignore */dp), { NativeConnectionOnboarding } = await import(/* @vite-ignore */cp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const element = React.createElement ?? React.default.createElement, host = document.createElement('div'); document.body.append(host)
    const root = (DOM.createRoot ?? DOM.default.createRoot)(host), calls: string[] = [], pending: (() => void)[] = []
    const wait = (name: string) => { calls.push(name); return new Promise<void>(resolve => pending.push(resolve)) }
    const common = { scope: 'owner-a', identity: 'exchange:owner-a', status: 'ready' as const, sourceLabel: 'EXPLICIT UI TEST INPUT' }
    const renderVerification = (input: { account?: VerificationStatus; invitation?: VerificationStatus; masked?: string; explicit?: boolean; exchangeId?: string; owner?: string } = {}) => {
      const verification = input.explicit === false ? undefined : { exchangeId: input.exchangeId ?? 'bybit', maskedAccountLabel: input.masked, account: input.account ?? 'checking', invitation: input.invitation ?? 'waiting' }
      root.render(element(NativeConnectionOnboarding, { accountScope: 'owner-a', onReturn: () => undefined, presentation: { ...common, scope: input.owner ?? common.scope, state: { id: 'verification-stage', kind: 'exchange', title: 'Bybit', description: '연결 결과를 확인하고 있습니다.', exchanges: [{ id: 'refresh', title: '다시 확인' }, { id: 'cancel', title: '연결 취소' }], onChoose: (id: string) => wait(`verify:${id}`), ...(verification ? { verification } : {}) } } }))
    }
    const renderList = (input: { callbacks?: boolean; facts?: boolean; masked?: string; access?: boolean; exchangeId?: string; owner?: string } = {}) => {
      const callbacks = input.callbacks !== false, facts = input.facts !== false
      root.render(element(NativeConnectionOnboarding, { accountScope: 'owner-a', onReturn: () => undefined, presentation: { ...common, scope: input.owner ?? common.scope, state: { id: 'connection-list-stage', kind: 'complete', description: '공급자가 관측한 연결입니다.', rows: [], actions: [], connectionList: { accounts: [{ id: 'connection-one', exchangeId: input.exchangeId ?? 'bybit', ...(facts ? { maskedAccountLabel: input.masked ?? '79••••84', ...(input.access === false ? {} : { access: 'invitation' as const }) } : {}), ...(callbacks ? { onDisconnect: () => wait('disconnect') } : {}) }], ...(callbacks ? { onOpenTerminal: () => wait('terminal'), onAddExchange: () => wait('add') } : {}) } } } }))
    }
    Object.assign(window, { renderVerification, renderList, settle: (index: number) => pending[index]?.(), calls })
    renderVerification()
  })
  await expect(page.locator('.native-connection-onboarding')).toBeVisible()
}

const controls = (page: Page) => page.evaluate(() => (window as unknown as Controls).calls)
const renderVerification = (page: Page, input: Parameters<Controls['renderVerification']>[0] = {}) => page.evaluate(value => (window as unknown as Controls).renderVerification(value), input)
const renderList = (page: Page, input: Parameters<Controls['renderList']>[0] = {}) => page.evaluate(value => (window as unknown as Controls).renderList(value), input)
const settle = (page: Page, index: number) => page.evaluate(value => (window as unknown as Controls).settle(value), index)

test('명시 verification만 원본 계정·초대 계정 2단계를 320·390·1440에 표시한다', async ({ page }) => {
  await mount(page)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 })
    await renderVerification(page, { masked: '79••••84', account: 'checking', invitation: 'waiting' })
    const shell = page.locator('[data-stage=exchange-verification]')
    await expect(shell.getByRole('heading', { name: 'Bybit 연결 확인 중' })).toBeVisible()
    await expect(shell.getByText('79••••84', { exact: true })).toBeVisible()
    await expect(shell.getByText('계정 확인', { exact: true })).toBeVisible()
    await expect(shell.getByText('승인한 계정을 읽는 중', { exact: true })).toBeVisible()
    await expect(shell.getByText('초대 계정 확인', { exact: true })).toBeVisible()
    await expect(shell.getByText('TETH 초대로 만든 계정인지', { exact: true })).toBeVisible()
    await expect(shell.locator('.nsp-step-icon i')).toHaveCount(1)
    expect(await shell.locator('.nsp-step-icon i').evaluate(node => getComputedStyle(node).animationName)).toBe('nsp-verify-spin')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})

test('reduced motion과 generic OAuth pending은 verification 사실을 합성하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, 'reduce')
  await renderVerification(page, { masked: '79••••84', account: 'verified', invitation: 'checking' })
  await expect(page.locator('[data-stage=exchange-verification] .nsp-verification-steps li.verified svg')).toHaveCount(1)
  await expect(page.getByText('확인했습니다', { exact: true })).toBeVisible()
  expect(await page.locator('.nsp-step-icon i').evaluate(node => getComputedStyle(node).animationName)).toBe('none')
  await renderVerification(page, { explicit: false })
  await expect(page.locator('[data-stage=exchange-pending]')).toBeVisible()
  await expect(page.getByText('계정 확인', { exact: true })).toHaveCount(0)
  await expect(page.getByText('초대 계정 확인', { exact: true })).toHaveCount(0)
  await expect(page.getByText('79••••84', { exact: true })).toHaveCount(0)
})

test('명시 connection list만 Q47 terminal·추가연결·해제를 host callback에 연결한다', async ({ page }) => {
  await mount(page)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 760 : 900 })
    await renderList(page)
    const shell = page.locator('[data-stage=exchange-connection-list]')
    await expect(shell.getByText('TETH 초대 계정', { exact: true })).toBeVisible()
    await expect(shell.getByText('79••••84', { exact: true })).toBeVisible()
    await expect(shell.getByText('공급자가 관측한 연결입니다.', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
  const terminal = page.getByRole('button', { name: '터미널 열기' })
  await terminal.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect.poll(() => controls(page)).toEqual(['terminal'])
  await settle(page, 0)
  await page.getByRole('button', { name: '거래소 더 연결하기' }).click(); await settle(page, 1)
  await page.getByRole('button', { name: '연결 끊기' }).click(); await settle(page, 2)
  expect(await controls(page)).toEqual(['terminal', 'add', 'disconnect'])
})

test('미공급 action·facts와 unknown/다른 owner는 성공·초대 상태를 노출하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, 'reduce')
  await renderList(page, { callbacks: false, facts: false })
  await expect(page.locator('[data-stage=exchange-connection-list]')).toBeVisible()
  await expect(page.getByRole('button', { name: '터미널 열기' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '거래소 더 연결하기' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '연결 끊기' })).toBeDisabled()
  await expect(page.getByText('TETH 초대 계정', { exact: true })).toHaveCount(0)
  await expect(page.getByText('79••••84', { exact: true })).toHaveCount(0)
  expect(await controls(page)).toEqual([])
  await renderList(page, { masked: '79••••84', access: false })
  await expect(page.locator('[data-stage=exchange-connection-list]')).toBeVisible()
  await expect(page.getByText('79••••84', { exact: true })).toBeVisible()
  await expect(page.getByText('TETH 초대 계정', { exact: true })).toHaveCount(0)
  await renderList(page, { exchangeId: 'not-source' })
  await expect(page.locator('[data-stage=exchange-connection-list]')).toHaveCount(0)
  await expect(page.getByText('TETH 초대 계정', { exact: true })).toHaveCount(0)
  await renderVerification(page, { owner: 'other-owner', masked: 'OTHER_PRIVATE' })
  await expect(page.locator('[data-stage=exchange-verification]')).toHaveCount(0)
  await expect(page.getByText('OTHER_PRIVATE', { exact: true })).toHaveCount(0)
})

test('모순 verification과 잘못된 supplied fields는 원본 상태를 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page)
  await renderVerification(page, { masked: '79••••84', account: 'waiting', invitation: 'verified' })
  await expect(page.locator('[data-stage=exchange-pending]')).toBeVisible()
  await expect(page.getByText('79••••84', { exact: true })).toHaveCount(0)
  await expect(page.getByText('확인했습니다', { exact: true })).toHaveCount(0)
  await renderVerification(page, { masked: 'unmasked-account', account: 'verified', invitation: 'verified' })
  await expect(page.locator('[data-stage=exchange-pending]')).toBeVisible()
  await expect(page.getByText('unmasked-account', { exact: true })).toHaveCount(0)
  await renderList(page, { masked: 'unmasked-account' })
  await expect(page.locator('[data-stage=exchange-connection-list]')).toHaveCount(0)
  await expect(page.getByText('unmasked-account', { exact: true })).toHaveCount(0)
  expect(await controls(page)).toEqual([])
})
