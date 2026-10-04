import { expect, test, type Page } from '@playwright/test'
import copy from '../src/client-site-footer-copy.json' with { type: 'json' }

test.setTimeout(60_000)
test('common footer keeps source hierarchy and navigation on public pages', async ({ page }) => {
  for (const path of ['/about/', '/download/', '/policies/']) {
    await page.goto(path)
    const footer = page.locator('.client-site-footer')
    await expect(footer).toHaveCount(1)
    await expect(footer.locator('.gft-col h3')).toHaveText(['제품','회사','도움','약관'])
    await expect(footer.locator('.gft-wm')).toHaveAttribute('viewBox', '0 0 3970 1000')
    await expect(footer.locator('a[href="#"]')).toHaveCount(0)
    await expect(footer.locator('.gft-follow button:disabled')).toHaveCount(4)
    await footer.getByRole('button', { name: '24시간 상담', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(footer.getByRole('button', { name: '24시간 상담', exact: true })).toBeFocused()
  }
})

for (const width of [320, 600, 900, 1440]) test(`footer ${width}px layout, language and source scroll boundaries`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  const footer = page.locator('.client-site-footer')
  await expect(footer).toBeVisible()
  // Assert before any action that could scroll the composer into view.
  await expect(page.locator('#strategy-idea')).toBeInViewport({ ratio: 1 })
  for (const lang of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) {
    await page.evaluate(async lang => { const path='/src/client-preferences.ts'; (await import(path)).setClientPreference('language',lang) },lang)
    await expect(footer).toHaveAttribute('aria-label', copy[lang].siteInfo)
    await footer.locator('.gft-wm').scrollIntoViewIfNeeded()
    await expect(page.locator('.client-source-app')).toHaveClass(/footer-in-view/)
    await expect.poll(() => page.locator('.client-source-app > .site-help').evaluate(el => getComputedStyle(el).bottom)).toBe('22px')
    expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
    expect(await footer.evaluate(el => el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1)
    expect(await footer.evaluate(el => {
      const f=el.getBoundingClientRect(), band=document.querySelector('.client-home-band')!.getBoundingClientRect()
      return band.bottom <= f.top + 1
    })).toBe(true)
    for(const target of await footer.locator('a,button').all()) {
      const box=await target.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(43)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x+box!.width).toBeLessThanOrEqual(width+1)
    }
    if(width>860) expect(await page.locator('.client-sidebar').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual((await footer.boundingBox())!.y+1)
  }
  await page.screenshot({path:info.outputPath(`footer-${width}.png`)})
  await page.setViewportSize({ width, height: 420 })
  await footer.getByRole('button',{name:copy.fr.sections.help.items[0],exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(footer.getByRole('button',{name:copy.fr.sections.help.items[0],exact:true})).toBeFocused()
})

test('홈의 긴 갤러리에서도 첫 입력과 키보드 초점이 고정 영역 뒤로 숨지 않는다', async ({ page }, info) => {
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  await expect(input).toBeInViewport({ ratio: 1 })
  const shell = page.locator('.client-source-app.has-site-footer')
  expect(await shell.evaluate(el => Math.abs(el.clientHeight - innerHeight))).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath('home-initial-composer.png') })
  const cards = page.locator('.client-home-gallery button.g-tpl')
  await cards.first().focus()
  for (let index = 0; index < 12; index++) {
    if (index > 0) await page.keyboard.press('Tab')
    const card = cards.nth(index)
    await expect(card).toBeFocused()
    await expect.poll(() => card.evaluate(el => {
      const r = el.querySelector('.lb')!.getBoundingClientRect(), band = document.querySelector('.client-home-band')!.getBoundingClientRect()
      const x = r.x + r.width / 2, y = r.y + r.height / 2
      return r.top >= 128 && r.bottom <= band.top && Boolean(el.contains(document.elementFromPoint(x, y)))
    })).toBe(true)
  }
})

test('mobile drawer locks footer too and restores it after Escape', async ({page}) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  const footer=page.locator('.client-site-footer')
  await expect(footer).toBeVisible()
  await page.locator('.client-hamburger').click()
  await expect(footer).toHaveJSProperty('inert',true)
  await page.keyboard.press('Escape')
  await expect(footer).toHaveJSProperty('inert',false)
  await expect(page.locator('.client-hamburger')).toBeFocused()
})

test('footer navigates finite surfaces and the unready member introduction without losing home draft', async ({page}) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({name:'Footer',email:'footer@example.test'})))
  await page.goto('/')
  await page.locator('#strategy-idea').fill('원래 입력을 유지합니다')
  const footer=page.locator('.client-site-footer')
  await footer.getByRole('button',{name:'거래소 연결',exact:true}).click()
  await expect(page.getByTestId('connection-plan')).toBeVisible()
  await expect(footer).toHaveCount(0)
  await page.getByTestId('connection-plan').getByRole('button',{name:'뒤로',exact:true}).click()
  await expect(page).not.toHaveURL(/#\/connect\//)
  await expect(page.locator('#strategy-idea')).toHaveValue('원래 입력을 유지합니다')
  for(const label of ['인사이트','전략 따라하기']) {
    await footer.getByRole('button',{name:label,exact:true}).click()
    await expect(footer).not.toHaveClass(/gft-lime/)
    await expect(footer).toHaveCount(1)
    await footer.getByRole('button',{name:'새 전략 만들기',exact:true}).click()
    await expect(page.locator('#strategy-idea')).toHaveValue('원래 입력을 유지합니다')
    await expect(page.locator('#strategy-idea')).toBeInViewport()
    await expect(page.locator('#strategy-idea')).toBeFocused()
  }
  await footer.getByRole('button',{name:'AI 트레이딩',exact:true}).click()
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.txh')).toBeVisible()
  await expect(footer).toHaveCount(1)
})

test('native footer preserves the service environment and uses existing account routes', async ({page}) => {
  await page.goto('/tests/fixtures/client-settings-plan.html?host=service')
  const footer=page.locator('.client-site-footer')
  await expect(footer).toHaveCount(1)
  await expect(footer.locator('.gft-copy')).not.toContainText('제품 디자인 미리보기')
  await footer.getByRole('button',{name:'24시간 상담',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(footer.getByRole('button',{name:'24시간 상담',exact:true})).toBeFocused()
  await footer.getByRole('button',{name:'이용 현황',exact:true}).click()
  await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
  await expect(footer).toHaveCount(0)
})

for (const width of [320, 1440]) test(`홈 푸터 ${width}px 키보드 재진입은 초안과 입력 가시성을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 420 : 900 })
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  await input.fill('계속 작성할 질문')
  const footer = page.locator('.client-site-footer')
  for (const key of ['Enter', 'Space']) {
    const previous = footer.getByRole('button', { name: '전략 따라하기', exact: true })
    await previous.focus()
    await page.keyboard.press('Tab')
    await expect(footer.getByRole('button', { name: '새 전략 만들기', exact: true })).toBeFocused()
    await page.keyboard.press(key)
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('계속 작성할 질문')
    await expect(input).toBeInViewport({ ratio: 1 })
    expect(await input.evaluate(el => {
      const r = el.getBoundingClientRect()
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el
    })).toBe(true)
  }
  await page.screenshot({ path: info.outputPath(`home-return-${width}.png`) })
})

test('모바일 홈의 고정 메뉴 뒤에는 스크롤한 카드가 비치거나 클릭되지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 420 })
  await page.goto('/')
  for (const banner of [true, false]) {
    if (!banner) await page.locator('.client-banner-close').click()
    const headerY = banner ? 96 : 32
    const card = page.locator('.client-home-gallery button').last()
    await expect(card).toBeAttached()
    await card.evaluate((el, y) => {
      const shell = el.closest('.client-source-app')!
      shell.scrollTop += el.getBoundingClientRect().top - y
    }, headerY)
    const hamburger = await page.locator('.client-hamburger').boundingBox()
    const auth = await page.locator('.client-auth-nav').boundingBox()
    const x = (hamburger!.x + hamburger!.width + auth!.x) / 2
    expect(await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      return Boolean(hit && !hit.closest('.client-home-gallery,.landing-hero'))
    }, { x, y: headerY })).toBe(true)
    await expect(page.locator('.client-login')).toBeVisible()
    await page.screenshot({ path: info.outputPath(`home-header-${banner ? 'banner' : 'plain'}.png`) })
    // Source hides the floating menu while scrolling down; scroll upward to
    // expose the same real pointer target before opening it.
    await page.locator('.client-source-app').evaluate(el => { el.scrollTop = Math.max(0, el.scrollTop - 80) })
    await expect(page.locator('.client-hamburger')).not.toHaveClass(/scroll-hidden/)
    await page.locator('.client-hamburger').click()
    await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
    await page.keyboard.press('Escape')
  }
})

test('home footer does not cover input and is absent from chat and settings', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({name:'Footer',email:'footer@example.test'})))
  await page.goto('/')
  const footer = page.locator('.client-site-footer')
  await expect(footer).toHaveClass(/gft-lime/)
  await page.locator('#strategy-idea').fill('하락할 때 나누어 사는 전략')
  await footer.getByRole('button', { name: '24시간 상담', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(footer.getByRole('button', { name: '24시간 상담', exact: true })).toBeFocused()
  await expect(page.locator('#strategy-idea')).toHaveValue('하락할 때 나누어 사는 전략')
  await footer.getByRole('button', { name: '이용 현황', exact: true }).click()
  await expect(page.locator('.client-settings-page')).toBeVisible()
  await expect(footer).toHaveCount(0)
  if ((page.viewportSize()?.width ?? 1280) <= 900) await page.locator('.stg-mback').click()
  await page.locator('.stg-back').click()
  await expect(page.locator('#strategy-idea')).toHaveValue('하락할 때 나누어 사는 전략')
  await page.locator('#strategy-idea').press('Enter')
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(footer).toHaveCount(0)
})


/** Hold only the real optional chunk; exercise actual caller/loader callbacks. */
async function holdHelpChunk(page: Page) {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/components/ClientHelp.tsx*', async route => {
    await gate
    await route.continue().catch(() => { /* Navigation may retire this request. */ })
  })
  return async () => {
    release()
    // Complete the same real module, then allow its React commit to paint.
    await page.evaluate(async () => {
      const path = '/src/components/ClientHelp.tsx'
      await import(path)
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
  }
}

for (const host of ['public', 'native'] as const) {
  for (const action of ['cancel', 'handoff'] as const) test(`${host} footer lazy help ${action} preserves its pointer origin`, async ({ page }) => {
    const release = await holdHelpChunk(page)
    await page.goto(host === 'native' ? '/tests/fixtures/client-settings-plan.html?host=service' : '/', { waitUntil: 'domcontentloaded' })
    const input = page.locator('#strategy-idea')
    if (host === 'public') await input.fill('로딩 중에도 원래 질문을 보존합니다')
    const footer = page.locator('.client-site-footer')
    const trigger = footer.getByRole('button', { name: '24시간 상담', exact: true })
    try {
      await trigger.click()
      await expect(page.locator('.client-load-panel[role=dialog]')).toBeFocused()
      if (action === 'handoff') {
        await release()
        await expect(page.locator('.client-load-layer')).toHaveCount(0)
        await expect(page.locator('.client-modal-help .help-close')).toBeFocused()
      }
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
      await release()
      await expect(page.locator('.client-load-layer')).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect(page.locator('.client-source-app')).toHaveJSProperty('inert', false)
      if (host === 'public') await expect(input).toHaveValue('로딩 중에도 원래 질문을 보존합니다')
      else {
        await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
        await expect(footer.locator('.gft-copy')).not.toContainText('제품 디자인 미리보기')
      }
    } finally { await release() }
  })
}

test('native lazy help owner replacement retires old focus and late completion', async ({ page }) => {
  const release = await holdHelpChunk(page)
  await page.goto('/tests/fixtures/client-settings-plan.html?host=service', { waitUntil: 'domcontentloaded' })
  try {
    await page.locator('.client-site-footer').getByRole('button', { name: '24시간 상담', exact: true }).click()
    await expect(page.locator('.client-load-panel[role=dialog]')).toBeFocused()
    await page.evaluate(() => Reflect.get(window, 'settingsPlanOwner')('owner-b'))
    await expect(page.locator('.client-load-layer')).toHaveCount(0)
    const newerTarget = page.locator('#strategy-idea')
    await newerTarget.focus()
    await expect(newerTarget).toBeFocused()
    await release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(newerTarget).toBeFocused()
    await expect(page.locator('.client-source-app')).toHaveJSProperty('inert', false)
  } finally { await release() }
})

test('native lazy help settings navigation preserves the newer page focus', async ({ page }) => {
  const release = await holdHelpChunk(page)
  await page.goto('/tests/fixtures/client-settings-plan.html?host=service', { waitUntil: 'domcontentloaded' })
  try {
    await page.locator('.client-site-footer').getByRole('button', { name: '24시간 상담', exact: true }).click()
    await expect(page.locator('.client-load-panel[role=dialog]')).toBeFocused()
    await page.evaluate(() => { location.hash = '#/settings/billing' })
    await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
    await expect(page.locator('.client-load-layer')).toHaveCount(0)
    const newerTarget = page.getByRole('button', { name: '공급된 요청', exact: true })
    await newerTarget.focus()
    await expect(newerTarget).toBeFocused()
    await release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(newerTarget).toBeFocused()
    await expect(page.locator('.client-site-footer')).toHaveCount(0)
  } finally { await release() }
})
