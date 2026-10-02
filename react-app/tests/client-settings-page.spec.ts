import { expect, test, type Page } from '@playwright/test'
import copy from '../src/client-settings-copy.json' with { type: 'json' }
import fixture from './fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

test('settings dictionaries retain flat seven-language entries and distinct storage/email meanings',()=>{
  const languages=['ko','en','ja','zh-CN','zh-TW','es','fr'].sort()
  for(const [key,value] of Object.entries(copy)) {
    expect(Object.keys(value).sort(),key).toEqual(languages)
    for(const text of Object.values(value))expect(typeof text,key).toBe('string')
  }
  expect(copy.emailChange.ko).toBe('이메일 변경')
  expect(copy.layoutNotSaved.ko).toContain('메뉴 표시 상태')
  expect(copy.sidebarToggle.ko).toBe('사이드바 표시하기/숨기기')
})

for (const host of ['preview','native'] as const) for (const width of [320,900,901,1440]) test(`${host} sk-settings ${width}px source shell and list-detail history retain draft`, async({page},info)=>{
  await page.setViewportSize({width,height:800}); await page.emulateMedia({reducedMotion:'reduce'})
  const calls=host==='native'?await native(page):(await preview(page),[])
  const input=page.locator(host==='native'?'.g-composer textarea':'#strategy-idea')
  await input.fill('새 설정에서도 보존할 질문'); const node=await input.elementHandle()
  await openSettings(page)
  const root=page.locator('.client-settings-page'),nav=root.locator('.stg-navigation'),main=root.locator('.stg-main')
  await expect(root).toHaveCSS('background-color','rgb(0, 0, 0)')
  await expect(root.locator('h1')).toHaveCSS('font-size','28px')
  await expect(root.locator('h1')).toHaveCSS('font-weight','400')
  await expect(root.locator('.stg-card').first()).toHaveCSS('border-radius','20px')
  if(width<=900) {
    await expect(nav).toBeHidden(); await expect(nav).toHaveAttribute('inert','')
    await root.locator('.stg-mback').click()
    await expect(page).toHaveURL(/#\/settings$/)
    await expect(main).toBeHidden(); await expect(main).toHaveAttribute('inert','')
    await expect(nav.locator('[data-settings-tab="general"]')).toBeFocused()
    await expect(nav.locator('[aria-current]')).toHaveCount(0)
  } else await expect(nav).toHaveCSS('width','300px')
  await nav.locator('a[href="#/settings/account"]').click()
  await expect(root.locator('h1')).toHaveText('계정'); await expect(root.locator('h1')).toBeFocused()
  if(width<=900){
    await root.locator('.stg-mback').click()
    await expect(nav.locator('[data-settings-tab="account"]')).toBeFocused()
    await page.goBack(); await expect(root.locator('h1')).toBeVisible()
    await expect(root.locator('h1')).toHaveText('계정')
    await page.goForward(); await expect(nav).toBeVisible()
  }
  expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  await page.screenshot({path:info.outputPath('settings-skin.png')})
  await root.locator('.stg-back').click()
  await expect(input).toHaveValue('새 설정에서도 보존할 질문')
  expect(await input.evaluate((el,old)=>el===old,node)).toBe(true)
  if(width<=900){await page.goBack();await page.reload();await expect(nav).toBeVisible();await expect(main).toBeHidden()}
  expect(calls.filter(call=>!call.startsWith('GET '))).toEqual([])
})

for (const host of ['preview','native'] as const) test(`${host} source navigation collapse persists, preserves the body and stays accessible across breakpoints`, async ({page},info) => {
  await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({reducedMotion:'reduce'})
  const calls=host==='native' ? await native(page) : (await preview(page),[])
  await openSettings(page)
  const root=page.locator('.client-settings-page'), toggle=root.locator('.stg-tg'), nav=root.locator('.stg-navigation'), select=root.getByRole('combobox')
  await expect(toggle).toHaveAccessibleName(copy.sidebarToggle.ko)
  await expect(toggle).toHaveAttribute('aria-expanded','true')
  await expect(toggle.locator('svg path')).toHaveAttribute('d','M9 4v16')
  await expect(root.getByRole('group',{name:copy.appearance.ko,exact:true})).toHaveCount(0)
  const body=await root.locator('.stg-main').elementHandle(), input=await select.elementHandle()
  await select.selectOption('fr'); await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded','false')
  await expect(nav).toHaveAttribute('inert','')
  await expect(nav).toHaveAttribute('aria-hidden','true')
  expect(await root.locator('.stg-main').evaluate((el,old)=>el===old,body)).toBe(true)
  expect(await select.evaluate((el,old)=>el===old,input)).toBe(true)
  await expect(select).toHaveValue('fr')
  expect(await page.evaluate(()=>localStorage.getItem('teth.stnav'))).toBe('0')
  await toggle.focus(); await page.keyboard.press('Tab'); await expect(root.locator('.stg-ri').nth(0)).toBeFocused()
  await page.keyboard.press('Tab'); await expect(root.locator('.stg-ri').nth(1)).toBeFocused()
  await page.keyboard.press('Tab'); await expect(select).toBeFocused()
  await page.screenshot({path:info.outputPath('settings-collapsed-fr.png')})
  await toggle.focus(); await page.setViewportSize({width:900,height:700})
  await expect(toggle).toBeHidden(); await expect(nav).toHaveAttribute('inert','')
  await expect(root.locator('h1')).toBeFocused()
  await root.locator('.stg-mback').click()
  await root.locator('a[href="#/settings/account"]').click()
  await expect(root.locator('h1')).toHaveText(copy.account.fr)
  await root.locator('.stg-mback').click()
  await root.locator('[data-settings-tab="account"]').focus(); await page.setViewportSize({width:901,height:700})
  await expect(toggle).toBeFocused(); await expect(nav).toHaveAttribute('inert','')
  await page.reload()
  await expect(page.locator('.client-settings-page .stg-tg')).toHaveAttribute('aria-expanded','false')
  await page.locator('.client-settings-page .stg-tg').click()
  await expect(page.locator('.client-settings-page .stg-tg')).toHaveAttribute('aria-expanded','true')
  expect(await page.evaluate(()=>localStorage.getItem('teth.stnav'))).toBe('1')
  expect(calls.filter(call=>!call.startsWith('GET '))).toEqual([])
})

test('layout storage sync never hides keyboard focus or changes the page or language', async ({page,context}) => {
  await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({reducedMotion:'reduce'})
  await preview(page); await openSettings(page)
  const root=page.locator('.client-settings-page'), toggle=root.locator('.stg-tg'), select=root.getByRole('combobox')
  const other=await context.newPage()
  await other.route('**/layout-storage.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>설정 표시 저장 시험</title>'}))
  await other.goto(new URL('/layout-storage.html',page.url()).href)
  await root.locator('[aria-current="page"]').focus()
  await other.evaluate(()=>localStorage.setItem('teth.stnav','0'))
  await expect(toggle).toHaveAttribute('aria-expanded','false'); await expect(toggle).toBeFocused()
  await select.focus()
  await other.evaluate(()=>localStorage.setItem('teth.stnav','1'))
  await expect(toggle).toHaveAttribute('aria-expanded','true'); await expect(select).toBeFocused()
  await other.evaluate(()=>localStorage.setItem('teth.stnav','damaged'))
  await expect(toggle).toHaveAttribute('aria-expanded','true')
  await page.evaluate(()=>{const button=document.createElement('button');button.id='outside-layout-focus';button.textContent='외부 초점';document.body.append(button);button.focus()})
  await other.evaluate(()=>localStorage.setItem('teth.stnav','0'))
  await expect(toggle).toHaveAttribute('aria-expanded','false')
  await expect(page.locator('#outside-layout-focus')).toBeFocused()
  await expect(select).toHaveValue('ko'); await expect(root.locator('h1')).toHaveText(copy.general.ko)
  await other.close()
})

for (const host of ['preview','native'] as const) test(`${host} latest settings rail has source geometry, logo, shortcuts and no automatic operation`, async ({page},info) => {
  await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({reducedMotion:'reduce'})
  const calls=host==='native' ? await native(page) : (await preview(page),[])
  const input=page.locator(host==='native'?'.g-composer textarea':'#strategy-idea')
  await input.fill('아이콘 메뉴를 확인해도 남아야 하는 질문')
  await openSettings(page)
  const root=page.locator('.client-settings-page'), rail=root.locator('.stg-rail'), toggle=root.locator('.stg-tg')
  await toggle.click(); await page.mouse.move(600,400)
  await expect(rail.getByRole('button')).toHaveCount(3)
  await expect(rail).toHaveCSS('width','64px')
  await expect(toggle).toHaveCSS('width','44px')
  await expect(toggle.locator('img')).toHaveAttribute('src','/teth-logo-f260167.png')
  await expect(toggle.locator('img')).toHaveCSS('opacity','1')
  await expect(toggle.locator('svg')).toHaveCSS('opacity','0')
  expect(await root.locator('.stg-main').evaluate(el=>el.getBoundingClientRect().left)).toBeGreaterThanOrEqual(64)
  const fresh=rail.getByRole('button',{name:'새 전략',exact:true}), copyButton=rail.getByRole('button',{name:'전략 복사',exact:true})
  await expect(fresh.locator('svg path').first()).toHaveAttribute('d','M12 3a9 9 0 1 0 9 9')
  await expect(copyButton.locator('svg circle')).toHaveAttribute('cx','15')
  await toggle.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
  await expect(copyButton).toBeFocused(); await expect(copyButton.locator('.stg-tip')).toBeVisible()
  await page.keyboard.press('Escape'); await expect(copyButton.locator('.stg-tip')).toBeHidden()
  await toggle.focus(); await expect(toggle.locator('svg')).toHaveCSS('opacity','1')
  await expect(toggle.locator('img')).toHaveCSS('opacity','0')
  await copyButton.hover()
  const tip=copyButton.locator('.stg-tip'), box=await tip.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2,{steps:12})
  await expect(tip).toBeVisible()
  await page.screenshot({path:info.outputPath('settings-source-rail.png')})
  await copyButton.click()
  await expect(page).toHaveURL(/#\/share$/)
  await expect(root).toHaveCount(0)
  expect(calls.filter(call=>!call.startsWith('GET '))).toEqual([])
  await openSettings(page)
  await expect(toggle).toHaveAttribute('aria-expanded','false')
  await rail.getByRole('button',{name:'새 전략',exact:true}).click()
  await expect(root).toHaveCount(0)
  // Service hosts keep their existing explicit new-conversation confirmation;
  // merely choosing the shortcut cannot destroy an authenticated conversation.
  await expect(input).toBeVisible()
  if(host==='native') await expect(input).toHaveValue('아이콘 메뉴를 확인해도 남아야 하는 질문')
  expect(calls.filter(call=>!call.startsWith('GET '))).toEqual([])
})

test('rail shortcut focus survives mobile resizing and external expansion without offscreen focus',async({page})=>{
  await page.setViewportSize({width:1440,height:800}); await page.emulateMedia({reducedMotion:'reduce'})
  await preview(page); await openSettings(page)
  const root=page.locator('.client-settings-page'),toggle=root.locator('.stg-tg'),shortcut=root.locator('.stg-ri').last()
  await toggle.click(); await shortcut.focus()
  await page.setViewportSize({width:900,height:700})
  await expect(root.locator('h1')).toBeFocused()
  await expect(shortcut).toBeHidden()
  await page.setViewportSize({width:901,height:700})
  await expect(shortcut).toBeVisible()
  await shortcut.focus()
  await expect(shortcut).toBeFocused()
  await page.evaluate(()=>{localStorage.setItem('teth.stnav','1');dispatchEvent(new StorageEvent('storage',{key:'teth.stnav',newValue:'1',storageArea:localStorage}))})
  await expect(toggle).toBeFocused(); await expect(shortcut).toBeHidden()
})

for(const fault of ['drop','corrupt','readback'] as const) test(`layout ${fault}: local display works, failed persistence is explicit and retry is key scoped`, async ({page}) => {
  await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({reducedMotion:'reduce'})
  await preview(page); await openSettings(page)
  await page.evaluate(fault=>{
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem; let attempted=false
    localStorage.setItem('layout-unrelated','keep')
    Reflect.set(window,'restoreLayoutStorage',()=>{Storage.prototype.getItem=get;Storage.prototype.setItem=set})
    Storage.prototype.setItem=function(key,value){
      if(this!==localStorage || key!=='teth.stnav')return set.call(this,key,value)
      attempted=true
      if(fault==='drop')return
      set.call(this,key,fault==='corrupt'?'damaged':value)
    }
    Storage.prototype.getItem=function(key){
      if(this===localStorage && key==='teth.stnav' && attempted && fault==='readback')throw Error('fixture readback denied')
      return get.call(this,key)
    }
  },fault)
  const root=page.locator('.client-settings-page'),toggle=root.locator('.stg-tg')
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded','false')
  await expect(root.getByRole('status')).toContainText(copy.layoutNotSaved.ko)
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded','true')
  await page.evaluate(()=>Reflect.get(window,'restoreLayoutStorage')())
  if(fault!=='readback') {
    await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'teth.stnav',storageArea:localStorage})))
    await expect(root.getByRole('status')).toContainText(copy.layoutNotSaved.ko)
  }
  await root.getByRole('button',{name:copy.retry.ko,exact:true}).click()
  await expect(root.getByRole('status')).toHaveCount(0)
  expect(await page.evaluate(()=>[localStorage.getItem('teth.stnav'),localStorage.getItem('layout-unrelated')])).toEqual(['1','keep'])
})

test('unreadable layout storage does not block settings and can be recovered', async({page})=>{
  await page.addInitScript(()=>{
    const get=Storage.prototype.getItem
    Storage.prototype.getItem=function(key){if(this===localStorage&&key==='teth.stnav')throw Error('fixture storage denied');return get.call(this,key)}
    Reflect.set(window,'restoreLayoutRead',()=>{Storage.prototype.getItem=get})
  })
  await preview(page); await openSettings(page)
  const root=page.locator('.client-settings-page')
  await expect(root.getByRole('status')).toContainText(copy.layoutNotSaved.ko)
  await root.getByRole('combobox').selectOption('fr')
  await expect(root.getByRole('status')).toContainText(copy.layoutNotSaved.fr)
  await page.evaluate(()=>Reflect.get(window,'restoreLayoutRead')())
  await root.getByRole('button',{name:copy.retry.fr,exact:true}).click()
  await expect(root.getByRole('status')).toHaveCount(0)
  if((page.viewportSize()?.width??1440)<=900)await root.locator('.stg-mback').click()
  await expect(root.locator('.stg-back')).toHaveAccessibleName(copy.back.fr)
})

for(const reducedMotion of ['reduce','no-preference'] as const) test(`settings source slide ${reducedMotion} finishes after rapid toggles without overflow`,async({page},info)=>{
  await page.setViewportSize({width:901,height:568}); await page.emulateMedia({reducedMotion})
  await preview(page); await openSettings(page)
  const root=page.locator('.client-settings-page'),toggle=root.locator('.stg-tg')
  for(let i=0;i<5;i++)await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded','false')
  await expect.poll(()=>root.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0)
  await expect(root.locator('.stg')).toHaveCSS('grid-template-columns','64px 837px')
  await expect(root.locator('.stg-navigation')).toHaveCSS('opacity','0')
  expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded','true')
  await expect.poll(()=>root.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0)
  await expect(root.locator('.stg-navigation')).toHaveCSS('opacity','1')
  if(reducedMotion==='reduce')expect(await root.locator('.stg').evaluate(el=>Math.max(...getComputedStyle(el).transitionDuration.split(',').map(parseFloat)))).toBeLessThanOrEqual(0.00001)
  await expect(root.locator('.stg-back')).toHaveAccessibleName(copy.back.ko)
  await page.screenshot({path:info.outputPath('settings-slide-expanded.png')})
})

for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) test(`${language} source sidebar labels and mobile back names survive collapse and resize`,async({page})=>{
  await page.setViewportSize({width:1440,height:800}); await page.emulateMedia({reducedMotion:'reduce'})
  await preview(page); await openSettings(page)
  const root=page.locator('.client-settings-page'),toggle=root.locator('.stg-tg')
  await root.getByRole('combobox').selectOption(language)
  await expect(toggle).toHaveAccessibleName(copy.sidebarToggle[language])
  const controls=await toggle.getAttribute('aria-controls')
  expect(controls).toBe(await root.locator('.stg-navigation').getAttribute('id'))
  await toggle.click()
  const newLabels={ko:'새 전략',en:'New strategy',ja:'新しい戦略','zh-CN':'新策略','zh-TW':'新策略',es:'Nueva estrategia',fr:'Nouvelle stratégie'}
  await expect(root.locator('.stg-ri').nth(0)).toHaveAccessibleName(newLabels[language])
  await expect(root.locator('.stg-ri').nth(1)).toHaveAccessibleName(copy.copyStrategy[language])
  await page.setViewportSize({width:320,height:568})
  await root.locator('.stg-mback').click()
  await expect(root.locator('.stg-back')).toHaveAccessibleName(copy.back[language])
  await expect(root.locator('.stg-back')).toBeInViewport({ratio:1})
  await expect(root.locator('.stg-navigation')).not.toHaveAttribute('inert','')
  await root.locator('a[href="#/settings/security"]').click()
  await expect(root.locator('h1')).toHaveText(copy.security[language])
  expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
})

for (const host of ['preview', 'native'] as const) for (const width of [320, 1440]) test(`${host} fullscreen source settings ${width}px replaces chrome and restores the same conversation`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const calls = host === 'native' ? await native(page) : (await preview(page), [])
  const input = page.locator(host === 'native' ? '.g-composer textarea' : '#strategy-idea')
  await input.fill('전체 화면 설정에서도 유지되는 질문')
  const original = await input.elementHandle()
  if (width > 860) {
    await expect(page.locator('[data-sidebar-action="settings"]')).toHaveCount(0)
    const account = page.locator('[data-sidebar-action="account"]')
    await account.hover()
    await expect(account.locator('span')).toHaveCount(0)
    await expect(account).toHaveAccessibleName('내 계정')
  }
  await openSettings(page)
  for (const selector of ['.client-sidebar','.client-hamburger','.client-account-utility','.client-auth-nav','.client-app-banner','.client-globe']) await expect(page.locator(selector)).toBeHidden()
  const surface = page.locator('.client-settings-page')
  const box = (await surface.boundingBox())!
  expect(box.x).toBe(0); expect(box.y).toBe(0); expect(box.width).toBe(width)
  const nav = surface.locator('.stg-navigation')
  if (width > 900) expect((await nav.boundingBox())!.width).toBe(300)
  await settingsTab(page, 'security')
  await expect(surface.locator('h1')).toBeFocused()
  await surface.evaluate(el => { el.scrollTop = el.scrollHeight })
  if(width<=900)await surface.locator('.stg-mback').click()
  await surface.locator('.stg-back').scrollIntoViewIfNeeded()
  await expect(surface.locator('.stg-back')).toBeInViewport({ ratio: 1 })
  await surface.locator('.stg-back').click()
  await expect(input).toHaveValue('전체 화면 설정에서도 유지되는 질문')
  expect(await input.evaluate((el, old) => el === old, original)).toBe(true)
  await expect(page.locator(width <= 860 ? '.client-hamburger' : '.client-sidebar')).toBeVisible()
  await page.goBack()
  if(width<=900){await expect(surface.locator('.stg-navigation')).toBeVisible();await page.goBack()}
  await expect(surface.locator('h1')).toHaveText('보안')
  await expect(page.locator('.client-hamburger')).toBeHidden()
  await page.screenshot({ path: info.outputPath('fullscreen-settings.png') })
  await page.goForward()
  if(width<=900)await page.goForward()
  await expect(surface).toHaveCount(0)
  expect(calls.filter(call => !call.startsWith('GET '))).toEqual([])
})

for (const width of [320,481,900,901,1440]) test(`fullscreen settings ${width}px enlarged French preserves keyboard outlines and readable rows`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 568 })
  await preview(page)
  await openSettings(page)
  const surface = page.locator('.client-settings-page')
  await surface.getByRole('combobox').selectOption('fr')
  // Text-only zoom exposes constrained labels without changing the viewport.
  await surface.evaluate(root => {
    for (const el of root.querySelectorAll<HTMLElement>('h1,h2,b,small,.k span,.stg-ni,.stg-b,select')) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`
  })
  if(width<=900)await surface.locator('.stg-mback').click()
  const active = surface.locator('[data-settings-tab="general"]')
  await page.keyboard.press('Tab')
  await active.focus()
  await expect(active).toHaveCSS('outline-width', '2px')
  await surface.locator('.stg-back').scrollIntoViewIfNeeded()
  await expect(surface.locator('.stg-back')).toBeInViewport({ ratio: 1 })
  expect(await surface.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('settings-fr-enlarged.png') })
})

for (const host of ['preview', 'native'] as const) for (const [width, height] of [[320,568], [641,360], [1440,900]]) test(`${host} latest menu ${width}x${height} keeps source items, help focus and no spinner`, async ({ page }, info) => {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (host === 'native') await native(page)
  else await preview(page)
  await expect(page.locator('.client-source-app')).toBeVisible()
  let entry = page.locator('[data-sidebar-action="account"]')
  if (!await entry.isVisible()) { await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter'); entry = page.locator('[data-sidebar-action="profile-settings"]') }
  await entry.click()
  const menu = page.locator('.ca-settings')
  await expect(menu).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await expect(menu.locator('[aria-controls="ca-sub-settings"]')).toHaveCount(0)
  await expect(menu.getByRole('button', { name: '이용 현황', exact: true })).toBeVisible()
  for (const action of ['settings', 'insight', 'brokers']) {
    const item = menu.locator(`[data-menu-action="${action}"]`)
    await item.focus(); await expect(item).toBeInViewport({ ratio: 1 })
  }
  const help = menu.locator('[aria-controls="ca-sub-help"]')
  await help.focus(); await help.press('Enter')
  const sub = menu.locator('#ca-sub-help')
  await expect(sub).toBeVisible()
  expect(await sub.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight })).toBe(true)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement, r = el.getBoundingClientRect()
      return !!el.closest('.ca-settings') && getComputedStyle(el).visibility !== 'hidden' && r.top >= 0 && r.bottom <= innerHeight
    })).toBe(true)
  }
  // At >=641px the source hover submenu may close when tab-induced scrolling
  // moves the pointer out and focus has left the group. Establish the open
  // child precondition before asserting that one Escape closes only that child.
  if (!await sub.isVisible()) { await help.focus(); await help.press('Enter') }
  await expect(sub).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sub).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const parent = document.querySelector<HTMLElement>('[aria-controls="ca-sub-help"]')
    if (!parent) return null
    return { focused: document.activeElement === parent, visible: getComputedStyle(parent).visibility, inert: !!parent.closest('[inert]') }
  })).toEqual({ focused: true, visible: 'visible', inert: false })
  expect(await menu.locator('.sp').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await page.screenshot({ path: info.outputPath('source-popup.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(width <= 860 ? page.locator('.client-hamburger') : entry).toBeFocused()
})

test('preview guest menu resumes general after explicit preview login, but cancellation leaves no old intent', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { location.hash = '#/settings/general' })
  await expect(page.locator('.ca-auth')).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await page.locator('.ca-auth').getByRole('button', { name: /Google/ }).click()
  await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
  await page.reload()
  await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
})

test('native guest menu opens real login without creating account data and cancel discards settings intent', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  const calls = await native(page, false)
  let entry = page.locator('[data-sidebar-action="settings"]')
  if (!await entry.isVisible()) { await page.locator('.client-hamburger').click(); entry = page.locator('[data-sidebar-action="settings"]') }
  await entry.click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  await expect(page.locator('[data-native-auth-close]')).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/settings\/general$/)
  await page.locator('[data-native-auth-close]').click()
  await expect(page).not.toHaveURL(/settings/)
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  expect(calls.filter(call => !call.startsWith('GET '))).toEqual([])
  await expect(page.locator('.g-composer textarea')).toBeVisible()
})

test.setTimeout(60_000)
async function preview(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '설정 사용자', email: 'settings@example.test' })))
  await page.goto('/')
}
async function settingsTab(page: Page, tab: string) {
  const root=page.locator('.client-settings-page')
  if(!await root.locator('.stg-navigation').isVisible())await root.locator('.stg-mback').click()
  await root.locator(`a[href="#/settings/${tab}"]`).click()
}
async function settingsExit(page: Page) {
  const root=page.locator('.client-settings-page')
  if(!await root.locator('.stg-navigation').isVisible())await root.locator('.stg-mback').click()
  await root.locator('.stg-back').click()
}
async function openSettings(page: Page) {
  await expect(page.locator('.client-source-app')).toBeVisible()
  let trigger = page.locator('[data-sidebar-action="account"],[data-sidebar-action="profile-settings"]')
  if (!await trigger.isVisible()) {
    await page.locator('.client-hamburger').click()
    trigger = page.locator('[data-sidebar-action="account"],[data-sidebar-action="profile-settings"]')
  }
  await trigger.click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
}
async function native(page: Page, signedIn = true) {
  const calls: string[] = [], ready = fixture.snapshots.ready
  const owner = 'session_settings_page_fixture_0001'
  const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_settings_page_fixture_0001', traceId: 'trace_settings_page_fixture_0001' })
  await page.addInitScript(({ owner, id }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { owner, id: ready.conversationId })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    calls.push(route.request().method() + ' ' + path)
    if (route.request().method() !== 'GET') return route.abort()
    if (path === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"settings_page_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: { sessionId: owner, state: signedIn ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_settings_page_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
    if (path === '/api/v3/conversations/' + ready.conversationId) return route.fulfill({ contentType: 'application/json', headers: { ETag: '"settings_page_conversation_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) })
    return route.abort()
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return calls
}

test('設定 routes normalize only supported source shapes', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const module = '/src/client-settings-navigation.ts'
    const { readClientSettingsLocation } = await import(module)
    return ['#/settings', '#/settings/security', '#/settings/unknown', '#/settings/Account', '#/settings/security/extra', '#/plan', '#/plan/alerts', '#/trade'].map(readClientSettingsLocation)
  })
  expect(result).toEqual(['general', 'security', 'general', null, null, null, null, null])
})

test('guest settings deep link holds only an intent until login and clears it on cancel', async ({ page }) => {
  await page.goto('/#/settings/account')
  await expect(page.locator('.ca-auth')).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/settings\/account$/)
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/settings/)
  await expect(page.locator('#strategy-idea')).toBeVisible()
})

for (const width of [320, 860, 1440]) test(`settings ${width}px retains draft, language, original nav geometry and no overflow`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await preview(page)
  const input = page.locator('#strategy-idea')
  await input.fill('0.5 BTC와 100 USDT, 저장되지 않은 내 질문')
  const original = await input.elementHandle()
  await openSettings(page)
  const surface = page.locator('.client-settings-page')
  await expect(surface.locator('h1')).toBeFocused()
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  for (const lang of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) {
    await surface.getByRole('combobox').focus()
    await surface.getByRole('combobox').selectOption(lang)
    await expect(surface.getByRole('combobox')).toBeFocused()
    await expect(surface.getByRole('combobox')).toHaveValue(lang)
    for (const tab of ['general','account','notify','billing','security'] as const) {
      await settingsTab(page, tab)
      await expect(surface.locator('h1')).toHaveText(copy[tab][lang])
      await expect(surface.locator('[aria-current="page"]')).toHaveAttribute('href', `#/settings/${tab}`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
      expect(await surface.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false)
      if (width <= 900) {
        // The detail offers one visible return to the settings list.
        const back = surface.locator('.stg-mback')
        await expect(back).toBeInViewport({ ratio: 1 })
        expect(await back.evaluate(el => {
          const r = el.getBoundingClientRect()
          return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('a') === el
        })).toBe(true)
        await expect(surface.locator('.stg-navigation')).toHaveAttribute('inert','')
      }
    }
    await settingsTab(page, 'general')
  }
  await page.screenshot({ path: info.outputPath(`settings-fr-${width}.png`), fullPage: true })
  await settingsExit(page)
  await expect(input).toBeVisible()
  await expect(input).toHaveValue('0.5 BTC와 100 USDT, 저장되지 않은 내 질문')
  expect(await input.evaluate((el, old) => el === old, original)).toBe(true)
})

test('legacy exact plan redirects to billing, history back restores settings tab', async ({ page }) => {
  await preview(page)
  await page.evaluate(() => { location.hash = '#/plan' })
  await expect(page).toHaveURL(/#\/settings\/billing$/)
  await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
  await settingsTab(page, 'account')
  await page.goBack()
  if((page.viewportSize()?.width??1440)<=900)await page.goBack()
  await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
  await page.evaluate(() => { location.hash = '#/plan/alerts' })
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/plan\/alerts$/)
})

test('native settings preserve conversation DOM and perform no implicit mutation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const calls = await native(page)
  const input = page.locator('.g-composer textarea')
  await input.fill('설정을 확인해도 계속 남는 질문')
  const element = await input.elementHandle(), initial = [...calls]
  await openSettings(page)
  for (const tab of ['account','notify','billing','security'] as const) {
    await page.locator(`a[href="#/settings/${tab}"]`).click()
    await expect(page.locator('.client-settings-page h1')).toHaveText(copy[tab].ko)
  }
  await expect(page.locator('.client-settings-page')).not.toContainText('settings@example.test')
  await expect(page.locator('.client-settings-page [role="switch"][aria-checked="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await expect(input).toHaveValue('설정을 확인해도 계속 남는 질문')
  expect(await input.evaluate((el, old) => el === old, element)).toBe(true)
  expect(calls).toEqual(initial)
  await openSettings(page)
  await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
})

test('settings back restores the visible composer focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await preview(page)
  await openSettings(page)
  await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toBeFocused()
})

for (const host of ['preview', 'native'] as const) test(`${host} latest sidebar profile opens the popup across routes without duplicating history`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const calls = host === 'native' ? await native(page) : (await preview(page), [])
  const initial = [...calls]
  const composer = page.locator(host === 'native' ? '.g-composer textarea' : '#strategy-idea')
  await composer.fill('프로필을 확인해도 남아 있는 초안')
  const original = await composer.elementHandle()
  await page.locator('[data-sidebar-action="account"]').click()
  await expect(page.locator('.ca-settings')).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
  await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await expect(composer).toBeFocused()
  expect(await composer.evaluate((el, old) => el === old, original)).toBe(true)
  for (const hash of ['#/insight', '#/trade', '#/plan', '#/settings/security', '#/settings/account']) {
    await page.evaluate(hash => { location.hash = hash }, hash)
    if (hash === '#/plan') await expect(page).toHaveURL(/#\/settings\/billing$/)
    else await expect(page).toHaveURL(new RegExp(hash + '$'))
    if (hash === '#/plan' || hash.startsWith('#/settings/')) {
      await expect(page.locator('.client-settings-page')).toBeVisible()
      await expect(page.locator('[data-sidebar-action="account"]')).toBeHidden()
      await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
    }
    const profile = page.locator('[data-sidebar-action="account"]')
    const before = page.url(), count = await page.evaluate(() => history.length)
    await profile.click()
    await expect(page.locator('.ca-settings')).toBeVisible()
    expect(page.url()).toBe(before)
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => ({ action: (document.activeElement as HTMLElement)?.dataset.sidebarAction ?? document.activeElement?.outerHTML.slice(0, 250), activeMenu: !!document.querySelector('.ca-menu-layer[data-surface-active="true"]'), href: location.hash })), { message: before }).toEqual({ action: 'account', activeMenu: false, href: new URL(before).hash })
    expect(await page.evaluate(() => history.length)).toBe(count)
    await openSettings(page)
    await expect(page).toHaveURL(/#\/settings\/general$/)
  }
  await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  // Return to the original conversation/home using its existing navigation.
  await page.evaluate(() => { location.hash = '' })
  await expect(composer).toHaveValue('프로필을 확인해도 남아 있는 초안')
  // Trading replaces the preview home by design; its draft must survive, but
  // DOM identity is required for settings-only transitions above, not all pages.
  expect(calls.filter(call => !call.startsWith('GET '))).toEqual(initial.filter(call => !call.startsWith('GET ')))
})

for (const host of ['preview', 'native'] as const) test(`${host} mobile member settings row closes drawer without leaving scroll or focus trapped`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  if (host === 'native') await native(page)
  else await preview(page)
  const composer = page.locator(host === 'native' ? '.g-composer textarea' : '#strategy-idea')
  await composer.fill('모바일에서도 보존할 초안')
  await openSettings(page)
  await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  await settingsTab(page, 'account')
  await settingsExit(page)
  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue('모바일에서도 보존할 초안')
  await composer.fill('설정 후에도 편집 가능')
  await expect(composer).toHaveValue('설정 후에도 편집 가능')
})

for (const host of ['preview', 'native'] as const) test(`${host} settings help and logout cancellation retain the current page and focus`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const calls = host === 'native' ? await native(page) : (await preview(page), [])
  await openSettings(page)
  const initial = [...calls], surface = page.locator('.client-settings-page')
  await surface.locator('.stg-mback').click()
  const help = surface.getByRole('button', { name: copy.help.ko, exact: true })
  await help.focus()
  await help.press('Enter')
  await expect(page.locator('.site-help-pop')).toBeVisible()
  await expect(page.locator('.site-help-pop .help-close')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect(help).toBeFocused()
  await expect(surface.locator('h1')).toHaveText(copy.general.ko)
  await surface.locator('a[href="#/settings/account"]').click()
  const logout = surface.getByRole('button', { name: copy.logout.ko, exact: true })
  await logout.click()
  const confirm = surface.locator('.stg-confirm')
  await expect(confirm.getByRole('button', { name: copy.cancel.ko, exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await expect(logout).toBeFocused()
  await expect(page).toHaveURL(/#\/settings\/account$/)
  expect(calls).toEqual(initial)
})
