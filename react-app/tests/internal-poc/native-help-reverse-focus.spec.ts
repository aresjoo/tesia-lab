import { expect, test } from '@playwright/test'

// Actual service renderer; only anonymous session/CSRF HTTP responses are fixtures.
// Source help-widget.js has no keyboard controls. This covers the migrated
// nonmodal popup boundary, without changing provider state or trapping focus.
for (const viewport of [{ width:320, height:320 }, { width:390, height:480 }]) {
  for (const language of ['ko','fr']) {
    test(`${viewport.width}x${viewport.height} ${language} reverse help boundary dismisses before returning visible focus`, async ({page,baseURL},info)=>{
      if (!baseURL) throw new Error('Local baseURL required')
      const origin=new URL(baseURL).origin, mutations:string[]=[], errors:string[]=[]
      await page.setViewportSize(viewport)
      await page.emulateMedia({reducedMotion:'reduce'})
      page.on('pageerror',error=>errors.push(error.message))
      await page.addInitScript(language=>{ localStorage.setItem('tethLang',language); localStorage.setItem('tethCurrency','USD') },language)
      await page.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url())
        if (!['GET','HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
        if (url.origin!==origin) return route.abort('blockedbyclient')
        if (url.pathname.startsWith('/api/')) {
          if (!['/api/v1/auth/session','/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
          const session=url.pathname.endsWith('/session')
          return route.fulfill({contentType:'application/json',headers:session?{ETag:'"help_reverse_001"'}:{},body:JSON.stringify({
            meta:{apiContractVersion:'0.1.0',resourceRevision:session?'1':null,requestId:'req_help_reverse_001',traceId:'trace_help_reverse_001'},
            data:session?{sessionId:'session_help_reverse_001',state:'ANONYMOUS',revision:'1',issuedAt:'2030-01-01T00:00:00Z',expiresAt:'2030-01-02T00:00:00Z'}
              :{csrfToken:'csrf_help_reverse_001',expiresAt:'2030-01-02T00:00:00Z'},
          })})
        }
        if (request.isNavigationRequest()&&url.pathname==='/') return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
          import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);
          window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
          await import('/src/internal-poc/service-main.tsx');</script></body></html>`})
        return route.continue()
      })
      await page.goto('/')
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase','ready')
      await page.evaluate(()=>document.fonts.ready)
      const trigger=page.locator('.site-help-trigger:visible'), popup=page.locator('.site-help-pop')
      await trigger.focus(); await page.keyboard.press('Enter')
      await expect(popup.locator('.help-close')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      const evidence=await page.evaluate(()=>{
        const active=document.activeElement!, rect=active.getBoundingClientRect(), at=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)
        const panel=document.querySelector('.site-help-pop'), pr=panel?.getBoundingClientRect()
        return {active:{tag:active.tagName,className:active.className,text:active.textContent?.slice(0,90),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}},
          hit:at?{tag:at.tagName,className:at.className,insideHelp:Boolean(at.closest('.site-help-pop'))}:null,
          popupActive:panel?.getAttribute('data-surface-active'),overlap:pr?Math.max(0,Math.min(rect.right,pr.right)-Math.max(rect.left,pr.left))*Math.max(0,Math.min(rect.bottom,pr.bottom)-Math.max(rect.top,pr.top)):0}
      })
      await info.attach('reverse-help-focus',{contentType:'application/json',body:JSON.stringify(evidence)})
      console.info(`REVERSE_HELP_FOCUS ${JSON.stringify({viewport,language,...evidence})}`)
      await page.screenshot({path:info.outputPath('reverse-help-focus.png')})
      await expect(popup).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect(trigger).toBeInViewport()
      expect(await trigger.evaluate(element=>{
        const r=element.getBoundingClientRect(), at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)
        return at===element||Boolean(at&&element.contains(at))
      }),'Restored FAB focus is not covered').toBe(true)
      // A further reverse Tab must leave normally: this is not a focus trap.
      await page.keyboard.press('Shift+Tab')
      await expect(trigger).not.toBeFocused()
      expect(mutations).toEqual([]);expect(errors).toEqual([])
    })
  }
}
