import {expect,test} from '@playwright/test'
import copy from '../src/client-catalogue-copy-setup-copy.json' with {type:'json'}

for(const height of [320,900]) test(`844×${height} 복사창 진입 시 초점 입력이 화면 안에 보인다`,async({page})=>{
  await page.setViewportSize({width:844,height})
  await page.goto('/')
  await page.evaluate(async()=>{const path='/tests/fixtures/catalogue-copy-setup-harness.tsx';Object.assign(window,{copySetupHarness:(await import(path)).mountCatalogueCopy()})})
  await expect(page.locator('.ss3-dtitle')).toBeVisible()
  const trigger=page.locator('.shared-detail-actions .wbtn')
  // Playwright scrolls the source trigger into view before dispatching click.
  // Capture the background at the user's actual open event, not before that
  // legitimate movement, to isolate scroll changes introduced by the sheet.
  await trigger.evaluate(el=>el.addEventListener('click',()=>Reflect.set(window,'copyBackgroundAtOpen',{x:scrollX,y:scrollY}),{capture:true,once:true}))
  await trigger.click()
  const amount=page.getByLabel(copy.ko.budget,{exact:true})
  await expect(amount).toBeFocused()
  if (height === 900) {
    const fixed = await page.locator('.catalogue-copy-sheet').evaluate(el => ({
      fallback: el.classList.contains('is-content-scroll'),
      overflow: getComputedStyle(el.querySelector('.ccs-body')!).overflowY,
      footerGap: el.getBoundingClientRect().bottom - el.querySelector('footer')!.getBoundingClientRect().bottom,
    }))
    expect(fixed.fallback).toBe(false)
    expect(fixed.overflow).toBe('auto')
    // Preserve the source border-box edge (within one CSS pixel); the border
    // can put the rect on either side, not exclusively inside the dialog.
    expect(Math.abs(fixed.footerGap)).toBeLessThanOrEqual(1)
  }
  expect(await amount.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
  expect(await page.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual(await page.evaluate(()=>Reflect.get(window,'copyBackgroundAtOpen')))
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

for(const width of [320,844]) for(const height of [240,320,480]) for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) test(`${language} ${width}×${height} 확대·실패 후 복사 본문과 하단 동작을 모두 읽고 조작한다`,async({page},info)=>{
  await page.setViewportSize({width,height})
  await page.addInitScript(language=>localStorage.setItem('tethLang',language),language)
  await page.goto('/')
  await page.evaluate(async()=>{const path='/tests/fixtures/catalogue-copy-setup-harness.tsx';Object.assign(window,{copySetupHarness:(await import(path)).mountCatalogueCopy()})})
  await expect(page.locator('.ss3-dtitle')).toBeVisible()
  const trigger=page.locator('.shared-detail-actions .wbtn')
  await trigger.click()
  const sheet=page.locator('.catalogue-copy-sheet'),words=copy[language]
  await expect(sheet.getByRole('heading',{name:words.title,exact:true})).toBeVisible()
  const amount=sheet.getByLabel(words.budget,{exact:true})
  await amount.fill('500')
  await sheet.getByRole('button',{name:words.start,exact:true}).click()
  await page.evaluate(()=>Reflect.get(window,'copySetupHarness').settle(0,false))
  await expect(sheet.locator('footer [role="alert"]')).toHaveText(words.failed)
  await expect(sheet.getByRole('button',{name:words.start,exact:true})).toBeEnabled()
  // Text-only enlargement, not a claim about OS/browser zoom. Snapshot every
  // original computed size before writes so nested text is not doubled twice.
  await sheet.evaluate(el=>{
    const nodes=[...el.querySelectorAll<HTMLElement>('h2,label,button,p,dt,dd')]
    const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node,i)=>node.style.fontSize=`${sizes[i]*2}px`)
  })
  const body=sheet.locator('.ccs-body')
  // The ResizeObserver deliberately schedules the content-fit layout in the
  // next animation frame; wait for that layout, preserving the same threshold.
  await expect.poll(()=>body.evaluate(el=>el.clientHeight)).toBeGreaterThanOrEqual(84)
  // Verify the actual readable scrollport as well as the content body's old
  // threshold. A naturally tall body is not proof of a usable viewport.
  await expect.poll(()=>sheet.evaluate(el=>{
    const footer=el.querySelector<HTMLElement>('footer')!
    const fallback=footer.scrollHeight+96>el.clientHeight
    const port=el.querySelector<HTMLElement>(fallback?'form':'.ccs-body')!
    return el.classList.contains('is-content-scroll')===fallback&&port.clientHeight>=84
  })).toBe(true)
  const close=sheet.getByRole('button',{name:words.close,exact:true})
  for(const control of [amount,close,sheet.getByRole('button',{name:words.start,exact:true})]){
    await control.focus()
    const hit=await control.evaluate(el=>{
      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2
      return r.top>=0&&r.bottom<=innerHeight&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&el.contains(document.elementFromPoint(x,y))
    })
    expect(hit).toBe(true)
    await expect(control).toBeFocused()
  }
  expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await expect(amount).toHaveValue('500')
  expect((await page.evaluate(()=>Reflect.get(window,'copySetupHarness').snapshot())).calls).toHaveLength(1)
  if(width===320&&height===320&&language==='fr')await page.screenshot({path:info.outputPath('short-copy-corrected.png')})
  await close.press('Enter')
  await expect(sheet).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
