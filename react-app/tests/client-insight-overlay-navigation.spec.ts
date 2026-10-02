import { expect, test, type Page } from '@playwright/test'

const article = '/#/insight/bitcoin-miner-cashflow'
async function openQuestion(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수자', email: 'review@example.test' })))
  await page.goto(article)
  await page.locator('.nfz-ast').first().click()
  await expect(page.locator('.nfz-dialog')).toBeVisible()
  await page.locator('.nfz-dialog textarea').fill('작성 중인 질문')
}

test('인사이트 질문창은 공개 페이지 내부 탐색 후 클릭을 막지 않는다', async ({ page }) => {
  await openQuestion(page)
  await page.evaluate(() => {
    history.pushState({}, '', '/download/')
    window.dispatchEvent(new Event('teth:navigate'))
  })
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  const about = page.locator('a[href="/about/"]:visible').first()
  await about.click()
  await expect(page).toHaveURL(/\/about\/$/)
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[hidden],[inert]')))).toBe(false)
})

test('같은 주소의 탐색 이벤트는 인사이트 질문 초안과 초점을 유지한다', async ({ page }) => {
  await openQuestion(page)
  await page.evaluate(() => {
    for (const event of ['teth:navigate', 'popstate', 'hashchange']) window.dispatchEvent(new Event(event))
  })
  await expect(page.locator('.nfz-dialog')).toBeVisible()
  await expect(page.locator('.nfz-dialog textarea')).toHaveValue('작성 중인 질문')
  await expect(page.locator('.nfz-dialog textarea')).toBeFocused()
})

test('기사 해시를 변경하면 이전 자산 질문창은 닫힌다', async ({ page }) => {
  await openQuestion(page)
  await page.evaluate(() => { location.hash = '#/insight' })
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.client-insights')).toBeVisible()
})

test('브라우저 뒤로가기로 공개 페이지에 돌아가도 질문창은 남지 않는다', async ({ page }) => {
  await openQuestion(page)
  await page.evaluate(() => {
    history.replaceState({}, '', '/download/')
    history.pushState({}, '', '/#/insight/bitcoin-miner-cashflow')
  })
  await page.goBack()
  await expect(page).toHaveURL(/\/download\/$/)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await page.locator('a[href="/about/"]:visible').first().click({ trial: true })
})
