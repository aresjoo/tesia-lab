import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'

// Presentation-only owner replacement: real shell, controlled callback promise.
// This does not authenticate an account or certify an API/session transition.
async function mount(page: Page) {
  const writes: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    writes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
    return route.abort()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/reset-owner-rejection.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.goto('/reset-owner-rejection.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const shellPath = '/src/internal-poc/ClientServiceExperience.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(shellPath)).text(), reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ reactPath), react = reactModule.default ?? reactModule
    const dom = await import(/* @vite-ignore */ domPath), { ClientServiceExperience } = await import(/* @vite-ignore */ shellPath)
    const audit = { resets: 0, sends: 0, owner: '', sessionState: '' }
    Object.assign(window, { resetOwnerAudit: audit })
    function Host() {
      const [owner, setOwner] = react.useState('reset-owner-a'), [input, setInput] = react.useState('')
      const [sessionState, setSessionState] = react.useState('AUTHENTICATED')
      audit.owner = owner; audit.sessionState = sessionState
      Object.assign(window, { replaceResetOwner: (value = 'reset-owner-b') => setOwner(value), replaceResetState: () => setSessionState('ANONYMOUS') })
      return react.createElement(ClientServiceExperience, {
        nativeAccounts: true, accountScope: owner,
        state: { phase: 'ready', sessionState, messages: [], input, inputDisabled: false, busy: false,
          source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: setInput, onSend: async () => { audit.sends++ },
          onReset: () => {
            audit.resets++
            return new Promise<boolean>((resolve, reject) => Object.assign(window, { resolveOldReset: () => resolve(true), rejectOldReset: () => reject(new Error('PRIVATE_OLD_OWNER_FAILURE')) }))
          },
        },
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(Host))
  })
  await expect(page.locator('#strategy-idea')).toBeVisible()
  return { writes, errors }
}

async function startReset(page: Page) {
  const compact = page.locator('.client-rail-new-row button')
  if (await compact.isVisible()) await compact.click()
  else {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger').click()
    await page.locator('.client-new-strategy').click()
  }
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'resetOwnerAudit').resets)).toBe(1)
}

type Boundary = 'same-owner' | 'owner' | 'session-state' | 'owner-roundtrip'
async function replaceBoundary(page: Page, boundary: Boundary) {
  if (boundary === 'session-state') {
    await page.evaluate(() => Reflect.get(window, 'replaceResetState')())
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'resetOwnerAudit').sessionState)).toBe('ANONYMOUS')
  } else if (boundary === 'owner' || boundary === 'owner-roundtrip') {
    await page.evaluate(() => Reflect.get(window, 'replaceResetOwner')())
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'resetOwnerAudit').owner)).toBe('reset-owner-b')
    if (boundary === 'owner-roundtrip') {
      await page.evaluate(() => Reflect.get(window, 'replaceResetOwner')('reset-owner-a'))
      await expect.poll(() => page.evaluate(() => Reflect.get(window, 'resetOwnerAudit').owner)).toBe('reset-owner-a')
    }
  }
}
const expectedAudit = (boundary: Boundary) => ({ resets: 1, sends: 0,
  owner: boundary === 'owner' ? 'reset-owner-b' : 'reset-owner-a', sessionState: boundary === 'session-state' ? 'ANONYMOUS' : 'AUTHENTICATED' })
const boundaries: Boundary[] = ['same-owner', 'owner', 'session-state', 'owner-roundtrip']

for (const boundary of boundaries) test(`reset 늦은 거절: ${boundary}의 안내 범위를 지킨다`, async ({ page }, info) => {
  const state = await mount(page)
  await startReset(page)
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  // Supplied owner/auth changes, with no click/keyboard intent to mask the race.
  await replaceBoundary(page, boundary)
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await page.evaluate(async () => {
    Reflect.get(window, 'rejectOldReset')()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  const notice = page.locator('.client-global-notice')
  await info.attach('owner-rejection-observation', {
    body: JSON.stringify(await page.evaluate(() => ({ audit: Reflect.get(window, 'resetOwnerAudit'),
      notices: [...document.querySelectorAll('.client-global-notice')].map(node => node.textContent),
      active: document.activeElement?.tagName }))), contentType: 'application/json',
  })
  await page.screenshot({ path: info.outputPath('owner-rejection.png') })
  expect(state.writes).toEqual([])
  expect(state.errors).toEqual([])
  expect(await page.evaluate(() => Reflect.get(window, 'resetOwnerAudit'))).toEqual(expectedAudit(boundary))
  await expect(page.locator('body')).not.toContainText('PRIVATE_OLD_OWNER_FAILURE')
  if (boundary !== 'same-owner') await expect(notice).toHaveCount(0)
  else await expect(notice).toContainText('요청을 완료하지 못했습니다. 다시 시도해주세요.')
})

for (const boundary of boundaries) test(`reset 늦은 수락: ${boundary} 이후 템플릿·초안·초점을 보존한다`, async ({ page }, info) => {
  const state = await mount(page)
  const gallery = page.getByRole('region', { name: '투자 템플릿', exact: true })
  const btc = gallery.getByRole('button', { name: 'BTC', exact: true })
  const eth = gallery.getByRole('button', { name: 'ETH', exact: true })
  const input = page.locator('#strategy-idea')
  await btc.click()
  await expect(btc).toHaveAttribute('aria-pressed', 'true')
  await startReset(page)
  await replaceBoundary(page, boundary)
  if (boundary !== 'same-owner') {
    await expect(btc).toHaveAttribute('aria-pressed', 'false')
    await eth.click()
    await expect(eth).toHaveAttribute('aria-pressed', 'true')
  }
  await input.fill('현재 사용자의 미전송 초안')
  const originalInput = await input.elementHandle(), originalEth = await eth.elementHandle()
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  await page.evaluate(async () => {
    Reflect.get(window, 'resolveOldReset')()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  // Same-owner acceptance retires the captured selection even after typing;
  // a replaced boundary owns its new selection, not the old reset callback.
  await expect(btc).toHaveAttribute('aria-pressed', 'false')
  await expect(eth).toHaveAttribute('aria-pressed', String(boundary !== 'same-owner'))
  await expect(input).toHaveValue('현재 사용자의 미전송 초안')
  await expect(input).toBeFocused()
  expect(await input.evaluate((node, old) => node === old, originalInput)).toBe(true)
  expect(await eth.evaluate((node, old) => node === old, originalEth)).toBe(true)
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storage)
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'resetOwnerAudit'))).toEqual(expectedAudit(boundary))
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([])
  await page.screenshot({ path: info.outputPath('owner-acceptance.png') })
})
