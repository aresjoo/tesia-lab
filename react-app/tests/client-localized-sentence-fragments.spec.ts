import { expect, test, type Page } from '@playwright/test'
import dictionary from '../src/client-static-ui-copy.json' with { type: 'json' }

// Independent reviewed literals; expectations never come from the product dictionary.
const oracle = {
  "{asset} 가격, 매수 전후 ": [
    "{asset} 가격, 매수 전후 ",
    "{asset} price, before and after the buy ",
    "{asset}の価格、購入前後 ",
    "{asset} 价格，买入前后 ",
    "{asset} 價格，買入前後 ",
    "Precio de {asset}, antes y después de la compra ",
    "Prix de {asset}, avant et après l'achat "
  ],
  "{asset} 현물 종가(참고), 진입 전후 ": [
    "{asset} 현물 종가(참고), 진입 전후 ",
    "{asset} spot close (reference), before and after entry ",
    "{asset}の現物終値（参考）、エントリー前後 ",
    "{asset} 现货收盘价（参考），入场前后 ",
    "{asset} 現貨收盤價（參考），進場前後 ",
    "Cierre al contado de {asset} (referencia), antes y después de la entrada ",
    "Clôture au comptant de {asset} (référence), avant et après l'entrée "
  ],
  "밝은 구간이 들고 있던 기간입니다": [
    "밝은 구간이 들고 있던 기간입니다",
    "The bright section is the period it was held.",
    "明るい区間は保有していた期間です。",
    "亮色区间为持有期间。",
    "亮色區間為持有期間。",
    "La zona clara es el período en que se mantuvo.",
    "La zone claire correspond à la période de détention."
  ],
  "밝은 구간이 포지션을 들고 있던 기간입니다": [
    "밝은 구간이 포지션을 들고 있던 기간입니다",
    "The bright section is the period the position was held.",
    "明るい区間はポジションを保有していた期間です。",
    "亮色区间为持有仓位的期间。",
    "亮色區間為持有部位的期間。",
    "La zona clara es el período en que se mantuvo la posición.",
    "La zone claire correspond à la période pendant laquelle la position a été conservée."
  ],
  "판 이유: {reason}": [
    "판 이유: {reason}",
    "Reason for selling: {reason}",
    "売却の理由: {reason}",
    "卖出原因：{reason}",
    "賣出原因：{reason}",
    "Motivo de la venta: {reason}",
    "Raison de la vente : {reason}"
  ],
  "청산한 이유: {reason}": [
    "청산한 이유: {reason}",
    "Reason for closing: {reason}",
    "決済した理由: {reason}",
    "平仓原因：{reason}",
    "平倉原因：{reason}",
    "Motivo del cierre: {reason}",
    "Raison de la clôture : {reason}"
  ],
  "가격 자료 준비 → 하루씩 다시 돌리기 → 기회마다 AI 확인 → 결과 정리": [
    "가격 자료 준비 → 하루씩 다시 돌리기 → 기회마다 AI 확인 → 결과 정리",
    "Prepare price data → Replay day by day → AI check at each opportunity → Summarize results",
    "価格データの準備 → 1日ずつ再実行 → チャンスごとにAIで確認 → 結果の整理",
    "准备价格数据 → 逐日重新运行 → 每个机会由AI确认 → 整理结果",
    "準備價格資料 → 逐日重新執行 → 每個機會由AI確認 → 整理結果",
    "Preparar los datos de precios → Repetir día a día → Verificación de la IA en cada oportunidad → Resumir los resultados",
    "Préparer les données de prix → Rejouer jour par jour → Vérification par l'IA à chaque opportunité → Synthétiser les résultats"
  ],
  "가격 자료 준비 → 하루씩 다시 돌리기 → 사는 조건 확인 → 결과 정리": [
    "가격 자료 준비 → 하루씩 다시 돌리기 → 사는 조건 확인 → 결과 정리",
    "Prepare price data → Replay day by day → Check buy conditions → Summarize results",
    "価格データの準備 → 1日ずつ再実行 → 購入条件の確認 → 結果の整理",
    "准备价格数据 → 逐日重新运行 → 检查买入条件 → 整理结果",
    "準備價格資料 → 逐日重新執行 → 檢查買入條件 → 整理結果",
    "Preparar los datos de precios → Repetir día a día → Comprobar las condiciones de compra → Resumir los resultados",
    "Préparer les données de prix → Rejouer jour par jour → Vérifier les conditions d'achat → Synthétiser les résultats"
  ],
  "검증 구간 평가 {count}": [
    "검증 구간 평가 {count}",
    "The validation-interval evaluation covers {count}.",
    "検証区間の評価対象は{count}です。",
    "验证区间的评估范围为{count}。",
    "驗證區間的評估範圍為{count}。",
    "La evaluación del intervalo de validación abarca {count}.",
    "L'évaluation de l'intervalle de validation porte sur {count}."
  ],
  "1봉": [
    "1봉",
    "1 candle",
    "ローソク足1本",
    "1根K线",
    "1根K線",
    "1 vela",
    "1 bougie"
  ],
  "{bars}봉": [
    "{bars}봉",
    "{bars} candles",
    "ローソク足{bars}本",
    "{bars}根K线",
    "{bars}根K線",
    "{bars} velas",
    "{bars} bougies"
  ]
} as const
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const opaqueReason = "사용자/API 원문 $& <이유> 12.34%"
async function localShell(page: Page, baseURL: string) {
  const forbidden: string[] = [], errors: string[] = [], origin = new URL(baseURL).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const r = route.request(), u = new URL(r.url())
    if (u.origin !== origin || u.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(r.method())) { forbidden.push(r.method() + ' ' + u.pathname); return route.abort() }
    return route.continue()
  })
  await page.route('**/sentence-polish.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#171717;color:#ececec"><main id="fixture"></main></body></html>' }))
  await page.goto('/sentence-polish.html')
  await page.addScriptTag({ type: 'module', content: `import runtime from '/@react-refresh'; runtime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>value=>value; window.__vite_plugin_react_preamble_installed__=true; const {setClientPreference}=await import('/src/client-preferences.ts'); window.sentenceLanguage=language=>setClientPreference('language',language);` })
  await page.waitForFunction(() => typeof Reflect.get(window, 'sentenceLanguage') === 'function')
  await page.addScriptTag({ type: 'module', content: "await import('/src/styles.css'); await import('/src/client-reference.css');" })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 1000 })
  return { forbidden, errors }
}
async function language(page: Page, value: string) {
  await page.evaluate(value => Reflect.get(window, 'sentenceLanguage')(value), value)
  await expect(page.locator('html')).toHaveAttribute('lang', value)
}
const literal = (key: keyof typeof oracle, index: number, values: Record<string, string | number> = {}) =>
  oracle[key][index].replace(/\{(\w+)\}/g, (token, slot: string) => values[slot] === undefined ? token : String(values[slot]))

test('sentence fragments: seven-column whole templates retain exact slots', () => {
  for (const [key, expected] of Object.entries(oracle)) {
    expect(dictionary[key as keyof typeof dictionary], key).toEqual(expected)
    for (const row of expected) expect((row.match(/\{\w+\}/g) ?? []).sort()).toEqual((key.match(/\{\w+\}/g) ?? []).sort())
  }
})

test('sentence fragments: trade detail full sentences preserve USD, opaque reason and geometry', async ({ page, baseURL }, info) => {
  const guard = await localShell(page, baseURL!)
  await page.addScriptTag({ type: 'module', content: `const {ClientCatalogueEvidence}=await import('/src/components/ClientCatalogueEvidence.tsx'); const rm=await import('/@id/react'),React=rm.default??rm,dm=await import('/@id/react-dom/client'),createRoot=dm.createRoot??dm.default.createRoot;
const {loadCatalogueMarketData}=await import('/src/client-catalogue-market-data.ts');const {computeCatalogueBacktest}=await import('/src/client-catalogue-backtest-result.ts');const {initialEvidenceState}=await import('/src/client-catalogue-evidence-state.ts');await import('/src/client-reference.css');
await import('/src/client-catalogue-backtest.css');document.getElementById('fixture').className='client-catalogue-bt bt';const market=await loadCatalogueMarketData(), root=createRoot(document.getElementById('fixture'));let value,state,before;
const render=()=>root.render(React.createElement(ClientCatalogueEvidence,{value,state,onChange:next=>{state=next;render()}}));
window.sentenceTrade=id=>{value=structuredClone(computeCatalogueBacktest({owner:'sentence-preview',strategyId:id,period:365,amount:1000},market));const trade=value.result.trades.at(-1);if(!trade)throw Error('Closed source trade missing');const decision=value.evidence.decisions.find(d=>d.k==='sell'&&d.tid===trade.id);if(!decision)throw Error('Source closing reason missing');decision.why="사용자/API 원문 $& <이유> 12.34%";state={...initialEvidenceState(value.strategy),selection:{runId:value.runId,type:'trade',index:trade.id,j:trade.entry-value.result.eq[0].i}};before=JSON.stringify(value);render()};window.sentenceObservationUnchanged=()=>before===JSON.stringify(value);` })
  await page.waitForFunction(() => typeof Reflect.get(window, 'sentenceTrade') === 'function')
  for (const [strategyId, futures] of [['r1', false], ['f7', true]] as const) {
    await language(page, 'ko')
    await page.evaluate(id => Reflect.get(window, 'sentenceTrade')(id), strategyId)
    const detail = page.locator('.bt-tr.on .bt-dd-in'), header = detail.locator('.bt-dd-c small'), caption = detail.locator('.bt-cap2'), why = detail.locator('.bt-after')
    await expect(caption).toBeVisible()
    const asset = (await header.textContent())!.split(futures ? ' 현물 종가(참고)' : ' 가격')[0]
    const geometry = () => detail.locator('.bt-mini path, .bt-mini line, .bt-mini circle, .bt-mini rect').evaluateAll(nodes => nodes.map(node => [...node.attributes].map(attr => [attr.name, attr.value])))
    const beforeGeometry = await geometry(), originalNode = await caption.elementHandle()
    for (const [index, locale] of locales.entries()) {
      await language(page, locale)
      await expect(header).toHaveText(literal(futures ? '{asset} 현물 종가(참고), 진입 전후 ' : '{asset} 가격, 매수 전후 ', index, { asset }) + 'USD')
      await expect(header.locator('i')).toHaveText('USD')
      await expect(caption).toHaveText(literal(futures ? '밝은 구간이 포지션을 들고 있던 기간입니다' : '밝은 구간이 들고 있던 기간입니다', index))
      await expect(why).toHaveText(literal(futures ? '청산한 이유: {reason}' : '판 이유: {reason}', index, { reason: opaqueReason }))
      expect(await caption.evaluate((node, original) => node === original, originalNode)).toBe(true)
      expect(await geometry()).toEqual(beforeGeometry)
      expect(await page.evaluate(() => Reflect.get(window, 'sentenceObservationUnchanged')())).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
    await detail.screenshot({ path: info.outputPath(strategyId + '-whole-sentences.png') })
  }
  expect(guard.errors).toEqual([]); expect(guard.forbidden).toEqual([])
})

test('sentence fragments: actual backtest run uses full branch pipelines with saved state unchanged', async ({ page, baseURL }) => {
  await page.clock.setFixedTime(new Date('2026-10-07T00:00:00Z'))
  const guard = await localShell(page, baseURL!)
  await page.addScriptTag({ type: 'module', content: "const {mount}=await import('/tests/fixtures/catalogue-backtest-host.tsx'); window.sentenceBacktest=mount();" })
  await page.waitForFunction(() => Boolean(Reflect.get(window, 'sentenceBacktest')))
  for (const [strategy, ai] of [['r1', false], ['d1', true]] as const) {
    await language(page, 'ko')
    await page.evaluate(id => Reflect.get(window, 'sentenceBacktest').strategy(id), strategy)
    const host = page.getByTestId('catalogue-backtest-shell')
    await expect(host).toHaveAttribute('data-strategy-id', strategy)
    await expect(host).toHaveAttribute('data-phase', 'ready')
    await page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
    await expect(host).toHaveAttribute('data-phase', 'run')
    const saved = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))
    for (const [index, locale] of locales.entries()) {
      await language(page, locale)
      await expect(host.locator('.bt-read > p')).toHaveText(literal(ai ? '가격 자료 준비 → 하루씩 다시 돌리기 → 기회마다 AI 확인 → 결과 정리' : '가격 자료 준비 → 하루씩 다시 돌리기 → 사는 조건 확인 → 결과 정리', index))
      await expect(host).toHaveAttribute('data-phase', 'run')
      expect(await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))).toBe(saved)
      expect(await page.evaluate(() => Reflect.get(window, 'sentenceBacktest').calls.length)).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
  }
  expect(guard.errors).toEqual([]); expect(guard.forbidden).toEqual([])
})

test('sentence fragments: user log whole sentence keeps singular and plural counts bold', async ({ page, baseURL }, info) => {
  const guard = await localShell(page, baseURL!)
  await page.addScriptTag({ type: 'module', content: `const {ClientUserStrategy}=await import('/src/components/ClientUserStrategy.tsx');const rm=await import('/@id/react'),React=rm.default??rm,dm=await import('/@id/react-dom/client'),createRoot=dm.createRoot??dm.default.createRoot;await import('/src/client-reference.css');const root=createRoot(document.getElementById('fixture'));let record,before;
window.sentenceUser=count=>{const createdAt=Date.UTC(2026,8,15);record={id:String(createdAt),name:'사용자 전략 이름 $& 그대로',createdAt,status:'live',environment:'paper',parameters:{sl:-5,tp:10,rsiTh:44,trendFilter:true,startI:61,endI:60+count},score:87,ret:12.3,mdd:-6.2,n:31,winRate:54.7,origin:'사용자 원문'};before=JSON.stringify(record);root.render(React.createElement(ClientUserStrategy,{record,events:null,money:value=>String(value),onNavigate:()=>{throw Error('Unexpected navigation')}}))};window.sentenceRecordUnchanged=()=>before===JSON.stringify(record);` })
  await page.waitForFunction(() => typeof Reflect.get(window, 'sentenceUser') === 'function')
  for (const count of [1, 2]) {
    await language(page, 'ko')
    await page.evaluate(count => Reflect.get(window, 'sentenceUser')(count), count)
    const summary = page.locator('.user-log .nfxl-sum > span').first()
    await expect(summary).toHaveText('검증 구간 평가 ' + count + '봉')
    for (const [index, locale] of locales.entries()) {
      await language(page, locale)
      const units = literal(count === 1 ? '1봉' : '{bars}봉', index, { bars: count })
      await expect(summary).toHaveText(literal('검증 구간 평가 {count}', index, { count: units }))
      await expect(summary.locator('b')).toHaveText(units)
      await expect(page.locator('.nfxb-title')).toHaveText('사용자 전략 이름 $& 그대로')
      expect(await page.evaluate(() => Reflect.get(window, 'sentenceRecordUnchanged')())).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
    await page.locator('.user-log').screenshot({ path: info.outputPath('user-log-count-' + count + '.png') })
  }
  expect(guard.errors).toEqual([]); expect(guard.forbidden).toEqual([])
})
