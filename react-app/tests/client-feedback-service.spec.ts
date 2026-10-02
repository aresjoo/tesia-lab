import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'retain-on-failure', video: 'off' })
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=', 'base64')
type Controls = {
  feedbackRender: (scope?: string, supplied?: boolean, visible?: boolean) => void
  feedbackSettle: (index: number, failed?: boolean) => void
  feedbackCalls: { message: string; file: { name: string; type: string; size: number; isFile: boolean } | null }[]
  feedbackRevoked: string[]
}
async function mount(page: Page, supplied = true, scope: string | undefined = 'owner-a') {
  await page.route('**/feedback-service-audit.html', route => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/feedback-service-audit.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async options => {
    const refresh = '/@react-refresh', rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientAccountUI.tsx'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/src/styles.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const { ClientFeedbackDialog } = await import(/* @vite-ignore */ cp)
    const host = document.createElement('div'); host.className = 'client-source-overlays'; document.body.append(host)
    const root = (dom.createRoot ?? dom.default.createRoot)(host), element = react.createElement ?? react.default.createElement
    const calls: Controls['feedbackCalls'] = [], pending: { resolve: () => void; reject: () => void }[] = [], revoked: string[] = []
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = url => { revoked.push(url); revoke(url) }
    const submit = (input: { message: string; attachment: File | null }) => {
      calls.push({ message: input.message, file: input.attachment ? { name: input.attachment.name, type: input.attachment.type,
        size: input.attachment.size, isFile: input.attachment instanceof File } : null })
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('UNTRUSTED_SERVER_ERROR_MUST_NOT_LEAK')) }))
    }
    const render = (scope = options.scope, supplied = options.supplied, visible = true) => root.render(visible ? element(ClientFeedbackDialog, {
      submissionScope: scope, onSubmit: supplied ? submit : undefined, onClose: () => render(scope, supplied, false),
    }) : null)
    Object.assign(window, { feedbackRender: render, feedbackSettle: (index: number, failed = false) => failed ? pending[index].reject() : pending[index].resolve(),
      feedbackCalls: calls, feedbackRevoked: revoked })
    render()
  }, { supplied, scope })
  await expect(page.locator('.ca-feedback')).toBeVisible()
}
async function settle(page: Page, index = 0, failed = false) {
  await page.evaluate(({ index, failed }) => (window as unknown as Controls).feedbackSettle(index, failed), { index, failed })
}
async function callCount(page: Page) { return page.evaluate(() => (window as unknown as Controls).feedbackCalls.length) }

test('미공급 callback 또는 owner는 미확인 전송이며 완료를 만들지 않는다', async ({ page }) => {
  await mount(page, false)
  await page.locator('.ca-feedback textarea').fill('서버로 보내지 않을 입력')
  await expect(page.locator('.fb-send')).toBeDisabled()
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await expect(page.locator('.fb-done')).toHaveCount(0)
  await page.evaluate(() => (window as unknown as Controls).feedbackRender('', true))
  await expect(page.locator('.fb-send')).toBeDisabled()
  expect(await callCount(page)).toBe(0)
})

test('실제 File과 본문 전달, 중복 차단, 확인 후에만 원본 완료·포커스 표시', async ({ page }) => {
  await mount(page)
  await page.locator('.ca-feedback textarea').fill('  차트가 읽기 쉬워졌습니다.  ')
  await page.locator('input[type=file]').setInputFiles({ name: 'chart.png', mimeType: 'image/png', buffer: tinyPng })
  await page.locator('form').evaluate(form => { for (let i = 0; i < 3; i++) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  await expect(page.locator('.ca-feedback')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.fb-send')).toBeDisabled()
  await expect(page.locator('.ca-feedback textarea')).toBeDisabled()
  await expect(page.locator('.fb-done')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as Controls).feedbackCalls)).toEqual([
    { message: '차트가 읽기 쉬워졌습니다.', file: { name: 'chart.png', type: 'image/png', size: tinyPng.length, isFile: true } },
  ])
  await settle(page)
  await expect(page.locator('.fb-done')).toBeVisible()
  await expect(page.locator('.fb-done .cls')).toBeFocused()
  expect(await page.evaluate(() => (window as unknown as Controls).feedbackRevoked.length)).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('teth.feedback'))).toBeNull()
})

test('실패 시 오류를 정제하고 본문·첨부를 유지하여 재시도한다', async ({ page }) => {
  await mount(page)
  await page.locator('.ca-feedback textarea').fill('그대로 남을 본문')
  await page.locator('input[type=file]').setInputFiles({ name: 'chart.png', mimeType: 'image/png', buffer: tinyPng })
  await page.locator('.fb-send').click()
  await settle(page, 0, true)
  await expect(page.getByRole('alert')).toContainText('작성한 내용과 첨부는 그대로')
  await expect(page.locator('.ca-feedback')).not.toContainText('UNTRUSTED_SERVER_ERROR')
  await expect(page.locator('.ca-feedback textarea')).toHaveValue('그대로 남을 본문')
  await expect(page.locator('.fb-prev')).toContainText('chart.png')
  await page.locator('.fb-send').click()
  expect(await callCount(page)).toBe(2)
  await settle(page, 1)
  await expect(page.locator('.fb-done')).toBeVisible()
})

test('원본 이미지 형식·10MB 경계와 필수 본문을 전송 전 확인한다', async ({ page }) => {
  await mount(page)
  await page.locator('.fb-send').click()
  await expect(page.getByRole('alert')).toContainText('의견 내용을 입력')
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not-image') })
  await expect(page.getByRole('alert')).toContainText('이미지 파일만')
  await page.locator('input[type=file]').setInputFiles({ name: 'too-big.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert')).toContainText('10MB 이하')
  expect(await callCount(page)).toBe(0)
  await page.locator('input[type=file]').setInputFiles({ name: 'edge.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024) })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.locator('.ca-feedback textarea').fill('경계값 확인')
  await page.locator('.fb-send').click()
  expect(await page.evaluate(() => (window as unknown as Controls).feedbackCalls[0].file?.size)).toBe(10 * 1024 * 1024)
})

test('owner 교체와 닫기 후 옛 응답은 다른 사용자 폼을 완료하지 않는다', async ({ page }) => {
  await mount(page)
  await page.locator('.ca-feedback textarea').fill('owner A의 내용')
  await page.locator('input[type=file]').setInputFiles({ name: 'owner-a.png', mimeType: 'image/png', buffer: tinyPng })
  await page.locator('.fb-send').click()
  await page.evaluate(() => (window as unknown as Controls).feedbackRender('owner-b', true))
  await expect(page.locator('.ca-feedback textarea')).toHaveValue('')
  await expect(page.locator('.fb-prev')).toHaveCount(0)
  await settle(page)
  await expect(page.locator('.fb-done')).toHaveCount(0)
  await page.locator('.ca-feedback textarea').fill('owner B의 내용')
  await page.locator('.fb-send').click()
  await page.locator('.fb-x').click()
  await expect(page.locator('.ca-feedback')).toHaveCount(0)
  await settle(page, 1, true)
  await page.evaluate(() => (window as unknown as Controls).feedbackRender('owner-b', true))
  await expect(page.locator('.ca-feedback textarea')).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.fb-done')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as Controls).feedbackRevoked.length)).toBe(1)
})

test('320px 7언어 pending·실패 안내는 원본 폼 안에서 읽히고 완료를 위조하지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await mount(page)
  const notices = new Set<string>()
  for (const [index, language] of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].entries()) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await page.locator('.ca-feedback textarea').fill(`본문 ${index}`)
    await page.locator('.fb-send').click()
    await expect(page.locator('.ca-feedback [role=status]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await settle(page, index, true)
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    notices.add(await alert.innerText())
    await expect(page.locator('.fb-done')).toHaveCount(0)
  }
  expect(notices.size).toBe(7)
  await page.screenshot({ path: info.outputPath('feedback-service-320-fr.png') })
})
