import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// NativeAccountPlan's real target guards are covered by action-routes tests.
// This isolates their production CSS affordance from unrelated account data.
test('도달 불가 문서 행은 클릭 커서·호버 움직임이 없고 활성 행은 기존 조작감을 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setContent('<!doctype html><div class="client-account-activity" style="--g2:#101114;--g3:#202124;--gl:#303134;--gl2:#404144"><button class="nfx-row lk" disabled>Unavailable document</button><button class="nfx-row lk">Available document</button></div>')
  await page.addStyleTag({ content: readFileSync('src/client-account-activity.css', 'utf8') })
  const disabled = page.getByRole('button', { name: 'Unavailable document', exact: true })
  await expect(disabled).toBeDisabled()
  await expect.soft(disabled).toHaveCSS('cursor', 'not-allowed', { timeout: 1500 })
  await disabled.hover()
  await expect.soft(disabled).toHaveCSS('transform', 'none', { timeout: 1500 })
  await expect(disabled).toHaveCSS('background-color', 'rgb(16, 17, 20)')
  const enabled = page.getByRole('button', { name: 'Available document', exact: true })
  await expect(enabled).toBeEnabled()
  await expect(enabled).toHaveCSS('cursor', 'pointer')
  await enabled.hover()
  await expect(enabled).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -1)')
  await expect(enabled).toHaveCSS('background-color', 'rgb(32, 33, 36)')
})
