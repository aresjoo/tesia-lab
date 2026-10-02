import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'

// Isolated presentation seam, not a server/session/approval acceptance test.
// Fixed source9fb keeps Insights in the real account menu, outside the sidebar IA.
// Consume actual source controls; never replace service state, handlers or ports.
async function sourceInsightEntry(page: Page) {
  // Guest drawer order is login→settings; the desktop rail reverses it.
  // Choose the settings action itself, never the anonymous login action.
  const settings = page.locator('[data-sidebar-action="settings"]')
  const trigger = await settings.count() ? settings : page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]').first()
  if (!await trigger.isVisible()) {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  }
  await trigger.click()
  const entry = page.locator('.ca-settings [data-menu-action="insight"]')
  await expect(entry).toBeVisible()
  return entry
}

async function mount(page: Page, mode: 'throw' | 'reject' | 'held') {
  await page.route('**/reset-presentation-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="reset-test-root"></div></body></html>' }))
  await page.goto('/reset-presentation-test.html')
  await page.evaluate(async mode => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ cp)
    const onReset = () => {
      if (mode === 'throw') throw new Error('SYNTHETIC_RESET_FAILURE')
      if (mode === 'reject') return Promise.reject(new Error('SYNTHETIC_RESET_FAILURE'))
      return new Promise<boolean>((resolve, reject) => Object.assign(window, { settleReset: resolve, rejectReset: () => reject(new Error('SYNTHETIC_LATE_RESET_FAILURE')) }))
    }
    function Host() {
      const [input, setInput] = react.useState('')
      return react.createElement(ClientServiceExperience, { nativeAccounts: true, accountScope: 'reset-fixture-owner', state: {
        phase: 'ready', sessionState: 'AUTHENTICATED', messages: [], input, busy: false, inputDisabled: false,
        source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
        onInput: setInput, onSend: async () => {}, onReset, onRecover: undefined, onLogout: undefined,
      } })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('reset-test-root')).render(react.createElement(Host))
  }, mode)
  await expect(page.locator('#strategy-idea')).toBeVisible()
}

async function reset(page: Page) {
  const compact = page.locator('.client-rail-new-row button')
  if (await compact.isVisible()) await compact.click()
  else {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger').click()
    await page.locator('.client-new-strategy').click()
  }
}

for (const accepted of [false, true]) test(`푸터 새 전략의 수락=${accepted}는 입력창 복귀와 초점을 구별한다`, async ({ page }) => {
  await mount(page, 'held')
  await page.locator('#strategy-idea').fill('공급자가 보존한 초안')
  const footer = page.locator('.client-site-footer')
  await footer.getByRole('button', { name: '인사이트', exact: true }).click()
  await expect(page.locator('.client-insights h1')).toBeVisible()
  await footer.getByRole('button', { name: '새 전략 만들기', exact: true }).click()
  await page.evaluate(accepted => (window as unknown as { settleReset: (value: boolean) => void }).settleReset(accepted), accepted)
  const input = page.locator('#strategy-idea')
  await expect(input).toHaveValue('공급자가 보존한 초안')
  if (accepted) {
    await expect(input).toBeFocused()
    await expect(input).toBeInViewport()
    await expect(page).not.toHaveURL(/#\/insight/)
  } else {
    await expect(page.locator('.client-insights h1')).toBeVisible()
    await expect(input).not.toBeFocused()
    await expect(page).toHaveURL(/#\/insight/)
  }
})

for (const mode of ['throw', 'reject'] as const) test(`reset ${mode}는 처리되지 않은 예외 없이 입력·선택을 보존하고 안내한다`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, mode)
  const btc = page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'BTC', exact: true })
  await btc.click()
  await page.locator('#strategy-idea').fill('초안 보존')
  await reset(page)
  await expect(page.locator('.client-global-notice')).toContainText('요청을 완료하지 못했습니다. 다시 시도해주세요.')
  await expect(btc).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#strategy-idea')).toHaveValue('초안 보존')
  expect(errors).toEqual([])
})

for (const accepted of [false, true]) for (const changed of [false, true]) test(`reset 수락=${accepted} 후 템플릿 은퇴는 후속 선택 변경=${changed}을 구별한다`, async ({ page }) => {
  await mount(page, 'held')
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  const btc = gallery.getByRole('button', { name: 'BTC', exact: true })
  await btc.click(); await reset(page)
  if (changed) await gallery.getByRole('button', { name: 'ETH', exact: true }).click()
  else await page.locator('#strategy-idea').press('Tab')
  await page.evaluate(accepted => (window as unknown as { settleReset: (value: boolean) => void }).settleReset(accepted), accepted)
  await expect(btc).toHaveAttribute('aria-pressed', String(changed || !accepted))
  await expect(gallery.getByRole('button', { name: 'ETH', exact: true })).toHaveAttribute('aria-pressed', String(changed))
})

for (const completion of ['reject', 'accept'] as const) test(`다른 화면 진입 뒤 늦은 reset ${completion}는 현재 화면과 초점을 빼앗지 않는다`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, 'held')
  await page.locator('#strategy-idea').fill('늦은 실패에도 유지')
  await reset(page)
  const entry = await sourceInsightEntry(page)
  await entry.click()
  const heading = page.locator('.client-insights h1')
  await expect(heading).toBeFocused()
  await page.evaluate(async completion => {
    const controls = window as unknown as { rejectReset: () => void; settleReset: (value: boolean) => void }
    if (completion === 'reject') controls.rejectReset()
    else controls.settleReset(true)
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  }, completion)
  await expect(heading).toBeFocused()
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await expect(page.locator('#strategy-idea')).toHaveValue('늦은 실패에도 유지')
  expect(errors).toEqual([])
})
