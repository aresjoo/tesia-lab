import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from './fixtures/source-offline-research-entry'
import { catalogueStrategies } from '../src/client-catalogue'

const guestKey = 'teth-sharing-watch:guest'
const email = 'watch-resume@example.test'
const accountKey = `teth-sharing-watch:account:${encodeURIComponent(email)}`

async function open(page: Page, account?: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ guestKey, accountKey, account }) => {
    if (sessionStorage.getItem('guest-watch-fixture-ready')) return
    sessionStorage.setItem('guest-watch-fixture-ready', 'yes')
    sessionStorage.setItem(guestKey, '["f1","f2","unknown-guest-record"]')
    if (account !== undefined) sessionStorage.setItem(accountKey, account)
  }, { guestKey, accountKey, account })
  await page.goto('/#/share/s/f1')
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
}

async function start(page: Page) {
  await page.locator('.shared-detail-watch').click()
  await expect(page.getByRole('dialog')).toContainText('로그인 또는 회원가입')
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
}

async function emailSignup(page: Page) {
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

async function googleLogin(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 860) {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger').click()
  }
  await page.getByRole('button', { name: '사이드바 로그인', exact: true }).click()
  await page.locator('.ca-auth').getByRole('button', { name: /Google/ }).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
}

async function currentWatch(page: Page) {
  return page.evaluate(() => {
    const profile = JSON.parse(sessionStorage.getItem('teth-client-profile-preview') ?? 'null')
    const owner = profile?.email || profile?.previewId || 'preview-social'
    return { owner, stored: sessionStorage.getItem(`teth-sharing-watch:account:${encodeURIComponent(owner)}`) }
  })
}

test('비회원의 과거 즐겨찾기는 눌림 상태를 만들지 않고 취소는 저장·초점 복귀를 보존한다', async ({ page }) => {
  await open(page, '["f2"]')
  await start(page)
  await page.locator('.ca-auth').getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.shared-detail-watch')).toBeFocused()
  expect(await page.evaluate(key => sessionStorage.getItem(key), guestKey)).toBe('["f1","f2","unknown-guest-record"]')
  expect(await page.evaluate(key => sessionStorage.getItem(key), accountKey)).toBe('["f2"]')
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-profile-preview'))).toBeNull()
})

test('실제 이메일 가입 완료는 같은 전략 하나만 새 계정에 추가하고 reload·왕복 중 중복 재개하지 않는다', async ({ page }) => {
  await open(page, '["f2","unknown-account-record"]')
  await start(page)
  await emailSignup(page)
  await expect(page).toHaveURL(/#\/share\/s\/f1$/)
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  expect(await currentWatch(page)).toEqual({ owner: email, stored: '["f2","unknown-account-record","f1"]' })
  expect(await page.evaluate(key => sessionStorage.getItem(key), guestKey)).toBe('["f1","f2","unknown-guest-record"]')
  await page.reload()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.shared-detail-watch').click()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  await page.evaluate(() => { location.hash = '#/share/s/f2' })
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  await page.goBack()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  expect((await currentWatch(page)).stored).toBe('["f2","unknown-account-record"]')
})

test('실제 Google Mock 가입 완료의 새 owner에는 선택한 ID만 저장하며 이전 guest 목록을 가져오지 않는다', async ({ page }) => {
  await open(page)
  await start(page)
  await page.locator('.ca-auth').getByRole('button', { name: /Google/ }).click()
  await page.locator('.ca-auth').getByLabel('연령', { exact: true }).fill('28')
  await page.locator('.ca-auth').getByRole('button', { name: '시장에 입장하기', exact: true }).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  const actual = await currentWatch(page)
  expect(actual.owner).not.toBe('preview-social')
  expect(actual.stored).toBe('["f1"]')
  await page.reload()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  expect(await currentWatch(page)).toEqual(actual)
})

test('별칭 상세 인증도 정본 ID 하나로만 복귀하고 과거 계정 별칭을 중복 저장하지 않는다', async ({ page }) => {
  await open(page, JSON.stringify([catalogueStrategies[0].name, 'f2']))
  await page.evaluate(name => { location.hash = `#/share/s/${encodeURIComponent(name)}` }, catalogueStrategies[0].name)
  await expect(page.locator('.ss3-dtitle')).toContainText(catalogueStrategies[0].name)
  await start(page)
  await emailSignup(page)
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  expect((await currentWatch(page)).stored).toBe(JSON.stringify([catalogueStrategies[0].name, 'f2']))
})

test('취소 후 별도 실제 로그인은 폐기된 즐겨찾기를 새 계정에 재생하지 않는다', async ({ page }) => {
  await open(page)
  await start(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await googleLogin(page)
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  expect((await currentWatch(page)).stored).toBeNull()
  expect(await page.evaluate(key => sessionStorage.getItem(key), guestKey)).toBe('["f1","f2","unknown-guest-record"]')
})

test('화면 이동은 진행 중 가입과 pending ID를 폐기하며 다음 로그인에 다른 전략을 저장하지 않는다', async ({ page }) => {
  await open(page)
  await start(page)
  await page.locator('.ca-auth').getByRole('button', { name: /Google/ }).click()
  await page.locator('.ca-auth').getByLabel('연령', { exact: true }).fill('28')
  await page.locator('.ca-auth').getByRole('button', { name: '시장에 입장하기', exact: true }).click()
  await page.evaluate(() => { location.hash = '#/share/s/f2' })
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  await googleLogin(page)
  expect((await currentWatch(page)).stored).toBeNull()
  await page.reload()
  expect((await currentWatch(page)).stored).toBeNull()
})

test('손상된 계정 목록은 가입 복귀가 덮어쓰지 않고 저장 실패를 사용자에게 알린다', async ({ page }) => {
  await open(page, '{broken')
  await start(page)
  await emailSignup(page)
  expect(await page.evaluate(key => sessionStorage.getItem(key), accountKey)).toBe('{broken')
  await expect(page.getByRole('status').filter({ hasText: '관심 전략을 저장하지 못했어요.' })).toBeVisible()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
})

test('비회원 저장 라이브러리는 계정 즐겨찾기와 구분하며 원래 bytes를 지우지 않는다', async ({ page }) => {
  await open(page)
  await page.evaluate(() => { location.hash = '#/share/library' })
  await expect(page.getByRole('note').filter({ hasText: '이전 비회원 기록' })).toBeVisible()
  await expect(page.locator('.client-library-watches .strategy-list-card')).toHaveCount(2)
  await page.locator('.client-library-watches .strategy-list-card a').first().click()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(key => sessionStorage.getItem(key), guestKey)).toBe('["f1","f2","unknown-guest-record"]')
})
