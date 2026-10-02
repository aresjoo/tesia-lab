import { expect, test, type Page } from '@playwright/test'
type Kind = 'method' | 'plan' | 'payment' | 'payment-confirm' | 'exchange' | 'partner' | 'uid' | 'api' | 'complete'
type Controls = { renderConnection: (kind: Kind, scope?: string, ready?: boolean, id?: string) => void; renderMissingConnection: () => void; settleConnection: (index: number, failure?: boolean) => void; connectionCalls: { kind: string; valid?: boolean }[]; closeConnection: () => void; connectionClosed: number }
async function mount(page: Page, kind: Kind = 'method', ready = true) {
  await page.route('**/connection-onboarding-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0b0c0e"></body></html>' }))
  await page.goto('/connection-onboarding-audit.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async ({ kind, ready }) => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const css = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */css)
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeConnectionOnboarding.tsx', pp = '/src/client-preferences.ts'
    const React = await import(/* @vite-ignore */rp), DOM = await import(/* @vite-ignore */dp), { NativeConnectionOnboarding } = await import(/* @vite-ignore */cp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const element = React.createElement ?? React.default.createElement, host = document.createElement('div'); document.body.append(host)
    const root = (DOM.createRoot ?? DOM.default.createRoot)(host), calls: Controls['connectionCalls'] = [], pending: { resolve: () => void; reject: () => void }[] = []
    const wait = (name: string, valid = true) => { calls.push({ kind: name, valid }); return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_PROVIDER_EXCEPTION')) })) }
    const guide = { title: '공급된 연결 가이드', steps: ['공급된 첫 단계', '공급된 두 번째 단계'], note: '공급된 권한 안내', url: 'javascript:alert(1)' }
    const rows = [{ id: 'plan', label: '플랜', value: '공급된 월간 플랜' }, { id: 'price', label: '결제 금액', value: '17.00 USDC' }, { id: 'card', label: '카드', value: '•••• 1234' }]
    const render = (stageKind: Kind, scope = 'owner-a', connected = true, id = 'first') => {
      const choose = connected ? (id: string) => wait('choose', !!id) : undefined
      const states = {
        method: { choices: [{ id: 'partner', title: '공급된 파트너 플랜', description: '확인된 파트너 조건', price: '3.00 USDC', badge: '제공된 혜택', actionLabel: '파트너 선택' }, { id: 'paid', title: '공급된 기존 계정 플랜', price: '17.00 USDC', actionLabel: '기존 계정 선택' }], onChoose: choose },
        plan: { choices: [{ id: 'year', title: '연 결제', description: '공급된 연간 조건', price: '170.00 USDC' }, { id: 'month', title: '월 결제', price: '17.00 USDC' }], selectedId: 'month', onChoose: choose, onContinue: connected ? () => wait('continue') : undefined },
        payment: { rows, onCheckout: connected ? () => wait('checkout') : undefined },
        'payment-confirm': { rows, onConfirm: connected ? () => wait('confirm') : undefined },
        exchange: { exchanges: [{ id: 'example', title: 'Supplied Exchange', badge: '제공됨' }], onChoose: choose },
        partner: { exchangeName: 'Supplied Exchange', registrationUrl: 'https://example.com/signup', guide, onJoined: connected ? () => wait('joined') : undefined },
        uid: { exchangeId: 'example', exchangeName: 'Supplied Exchange', guide, onVerify: connected ? (uid: string) => wait('uid', uid === '12345678') : undefined },
        api: { exchangeId: 'example', exchangeName: 'Supplied Exchange', guide, requiresPassphrase: true, disclosure: '제공된 권한 요청 설명', permissions: [{ id: 'read', label: '조회', requested: true }, { id: 'trade', label: '거래', requested: null }, { id: 'withdraw', label: '출금', requested: false }], onConnect: connected ? (input: {apiKey: string; secretKey: string; passphrase?: string}) => wait('api', input.apiKey.length >= 10 && input.secretKey.length >= 10 && !!input.passphrase) : undefined },
        complete: { description: '공급자가 확인한 연결 상태입니다.', rows, actions: [{ id: 'paper', label: '가상으로 먼저 시작', primary: true, onRun: connected ? () => wait('paper') : undefined }] },
      }
      root.render(element(NativeConnectionOnboarding, { accountScope: scope, onReturn: () => { Reflect.set(window, 'connectionClosed', Number(Reflect.get(window, 'connectionClosed') ?? 0) + 1); root.render(null) }, presentation: { scope, identity: 'connection-a', status: 'ready', state: { id, kind: stageKind, ...states[stageKind], onBack: connected ? () => wait('back') : undefined }, sourceLabel: 'SUPPLIED UI TEST INPUT' } }))
    }
    Object.assign(window, { renderConnection: render, renderMissingConnection: () => root.render(element(NativeConnectionOnboarding,{accountScope:'new-owner',onReturn:()=>{},presentation:{scope:'old-owner',identity:'old',status:'ready',state:{id:'old',kind:'complete',description:'OLD_OWNER_PRIVATE',rows:[],actions:[]}}})), connectionCalls: calls, connectionClosed: 0, closeConnection: () => root.render(null), settleConnection: (index: number, failure = false) => failure ? pending[index].reject() : pending[index].resolve() })
    render(kind, 'owner-a', ready)
  }, { kind, ready })
  await expect(page.locator('.native-connection-onboarding')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.load('14px "Noto Sans KR Variable"', '권한 확인하고 연결하기'); await document.fonts.ready })
}
async function stage(page: Page, kind: Kind, scope = 'owner-a', ready = true, id = 'first') { await page.evaluate(({kind,scope,ready,id}) => (window as unknown as Controls).renderConnection(kind,scope,ready,id), {kind,scope,ready,id}); await expect(page.locator('.native-connection-onboarding')).toHaveAttribute('data-stage',kind) }
async function settle(page: Page, index = 0, failure = false) { await page.evaluate(({index,failure}) => (window as unknown as Controls).settleConnection(index,failure),{index,failure}) }
async function calls(page: Page) { return page.evaluate(() => (window as unknown as Controls).connectionCalls) }

test('원본 네 단계·결제주기·hosted 결제·확인·가입·완료는 공급 상태만 표시한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.tf-prog .p')).toHaveCount(4)
  await page.getByRole('button',{name:'파트너 선택',exact:true}).click()
  await settle(page)
  await expect(page.locator('.native-connection-onboarding')).toHaveAttribute('data-stage','method')
  await expect(page.getByRole('status')).toContainText('확인된 상태')
  await stage(page,'plan'); await expect(page.locator('.tf-cyc2[aria-pressed=true]')).toContainText('월 결제')
  await stage(page,'payment'); await expect(page.locator('.tf-payp')).toContainText('17.00 USDC'); await expect(page.locator('input')).toHaveCount(0)
  await page.getByRole('button',{name:'결제 화면 열기'}).click(); await settle(page,1)
  await expect(page.locator('.native-connection-onboarding')).toHaveAttribute('data-stage','payment')
  await stage(page,'payment-confirm'); await expect(page.locator('.tf-payp')).toContainText('•••• 1234')
  await stage(page,'exchange'); await expect(page.locator('.tf-ex')).toContainText('Supplied Exchange')
  await stage(page,'partner'); await expect(page.getByRole('link',{name:'가입 링크 열기'})).toHaveAttribute('rel','noopener noreferrer')
  await stage(page,'complete'); await expect(page.locator('.tf-donec .ck svg')).toHaveCount(1); await expect(page.locator('.tf-donec')).toContainText('17.00 USDC')
  await expect(page.locator('body')).not.toContainText('599,000')
})

test('UID 검증·가이드 왕복·중복 방지·실패 초안 보존 후 성공도 임의 전이하지 않는다', async ({ page }) => {
  await mount(page,'uid')
  const input=page.getByRole('textbox',{name:'Supplied Exchange UID'})
  await input.fill('12'); await page.getByRole('button',{name:'연동 확인하기'}).click(); await expect(page.getByRole('alert')).toContainText('5~12')
  await input.fill('12345678'); await page.getByRole('button',{name:'UID가 어디 있어요?'}).click(); await expect(page.getByRole('dialog')).toContainText('공급된 두 번째 단계')
  await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0); await page.keyboard.press('Escape'); await expect(input).toHaveValue('12345678')
  await page.getByRole('button',{name:'연동 확인하기'}).dblclick(); expect(await calls(page)).toEqual([{kind:'uid',valid:true}])
  await expect(input).toHaveAttribute('readonly',''); await settle(page,0,true)
  await expect(page.getByRole('alert')).not.toContainText('PRIVATE_PROVIDER_EXCEPTION'); await expect(input).toHaveValue('12345678')
  await page.getByRole('button',{name:'연동 확인하기'}).click(); await settle(page,1)
  await expect(page.locator('.native-connection-onboarding')).toHaveAttribute('data-stage','uid')
})

test('API는 콜백 미공급 시 가이드만, 공급 시 password DOM 속성 비노출·Passphrase·실패 보존·성공 소거', async ({page}) => {
  await mount(page,'api',false)
  await expect(page.locator('input')).toHaveCount(0)
  await page.getByRole('button',{name:'발급 방법 보기'}).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape')
  await stage(page,'api','owner-a',true,'provided')
  await page.getByLabel('API Key',{exact:true}).fill('synthetic-key-only')
  await page.getByLabel('Secret Key',{exact:true}).fill('synthetic-secret-only')
  await page.getByRole('button',{name:'권한 확인하고 연결하기'}).click(); await expect(page.getByRole('alert')).toContainText('Passphrase')
  await page.getByLabel('Passphrase',{exact:true}).fill('synthetic-pass-only')
  expect(await page.locator('input').evaluateAll(inputs=>inputs.every(input=>!input.hasAttribute('value')))).toBe(true)
  await expect(page.locator('body')).not.toContainText('synthetic-secret-only')
  await page.getByRole('button',{name:'권한 확인하고 연결하기'}).dblclick(); expect(await calls(page)).toEqual([{kind:'api',valid:true}])
  await settle(page,0,true); await expect(page.getByLabel('Secret Key',{exact:true})).toHaveValue('synthetic-secret-only')
  await page.getByRole('button',{name:'권한 확인하고 연결하기'}).click(); await settle(page,1)
  await expect(page.getByLabel('Secret Key',{exact:true})).toHaveValue('')
  await expect(page.locator('.native-connection-onboarding')).toHaveAttribute('data-stage','api')
  expect(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>/connection|credential/.test(key)))).toBe(false)
})

test('owner 교체·같은 단계 새 identity·이탈은 이전 입력과 늦은 실패를 격리한다',async({page})=>{
  await mount(page,'uid'); await page.getByRole('textbox').fill('12345678'); await page.getByRole('button',{name:'연동 확인하기'}).click()
  await stage(page,'uid','owner-b'); await settle(page,0,true); await expect(page.getByRole('textbox')).toHaveValue(''); await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('textbox').fill('12345678'); await page.getByRole('button',{name:'연동 확인하기'}).click()
  await stage(page,'uid','owner-b',true,'second'); await settle(page,1); await expect(page.getByRole('status')).toHaveCount(0)
  await stage(page,'api','owner-b'); await page.getByLabel('Secret Key',{exact:true}).fill('synthetic-secret-only')
  const secret=await page.getByLabel('Secret Key',{exact:true}).elementHandle()
  await page.getByRole('button',{name:'이전',exact:true}).first().click(); await expect(page.locator('.native-connection-onboarding')).toHaveCount(0)
  expect(await secret!.evaluate(input=>(input as HTMLInputElement).value)).toBe('')
})

test('7개 언어와 모든 공급 단계는 320px에서 원본 구조를 유지한다',async({page},info)=>{
  await page.setViewportSize({width:320,height:740}); await mount(page)
  const languages=['ko','en','ja','zh-CN','zh-TW','es','fr']
  const titles=['전략 실행','Strategy execution','戦略の実行','策略执行','策略執行','Ejecución de estrategia','Exécution de stratégie']
  for(let i=0;i<languages.length;i++){
    await page.evaluate(async language=>{const path='/src/client-preferences.ts';(await import(/* @vite-ignore */path)).setClientPreference('language',language)},languages[i])
    await expect(page.locator('.tfw-hd h2')).toHaveText(titles[i])
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  }
  for(const kind of ['method','plan','payment','payment-confirm','exchange','partner','uid','api','complete'] as Kind[]){await stage(page,kind);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.locator('.tfw input,.tfw button').evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().right<=innerWidth+1))).toBe(true)}
  await page.screenshot({path:info.outputPath('connection-complete-320.png'),fullPage:true})
  await stage(page,'api'); await page.screenshot({path:info.outputPath('connection-api-320.png'),fullPage:true})
})

test('동일 화면의 credential 입력 권한 철회와 owner 불일치는 비밀 필드와 완료 표시를 남기지 않는다',async({page})=>{
  await mount(page,'api')
  await page.getByLabel('Secret Key',{exact:true}).fill('synthetic-secret-only')
  const previous=await page.getByLabel('Secret Key',{exact:true}).elementHandle()
  await stage(page,'api','owner-a',false)
  await expect(page.locator('input')).toHaveCount(0)
  expect(await previous!.evaluate(input=>(input as HTMLInputElement).value)).toBe('')
  await page.evaluate(()=>(window as unknown as Controls).renderMissingConnection())
  await expect(page.locator('.native-connection-onboarding')).toHaveAttribute('data-stage','unavailable')
  await expect(page.locator('body')).not.toContainText('OLD_OWNER_PRIVATE')
  await expect(page.locator('.tf-donec')).toHaveCount(0)
})

test('단계 개방과 키보드 선택 후 새 단계는 제목으로 초점을 이어준다',async({page})=>{
  await mount(page)
  await expect(page.locator('.tf-connect-title')).toBeFocused()
  await page.getByRole('button',{name:'파트너 선택',exact:true}).focus()
  await page.keyboard.press('Enter')
  await stage(page,'exchange')
  await expect(page.locator('.tf-connect-title')).toBeFocused()
  await stage(page,'uid')
  await expect(page.locator('.tf-connect-title')).toBeFocused()
})

test('선택 요청 하나만 진행 표시하고 다른 선택과 이전 문구는 유지한다',async({page})=>{
  await mount(page)
  await page.getByRole('button',{name:'파트너 선택',exact:true}).click()
  await expect(page.locator('.tf-optc').first().getByRole('button')).toHaveAttribute('aria-busy','true')
  await expect(page.locator('.tf-optc').nth(1).getByRole('button')).toHaveText('기존 계정 선택')
  await expect(page.locator('.tf-optc').nth(1).getByRole('button')).toBeDisabled()
  await expect(page.locator('.tfw > button').last()).toHaveText('이전')
  await expect(page.locator('.tfw > button').last()).toBeDisabled()
  await settle(page,0,true)
  await expect(page.locator('.tf-optc').first().getByRole('button')).toHaveText('파트너 선택')
})

test('배경 단계·owner 변경은 보이는 외부 입력과 다른 모달 초점을 빼앗지 않는다',async({page})=>{
  await mount(page)
  await page.evaluate(()=>{const input=document.createElement('input');input.id='outside-focus';document.body.append(input);input.focus()})
  await stage(page,'plan'); await expect(page.locator('#outside-focus')).toBeFocused()
  await stage(page,'uid','owner-b'); await expect(page.locator('#outside-focus')).toBeFocused()
  await page.evaluate(()=>{const dialog=document.createElement('dialog');dialog.id='outside-modal';const input=document.createElement('input');input.id='modal-focus';dialog.append(input);document.body.append(dialog);dialog.showModal();input.focus()})
  await stage(page,'api','owner-b'); await expect(page.locator('#modal-focus')).toBeFocused()
  await page.evaluate(()=>{document.querySelector<HTMLDialogElement>('#outside-modal')!.close();document.querySelector('#outside-modal')!.remove();document.querySelector('#outside-focus')!.remove();const section=document.querySelector('.native-connection-onboarding')!;section.parentElement!.hidden=true;(document.activeElement as HTMLElement)?.blur()})
  await stage(page,'complete','owner-c'); await expect(page.locator('.tf-connect-title')).not.toBeFocused()
  expect(await page.evaluate(()=>document.activeElement===document.body)).toBe(true)
})

test('플랜·거래소·폼·완료·이전 요청도 해당 버튼만 진행 상태가 된다',async({page})=>{
  await mount(page,'plan')
  await page.locator('.tf-cyc2').first().click()
  await expect(page.locator('.tf-cyc2').first()).toHaveAttribute('aria-busy','true')
  await expect(page.locator('.tf-cyc2').nth(1)).toContainText('월 결제')
  await expect(page.locator('.tf-payp > .tf-btn')).toHaveText('계속')
  await stage(page,'exchange'); await page.locator('.tf-ex').click(); await expect(page.locator('.tf-ex')).toHaveAttribute('aria-busy','true')
  await expect(page.locator('.tfw > button').last()).toHaveText('이전')
  await stage(page,'uid'); await page.getByRole('textbox').fill('12345678'); await page.locator('button[type=submit]').click()
  await expect(page.locator('button[type=submit]')).toHaveAttribute('aria-busy','true'); await expect(page.locator('.tfw > button').last()).toHaveText('이전')
  await stage(page,'api'); await page.getByLabel('API Key',{exact:true}).fill('synthetic-key'); await page.getByLabel('Secret Key',{exact:true}).fill('synthetic-secret'); await page.getByLabel('Passphrase',{exact:true}).fill('synthetic-pass'); await page.locator('button[type=submit]').click()
  await expect(page.locator('button[type=submit]')).toHaveAttribute('aria-busy','true'); await expect(page.locator('.tfw > button').last()).toHaveText('이전')
  await stage(page,'complete'); await page.getByRole('button',{name:'가상으로 먼저 시작'}).click()
  await expect(page.locator('.tf-donec button')).toHaveAttribute('aria-busy','true'); await expect(page.locator('.tfw > button').last()).toHaveText('이전')
  await stage(page,'uid','owner-a',true,'back-request'); await page.locator('.tfw > button').last().click()
  await expect(page.locator('.tfw > button').last()).toHaveAttribute('aria-busy','true'); await expect(page.locator('button[type=submit]')).toHaveText('연동 확인하기')
})
