import { expect, test, type Page } from '@playwright/test'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'
import { copyRecoveryText } from '../src/client-copy-recovery-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { copyActionText } from '../src/client-copy-trading-copy'
import { installOpenCopyObservation } from './fixtures/client-copy-open-observation'

const owner = 'uncertain-display@example.test', key = copyPreviewStorageKey(owner)
const source = sourceSharedStrategies()[0]
test.setTimeout(45_000)
async function start(page: Page, selected = source) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수자', email: owner })), owner)
  await page.goto('/' + sharedHash({ view: 'copy-setup', nick: selected.nick, period: 'all' }))
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(page.locator('.cpd-card')).toBeVisible()
}
async function failWrites(page: Page) {
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, value) {
      original.call(this, k, value)
      if (k === key) throw new Error('saved but confirmation unavailable')
    }
  }, key)
}
const read = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)

for (const width of [320, 1440]) test(`저장 불확실 ${width}px: 금액 숨김·입력 보존·읽기만 재시도`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await start(page)
  const before = await read(page)
  await page.locator('.cpd-card').getByRole('button', { name: '잔고 조정', exact: true }).click()
  const dialog = page.getByRole('dialog'), input = dialog.getByRole('textbox')
  await input.fill('50')
  await failWrites(page)
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  const after = await read(page)
  expect(after.spot).toBe(before.spot - 50)
  await expect(dialog.locator('.cpa-pnl b')).toHaveText('—')
  await expect(dialog.locator('.cps-bal b')).toHaveText('—')
  await expect(page.locator('.cpd > .cpd-sum .cpp-kpi b')).toHaveText(Array(6).fill('—'))
  await expect(input).toHaveValue('50')
  await expect(dialog.getByRole('button', { name: '최대', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: '확인', exact: true })).toBeDisabled()
  await expect(dialog.locator('h2')).toBeFocused()
  const inputNode = await input.elementHandle()
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as ClientLanguage[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    await expect(dialog.getByRole('button', { name: copyRecoveryText(language, '저장 상태 다시 확인'), exact: true })).toBeVisible()
    await expect(input).toHaveValue('50')
    await expect(input).toHaveAccessibleName(copyActionText(language, '조정 금액'))
    expect(await inputNode!.evaluate(el => el.isConnected)).toBe(true)
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('uncertain.png'), fullPage: true })
  // A second failed read must not unmount the dialog or erase its draft.
  await page.evaluate(key => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = function (k) { if (k === key) throw new Error('read denied'); return original.call(this, k) }
    Object.assign(window, { restoreCopyRead: () => { Storage.prototype.getItem = original } })
  }, key)
  await dialog.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(input).toHaveValue('50')
  await expect(dialog.locator('.cps-bal b')).toHaveText('—')
  await expect(dialog.locator('h2')).toBeFocused()
  await page.evaluate(() => (window as unknown as { restoreCopyRead: () => void }).restoreCopyRead())
  await dialog.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(input).toHaveValue('50')
  await expect(dialog.locator('h2')).toBeFocused()
  await expect(dialog.locator('.cps-bal b')).toHaveText(`${after.spot.toLocaleString('ko', { minimumFractionDigits: 2 })} USDT`)
  expect(await read(page)).toEqual(after)
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
})

for (const kind of ['close', 'flat'] as const) test(`상세 ${kind}: 불확실 정산·표·상태 숨김, 재확인 후 중복 실행 금지`, async ({ page }) => {
  if (kind === 'flat') {
    await installOpenCopyObservation(page, source)
  }
  await start(page)
  await page.locator('.cpd-card').getByRole('button', { name: '상세', exact: true }).click()
  await page.getByRole('button', { name: kind === 'close' ? '카피 종료' : '포지션 전체 정리', exact: true }).click()
  const dialog = page.getByRole('dialog'), submit = dialog.getByRole('button', { name: kind === 'close' ? '종료하고 정산' : '정리하기', exact: true })
  await failWrites(page)
  await submit.click()
  const after = await read(page)
  await expect(dialog.locator('.cpd-kv .cpp-kpi b')).toHaveText(['—', '—', '—'])
  await expect(page.locator('.cpx > .cpd-sum .cpp-kpi b')).toHaveText(Array(6).fill('—'))
  await expect(page.locator('.cpx .cpx-tbl')).toHaveCount(0)
  await expect(page.locator('.cpp-meta')).not.toContainText('카피 중')
  await expect(submit).toBeDisabled()
  await dialog.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(submit).toBeDisabled()
  await expect(dialog.locator('h2')).toBeFocused()
  expect(await read(page)).toEqual(after)
})

test('설정 열린 동안 같은 계정 저장 실패는 페어·상세 금액을 숨기고 복구 후 되돌린다', async ({ page }) => {
  await start(page)
  await page.locator('.cpd-card').getByRole('button', { name: '상세', exact: true }).click()
  await page.getByRole('button', { name: '설정', exact: true }).click()
  const dialog = page.getByRole('dialog'), before = await read(page)
  await failWrites(page)
  await page.evaluate(async key => {
    const path = '/src/client-copy-preview-store.ts'
    const result = (await import(path)).saveCopyPreviewState(JSON.parse(sessionStorage.getItem(key)!))
    if (result.ok) throw Error('failure was not injected')
  }, key)
  await expect(dialog.locator('.ss3-dialog-body > p b')).toHaveText('—')
  await expect(dialog.getByRole('button', { name: '잔고 조정 열기', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(dialog.locator('.ss3-dialog-body > p b')).toHaveText(before.copies[0].pairs.join(', '))
  expect(await read(page)).toEqual(before)
})

test('설정 충전 실패: 금액 초안 유지·최대값 차단·재확인은 충전을 반복하지 않는다', async ({ page }) => {
  await start(page)
  await page.evaluate(hash => { location.hash = hash }, sharedHash({ view: 'copy-setup', nick: source.nick, period: 'all' }))
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('99')
  await page.getByRole('button', { name: '스팟 충전', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const before = await read(page)
  await failWrites(page)
  await dialog.getByRole('button', { name: '+1,000 USDT 충전', exact: true }).click()
  const after = await read(page)
  expect(after.spot).toBe(before.spot + 1000)
  await expect(page.locator('.cps-form .cps-bal b')).toHaveText('—')
  await expect(page.locator('.cps-form .mx')).toBeDisabled()
  await expect(page.locator('.cps-form .cps-in input')).toHaveValue('99')
  await expect(dialog.locator('h2')).toBeFocused()
  await dialog.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  expect(await read(page)).toEqual(after)
  await expect(page.locator('.cps-form .cps-bal b')).toContainText('1,800.00')
})

test('입력 중 다른 reader의 readback 실패는 초점을 빼앗지 않고 금액만 숨긴다', async ({ page }) => {
  await start(page)
  await page.locator('.cpd-card').getByRole('button', { name: '잔고 조정', exact: true }).click()
  const dialog = page.getByRole('dialog'), input = dialog.getByRole('textbox')
  await input.fill('45.50')
  await input.focus()
  const before = await read(page)
  await page.evaluate(async key => {
    const state = JSON.parse(sessionStorage.getItem(key)!), original = Storage.prototype.getItem
    Storage.prototype.getItem = function (k) { if (k === key) throw Error('readback denied'); return original.call(this, k) }
    try {
      const path = '/src/client-copy-preview-store.ts'
      const result = (await import(path)).saveCopyPreviewState(state)
      if (result.ok || result.error !== 'readback-failed') throw Error('Expected readback failure')
    } finally { Storage.prototype.getItem = original }
  }, key)
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('45.50')
  await expect(dialog.locator('.cps-bal b')).toHaveText('—')
  await expect(dialog.getByRole('button', { name: '확인', exact: true })).toBeDisabled()
  await input.fill('46.50')
  await dialog.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(input).toHaveValue('46.50')
  await expect(dialog.locator('h2')).toBeFocused()
  expect(await read(page)).toEqual(before)
})
