import { expect, test, type Page } from '@playwright/test'
import { finishSourceOfflineResearchPlan, restoreSavedDelegationWorkspace } from './fixtures/source-offline-research-entry'

async function plan(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('/')
  const input = page.locator('.client-home-content textarea')
  await input.fill('비트코인 과매도 반등 전략을 검증하고 싶어요')
  await input.press('Enter')
  await page.clock.fastForward(12_000)
  await finishSourceOfflineResearchPlan(page)

}

async function document(page: Page, title: string) {
  const trigger = page.getByRole('button', { name: '연구 문서 열기', exact: true })
  if (await trigger.isVisible()) await trigger.click()
  await page.locator('.rw-artifact').filter({ hasText: new RegExp(`^${title}(검토 필요)?$`) }).click()
}

test('소개 화면을 스크롤하면 고정 헤더 뒤로 본문이 비치지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/about/')
  const header = page.locator('.client-info-about .hd')
  await expect(header).toBeVisible()
  await page.evaluate(() => scrollTo({ top: 100, behavior: 'instant' }))
  await expect(header).toHaveClass(/lite/)
})

test('명시 archive 위임 소비자의 뒤로가기와 메뉴는 모바일·태블릿 경계에서도 분리된다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.client-home-content textarea').fill('비트코인 전략 만들어줘')
  await page.locator('.client-home-content textarea').press('Enter')
  await page.getByRole('button', { name: /^전략 맡기기/ }).click()
  await restoreSavedDelegationWorkspace(page)
  for (const width of [320, 600, 601, 768, 860]) {
    await page.setViewportSize({ width, height: 820 })
    const menu = await page.locator('.client-hamburger').boundingBox(), back = await page.locator('.tfw-hd .bk').boundingBox()
    expect(back!.x).toBeGreaterThanOrEqual(menu!.x + menu!.width + 2)
  }
})

test('낮은 화면에서 긴 문서 질문을 작성해도 본문 읽기 영역이 사라지지 않는다', async ({ page }) => {
  await plan(page)
  for (const height of [280, 360, 480]) {
    await page.setViewportSize({ width: 390, height })
    await page.locator('.rw-composer textarea').fill('손절 조건을 자세히 검토하고 싶어요\n'.repeat(12))
    const scroll = await page.locator('.rw-scroll').boundingBox()
    expect(scroll!.height).toBeGreaterThanOrEqual(56)
    const send = await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).boundingBox()
    expect(send!.y + send!.height).toBeLessThanOrEqual(height - 28)
  }
})

test('모바일·태블릿 인증 입력은 읽을 수 있는 크기를 유지한다', async ({ page }) => {
  await page.goto('/')
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 820 })
    await page.locator('.client-login').click()
    const input = page.locator('.ca-auth input').first()
    await expect(input).toBeVisible()
    expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    await page.keyboard.press('Escape')
  }
})

test('명시 공급 활동의 경과 시간은 한글 대체 글꼴을 쓰고 완료 아이콘은 제목 중앙과 일치한다', async ({ page }) => {
  await page.goto('/')
  // The compatibility display uses the loaded main shell's shared typography.
  await expect(page.locator('.client-home-content textarea')).toBeVisible()
  // Supplied activity display contract; source offline ASK supplies no task start time.
  await page.evaluate(async () => {
    const path = '/tests/fixtures/client-observed-activity.tsx'
    const { mountObservedActivity } = await import(/* @vite-ignore */ path)
    mountObservedActivity()
  })
  await page.evaluate(() => document.fonts.ready)
  const activity = page.locator('.g-act2').filter({ has: page.locator('.els') }).first()
  await expect(activity.locator('.els')).toContainText('초')
  const result = await activity.evaluate(el => {
    const icon = el.querySelector('.hd > .tic')!.getBoundingClientRect()
    const label = el.querySelector('.hlb')!.getBoundingClientRect()
    return { font: getComputedStyle(el.querySelector('.els')!).fontFamily, offset: Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2) }
  })
  expect(result.font).toContain('Noto Sans KR')
  expect(result.offset).toBeLessThanOrEqual(1)
})

test('연구 차트는 화면 너비를 따라가되 축 글자와 매매 마커를 축소하지 않는다', async ({ page }) => {
  await plan(page)
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await page.clock.fastForward(96_000)
  for (const width of [320, 390, 600, 768, 1100, 1101, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await document(page, '백테스트 v2')
    await expect.poll(() => page.locator('.rw-price svg').evaluate(el => Math.abs(el.getBoundingClientRect().width - el.viewBox.baseVal.width))).toBeLessThan(2)
    const result = await page.locator('.rw-price svg').evaluate(el => {
      const rect = el.getBoundingClientRect(), scale = rect.width / el.viewBox.baseVal.width
      return { height: rect.height, font: parseFloat(getComputedStyle(el.querySelector('text')!).fontSize) * scale, markers: el.querySelectorAll('path > title').length }
    })
    expect(result.height).toBeGreaterThanOrEqual(219)
    expect(result.font).toBeGreaterThanOrEqual(10.5)
    expect(result.markers).toBe(20)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('연구의 비선택 탭·지표 이름·팀 상태·표 제목은 읽을 수 있는 대비를 유지한다', async ({ page }) => {
  await plan(page)
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await page.clock.fastForward(96_000)
  await document(page, '백테스트 v2')
  const ratios = await page.locator('.rw-tabs button:not(.on), .g-vstat .k, .g-table th, .rw-team').evaluateAll(els => {
    const lum = (rgb: number[]) => rgb.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }).reduce((v, c, i) => v + c * [.2126, .7152, .0722][i], 0)
    const background = lum([15, 16, 18])
    return els.map(el => { const color = getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0, 3).map(Number); return (lum(color) + .05) / (background + .05) })
  })
  expect(ratios.length).toBeGreaterThan(10)
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
})

test('원본메뉴의기록·전략 복사 화면은 좁은 화면에서 제목과 복귀 버튼이 겹치지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '디테일 검수', email: 'review@example.test' })))
  await page.goto('/')
  for (const width of [320, 390, 768, 861, 1440]) {
    await page.setViewportSize({ width, height: 820 })
    for (const name of ['연구 기록', '전략 복사']) {
      await page.locator(width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
      await page.locator('.client-util').filter({ hasText: new RegExp(`^${name}$`) }).click()
      const title = await page.locator('.hub-header h1').boundingBox(), back = await page.locator('.hub-header button').boundingBox()
      expect(title!.x + title!.width).toBeLessThanOrEqual(back!.x - 4)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})

test('예약·랭킹독립소비자도좁은화면제목과복귀버튼경계를유지한다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const hp = '/src/components/ClientResearchHub.tsx', rp = runtimePaths.reactPath, dp = runtimePaths.rootPath
    const { ClientResearchHub } = await import(hp), { createElement } = (await import(rp)).default, { createRoot } = (await import(dp)).default
    document.getElementById('root')!.style.display = 'none'
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
    Object.assign(window, { renderLegacyResearch: (page: string) => root.render(createElement(ClientResearchHub, { page, records: [], onSelect() {}, onNew() {}, onFollow() {}, onReturn() {} })) })
  })
  for (const width of [320, 390, 768, 861, 1440]) {
    await page.setViewportSize({ width, height: 820 })
    for (const value of ['schedule', 'ranking']) {
      await page.evaluate(value => Reflect.get(window, 'renderLegacyResearch')(value), value)
      await expect(page.locator('.hub-header h1')).toHaveText(value === 'schedule' ? '예약된 검증' : '전략 랭킹')
      const title = await page.locator('.hub-header h1').boundingBox(), back = await page.locator('.hub-header button').boundingBox()
      expect(title!.x + title!.width).toBeLessThanOrEqual(back!.x - 4)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})
