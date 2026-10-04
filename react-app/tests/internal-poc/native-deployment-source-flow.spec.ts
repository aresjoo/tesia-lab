import { expect, test, type Page } from '@playwright/test'
import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'

// Real service renderer and generated SDK with explicitly synthetic HTTP.
// Public browsing must not dispatch authentication or business mutations.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(30_000)
async function mount(page: Page, path = '/') {
  const posts: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    if (request.method() === 'POST') posts.push(pathname)
    if (pathname !== '/api/v1/auth/session' && pathname !== '/api/v1/auth/csrf') return route.abort('failed')
    const isSession = pathname.endsWith('/session')
    await route.fulfill({ contentType: 'application/json', headers: isSession ? { ETag: '"source_parity_anonymous_001"' } : {},
      body: JSON.stringify({ meta: { apiContractVersion: '0.1.0', resourceRevision: isSession ? '1' : null,
        requestId: 'req_source_parity_0001', traceId: 'trace_source_parity_0001' }, data: isSession
        ? { sessionId: 'session_source_parity_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_source_parity_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
  })
  await page.route(`http://127.0.0.1:${process.env.TETH_E2E_PORT ?? 4175}${path.split('#')[0]}`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>
    <div id="internal-poc-root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/internal-poc/service-main.tsx');</script></body></html>` }))
  await page.goto(path)
  return posts
}
async function menu(page: Page, name: string) {
  const button = page.locator('.client-sidebar').getByRole('button', { name, exact: true })
  if (!await button.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await button.click()
}
test('비로그인 공개 전략 탐색은 원본 목록·필터·상세를 열고 실제 복사 동작에서만 로그인을 요청한다', async ({ page }) => {
  const posts = await mount(page)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await menu(page, sourceSidebarNavigationLabel('ko', 'sharing'))
  const catalogue = page.locator('[data-public-catalogue]')
  await expect(catalogue.locator('.tfbk-card').first()).toBeVisible()
  await expect(page.locator('.native-auth-surface')).toHaveCount(0)
  await expect(catalogue.locator('canvas')).toHaveCount(0)
  await expect(catalogue.getByRole('combobox').locator('option[value="ret"]')).toHaveAttribute('disabled', '')
  await catalogue.getByRole('searchbox').fill('ETH')
  await expect(catalogue.locator('.tfbk-card').first()).toContainText('ETH')
  await catalogue.locator('.tfbk-card').first().click()
  await expect(catalogue.locator('.client-shared-detail')).toBeVisible()
  await expect(page.locator('.native-auth-surface')).toHaveCount(0)
  await catalogue.locator('.shared-detail-actions .wbtn').click()
  await expect(page.locator('.native-auth-surface')).toBeVisible()
  await expect(page.locator('.au-x')).toBeVisible()
  await page.locator('.au-x').click()
  await expect(catalogue.locator('.client-shared-detail')).toBeVisible()
  expect(posts).toEqual([])
})
test('원본 모달 닫기·카피·무료 안내를 유지하고 초기 내부 복구 안내를 표시하지 않는다', async ({ page }) => {
  const posts = await mount(page)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  const account = page.locator('[data-sidebar-action=account]')
  if (!await account.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await account.click()
  const dialog = page.locator('.native-auth-surface')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.au-title')).toHaveText('로그인 또는 회원가입')
  await expect(dialog.locator('.au-free')).toBeVisible()
  await expect(dialog.locator('.au-x')).toBeVisible()
  await expect(dialog.locator('details, .native-auth-status')).toHaveCount(0)
  await expect(page.locator('.client-development-boundary')).toHaveCount(0)
  await dialog.locator('.au-x').click()
  await expect(dialog).toHaveCount(0)
  expect(posts).toEqual([])
})
test('트레이딩 소개는 비로그인 상태에서 원본 배치를 열고 가상 예시와 준비 중인 실행을 구분한다', async ({ page }) => {
  const posts = await mount(page, '/#/trade')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.txh-hero')).toBeVisible()
  await expect(page.locator('.native-auth-surface')).toHaveCount(0)
  await expect(page.locator('.txh-example-note')).toContainText('가상 예시')
  await expect(page.locator('.txh-sub')).toContainText('자동 실행은 준비 중')
  await expect(page.locator('.txh-now')).toContainText('가정 수익률')
  await expect(page.locator('.txh-now img[src$="buffett.jpg"]')).toHaveCount(0)
  await page.locator('.txh-hero .txh-cta').click()
  await expect(page.locator('.native-auth-surface')).toBeVisible()
  expect(posts).toEqual([])
})
for (const path of ['/about/', '/download/', '/policies/#privacy']) {
  test(`원본 정보 URL ${path} 직접 진입과 새로고침은 제품 안내를 표시하고 내부 Mock 배너를 표시하지 않는다`, async ({ page }) => {
    const posts = await mount(page, path)
    await expect(page.locator('.client-site-footer')).toBeVisible()
    await expect(page.locator('.prototype-notice, .pricing-preview, .client-development-boundary')).toHaveCount(0)
    if (path === '/about/') {
      await expect(page.locator('.ab-hero .ab-d')).toContainText('연구·검증')
      await expect(page.locator('.pl-foot').filter({ hasText: '자동 결제됩니다' })).toHaveCount(0)
      await expect(page.locator('.pl-foot').filter({ hasText: '20%' })).toHaveCount(0)
      for (const unsupported of ['전략이 24시간 시장을 보고', '언제든 일시정지와 긴급 정지', '24시간 고객 지원', '상담원이 24시간 답합니다', '직접 주문합니다', '수수료의 20%', '수수료의 50%']) {
        await expect(page.locator('main')).not.toContainText(unsupported)
      }
    }
    expect(new URL(page.url()).pathname).toBe(path.split('#')[0])
    await page.reload()
    await expect(page.locator('.client-site-footer')).toBeVisible()
    expect(posts).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}
