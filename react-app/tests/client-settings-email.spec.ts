import { expect, test, type Page } from '@playwright/test'
import copy from '../src/client-settings-copy.json' with { type: 'json' }
import { nativeAccountText } from '../src/internal-poc/native-account-presentation-copy'
test.setTimeout(40_000)
const path = '/tests/fixtures/client-settings-identity.html'

async function open(page: Page) {
  await page.goto(`${path}#/settings/account`)
  await page.locator('[data-email-settings]').getByRole('button', { name: '변경', exact: true }).click()
  return page.locator('.client-settings-dialog')
}
async function send(page: Page, address = 'New.User@example.invalid') {
  const dialog = await open(page)
  await dialog.getByRole('textbox').fill(address)
  await dialog.getByRole('button', { name: '확인 번호 보내기', exact: true }).click()
  return dialog
}
async function deliver(page: Page, index = 0) {
  await page.evaluate(index => Reflect.get(window, 'emailResolve')(index), index)
  await expect(page.locator('.client-settings-dialog').getByRole('textbox', { name: '확인 번호', exact: true })).toBeFocused()
}

test('closing restores the original body overflow value and priority', async ({ page }) => {
  await page.addInitScript(() => addEventListener('DOMContentLoaded', () => document.body.style.setProperty('overflow', 'auto', 'important')))
  const dialog = await open(page)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual(['auto', 'important'])
})

test('source email change modal opens without a provider but never sends a fake code', async ({ page }) => {
  await page.goto(`${path}?unavailable#/settings/account`)
  const row = page.locator('[data-email-settings]')
  await row.getByRole('button', { name: '변경', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '이메일 변경', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '새 이메일', exact: true })).toBeFocused()
  await expect(dialog).toContainText('이 기능은 아직 연결되지 않았습니다')
  await expect(dialog.getByRole('button', { name: '확인 번호 보내기', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(row.getByRole('button', { name: '변경', exact: true })).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'emailCalls')())).toEqual([])
})

test('validation, composition and single send wait for a delivery capability', async ({ page }) => {
  const dialog = await open(page)
  const input = dialog.getByRole('textbox'), submit = dialog.getByRole('button', { name: '확인 번호 보내기', exact: true })
  for (const address of ['not-an-email', 'a@@example.invalid', 'a@b.c']) {
    await input.fill(address); await submit.click()
    await expect(input).toHaveAccessibleDescription(copy.emailInvalid.ko)
  }
  await input.fill('USER@example.invalid')
  await input.press('Enter')
  await expect(dialog.getByRole('alert')).toHaveText(copy.emailSame.ko)
  await input.fill('New.User@example.invalid')
  expect(await input.evaluate(el => !el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'emailCalls')())).toEqual([])
  await submit.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(submit).toBeDisabled()
  await expect(input).toHaveAttribute('readonly', '')
  await expect(dialog.getByRole('heading')).toHaveText(copy.emailChange.ko)
  await expect(dialog.getByRole('status')).toHaveText(copy.emailSending.ko)
  expect(await page.evaluate(() => Reflect.get(window, 'emailCalls')())).toEqual([{ kind: 'send', email: 'new.user@example.invalid', aborted: false }])
  await deliver(page)
  await expect(dialog.getByRole('heading')).toHaveText(copy.emailCodeTitle.ko)
  await expect(dialog).toContainText('new.user@example.invalid')
  await expect(dialog.getByRole('textbox')).toHaveAttribute('autocomplete', 'one-time-code')
  await expect(dialog.getByRole('textbox')).toHaveAttribute('inputmode', 'numeric')
})

test('send failure retains address, raw errors stay private and retry can proceed', async ({ page }) => {
  const dialog = await send(page)
  await page.evaluate(() => Reflect.get(window, 'emailReject')())
  await expect(dialog.getByRole('alert')).toHaveText(copy.emailSendFailed.ko)
  await expect(dialog.getByRole('textbox')).toHaveValue('New.User@example.invalid')
  await expect(page.locator('body')).not.toContainText('DO_NOT_EXPOSE_RAW_ERROR')
  await dialog.getByRole('button', { name: '확인 번호 보내기', exact: true }).click()
  await deliver(page, 1)
})

test('verification is host controlled, failure clears code, completion never invents profile email', async ({ page }) => {
  const dialog = await send(page)
  await deliver(page)
  const input = dialog.getByRole('textbox'), submit = dialog.getByRole('button', { name: '이메일 변경', exact: true })
  await input.fill('12'); await submit.click()
  await expect(dialog.getByRole('alert')).toHaveText(copy.emailCodeInvalid.ko)
  // Unlike the original mock, there is no hardcoded successful or failed code.
  await input.fill('000000')
  await submit.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(submit).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'emailCalls')())).toEqual([
    { kind: 'send', email: 'new.user@example.invalid', aborted: false },
    { kind: 'verify', email: 'new.user@example.invalid', codeLength: 6, aborted: false },
  ])
  await page.evaluate(() => Reflect.get(window, 'emailReject')(1))
  await expect(dialog.getByRole('alert')).toHaveText(copy.emailVerifyFailed.ko)
  await expect(input).toHaveValue('')
  await expect(page.locator('body')).not.toContainText('DO_NOT_EXPOSE_RAW_ERROR')
  await input.fill('123456'); await input.press('Enter')
  await page.evaluate(() => Reflect.get(window, 'emailResolve')(2))
  await expect(dialog).toHaveCount(0)
  const row = page.locator('[data-email-settings]')
  await expect(row).toContainText('user@example.invalid')
  await expect(page.locator('.client-settings-page').getByRole('status')).toHaveText(nativeAccountText('ko', 'accepted'))
  await expect(row.getByRole('button')).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'identitySetProfile')({ name: '김투자', handle: 'investor', email: 'new.user@example.invalid' }))
  await expect(row).toContainText('new.user@example.invalid')
})

test('returning to the address invalidates the old verifier and ignores its late completion', async ({ page }) => {
  const dialog = await send(page)
  await deliver(page)
  await dialog.getByRole('textbox').fill('123456'); await dialog.getByRole('textbox').press('Enter')
  await dialog.getByRole('button', { name: '주소 다시 입력', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: '새 이메일', exact: true })).toBeFocused()
  await expect(dialog.getByRole('textbox')).toHaveValue('new.user@example.invalid')
  await page.evaluate(() => Reflect.get(window, 'emailResolve')(1))
  await expect(dialog.getByRole('heading')).toHaveText(copy.emailChange.ko)
  await expect(dialog.getByRole('status')).toHaveCount(0)
  await dialog.getByRole('textbox').fill('different@example.invalid')
  await dialog.getByRole('textbox').press('Enter')
  await deliver(page, 2)
  await expect(dialog.getByRole('textbox')).toHaveValue('')
  await expect(dialog).toContainText('different@example.invalid')
  const calls = await page.evaluate(() => Reflect.get(window, 'emailCalls')())
  expect(calls[1].aborted).toBe(true)
  expect(calls[2].email).toBe('different@example.invalid')
})

for (const phase of ['send', 'verify'] as const) for (const boundary of ['close', 'owner', 'dataset', 'email', 'tab', 'port'] as const) for (const settle of ['resolve', 'reject'] as const) {
  test(`${phase} pending ${settle} is discarded on ${boundary}`, async ({ page }) => {
    const dialog = await send(page)
    const index = phase === 'send' ? 0 : 1
    if (phase === 'verify') {
      await deliver(page)
      await dialog.getByRole('textbox').fill('123456'); await dialog.getByRole('textbox').press('Enter')
    }
    if (boundary === 'close') await page.keyboard.press('Escape')
    if (boundary === 'owner') await page.evaluate(() => Reflect.get(window, 'identitySetOwner')('owner-b'))
    if (boundary === 'dataset') await page.evaluate(() => Reflect.get(window, 'identitySetDataset')('dataset-b'))
    if (boundary === 'email') await page.evaluate(() => Reflect.get(window, 'identitySetProfile')({ name: '김투자', handle: 'investor', email: 'updated@example.invalid' }))
    if (boundary === 'tab') await page.evaluate(() => { location.hash = '#/settings/general' })
    if (boundary === 'port') await page.evaluate(() => Reflect.get(window, 'identitySetEnabled')(false))
    await expect.poll(() => page.evaluate(index => Reflect.get(window, 'emailCalls')()[index].aborted, index)).toBe(true)
    await page.evaluate(({index,settle}) => Reflect.get(window, settle === 'resolve' ? 'emailResolve' : 'emailReject')(index), {index,settle})
    if (boundary === 'port') {
      await expect(dialog.getByRole('heading')).toHaveText(copy.emailChange.ko)
      await expect(dialog.getByRole('button', { name: '확인 번호 보내기', exact: true })).toBeDisabled()
      await expect(dialog).toContainText(copy.actionUnavailable.ko)
      await page.keyboard.press('Escape')
    }
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.client-settings-page').getByRole('status')).toHaveCount(0)
    await expect(page.locator('.client-settings-page').getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  })
}

test('modal keeps focus inside, handles real backdrop clicks and does not dismiss on dragged selections', async ({ page }) => {
  const dialog = await open(page)
  const input = dialog.getByRole('textbox')
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  }
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  }
  await input.focus()
  const box = (await input.boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down()
  await page.mouse.move(2, 2); await page.mouse.up()
  await expect(dialog).toBeVisible()
  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
  for (const width of [320, 1440]) test(`${language} email modal ${width}px preserves source hierarchy and wraps long addresses`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
    await page.goto(`${path}#/settings/account`)
    await page.locator('[data-email-settings]').getByRole('button', { name: copy.change[language], exact: true }).click()
    const dialog = page.locator('.client-settings-dialog')
    await expect(dialog.getByRole('heading')).toHaveText(copy.emailChange[language])
    await dialog.getByRole('textbox').fill(`${'longaddress'.repeat(6)}@example.invalid`)
    await dialog.getByRole('textbox').press('Enter')
    await page.evaluate(() => Reflect.get(window, 'emailResolve')())
    await expect(dialog.getByRole('heading')).toHaveText(copy.emailCodeTitle[language])
    await dialog.getByRole('textbox').press('Enter')
    await expect(dialog.getByRole('alert')).toHaveText(copy.emailCodeInvalid[language])
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    for (const node of await dialog.locator('h2,p,button').all()) expect(await node.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    const rect = (await dialog.boundingBox())!
    expect(rect.x).toBeGreaterThanOrEqual(15)
    expect(rect.x + rect.width).toBeLessThanOrEqual(width - 15)
    for (const button of await dialog.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(width === 320 ? 44 : 40)
    if (width === 320) expect(await dialog.getByRole('textbox').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    if (language === 'ko' || language === 'fr') await page.screenshot({ path: info.outputPath(`email-${language}-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
}

test('short visual viewport keeps the dialog inside the keyboard-safe area', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addInitScript(() => {
    const viewport = new EventTarget()
    Object.assign(viewport, { height: 290, offsetTop: 48 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  })
  const dialog = await open(page)
  const rect = (await dialog.boundingBox())!
  expect(rect.y).toBeGreaterThanOrEqual(48 + 15)
  expect(rect.y + rect.height).toBeLessThanOrEqual(48 + 290 - 15)
  const submit = dialog.getByRole('button', { name: '확인 번호 보내기', exact: true })
  await submit.click()
  await expect(dialog.getByRole('alert')).toHaveText(copy.emailInvalid.ko)
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})
