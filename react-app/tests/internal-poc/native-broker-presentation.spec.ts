import { expect, test, type Page } from '@playwright/test'
import type { BrokerServicePresentation } from '../../src/client-broker-presentation'

test.use({ trace: 'retain-on-failure', video: 'off' })
const catalog: BrokerServicePresentation['catalog'] = [{
  broker: { id: 'binance', name: 'Supplied Alpha', ord: 1, tag: '거래소', assets: '암호화폐', conn: true, rating: 4.2,
    ratingSrc: '확인된 이용자 평가', traders: '18', fw0: 0, traderN: 18, rvN: 10, col: '#aaccee', fg: '#111111', site: 'example.com', about: '공급된 거래소 설명',
    assetsList: ['공급된 BTC 현물'], fees: { dep: '무료', wd: '네트워크 기준', ina: '없음', mk: '0.012%', tk: '0.025%' }, promo: '공급된 프로모션' },
  info: { founded: '2020', hq: '공급된 본사', docsUrl: 'https://example.com/docs', community: '공급된 커뮤니티', communityUrl: 'https://example.com/community',
    caps: { publicApi: true, stopOrder: false, marketOrder: 'unknown' }, faq: [{ q: '공급된 질문', a: '공급된 답변' }] },
  connectionState: 'CONNECTED', promotionBody: '공급된 혜택 조건', feeAsOfLabel: '2030-01-01 확인',
  reviews: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, rating: 1 + index % 5, text: `공급된 후기 본문 ${index + 1}`, author: `공급 작성자 ${index + 1}`,
    date: `2030-01-${String(index + 1).padStart(2, '0')}`, publishedAt: `2030-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`, categories: [index % 2 ? '고객 지원' : '거래 조건'] })),
}, {
  broker: { id: 'okx', name: 'Supplied Beta', ord: 2, tag: '거래소', assets: '암호화폐', conn: true, rating: null, traders: '—', fw0: 0,
    col: '#cccccc', fg: '#111111', site: 'javascript:alert(1)', about: '', assetsList: [] },
  connectionState: 'NEEDS_LINK', reviews: [], info: { founded: '—', docsUrl: 'javascript:alert(1)', community: '위험 링크', communityUrl: 'https://name:password@example.com/' },
}]
type Controls = {
  brokerRender: (scope?: string, mode?: 'ready' | 'empty' | 'unavailable' | 'mismatch', identity?: string) => void
  brokerSettle: (index: number, failure?: boolean) => void
  brokerCalls: { kind: string; id?: string; text?: string; rating?: number }[]
}
async function mount(page: Page, mode: 'ready' | 'empty' | 'unavailable' | 'mismatch' = 'ready') {
  await page.route('**/broker-presentation-audit.html', route => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/broker-presentation-audit.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async ({ catalog, mode }) => {
    const path = '/@react-refresh'; const runtime = (await import(/* @vite-ignore */ path)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const css of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/src/styles.css', '/src/client-reference.css']) await import(/* @vite-ignore */ css)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeBrokers.tsx'
    const React = await import(/* @vite-ignore */ rp), DOM = await import(/* @vite-ignore */ dp), { NativeBrokers } = await import(/* @vite-ignore */ cp)
    const element = React.createElement ?? React.default.createElement, host = document.createElement('div'); document.body.append(host)
    const root = (DOM.createRoot ?? DOM.default.createRoot)(host), calls: Controls['brokerCalls'] = [], pending: { resolve: () => void; reject: () => void }[] = []
    const wait = (call: Controls['brokerCalls'][number]) => { calls.push(call); return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_ERROR_NOT_FOR_UI')) })) }
    const render = (scope = 'owner-a', view = mode, identity = 'catalog-a') => root.render(element(NativeBrokers, {
      accountScope: scope, signedIn: true, shouldFocus: () => true, listRequest: 0, onReturn: () => {},
      presentation: { scope: view === 'mismatch' ? 'different-owner' : scope, identity, catalog: view === 'empty' ? [] : view === 'unavailable' ? null : catalog,
        actions: { onConnect: (id: string) => wait({ kind: 'connect', id }), onOpenAccount: (id: string) => wait({ kind: 'account', id }),
          submitReview: (id: string, review: { text: string; rating: number }) => wait({ kind: 'review', id, ...review }) } },
    }))
    Object.assign(window, { brokerRender: render, brokerCalls: calls, brokerSettle: (index: number, failure = false) => failure ? pending[index].reject() : pending[index].resolve() })
    render()
  }, { catalog, mode })
  await expect(page.locator('.native-brokers')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function settle(page: Page, index = 0, failure = false) { await page.evaluate(({ index, failure }) => (window as unknown as Controls).brokerSettle(index, failure), { index, failure }) }
async function details(page: Page, broker = 'Supplied Alpha') { await page.getByRole('button', { name: `${broker} 자세히`, exact: true }).click() }

test('공급된 목록·요금·기능·본문·FAQ·후기를 원본 전체 구조에서 표시한다', async ({ page }, info) => {
  await mount(page)
  await expect(page.locator('.bk2-card')).toHaveCount(2)
  await expect(page.locator('.bk2-page')).not.toContainText('App Store')
  await details(page)
  await expect(page.locator('.bk2-head')).toContainText('연결됨')
  await expect(page.locator('.bk2-about')).toContainText('공급된 거래소 설명')
  await expect(page.locator('.bk2-fees')).toContainText('0.012% / 0.025%')
  await expect(page.locator('.bk2-asof')).toHaveText('2030-01-01 확인')
  await expect(page.locator('.bk2-promo')).toContainText('공급된 혜택 조건')
  await expect(page.locator('.bk2-promo')).not.toContainText('가입 즉시 자동 연결')
  await expect(page.getByRole('link', { name: '공식 문서 ↗' })).toHaveAttribute('href', 'https://example.com/docs')
  await page.getByRole('button', { name: '공급된 질문', exact: false }).click()
  await expect(page.locator('.bk2-faq .a')).toContainText('공급된 답변')
  await expect(page.locator('.bk2-rvrow .bk2-rvc')).toHaveCount(8)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await expect(page.locator('.bk2-rvgrid .bk2-rvc')).toHaveCount(9)
  await page.getByRole('button', { name: /^리뷰 정렬/ }).click()
  await page.getByRole('option', { name: '최신순', exact: true }).click()
  await expect(page.locator('.bk2-rvgrid .bk2-rvc').first()).toContainText('공급 작성자 10')
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click()
  await expect(page.locator('.bk2-rvgrid .bk2-rvc')).toHaveCount(1)
  await page.getByRole('button', { name: '고객 지원', exact: true }).click()
  await expect(page.locator('.bk2-rvgrid .bk2-rvc')).toHaveCount(5)
  await page.locator('.bk2-rvgrid .bk2-rvc').first().click()
  await expect(page.getByRole('dialog')).toContainText('공급된 후기 본문 10')
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await page.screenshot({ path: info.outputPath('broker-supplied-reviews.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('미공급은 원본 metadata만, 제공된 빈목록은 빈목록이며 owner불일치 공급값을 숨긴다', async ({ page }) => {
  await mount(page, 'unavailable')
  await expect(page.locator('.bk2-card')).toHaveCount(21)
  await expect(page.locator('.bk2-meta .rt, .pr')).toHaveCount(0)
  await expect(page.locator('.bk2-page')).not.toContainText('Supplied Alpha')
  await page.evaluate(() => (window as unknown as Controls).brokerRender('owner-a', 'empty'))
  await expect(page.locator('.bk2-card')).toHaveCount(0)
  await expect(page.locator('.bk2-empty')).toContainText('등록된 사업자가 없습니다.')
  await page.evaluate(() => (window as unknown as Controls).brokerRender('owner-a', 'mismatch'))
  await expect(page.locator('.bk2-card')).toHaveCount(21)
  await expect(page.locator('.bk2-page')).not.toContainText('Supplied Alpha')
})

test('안전하지 않은 외부 링크를 제거하고 제공된 빈후기를 미공급으로 표시하지 않는다', async ({ page }) => {
  await mount(page)
  await details(page, 'Supplied Beta')
  await expect(page.locator('.bk2-about a')).toHaveCount(0)
  await expect(page.locator('.bk2-page')).not.toContainText('2026.09')
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await expect(page.locator('.bk2-dist .n')).toHaveText(['0', '0', '0', '0', '0'])
  await expect(page.locator('.bk2-empty')).toContainText('이 카테고리의 리뷰가 아직 없어요.')
})

test('연결 클릭 중복·실패는 연결성공을 위조하지 않고 owner변경 늦은결과를 무시한다', async ({ page }) => {
  await mount(page)
  await details(page, 'Supplied Beta')
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(page.getByRole('button', { name: 'TETH로 연결', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => (window as unknown as Controls).brokerCalls.length)).toBe(1)
  await settle(page, 0, true)
  await expect(page.getByRole('dialog')).toContainText('요청을 완료하지 못했습니다.')
  await expect(page.getByRole('dialog')).not.toContainText('PRIVATE_ERROR')
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  await page.evaluate(() => (window as unknown as Controls).brokerRender('owner-b', 'ready', 'catalog-b'))
  await settle(page, 1, true)
  await expect(page.locator('.bk2-card')).toHaveCount(2)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('리뷰 제출 실패는 초안 보존, 수락된 응답만 완료, scope교체는 초안과 pending을 격리한다', async ({ page }) => {
  await mount(page)
  await details(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: '5점' }).click()
  await dialog.locator('textarea').fill('충분한 길이의 검증된 리뷰를 전달합니다.')
  await dialog.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  await settle(page, 0, true)
  await expect(dialog.getByRole('alert')).toContainText('작성 내용은 유지됩니다.')
  await expect(dialog.locator('textarea')).toHaveValue('충분한 길이의 검증된 리뷰를 전달합니다.')
  await dialog.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  await settle(page, 1)
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.bk2-rvgrid')).toBeVisible()
  await expect(page.locator('.bk2-mine')).toHaveCount(0)
  await expect(page.locator('.bk2-rvgrid')).not.toContainText('충분한 길이의 검증된 리뷰를 전달합니다.')
  await page.evaluate(() => (window as unknown as Controls).brokerRender('owner-b', 'ready', 'catalog-b'))
  await details(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  await page.getByRole('dialog').getByRole('radio', { name: '4점' }).click()
  await page.getByRole('dialog').locator('textarea').fill('이전 소유자에게만 속하는 검증 리뷰')
  await page.getByRole('dialog').getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  await page.evaluate(() => (window as unknown as Controls).brokerRender('owner-c', 'empty', 'catalog-c'))
  await settle(page, 2)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.bk2-empty')).toContainText('등록된 사업자가 없습니다.')
})

test('320px 공급된 전체 상세와 리뷰 시트는 가로 넘침 없이 왕복한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await mount(page)
  await details(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: /^리뷰 정렬/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('option', { name: '최신순', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.bk2-rvgrid .bk2-rvc').first()).toContainText('공급 작성자 10')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('broker-service-320.png') })
  await page.locator('.bk2-bc').getByRole('button', { name: '지원 거래소', exact: true }).click()
  await expect(page.locator('.bk2-card')).toHaveCount(2)
})
