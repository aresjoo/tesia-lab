import { expect, test, type Page } from '@playwright/test'
import { catalogueSourceSha } from '../src/client-catalogue'

const email = 'catalogue-backtest-host@example.test'
async function open(page: Page, owned = false, hash = '#/share/s/f1') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (owned) await page.addInitScript(email => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'BT host', email })), email)
  await page.goto('/' + hash)
}
async function signup(page: Page) {
  const dialog = page.locator('.ca-auth')
  await dialog.locator('input[type=email]').fill(email)
  await dialog.locator('button[type=submit]').click()
  await dialog.locator('input[autocomplete=new-password]').fill('Mock-password-123!')
  await dialog.locator('button[type=submit]').click()
  await dialog.locator('input[autocomplete=one-time-code]').fill('123456')
  await dialog.locator('button[type=submit]').click()
  await dialog.getByLabel('연령', { exact: true }).fill('28')
  await dialog.getByRole('button', { name: '시장에 입장하기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}
async function verify(page: Page) {
  await page.locator('.shared-detail-analysis').click()
}

test('비회원 직접검증은 가입 취소 때 상세·조건·실행권한을 그대로 둔다', async ({ page }) => {
  await open(page)
  await verify(page)
  await expect(page.locator('.ca-auth')).toContainText('로그인 또는 회원가입')
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/#\/share\/s\/f1$/)
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('teth-client-catalogue-backtest:') || k.startsWith('teth-catalogue-copy-preview:')))).toEqual([])
})

test('직접검증 가입 의도는 같은 전략으로 한 번만 복귀하고 별도 결과를 계산한다', async ({ page }) => {
  await open(page)
  await verify(page)
  await signup(page)
  await expect(page).toHaveURL(/#\/share\/bt\/f1$/)
  const shell = page.getByTestId('catalogue-backtest-shell')
  await expect(shell).toHaveAttribute('data-phase', 'ready')
  await expect(shell).toHaveAttribute('data-strategy-id', 'f1')
  await expect(shell).toHaveAttribute('data-period', '365')
  await expect(shell.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true })).toBeEnabled()
  await expect(page.getByTestId('common-backtest')).toHaveCount(0)
})

test('로그인된 직접검증의 실행 요청은 연결 플랜으로 이동하고 같은 백테스트로 돌아온다', async ({ page }) => {
  await open(page, true)
  await verify(page)
  const shell = page.getByTestId('catalogue-backtest-shell')
  await expect(shell).toHaveAttribute('data-phase', 'ready')
  await shell.getByRole('button', { name: '최근 3개월', exact: true }).click()
  await shell.getByRole('button', { name: '3,000', exact: true }).click()
  await shell.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await shell.getByRole('button', { name: '바로 결과 보기', exact: true }).click()
  await expect(shell).toHaveAttribute('data-phase', 'result')
  await shell.getByRole('button', { name: '이 전략 실행하기', exact: true }).click()
  await expect(page).toHaveURL(/#\/connect\/plan\?exchange=binance$/)
  expect(await page.evaluate(() => history.state.tethPlanCatalogue)).toEqual({ owner: email, id: 'f1', sourceSha: catalogueSourceSha, returnHash: '#/share/bt/f1' })
  await page.locator('.client-connection-plan').getByRole('button', { name: /뒤로/ }).first().click()
  await expect(page).toHaveURL(/#\/share\/bt\/f1$/)
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-period', '90')
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-amount', '3000')
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('teth-catalogue-copy-preview:') || k.includes('credentials')))).toEqual([])
})

test('비회원 백테스트 deep link는 계산·실행을 만들지 않고 별도 인증 진입을 제공한다', async ({ page }) => {
  await open(page, false, '#/share/bt/f1')
  await expect(page.getByTestId('catalogue-backtest-auth')).toBeVisible()
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveCount(0)
  await page.getByTestId('catalogue-backtest-auth').getByRole('button', { name: '로그인 또는 회원가입', exact: true }).click()
  await signup(page)
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-strategy-id', 'f1')
})
