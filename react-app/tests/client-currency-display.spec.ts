import { expect, test, type Page } from '@playwright/test'

async function research(page: Page, active: 'bt1' | 'bt2' | 'run' | 'live', currency = 'USD') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ active, currency }) => {
    if (sessionStorage.getItem('teth-client-experience')) return
    const id = 'currency-display'
    localStorage.setItem('tethCurrency', currency)
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title: '통화 검수', renamed: true, idea: '비트코인 반등 전략', draft: '투자금 $5,000 원문',
      pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
      researchStatus: '검토 필요', phase: 'plan', workspace: 'research', tradingReady: false, updatedAt: 1, turns: [],
    }] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active, tabs: [active],
      drafts: { [active]: '투자금 $100.25는 직접 입력한 원문' },
      replies: [{ doc: active, question: '$100에 샀어요', answer: '입력한 $100 문맥입니다.' }], paper: active === 'live',
    }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'plan', questions: [], clockVersion: 1 }))
  }, { active, currency })
  await page.goto('/')
  await expect(page.locator('.client-restored-research')).toBeVisible()
}

async function select(page: Page, currency: string, language = 'ko') {
  await page.evaluate(async ({ currency, language }) => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    setClientPreference('currency', currency)
    setClientPreference('language', language)
  }, { currency, language })
}

test('USD 예시 포맷은 센트·과거 통화 인자·비유한 입력을 처리한다', async ({ page }) => {
  await page.goto('/')
  const actual = await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { formatReferenceMoney: money } = await import(path)
    return [money(10000, 'USD'), money(1234.56, 'USD'), money(-1234.56, 'USD'),
      money(1.2345, 'HUF'), money(1.2345, 'IDR'), money(0.01, 'KRW'), money(1.2345, 'JPY'),
      money(5000, 'BTC'), money(1.25, 'USDT'), money(1.25, 'USDC'), money(1.25, 'invalid'),
      money(-0, 'USD'), money(-0.00001, 'USD'), money(NaN, 'USD'), money(Infinity, 'KRW'),
      money(-Infinity, 'BTC'), money(Number.MAX_VALUE, 'KRW')]
  })
  expect(actual).toEqual(['$10,000', '$1,234.56', '$-1,234.56', '$1.23', '$1.23', '$0.01', '$1.23',
    '$5,000', '$1.25', '$1.25', '$1.25', '$0', '$0', '–', '–', '–',
    '$' + new Intl.NumberFormat('ko', { maximumFractionDigits: 2 }).format(Number.MAX_VALUE)])
})

test('선택한 7언어가 USD 숫자를 표시하며 과거 37통화 인자는 환산을 복원하지 않는다', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { formatReferenceMoney: money, clientCurrencies, clientLanguages } = await import(path)
    return {
      locales: clientLanguages.map(({ c }: { c: string }) => [c, money(1234567.89, 'USD', c)]),
      currencies: clientCurrencies.map(({ c }: { c: string }) => ({ code: c, values: clientLanguages.map(({ c: lang }: { c: string }) => money(123.45, c, lang)) })),
      btc: money(5000, 'BTC', 'fr'), invalidLanguage: money(1234.56, 'USD', 'not_a_locale'),
    }
  })
  expect(result.locales).toEqual([
    ['ko', '$1,234,567.89'], ['en', '$1,234,567.89'], ['ja', '$1,234,567.89'],
    ['zh-CN', '$1,234,567.89'], ['zh-TW', '$1,234,567.89'], ['es', '$1.234.567,89'], ['fr', '$1\u202f234\u202f567,89'],
  ])
  expect(result.btc).toBe('$5\u202f000')
  expect(result.invalidLanguage).toBe('$1,234.56')
  expect(result.currencies).toHaveLength(37)
  for (const { code, values } of result.currencies) {
    expect(values, code).toEqual(['$123.45', '$123.45', '$123.45', '$123.45', '$123.45', '$123,45', '$123,45'])
  }
})

for (const [doc, usdResult] of [['bt1', '$8,516'], ['bt2', '$9,256']] as const) {
  test(`${doc}의 기준금액·낙폭은 USD를 유지하고 언어 변경에 질문·초안을 보존한다`, async ({ page }) => {
    await research(page, doc)
    const note = page.locator('article > .g-note').filter({ hasText: '기준 약' })
    await expect(note).toContainText(`$10,000 기준 약 ${usdResult} (예시 계산)`)
    const prices = await page.locator('.rw-price svg').textContent()
    await select(page, 'KRW')
    await expect(note).toContainText(`$10,000 기준 약 ${usdResult} (예시 계산)`)
    await expect(page.locator('.rw-composer textarea')).toHaveValue('투자금 $100.25는 직접 입력한 원문')
    await expect(page.locator('.rw-user-message')).toHaveText('$100에 샀어요')
    await expect(page.locator('.rw-answer')).toHaveText('입력한 $100 문맥입니다.')
    expect(await page.locator('.rw-price svg').textContent()).toBe(prices)
    await select(page, 'EUR', 'fr')
    await expect(note).toContainText('$10\u202f000 기준 약')
    await page.reload()
    await expect(note).toContainText('$10\u202f000 기준 약')
    await expect(page.locator('.rw-composer textarea')).toHaveValue('투자금 $100.25는 직접 입력한 원문')
    await select(page, 'VND')
    await page.setViewportSize({ width: 320, height: 820 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('실행 확인은 기존 원화 입력을 USD로 표시하며 언어 변경에 질문·거래쌍을 보존한다', async ({ page }) => {
  await research(page, 'run')
  const investment = page.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^투자금$/ }) })
  await expect(investment).toContainText('$5,035.97 (고정 예시)')
  await select(page, 'KRW')
  await expect(investment).toContainText('$5,035.97 (고정 예시)')
  await expect(page.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^조건$/ }) })).toContainText('BTC/USDT, 1일봉')
  await page.getByRole('button', { name: '실전 시작 (데모 잠금)', exact: true }).click()
  await expect(page.locator('.rw-notice')).toContainText('실제 자금 실행은 데모에서 잠겨 있어요')
  await select(page, 'EUR', 'fr')
  await expect(investment).toContainText('$5\u202f035,97 (고정 예시)')
  await page.reload()
  await expect(investment).toContainText('$5\u202f035,97 (고정 예시)')
  await expect(page.locator('.rw-composer textarea')).toHaveValue('투자금 $100.25는 직접 입력한 원문')
})
