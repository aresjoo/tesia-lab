import { expect, test } from '@playwright/test'

test('홈 상담원은 원본 컬러 스파크·헤드셋이며 대화와 언어 버튼이 겹치지 않는다', async ({ page }, testInfo) => {
  const external: string[] = []
  page.on('request', request => { if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) external.push(request.url()) })
  await page.goto('/')
  const help = page.locator('.site-help-trigger')
  await expect(help).toBeVisible()
  await expect(help.locator('svg')).toHaveAttribute('viewBox', '0 0 32 32')
  await expect(help.locator('linearGradient stop')).toHaveCount(4)
  await expect(help.locator('.help-status-dot')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
  await page.screenshot({ path: testInfo.outputPath('source-home.png') })
  await page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요' }).fill('비트코인 시장은 어떤가요?')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.client-lab-conversation')).toBeVisible()
  const globe = page.locator('.client-globe')
  await expect(globe).toHaveCount(1)
  if (await page.evaluate(() => innerWidth <= 860)) await expect(globe).toBeHidden()
  else await expect(globe).toBeVisible()
  await expect(help).toHaveCount(0)
  await expect(page.locator('.public-language-trigger')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('source-chat.png') })
  expect(external).toEqual([])
})

test('공개 소개의 데스크톱 상담원·모바일 보존 로컬 도움말은 아이콘·모션·복귀 초점을 유지한다', async ({ page }) => {
  await page.goto('/about/')
  const help = page.locator('.site-help-trigger')
  await expect(help.locator('svg')).toHaveAttribute('viewBox', '0 0 32 32')
  // Frozen about/index.html:279 hides the mobile floating helper; :363 links home.
  // The existing local support callback is retained Mock behavior, not an original modal claim.
  const mobile = (page.viewportSize()?.width ?? 0) <= 760
  const trigger = mobile ? page.locator('.ab-help').getByRole('button', { name: '상담원에게 묻기', exact: true }) : help
  if (mobile) await expect(help).toBeHidden()
  await trigger.click()
  await expect(page.locator('.site-help-pop')).toBeVisible()
  expect(await page.locator('.site-help-pop').evaluate(el => getComputedStyle(el).animationName)).toContain('client-help-in')
  await page.keyboard.press('Escape')
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('작업 기록의 모션은 실제 상태만 표현하고 접힌 기록은 키보드에서 제외한다', async ({ page }) => {
  await page.goto('/tests/fixtures/research-activity.html')
  const activity = page.locator('.g-act2')
  await expect(activity.locator('.activity-spinner')).toHaveCount(1)
  expect(await activity.locator('.hlb').evaluate(el => getComputedStyle(el).animationName)).toContain('client-activity-shimmer')
  await page.getByRole('button', { name: '완료 이벤트 주입' }).click()
  await expect(activity.locator('.hd')).toHaveAttribute('aria-expanded', 'false')
  await expect(activity.locator('.tl')).toHaveAttribute('inert', '')
  expect(await activity.locator('.tl').evaluate(el => getComputedStyle(el).transitionProperty)).toContain('grid-template-rows')
  await expect.poll(() => activity.locator('.tl').evaluate(el => el.getBoundingClientRect().height)).toBe(0)
  await activity.locator('.hd').click()
  await expect(activity.locator('.ar')).toBeVisible()
})

test('모션 최소화에서도 진행 표시와 기록 열람은 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tests/fixtures/research-activity.html')
  const activity = page.locator('.g-act2')
  await expect(activity.locator('.hlb')).toHaveCSS('animation-name', 'none')
  await expect(activity.locator('.activity-spinner')).toHaveCSS('animation-duration', '1.4s')
  await page.getByRole('button', { name: '완료 이벤트 주입' }).click()
  await activity.locator('.hd').click()
  await expect(activity.locator('.ar')).toBeVisible()
})

test('모바일 메뉴·전체 입력은 상담원 버튼을 가리고 초안을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const help = page.locator('.site-help-trigger')
  await expect(help).toBeVisible()
  await page.getByRole('button', { name: '메뉴', exact: true }).click()
  await expect(help).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help).toBeVisible()
  const input = page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요' })
  await input.fill('작성 중인 전략 초안\n다음 조건도 확인')
  await page.locator('.client-expand').click()
  await expect(page.locator('.client-composer-dialog')).toBeVisible()
  await expect(help).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue('작성 중인 전략 초안\n다음 조건도 확인')
  await expect(help).toBeVisible()
  const button = await help.boundingBox()
  const terms = page.locator('.client-home-terms')
  const text = await terms.boundingBox()
  expect(button!.y + button!.height <= text!.y || text!.x + text!.width <= button!.x).toBe(true)
})

test('낮은 모바일의 히어로 설명·원본 갤러리·하단 입력을 겹침 없이 사용할 수 있다', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.client-hero-subtitle')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  for (const [width, height] of [[320, 640], [390, 664], [390, 844], [768, 700]]) {
    await page.setViewportSize({ width, height })
    await expect.poll(() => page.evaluate(() => {
      const subtitle = document.querySelector('.client-hero-subtitle')!.getBoundingClientRect()
      const gallery = document.querySelector('.client-home-gallery')!.getBoundingClientRect()
      const pill = document.querySelector('.client-home-pill')!.getBoundingClientRect()
      return subtitle.bottom <= gallery.top && pill.bottom <= innerHeight
    })).toBe(true)
    // The tall gallery scrolls under the fixed band, but its last card must
    // be reachable by normal scrolling rather than hidden behind the input.
    const last = page.locator('.g-tpl').last()
    await last.click()
    await expect(last).toHaveAttribute('aria-pressed', 'true')
    await last.click()
    await page.evaluate(() => window.scrollTo(0, 0))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 664 })
  await page.screenshot({ path: testInfo.outputPath('source-small-home.png'), fullPage: true })
})

test('홈 언어 패널을 열면 상담원은 숨고 닫으면 원래 위치로 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const help = page.locator('.site-help-trigger')
  await expect(help).toBeVisible()
  await page.locator('.client-globe').click()
  await expect(page.locator('.client-preferences-layer')).toBeVisible()
  await expect(help).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help).toBeVisible()
  await expect(page.locator('.client-globe')).toBeFocused()
})
