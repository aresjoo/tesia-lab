import { expect, test, type Page } from '@playwright/test'
import { strategyProposalCopy, strategyProposalText } from '../src/client-strategy-proposal-copy'
import { strategyActionsText } from '../src/client-strategy-actions-copy'
import { sharedPercent } from '../src/client-shared-number-format'

async function mount(page: Page, options: { running?: boolean; stale?: boolean; readonly?: boolean; passes?: boolean } = {}) {
  await page.route('**/strategy-proposal-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif"><div id="fixture" style="width:392px;max-width:100%"></div></body></html>' }))
  await page.goto('/strategy-proposal-test.html')
  await page.evaluate(async settings => {
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/node_modules/@fontsource-variable/noto-sans-sc/wght.css', '/node_modules/@fontsource-variable/geist/wght.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    const preferencesPath = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */ preferencesPath)
    preferences.setClientPreference('language', 'ko')
    Reflect.set(window, 'setProposalLanguage', (value: string) => preferences.setClientPreference('language', value))
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientStrategyProposal.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), { ClientStrategyProposal } = await import(/* @vite-ignore */ cp)
    const react = rm.default ?? rm, h = react.createElement
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    const state = { applies: 0, cancels: 0, behavior: 'success', settles: [] as ((failed: boolean) => void)[] }
    const perform = async () => {
      state.applies++
      if (state.behavior === 'failure') throw new Error('PRIVATE_SERVER_DETAIL')
      if (state.behavior === 'pending') await new Promise<void>((resolve, reject) => state.settles.push(failed => failed ? reject(new Error('PRIVATE_SERVER_DETAIL')) : resolve()))
    }
    function Host() {
      const [props, setProps] = react.useState({ running: settings.running ?? false, stale: settings.stale ?? false, readonly: settings.readonly ?? false })
      const [proposal, setProposal] = react.useState({ strategyId: 'a', baseVersion: 'v1', request: '손절 -3%로 바꿔줘', rows: [{ label: '손절선', current: '-5%', proposed: '-3%', delta: '▲ 2%p' }, { label: '추세 필터', current: '미사용', proposed: '사용', delta: '추가' }], notes: ['손절 -2.5% → 허용값 -3%로 조정'], unsupported: ['EMA 조건'], before: { ret: 12.5, mdd: -8.1, n: 18, winRate: 60 }, after: { ret: 15.2, mdd: -5.5, n: 23, winRate: 62 }, score: 83, passes: settings.passes ?? true })
      Object.assign(window, { proposalState: state, setProposal: (patch: object) => setProposal((old: object) => ({ ...old, ...patch })), setProposalProps: (patch: object) => setProps((old: object) => ({ ...old, ...patch })) })
      return h(ClientStrategyProposal, { ...props, proposal, onCancel: () => { state.cancels++ }, onApply: props.readonly ? undefined : perform })
    }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { unmountProposal: () => root.unmount() })
    root.render(h(react.StrictMode, null, h(Host)))
  }, options)
  await expect(page.getByRole('heading', { name: /전략 변경안/ })).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })
}
async function state(page: Page) { return page.evaluate(() => { const s = Reflect.get(window, 'proposalState'); return { applies: s.applies, cancels: s.cancels } }) }
async function behavior(page: Page, value: string) { await page.evaluate(next => { Reflect.get(window, 'proposalState').behavior = next }, value) }
async function patch(page: Page, value: object) { await page.evaluate(next => Reflect.get(window, 'setProposal')(next), value) }
async function props(page: Page, value: object) { await page.evaluate(next => Reflect.get(window, 'setProposalProps')(next), value) }
async function settle(page: Page, failed = false) { await page.evaluate(value => Reflect.get(window, 'proposalState').settles.shift()(value), failed) }

async function language(page: Page, value: string) {
  await page.evaluate(value => Reflect.get(window, 'setProposalLanguage')(value), value)
}

test('7언어 전환은 같은 변경안·표·초점·pending과 실패 후 재시도를 보존한다', async ({ page }) => {
  await mount(page, { running: true })
  const proposal = page.locator('.client-strategy-proposal'), table = page.locator('table'), scroll = page.locator('.comparison-scroll')
  const original = await proposal.elementHandle(), tableNode = await table.elementHandle()
  const rows = await page.locator('tbody').innerText()
  await scroll.focus()
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    const t = (key: keyof typeof strategyProposalCopy, values?: Record<string, string>) => strategyProposalText(locale, key, values)
    await language(page, locale)
    await expect(scroll).toHaveAccessibleName(t('comparison'))
    await expect(scroll).toBeFocused()
    await expect(page.getByRole('columnheader')).toHaveText([t('field'), 'CURRENT', 'PROPOSED', 'Δ'])
    await expect(page.locator('.imp small')).toHaveText([t('return'), t('drawdown'), t('trades'), t('score')])
    await expect(page.locator('.imp b').nth(0)).toHaveText(`${sharedPercent(12.5, locale)} → ${sharedPercent(15.2, locale)}`)
    await expect(page.locator('.imp b').nth(1)).toHaveText(`${sharedPercent(-8.1, locale, 1, false)} → ${sharedPercent(-5.5, locale, 1, false)}`)
    await expect(page.locator('.imp b').nth(2)).toHaveText(t('tradesValue', { before: '18', after: '23' }))
    await expect(page.locator('.imp b').nth(3)).toHaveText(t('scoreValue', { score: '83', status: t('passed') }))
    await expect(page.locator('.ap')).toHaveText(t('stopApply'))
    expect(await proposal.evaluate((el, previous) => el === previous, original)).toBe(true)
    expect(await table.evaluate((el, previous) => el === previous, tableNode)).toBe(true)
    expect(await page.locator('tbody').innerText()).toBe(rows)
    await expect(proposal).toContainText('손절 -2.5% → 허용값 -3%로 조정')
    await expect(proposal).toContainText(t('unsupported', { items: 'EMA 조건' }))
    await expect(proposal).toContainText(t('original', { request: '손절 -3%로 바꿔줘' }))
    await expect(proposal).toContainText(t('stopNotice', { status: t('stopped') }))
    await expect(proposal.locator('.nt2 b')).toHaveText(t('stopped'))
  }
  await behavior(page, 'pending')
  await page.locator('.ap').click()
  await language(page, 'en')
  await expect(proposal).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('status')).toHaveText(strategyProposalText('en', 'pending'))
  await expect(page.locator('.rej')).toBeDisabled()
  await page.locator('.ap').evaluate(el => { el.click(); el.click() })
  expect(await state(page)).toEqual({ applies: 1, cancels: 0 })
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveText(strategyActionsText('en', 'failed'))
  await language(page, 'fr')
  await expect(page.getByRole('alert')).toHaveText(strategyActionsText('fr', 'failed'))
  await expect(proposal).not.toContainText('PRIVATE_SERVER_DETAIL')
  await behavior(page, 'success')
  await page.locator('.ap').click()
  await language(page, 'ko')
  await expect(page.locator('.ap')).toBeDisabled()
  expect(await state(page)).toEqual({ applies: 2, cancels: 0 })
})

test('표시 배열과 원본 개수가 다르면 원본을 보여주고 적용을 차단한다', async ({ page }) => {
  await mount(page)
  const validDisplay = { rows: [{ label: 'Stop', current: '-5%', proposed: '-3%', delta: '▲ 2%p' }, { label: 'Trend', current: 'Off', proposed: 'On', delta: 'Added' }], notes: ['Adjusted stop'], unsupported: ['EMA'] }
  const node = await page.locator('.client-strategy-proposal').elementHandle()
  for (const field of ['rows', 'notes', 'unsupported'] as const) {
    await props(page, { presentation: { ...validDisplay, [field]: [] } })
    await expect(page.getByRole('rowheader')).toHaveText(['손절선', '추세 필터'])
    await expect(page.getByRole('alert')).toHaveText(strategyProposalText('ko', 'invalid'))
    await expect(page.locator('.ap')).toBeDisabled()
    await page.locator('.ap').evaluate(el => el.click())
  }
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
  await props(page, { presentation: validDisplay })
  await expect(page.getByRole('rowheader')).toHaveText(['Stop', 'Trend'])
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.ap')).toBeEnabled()
  expect(await page.locator('.client-strategy-proposal').evaluate((el, previous) => el === previous, node)).toBe(true)
})

test('264·320px 7언어 긴 문구와 수치가 잘리지 않고 원본 비교표를 유지한다', async ({ page }, info) => {
  await mount(page, { running: true })
  await patch(page, { before: { ret: -123.4, mdd: -99.9, n: 99999, winRate: 60 }, after: { ret: 125.6, mdd: -12.3, n: 100001, winRate: 62 } })
  for (const width of [264, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('#fixture').evaluate((el, width) => { el.style.width = `${width}px` }, width)
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      await language(page, locale)
      await page.evaluate(async () => { await document.fonts.ready })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      for (const button of await page.locator('.acts2 button').all()) {
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        expect(await button.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const box = el.getBoundingClientRect(); return [...range.getClientRects()].every(r => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom) })).toBe(true)
      }
      await expect(page.getByRole('columnheader')).toHaveCount(4)
      await expect(page.getByRole('rowheader')).toHaveText(['손절선', '추세 필터'])
      for (const metric of await page.locator('.imp b').all()) {
        expect(await metric.evaluate(el => {
          const range = document.createRange(); range.selectNodeContents(el)
          const parent = el.parentElement!.getBoundingClientRect()
          return [...range.getClientRects()].every(r => r.left >= parent.left && r.right <= parent.right && r.top >= parent.top && r.bottom <= parent.bottom)
        })).toBe(true)
      }
    }
    await page.locator('.client-strategy-proposal').screenshot({ path: info.outputPath(`proposal-fr-${width}.png`) })
  }
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
})

test('언어를 바꿔도 열린 변경안과 진행 요청은 유지하며 안내는 즉시 반영한다', async ({ page }) => {
  await mount(page)
  await language(page, 'en')
  await expect(page.getByRole('columnheader').first()).not.toHaveText('항목')
  await behavior(page, 'pending')
  await page.locator('.ap').click()
  await language(page, 'fr')
  await expect(page.locator('.ap')).toBeDisabled()
  expect(await state(page)).toEqual({ applies: 1, cancels: 0 })
  await settle(page, true)
  await expect(page.getByRole('alert')).not.toContainText('요청을 완료하지 못했습니다')
  await expect(page.getByRole('rowheader')).toHaveText(['손절선', '추세 필터'])
})

test('7언어 미달·미공급·무효·비정상 변경안은 적용 권한을 만들지 않는다', async ({ page }) => {
  await mount(page, { passes: false, readonly: true, stale: true })
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, locale)
    await expect(page.locator('.ap')).toHaveText(strategyProposalText(locale, 'cannotApply'))
    await expect(page.locator('.ap')).toHaveAttribute('title', strategyProposalText(locale, 'belowTitle'))
    await expect(page.locator('.ap')).toBeDisabled()
    await expect(page.getByRole('alert')).toHaveText(strategyProposalText(locale, 'stale'))
    await expect(page.locator('.client-strategy-proposal')).toContainText(strategyProposalText(locale, 'unavailable'))
    await expect(page.locator('.rej')).toBeEnabled()
    await page.locator('.ap').evaluate(el => el.click())
  }
  await props(page, { stale: false, readonly: false })
  await patch(page, { passes: true, before: { ret: NaN, mdd: -8.1, n: 18, winRate: 60 } })
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, locale)
    await expect(page.getByRole('alert')).toHaveText(strategyProposalText(locale, 'invalid'))
    await expect(page.locator('.imp b').first()).toContainText('—')
    await expect(page.locator('.ap')).toBeDisabled()
  }
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
})

test('요청 미리보기의 60자 경계에서 이모지와 조합 문자를 잘라내지 않는다', async ({ page }) => {
  await mount(page)
  for (const [request, expected] of [
    ['a'.repeat(59) + '😀 확인 요청', 'a'.repeat(59) + '…'],
    ['a'.repeat(58) + '👨‍👩‍👧‍👦 확인 요청', 'a'.repeat(58) + '…'],
    ['a'.repeat(59) + 'e\u0301 확인 요청', 'a'.repeat(59) + '…'],
  ]) {
    await patch(page, { request })
    await expect(page.locator('.client-strategy-proposal')).toContainText(strategyProposalText('ko', 'original', { request: expected }))
  }
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
})

test('264px 긴 미달 점수와 적용 불가 문구도 지표·버튼 안에 온전히 표시한다', async ({ page }, info) => {
  await mount(page, { running: true, passes: false })
  await page.setViewportSize({ width: 264, height: 900 })
  await patch(page, { score: 79 })
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, locale)
    await page.evaluate(async () => { await document.fonts.ready })
    await expect(page.locator('.imp b').last()).toHaveText(strategyProposalText(locale, 'scoreValue', { score: '79', status: strategyProposalText(locale, 'below') }))
    await expect(page.locator('.ap')).toBeDisabled()
    for (const item of await page.locator('.imp b, .acts2 button').all()) {
      expect(await item.evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el)
        const box = (el.tagName === 'B' ? el.parentElement! : el).getBoundingClientRect()
        return [...range.getClientRects()].every(r => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom)
      })).toBe(true)
    }
  }
  await page.locator('.client-strategy-proposal').screenshot({ path: info.outputPath('proposal-below-fr-264.png') })
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
})

test('표시 전용 행 갱신은 원본 변경안이나 진행 요청을 교체하지 않는다', async ({ page }) => {
  await mount(page)
  const panel = page.locator('.client-strategy-proposal'), original = await panel.elementHandle()
  await behavior(page, 'pending')
  await page.locator('.ap').click()
  await props(page, { presentation: {
    rows: [{ label: 'Stop loss', current: '-5%', proposed: '-3%', delta: '▲ 2%p' }, { label: 'Trend filter', current: 'Disabled', proposed: 'Enabled', delta: 'Added' }],
    notes: ['Stop -2.5% → allowed -3%'], unsupported: ['EMA condition'],
  } })
  await expect(page.getByRole('rowheader')).toHaveText(['Stop loss', 'Trend filter'])
  await expect(panel).toContainText('Stop -2.5% → allowed -3%')
  await expect(panel).toContainText('EMA condition')
  await expect(panel).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.ap')).toBeDisabled()
  expect(await panel.evaluate((el, previous) => el === previous, original)).toBe(true)
  expect(await state(page)).toEqual({ applies: 1, cancels: 0 })
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveText(strategyActionsText('ko', 'failed'))
  await props(page, { presentation: undefined })
  await expect(page.getByRole('rowheader')).toHaveText(['손절선', '추세 필터'])
  expect(await panel.evaluate((el, previous) => el === previous, original)).toBe(true)
})

test('원본 4열·지표·note·미지원·원문과 명시 적용만 제공한다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('columnheader')).toHaveText(['항목', 'CURRENT', 'PROPOSED', 'Δ'])
  await expect(page.getByRole('rowheader')).toHaveText(['손절선', '추세 필터'])
  await expect(page.locator('.imp')).toContainText('+12.5% → +15.2%')
  await expect(page.locator('.imp')).toContainText('-8.1% → -5.5%')
  await expect(page.locator('.imp')).toContainText('18 → 23회')
  await expect(page.locator('.imp')).toContainText('83점 통과')
  await expect(page.locator('.nt2')).toContainText(['손절 -2.5% → 허용값 -3%로 조정', '미지원이라 반영 안 됨: EMA 조건', '요청 원문: "손절 -3%로 바꿔줘". 위 표의 항목만 반영돼요. 원문의 다른 표현은 해석되지 않았어요.'])
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
  await page.getByRole('button', { name: '변경 적용', exact: true }).click()
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeDisabled()
  expect(await state(page)).toEqual({ applies: 1, cancels: 0 })
})

test('running 상태는 자동 중지·재개하지 않고 안내와 버튼만 바꾼다', async ({ page }) => {
  await mount(page, { running: true })
  await expect(page.getByText('적용 시 이 전략은', { exact: false })).toHaveText('적용 시 이 전략은 중지돼요. 자동 재개는 없으며, 확인 후 직접 재개해야 해요.')
  await expect(page.getByRole('button', { name: '중지하고 적용', exact: true })).toBeEnabled()
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect(await state(page)).toEqual({ applies: 0, cancels: 1 })
})

test('기준 미달·미공급·stale은 잠그며 취소는 가능하다', async ({ page }) => {
  await mount(page, { passes: false })
  await expect(page.getByRole('button', { name: '기준 미달, 적용 불가' })).toBeDisabled()
  await patch(page, { passes: true })
  await props(page, { readonly: true })
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeDisabled()
  await props(page, { readonly: false, stale: true })
  await expect(page.getByRole('alert')).toHaveText('전략 상태가 바뀌어 변경안이 무효화됐어요. 다시 요청해주세요')
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect(await state(page)).toEqual({ applies: 0, cancels: 1 })
})

test('async 대기 중 중복 적용·취소를 막고 실패한 제안은 재시도한다', async ({ page }) => {
  await mount(page)
  await behavior(page, 'pending')
  const apply = page.getByRole('button', { name: '변경 적용', exact: true })
  await apply.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(apply).toBeDisabled()
  await expect(page.getByRole('button', { name: '취소', exact: true })).toBeDisabled()
  await expect(page.getByRole('status')).toHaveText('적용 중…')
  expect(await state(page)).toEqual({ applies: 1, cancels: 0 })
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveText('요청을 완료하지 못했습니다. 다시 시도해주세요.')
  await expect(page.locator('body')).not.toContainText('PRIVATE_SERVER_DETAIL')
  await expect(page.getByRole('rowheader')).toHaveText(['손절선', '추세 필터'])
  await behavior(page, 'success')
  await apply.click()
  await expect(apply).toBeDisabled()
  expect(await state(page)).toEqual({ applies: 2, cancels: 0 })
})

test('대기 중 stale이 되면 실패 후에도 적용은 잠긴다', async ({ page }) => {
  await mount(page)
  await behavior(page, 'pending')
  await page.getByRole('button', { name: '변경 적용', exact: true }).click()
  await props(page, { stale: true })
  await settle(page, true)
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('변경안이 무효화')
  await expect(page.getByRole('button', { name: '취소', exact: true })).toBeEnabled()
})

test('새 전략·새 제안에 옛 실패가 섞이지 않고 unmount 후 응답도 무시한다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await behavior(page, 'pending')
  await page.getByRole('button', { name: '변경 적용', exact: true }).click()
  await patch(page, { strategyId: 'b', baseVersion: 'v2' })
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '변경 적용', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'unmountProposal')())
  await settle(page, true)
  expect(await state(page)).toEqual({ applies: 2, cancels: 0 })
  expect(errors).toEqual([])
})

test('원문은 60자까지만 표시하며 HTML 문구를 실행하지 않는다', async ({ page }) => {
  await mount(page)
  const request = '<script>alert(1)</script>' + '원문'.repeat(35)
  await patch(page, { request, notes: ['<img src=x onerror=alert(1)>'], unsupported: ['<script>EMA</script>'], rows: [{ label: '<b>손절선</b>', current: '<i>-5%</i>', proposed: '-3%', delta: '▲ 2%p' }] })
  await expect(page.getByRole('rowheader')).toHaveText('<b>손절선</b>')
  await expect(page.locator('.client-strategy-proposal')).toContainText(`요청 원문: "${request.slice(0, 60)}…".`)
  await expect(page.locator('.client-strategy-proposal script,.client-strategy-proposal img')).toHaveCount(0)
})

test('264·320px에서 원본 네 항목·4열·부호와 단위가 스크롤 없이 모두 보인다', async ({ page }, info) => {
  await mount(page)
  await patch(page, { rows: [
    { label: '손절선', current: '-7%', proposed: '-1%', delta: '▲ 6%p' },
    { label: '익절 목표', current: '+15%', proposed: '+8%', delta: '▼ -7%p' },
    { label: '진입 RSI 임계', current: '46', proposed: '38', delta: '▼ -8' },
    { label: '추세 필터', current: '미사용', proposed: '사용', delta: '추가' },
  ] })
  for (const width of [264, 320, 392]) {
    await page.locator('#fixture').evaluate((element, size) => { (element as HTMLElement).style.width = `${size}px` }, width)
    await page.evaluate(() => document.fonts.ready)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    const scroll = page.getByRole('region', { name: '전략 변경 비교표' })
    await expect.poll(() => scroll.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    const cells = await scroll.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return [...element.querySelectorAll('th,td')].map(cell => {
        const range = document.createRange()
        range.selectNodeContents(cell)
        const rect = range.getBoundingClientRect()
        return { visible: rect.left >= bounds.left && rect.right <= bounds.right, lines: range.getClientRects().length, numeric: cell.tagName === 'TD' }
      })
    })
    expect(cells.every(cell => cell.visible)).toBe(true)
    expect(cells.filter(cell => cell.numeric).every(cell => cell.lines === 1)).toBe(true)
    await scroll.focus()
    await expect(scroll).toBeFocused()
    for (const button of await page.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.locator('.client-strategy-proposal').screenshot({ path: info.outputPath(`proposal-${width}.png`) })
  }
  await page.getByRole('button', { name: '취소', exact: true }).focus()
  await page.keyboard.press('Enter')
  expect(await state(page)).toEqual({ applies: 0, cancels: 1 })
})

test('아주 긴 외부 값만 표 안에서 안전하게 스크롤하고 키보드로 접근한다', async ({ page }) => {
  await mount(page)
  await patch(page, { rows: [{ label: '외부 조건', current: '긴외부값'.repeat(30), proposed: '+15%', delta: '▲ 7%p' }] })
  await page.locator('#fixture').evaluate(element => { (element as HTMLElement).style.width = '264px' })
  const scroll = page.getByRole('region', { name: '전략 변경 비교표' })
  expect(await scroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await scroll.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => scroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('비어 있는 대상과 비유한 지표는 적용 권위를 만들지 않는다', async ({ page }) => {
  await mount(page)
  await patch(page, { strategyId: ' ' })
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'setProposal')({ strategyId: 'a', score: NaN }))
  await expect(page.getByRole('button', { name: '변경 적용', exact: true })).toBeDisabled()
  await expect(page.getByRole('alert')).toHaveText('변경안 정보가 올바르지 않습니다. 다시 요청해주세요.')
  expect(await state(page)).toEqual({ applies: 0, cancels: 0 })
})
