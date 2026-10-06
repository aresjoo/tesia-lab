import { expect, test, type Page } from '@playwright/test'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { delegationBudgets } from '../src/client-delegation-fixtures'
import type { SharedFollowRecord } from '../src/client-shared-follow'
import { sharedCopyCopy } from '../src/client-shared-copy-copy'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const titles = ['전략 따라하기', 'Follow strategy', '戦略をフォロー', '跟随策略', '跟隨策略', 'Seguir estrategia', 'Suivre la stratégie']
const previews = ['예상 결과 확인', 'View expected results', '予想結果の確認', '查看预估结果', '查看預估結果', 'Ver resultados esperados', 'Voir les résultats attendus']
async function language(page: Page, locale: string) {
  await page.evaluate(async locale => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    setClientPreference('language', locale)
  }, locale)
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
}

const owner = 'copy-detail@example.test'
const prior = { id: 'copy-detail-original', title: '기존 원문 대화', renamed: true, idea: '비트코인 반등', draft: '원래 미전송 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], updatedAt: 1 }
const seed = sourceSharedStrategies().find(row => row.asset === '이더리움')!

async function openCopy(page: Page, saved?: SharedFollowRecord) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, prior, saved }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복제 상세 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: prior.id, homeDraft: '기존 홈 원문', sessions: [prior], sharedFollows: saved ? [saved] : [] }))
  }, { owner, prior, saved })
  await page.goto(saved ? '/#/share' : `/${sharedHash({ nick: seed.nick, period: '1y' })}`)
  if (saved) {
    await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
    await page.locator(`[data-follow-id="${saved.id}"]`).getByRole('button', { name: '다시 검증', exact: true }).click()
  } else await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  const intro = page.getByRole('dialog', { name: '이 전략을 따라하려면 연결이 필요해요', exact: true })
  await expect(intro).toBeVisible()
  await intro.getByRole('button', { name: '나중에 하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

const snapshot = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
const archived = (parameters: SharedFollowRecord['parameters']): SharedFollowRecord => ({ id: 'copy-detail-saved', owner, nick: seed.nick, asset: seed.asset, parameters, budgetIndex: 2, sessionId: 'copy-detail-earlier', confirmedAt: 17000, active: false })
const periodLabel = (parameters: SharedFollowRecord['parameters']) => {
  const span = parameters.endI - parameters.startI
  return span >= sourceTerminalPrices.length - 62 ? '전체 기간' : span > 700 ? '최근 2년' : '최근 1년'
}

test('손절선선택지는원본4개비율과판단설명을함께표시한다', async ({ page }, info) => {
  const dialog = await openCopy(page)
  await page.screenshot({ path: info.outputPath('copy-ko-stop-options.png') })
  const options = dialog.getByRole('combobox', { name: '손절선', exact: true }).locator('option')
  await expect(options).toContainText(['-3%까지 (짧게 끊기)', '-5%까지 (표준)', '-8%까지 (여유있게)', '-12%까지 (길게 버티기)'])
})

test('예상결과는실제변경전후조건과상세조회기간이아닌원설정검증구간을표시한다', async ({ page }, info) => {
  const dialog = await openCopy(page)
  const sl = seed.parameters.sl === -3 ? -5 : -3, tp = seed.parameters.tp === 15 ? 8 : 15
  await dialog.getByRole('combobox', { name: '손절선', exact: true }).selectOption(String(sl))
  await dialog.getByRole('combobox', { name: '익절 목표', exact: true }).selectOption(String(tp))
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const preview = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  await expect(preview).toBeVisible()
  await page.screenshot({ path: info.outputPath('copy-ko-changes-period.png') })
  expect.soft(await preview.innerText()).toContain(`원본과 달라진 조건: 손절 ${seed.parameters.sl}% → ${sl}%, 익절 +${seed.parameters.tp}% → +${tp}%`)
  expect.soft(await preview.innerText()).toContain('검증 구간')
  expect.soft(await preview.innerText()).toContain(periodLabel(seed.parameters))
})

for (const changed of ['none', 'sl', 'tp'] as const) test(`${changed}변경비교는실제달라진항목만표시하고확정전저장하지않는다`, async ({ page }) => {
  const dialog = await openCopy(page), before = await snapshot(page)
  const sl = seed.parameters.sl === -3 ? -5 : -3, tp = seed.parameters.tp === 15 ? 8 : 15
  if (changed === 'sl') await dialog.getByRole('combobox', { name: '손절선', exact: true }).selectOption(String(sl))
  if (changed === 'tp') await dialog.getByRole('combobox', { name: '익절 목표', exact: true }).selectOption(String(tp))
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const preview = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  if (changed === 'none') await expect(preview.getByText(/원본과 달라진 조건:/)).toHaveCount(0)
  else await expect(preview.getByText(/원본과 달라진 조건:/)).toHaveText(changed === 'sl' ? `원본과 달라진 조건: 손절 ${seed.parameters.sl}% → ${sl}%` : `원본과 달라진 조건: 익절 +${seed.parameters.tp}% → +${tp}%`)
  expect(await snapshot(page)).toEqual(before)
  await page.keyboard.press('Escape')
  expect(await snapshot(page)).toEqual(before)
})

for (const tp of [null, 17]) test(`저장된옵션외손절과익절${tp}은원설정및기간을덮지않는다`, async ({ page }) => {
  const parameters = { ...seed.parameters, sl: -7, tp, rsiTh: 39, trendFilter: false, startI: 400, endI: 1200 }
  const saved = archived(parameters), dialog = await openCopy(page, saved), before = await snapshot(page)
  await expect(dialog.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue('-7')
  await expect(dialog.getByRole('combobox', { name: '익절 목표', exact: true })).toHaveValue(tp === null ? 'none' : '17')
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const preview = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  await expect(preview).toContainText(tp === null ? '기간 청산' : '+17%')
  await expect(preview).toContainText(periodLabel(parameters))
  await expect(preview.getByText(/원본과 달라진 조건:/)).toHaveCount(0)
  await preview.getByRole('button', { name: '뒤로', exact: true }).click()
  await dialog.getByRole('combobox', { name: '손절선', exact: true }).selectOption('-3')
  await dialog.getByRole('combobox', { name: '익절 목표', exact: true }).selectOption('8')
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await expect(preview.getByText(/원본과 달라진 조건:/)).toHaveText(`원본과 달라진 조건: 손절 -7% → -3%, 익절 ${tp === null ? '기간 청산' : '+17%'} → +8%`)
  expect(await snapshot(page)).toEqual(before)
  await preview.getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(dialog.getByRole('combobox', { name: '익절 목표', exact: true })).toHaveValue('8')
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await preview.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${seed.asset} 전략 검증`, exact: true })).toBeVisible()
  const after = await snapshot(page)
  expect(after.sessions.find((session: { id: string }) => session.id === prior.id)).toEqual(before.sessions[0])
  expect(after.sharedFollows).toHaveLength(1)
  expect(after.sharedFollows[0]).toMatchObject({ id: saved.id, parameters: { ...parameters, sl: -3, tp: 8 } })
  expect(after.sharedFollows[0].sessionId).not.toBe(saved.sessionId)
})

for (const span of [700, 701]) test(`저장된검증span${span}은원본700경계의엄격부등호를보존한다`, async ({ page }) => {
  const endI = sourceTerminalPrices.length - 1
  const saved = archived({ ...seed.parameters, startI: endI - span, endI })
  const dialog = await openCopy(page, saved)
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await expect(page.locator('.ss3-copy-summary dd').nth(3)).toHaveText(span === 700 ? '최근 1년' : '최근 2년')
})

test('6회미만표본과80미만점수가함께있을때원본표본페널티를설명한다', async ({ page }) => {
  const parameters = { ...seed.parameters, startI: sourceTerminalPrices.length - 80, endI: sourceTerminalPrices.length - 1 }
  const saved = archived(parameters), result = evaluateDelegation(parameters, delegationBudgets[saved.budgetIndex])
  expect(result.score).toBeLessThan(80)
  expect(result.result.n).toBeLessThan(6)
  const dialog = await openCopy(page, saved)
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const preview = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  await expect(preview).toContainText(`표본 ${result.result.n}회가 적어 점수에 페널티가 있어요`)
  await expect(preview).toContainText(`${result.score}점`)
  await expect(preview).toContainText('정식 검증에서 조건을 조정하게 될 수 있어요.')
})

test('80미만이라도표본6회이상이면표본부족문구를추측해붙이지않는다', async ({ page }) => {
  const options = [-3, -5, -8, -12].flatMap(sl => [8, 10, 12, 15].map(tp => {
    const parameters = { ...seed.parameters, sl, tp, rsiTh: 35, trendFilter: false }
    return { parameters, evaluated: evaluateDelegation(parameters, delegationBudgets[2]) }
  }))
  const candidate = options.find(({ evaluated }) => evaluated.score < 80 && evaluated.result.n >= 6)
  expect(candidate).toBeDefined()
  const dialog = await openCopy(page, archived(candidate!.parameters))
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await expect(page.locator('.ss3-copy-warning')).toContainText('실행 기준(80점)에 못 미쳐요.')
  await expect(page.locator('.ss3-copy-warning')).not.toContainText('표본')
})

test('뒤로수정후확정은선택된규칙의독립세션만만들고원대화와홈초안을보존한다', async ({ page }) => {
  await page.clock.install()
  const dialog = await openCopy(page), before = await snapshot(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000))
  await dialog.getByRole('combobox', { name: '손절선', exact: true }).selectOption('-3')
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const preview = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  await preview.getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(dialog.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue('-3')
  await dialog.getByRole('combobox', { name: '익절 목표', exact: true }).selectOption('15')
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  expect(await snapshot(page)).toEqual(before)
  await preview.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${seed.asset} 전략 검증`, exact: true })).toBeVisible()
  const after = await snapshot(page)
  expect(after.sessions).toHaveLength(before.sessions.length + 1)
  expect(after.sessions.find((session: { id: string }) => session.id === prior.id)).toEqual(before.sessions.find((session: { id: string }) => session.id === prior.id))
  expect(after.homeDraft).toBe(before.homeDraft)
  const ui = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!), after.currentId)
  expect(ui.parameters).toEqual({ ...seed.parameters, sl: -3, tp: 15 })
  expect(ui.workStep).toBe(0)
})

for (const width of [320, 1440]) test(`${width}px복제두단계의요약과고정CTA는화면안에서읽히고누를수있다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  await openCopy(page)
  for (const step of [1, 2]) {
    const dialog = page.getByRole('dialog'), controls = dialog.locator('header h2,header button,.ss3-dacts>button')
    for (const locale of ['ko', 'fr'] as const) {
      await language(page, locale)
    for (const scroll of ['start', 'end']) {
      await dialog.locator('.ss3-dialog-body').evaluate((el, scroll) => { el.scrollTop = scroll === 'start' ? 0 : el.scrollHeight }, scroll)
      for (const control of await controls.all()) {
        const rect = (await control.boundingBox())!
        expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.width).toBeLessThanOrEqual(width)
        expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize()!.height)
        if (await control.evaluate(el => el.tagName === 'BUTTON')) expect(await control.evaluate(el => {
          const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          return hit === el || el.contains(hit)
        })).toBe(true)
      }
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      if (locale === 'fr' && scroll === 'start') await page.screenshot({ path: info.outputPath(`copy-fr-${width}-step-${step}-top.png`) })
    }
      if (step === 2) {
        for (const row of await dialog.locator('.ss3-copy-summary > div').all()) {
          const label = (await row.locator('dt').boundingBox())!, value = (await row.locator('dd').boundingBox())!
          expect(label.x + label.width).toBeLessThanOrEqual(value.x)
          expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        }
        for (const metric of await dialog.locator('.ss3-copy-metrics .mx').all()) {
          const label = (await metric.locator('small').boundingBox())!, value = (await metric.locator('b').boundingBox())!
          expect(label.y + label.height).toBeLessThanOrEqual(value.y + 1)
        }
        if (locale === 'fr') {
          const count = dialog.locator('.ss3-copy-metrics .mx').last().locator('b')
          await expect(count.locator('.ss3-copy-unit')).toHaveText(' transactions')
          const line = await count.evaluate(el => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight) }))
          expect(line.height).toBeCloseTo(line.lineHeight, 1)
          expect(await dialog.locator('.ss3-copy-metrics .mx').last().locator('small,b').evaluateAll(elements => elements.map(el => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
            let text: Node | null
            while ((text = walker.nextNode())) {
              const start = text.textContent!.indexOf('transactions')
              if (start < 0) continue
              const range = document.createRange()
              range.setStart(text, start); range.setEnd(text, start + 'transactions'.length)
              return range.getClientRects().length
            }
            return 0
          }))).toEqual([1, 1])
        }
      }
      await page.screenshot({ path: info.outputPath(`copy-${locale}-${width}-step-${step}.png`) })
    }
    if (step === 1) await dialog.getByRole('button', { name: sharedCopyCopy('fr', '다음: 예상 결과 보기'), exact: true }).click()
  }
})

for (const [index, locale] of locales.entries()) test(`${locale}복제조건·요약·명시확정문구는원금과선택값을번역으로바꾸지않는다`, async ({ page }) => {
  await openCopy(page)
  const before = await snapshot(page)
  await language(page, locale)
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('header h2')).toHaveText(titles[index])
  await expect(dialog.locator('.ss3-copy-source h3')).toContainText(seed.nick)
  await expect(dialog.locator('.ss3-copy-source h3')).toContainText(seed.asset)
  const budget = dialog.getByRole('combobox', { name: sharedCopyCopy(locale, '시작 예산'), exact: true })
  await expect(budget).toHaveValue('1')
  await expect(budget.locator('option')).toContainText((['100만원', '500만원', '1,000만원', '3,000만원 이상'] as const).map(key => sharedCopyCopy(locale, key)))
  const stops = dialog.getByRole('combobox', { name: sharedCopyCopy(locale, '손절선'), exact: true })
  await expect(stops).toHaveValue(String(seed.parameters.sl))
  await stops.selectOption('-12')
  await dialog.getByRole('button', { name: sharedCopyCopy(locale, '다음: 예상 결과 보기'), exact: true }).click()
  await expect(dialog.locator('header h2')).toHaveText(previews[index])
  await expect(dialog.locator('.ss3-copy-summary dt')).toHaveText((['원본 전략', '시작 예산', '손절 / 익절', '검증 구간'] as const).map(key => sharedCopyCopy(locale, key)))
  await expect(dialog.locator('.ss3-copy-summary dd').nth(0)).toHaveText(`${seed.nick} (${seed.asset})`)
  await expect(dialog.locator('.ss3-copy-summary dd').nth(1)).toHaveText(sharedCopyCopy(locale, '500만원'))
  await expect(dialog.locator('.ss3-copy-summary dd').nth(3)).toHaveText(sharedCopyCopy(locale, periodLabel(seed.parameters)))
  const calculated = evaluateDelegation({ ...seed.parameters, sl: -12 }, delegationBudgets[1])
  await expect(dialog.locator('.ss3-copy-metrics b').nth(0)).toHaveText(sharedCopyCopy(locale, '{score}점', { score: calculated.score }))
  await expect(dialog.locator('.ss3-copy-metrics b').nth(3)).toHaveText(sharedCopyCopy(locale, '{count}회', { count: calculated.result.n }))
  await expect(dialog.getByRole('status')).toHaveText(sharedCopyCopy(locale, '원본 합성 데이터로 검증하는 로컬 미리보기입니다. 실제 주문은 실행되지 않습니다.'))
  await expect(dialog.getByRole('button', { name: sharedCopyCopy(locale, '확정하고 검증 시작'), exact: true })).toBeEnabled()
  expect(await snapshot(page)).toEqual(before)
})

test('열린복제시트언어전환은조건선택초점·요약수치·두단계상태·세션을보존한다', async ({ page }) => {
  await openCopy(page)
  const dialog = page.getByRole('dialog'), select = dialog.locator('select').nth(1)
  await select.selectOption('-8')
  await select.focus()
  const original = await select.elementHandle(), before = await snapshot(page), href = page.url()
  for (const locale of locales) {
    await language(page, locale)
    await expect(select).toBeFocused()
    await expect(select).toHaveValue('-8')
    expect(await select.evaluate((el, node) => el === node, original)).toBe(true)
    expect(page.url()).toBe(href)
  }
  await dialog.getByRole('button', { name: sharedCopyCopy('fr', '다음: 예상 결과 보기'), exact: true }).click()
  const close = dialog.locator('header button'), metrics = dialog.locator('.ss3-copy-metrics')
  await close.focus()
  const metricNode = await metrics.elementHandle(), initialNumbers = (await metrics.innerText()).replace(/,/g, '.').match(/[-+]?\d+(?:\.\d+)?/g)
  for (const locale of locales) {
    await language(page, locale)
    await expect(close).toBeFocused()
    expect(await metrics.evaluate((el, node) => el === node, metricNode)).toBe(true)
    expect((await metrics.innerText()).replace(/,/g, '.').match(/[-+]?\d+(?:\.\d+)?/g)).toEqual(initialNumbers)
    expect(await snapshot(page)).toEqual(before)
  }
})
