import { expect, test, type Page } from '@playwright/test'
import { composeTemplatePrompt } from '../../src/client-home-gallery'

// Synthetic HTTP boundary only. Never record real credentials or provider calls.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(30_000)

const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_home_gallery_fixture_0001', traceId: 'trace_home_gallery_fixture_0001', resourceRevision: revision })
async function openNativeHome(page: Page, authenticated = true) {
  const writes: string[] = []
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"home_gallery_session_etag_0001"' }, body: JSON.stringify({
    meta: meta('0.1.0', '1'), data: { sessionId: 'session_home_gallery_fixture_0001', state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    meta: meta('0.1.0', null), data: { csrfToken: 'csrf_home_gallery_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v3/**', route => {
    writes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
    return route.abort('failed')
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('region', { name: '투자 템플릿' }).locator('.g-tpl')).toHaveCount(55)
  return writes
}

test('native 홈은 공통 갤러리·카피·모바일 1열을 사용하며 선택만으로 서버 명령을 만들지 않는다', async ({ page }) => {
  const writes = await openNativeHome(page)
  await expect(page.locator('.client-service-app')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(page.locator('.client-source-main')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(page.locator('.client-hero-subtitle')).toContainText('템플릿을 사용해 보거나 채팅으로 투자를 설명하십시오.')
  await expect(page.locator('.client-hero-logo, .client-home-chips')).toHaveCount(0)
  await expect(page.locator('.client-free-row')).toHaveCount(0)
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toHaveAttribute('placeholder', 'AI가 어떻게 BTC 거래를 해드리면 되겠습니까?')
  await expect(page.locator('#strategy-idea')).toHaveAttribute('maxlength', '1000')
  expect(writes).toEqual([])
  const width = page.viewportSize()?.width ?? 1280
  expect(await gallery.locator('.g-tpls').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(width <= 600 ? 1 : width <= 1100 ? 2 : 3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('StrictMode 최초 홈 진입은 모션을 유지하고 명시적 새 전략은 선택을 초기화한다', async ({ page }) => {
  const writes = await openNativeHome(page)
  await expect(page.locator('.client-gallery-home')).toHaveClass(/\bentr\b/)
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  if ((page.viewportSize()?.width ?? 1280) <= 860) {
    await page.getByRole('button', { name: '메뉴', exact: true }).click()
    await page.locator('.client-new-strategy').click()
  } else await page.getByRole('button', { name: '새 전략', exact: true }).click()
  await expect(page.locator('.client-gallery-home')).not.toHaveClass(/\bentr\b/)
  await expect(page.locator('.client-template-selection')).toHaveCount(0)
  expect(writes).toEqual([])
})

test('템플릿 합성 후 1000자를 넘으면 입력·선택을 보존하고 서버 전송을 차단한다', async ({ page }) => {
  const writes = await openNativeHome(page)
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  const text = '가'.repeat(1000)
  await page.locator('#strategy-idea').fill(text)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.client-global-notice')).toContainText('템플릿을 포함한 질문은 1,000자까지')
  await expect(page.locator('#strategy-idea')).toHaveValue(text)
  await expect(page.getByRole('button', { name: 'AI가 대신 거래 선택 해제' })).toBeVisible()
  await expect(page.locator('#strategy-idea')).toBeFocused()
  expect(writes).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
})

test('합성 질문이 정확히 1000자이면 잘라내지 않고 기존 명령에 전달한다', async ({ page }) => {
  const writes = await openNativeHome(page)
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: '시장/종목 분석', exact: true }).click()
  const selection = { acts: ['anal'], assets: [] }
  const prefixLength = composeTemplatePrompt(selection).length + 2
  await page.locator('#strategy-idea').fill('가'.repeat(1000 - prefixLength))
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  const command = await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.pending-command')!))
  expect(command.message).toHaveLength(1000)
  expect(command.message).toBe(composeTemplatePrompt(selection, '가'.repeat(1000 - prefixLength)))
  expect(writes).toEqual(['POST /api/v3/conversations'])
})

test('합성 질문은 기존 native journal에 보존되고 네트워크 실패 뒤 같은 명령으로만 재개한다', async ({ page }) => {
  const writes = await openNativeHome(page)
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await page.locator('#strategy-idea').fill('손실은 작게')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  const raw = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(JSON.parse(raw!).message).toBe(composeTemplatePrompt({ acts: ['auto'], assets: ['btc'] }, '손실은 작게'))
  await expect(page.locator('.g-umsg')).toHaveText('손실은 작게')
  expect(writes).toEqual(['POST /api/v3/conversations'])
  await expect(page.locator('.g-composer textarea')).toBeDisabled()
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(raw)
  await expect(page.locator('.g-umsg')).toHaveText('손실은 작게')
  expect(writes).toEqual(['POST /api/v3/conversations', 'POST /api/v3/conversations'])
  await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
})

test('글을 쓰지 않고 선택한 템플릿만으로도 기존 전송 경로에 질문을 전달한다', async ({ page }) => {
  const writes = await openNativeHome(page, false)
  // Latest source exposes the guest CTA only after text input, not on arrival.
  await expect(page.locator('.client-free-row')).toBeHidden()
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: '시장/종목 분석', exact: true }).click()
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  const command = await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.pending-command')!))
  expect(command.message).toBe('지금 시장 전반을 분석해줘')
  expect(writes).toEqual(['POST /api/v3/conversations'])
})

test('고정 fixture가 지원하지 않는 합성문은 오류를 보존하고 가짜 응답을 만들지 않는다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html#/client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await page.locator('#strategy-idea').fill('BTC 15분 RSI 30 아래면 100 USDT 롱')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-umsg')).toContainText('AI가 대신 거래하는 전략을 만들어줘. BTC 15분 RSI 30 아래면 100 USDT 롱')
  await expect(page.getByRole('alert')).toContainText('FIXTURE_UNRECOGNIZED_STRATEGY_REPLY')
  await expect(page.locator('.g-amsg')).toHaveCount(0)
  await expect(page.locator('.client-service-document')).toHaveCount(0)
  await expect(page.locator('.client-development-boundary')).toContainText('Mock fixture 검수')
  await expect(page.getByRole('button', { name: '응답 중지', exact: true })).toHaveCount(0)
})

test('기존 고정 fixture 입력은 공통 홈 이후 원본 응답·검증 문서로 이어진다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html#/client')
  await expect(page.getByRole('region', { name: '투자 템플릿' })).toBeVisible()
  await page.locator('#strategy-idea').fill('BTC 15분 RSI 30 아래면 100 USDT 롱, 손절 2%, 익절 5%, 레버리지 2배')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-amsg')).toContainText('거래할 심볼')
  await expect(page.locator('.client-service-document')).toBeVisible()
  await expect(page.getByRole('button', { name: 'BTCUSDT', exact: true })).toBeVisible()
})
