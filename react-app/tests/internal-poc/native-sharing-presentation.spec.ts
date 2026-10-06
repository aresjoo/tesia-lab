import { expect,test,type Page } from '@playwright/test'
test.afterEach(async ({ page }) => { await expect(page.locator('body')).not.toContainText('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY') })
async function mount(page:Page,ready=true) {
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('tethLang','ko'))
  await page.goto('/')
  await page.evaluate(async ready=>{
    const path='/tests/fixtures/sharing-service-harness.tsx'
    const {mountSharing}=await import(/* @vite-ignore */path)
    Reflect.set(window,'sharingHarness',mountSharing(ready))
  },ready)
  await expect(page.locator('#sharing-test-root .native-strategies')).toBeVisible()
}
async function settle(page:Page,kind:string,success=true){await page.evaluate(({kind,success})=>Reflect.get(window,'sharingHarness').settle(kind,success),{kind,success})}
const hub=(page:Page)=>page.locator('#sharing-test-root')

// Explicit display fixtures only. No account, publishing, or clipboard endpoint.
async function mountShareLinkBoundary(page: Page, own: boolean) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === new URL(page.url()).origin && route.request().method() === 'GET' ? route.continue() : route.abort()
  })
  await page.route('**/sharing-link-boundary.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="link-fixture"></div></body></html>' }))
  await page.goto('/sharing-link-boundary.html')
  await page.evaluate(async own => {
    const refreshPath = '/@react-refresh', rp = '/@id/react', dp = '/@id/react-dom/client'
    const cp = '/src/components/ClientStrategySharing.tsx', sp = '/src/client-shared-strategies.ts', pp = '/src/client-preferences.ts'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp)
    const react = rm.default ?? rm, dom = dm.default ?? dm
    const { ClientStrategySharing } = await import(/* @vite-ignore */ cp)
    const { sourceSharedStrategies } = await import(/* @vite-ignore */ sp)
    const { setClientPreference } = await import(/* @vite-ignore */ pp)
    setClientPreference('language', 'ko')
    const row = sourceSharedStrategies()[0]
    const root = dom.createRoot(document.getElementById('link-fixture'))
    let mode: 'url' | 'missing' | 'throw' = 'url'
    let clipboard: 'success' | 'failure' | 'pending' = 'success'
    let location = { nick: own ? 'me' : row.nick, period: 'all' }
    const clipboardCalls: string[] = [], pending: { resolve: () => void; reject: () => void }[] = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => {
      clipboardCalls.push(text)
      if (clipboard === 'pending') return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY')) }))
      return clipboard === 'failure' ? Promise.reject(new Error('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY')) : Promise.resolve()
    } } })
    const service = {
      state: 'ready', strategies: [row], watched: [], periodResult: () => row.result, indexToDate: (i: number) => new Date(Date.UTC(2031, 0, 1 + i)),
      shareUrl: () => { if (mode === 'throw') throw new Error('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY'); return mode === 'missing' ? null : 'https://example.test/synthetic-shared-strategy' },
      creator: { candidates: [], visible: true, nick: '합성 작성자', onPublish: async () => {}, onVisibility: async () => {}, publication: {
        id: '123', sourceId: '123', name: '합성 내 전략', createdAt: 123, publishedAt: '2031-01-04', description: '표시 경계 fixture', status: 'ready', environment: 'paper', parameters: null,
        asset: '비트코인', score: 88, ret: 12.3, mdd: -1, n: 2, winRate: 100,
      } },
    }
    const render = () => root.render(react.createElement(ClientStrategySharing, { location, owner: 'synthetic-sharing-owner', signedIn: true, servicePresentation: service,
      onAsk: () => {}, onReturn: () => {}, onLogin: () => {}, onNavigate: (next: typeof location) => { location = next; render() },
    }))
    Reflect.set(window, 'shareLinkBoundary', {
      clipboardCalls, setMode(next: typeof mode, rerender = false) { mode = next; if (rerender) render() },
      setClipboard(next: typeof clipboard) { clipboard = next }, settle(index: number, success: boolean) { if (success) pending[index].resolve(); else pending[index].reject() },
      leave() { location = { nick: '', period: 'all' }; render() },
    })
    render()
  }, own)
  await expect(page.locator('#link-fixture .ss3-dtitle')).toBeVisible()
}

test('내 게시 전략 링크 공급 오류는 상세를 제거하지 않고 복사만 비활성화한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mountShareLinkBoundary(page, true)
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').setMode('throw', true))
  await expect(page.locator('#link-fixture .ss3-dtitle')).toHaveText(/합성 내 전략/)
  await expect(page.getByRole('button', { name: '전략 링크 복사', exact: true })).toBeDisabled()
  await expect(page.locator('.ss3-matrix')).toContainText('+12.3%')
  expect(await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').clipboardCalls)).toEqual([])
  expect(errors).toEqual([])
})

for (const own of [false, true]) test(`${own ? '내 게시' : '일반'} 전략 복사 클릭 시 공급 오류는 기존 오류 안내로 복귀한다`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mountShareLinkBoundary(page, own)
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').setMode('throw'))
  const copy = page.getByRole('button', { name: '전략 링크 복사', exact: true })
  await copy.focus(); await copy.press('Enter')
  await expect(page.locator('.ss3-notice')).toHaveText('요청을 완료하지 못했어요. 내용을 확인하고 다시 시도해주세요.')
  await expect(page.locator('#link-fixture .ss3-dtitle')).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').clipboardCalls)).toEqual([])
  expect(errors).toEqual([])
})

for (const own of [false, true]) test(`${own ? '내 게시' : '일반'} 전략은 공급 URL 성공·복사 실패·미제공을 구분하고 뒤로가기를 유지한다`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mountShareLinkBoundary(page, own)
  const copy = page.getByRole('button', { name: '전략 링크 복사', exact: true })
  await copy.focus(); await copy.press('Enter')
  await expect(page.locator('.ss3-notice')).toHaveText('전략 링크를 복사했습니다')
  await expect(copy).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').setClipboard('failure'))
  await copy.press('Enter')
  await expect(page.locator('.ss3-notice')).toHaveText('https://example.test/synthetic-shared-strategy')
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').setMode('missing'))
  await copy.press('Enter')
  await expect(page.locator('.ss3-notice')).toHaveText('아직 제공되지 않은 정보입니다.')
  await expect(copy).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').clipboardCalls)).toEqual([
    'https://example.test/synthetic-shared-strategy', 'https://example.test/synthetic-shared-strategy',
  ])
  await page.locator('#link-fixture .tfbk-bc button').click()
  await expect(page.locator('#link-fixture .tfbk-filters')).toBeVisible()
  await expect(page.locator('#link-fixture .ss3-notice')).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const own of [false, true]) test(`${own ? '내 게시' : '일반'} 전략의 늦은 복사 완료는 새 요청·복귀 화면을 덮지 않는다`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mountShareLinkBoundary(page, own)
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').setClipboard('pending'))
  const copy = page.getByRole('button', { name: '전략 링크 복사', exact: true })
  await copy.click(); await copy.click()
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').settle(1, false))
  await expect(page.locator('.ss3-notice')).toHaveText('https://example.test/synthetic-shared-strategy')
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').settle(0, true))
  await expect(page.locator('.ss3-notice')).toHaveText('https://example.test/synthetic-shared-strategy')
  await copy.click()
  await page.locator('#link-fixture .tfbk-bc button').click()
  await expect(page.locator('#link-fixture .tfbk-filters')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').settle(2, false))
  await expect(page.locator('.ss3-notice')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'shareLinkBoundary').clipboardCalls.length)).toBe(3)
  expect(errors).toEqual([])
})
test('상세 링크 공급자가 실패해도 화면·제공된 수치는 유지하고 사유를 노출하지 않는다',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>localStorage.setItem('tethLang','ko'))
  await page.goto('/')
  await page.evaluate(async()=>{
    const path='/tests/fixtures/sharing-service-harness.tsx'
    const {mountSharing}=await import(/* @vite-ignore */path)
    mountSharing(true,true)
  })
  await hub(page).locator('.strategy-list-link').first().click()
  await expect(hub(page).locator('[data-metric="ret"] b')).toHaveText('+12.3%')
  await expect(hub(page).getByRole('button',{name:'전략 링크 복사',exact:true})).toBeDisabled()
  await hub(page).getByRole('tab',{name:'전략 정보',exact:true}).click()
  await expect(hub(page).locator('.shared-detail-info')).toContainText('공급된 작성자')
  expect(errors).toEqual([])
})
test('서비스 미공급은 원본 탐색을 보존하고 합성 목록·계좌·건수·저장을 만들지 않는다',async({page})=>{
  await mount(page,false)
  await expect(hub(page).locator('.tfbk-filters')).toBeVisible()
  await expect(hub(page).locator('article.tfbk-card')).toHaveCount(0)
  await expect(hub(page).locator('.client-sharing-counter')).toHaveCount(0)
  const before=await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>/copy-preview|sharing-watch/.test(k)))
  await hub(page).getByRole('button',{name:'따라가는 중',exact:true}).click()
  await expect(hub(page).locator('.cpd-card')).toHaveCount(0)
  await hub(page).getByRole('button',{name:'내 전략',exact:true}).click()
  await expect(hub(page)).toContainText('현재 대화 실행 기록')
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>/copy-preview|sharing-watch/.test(k)))).toEqual(before)
})
test('서비스 전략은 원본 상세·실제 공급 날짜/가격·기간별 결과를 재사용한다',async({page})=>{
  await mount(page)
  await hub(page).locator('.strategy-list-link').first().click()
  await expect(hub(page).locator('[data-metric="ret"] b')).toHaveText('+12.3%')
  await expect(hub(page).locator('.ss3-tbl')).toContainText('2031.01.01')
  await expect(hub(page).locator('.ss3-tbl')).toContainText('321')
  await expect(hub(page).getByRole('button',{name:'최근 2년',exact:true})).toBeDisabled()
  await hub(page).getByRole('button',{name:'최근 1년',exact:true}).click()
  await expect(hub(page).locator('[data-metric="ret"] b')).toHaveText('+7.1%')
  const watch=hub(page).getByRole('button',{name:'관심 전략',exact:true})
  await watch.click();await expect(watch).toHaveAttribute('aria-pressed','false');await expect(watch).toBeDisabled()
  await settle(page,'watch',false);await expect(hub(page).getByRole('status')).toContainText('다시 시도해주세요.')
  await watch.click();await settle(page,'watch');await expect(hub(page).getByRole('button',{name:'관심 전략 해제',exact:true})).toHaveAttribute('aria-pressed','true')
})
test('원본 프로필5탭·카피 설정은 공급값을 사용하고 성공 전 이동하지 않는다',async({page},info)=>{
  await mount(page)
  await hub(page).locator('.strategy-list-link').first().click()
  await hub(page).locator('.shared-detail-profile').click()
  await expect(hub(page).locator('.cpp-tabs button')).toHaveCount(5)
  await expect(hub(page).locator('.cpp-meta')).toContainText('7%')
  await hub(page).getByRole('button',{name:'90일',exact:true}).click()
  await expect(hub(page).locator('.cpp-grid')).toContainText('+90.00%')
  for(const [tab,content] of [['포지션','3,400.012345'],['손익 캘린더','+2.13%'],['자금 이동','350.25 USDC'],['카피하는 사람들','공급된 카피어']]){await hub(page).getByRole('button',{name:tab,exact:true}).click();await expect(hub(page)).toContainText(content)}
  await hub(page).getByRole('button',{name:'카피하기',exact:true}).click()
  await expect(hub(page).locator('.cps-bal')).toContainText('777.00 USDC')
  await hub(page).getByRole('textbox',{name:'카피 금액',exact:true}).fill('100')
  await hub(page).getByRole('button',{name:'카피 시작',exact:true}).click()
  await expect(hub(page).getByRole('button',{name:'카피 시작',exact:true})).toBeDisabled()
  await expect(hub(page).locator('.cps-wrap')).toBeVisible()
  await settle(page,'copy',false);await expect(hub(page).getByRole('alert')).toContainText('다시 시도해주세요.')
  await page.screenshot({path:info.outputPath('service-copy-setup.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await hub(page).getByRole('button',{name:'카피 시작',exact:true}).click();await settle(page,'copy');await expect(hub(page).locator('.cpd-heading').first()).toContainText('실시간 카피')
})
test('크리에이터 원본3단계는 비동기 공개·공개전환 확인 뒤만 성공 표시한다',async({page})=>{
  await mount(page)
  await hub(page).getByRole('button',{name:'내 전략',exact:true}).click()
  await hub(page).getByRole('button',{name:'내 전략 공유하기',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'다음 단계',exact:true}).click()
  await page.getByRole('dialog').getByRole('textbox').fill('공급된 소개')
  await page.getByRole('dialog').getByRole('button',{name:'다음 단계',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'공개하고 랭킹 등록하기',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible();await expect(hub(page).locator('.ss3-creator-tiles')).toHaveCount(0)
  await settle(page,'publish',false);await expect(page.getByRole('dialog').getByRole('alert')).toContainText('다시 시도해주세요.')
  await page.getByRole('dialog').getByRole('button',{name:'공개하고 랭킹 등록하기',exact:true}).click();await settle(page,'publish')
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(hub(page).locator('.ss3-creator-tiles')).toBeVisible()
  const toggle=hub(page).getByRole('switch',{name:'랭킹 공개'})
  await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');await settle(page,'visibility');await expect(toggle).toHaveAttribute('aria-checked','false')
})

test('원본 복제 조건·예상 결과 모달은 공급 검증 완료 전 수치·성공을 만들지 않는다',async({page})=>{
  await mount(page)
  await hub(page).locator('.strategy-list-link').first().click()
  await hub(page).getByRole('button',{name:'전략 복사하기',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('combobox')).toHaveCount(3)
  await dialog.getByRole('button',{name:'다음: 예상 결과 보기',exact:true}).click()
  await expect(dialog.locator('.ss3-copy-metrics .mx b')).toHaveText(['—','—','—','—'])
  await expect(dialog.getByRole('button',{name:'확정하고 검증 시작',exact:true})).toBeDisabled()
  await settle(page,'validate-copy')
  await expect(dialog.locator('.ss3-copy-metrics')).toContainText('+5.6%')
  await dialog.getByRole('button',{name:'확정하고 검증 시작',exact:true}).click()
  await expect(dialog).toBeVisible();await settle(page,'validate-confirm',false)
  await expect(dialog.getByRole('alert')).toContainText('다시 시도해주세요.')
  await dialog.getByRole('button',{name:'확정하고 검증 시작',exact:true}).click();await settle(page,'validate-confirm')
  await expect(dialog).toHaveCount(0)
})

test('owner 변경은 원본 탐색으로 돌아가며 이전 카피 응답이 새 화면을 이동시키지 않는다',async({page})=>{
  await mount(page)
  await hub(page).locator('.strategy-list-link').first().click()
  await hub(page).locator('.shared-detail-profile').click()
  await hub(page).getByRole('button',{name:'카피하기',exact:true}).click()
  await hub(page).getByRole('textbox',{name:'카피 금액',exact:true}).fill('100')
  await hub(page).getByRole('button',{name:'카피 시작',exact:true}).click()
  await page.evaluate(()=>window.dispatchEvent(new Event('sharing-test-owner')))
  await expect(hub(page).locator('.tfbk-filters')).toBeVisible()
  await settle(page,'copy')
  await expect(hub(page).getByRole('button',{name:'전략 찾기',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(hub(page).locator('.cps-wrap')).toHaveCount(0)
})
