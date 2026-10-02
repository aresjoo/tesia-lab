import { expect, test, type Page } from '@playwright/test'
import { clientInsightHash, readClientInsightLocation } from '../src/client-insight-navigation'

async function openSidebar(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 0) <= 860
  await page.locator(mobile ? '.client-hamburger' : '.client-rail-logo-row button').click()
}

test('수정키가 있는 기사 클릭은 앱이 취소하거나 현재 화면을 변경하지 않는다', async ({ page }) => {
  await page.goto('/#/insight')
  const link = page.locator('.nfz-card').first()
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    const preventedByApp = await link.evaluate((el, key) => {
      let prevented: boolean | undefined
      const observe = (event: MouseEvent) => {
        // Observe after React; suppress only the synthetic event's browser action.
        prevented = event.defaultPrevented
        event.preventDefault()
      }
      document.addEventListener('click', observe, { once: true })
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, [key]: true }))
      document.removeEventListener('click', observe)
      return prevented
    }, modifier)
    expect(preventedByApp, modifier).toBe(false)
    await expect(page).toHaveURL(/#\/insight$/)
    await expect(page.locator('.nfz-open')).toBeVisible()
  }
  await link.click()
  await expect(page.locator('.nfz-a h1')).toBeVisible()
})

test('인사이트 해시는 기사·태그를 인코딩하고 손상되거나 다른 경로는 거부한다', () => {
  expect(readClientInsightLocation(clientInsightHash({ slug: 'bitcoin-miner-cashflow' }))).toEqual({ slug: 'bitcoin-miner-cashflow' })
  expect(readClientInsightLocation(clientInsightHash({ tag: '금리 & bitcoin' }))).toEqual({ tag: '금리 & bitcoin' })
  expect(readClientInsightLocation('#/insight/%E0%A4')).toEqual({ slug: 'invalid-route' })
  expect(readClientInsightLocation('#/research')).toBeNull()
})

test('기사 직접 진입·태그·뒤로가기·새로고침은 화면과 주소를 일치시킨다', async ({ page }) => {
  await page.goto('/#/insight/bitcoin-miner-cashflow')
  await expect(page.locator('.nfz-a h1')).toContainText('반감기로 새 비트코인은 줄었습니다')
  await page.reload()
  await expect(page.locator('.nfz-a h1')).toContainText('반감기로 새 비트코인은 줄었습니다')
  await page.locator('.nfz-a').getByRole('button', { name: '비트코인', exact: true }).click()
  await expect(page).toHaveURL(/#\/insight\/t\/bitcoin$/)
  await expect(page.getByRole('heading', { name: '태그: 비트코인' })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.nfz-a h1')).toContainText('반감기로 새 비트코인은 줄었습니다')
})

test('인사이트 로그인은 이전 홈 초안을 전송하지 않으며 뒤로가기는 모달과 inert를 해제한다', async ({ page }) => {
  await page.goto('/')
  await page.locator('#strategy-idea').fill('아직 보내지 않은 홈 초안')
  await openSidebar(page)
  await page.locator('.client-sidebar [data-sidebar-action="profile-settings"], .client-sidebar [data-sidebar-action="settings"]').filter({ visible: true }).first().click()
  await page.locator('.ca-settings [data-menu-action="insight"]').click()
  await openSidebar(page)
  await page.getByRole('button', { name: '사이드바 로그인', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
  await expect(page.locator('#strategy-idea')).toHaveValue('아직 보내지 않은 홈 초안')
  await page.goForward()
  await expect(page.locator('.nfz-open')).toBeVisible()
  await openSidebar(page)
  await page.getByRole('button', { name: '사이드바 로그인', exact: true }).click()
  await page.locator('.au-btns button').first().click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/insight$/)
  await expect(page.locator('.g-urow')).toHaveCount(0)
})

test('인사이트에서 대화 세션을 선택하면 남은 해시 없이 새로고침으로 같은 대화를 복구한다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 사용자', email: 'qa@example.test' })))
  await page.goto('/')
  await page.locator('#strategy-idea').fill('금리와 비트코인의 관계를 알려줘')
  await page.locator('#strategy-idea').press('Enter')
  await expect(page.locator('.g-urow')).toHaveCount(1)
  await openSidebar(page)
  await page.locator('.client-sidebar [data-sidebar-action="profile-settings"], .client-sidebar [data-sidebar-action="settings"]').filter({ visible: true }).first().click()
  await page.locator('.ca-settings [data-menu-action="insight"]').click()
  await expect(page.locator('.nfz-open')).toBeVisible()
  await openSidebar(page)
  await page.locator('.client-session').first().click()
  await expect(page).not.toHaveURL(/#\/insight/)
  await expect(page.locator('.g-urow')).toContainText('금리와 비트코인의 관계를 알려줘')
  await page.reload()
  await expect(page.locator('.g-urow')).toContainText('금리와 비트코인의 관계를 알려줘')
})
