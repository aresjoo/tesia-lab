import { expect, test, type Page, type Locator, type TestInfo } from '@playwright/test'

// Real service entry + explicit session/CSRF HTTP fixtures only.
// No account, article, exchange, return or entitlement presentation is invented.
// Source stBack (index.html:23454 / tools/st.js:15) returns home, not the prior page.
test.setTimeout(45_000)
test.use({ actionTimeout: 8000 })
type Surface = 'plan' | 'insights' | 'brokers'

async function mount(page: Page, baseURL: string | undefined, language: string) {
  if (!baseURL) throw new Error('Local baseURL required')
  const origin = new URL(baseURL).origin, mutations: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion:'reduce' })
  await page.addInitScript(language => { localStorage.setItem('tethLang',language) }, language)
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET','HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) {
      if (!['/api/v1/auth/session','/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
      const session = url.pathname.endsWith('/session')
      return route.fulfill({contentType:'application/json', headers:session ? {ETag:'"account_boundary_001"'} : {}, body:JSON.stringify({
        meta:{apiContractVersion:'0.1.0',resourceRevision:session?'1':null,requestId:'req_account_boundary_001',traceId:'trace_account_boundary_001'},
        data:session ? {sessionId:'session_account_boundary_001',state:'AUTHENTICATED',revision:'1',issuedAt:'2030-01-01T00:00:00Z',expiresAt:'2030-01-02T00:00:00Z'}
          : {csrfToken:'csrf_account_boundary_001',expiresAt:'2030-01-02T00:00:00Z'},
      })})
    }
    if (request.isNavigationRequest() && url.pathname==='/') return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>`})
    return route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase','ready')
  await page.evaluate(() => document.fonts.ready)
  return {mutations,errors}
}

for (const width of [320,390]) {
  test(`${width}x480 account help does not cover plan navigation tabs`,async ({page,baseURL},info)=>{
    await page.setViewportSize({width,height:480})
    const evidence=await mount(page,baseURL,'fr')
    await enter(page,'plan')
    const tabs=page.locator('.native-service-plan .nfx-tab')
    await expect(tabs).toHaveCount(3)
    await expect(page.locator('.site-help-trigger')).toBeVisible()
    const measurements=await tabs.evaluateAll(elements=>{
      const help=document.querySelector('.site-help-trigger')!
      const f=help.getBoundingClientRect()
      return elements.map(element=>{
        const r=element.getBoundingClientRect()
        const overlap=Math.max(0,Math.min(r.right,f.right)-Math.max(r.left,f.left))*Math.max(0,Math.min(r.bottom,f.bottom)-Math.max(r.top,f.top))
        // Disabled provider-gated tabs remain disabled; inspect paint/hit coverage only.
        const points=[.25,.5,.75].flatMap(x=>[.25,.5,.75].map(y=>{
          const at=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)
          return {x,y,coveredByHelp:!!at&&(at===help||help.contains(at))}
        }))
        return {text:element.textContent,tab:{x:r.x,y:r.y,width:r.width,height:r.height},help:{x:f.x,y:f.y,width:f.width,height:f.height},overlap,points}
      })
    })
    await info.attach('plan-tab-help-coverage',{contentType:'application/json',body:JSON.stringify(measurements)})
    console.info(`ACCOUNT_TAB_HELP ${JSON.stringify(measurements)}`)
    await page.screenshot({path:info.outputPath('plan-tab-help-coverage.png')})
    for (const measurement of measurements) {
      expect.soft(measurement.overlap,`Help must not overlap ${measurement.text}`).toBe(0)
      expect.soft(measurement.points.some(point=>point.coveredByHelp),`Help must not intercept ${measurement.text}`).toBe(false)
    }
    expect(evidence.mutations).toEqual([]);expect(evidence.errors).toEqual([])
  })
}

async function menu(page: Page) {
  if (!await page.locator('.client-sidebar.mobile-open').count()) {
    const button=page.viewportSize()!.width<=860?page.locator('.client-hamburger'):page.locator('.client-rail-logo-row button')
    await button.focus(); await button.click()
  }
  await page.locator('[data-sidebar-action="profile-settings"]').click()
  await expect(page.locator('.ca-settings')).toBeVisible()
}
const surfaceRoot = (page: Page, surface: Surface) => page.locator(surface==='plan'?'.native-service-plan':surface==='brokers'?'.native-brokers':'.client-insights')
async function enter(page: Page, surface: Surface) {
  if (surface==='plan') {
    // #/plan itself intentionally aliases billing; alerts is an existing document route.
    await page.evaluate(() => { location.hash='#/plan/alerts' })
  } else {
    await menu(page)
    await page.locator(`[data-menu-action="${surface==='insights'?'insight':'brokers'}"]`).click()
  }
  await expect(surfaceRoot(page,surface)).toBeVisible()
  await expect(page.locator('.native-service-content')).toBeHidden()
}
async function hit(target: Locator) {
  await expect(target).toBeInViewport()
  const measured=await target.evaluate(element=>{
    const r=element.getBoundingClientRect(), at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)
    return {target:element.className,text:element.textContent,box:{x:r.x,y:r.y,w:r.width,h:r.height},hit:at?{tag:at.tagName,className:at.className,text:at.textContent?.slice(0,100)}:null}
  })
  await test.info().attach('control-hit',{contentType:'application/json',body:JSON.stringify(measured)})
  console.info(`ACCOUNT_HIT ${JSON.stringify(measured)}`)
  await expect.poll(() => target.evaluate(element => {
    const b=element.getBoundingClientRect(), e=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)
    return !!e&&(e===element||element.contains(e))
  }),{message:'Control center must not be obscured by shell chrome'}).toBe(true)
}
async function capture(page: Page, info: TestInfo, name: string) {
  const geometry=await page.evaluate(() => {
    const selectors=['.client-service-app','.client-source-main','.native-service-plan','.native-brokers','.client-insights','.client-settings-page','.client-app-banner','.client-account-utility','.native-plan-return button','.native-brokers .hub-header button','.client-insights .nfz-back']
    return {hash:location.hash,width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,active:document.activeElement?.tagName,
      elements:selectors.map(selector=>{const e=document.querySelector<HTMLElement>(selector);if(!e)return {selector};const r=e.getBoundingClientRect();return {selector,className:e.className,x:r.x,y:r.y,w:r.width,h:r.height,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflow:getComputedStyle(e).overflowY}})}
  })
  await info.attach(name,{contentType:'application/json',body:JSON.stringify(geometry)})
  console.info(`ACCOUNT_GEOMETRY ${name} ${JSON.stringify(geometry)}`)
  await page.screenshot({path:info.outputPath(`${name}.png`)})
  expect.soft(geometry.documentWidth,'No horizontal document overflow').toBeLessThanOrEqual(geometry.width+1)
}

for (const viewport of [{width:320,height:480},{width:390,height:900},{width:1440,height:480}]) {
  for (const language of ['ko','fr']) for (const surface of ['plan','insights','brokers'] as const) {
    test(`${viewport.width}x${viewport.height} ${language} ${surface} settings and home boundaries`,async ({page,baseURL},info)=>{
      await page.setViewportSize(viewport)
      const evidence=await mount(page,baseURL,language)
      const input=page.locator('#strategy-idea'), draft='미전송 초안: 변동성이 커지면 어떻게 볼까요?'
      await input.fill(draft)
      await enter(page,surface)
      await capture(page,info,'surface-entry')
      const root=surfaceRoot(page,surface)
      await expect.soft(root.locator('h1').first(),'New document entry must reveal its heading, not retain the previous home footer scroll').toBeInViewport()
      await page.mouse.move(viewport.width*.65,viewport.height*.72)
      await page.mouse.wheel(0,900)
      await capture(page,info,'surface-lower')
      // Reopen chrome by keyboard focus; source hides mobile hamburger while scrolling down.
      await menu(page)
      await page.locator('[data-menu-action="settings"]').click()
      await expect(page.locator('.client-settings-page')).toBeVisible()
      await expect(root).toBeHidden()
      await expect(page.locator('.native-service-content')).toBeHidden()
      await capture(page,info,'settings-entry')
      await page.locator('.stg-sel').selectOption(language==='fr'?'es':'fr')
      if(viewport.width<=900) await page.locator('.stg-mback').click()
      await hit(page.locator('.stg-back'))
      await page.locator('.stg-back').click()
      await expect(page.locator('.client-settings-page')).toHaveCount(0)
      await expect(input).toBeVisible()
      await expect(input).toHaveValue(draft)
      await expect(page.locator('.native-service-plan:visible,.native-brokers:visible,.client-insights:visible')).toHaveCount(0)
      await capture(page,info,'settings-return-home')
      await enter(page,surface)
      const back=surface==='plan'?page.locator('.native-plan-return button'):surface==='brokers'?page.locator('.native-brokers .hub-header button'):page.locator('.client-insights .nfz-back')
      await back.scrollIntoViewIfNeeded()
      await capture(page,info,'direct-return')
      await hit(back)
      await back.click()
      await expect(input).toBeVisible()
      await expect(input).toHaveValue(draft)
      expect(evidence.mutations).toEqual([]);expect(evidence.errors).toEqual([])
    })
  }
}

for (const viewport of [{width:320,height:480},{width:390,height:900}]) {
  test(`${viewport.width}x${viewport.height} plan banner dismissal preserves reachable return and same-page locale scroll`, async ({page,baseURL},info)=>{
    await page.setViewportSize(viewport)
    const evidence=await mount(page,baseURL,'fr')
    await enter(page,'plan')
    const back=page.locator('.native-plan-return button'), shell=page.locator('.client-service-app')
    await hit(back)
    await capture(page,info,'plan-banner-open')
    await page.locator('.client-banner-close').click()
    await expect(page.locator('.client-app-banner')).toHaveCount(0)
    await hit(back)
    await capture(page,info,'plan-banner-dismissed')
    await page.mouse.move(viewport.width*.65,viewport.height*.7)
    await page.mouse.wheel(0,300)
    await expect.poll(()=>shell.evaluate(e=>e.scrollTop)).toBeGreaterThan(100)
    const before=await shell.evaluate(e=>e.scrollTop)
    // Directly exercise the existing local preference store, not a new server producer.
    await page.evaluate(async ()=>{ const path='/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language','es') })
    await expect(page.locator('html')).toHaveAttribute('lang','es')
    await expect(page.locator('.native-service-plan')).toBeVisible()
    const after=await shell.evaluate(e=>e.scrollTop)
    expect(after,'Same-page locale rerender must not trigger document-entry scroll reset').toBeGreaterThan(100)
    await info.attach('locale-scroll',{contentType:'application/json',body:JSON.stringify({before,after})})
    await back.scrollIntoViewIfNeeded()
    await hit(back)
    await back.click()
    await expect(page.locator('#strategy-idea')).toBeVisible()
    expect(evidence.mutations).toEqual([]);expect(evidence.errors).toEqual([])
  })
}
