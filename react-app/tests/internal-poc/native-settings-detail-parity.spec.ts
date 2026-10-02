import { expect, test, type Page } from '@playwright/test'

test.setTimeout(30_000)
test.use({ trace: 'off', video: 'off', actionTimeout: 10_000 })
async function mount(page: Page) {
  await page.route('**/settings-detail-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><main id="fixture"></main></body></html>' }))
  await page.goto('/settings-detail-fixture.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window); Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */font)
    const fontSC = '/node_modules/@fontsource-variable/noto-sans-sc/wght.css'; await import(/* @vite-ignore */fontSC)
    const reset = '/src/styles.css'; await import(/* @vite-ignore */reset)
    document.body.style.fontFamily = '"Noto Sans KR Variable",sans-serif'
    const p = '/src/components/ClientLocalePanel.tsx', plan = '/src/internal-poc/NativeAccountPlan.tsx', css = '/src/client-reference.css', pref = '/src/client-preferences.ts'
    await import(/* @vite-ignore */css)
    const source = await (await fetch(p)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, h = React.createElement, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp)
    const { ClientLocalePanel } = await import(/* @vite-ignore */p), { NativeAccountPlan } = await import(/* @vite-ignore */plan), { setClientPreference } = await import(/* @vite-ignore */pref)
    const calls: unknown[] = [], rows = [
      { id: 'supplied-inbox', label: '앱 내 수신함', checked: true, disabled: true, switchTone: 'green', badge: '기본', icon: 'bell' },
      { id: 'chW', label: '앱 내 수신함이라는 이름이어도 추론하지 않음', checked: true, icon: 'bell' },
      { id: 'changeable', label: '공급된 편집 채널', checked: false, switchTone: 'green', icon: 'mail' },
    ]
    function Host() {
      const [open, setOpen] = React.useState(false), [owner, setOwner] = React.useState('owner-a')
      Object.assign(window, { settingsDetailCalls: calls, settingsDetailOwner: setOwner, settingsDetailLanguage: (language: string) => setClientPreference('language', language) })
      const data = { scope: owner, identity: 'dataset-a', sourceLabel: 'SUPPLIED TEST', accounts: null, strategies: null, notifications: null, ledger: {pos:null,open:null,orders:null,fills:null,closed:null,assets:null}, plan: { title:'PLAN', sourceLabel:'SUPPLIED TEST', sections:{plan:[],rebates:[],alerts:[]}, presentation: {title:'PLAN',sourceLabel:'SUPPLIED TEST',status:null,rebates:null,preferences:[{id:'channels',title:'수신 채널',rows}]} }, actions: { onPreference: async (id: string, checked: boolean) => { calls.push([id, checked]); await new Promise((resolve, reject) => Object.assign(window, { settingsDetailResolve: resolve, settingsDetailReject: reject })) } } }
      return h('div', { className: 'client-source-app' }, h('button', { id:'settings-entry', onClick:()=>setOpen(true) }, '언어 및 통화 열기'), h(NativeAccountPlan, { accountScope:owner, presentation:data, location:{kind:'plan',tab:'alerts'}, onReturn:()=>{} }), open && h(ClientLocalePanel, { onClose:()=>{calls.push('closed');setOpen(false)} }))
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  })
  await expect(page.getByRole('switch', {name:'앱 내 수신함',exact:true})).toBeVisible()
}

test('모바일 원본 손잡이는 클릭·Enter·Space로 닫히고 호출 버튼으로 초점이 돌아간다', async ({ page }, info) => {
  await page.setViewportSize({width:320,height:740}); await mount(page)
  for (const activation of ['click','Enter',' '] as const) {
    await page.locator('#settings-entry').click()
    const grab = page.locator('.locale-grab')
    await expect(grab).toHaveRole('button'); await expect(grab).toHaveAccessibleName('닫기')
    if (activation === 'click') await grab.click(); else { await grab.focus(); await grab.press(activation) }
    await expect(page.locator('.client-locale-panel')).toHaveCount(0)
    await expect(page.locator('#settings-entry')).toBeFocused()
    expect(await page.locator('#fixture').evaluate(node=>(node as HTMLElement).inert)).toBe(false)
  }
  await page.locator('#settings-entry').click()
  await expect(page.locator('.locale-grab')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  // The inherited 180ms entrance scales the whole panel; measure after settling.
  await expect.poll(async () => (await page.locator('.locale-grab').boundingBox())!.height).toBeGreaterThanOrEqual(43.99)
  const size = (await page.locator('.locale-grab').boundingBox())!, infoBox = (await page.locator('.locale-info').boundingBox())!
  expect(size.y + size.height).toBeLessThanOrEqual(infoBox.y + .5)
  const close = (await page.locator('.locale-close').boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(infoBox.y + .5)
  expect(size.x + size.width).toBeLessThanOrEqual(close.x)
  const line = await page.locator('.locale-grab').evaluate(node => ({width:getComputedStyle(node,'::before').width,height:getComputedStyle(node,'::before').height}))
  expect(line).toEqual({width:'110px',height:'5px'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  await page.screenshot({path:info.outputPath('locale-grab-320.png'),fullPage:true})
})

test('초록 스위치는 명시 입력에만 반응하며 기본채널의 checked·disabled는 바꾸지 않는다', async ({ page }) => {
  await mount(page)
  const supplied = page.getByRole('switch',{name:'앱 내 수신함',exact:true}), inferred = page.getByRole('switch',{name:'앱 내 수신함이라는 이름이어도 추론하지 않음',exact:true})
  await expect(supplied.locator('+ .nfx-slider')).toHaveClass(/grn/)
  await expect(supplied.locator('+ .nfx-slider')).toHaveCSS('background-color', 'rgb(78, 192, 141)')
  await expect(supplied).toBeChecked(); await expect(supplied).toBeDisabled()
  await expect(inferred.locator('+ .nfx-slider')).not.toHaveClass(/grn/)
  await expect(inferred.locator('+ .nfx-slider')).toHaveCSS('background-color', 'rgb(61, 110, 240)')
  const editable = page.getByRole('switch',{name:'공급된 편집 채널',exact:true})
  await editable.focus(); await editable.press('Space'); await expect(editable).toBeDisabled()
  expect(await page.evaluate(()=>Reflect.get(window,'settingsDetailCalls'))).toEqual([['changeable',true]])
  await page.evaluate(()=>Reflect.get(window,'settingsDetailReject')(new Error('PRIVATE_SETTINGS_FAILURE')))
  await expect(page.getByRole('alert')).toBeVisible(); await expect(editable).not.toBeChecked()
  await expect(page.locator('body')).not.toContainText('PRIVATE_SETTINGS_FAILURE')
  await editable.focus(); await editable.press('Space'); await page.evaluate(()=>Reflect.get(window,'settingsDetailOwner')('owner-b'))
  await page.evaluate(()=>Reflect.get(window,'settingsDetailResolve')())
  await expect(page.getByRole('alert')).toHaveCount(0); await expect(editable).not.toBeChecked()
})

test('7언어·320/860/1440에서 손잡이 표시와 초록 입력을 유지한다', async ({ page }) => {
  await page.setViewportSize({width:320,height:740}); await mount(page)
  for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr']) {
    await page.evaluate(language=>Reflect.get(window,'settingsDetailLanguage')(language),language)
    await page.locator('#settings-entry').click()
    await expect(page.locator('.locale-grab')).toHaveRole('button')
    expect(await page.locator('.locale-grab').getAttribute('aria-label')).toBeTruthy()
    await page.locator('.locale-grab').press('Enter')
    await expect(page.locator('#settings-entry')).toBeFocused()
    await expect(page.getByRole('switch',{name:'앱 내 수신함',exact:true}).locator('+ .nfx-slider')).toHaveClass(/grn/)
  }
  await page.locator('#settings-entry').click()
  await page.setViewportSize({width:860,height:740}); await expect(page.locator('.locale-grab')).toBeVisible()
  await page.setViewportSize({width:1440,height:900}); await expect(page.locator('.locale-grab')).toBeHidden()
  await page.keyboard.press('Escape'); await expect(page.locator('#settings-entry')).toBeFocused()
})
