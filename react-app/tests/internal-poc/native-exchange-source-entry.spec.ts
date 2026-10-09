import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })

type Mode = 'background' | 'callback' | 'guest'

type HookWire = { owner: string; requests: string[] }

const exchangeLocator = 'exchange_transaction_fixture_0001'
const exchangeConnection = 'exchange_connection_fixture_0001'

async function mountExchangeHook(page: Page, wire: HookWire, strict: boolean) {
  await page.route('**/auth/complete', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>',
  }))
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    wire.requests.push(`${request.method()} ${path}`)
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (path === '/api/v1/auth/session') return route.fulfill({ headers: { ...headers, ETag: '"exchange_hook_session_etag_0001"' }, body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', requestId: 'request_exchange_hook_0001', traceId: 'trace_exchange_hook_0001', resourceRevision: '1' },
      data: { sessionId: wire.owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
    if (path === '/api/v1/exchange-connections/catalog') return route.fulfill({ headers, body: JSON.stringify({ apiContractVersion: '0.12.0', data: { providers: [
      { exchangeId: 'bybit', available: false, reason: 'PROVIDER_UNAVAILABLE' }, { exchangeId: 'bitget', available: true, reason: null },
      { exchangeId: 'bingx', available: false, reason: 'PROVIDER_UNAVAILABLE' }, { exchangeId: 'gate', available: false, reason: 'PROVIDER_UNAVAILABLE' },
      { exchangeId: 'mexc', available: false, reason: 'PROVIDER_UNAVAILABLE' }, { exchangeId: 'htx', available: false, reason: 'PROVIDER_UNAVAILABLE' },
    ] } }) })
    if (path === `/api/v1/exchange-connections/transactions/${exchangeLocator}`) return route.fulfill({ headers, body: JSON.stringify({ apiContractVersion: '0.12.0', data: {
      transactionId: exchangeLocator, exchangeId: 'bitget', status: 'connected', expiresAt: '2030-01-01T01:00:00Z', authorizationUrl: null,
      connectionId: exchangeConnection, failureCode: null,
    } }) })
    if (path === '/api/v1/exchange-connections/') return route.fulfill({ headers, body: JSON.stringify({ apiContractVersion: '0.12.0', data: { connections: [{
      connectionId: exchangeConnection, exchangeId: 'bitget', maskedAccountLabel: '12**34', connectedAt: '2030-01-01T00:00:00Z', status: 'connected',
      permissions: { read: true, spotTrade: true, futuresTrade: false, withdrawal: false }, permissionsVerified: true,
    }] } }) })
    return route.abort('blockedbyclient')
  })
  await page.goto(`/auth/complete#exchange-transaction=${exchangeLocator}`)
  await page.evaluate(async useStrictMode => {
    const refresh = (await import('/@react-refresh')).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const hookPath = '/src/exchange-connect/use-exchange-connection.ts'
    const source = await (await fetch(hookPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const ReactModule = await import(/* @vite-ignore */ reactPath)
    const DOM = await import('/@id/react-dom/client')
    const { useExchangeConnectionPresentation } = await import(/* @vite-ignore */ hookPath)
    const React = ReactModule.default ?? ReactModule
    const controls = { setOwner: (value: string) => { void value } }
    Reflect.set(window, 'exchangeHookControls', controls)
    function Host() {
      const [owner, setOwner] = React.useState('session_exchange_owner_0001')
      controls.setOwner = setOwner
      const value = useExchangeConnectionPresentation(owner, true, true)
      return React.createElement('output', { 'data-testid': 'hook-value', 'data-scope': value?.scope ?? '', 'data-request-id': value?.requestId ?? '', 'data-state-id': value?.state.id ?? '' })
    }
    const element = React.createElement(Host)
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root')).render(useStrictMode ? React.createElement(React.StrictMode, null, element) : element)
  }, strict)
  await expect(page.getByTestId('hook-value')).toHaveAttribute('data-request-id', 'oauth-callback')
  await expect.poll(() => wire.requests.filter(value => value.endsWith(`/transactions/${exchangeLocator}`)).length).toBe(1)
  await expect.poll(() => wire.requests.filter(value => value.endsWith('/exchange-connections/catalog')).length).toBe(1)
}

async function mountConnectionPlanAuth(page: Page, emptyConnections = false) {
  const anonymous = 'session_connection_plan_anon_0001', authenticated = 'session_connection_plan_auth_0001'
  const anonymousEtag = '"connection_plan_anon_etag_0001"', authenticatedEtag = '"connection_plan_auth_etag_0001"'
  const challenge = 'email_challenge_connection_plan_0001'
  const state = {
    owner: anonymous,
    authenticated: false,
    revision: '7',
    posts: [] as string[],
    sessionGates: [] as Array<{ wait: Promise<void>; fail?: boolean }>,
    heldSessionReads: 0,
    releasedSessionReads: 0,
    exchangeStarts: 0,
  }
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:15Z'))
  const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_connection_plan_0001', traceId: 'trace_connection_plan_0001', resourceRevision: revision })
  const session = (owner: string, status: string, revision: string) => ({ sessionId: owner, state: status, revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' })
  await page.route('**/connection-plan-auth.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const React=await import('/@id/react'),DOM=await import('/@id/react-dom/client'),App=await import('/src/internal-poc/NativeServiceApp.tsx'),Router=await import('/src/components/SiteRouter.tsx');
    const h=(React.default??React).createElement;(DOM.createRoot??DOM.default.createRoot)(document.getElementById('root')).render(h(Router.SiteRouter,{service:true},h(App.NativeServiceApp,{exchangeConnectionsEnabled:true})));
  </script></body></html>` }))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const respond = (version: string, revision: string | null, data: unknown, status = 200) => route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    if (request.method() === 'POST') state.posts.push(path)
    if (path === '/api/v1/auth/session') {
      const gate = state.sessionGates.shift()
      if (gate) {
        state.heldSessionReads++
        await gate.wait
        state.releasedSessionReads++
        if (gate.fail) return route.abort('failed')
      }
      headers.ETag = state.authenticated ? authenticatedEtag : anonymousEtag
      return respond('0.1.0', state.revision, state.authenticated
        ? { ...session(state.owner, 'AUTHENTICATED', state.revision), expiresAt: '2030-01-01T12:00:00Z' }
        : session(state.owner, 'ANONYMOUS', state.revision))
    }
    if (path === '/api/v1/auth/csrf') return respond('0.1.0', null, { csrfToken: 'csrf_connection_plan_fixture_0001', expiresAt: '2030-01-01T12:00:00Z' })
    if (path === '/api/v9/auth/email/challenges') {
      headers.ETag = '"connection_plan_challenge_etag_0001"'
      return respond('0.9.0', '7', { challengeId: challenge, initiatingSessionId: anonymous, initiatingSessionRevision: '7', initiatingSessionEtag: anonymousEtag,
        issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:05:00Z', resendAllowedAt: '2030-01-01T00:00:30Z', deliveryStatus: 'ACCEPTED' }, 201)
    }
    if (path === `/api/v9/auth/email/challenges/${challenge}/verifications`) {
      state.owner = authenticated; state.authenticated = true; state.revision = '1'; headers.ETag = authenticatedEtag
      return respond('0.9.0', '1', { challengeId: challenge, challengeExpiresAt: '2030-01-01T00:05:00Z', session: { ...session(authenticated, 'AUTHENTICATED', '1'), expiresAt: '2030-01-01T12:00:00Z' },
        handoffReservation: { challengeId: challenge, initiatingSessionId: anonymous, initiatingSessionRevision: '7', initiatingSessionEtag: anonymousEtag,
          authenticatedSessionId: authenticated, state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:00:00Z' } })
    }
    if (path === '/api/v1/exchange-connections/catalog') return route.fulfill({ headers, body: JSON.stringify({ apiContractVersion: '0.12.0', data: { providers: [
      { exchangeId: 'bybit', available: false, reason: 'PROVIDER_UNAVAILABLE' }, { exchangeId: 'bitget', available: true, reason: null },
      { exchangeId: 'bingx', available: false, reason: 'PROVIDER_UNAVAILABLE' }, { exchangeId: 'gate', available: false, reason: 'PROVIDER_UNAVAILABLE' },
      { exchangeId: 'mexc', available: false, reason: 'PROVIDER_UNAVAILABLE' }, { exchangeId: 'htx', available: false, reason: 'PROVIDER_UNAVAILABLE' },
    ] } }) })
    if (path === '/api/v1/exchange-connections/') return route.fulfill({ headers, body: JSON.stringify({ apiContractVersion: '0.12.0', data: { connections: emptyConnections ? [] : [{
      connectionId: exchangeConnection, exchangeId: 'bitget', maskedAccountLabel: '12**34', connectedAt: '2030-01-01T00:00:00Z', status: 'connected',
      permissions: { read: true, spotTrade: true, futuresTrade: false, withdrawal: false }, permissionsVerified: true,
    }] } }) })
    if (path === '/api/v1/exchange-connections/transactions') {
      state.exchangeStarts++
      return route.fulfill({ headers, body: JSON.stringify({ apiContractVersion: '0.12.0', data: {
        transactionId: 'exchange_transaction_start_0001', exchangeId: 'bitget', status: 'pending', expiresAt: '2030-01-01T01:00:00Z',
        authorizationUrl: 'https://www.bitget.com/account/oauth?clientId=fixture', connectionId: null, failureCode: null,
      } }) })
    }
    return route.abort('blockedbyclient')
  })
  await page.goto('/connection-plan-auth.html')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return state
}

async function mountSourceParityStages(page: Page) {
  await page.route('**/source-parity-stages.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>' }))
  await page.goto('/source-parity-stages.html')
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/internal-poc/NativeConnectionOnboarding.tsx'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const ReactModule = await import(/* @vite-ignore */ reactPath)
    const DOM = await import('/@id/react-dom/client')
    const { NativeConnectionOnboarding } = await import(/* @vite-ignore */ componentPath)
    const React = ReactModule.default ?? ReactModule
    const controls = { setStage: (value: string) => { void value } }
    Reflect.set(window, 'sourceParityStageControls', controls)
    function stage(kind: string) {
      if (kind === 'complete') return { id: 'complete:1', kind: 'complete', description: '확인된 연결', rows: [], actions: [], connectionList: {
        accounts: [{ id: 'account-a', exchangeId: 'bitget', access: 'invitation', onDisconnect: async () => undefined }],
        onOpenTerminal: async () => undefined, onAddExchange: async () => undefined,
      } }
      const pending = kind === 'pending' || kind === 'verification'
      return { id: `exchange:${kind}`, kind: 'exchange', title: '거래소 연결', description: pending ? '연결 결과를 확인하고 있습니다.' : '거래소를 선택합니다.',
        exchanges: pending ? [{ id: 'refresh', title: '다시 확인' }, { id: 'cancel', title: '연결 취소' }] : [{ id: 'bitget', title: 'Bitget' }],
        onChoose: async () => undefined,
        ...(kind === 'verification' ? { verification: { exchangeId: 'bitget', maskedAccountLabel: '12••34', account: 'checking', invitation: 'waiting' } } : {}),
      }
    }
    function Host() {
      const [kind, setKind] = React.useState('selection')
      controls.setStage = setKind
      return React.createElement(NativeConnectionOnboarding, { accountScope: 'owner-a', presentation: {
        scope: 'owner-a', identity: 'exchange:owner-a', status: 'ready', state: stage(kind),
      }, onReturn: () => undefined, onHelp: () => undefined })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root')).render(React.createElement(Host))
  })
  await expect(page.locator('[data-stage="exchange-selection"]')).toBeVisible()
}

async function mount(page: Page, mode: Mode, settings = false) {
  await page.route('**/native-exchange-source-entry.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>',
  }))
  await page.goto(`/native-exchange-source-entry.html${settings ? '#/settings/account' : ''}`)
  await page.evaluate(async initialMode => {
    const refreshPath = '/@react-refresh'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/internal-poc/ClientServiceExperience.tsx'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const ReactModule = await import(/* @vite-ignore */ reactPath)
    const DOM = await import('/@id/react-dom/client')
    const { ClientServiceExperience } = await import(/* @vite-ignore */ componentPath)
    const React = ReactModule.default ?? ReactModule
    const calls: string[] = []
    const controls = { calls, setOwner: (value: string) => { void value }, setSession: (value: 'AUTHENTICATED' | 'ANONYMOUS') => { void value } }
    Reflect.set(window, 'exchangeSourceControls', controls)

    function Host() {
      const [owner, setOwner] = React.useState('owner-a')
      const [sessionState, setSession] = React.useState<'AUTHENTICATED' | 'ANONYMOUS'>(initialMode === 'guest' ? 'ANONYMOUS' : 'AUTHENTICATED')
      controls.setOwner = setOwner
      controls.setSession = setSession
      const connectionPresentation = initialMode === 'guest' ? undefined : {
        scope: 'owner-a', identity: 'exchange:owner-a', requestId: initialMode === 'callback' ? 'oauth-callback' : '', status: 'ready' as const,
        state: { id: 'connections:1', kind: 'complete' as const, title: '거래소 연결', description: '확인된 연결', rows: [], actions: [],
          connectionList: { accounts: [{ id: 'account-a', exchangeId: 'bitget', maskedAccountLabel: '12••34', access: 'invitation' as const,
            onDisconnect: async () => { calls.push('disconnect'); throw new Error('PRIVATE_PROVIDER_FAILURE') } }],
            onOpenTerminal: async () => { calls.push('terminal') }, onAddExchange: async () => { calls.push('add') } },
        },
      }
      return React.createElement(ClientServiceExperience, {
        nativeAccounts: true, accountScope: owner, connectionPresentation,
        onLogin: (intent?: string) => { calls.push(`login:${intent ?? 'login'}`) },
        state: {
          phase: 'ready', sessionState, messages: [], input: '', busy: false, inputDisabled: false, source: 'service',
          recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: () => undefined, onSend: async () => undefined, onReset: async () => undefined,
          onRecover: undefined, onLogout: undefined,
        },
      })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root')).render(React.createElement(Host))
  }, mode)
  await expect(page.locator('.client-source-app')).toBeVisible()
}

async function openExchangeEntry(page: Page) {
  const entry = page.locator('.client-research-navigation').getByRole('button', { name: '거래소 연결', exact: true })
  if (!await entry.isVisible()) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  await expect(entry).toBeVisible()
  await entry.click()
}

test('background 연결 자료는 설정에 남고 자동으로 화면을 열지 않는다', async ({ page }) => {
    await mount(page, 'background', true)
    await expect(page.locator('.native-connection-onboarding, [data-testid="connection-plan"]')).toHaveCount(0)
    const account = page.locator('[data-settings-connection="account-a"]')
    await expect(account).toContainText('Bitget')
    await expect(account).toContainText('12••34')
})

test('명시적 거래소 메뉴는 catalogue가 아니라 원본 연결 목록과 도움말을 연다', async ({ page }) => {
    await mount(page, 'background')
    await openExchangeEntry(page)
    const view = page.locator('[data-stage="exchange-connection-list"]')
    await expect(view).toBeVisible()
    await expect(page.locator('.native-brokers')).toHaveCount(0)
    await expect(view).toContainText('막히면 상담원이 24시간 답합니다.')
    await expect(view).not.toContainText('12••34')
    await expect(view).not.toContainText('확인된 연결')
    await expect(view.locator('.nsp-back')).toHaveCount(0)
    const geometry = await view.evaluate(node => {
      const card = getComputedStyle(node.querySelector('.nsp-list')!), help = getComputedStyle(node.querySelector('.nsp-help')!), row = getComputedStyle(node.querySelector('.nsp-account')!)
      return { card: `${card.paddingTop} ${card.paddingRight}`, row: row.paddingTop, help: `${help.marginTop} ${help.paddingTop} ${help.borderTopWidth} ${help.justifyContent} ${help.textAlign}` }
    })
    expect(geometry).toEqual({ card: `${page.viewportSize()!.width <= 768 ? '0px 18px' : '6px 26px'}`, row: page.viewportSize()!.width <= 768 ? '14px' : '16px', help: '44px 20px 1px normal start' })
    const heading = view.getByRole('heading', { name: '거래소 연결' })
    await expect(heading).toBeFocused()
    expect(await heading.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none')
    const help = view.getByRole('button', { name: '상담원에게 묻기' })
    await view.getByRole('button', { name: '거래소 더 연결하기' }).focus()
    await page.keyboard.press('Tab')
    await expect(help).toBeFocused()
    expect(await help.evaluate(node => node.matches(':focus-visible') && parseFloat(getComputedStyle(node).outlineWidth) >= 2)).toBe(true)
    await view.getByRole('button', { name: '연결 끊기' }).click()
    await expect(view.getByRole('alert')).toBeVisible()
    await help.click()
    await expect(page.locator('.site-help-pop[data-surface-active="true"]')).toBeVisible()
})

test('guest 명시 진입은 원본 플랜 gate를 열고 선택 전 인증 성공을 만들지 않는다', async ({ page }) => {
    await mount(page, 'guest')
    const footerEntry = page.locator('.client-site-footer').getByRole('button', { name: '거래소 연결', exact: true })
    await footerEntry.scrollIntoViewIfNeeded()
    await footerEntry.click()
    await expect(page.locator('[data-testid="connection-plan"]')).toBeVisible()
    await expect(page.locator('.native-brokers')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'exchangeSourceControls').calls)).toEqual([])
    await page.getByRole('button', { name: '무료로 시작하기' }).click()
    expect(await page.evaluate(() => Reflect.get(window, 'exchangeSourceControls').calls)).toEqual(['login:signup'])
})

test('동일 signup panel의 검증된 EMAIL 결과만 선택한 연결 plan을 새 owner에서 한 번 재개한다', async ({ page }) => {
  const state = await mountConnectionPlanAuth(page)
  const entry = page.locator('.client-site-footer').getByRole('button', { name: '거래소 연결', exact: true })
  await entry.scrollIntoViewIfNeeded(); await entry.click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  const panel = page.getByRole('region', { name: '실제 계정 로그인', exact: true })
  await panel.getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  const form = panel.getByRole('form', { name: '이메일 로그인', exact: true })
  await form.getByLabel('이메일 주소', { exact: true }).fill('connection-plan@example.invalid')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await form.getByLabel('6자리 인증번호', { exact: true }).fill('000123')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  const resumed = page.locator('[data-testid="connection-plan"][data-step="free"]')
  await expect(resumed).toBeVisible()
  await expect(page.locator('.native-connection-onboarding')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.connection-plan-login-intent'))).toBeNull()
  expect(state.posts).toEqual(['/api/v9/auth/email/challenges', `/api/v9/auth/email/challenges/email_challenge_connection_plan_0001/verifications`])
})

test('검증된 로그인 뒤 현재 owner의 available Bitget 승인 CTA만 기존 API12 start를 한 번 호출한다', async ({ page }) => {
  const state = await mountConnectionPlanAuth(page, true)
  await page.route('https://www.bitget.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Bitget fixture</title>' }))
  const entry = page.locator('.client-site-footer').getByRole('button', { name: '거래소 연결', exact: true })
  await entry.scrollIntoViewIfNeeded(); await entry.click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  const panel = page.getByRole('region', { name: '실제 계정 로그인', exact: true })
  await panel.getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  const form = panel.getByRole('form', { name: '이메일 로그인', exact: true })
  await form.getByLabel('이메일 주소', { exact: true }).fill('connection-plan@example.invalid')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await form.getByLabel('6자리 인증번호', { exact: true }).fill('000123')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await page.getByRole('button', { name: 'Bitget', exact: true }).click()
  await page.getByRole('button', { name: '기존 초대 계정 연결', exact: true }).click()
  const authorize = page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })
  await expect(authorize).toBeEnabled()
  await expect(page.getByText('실제 거래소 승인은 아직 제공되지 않습니다. 계정이 연결되거나 주문 권한이 부여되지 않습니다.', { exact: true })).toHaveCount(0)
  await authorize.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect(page).toHaveURL(/^https:\/\/www\.bitget\.com\/account\/oauth\?/)
  expect(state.exchangeStarts).toBe(1)
  expect(state.posts.filter(path => path === '/api/v1/exchange-connections/transactions')).toHaveLength(1)
})

test('비로그인·foreign owner·미지원 catalog·pending presentation은 승인 callback을 노출하지 않는다', async ({ page }) => {
  await page.route('**/connection-authorize-boundary.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>' }))
  await page.goto('/connection-authorize-boundary.html')
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/internal-poc/ClientServiceExperience.tsx'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const ReactModule = await import(/* @vite-ignore */ reactPath)
    const DOM = await import('/@id/react-dom/client')
    const { ClientServiceExperience } = await import(/* @vite-ignore */ componentPath)
    const React = ReactModule.default ?? ReactModule
    const owner = 'owner-authorize-boundary-a', starts: string[] = []
    const controls = { starts, setSession: (value: 'ANONYMOUS' | 'AUTHENTICATED') => { void value }, setMode: (value: 'available' | 'foreign' | 'unsupported' | 'pending' | 'rejecting') => { void value } }
    Reflect.set(window, 'connectionAuthorizeBoundary', controls)
    function Host() {
      const [sessionState, setSession] = React.useState<'ANONYMOUS' | 'AUTHENTICATED'>('ANONYMOUS')
      const [mode, setMode] = React.useState<'available' | 'foreign' | 'unsupported' | 'pending' | 'rejecting'>('available')
      controls.setSession = setSession; controls.setMode = setMode
      const exchanges = mode === 'pending' ? [{ id: 'refresh', title: '다시 확인' }, { id: 'cancel', title: '연결 취소' }]
        : mode === 'unsupported' ? [{ id: 'bybit', title: 'Bybit' }] : [{ id: 'bitget', title: 'Bitget' }]
      const connectionPresentation = { scope: mode === 'foreign' ? 'owner-authorize-boundary-b' : owner, identity: `exchange:${owner}`, requestId: '', status: 'ready' as const,
        state: { id: `exchange:${mode}`, kind: 'exchange' as const, title: '거래소 연결', exchanges,
          onChoose: async (exchange: string) => { if (mode === 'rejecting') throw new Error('synthetic rejected connection action'); starts.push(exchange) } } }
      return React.createElement(ClientServiceExperience, {
        nativeAccounts: true, accountScope: owner, connectionPresentation,
        connectionPlanContinuation: { issuer: 'client-connection-plan', operation: 'signup', requestId: 'authorize_boundary_request_0001', sourceSessionId: 'session_anonymous_source_0001', targetSessionId: owner, plan: { step: 'authorize', exchange: 'bitget' } },
        onConnectionPlanContinuationConsumed: () => undefined, onLogin: () => undefined,
        state: { phase: 'ready', sessionState, messages: [], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: () => undefined, onSend: async () => undefined, onReset: async () => undefined, onRecover: undefined, onLogout: undefined },
      })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root')).render(React.createElement(Host))
  })
  const controls = () => page.evaluate(() => Reflect.get(window, 'connectionAuthorizeBoundary').starts as string[])
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  const footerEntry = page.locator('.client-site-footer').getByRole('button', { name: '거래소 연결', exact: true })
  await footerEntry.scrollIntoViewIfNeeded(); await footerEntry.click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  expect(await controls()).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'connectionAuthorizeBoundary').setSession('AUTHENTICATED'))
  const authorize = page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })
  await expect(authorize).toBeEnabled()
  const retiredClick = await authorize.evaluateHandle(node => {
    const key = Object.keys(node).find(candidate => candidate.startsWith('__reactProps$'))
    const click = key ? Reflect.get(Reflect.get(node, key), 'onClick') : undefined
    if (typeof click !== 'function') throw new Error('Missing retained React click callback')
    return click as () => void
  })
  await page.evaluate(() => Reflect.get(window, 'connectionAuthorizeBoundary').setMode('foreign'))
  await expect(authorize).toBeDisabled()
  await retiredClick.evaluate(click => click())
  await expect.poll(controls).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'connectionAuthorizeBoundary').setMode('rejecting'))
  await expect(authorize).toBeEnabled()
  await authorize.click()
  await expect(authorize).toBeEnabled()
  expect(pageErrors).toEqual([])
  for (const mode of ['foreign', 'unsupported', 'pending'] as const) {
    await page.evaluate(value => Reflect.get(window, 'connectionAuthorizeBoundary').setMode(value), mode)
    await expect(authorize).toBeDisabled()
    await authorize.evaluate(node => (node as HTMLButtonElement).click())
  }
  expect(await controls()).toEqual([])
})

test('API12 identity와 현재 authorize plan에 결속되어 legacy presentation과 퇴역 plan callback을 거절한다', async ({ page }) => {
  await page.route('**/connection-authorize-plan-binding.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>' }))
  await page.goto('/connection-authorize-plan-binding.html')
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/internal-poc/ClientServiceExperience.tsx'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const ReactModule = await import(/* @vite-ignore */ reactPath)
    const DOM = await import('/@id/react-dom/client')
    const { ClientServiceExperience } = await import(/* @vite-ignore */ componentPath)
    const React = ReactModule.default ?? ReactModule
    const owner = 'owner-authorize-plan-binding-a', starts: string[] = []
    const controls = { starts, setLegacy: (value: boolean) => { void value } }
    Reflect.set(window, 'connectionAuthorizePlanBinding', controls)
    function Host() {
      const [legacy, setLegacy] = React.useState(false)
      controls.setLegacy = setLegacy
      const connectionPresentation = { scope: owner, identity: legacy ? `legacy:${owner}` : `exchange:${owner}`, requestId: '', status: 'ready' as const,
        state: { id: legacy ? 'legacy-exchange-stage' : 'api12-exchange-stage', kind: 'exchange' as const, title: '거래소 연결', exchanges: [{ id: 'bitget', title: 'Bitget' }],
          onChoose: async (exchange: string) => { starts.push(exchange) } } }
      return React.createElement(ClientServiceExperience, {
        nativeAccounts: true, accountScope: owner, connectionPresentation,
        connectionPlanContinuation: { issuer: 'client-connection-plan', operation: 'signup', requestId: 'authorize_plan_binding_request_0001', sourceSessionId: 'session_anonymous_source_0002', targetSessionId: owner, plan: { step: 'authorize', exchange: 'bitget' } },
        onConnectionPlanContinuationConsumed: () => undefined, onLogin: () => undefined,
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: () => undefined, onSend: async () => undefined, onReset: async () => undefined, onRecover: undefined, onLogout: undefined },
      })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root')).render(React.createElement(Host))
  })
  const authorize = page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })
  await expect(authorize).toBeEnabled()
  const retiredPlanClick = await authorize.evaluateHandle(node => {
    const key = Object.keys(node).find(candidate => candidate.startsWith('__reactProps$'))
    const click = key ? Reflect.get(Reflect.get(node, key), 'onClick') : undefined
    if (typeof click !== 'function') throw new Error('Missing retained React click callback')
    return click as () => void
  })
  await page.getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bitget 계정', exact: true })).toBeVisible()
  await retiredPlanClick.evaluate(click => click())
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'connectionAuthorizePlanBinding').starts as string[])).toEqual([])
  await page.getByRole('button', { name: '기존 초대 계정 연결', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'connectionAuthorizePlanBinding').setLegacy(true))
  await expect(authorize).toBeDisabled()
  await authorize.evaluate(node => (node as HTMLButtonElement).click())
  expect(await page.evaluate(() => Reflect.get(window, 'connectionAuthorizePlanBinding').starts as string[])).toEqual([])
})

test('retained 인증 panel은 이전 plan을 폐기하고 가장 최근 signup plan만 한 번 재개한다', async ({ page }) => {
  const state = await mountConnectionPlanAuth(page)
  const entry = page.locator('.client-site-footer').getByRole('button', { name: '거래소 연결', exact: true })
  await entry.scrollIntoViewIfNeeded(); await entry.click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  const panel = page.getByRole('region', { name: '실제 계정 로그인', exact: true })
  await panel.getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  const form = panel.getByRole('form', { name: '이메일 로그인', exact: true })
  await form.getByLabel('이메일 주소', { exact: true }).fill('connection-plan@example.invalid')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await expect(form.getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  await panel.locator('[data-native-auth-close]').click()
  await expect(panel).toBeHidden()
  await page.getByRole('button', { name: '구독으로 시작하기', exact: true }).click()
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('button', { name: '같은 로그인 요청 확인', exact: true })).toBeVisible()
  await panel.getByRole('button', { name: '이메일 주소 수정', exact: true }).click()
  await form.getByLabel('이메일 주소', { exact: true }).fill('connection-plan@example.invalid')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await form.getByLabel('6자리 인증번호', { exact: true }).fill('000123')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.locator('[data-testid="connection-plan"][data-step="checkout"]')).toBeVisible()
  await expect(page.locator('[data-testid="connection-plan"][data-step="free"]')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.connection-plan-login-intent'))).toBeNull()
  expect(state.posts).toEqual(['/api/v9/auth/email/challenges', '/api/v9/auth/email/challenges', `/api/v9/auth/email/challenges/email_challenge_connection_plan_0001/verifications`])
})

test('retained plan 요청의 응답 순서가 역전돼도 마지막 signup plan만 재개한다', async ({ page }) => {
  const state = await mountConnectionPlanAuth(page)
  const entry = page.locator('.client-site-footer').getByRole('button', { name: '거래소 연결', exact: true })
  await entry.scrollIntoViewIfNeeded(); await entry.click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  const panel = page.getByRole('region', { name: '실제 계정 로그인', exact: true })
  await panel.getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  const form = panel.getByRole('form', { name: '이메일 로그인', exact: true })
  await form.getByLabel('이메일 주소', { exact: true }).fill('connection-plan@example.invalid')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await expect(form.getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  await panel.locator('[data-native-auth-close]').click()

  let releaseOlder = () => {}, releaseNewest = () => {}
  const older = new Promise<void>(resolve => { releaseOlder = resolve })
  const newest = new Promise<void>(resolve => { releaseNewest = resolve })
  state.sessionGates.push({ wait: older }, { wait: newest })
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await page.getByRole('button', { name: '구독으로 시작하기', exact: true }).click()
  await expect.poll(() => state.heldSessionReads).toBe(2)
  releaseNewest()
  await expect.poll(() => page.evaluate(() => {
    const raw = sessionStorage.getItem('tesia.native.connection-plan-login-intent')
    return raw ? JSON.parse(raw).plan.step : null
  })).toBe('checkout')
  releaseOlder()
  await expect.poll(() => state.releasedSessionReads).toBe(2)
  await expect.poll(() => page.evaluate(() => {
    const raw = sessionStorage.getItem('tesia.native.connection-plan-login-intent')
    return raw ? JSON.parse(raw).plan.step : null
  })).toBe('checkout')

  await panel.getByRole('button', { name: '이메일 주소 수정', exact: true }).click()
  await form.getByLabel('이메일 주소', { exact: true }).fill('connection-plan@example.invalid')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await form.getByLabel('6자리 인증번호', { exact: true }).fill('000123')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.locator('[data-testid="connection-plan"][data-step="checkout"]')).toBeVisible()
  await expect(page.locator('[data-testid="connection-plan"][data-step="free"]')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.connection-plan-login-intent'))).toBeNull()
})

test('retained plan의 늦은 이전 오류는 마지막 signup plan을 지우지 않는다', async ({ page }) => {
  const state = await mountConnectionPlanAuth(page)
  const entry = page.locator('.client-site-footer').getByRole('button', { name: '거래소 연결', exact: true })
  await entry.scrollIntoViewIfNeeded(); await entry.click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  const panel = page.getByRole('region', { name: '실제 계정 로그인', exact: true })
  await panel.getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  const form = panel.getByRole('form', { name: '이메일 로그인', exact: true })
  await form.getByLabel('이메일 주소', { exact: true }).fill('connection-plan@example.invalid')
  await form.getByRole('button', { name: '계속', exact: true }).click()
  await expect(form.getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  await panel.locator('[data-native-auth-close]').click()

  let releaseOlder = () => {}, releaseNewest = () => {}
  const older = new Promise<void>(resolve => { releaseOlder = resolve })
  const newest = new Promise<void>(resolve => { releaseNewest = resolve })
  state.sessionGates.push({ wait: older, fail: true }, { wait: newest })
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await page.getByRole('button', { name: '구독으로 시작하기', exact: true }).click()
  await expect.poll(() => state.heldSessionReads).toBe(2)
  releaseNewest()
  await expect.poll(() => page.evaluate(() => {
    const raw = sessionStorage.getItem('tesia.native.connection-plan-login-intent')
    return raw ? JSON.parse(raw).plan.step : null
  })).toBe('checkout')
  releaseOlder()
  await expect.poll(() => state.releasedSessionReads).toBe(2)
  await expect(panel).toBeVisible()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect.poll(() => page.evaluate(() => {
    const raw = sessionStorage.getItem('tesia.native.connection-plan-login-intent')
    return raw ? JSON.parse(raw).plan.step : null
  })).toBe('checkout')
})

test('원본 Q47 breakpoint와 모든 연결 flow의 help footer를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 })
  await mountSourceParityStages(page)
  await expect(page.locator('[data-stage="exchange-selection"] .nsp-help')).toBeVisible()
  await page.getByRole('button', { name: 'Bitget', exact: true }).click()
  await expect(page.locator('[data-stage="exchange-preflight"] .nsp-help')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'sourceParityStageControls').setStage('pending'))
  await expect(page.locator('[data-stage="exchange-pending"] .nsp-help')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'sourceParityStageControls').setStage('verification'))
  await expect(page.locator('[data-stage="exchange-verification"] .nsp-help')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'sourceParityStageControls').setStage('complete'))
  const view = page.locator('[data-stage="exchange-connection-list"]')
  await expect(view).toBeVisible()
  const geometry = async () => view.evaluate(node => {
    const card = getComputedStyle(node.querySelector('.nsp-list')!), row = getComputedStyle(node.querySelector('.nsp-account')!), link = getComputedStyle(node.querySelector('.nsp-account .nsp-link')!)
    return { card: `${card.paddingTop} ${card.paddingRight}`, row: row.paddingTop, link: `${link.fontSize} ${link.marginLeft}` }
  })
  expect(await geometry()).toEqual({ card: '6px 26px', row: '16px', link: '13px 12px' })
  await page.setViewportSize({ width: 320, height: 900 })
  expect(await geometry()).toEqual({ card: '0px 18px', row: '14px', link: '13px 12px' })
})

test('검증된 callback만 자동 진입하고 owner 교체 즉시 숨긴다', async ({ page }) => {
    await mount(page, 'callback')
    await expect(page.locator('[data-stage="exchange-connection-list"]')).toBeVisible()
    await page.evaluate(() => Reflect.get(window, 'exchangeSourceControls').setOwner('owner-b'))
    await expect(page.locator('.native-connection-onboarding')).toHaveCount(0)
    await expect(page.locator('.native-service-route-content')).toBeVisible()
})

test('callback locator는 첫 owner에서 소비한 뒤 새 owner에 재사용하지 않는다', async ({ page }) => {
  const wire = { owner: 'session_exchange_owner_0001', requests: [] as string[] }
  await mountExchangeHook(page, wire, false)
  await expect(page.getByTestId('hook-value')).toHaveAttribute('data-request-id', 'oauth-callback')
  const callbackReads = wire.requests.filter(value => value.endsWith(`/transactions/${exchangeLocator}`)).length
  wire.owner = 'session_exchange_owner_0002'
  await page.evaluate(() => Reflect.get(window, 'exchangeHookControls').setOwner('session_exchange_owner_0002'))
  await expect(page.getByTestId('hook-value')).toHaveAttribute('data-scope', 'session_exchange_owner_0002')
  await expect(page.getByTestId('hook-value')).toHaveAttribute('data-request-id', '')
  expect(wire.requests.filter(value => value.endsWith(`/transactions/${exchangeLocator}`))).toHaveLength(callbackReads)
})

test('StrictMode의 동일 owner setup replay는 callback locator를 유지한다', async ({ page }) => {
  const wire = { owner: 'session_exchange_owner_0001', requests: [] as string[] }
  await mountExchangeHook(page, wire, true)
  await expect(page.getByTestId('hook-value')).toHaveAttribute('data-request-id', 'oauth-callback')
  expect(wire.requests.filter(value => value.endsWith(`/transactions/${exchangeLocator}`))).toHaveLength(1)
  expect(wire.requests.filter(value => value.endsWith('/exchange-connections/catalog'))).toHaveLength(1)
})

test('설정의 거래소 진입은 동기 route close 뒤 유지되고 홈은 연결 화면을 닫는다', async ({ page }) => {
  await mount(page, 'background', true)
  await page.locator('.stg-main').getByRole('button', { name: '거래소 연결', exact: true }).click()
  await expect(page.locator('[data-stage="exchange-connection-list"]')).toBeVisible()
  const railHome = page.locator('.client-rail-new-row button')
  if (await railHome.isVisible()) await railHome.click()
  else await railHome.dispatchEvent('click')
  await expect(page.locator('.native-connection-onboarding')).toHaveCount(0)
  await expect(page.locator('.native-service-route-content')).toBeVisible()
})
