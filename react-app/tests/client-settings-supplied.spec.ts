import { expect, test } from '@playwright/test'
import { nativeAccountText } from '../src/internal-poc/native-account-presentation-copy'

test.setTimeout(45_000)

test('supplied preferences preserve unknown, pending, failure and owner replacement', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html#/settings/notify')
  const toggle=page.getByRole('switch',{name:'공급된 편집 채널',exact:true})
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('switch',{name:'고정 채널',exact:true})).toBeDisabled()
  await expect(page.getByRole('switch',{name:'확인되지 않은 채널',exact:true})).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toBeDisabled()
  expect(await page.evaluate(()=>Reflect.get(window,'settingsPlanCalls'))).toEqual([['changeable',true]])
  await page.evaluate(()=>Reflect.get(window,'settingsPlanReject')(new Error('SECRET_TEST_ERROR')))
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('SECRET_TEST_ERROR')
  await expect(toggle).toBeEnabled()
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await page.evaluate(()=>Reflect.get(window,'settingsPlanOwner')('owner-b'))
  await page.evaluate(()=>Reflect.get(window,'settingsPlanResolve')())
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('supplied settings retain provenance, descriptions, badges, tones and reachable detail actions', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html#/settings/notify')
  const surface=page.locator('.native-settings-plan')
  await expect(surface.locator('[data-plan-source]')).toHaveText('SUPPLIED TEST')
  await expect(surface).toContainText('그룹 표시')
  await expect(surface).toContainText('선택 가능')
  await expect(surface).toContainText('제공된 채널 정책은 계정별로 다릅니다.')
  const toggle=surface.getByRole('switch',{name:'공급된 편집 채널',exact:true})
  await expect(toggle).toHaveAccessibleDescription(/원본 공급 설명을 생략하지 않습니다/)
  await expect(toggle).toHaveAttribute('data-tone','green')
  if((page.viewportSize()?.width??1440)<=900)await page.locator('.stg-mback').click()
  await page.locator('a[href="#/settings/billing"]').click()
  await expect(surface.locator('.stg-badge[data-tone="pro"]')).toHaveText('제공된 상태')
  await expect(surface.locator('.v[data-tone="loss"]')).toHaveText('₩139,000')
  await expect(surface).toContainText('공급된 잔액 설명')
  await expect(surface).toContainText('공급된 결제 안내')
  await expect(surface.getByRole('button',{name:/미공급 상세/})).toBeDisabled()
  await expect(surface.getByRole('button',{name:/외부 주소/})).toBeDisabled()
  await surface.getByRole('button',{name:/연결된 상세/}).click()
  expect(await page.evaluate(()=>Reflect.get(window,'settingsPlanCalls'))).toEqual([{kind:'review',id:'review_settings'}])
})

test('known empty and unavailable preference groups stay distinct', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html#/settings/notify')
  await page.evaluate(()=>Reflect.get(window,'settingsPlanPreferences')([]))
  await expect(page.locator('.native-settings-plan')).toContainText(nativeAccountText('ko','empty'))
  await page.evaluate(()=>Reflect.get(window,'settingsPlanPreferences')(null))
  await expect(page.locator('.native-settings-plan')).toContainText(nativeAccountText('ko','unavailable'))
  await expect(page.getByRole('switch')).toHaveCount(0)
})

test('supplied detail opens in the native host and browser Back restores settings', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html?host=service#/settings/billing')
  await page.locator('.native-settings-plan').getByRole('button',{name:/연결된 상세/}).click()
  await expect(page).toHaveURL(/#\/review\/review_settings$/)
  await expect(page.locator('.native-service-plan')).toContainText('공급된 상세 기록')
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
})

test('supplied billing amounts are not relabelled and actions retain explicit callbacks', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html#/settings/billing')
  const surface=page.locator('.client-settings-page')
  await expect(surface).toContainText('100 USDT')
  await expect(surface).toContainText('₩139,000')
  await expect(surface.getByRole('progressbar')).toHaveAttribute('value','30')
  await surface.getByRole('button',{name:'공급된 요청',exact:true}).click()
  await surface.getByRole('button',{name:'거래 보기',exact:true}).click()
  expect(await page.evaluate(()=>Reflect.get(window,'settingsPlanCalls'))).toEqual(['refresh','trade'])
})

test('same-tick preference clicks dispatch once and never invent a new checked value', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html#/settings/notify')
  const toggle=page.getByRole('switch',{name:'공급된 편집 채널',exact:true})
  await toggle.evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click()})
  expect(await page.evaluate(()=>Reflect.get(window,'settingsPlanCalls'))).toEqual([['changeable',true]])
  await expect(toggle).toBeDisabled()
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('status')).toHaveText(nativeAccountText('ko','pending'))
  await page.evaluate(()=>Reflect.get(window,'settingsPlanResolve')())
  await expect(toggle).toBeEnabled()
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('status')).toHaveText(nativeAccountText('ko','accepted'))
})

test('unusable gauge values do not silently become a zero or full quota', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html#/settings/billing')
  for (const value of [NaN, Infinity, -1, 101]) {
    await page.evaluate(value=>Reflect.get(window,'settingsPlanGauge')(value),value)
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(page.locator('.stg-supplied-gauge')).toContainText(nativeAccountText('ko','unavailable'))
  }
  for (const value of [0,100]) {
    await page.evaluate(value=>Reflect.get(window,'settingsPlanGauge')(value),value)
    await expect(page.getByRole('progressbar')).toHaveAttribute('value',String(value))
  }
})

for (const width of [320,480,861,1440]) test(`supplied long settings ${width}px retain all text and usable controls`, async ({page},info) => {
  await page.setViewportSize({width,height:900})
  await page.goto('/tests/fixtures/client-settings-plan.html#/settings/notify')
  const label='Notifications de sécurité et de compte', badge='Préférence confirmée par le compte connecté', description='Cette préférence concerne uniquement les notifications de ce compte. '.repeat(4)
  await page.evaluate(({label,badge,description})=>Reflect.get(window,'settingsPlanPreferences')([{id:'long',title:label,badge,footer:description,rows:[{id:'long-row',label,description,badge,icon:'mail',checked:true,switchTone:'green'}]}]),{label,badge,description})
  const toggle=page.getByRole('switch',{name:label,exact:true})
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAccessibleDescription(description.trim())
  await page.evaluate(() => document.fonts.ready)
  const rect=await toggle.boundingBox()
  expect(rect!.width).toBeGreaterThanOrEqual(44)
  expect(rect!.height).toBeGreaterThanOrEqual(44)
  // Compare the same layout: font swaps or scrolling between two protocol
  // round trips can move both correctly aligned elements together.
  const {icon,title}=await page.evaluate(() => {
    const read=(selector:string) => {
      const nodes=document.querySelectorAll(selector)
      if(nodes.length!==1)throw new Error(`Expected one geometry target: ${selector}`)
      if(nodes[0].getClientRects().length===0)throw new Error(`Unrendered geometry target: ${selector}`)
      return nodes[0].getBoundingClientRect().toJSON() as {y:number}
    }
    return {icon:read('.stg-preference .stg-row-label > svg'),title:read('.stg-preference .k b')}
  })
  expect(Math.abs(icon!.y-title!.y)).toBeLessThanOrEqual(4)
  expect(await page.locator('.native-settings-plan').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  for (const node of await page.locator('.native-settings-plan :is(.stg-badge,.k span,.stg-empty)').all()) {
    expect(await node.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  }
  await page.screenshot({path:info.outputPath(`supplied-settings-${width}.png`),fullPage:true})
  expect(await page.evaluate(()=>Reflect.get(window,'settingsPlanCalls'))).toEqual([])
})
