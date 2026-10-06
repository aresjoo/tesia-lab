import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const rows = JSON.parse(readFileSync('src/client-static-ui-plural-copy.json', 'utf8')) as Record<string, { parameter: string; en: string; es: string; fr: string }>
const normal = JSON.parse(readFileSync('src/client-static-ui-copy.json', 'utf8')) as Record<string, string[]>
const slots = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

test('singular UI variants retain exact slots and do not add data numbers', () => {
  expect(Object.keys(rows)).toHaveLength(23)
  for (const [source, row] of Object.entries(rows)) {
    expect(slots(source), source).toContain(row.parameter)
    for (const language of ['en', 'es', 'fr'] as const) {
      expect(row[language].trim(), source).not.toBe('')
      expect(row[language], source).not.toMatch(/[가-힣\uFFFD]/)
      expect(slots(row[language]), source).toEqual(slots(source))
      expect(row[language].replace(/\{\w+\}/g, ''), source).not.toMatch(/\d/)
    }
  }
})

test('one versus thirteen uses whole source UI sentences without changing unknown prose', async ({ page }) => {
  await page.route('**/plural-copy.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/plural-copy.html')
  const result = await page.evaluate(async keys => {
    const path = '/src/client-static-ui-copy.ts', singlePath = '/src/client-static-ui-plural-copy.ts'
    const { staticUiText, fixedStaticUiText } = await import(path), { singularUiTemplate } = await import(singlePath)
    const cases = []
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) for (const count of [1, 13]) {
      const values = { count, total: count, shown: count, wins: 1, positive: 1, remaining: 12, date: '2026-09-28', title: 'USER $&', score: 99, verdict: 'SOURCE', return: '+0.125%', drawdown: 2.5, rate: 53, simulation: 'SOURCE' }
      cases.push({ language, count, labels: keys.filter(key => key !== '재검증 결과: TETH {score} ({verdict}), 검증 수익 {return}, 최대 낙폭 {drawdown}%, 체결 {count}회 {simulation}').map(key => [key, staticUiText(language, key, values)]), unknown: fixedStaticUiText(language, '고객/API 원문 $& 1회'), noOverride: singularUiTemplate(language, '고객/API 원문 {count}회', { count: 1 }), missingCount: singularUiTemplate(language, '{count}회', {}) })
    }
    return cases
  }, Object.keys(rows))
  const columns: Record<string, number> = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 }
  for (const item of result) {
    expect(item.unknown).toBe('고객/API 원문 $& 1회')
    expect(item.noOverride).toBeUndefined(); expect(item.missingCount).toBeUndefined()
    for (const [source, text] of item.labels) {
      expect(text, `${source}:${item.language}`).not.toMatch(/\{\w+\}/)
      if (item.language === 'ko') expect(text).toContain(String(item.count))
      if (item.count === 13) {
        const base = normal[source][columns[item.language]]
        const values: Record<string, string | number> = { count: 13, total: 13, shown: 13, wins: 1, positive: 1, remaining: 12, date: '2026-09-28', title: 'USER $&', rate: 53 }
        expect(text, source).toBe(base.replace(/\{(\w+)\}/g, (slot, key: string) => values[key] === undefined ? slot : String(values[key])))
      }
    }
    const labels = Object.fromEntries(item.labels)
    const countUnits: Record<string, [string, string]> = { en: ['1 item', '13 items'], es: ['1 elemento', '13 elementos'], fr: ['1 élément', '13 éléments'] }
    if (countUnits[item.language]) expect(labels['{count}건']).toBe(countUnits[item.language][item.count === 1 ? 0 : 1])
    if (item.language === 'en') { expect(labels['{count}회']).toBe(item.count === 1 ? '1 time' : '13 times'); expect(labels['검증 {count}회']).toBe(item.count === 1 ? '1 validation' : '13 validations'); expect(labels['승률 ({count}회)']).toBe(item.count === 1 ? 'Win rate (1 trade)' : 'Win rate (13 trades)') }
    if (item.language === 'es') { expect(labels['{count}회']).toBe(item.count === 1 ? '1 vez' : '13 veces'); expect(labels['검증 {count}회']).toBe(item.count === 1 ? '1 validación' : '13 validaciones') }
    if (item.language === 'fr') { expect(labels['검증 {count}회']).toBe(item.count === 1 ? '1 validation' : '13 validations'); expect(labels['승률 ({count}회)']).toBe(item.count === 1 ? 'Taux de réussite (1 transaction)' : 'Taux de réussite (13 transactions)') }
  }
})
