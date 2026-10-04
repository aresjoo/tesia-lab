import { expect, test, type Page } from '@playwright/test'

type Surface = 'brokers' | 'insights'
const owner='session_account_boundary_001'
// Editorial layout fixture, NOT market news, a producer response or API contract.
const editorial={identity:'secondary-detail-layout-fixture',heading:'검수용 기사 목록',subheading:'명시적인 조립 fixture',articles:Array.from({length:20},(_,i)=>({
  slug:`audit-${i}`,title:`검수 기사 ${i}`,sub:'레이아웃과 이동을 확인하는 기사 제목입니다. '.repeat(3),cat:'검수',authorName:null,publishedAt:null,
  placement:i===0?'featured':'standard',tags:['레이아웃'],assets:[],body:Array.from({length:20},(_,j)=>({h:`검수 단락 ${j}`,ps:['이 글은 실제 시장 정보가 아닌 화면 이동 검수용 문단입니다. '.repeat(8)]})),
}))}

async function mount(page:Page,baseURL:string|undefined,surface:Surface) {
  if(!baseURL)throw new Error('Local baseURL required')
  const origin=new URL(baseURL).origin,errors:string[]=[],mutations:string[]=[]
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('tethLang','fr'))
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url())
    if(!['GET','HEAD'].includes(request.method())){mutations.push(`${request.method()} ${url.pathname}`);return route.abort('blockedbyclient')}
    if(url.origin!==origin)return route.abort('blockedbyclient')
    if(url.pathname.startsWith('/api/')){
      if(!['/api/v1/auth/session','/api/v1/auth/csrf'].includes(url.pathname))return route.abort('blockedbyclient')
      const session=url.pathname.endsWith('/session')
      return route.fulfill({contentType:'application/json',headers:session?{ETag:'"account_boundary_001"'}:{},body:JSON.stringify({
        meta:{apiContractVersion:'0.1.0',resourceRevision:session?'1':null,requestId:'req_account_boundary_001',traceId:'trace_account_boundary_001'},
        data:session?{sessionId:owner,state:'AUTHENTICATED',revision:'1',issuedAt:'2030-01-01T00:00:00Z',expiresAt:'2030-01-02T00:00:00Z'}
          :{csrfToken:'csrf_account_boundary_001',expiresAt:'2030-01-02T00:00:00Z'},
      })})
    }
    if(request.isNavigationRequest()&&url.pathname==='/'){
      // Brokers exercise the unchanged actual service entry. Insights use the
      // same NativeServiceApp/SiteRouter with its existing presentation prop;
      // service-main intentionally has no editorial provider yet.
      const entry=surface==='brokers'?`await import('/src/internal-poc/service-main.tsx');`:`
        const {default:React}=await import('/@id/react');const DOM=await import('/@id/react-dom/client');
        const {NativeServiceApp}=await import('/src/internal-poc/NativeServiceApp.tsx');const {SiteRouter}=await import('/src/components/SiteRouter.tsx');
        await import('/node_modules/@fontsource-variable/geist/wght.css');await import('/node_modules/@fontsource-variable/noto-sans-kr/index.css');await import('/node_modules/@fontsource-variable/noto-sans-sc/index.css');
        const data=${JSON.stringify(editorial)};
        (DOM.createRoot??DOM.default.createRoot)(document.getElementById('internal-poc-root')).render(React.createElement(React.StrictMode,null,React.createElement(SiteRouter,{service:true},React.createElement(NativeServiceApp,{presentations:{insightPresentation:{scope:${JSON.stringify(owner)},data}}}))));`
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
        import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;${entry}</script></body></html>`})
    }
    return route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase','ready')
  await page.evaluate(()=>document.fonts.ready)
  return {errors,mutations}
}

async function accountMenu(page:Page){
  if(!await page.locator('.client-sidebar.mobile-open').count()){
    const opener=page.viewportSize()!.width<=860?page.locator('.client-hamburger'):page.locator('.client-rail-logo-row button')
    await opener.focus();await opener.click()
  }
  const entry=page.locator('[data-sidebar-action="profile-settings"]')
  await entry.click();await expect(page.locator('.ca-settings')).toBeVisible()
  return entry
}

for(const width of [320,390,1440])for(const surface of ['brokers','insights'] as const){
  test(`${width}x480 fr ${surface} deep detail and account overlay preserve list location`,async({page,baseURL},info)=>{
    await page.setViewportSize({width,height:480})
    const evidence=await mount(page,baseURL,surface)
    await page.locator('#strategy-idea').fill('상세 화면 왕복에도 남을 초안')
    await accountMenu(page)
    await page.locator(`[data-menu-action="${surface==='brokers'?'brokers':'insight'}"]`).click()
    const shell=page.locator('.client-service-app')
    const card=page.locator(surface==='brokers'?'.bk2-card':'.nfz-card').last()
    await card.scrollIntoViewIfNeeded()
    const before=await shell.evaluate(element=>element.scrollTop)
    expect(before).toBeGreaterThan(500)
    const origin=surface==='brokers'?card.locator('.nm'):card
    const key=await origin.getAttribute(surface==='brokers'?'id':'data-article')
    await origin.click()
    const detail=page.locator(surface==='brokers'?'.bk2-head':'.nfz-a')
    await expect(detail).toBeVisible()
    await expect(detail.locator(surface==='brokers'?'.nm':'h1')).toBeInViewport()
    await page.mouse.move(width*.65,350);await page.mouse.wheel(0,1100)
    await expect.poll(()=>shell.evaluate(element=>element.scrollTop)).toBeGreaterThan(100)
    await accountMenu(page)
    await expect(page.locator('.native-brokers:visible,.client-insights:visible')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('.ca-settings')).toHaveCount(0)
    // Opening the account menu can retire its drawer entry. The production
    // focus hook explicitly falls back to the visible hamburger/rail control.
    const focus=await page.evaluate(()=>{
      const active=document.activeElement!,r=active.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)
      return {tag:active.tagName,html:active.outerHTML.slice(0,300),visible:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight,
        hittable:at===active||Boolean(at&&active.contains(at))}
    })
    await info.attach('account-overlay-return',{contentType:'application/json',body:JSON.stringify(focus)})
    expect(focus.tag).not.toBe('BODY');expect(focus.visible).toBe(true);expect(focus.hittable).toBe(true)
    if(await page.locator('.client-sidebar.mobile-open').count())await page.keyboard.press('Escape')
    await expect(page.locator('.client-sidebar.mobile-open')).toHaveCount(0)
    await expect(detail).toBeVisible()
    await page.locator(surface==='brokers'?'.bk2-bc button':'.nfz-back').first().click()
    const restored=page.locator(surface==='brokers'?`#${key}`:`.nfz-card[data-article="${key}"]`)
    await expect(restored).toBeFocused()
    const after=await shell.evaluate(element=>element.scrollTop)
    await info.attach('detail-return-scroll',{contentType:'application/json',body:JSON.stringify({surface,width,before,after,key,rect:await restored.boundingBox()})})
    console.info(`SECONDARY_RETURN ${JSON.stringify({surface,width,before,after,key})}`)
    await page.screenshot({path:info.outputPath('detail-return.png')})
    expect.soft(Math.abs(after-before),'Restore the actual shell scroll owner, not window.scrollY').toBeLessThanOrEqual(2)
    await expect.soft(restored,'Restored focus is visible, not thousands of pixels below the viewport').toBeInViewport()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    expect(evidence.errors).toEqual([]);expect(evidence.mutations).toEqual([])
  })
}
