import { expect, test, type Page } from '@playwright/test'

const email = 'policy-audit@example.test'
const message = '정책을 읽고 돌아와서 이어 쓸 의견\n원문과 첨부를 유지해 주세요.'
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=', 'base64')

async function openFeedback(page: Page) {
  const settings = page.locator('.client-sidebar-bottom [data-sidebar-action="settings"]')
  if (await page.evaluate(() => matchMedia('(max-width: 860px)').matches)) await page.locator('.client-hamburger').click()
  await expect(settings).toBeVisible()
  await settings.click()
  await page.locator('.ca-settings').getByRole('button', { name: '의견 보내기', exact: true }).click()
}

for (const width of [320, 1440]) for (const mode of ['login-code', 'signup-age', 'feedback'] as const) {
  test(`정책 새탭은 작성 중 폼을 보존한다 ${width}px ${mode}`, async ({ page, context }, info) => {
    const posts: string[] = []
    context.on('request', request => { if (request.method() !== 'GET') posts.push(`${request.method()} ${new URL(request.url()).pathname}`) })
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    if (mode === 'feedback') {
      await openFeedback(page)
      await page.locator('.ca-feedback textarea').fill(message)
      await page.locator('.ca-feedback input[type="file"]').setInputFiles({ name: 'audit.png', mimeType: 'image/png', buffer: pixel })
      await expect(page.getByAltText('첨부된 스크린샷')).toBeVisible()
    } else {
      const entry = page.locator(mode === 'login-code' ? '.client-login' : '.client-signup')
      await expect(entry).toBeVisible()
      await entry.click()
      await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(email)
      await page.getByRole('button', { name: '계속', exact: true }).click()
      if (mode === 'signup-age') {
        await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password-42!')
        await page.getByRole('button', { name: '계속', exact: true }).click()
      }
      await page.getByRole('textbox', { name: '코드', exact: true }).fill(mode === 'signup-age' ? '123456' : '123')
      if (mode === 'signup-age') {
        await page.getByRole('button', { name: '계속', exact: true }).click()
        await page.getByRole('textbox', { name: '성명', exact: true }).fill('정책 검토 사용자')
        await page.getByRole('textbox', { name: '연령', exact: true }).fill('28')
      }
    }
    const form = page.locator(mode === 'feedback' ? '.ca-feedback form' : '.ca-auth form')
    const original = await form.elementHandle()
    const snapshot = () => form.evaluate(node => [...node.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].map(input => ({
      value: input.value, files: input instanceof HTMLInputElement ? [...(input.files ?? [])].map(file => ({ name: file.name, type: file.type, size: file.size })) : [],
    })))
    const before = await snapshot(), url = page.url()
    const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
    const links = form.locator('a[href^="/policies/"]')
    expect(await links.count()).toBeGreaterThan(0)
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
      await expect(link).toHaveAttribute('rel', /noreferrer/)
      const expected = new URL((await link.getAttribute('href'))!, url).href
      const opened = context.waitForEvent('page')
      await link.click()
      const policy = await opened
      try {
        await policy.waitForURL(expected)
        await policy.waitForLoadState('domcontentloaded')
        expect(await policy.evaluate(() => window.opener === null)).toBe(true)
        expect(page.url()).toBe(url)
        await expect(form).toBeVisible()
        expect(await form.evaluate((node, previous) => node === previous, original)).toBe(true)
        expect(await snapshot()).toEqual(before)
      } finally { await policy.close() }
      await page.bringToFront()
      expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storage)
      await expect(page.locator('#root')).toHaveAttribute('inert')
    }
    expect(context.pages()).toHaveLength(1)
    expect(posts).toEqual([])
    await page.screenshot({ path: info.outputPath('policy-draft-viewport.png') })
    await page.screenshot({ path: info.outputPath('policy-draft-preserved.png'), fullPage: true })
  })
}
