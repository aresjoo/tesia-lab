import { expect, test, type Page } from '@playwright/test'
import reference from '../src/client-reference-copy.json' with { type: 'json' }
import { CLIENT_HOME_SUBCOPY } from '../src/client-home-gallery'

async function openLocale(page: Page) {
  await expect(page.locator('.client-source-app')).toBeVisible()
  if (await page.locator('.client-locale-panel').isVisible()) return
  const globe = page.locator('.client-globe')
  if (await globe.isVisible()) await globe.click()
  else {
    // The source exposes the language panel on desktop. Exercise its actual
    // entry, then its responsive layout; mobile settings use the language select.
    const viewport = page.viewportSize()!
    await page.setViewportSize({ width: 900, height: viewport.height })
    await globe.click()
    await page.setViewportSize(viewport)
  }
  await expect(page.locator('.client-locale-panel')).toBeVisible()
}

test('최신 원본 언어 전용 패널의 검색·단일 선택·저장·홈 번역이 연결된다', async ({ page }) => {
  await page.goto('/')
  await openLocale(page)
  await expect(page.locator('#locale-language li')).toHaveCount(7)
  await expect(page.locator('#locale-currency')).toHaveCount(0)
  await expect(page.locator('#locale-language button[aria-pressed="true"]')).toHaveText('한국어✓')
  await page.locator('#locale-language input').fill('en')
  await expect(page.locator('#locale-language li')).toHaveCount(1)
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.client-hero-subtitle')).toHaveText(CLIENT_HOME_SUBCOPY.en.replace(/\n/g, ' '))
  // 9bf4427 replaces the old three greeting chips with the original gallery.
  await expect(page.locator('.g-tpl[data-id="auto"]')).toBeVisible()
  await expect(page.locator('.g-tpl')).toHaveCount(55)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await openLocale(page)
  await expect(page.locator('#locale-language button[aria-pressed="true"]')).toHaveText('English✓')
  await expect(page.locator('.client-locale-panel').getByRole('searchbox')).toHaveCount(1)
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

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`홈 입력 전체 삭제 ${reducedMotion}: 포커스를 유지한 순환 재개와 감소모션 고정 문구를 보존한다`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
    await page.emulateMedia({ reducedMotion })
    await page.goto('/')
    const input = page.locator('#strategy-idea')
    await expect(input).toBeVisible()
    const original = await input.elementHandle()
    const prefix = (page.viewportSize()!.width <= 860 ? reference.PH_ROT.prefixM : reference.PH_ROT.prefix).ko
    const phrases = reference.PH_ROT.list.ko
    await input.fill('직접 쓴 질문은 자동 예시로 바뀌지 않습니다.\n둘째 줄도 보존합니다.')
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
    const paused = await input.getAttribute('placeholder')
    await page.clock.runFor(5600)
    await expect(input).toHaveAttribute('placeholder', paused!)
    await expect(input).toHaveValue('직접 쓴 질문은 자동 예시로 바뀌지 않습니다.\n둘째 줄도 보존합니다.')
    await expect(input).toBeFocused()

    // Source phRotStart has no focus/blur gate: clearing a focused composer
    // must reveal the rotation without requiring navigation or another click.
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
    expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
    const observations: string[] = []
    for (let tick = 0; tick < 100; tick++) {
      await page.clock.runFor(70)
      observations.push((await input.getAttribute('placeholder')) ?? '')
    }
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
    if (reducedMotion === 'reduce') {
      expect(new Set(observations)).toEqual(new Set([prefix + phrases[0]]))
    } else {
      expect(observations.every(value => value.startsWith(prefix) && phrases.some(phrase => phrase.startsWith(value.slice(prefix.length))))).toBe(true)
      expect(observations.some((value, i) => i > 0 && value.length > observations[i - 1].length)).toBe(true)
      expect(observations.some((value, i) => i > 0 && value.length === observations[i - 1].length && phrases.includes(value.slice(prefix.length)))).toBe(true)
      const deletion = observations.findIndex((value, i) => i > 0 && value.length < observations[i - 1].length)
      expect(deletion).toBeGreaterThan(0)
      expect(observations.some((value, i) => i > deletion && value.length > observations[i - 1].length)).toBe(true)
    }
    // Move focus using the normal keyboard order, without changing input or
    // opening an overlay. Losing focus is not a source animation stop signal.
    await page.keyboard.press('Tab')
    await expect(input).not.toBeFocused()
    const afterBlur: string[] = []
    for (let tick = 0; tick < 50; tick++) {
      await page.clock.runFor(70)
      afterBlur.push((await input.getAttribute('placeholder')) ?? '')
    }
    if (reducedMotion === 'reduce') expect(new Set(afterBlur)).toEqual(new Set([prefix + phrases[0]]))
    else expect(new Set(afterBlur).size).toBeGreaterThan(1)
    await expect(input).toHaveValue('')
    expect(await input.evaluate((node, previous) => node === previous, original)).toBe(true)
  })
}

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
    await expect(page.locator('#locale-language input')).toBeVisible()
    await expect(dialog.getByRole('tab')).toHaveCount(0)
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
  await page.getByRole('button', { name: '日本語', exact: true }).click()
  await expect(page.locator('#locale-language button[aria-pressed="true"]')).toHaveText('日本語✓')
  await expect(page.locator('.locale-storage-error')).toBeVisible()
})

test('언어 패널의 모바일 전환 후 닫기는 보이는 메뉴 버튼으로 포커스를 돌려준다', async ({ page }) => {
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
  expect(formatted).toEqual(['$5,000', '$5,000', '$5,000', '$5,000'])
  await second.close()
})
