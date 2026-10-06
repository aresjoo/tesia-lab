import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const mockNames = ['Mock 계정으로 로그인', 'Log in with a mock account', 'モックアカウントでログイン', '使用模拟账户登录', '使用模擬帳戶登入', 'Iniciar sesión con una cuenta simulada', 'Se connecter avec un compte fictif']
const groupNames = ['체결 알림', 'Order Filled notifications', '約定の通知', '成交通知', '成交通知', 'Notificaciones: Ejecución', 'Notifications : Exécution']

test('owned shell dictionaries have seven complete locales and preserve interpolation slots', () => {
  const files = ['client-shell-copy.ts', 'client-settings-security-copy.ts', 'client-settings-billing-copy.ts', 'client-settings-notifications-copy.ts', 'internal-poc/native-shell-copy.ts', 'internal-poc/native-auth-ui-copy.ts']
  let count = 0
  const slots = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(`src/${file}`, 'utf8'), ts.ScriptTarget.Latest, true)
    function visit(node: ts.Node) {
      if (ts.isArrayLiteralExpression(node) && node.elements.every(ts.isStringLiteral) && node.elements.some(item => /[가-힣]/.test((item as ts.StringLiteral).text))) {
        const values = node.elements.map(item => (item as ts.StringLiteral).text)
        expect(values, file).toHaveLength(7)
        for (const [index, value] of values.entries()) {
          expect(value.trim(), `${file}:${index}`).not.toBe('')
          if (index) expect(value, `${file}:${index}`).not.toMatch(/[가-힣]/)
          expect(slots(value), `${file}:${index}`).toEqual(slots(values[0]))
        }
        count++
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  const settings = JSON.parse(readFileSync('src/client-settings-copy.json', 'utf8')) as Record<string, Record<string, string>>
  for (const [key, values] of Object.entries(settings)) {
    expect(Object.keys(values).sort(), key).toEqual([...locales].sort())
    for (const locale of locales) {
      expect(values[locale].trim(), `${key}:${locale}`).not.toBe('')
      if (locale !== 'ko') expect(values[locale], `${key}:${locale}`).not.toMatch(/[가-힣]/)
      expect(slots(values[locale]), `${key}:${locale}`).toEqual(slots(values.ko))
    }
  }
  expect(count).toBeGreaterThan(200)
})

test('connection and delegation UI dictionaries cover literal keys, fixture copy and preserve all slots', () => {
  const keys = new Set<string>()
  for (const file of ['client-connection-locale-copy.ts', 'client-delegation-locale-copy.ts', 'client-user-strategy-locale-copy.ts']) {
    const source = ts.createSourceFile(file, readFileSync(`src/${file}`, 'utf8'), ts.ScriptTarget.Latest, true)
    const seen = new Map<string, Set<string>>()
    function visit(node: ts.Node) {
      if (ts.isArrayLiteralExpression(node) && node.elements.length > 1 && node.elements.every(ts.isStringLiteral) && /[가-힣]|Running/.test((node.elements[0] as ts.StringLiteral).text)) {
        const values = node.elements.map(item => (item as ts.StringLiteral).text)
        expect(values).toHaveLength(7)
        // A singular variant deliberately has the same Korean key as its base
        // dictionary. Reject duplicate keys within each actual dictionary,
        // while checking both variants for complete columns/identical slots.
        let owner: ts.Node = node
        while (owner.parent && !ts.isVariableDeclaration(owner)) owner = owner.parent
        const dictionaryName = ts.isVariableDeclaration(owner) ? owner.name.getText(source) : 'top-level'
        const dictionaryKeys = seen.get(dictionaryName) ?? new Set<string>()
        expect(dictionaryKeys.has(values[0]), `Duplicate ${file}:${dictionaryName}:${values[0]}`).toBe(false)
        dictionaryKeys.add(values[0]); seen.set(dictionaryName, dictionaryKeys); keys.add(values[0])
        for (const [index, value] of values.entries()) {
          expect(value.trim()).not.toBe('')
          if (index) expect(value, `${file}:${values[0]}:${locales[index]}`).not.toMatch(/[가-힣]/)
          expect([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort(), `${values[0]}:${locales[index]}`).toEqual([...values[0].matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort())
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  for (const file of ['ClientConnectionPlan.tsx', 'ClientConnectionStatus.tsx', 'ClientDelegationWorkspace.tsx', 'ClientDelegationChart.tsx']) {
    const source = ts.createSourceFile(file, readFileSync(`src/components/${file}`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ['c', 'd'].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) expect(keys.has(node.arguments[0].text), `${file}:${node.arguments[0].text}`).toBe(true)
      if (ts.isJsxText(node)) expect(node.text, file).not.toMatch(/[가-힣]/)
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) expect(node.initializer.text, file).not.toMatch(/[가-힣]/)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  const fixture = ts.createSourceFile('fixture', readFileSync('src/client-delegation-fixtures.ts', 'utf8'), ts.ScriptTarget.Latest, true)
  function fixtureVisit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ['delegationQuestions', 'delegationSteps', 'delegationExchanges', 'delegationRiskCopy'].includes(node.name.getText(fixture))) {
      const visit = (child: ts.Node) => { if (ts.isStringLiteral(child) && /[가-힣]/.test(child.text)) expect(keys.has(child.text), child.text).toBe(true); ts.forEachChild(child, visit) }
      visit(node)
    } else ts.forEachChild(node, fixtureVisit)
  }
  fixtureVisit(fixture)
})

async function mountLocalizedSurface(page: Page, baseURL: string | undefined, surface: 'plan' | 'status' | 'delegation') {
  const blocked: string[] = [], errors: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { blocked.push(`${request.method()} ${url.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.route('**/localization-expansion.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b0c0e;color:white"><div id="fixture"></div></body></html>' }))
  await page.goto('/localization-expansion.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async surface => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = surface === 'plan' ? '/src/components/ClientConnectionPlan.tsx' : surface === 'status' ? '/src/components/ClientConnectionStatus.tsx' : '/src/components/ClientDelegationWorkspace.tsx'
    const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('React import missing')
    const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm, dom = '/@id/react-dom/client', dm = await import(/* @vite-ignore */ dom)
    const component = await import(/* @vite-ignore */ path), prefs = '/src/client-preferences.ts', preference = await import(/* @vite-ignore */ prefs)
    for (const skin of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css']) await import(/* @vite-ignore */ skin)
    preference.setClientPreference('language', 'ko')
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const fixture = { view: { step: 'plan', exchange: 'bitget' }, state: { kind: 'authorization_result', exchange: 'bitget', authorization: 'idle' } as object, calls: [] as string[],
      setLocale: (locale: string) => preference.setClientPreference('language', locale), render: () => {} }
    const action = () => fixture.calls.push('action')
    fixture.render = () => root.render(React.createElement(React.StrictMode, null, surface === 'plan'
      ? React.createElement(component.default, { view: fixture.view, signedIn: true, onNavigate: (view: typeof fixture.view) => { fixture.view = view; fixture.render() }, onSignup: action, onClose: action, onHelp: action })
      : surface === 'status' ? React.createElement(component.ClientConnectionStatus, { scope: 'owner-a', source: 'mock', presentation: { scope: 'owner-a', identity: JSON.stringify(fixture.state), source: 'mock', state: fixture.state } })
        : React.createElement(component.ClientDelegationWorkspace, { sessionId: 'locale-preserved-delegation', idea: '내가 직접 쓴 투자 아이디어 $& <보존>', onBack: action, onStrategyRegistered: () => { action(); return false } })))
    Object.assign(window, { localeExpansion: fixture }); fixture.render()
  }, surface)
  await expect(page.locator(surface === 'plan' ? '.client-connection-plan' : surface === 'status' ? '.client-connection-status' : '.client-delegation')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}
const setLocale = (page: Page, locale: string) => page.evaluate(value => Reflect.get(window, 'localeExpansion').setLocale(value), locale)

test('source user strategy localizes logs and edit summaries while preserving caller fields, record and apply payload', async ({ page, baseURL }, testInfo) => {
  const blocked: string[] = [], errors: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET','HEAD'].includes(request.method())) { blocked.push(`${request.method()} ${url.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.route('**/user-localization.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body><main id="tesia-main"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/user-localization.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientUserStrategy.tsx', dp = '/@id/react-dom/client', ep = '/src/client-delegation-engine.ts', pp = '/src/client-preferences.ts', lp = '/src/client-user-strategy-locale-copy.ts', sp = '/src/client-terminal-source-fixture.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('React import missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), engine = await import(/* @vite-ignore */ ep), preferences = await import(/* @vite-ignore */ pp), component = await import(/* @vite-ignore */ cp), copy = await import(/* @vite-ignore */ lp), data = await import(/* @vite-ignore */ sp)
    for (const skin of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css']) await import(/* @vite-ignore */ skin)
    preferences.setClientPreference('language','ko')
    const React = rm.default ?? rm, parameters = engine.delegationRecommendedParameters(), evaluated = engine.evaluateDelegation(parameters,1)
    const record = { id:'1000', createdAt:1000, name:'나의 원본 전략 $& <보존>', status:'live', environment:'paper', parameters, score:evaluated.score, ret:evaluated.result.ret, mdd:evaluated.result.mdd, n:evaluated.result.n, winRate:evaluated.result.winRate, origin:'작성자 원문', exchangeName:'공급 거래소' }
    const calls: unknown[] = [], root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const events = { fillLog:[{fid:'fill-a',botId:'1000',side:'s',label:'공급 체결 문장',pnl:-.05,kind:'sl',sim:true,at:1000}], reviews:[], rebates:[] }
    const options = { record, events, money:String, onNavigate:()=>calls.push('navigate'), onControl:()=>calls.push('control'), position:{title:'공급 포지션',description:'상태 원문',checks:['체크 원문']}, executionPermissionLabel:'권한 원문', onApplyEdit:(expected:unknown, candidate:unknown)=>{calls.push({expected,candidate}); return Promise.resolve()} }
    const freeze = (value: object) => { Object.values(value).forEach(item => { if(item && typeof item==='object')freeze(item) }); Object.freeze(value) }
    freeze(record)
    const sourceEvents = [...new Map(data.sourceTerminalSeeds.flatMap((seed: {parameters:object;capital:number}) => data.evaluateSourceTerminal(seed.parameters,seed.capital).L.evs).map((event: {txt:string})=>[event.txt,event])).values()]
    Object.assign(window,{ userLocale: {record,calls,sourceEvents,copy,setLocale:(locale:string)=>preferences.setClientPreference('language',locale)} })
    root.render(React.createElement(component.ClientUserStrategy,options))
  })
  await expect(page.locator('.nfxb-title')).toHaveText('나의 원본 전략 $& <보존>')
  await page.evaluate(() => document.fonts.ready)
  const record = await page.evaluate(()=>Reflect.get(window,'userLocale').record)
  const userValues = ['나의 원본 전략 $& <보존>','작성자 원문','공급 거래소','공급 체결 문장','공급 포지션','상태 원문','체크 원문','권한 원문']
  const shape = await page.locator('.nfxb-line').getAttribute('d')
  for(const locale of locales) {
    await page.evaluate(locale=>Reflect.get(window,'userLocale').setLocale(locale),locale)
    await expect(page.locator('.nfxb-title')).toHaveText(userValues[0])
    for(const value of userValues) await expect(page.locator('.client-user-strategy')).toContainText(value)
    const text = await page.locator('.client-user-strategy').innerText()
    if(locale!=='ko') expect(userValues.reduce((remaining,value)=>remaining.replaceAll(value,''),text)).not.toMatch(/[가-힣]/)
    expect(await page.locator('.nfxb-line').getAttribute('d')).toEqual(shape)
    const logProof = await page.evaluate(locale=>{
      const f=Reflect.get(window,'userLocale')
      return f.sourceEvents.map((event:{txt:string})=>({source:event.txt,translated:f.copy.sourceActionLogLocaleText(locale,event.txt)}))
    },locale) as {source:string;translated:string}[]
    expect(logProof.length).toBeGreaterThan(100)
    for(const row of logProof) {
      if(locale!=='ko') expect(row.translated,row.source).not.toMatch(/[가-힣]/)
      else expect(row.translated).toEqual(row.source)
      expect(row.translated.match(/[+-]?\d+(?:\.\d+)?/g),row.source).toEqual(row.source.match(/[+-]?\d+(?:\.\d+)?/g))
    }
    expect(await page.evaluate(()=>Reflect.get(window,'userLocale').record)).toEqual(record)
    await page.locator('.nfxb-hero').screenshot({ path:testInfo.outputPath(`user-strategy-${locale}.png`) })
  }
  await page.evaluate(()=>Reflect.get(window,'userLocale').setLocale('ko'))
  await page.getByRole('button',{name:'전략 수정',exact:true}).click()
  const select = page.locator('dialog select').first(), original = await select.elementHandle()
  for(const locale of locales) {
    await page.evaluate(locale=>Reflect.get(window,'userLocale').setLocale(locale),locale)
    expect(await select.evaluate((node,saved)=>node===saved,original)).toBe(true)
    await expect(select).toHaveValue(String(record.parameters.sl))
    if(locale!=='ko') expect((await page.locator('dialog').innerText()).replace(userValues[0],'')).not.toMatch(/[가-힣]/)
  }
  await page.evaluate(()=>Reflect.get(window,'userLocale').setLocale('ko'))
  await page.getByRole('button',{name:'재검증',exact:true}).click()
  await expect(page.getByRole('button',{name:'이 전략에 적용',exact:true})).toBeEnabled()
  const resultNumbers = await page.locator('.user-edit-result').evaluate(node=>node.textContent!.match(/[+-]?\d+(?:\.\d+)?/g))
  for(const locale of locales) {
    await page.evaluate(locale=>Reflect.get(window,'userLocale').setLocale(locale),locale)
    const text=await page.locator('.user-edit-result').innerText()
    if(locale!=='ko') expect(text).not.toMatch(/[가-힣]/)
    expect(text.match(/[+-]?\d+(?:\.\d+)?/g)).toEqual(resultNumbers)
  }
  expect(await page.evaluate(()=>Reflect.get(window,'userLocale').calls)).toEqual([])
  await page.evaluate(()=>Reflect.get(window,'userLocale').setLocale('ko'))
  await page.getByRole('button',{name:'이 전략에 적용',exact:true}).click()
  await expect(page.locator('dialog')).toHaveCount(0)
  expect(await page.evaluate(()=>Reflect.get(window,'userLocale').calls)).toEqual([{expected:record,candidate:record.parameters}])
  expect(blocked).toEqual([]); expect(errors).toEqual([])
})

test('all connection plan steps translate while checkout focus and blocked payment remain unchanged', async ({ page, baseURL }, testInfo) => {
  const audit = await mountLocalizedSurface(page, baseURL, 'plan')
  for (const step of ['plan', 'checkout', 'free', 'account', 'authorize']) {
    await page.evaluate(step => { const f = Reflect.get(window, 'localeExpansion'); f.view = { step, exchange: 'bitget' }; f.render() }, step)
    await expect(page.locator('[data-testid="connection-plan"]')).toHaveAttribute('data-step', step)
    const trigger = page.locator('.cpl-back'); await trigger.focus()
    for (const locale of locales) {
      await setLocale(page, locale)
      await expect(trigger).toBeFocused()
      if (locale !== 'ko') {
        expect(await page.locator('.client-connection-plan').innerText()).not.toMatch(/[가-힣]/)
        const labels = await page.locator('.client-connection-plan [aria-label], .client-connection-plan [placeholder]').evaluateAll(nodes => nodes.map(n => `${n.getAttribute('aria-label') ?? ''} ${n.getAttribute('placeholder') ?? ''}`).join('\n'))
        expect(labels).not.toMatch(/[가-힣]/)
      }
      if (step === 'checkout') {
        await expect(page.locator('fieldset')).toHaveAttribute('disabled', '')
        for (const input of await page.locator('fieldset input').all()) await expect(input).toBeDisabled()
        await expect(page.locator('.cpl-sumcard button')).toBeDisabled()
      }
      if (step === 'plan') await page.locator('.client-connection-plan').screenshot({ path:testInfo.outputPath(`connection-plan-${locale}.png`) })
    }
  }
  expect(await page.evaluate(() => Reflect.get(window, 'localeExpansion').calls)).toEqual([])
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('all connection status branches localize without changing supplied strategy names, amounts, eligibility or actions', async ({ page, baseURL }, testInfo) => {
  const audit = await mountLocalizedSurface(page, baseURL, 'status')
  const connection = { id: 'connection-a', exchange: 'bitget', route: 'partner', eligibility: 'eligible', maskedAccountLabel: '38••••42' }
  const states = [
    { kind: 'authorization_result', exchange: 'bitget', authorization: 'failed', invitationRouteAvailable: true },
    { kind: 'invitation_verifying', exchange: 'bitget', accountChecked: true }, { kind: 'not_invited', exchange: 'bitget' },
    { kind: 'connected_done', connection, strategyName: '내 전략 $& <보존>', continuation: 'copy' },
    { kind: 'strategy_start_after_connection', connection, strategyName: '내 전략 $& <보존>', amountLabel: '₩512,345', feeLabel: '제공자 값 $0' },
    { kind: 'connected_list', connections: [connection] }, { kind: 'subscription_expired', connection: { ...connection, route: 'paid', eligibility: 'expired' } },
    { kind: 'disconnect_confirmation', connection }, { kind: 'kyc_before_start', connection, kyc: 'review' },
    { kind: 'eligible_my_exchange_filter', connections: [connection], selected: 'all', empty: true },
  ]
  for (const state of states) {
    await page.evaluate(state => { const f = Reflect.get(window, 'localeExpansion'); f.state = state; f.render() }, state)
    await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', state.kind)
    for (const locale of locales) {
      await setLocale(page, locale)
      if (locale !== 'ko') expect((await page.locator('.client-connection-status').innerText()).replaceAll('내 전략 $& <보존>', '').replaceAll('제공자 값 $0', '')).not.toMatch(/[가-힣]/)
      if ('strategyName' in state) await expect(page.locator('.px-lead')).toContainText('내 전략 $& <보존>')
      if ('amountLabel' in state) await expect(page.locator('.px-rows')).toContainText('₩512,345')
      for (const button of await page.locator('.client-connection-status button').all()) await expect(button).toBeDisabled()
      if (state.kind === 'connected_done') await page.locator('.client-connection-status').screenshot({ path:testInfo.outputPath(`connection-status-${locale}.png`) })
    }
  }
  expect(await page.evaluate(() => Reflect.get(window, 'localeExpansion').calls)).toEqual([])
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('delegation questions, actual synthetic result chart and retained card draft localize without changing parameters', async ({ page, baseURL }, testInfo) => {
  const audit = await mountLocalizedSurface(page, baseURL, 'delegation')
  for (let question = 0; question < 5; question++) {
    for (const locale of locales) {
      await setLocale(page, locale)
      if (locale !== 'ko') expect((await page.locator('.client-delegation').innerText()).replace('내가 직접 쓴 투자 아이디어 $& <보존>', '')).not.toMatch(/[가-힣]/)
      await expect(page.locator('.tf-user-message')).toHaveText('내가 직접 쓴 투자 아이디어 $& <보존>')
    }
    await page.locator('.tfq .op.rec').click()
  }
  for (const locale of locales) {
    await setLocale(page, locale)
    if (locale !== 'ko') expect((await page.locator('.client-delegation').innerText()).replace('내가 직접 쓴 투자 아이디어 $& <보존>', '')).not.toMatch(/[가-힣]/)
  }
  await setLocale(page, 'ko'); await page.getByRole('button', { name: '전략 검증 시작', exact: true }).click()
  await page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true }).click()
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toBeVisible()
  const markers = await page.locator('.tf-source-marker').evaluateAll(nodes => nodes.map(n => [n.getAttribute('data-index'), n.getAttribute('data-price'), n.getAttribute('data-side')]))
  const snapshot = await page.evaluate(() => sessionStorage.getItem('teth:client-delegation:locale-preserved-delegation'))
  await page.getByRole('button', { name: '1W', exact: true }).click()
  for (const locale of locales) {
    await setLocale(page, locale)
    if (locale !== 'ko') expect(await page.locator('.client-delegation').innerText()).not.toMatch(/[가-힣]/)
    await expect(page.getByRole('button', { name: '1W', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.locator('.tf-source-marker').evaluateAll(nodes => nodes.map(n => [n.getAttribute('data-index'), n.getAttribute('data-price'), n.getAttribute('data-side')]))).toEqual(markers)
    const stored = await page.evaluate(() => sessionStorage.getItem('teth:client-delegation:locale-preserved-delegation'))
    expect(JSON.parse(stored!).parameters).toEqual(JSON.parse(snapshot!).parameters)
    expect(JSON.parse(stored!).answers).toEqual(JSON.parse(snapshot!).answers)
  }
  await setLocale(page, 'ko'); await page.getByRole('button', { name: '리포트 보기', exact: true }).click()
  for (const locale of locales) {
    await setLocale(page, locale)
    if (locale !== 'ko') expect(await page.locator('.client-delegation').innerText()).not.toMatch(/[가-힣]/)
    await page.locator('.client-delegation').screenshot({ path:testInfo.outputPath(`delegation-report-${locale}.png`) })
  }
  await setLocale(page, 'ko'); await page.getByRole('button', { name: '이 전략 실행하기', exact: true }).click()
  await page.getByRole('button', { name: '기존 계정 연결', exact: true }).click()
  await page.getByRole('button', { name: '계속', exact: true }).click()
  const name = page.locator('input').last(); await name.fill('사용자가 쓴 이름 $&')
  const input = await name.elementHandle()
  for (const locale of locales) {
    await setLocale(page, locale)
    if (locale !== 'ko') expect(await page.locator('.client-delegation').innerText()).not.toMatch(/[가-힣]/)
    await expect(name).toHaveValue('사용자가 쓴 이름 $&')
    expect(await name.evaluate((node, saved) => node === saved, input)).toBe(true)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'localeExpansion').calls)).toEqual([])
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('retained real shell and notifications update all seven accessible labels without account actions', async ({ page, baseURL }) => {
  const blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const origin = new URL(baseURL!).origin
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.pathname}`); return route.abort()
    }
    return route.continue()
  })
  await page.route('**/shell-localization.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
  await page.goto('/shell-localization.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const chromePath = '/src/components/ClientChrome.tsx'
    const source = await (await fetch(chromePath)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('React import missing')
    const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm, h = React.createElement
    const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
    const notificationPath = '/src/components/ClientSettingsNotifications.tsx', preferencePath = '/src/client-preferences.ts'
    const { ClientChrome } = await import(/* @vite-ignore */ chromePath)
    const { ClientSettingsNotifications } = await import(/* @vite-ignore */ notificationPath)
    const { setClientPreference } = await import(/* @vite-ignore */ preferencePath)
    setClientPreference('language', 'ko')
    const calls: string[] = [], action = () => calls.push('action')
    Object.assign(window, { setAuditLocale: (locale: string) => setClientPreference('language', locale), localizationCalls: calls })
    const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
    root.render(h(React.StrictMode, null, h(ClientChrome, { signedIn: false, onHome: action, onLogin: action, onSignup: action, onSettings: action, onLocale: action, onDashboard: action }), h('div', { id: 'notification-fixture' }, h(ClientSettingsNotifications, { scopeId: 'unchanged-owner' }))))
  })
  const login = page.locator('button.client-login'), group = page.locator('[data-notification-topic="fill"] [role="group"]')
  await expect(login).toHaveCount(1)
  const original = await login.elementHandle()
  for (let index = 0; index < locales.length; index++) {
    await page.evaluate(locale => (window as unknown as { setAuditLocale(locale: string): void }).setAuditLocale(locale), locales[index])
    await expect(page.locator('html')).toHaveAttribute('lang', locales[index])
    await expect(login).toHaveAccessibleName(mockNames[index])
    await expect(group).toHaveAccessibleName(groupNames[index])
    expect(await login.evaluate((node, saved) => node === saved, original)).toBe(true)
    await expect(group.locator('button').first()).toBeDisabled()
  }
  expect(await page.evaluate(() => (window as unknown as { localizationCalls: string[] }).localizationCalls)).toEqual([])
  expect(errors).toEqual([])
  expect(blocked).toEqual([])
})
