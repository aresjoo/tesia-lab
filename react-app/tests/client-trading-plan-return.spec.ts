import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { revealSourceNavigation } from './fixtures/source-offline-research-entry'

// The source plan has no Back button. These cases cover the React-added Back
// control, not a new trading/account permission or a source-copy requirement.
const owner = 'terminal-return@example.test'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const calculation = evaluateDelegation(parameters, 5_000_000)
const records = ['BTC', 'ETH'].map((asset, index) => ({ sessionId: `return-fixture-${index}`, record: {
  id: String(1100 + index), createdAt: 1100 + index, name: `${asset} 복귀 검수 전략`, parameters,
  score: calculation.score, ret: calculation.result.ret, mdd: calculation.result.mdd,
  n: calculation.result.n, winRate: calculation.result.winRate, status: 'off', environment: 'paper',
  asset, exchangeId: 'okx', exchangeName: 'OKX', capital: 5_000_000, version: 'v3.7',
} }))

async function seed(page: Page) {
  await page.addInitScript(({ owner, records }) => {
    if (sessionStorage.getItem('terminal-return-seeded')) return
    sessionStorage.setItem('terminal-return-seeded', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복귀 검수', email: owner }))
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify(records))
  }, { owner, records })
}

async function enterPlan(page: Page) {
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await page.getByRole('button', { name: '거래소 연결하기', exact: true }).click()
  await expect(page.getByTestId('connection-plan')).toHaveAttribute('data-step', 'plan')
}

async function back(page: Page) {
  const button = page.getByTestId('connection-plan').getByRole('button', { name: '뒤로', exact: true })
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeInViewport()
  expect(await button.evaluate(element => {
    const r = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
  })).toBe(true)
  await button.click()
}

for (const width of [320, 390, 1440]) test(`terminal plan Back preserves selection, period and history at ${width}×360`, async ({ page }, info) => {
  const mutations: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  await seed(page)
  await page.setViewportSize({ width, height: 360 })
  await page.goto('/#/trade')
  await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  await page.getByRole('tab', { name: '판단', exact: true }).click()
  await page.locator('.ctt-selector-button').click()
  await page.locator('.tft-select').filter({ hasText: records[0].record.name }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1100')
  await page.getByRole('tab', { name: '데이터', exact: true }).click()
  await page.locator('.ctm-periods button').last().click()
  const period = await page.locator('.ctm-periods button[aria-pressed="true"]').innerText()
  const selected = await page.locator('.client-account-terminal').getAttribute('data-selected-strategy')
  await page.keyboard.press('Escape')
  await page.locator('.client-account-terminal').evaluate(element => element.setAttribute('data-return-mount', 'retained'))
  await enterPlan(page)
  await back(page)
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-return-mount', 'retained')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', selected!)
  await expect(page.locator('.ctm-periods button[aria-pressed="true"]')).toHaveText(period)
  await page.goBack()
  await expect(page.getByTestId('connection-plan')).toBeVisible()
  await page.goForward()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await enterPlan(page)
  const plan = page.getByTestId('connection-plan')
  await plan.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await plan.getByRole('button', { name: 'OKX', exact: true }).click()
  await plan.getByRole('button', { name: '기존 초대 계정 연결', exact: true }).click()
  await expect(plan).toHaveAttribute('data-step', 'authorize')
  await expect(plan.getByRole('button', { name: 'OKX에서 승인하기', exact: true })).toBeDisabled()
  for (const step of ['account', 'free', 'plan']) {
    await back(page)
    await expect(plan).toHaveAttribute('data-step', step)
  }
  await back(page)
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-return-mount', 'retained')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', selected!)
  await expect(page.locator('.ctm-periods button[aria-pressed="true"]')).toHaveText(period)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[hidden],[inert]')))).toBe(false)
  await page.screenshot({ path: `/tmp/teth-terminal-plan-return-${info.project.name}-${width}.png` })
  expect(mutations).toEqual([])
})

test('direct plan and a fresh document never claim a prior terminal return', async ({ page }) => {
  await seed(page)
  await page.goto('/#/connect/plan?exchange=bitget')
  await back(page)
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await page.goto('/#/trade')
  await enterPlan(page)
  await page.reload()
  await back(page)
  await expect(page.locator('#strategy-idea')).toBeVisible()
})

test('logout invalidates terminal history and failed guest auth does not revive it', async ({ page }) => {
  await seed(page)
  await page.goto('/#/trade')
  await enterPlan(page)
  await revealSourceNavigation(page)
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await page.locator('.client-sidebar [data-sidebar-action="profile-settings"]').click()
  await page.locator('.ca-settings').getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await page.goBack()
  const plan = page.getByTestId('connection-plan')
  await expect(plan).toBeVisible()
  await plan.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.keyboard.press('Escape')
  await back(page)
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await expect(page.locator('.client-main-terminal')).toHaveCount(0)
  // Explicit local preview signup with the same owner is not real provider
  // authentication. The old navigation token must remain revoked afterward.
  await page.goBack()
  await plan.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  const dialog = page.locator('.ca-auth')
  await dialog.locator('input[type=email]').fill('invalid')
  await dialog.locator('button[type=submit]').click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.locator('input[type=email]').fill(owner)
  await dialog.locator('button[type=submit]').click()
  await dialog.locator('input[autocomplete=new-password]').fill('Mock-password-123!')
  await dialog.locator('button[type=submit]').click()
  await dialog.locator('input[autocomplete=one-time-code]').fill('123456')
  await dialog.locator('button[type=submit]').click()
  await dialog.getByLabel('연령', { exact: true }).fill('28')
  await dialog.getByRole('button', { name: '시장에 입장하기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(plan).toHaveAttribute('data-step', 'free')
  await back(page)
  await back(page)
  await expect(page.locator('#strategy-idea')).toBeVisible()
})

test('a different owner cannot consume another account terminal origin', async ({ page }) => {
  await seed(page)
  await page.goto('/#/trade')
  await enterPlan(page)
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: 'other@example.test' })))
  await page.reload()
  await back(page)
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await expect(page.locator('.client-main-terminal')).toHaveCount(0)
})

test('mismatched owner or lifetime token cannot redirect plan Back', async ({ page }) => {
  await seed(page)
  for (const field of ['owner', 'token']) {
    await page.goto('/#/trade')
    await enterPlan(page)
    await page.evaluate(field => {
      const value = history.state?.tethPlanTerminal
      if (!value) throw Error('Expected a real terminal-origin plan entry')
      history.replaceState({ ...history.state, tethPlanTerminal: { ...value, [field]: 'unrelated' } }, '', location.href)
    }, field)
    await back(page)
    await expect(page.locator('#strategy-idea')).toBeVisible()
  }
})
