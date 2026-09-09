import { expect, test, type Page } from '@playwright/test'
import reference from '../src/client-reference-copy.json' with { type: 'json' }

async function openLocale(page: Page) {
  await expect(page.locator('.client-source-app')).toBeVisible()
  if (await page.locator('.client-locale-panel').isVisible()) return
  const globe = page.locator('.client-globe')
  if (await globe.isVisible()) await globe.click()
  else {
    await page.locator('.client-hamburger').click()
    await page.locator('.client-sidebar-bottom [data-sidebar-action="settings"]').click()
    await page.locator('.ca-settings > .ca-menu-group').first().getByRole('button').first().click()
    await page.locator('#ca-sub-settings > button').last().click()
  }
  await expect(page.locator('.client-locale-panel')).toBeVisible()
}

test('원본 7언어·37통화의 검색·단일 선택·저장·홈 번역이 연결된다', async ({ page }) => {
  await page.goto('/')
  await openLocale(page)
  await expect(page.locator('#locale-language li')).toHaveCount(7)
  await expect(page.locator('#locale-currency li')).toHaveCount(37)
  await expect(page.locator('#locale-language button[aria-pressed="true"]')).toHaveText('한국어✓')
  await page.locator('#locale-language input').fill('en')
  await expect(page.locator('#locale-language li')).toHaveCount(1)
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.client-hero-subtitle')).toHaveText(new RegExp(reference.GREETS_ALL.en.map(item => item.s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')))
  await expect(page.locator('.client-home-chips button').first()).toHaveText(reference.I18N['chip.1'].en)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await openLocale(page)
  if (await page.locator('#locale-tab-currency').isVisible()) await page.locator('#locale-tab-currency').click()
  await page.locator('#locale-currency input').fill('krw')
  await expect(page.locator('#locale-currency li')).toHaveCount(1)
  await page.getByRole('button', { name: 'KRW', exact: true }).click()
  await page.reload()
  await openLocale(page)
  if (await page.locator('#locale-tab-currency').isVisible()) await page.locator('#locale-tab-currency').click()
  await expect(page.locator('#locale-currency button[aria-pressed="true"]')).toHaveText('KRW✓')
  expect(await page.evaluate(() => localStorage.getItem('tethCurrency'))).toBe('KRW')
})

test('모든 원본 언어에서 홈 카피·접두사·약관과 작성한 초안을 보존한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  await input.fill('작성 중인 원문은 번역하거나 지우지 마세요')
  for (const item of reference.GLC_LANGS) {
    await openLocale(page)
    await page.getByRole('button', { name: item.n, exact: true }).click()
    await expect(input).toHaveValue('작성 중인 원문은 번역하거나 지우지 마세요')
    await expect(page.locator('html')).toHaveAttribute('lang', item.c)
    const lang = item.c as keyof typeof reference.PH_ROT.list
    const narrow = (page.viewportSize()?.width ?? 0) <= 860
    await expect(input).toHaveAttribute('placeholder', (narrow ? reference.PH_ROT.prefixM : reference.PH_ROT.prefix)[lang] + reference.PH_ROT.list[lang][0])
    await expect(page.locator('.client-home-terms a')).toHaveCount(2)
    expect(await page.locator('.client-home-terms').innerText()).not.toMatch(/\{[TP/]\}/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  }
})

test('입력 예시가 타자·유지·삭제·다음 문구로 순환하며 입력중에는 멈춘다', async ({ page }) => {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  const observed: string[] = []
  for (let i = 0; i < 80; i++) {
    await page.clock.runFor(70)
    observed.push((await input.getAttribute('placeholder')) ?? '')
  }
  expect(observed.some((value, i) => i > 0 && value.length > observed[i - 1].length)).toBeTruthy()
  expect(observed.some((value, i) => i > 0 && value.length < observed[i - 1].length)).toBeTruthy()
  expect(observed.some((value, i) => i > 0 && value === observed[i - 1])).toBeTruthy()
  await input.fill('임의의 투자 질문\n둘째 줄')
  const resting = await input.getAttribute('placeholder')
  await page.clock.runFor(5000)
  await expect(input).toHaveAttribute('placeholder', resting!)
  await expect(input).toHaveValue('임의의 투자 질문\n둘째 줄')
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  await expect(input).toHaveValue('임의의 투자 질문\n둘째 줄')
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue('임의의 투자 질문\n둘째 줄')
})

test('설정 패널은 320~1440px에서 리사이즈·검색·키보드 탐색 중 사라지거나 넘치지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLocale(page)
  for (const width of [1440, 861, 860, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 720 })
    const dialog = page.locator('.client-locale-panel')
    await expect(dialog).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
    expect(box!.y + box!.height).toBeLessThanOrEqual(721)
    if (width <= 860) {
      await page.locator('#locale-tab-currency').click()
      await expect(page.locator('#locale-currency input')).toBeVisible()
      await expect(page.locator('#locale-language input')).toBeHidden()
      await page.keyboard.press('ArrowLeft')
      await expect(page.locator('#locale-language input')).toBeVisible()
    }
  }
  await page.locator('#locale-language input').fill('zzzz')
  await expect(page.locator('.client-locale-panel').getByRole('status')).toHaveText('검색 결과가 없습니다.')
  await page.locator('.locale-close').focus()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.client-locale-panel')))).toBeTruthy()
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  expect(await page.locator('#root').getAttribute('inert')).toBeNull()
})

test('저장 차단은 현재 선택을 유지하고 실패를 알리며 잘못된 저장값은 안전하게 복원한다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'invalid')
    localStorage.setItem('tethCurrency', 'invalid')
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tethLang' || key === 'tethCurrency') throw new DOMException('Blocked', 'SecurityError')
      original.call(this, key, value)
    }
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await openLocale(page)
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.client-locale-panel')).toBeVisible()
  await expect(page.locator('.locale-storage-error')).toContainText('could not be saved')
  await expect(page.locator('#locale-language button[aria-pressed="true"]')).toHaveText('English✓')
  if (await page.locator('#locale-tab-currency').isVisible()) await page.locator('#locale-tab-currency').click()
  await page.getByRole('button', { name: 'KRW', exact: true }).click()
  await expect(page.locator('#locale-currency button[aria-pressed="true"]')).toHaveText('KRW✓')
  await expect(page.locator('.locale-storage-error')).toBeVisible()
})

test('설정 경유 모바일 닫기는 보이는 메뉴 버튼으로 포커스를 돌려준다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 })
  await page.goto('/')
  await openLocale(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-hamburger')).toBeFocused()
  await page.locator('.client-hamburger').click()
  await expect(page.locator('.client-sidebar')).toBeVisible()
})

test('브라우저 저장소 접근 자체가 막혀도 설정 선택과 닫기를 사용할 수 있다', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError') } }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await openLocale(page)
  await page.getByRole('button', { name: '日本語', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(page.locator('.locale-storage-error')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('동일 브라우저 탭의 설정 변경은 다른 탭에 반영하고 정적 금액 표시는 계산과 분리한다', async ({ page, context }) => {
  await page.goto('/')
  const second = await context.newPage()
  await second.goto('/')
  await openLocale(page)
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(second.locator('html')).toHaveAttribute('lang', 'en')
  const formatted = await page.evaluate(async () => {
    const modulePath = '/src/client-preferences.ts'
    const { formatReferenceMoney } = await import(modulePath)
    return ['USD', 'KRW', 'BTC', 'USDC'].map(currency => formatReferenceMoney(5000, currency))
  })
  expect(formatted).toEqual(['$5,000', '₩6,950,000', '₿0.077500', 'USDC 5,000'])
  await second.close()
})
