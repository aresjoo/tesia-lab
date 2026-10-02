import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { copyRecoveryText } from '../src/client-copy-recovery-copy'
import { copyPreviewStorageKey, copyPreviewStoreErrorMessage, type CopyPreviewStoreError } from '../src/client-copy-preview-store'
import { sourceSharedStrategies, sharedHash } from '../src/client-shared-strategies'
import { copyProfileText } from '../src/client-copy-profile-copy'
import { sharingActionFailed } from '../src/client-sharing-presentation'
import type { ClientLanguage } from '../src/client-preferences'

const languages: ClientLanguage[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']
const owner = 'copy-recovery-locale@example.test', key = copyPreviewStorageKey(owner)
const raw = ' {"broken":"preserve exact bytes 한글",\n'
const seed = sourceSharedStrategies()[0]
async function language(page: Page, lang: ClientLanguage) {
  await page.evaluate(lang => {
    localStorage.setItem('tethLang', lang)
    localStorage.setItem('tethCurrency', 'KRW')
    window.dispatchEvent(new StorageEvent('storage', { key: 'tethLang', newValue: lang, storageArea: localStorage }))
  }, lang)
}
test('저장 8종·복구 11종·예외 안내 모두 7언어에 연결하고 미지 문구는 보존한다', () => {
  const messages = [...readFileSync('src/client-copy-preview-recovery.ts', 'utf8').matchAll(/^ {2}'[\w-]+': '([^']+)'/gm)].map(match => match[1])
  expect(messages).toHaveLength(11)
  const codes: CopyPreviewStoreError[] = ['owner-required', 'invalid-owner', 'invalid-state', 'owner-mismatch', 'storage-unavailable', 'read-failed', 'write-failed', 'readback-failed']
  messages.push(...codes.map(copyPreviewStoreErrorMessage), '복구 요청을 만들지 못했어요. 저장 상태를 다시 확인해주세요.')
  for (const lang of languages) for (const message of messages) {
    const translated = copyRecoveryText(lang, message)
    if (lang === 'ko') expect(translated).toBe(message)
    else { expect(translated.length).toBeGreaterThan(5); expect(translated).not.toMatch(/[가-힣]|undefined/) }
  }
  for (const lang of languages) expect(copyRecoveryText(lang, '<unknown> 사용자 문구')).toBe('<unknown> 사용자 문구')
  expect(copyRecoveryText('en', messages.find(value => value.startsWith('초기화 결과'))!)).toContain('could not be verified')
})

for (const width of [320, 1440]) test(`${width}px 복구 언어 변경: 동일 확인창·초점·원문 유지, 명시 사본 확인 뒤 초기화`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, key, raw }) => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복구 검수자', email: owner }))
    sessionStorage.setItem(key, raw)
  }, { owner, key, raw })
  await page.goto(`/${sharedHash({ view: 'copy-setup', nick: seed.nick, period: 'all' })}`)
  const banner = page.locator('.copy-storage-error'), dialog = page.getByRole('dialog')
  await banner.getByRole('button', { name: '사본 보관 후 새로 시작', exact: true }).click()
  const element = await dialog.elementHandle()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('teth-copy-preview-recovery:')) throw new Error('fixture archive denied')
      return original.call(this, key, value)
    }
    Object.assign(window, { restoreArchive: () => { Storage.prototype.setItem = original } })
  })
  await dialog.getByRole('button', { name: '사본 보관하고 초기화', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: '취소', exact: true }).focus()
  for (const lang of languages) {
    await language(page, lang)
    const text = (value: string) => copyRecoveryText(lang, value)
    await expect(dialog).toHaveAccessibleName(text('카피 미리보기를 새로 시작할까요?'))
    await expect(dialog.getByRole('button', { name: text('취소'), exact: true })).toBeFocused()
    await expect(dialog.getByRole('alert')).toHaveText(text('기존 미리보기의 사본 저장을 확인하지 못해 초기화하지 않았어요. 원본은 그대로 남아 있어요.'))
    await expect(banner.locator('span')).toHaveText(text(copyPreviewStoreErrorMessage('invalid-state')))
    expect(await element!.evaluate(node => node.isConnected)).toBe(true)
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth-copy-preview-recovery:')))).toEqual([])
    if (lang !== 'ko') { expect(await dialog.innerText()).not.toMatch(/[가-힣]/); expect(await banner.innerText()).not.toMatch(/[가-힣]/) }
    const bounds = await dialog.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, width: innerWidth }))
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1)
    expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(bounds.width)
    if (lang === 'fr') await page.screenshot({ path: `/tmp/teth-copy-recovery-fr-${width}.png` })
  }
  await page.keyboard.press('Escape')
  await expect(banner.getByRole('button', { name: '사본 보관 후 새로 시작', exact: true })).toBeFocused()
  await page.evaluate(() => (window as unknown as { restoreArchive: () => void }).restoreArchive())
  await language(page, 'fr')
  await banner.getByRole('button', { name: copyRecoveryText('fr', '사본 보관 후 새로 시작'), exact: true }).click()
  await dialog.getByRole('button', { name: copyRecoveryText('fr', '사본 보관하고 초기화'), exact: true }).click()
  await expect(dialog).toHaveCount(0); await expect(banner).toHaveCount(0)
  await expect(page.locator('#research-title')).toBeFocused()
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth-copy-preview-recovery:')).map(key => sessionStorage.getItem(key)))).toEqual([raw])
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)).toEqual({ v: 1, owner, spot: 1000, copies: [] })
})

type Harness = { calls: number; logins: number; reject: (message?: string) => void; resolve: () => void; tab: () => void; other: () => void; guest: () => void; throwing: () => void }
async function fixture(page: Page) {
  await page.route('**/copy-analysis-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="client-strategy-sharing"><main id="fixture"></main></body></html>' }))
  await page.goto('/copy-analysis-fixture.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCopyTrading.tsx', dp = '/@id/react-dom/client', sp = '/src/client-shared-strategies.ts'
    const transformed = await (await fetch(cp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const component = await import(/* @vite-ignore */ cp), shared = await import(/* @vite-ignore */ sp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const sources = shared.sourceSharedStrategies(), noop = () => {}
    const controls: Harness = { calls: 0, logins: 0, reject: noop, resolve: noop, tab: noop, other: noop, guest: noop, throwing: noop }
    const props = { location: shared.copyTraderLocation(sources[0].nick), account: { state: null }, sources, navigate: (location: unknown) => { Object.assign(props, { location }); render() }, Dialog: () => null, onStartGate: () => true, onFollow: noop, watching: () => false, onWatch: noop, signedIn: true, onLogin: () => { controls.logins++ }, onAsk: () => {
      controls.calls++
      return new Promise<void>((resolve, reject) => { controls.resolve = resolve; controls.reject = message => reject(message === undefined ? null : new Error(message)) })
    } }
    // Match the production parent key: tabs share a lifetime; trader/owner changes do not.
    const render = () => root.render(react.createElement(react.StrictMode, null, react.createElement(component.ClientCopyTrading, { ...props, key: JSON.stringify([props.signedIn, props.location.view, props.location.nick, props.location.copyId]) })))
    controls.tab = () => { props.location = { ...props.location, profileTab: 'pos' }; render() }
    controls.other = () => { props.location = shared.copyTraderLocation(sources[1].nick); render() }
    controls.guest = () => { props.signedIn = false; render() }
    controls.throwing = () => { props.onAsk = () => { controls.calls++; throw new Error('') }; render() }
    Object.assign(window, { analysis: controls }); render()
  })
  await expect(page.locator('.cpp-chips button.obtn')).toBeVisible()
}

test('분석 요청 중 연속 클릭·탭·언어 변경은 중복 요청 없이 유지하고 실패 뒤 재시도한다', async ({ page }) => {
  await fixture(page)
  const button = page.locator('.cpp-chips button.obtn')
  await button.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(button).toBeDisabled(); await expect(button).toHaveAttribute('aria-busy', 'true')
  expect(await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.calls)).toBe(1)
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.tab())
  for (const lang of languages) {
    await language(page, lang)
    await expect(button).toHaveText(copyProfileText(lang, '이 트레이더의 위험 신호 분석시키기'))
    await expect(button).toBeDisabled()
  }
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.reject())
  await expect(button).toBeEnabled()
  for (const lang of languages) {
    await language(page, lang)
    await expect(page.getByRole('alert')).toHaveText(sharingActionFailed(lang))
  }
  await button.click(); await expect(page.getByRole('alert')).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.resolve())
  await expect(button).toBeEnabled(); await expect(button).toHaveAttribute('aria-busy', 'false')
  expect(await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.calls)).toBe(2)
})

test('다른 트레이더 이동 후 이전 실패 격리·빈 동기 오류 fallback·게스트 로그인 경계', async ({ page }) => {
  await fixture(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const button = page.locator('.cpp-chips button.obtn')
  await button.click()
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.other())
  await expect(button).toBeEnabled()
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.reject('old trader failure'))
  await expect(page.getByRole('alert')).toHaveCount(0)
  await button.click()
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.reject('<b>source message</b>'))
  await expect(page.getByRole('alert')).toHaveText(sharingActionFailed('ko'))
  await expect(page.getByRole('alert')).not.toContainText('source message')
  await expect(page.getByRole('alert').locator('b')).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.throwing())
  await language(page, 'en'); await button.click()
  await expect(page.getByRole('alert')).toHaveText(sharingActionFailed('en'))
  await expect(button).toBeEnabled()
  await page.evaluate(() => (window as unknown as { analysis: Harness }).analysis.guest())
  await button.click()
  expect(await page.evaluate(() => { const a = (window as unknown as { analysis: Harness }).analysis; return [a.calls, a.logins] })).toEqual([3, 1])
  expect(errors).toEqual([])
})
