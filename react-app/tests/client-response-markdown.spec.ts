import { expect, test } from '@playwright/test'
import { responseInline, responseMarkdown } from '../src/client-response-markdown'
import type { ClientLanguage } from '../src/client-preferences'

const sample = [
  '### 현재 위치', '**원본 강조**와 `표현 코드`를 구분합니다.', '',
  '- 첫 번째 관측', '• 두 번째 관측', '7. 먼저 확인할 내용', '12345) 긴 번호도 겹치지 않아야 합니다.',
  '> 관측 결과이며 미래 수익을 보장하지 않습니다.', '',
  '| 구간 | 수익률 | 최대 낙폭 | 관측 수 |', '| --- | --- | --- | --- |',
  '| **Research** | +12.34% | -5.60% | 730 |', '| Holdout | -1.25% | -8.00% | 365 |', '',
  '[출처](https://example.test/report?market=BTC&range=all)',
  '```python', 'risk = "<script>alert(1)</script>"', 'print(risk)', '```',
].join('\n')

test('원본 taiMd 지원 문법·미완성 fence·줄 단위·번호·표 구분을 계승한다', () => {
  const blocks = responseMarkdown(sample)
  expect(blocks.find(block => block.kind === 'heading')).toMatchObject({ kind: 'heading', text: '현재 위치', at: 0 })
  expect(blocks.filter(block => block.kind === 'list')).toMatchObject([
    { numbered: false, items: [{ text: '첫 번째 관측' }, { text: '두 번째 관측' }] },
    { numbered: true, items: [{ number: '7', text: '먼저 확인할 내용' }, { number: '12345', text: '긴 번호도 겹치지 않아야 합니다.' }] },
  ])
  expect(blocks.find(block => block.kind === 'table')).toMatchObject({ rows: [['구간', '수익률', '최대 낙폭', '관측 수'], ['**Research**', '+12.34%', '-5.60%', '730'], ['Holdout', '-1.25%', '-8.00%', '365']] })
  expect(blocks.find(block => block.kind === 'code')).toMatchObject({ language: 'python', text: 'risk = "<script>alert(1)</script>"\nprint(risk)' })
  expect(responseMarkdown('앞\n```ts\nconst a = 1')).toContainEqual({ kind: 'code', at: 5, language: 'ts', text: 'const a = 1' })
  expect(responseMarkdown('| --- | :---: |')).toEqual([])
  expect(responseMarkdown('# source does not support h1')[0]).toMatchObject({ kind: 'paragraph', text: '# source does not support h1' })
  expect(responseInline('**강조** `**plain**` [출처](https://example.test/a?x=1&y=2)')).toEqual([
    { kind: 'bold', text: '강조' }, { kind: 'text', text: ' ' }, { kind: 'code', text: '**plain**' }, { kind: 'text', text: ' ' }, { kind: 'link', text: '출처', href: 'https://example.test/a?x=1&y=2' },
  ])
})

test('위험 프로토콜·자격정보·상대주소·HTML/행동 태그는 링크나 동작으로 승격하지 않는다', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', '/api/v1/auth/logout', 'https:evil.test', 'https://user:password@example.test/', 'https://example.test\\@evil.test', 'https://example.test/\u0001x']) {
    const text = `[링크](${href})`
    expect(responseInline(text).every(token => token.kind === 'text')).toBe(true)
    expect(responseInline(text).map(token => token.text).join('')).toBe(text)
  }
  const html = '<img src=x onerror=alert(1)> [ACT buy] [APPROVE {}]'
  expect(responseInline(html)).toEqual([{ kind: 'text', text: html }])
  expect(responseInline('`[링크](https://example.test)`')).toEqual([{ kind: 'code', text: '[링크](https://example.test)' }])
})

test('긴 응답의 DOM 확장을 제한하되 원문은 버리지 않고 append 시 이전 블록 key를 유지한다', () => {
  for (const text of ['**x**'.repeat(25_000), '문장\n'.repeat(3001), '|' + 'x|'.repeat(40_000), '|' + 'x|'.repeat(129), '|a|b|\n'.repeat(1001), '**x** '.repeat(2001)]) expect(responseMarkdown(text)).toEqual([{ kind: 'plain', at: 0, text }])
  const prefix = responseMarkdown('### 제목\n첫 문장\n\n```js\na')
  const next = responseMarkdown('### 제목\n첫 문장\n\n```js\nabc\n```\n다음')
  expect(next.slice(0, prefix.length - 1)).toEqual(prefix.slice(0, -1))
  expect(next.find(block => block.kind === 'code')?.at).toBe(prefix.find(block => block.kind === 'code')?.at)
})

for (const width of [320, 1440]) test(`${width}px 제목·목록·표·인용·코드가 원본 위계로 보이고 표/코드만 수평 스크롤한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/tests/fixtures/response-markdown.html')
  await page.getByRole('textbox', { name: '표현 원문' }).fill(sample)
  const answer = page.locator('.g-amsg')
  await expect(answer.getByRole('heading', { name: '현재 위치' })).toBeVisible()
  await expect(answer.getByRole('table')).toHaveCount(1)
  await expect(answer.locator('th')).toHaveCount(4)
  await expect(answer.locator('tbody tr')).toHaveCount(2)
  await expect(answer.locator('script,img,iframe,style')).toHaveCount(0)
  await expect(answer.getByRole('link', { name: '출처', exact: true })).toHaveAttribute('href', 'https://example.test/report?market=BTC&range=all')
  await expect(answer.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(answer.locator('h4')).toHaveCSS('font-size', '16.5px')
  await expect(answer.locator('p').first()).toHaveCSS('margin-bottom', '10px')
  await expect(answer.locator('.codeblk pre code')).toHaveCSS('font-size', '12.5px')
  await expect(answer.locator('td').first()).toHaveCSS('overflow-wrap', 'normal')
  // Numeric values and Latin names must not inherit prose's anywhere wrap.
  expect(await answer.locator('tbody tr').first().locator('td').nth(1).evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el)
    return range.getClientRects().length
  })).toBe(1)
  const bounds = await answer.locator('ul.nl li').last().evaluate(el => ({ end: el.querySelector('em')!.getBoundingClientRect().right, start: el.querySelector('span')!.getBoundingClientRect().left }))
  expect(bounds.start - bounds.end).toBeGreaterThanOrEqual(5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (width === 320) {
    const table = answer.getByRole('region', { name: '답변 표' })
    expect(await table.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
    await table.focus(); await page.keyboard.press('ArrowRight')
    await expect.poll(() => table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  }
  await page.screenshot({ path: `/tmp/teth-response-markdown-${width}.png`, fullPage: true })
})

test('코드 복사는 성공 확인 후 표시하고 실패/늦은 응답/7언어/초점/수정 원문을 보존한다', async ({ page }) => {
  await page.goto('/tests/fixtures/response-markdown.html')
  await page.getByRole('textbox', { name: '표현 원문' }).fill('```js\nconst value = "original";\n```')
  await page.evaluate(() => {
    const control = { value: '', done: () => {}, fail: () => {} }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (value: string) => { control.value = value; return new Promise<void>((resolve, reject) => { control.done = resolve; control.fail = () => reject(new Error('fixture denied')) }) } } })
    Object.assign(window, { copyFixture: control })
  })
  type CopyFixture = { value: string; done: () => void; fail: () => void }
  const button = page.getByRole('button', { name: '코드 복사', exact: true })
  await button.click()
  await expect(button).toHaveText('복사')
  expect(await page.evaluate(() => (window as unknown as { copyFixture: CopyFixture }).copyFixture.value)).toBe('const value = "original";')
  await page.evaluate(() => (window as unknown as { copyFixture: CopyFixture }).copyFixture.fail())
  await expect(page.locator('.response-code-status')).toHaveText('복사 권한을 확인해주세요.')
  const labels = [
    ['Copy code', 'Please check clipboard permissions.'], ['コードをコピー', 'コピーの権限を確認してください。'],
    ['复制代码', '请检查剪贴板权限。'], ['複製程式碼', '請檢查剪貼簿權限。'],
    ['Copiar código', 'Revisa los permisos del portapapeles.'], ['Copier le code', 'Vérifiez les autorisations du presse-papiers.'], ['코드 복사', '복사 권한을 확인해주세요.'],
  ]
  let index = 0
  for (const lang of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as ClientLanguage[]) {
    await page.evaluate(lang => { localStorage.setItem('tethLang', lang); window.dispatchEvent(new StorageEvent('storage', { key: 'tethLang', newValue: lang, storageArea: localStorage })) }, lang)
    const [label, error] = labels[index++]
    await expect(page.getByRole('button', { name: label })).toBeFocused()
    await expect(page.locator('.response-code-status')).toHaveText(error)
    await expect(page.locator('.codeblk pre code')).toHaveText('const value = "original";')
  }
  await button.click(); await page.evaluate(() => (window as unknown as { copyFixture: CopyFixture }).copyFixture.done())
  await expect(button).toHaveText('✓ 복사됨')
  await page.getByRole('textbox').fill('```js\nintermediate content\n```')
  await page.getByRole('textbox').fill('```js\nconst value = "original";\n```')
  await expect(button).toHaveText('복사')
  await expect(page.locator('.response-code-status')).toHaveText('')
  await button.click(); await page.evaluate(() => (window as unknown as { copyFixture: CopyFixture }).copyFixture.done())
  await expect(button).toHaveText('✓ 복사됨')
  await expect(button).toHaveText('복사', { timeout: 3000 })
  await button.click()
  await page.getByRole('textbox').fill('```js\nnew content\n```')
  await page.evaluate(() => (window as unknown as { copyFixture: CopyFixture }).copyFixture.done())
  await expect(button).toHaveText('복사')
  await expect(page.locator('.response-code-status')).toHaveText('')
})

test('강조와 출처 링크는 중첩 표현하되 코드 안의 링크와 HTML은 비활성 텍스트다', async ({ page }) => {
  await page.goto('/tests/fixtures/response-markdown.html')
  await page.getByRole('textbox').fill('**[출처](https://example.test)**\n[**다른 출처**](https://example.test/other)\n**`BTC`**\n`[비활성](https://example.test)`\n**<img src=x onerror=alert(1)>**')
  const answer = page.locator('.g-amsg')
  await expect(answer.locator('b > a')).toHaveText('출처')
  await expect(answer.locator('a > b')).toHaveText('다른 출처')
  await expect(answer.locator('b > code')).toHaveText('BTC')
  await expect(answer.locator('a')).toHaveCount(2)
  await expect(answer.locator('img')).toHaveCount(0)
  await expect(answer).toContainText('[비활성](https://example.test)')
})

test('스트리밍·완료·중단·재렌더에서도 같은 답변과 이전 표/코드 DOM을 유지하고 실행하지 않는다', async ({ page }) => {
  await page.goto('/tests/fixtures/response-markdown.html')
  await page.getByRole('textbox').fill(sample)
  const answer = await page.locator('.g-amsg').elementHandle(), table = await page.getByRole('table').elementHandle(), code = await page.locator('pre').elementHandle()
  await page.getByRole('button', { name: '스트리밍 상태' }).click()
  await expect(page.locator('.g-amsg')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.client-stream-caret')).toHaveCount(1)
  await page.getByRole('textbox').fill(sample + '\n### 추가 확인\n마지막 문장')
  await expect(page.locator('.client-response-markdown > p').last().locator('.client-stream-caret')).toHaveCount(1)
  for (const node of [answer, table, code]) expect(await node!.evaluate(el => el.isConnected)).toBe(true)
  await page.getByRole('button', { name: '중단 상태' }).click()
  await expect(page.locator('.g-amsg')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.client-stream-caret')).toHaveCount(0)
  await expect(page.locator('.g-amsg')).toHaveAttribute('data-source', 'service')
  await expect(page.locator('.g-amsg')).toHaveAttribute('data-response-state', 'interrupted')
  await expect(page.locator('.g-amsg script')).toHaveCount(0)
})

test('과도한 단일 표는 원문 보존 plain으로 표시하고 빈 코드 복사는 비활성이다', async ({ page }) => {
  await page.goto('/tests/fixtures/response-markdown.html')
  const text = '|' + 'x|'.repeat(40_000)
  await page.getByRole('textbox').fill(text)
  await expect(page.locator('.g-amsg p')).toHaveText(text)
  await expect(page.locator('.g-amsg th')).toHaveCount(0)
  expect(await page.locator('.g-amsg *').count()).toBeLessThan(5)
  await page.getByRole('textbox').fill('```')
  await expect(page.getByRole('button', { name: '코드 복사', exact: true })).toBeDisabled()
  await page.getByRole('textbox').fill('```js\nconst x = 1')
  await expect(page.getByRole('button', { name: '코드 복사', exact: true })).toBeEnabled()
})
