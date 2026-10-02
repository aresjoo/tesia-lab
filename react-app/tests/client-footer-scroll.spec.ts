import { expect, test } from '@playwright/test'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { sharedHash } from '../src/client-shared-navigation'

for (const detail of [false, true]) test(`푸터가 있는 ${detail ? '전략 상세' : '전략 목록'}은 초점 강제 이동 없이 휠로 끝까지 읽는다`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '스크롤 검수', email: 'scroll@example.test' }))
    localStorage.setItem('tethLang', 'ko')
  })
  const hash = detail ? sharedHash({ nick: sourceSharedStrategies()[0].nick, period: 'all' }) : '#/share'
  await page.goto(`/${hash}`)
  const shell = page.locator('.tesia-shell.has-site-footer')
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
  await expect(shell).toHaveCSS('overflow-y', 'auto')
  const box = (await shell.boundingBox())!
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .6)
  await page.mouse.wheel(0, 750)
  await expect.poll(() => shell.evaluate(el => el.scrollTop)).toBeGreaterThan(100)
  await page.mouse.wheel(0, 30000)
  await expect.poll(() => shell.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(3)
  await expect(page.locator('.client-site-footer .gft-wm')).toBeInViewport()
  await page.mouse.wheel(0, -30000)
  await expect.poll(() => shell.evaluate(el => el.scrollTop)).toBeLessThan(3)
  if (detail) await expect(page.locator('.ss3-dtitle')).toBeInViewport()
})
