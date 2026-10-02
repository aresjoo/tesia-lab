import { expect, test } from '@playwright/test'
import { researchCopy } from '../src/client-research-copy'
import { sourceSidebarNavigationLabel } from '../src/client-shell-copy'

for (const entry of ['연구 기록', '전략들']) test(`${entry} 헤더는 알림·메뉴와 겹치지 않고 다국어·확대에서도 복귀할 수 있다`, async ({ page }, info) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수', email: 'header@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '유지할 투자 질문', sessions: [] }))
  })
  await page.goto('/')
  if ((page.viewportSize()?.width ?? 0) <= 860) await page.locator('.client-hamburger').click()
  await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', entry === '연구 기록' ? 'history' : 'sharing'), exact: true }).click()
  const header = page.locator('#research-main > .hub-header')
  await expect(header).toBeVisible()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    const back = header.getByRole('button', { name: researchCopy(language, 'return'), exact: true })
    await expect(back).toBeVisible()
    for (const [width, height, zoom] of [[1440, 900, 1], [860, 600, 1], [390, 700, 1], [320, 568, 1], [1440, 900, 2], [390, 700, 2], [320, 568, 2]]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(zoom => { document.body.style.zoom = String(zoom) }, zoom)
      await expect.poll(() => header.evaluate(node => {
        const title = node.querySelector('h1')!, back = node.querySelector('button')!
        const rect = back.getBoundingClientRect(), titleRect = title.getBoundingClientRect()
        const controls = [...document.querySelectorAll('.client-account-utility button,.client-hamburger')].filter(button => button.getBoundingClientRect().width > 0)
        const apart = (a: DOMRect, b: DOMRect) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        return { separate: controls.every(button => apart(rect, button.getBoundingClientRect()) && apart(titleRect, button.getBoundingClientRect())) && apart(rect, titleRect), clickable: hit === back || back.contains(hit), fits: node.scrollWidth <= node.clientWidth + 1 && rect.right <= innerWidth + 1, readable: titleRect.width >= 44 && rect.width >= 44, target: rect.height >= 44 }
      }), { message: `${entry} ${language} ${width}px zoom ${zoom}` }).toEqual({ separate: true, clickable: true, fits: true, readable: true, target: true })
      await expect.poll(() => page.locator('.skip-link').evaluate(node => node.getBoundingClientRect().bottom), { message: '비활성 본문 바로가기의 일부가 노출되면 안 된다' }).toBeLessThanOrEqual(0)
      if (language === 'fr' && width === 320) await page.screenshot({ path: info.outputPath(`${entry}-fr-320-${zoom}.png`) })
    }
  }
  const skip = page.locator('.skip-link')
  await skip.focus()
  await expect.poll(() => skip.evaluate(node => {
    const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth && (hit === node || node.contains(hit))
  })).toBe(true)
  await skip.press('Enter')
  await expect(page.locator('#tesia-main')).toBeFocused()
  const back = header.getByRole('button', { name: researchCopy('fr', 'return'), exact: true })
  await back.focus()
  await expect(back).toBeFocused()
  await back.press('Enter')
  await expect(header).toHaveCount(0)
  await expect(page.locator('#strategy-idea')).toHaveValue('유지할 투자 질문')
  expect(errors).toEqual([])
})
