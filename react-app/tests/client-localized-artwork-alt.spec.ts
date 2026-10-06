import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { aboutText } from '../src/client-about-copy'
import { downloadText } from '../src/client-download-copy'
import type { ClientLanguage } from '../src/client-preferences'

const baseline = 'eeb61d82f319a84dec671151c73374b971df2cc1'
const git = (...args: string[]) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 })
const original = (file: string) => git('show', `${baseline}:${file}`)
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const languages = [['ko', '한국어'], ['en', 'English'], ['ja', '日本語'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['es', 'Español'], ['fr', 'Français']] as const
const about = [
  ['about-live', 'TETH 터미널, 차트와 판단 패널', '1376', '900'],
  ['about-plan2', 'TETH 전략 카드, 자산과 사고파는 조건', '844', '517'],
  ['about-backtest2', 'TETH 백테스트 결과, 잔고 차트와 판단 기록', '1216', '700'],
  ['about-connect', 'TETH 거래소 선택 화면', '900', '640'],
  ['about-brain', 'TETH 터미널 판단 패널', '392', '560'],
] as const
const download = [
  ['dl-chat', 'chatAlt', 'TETH 모바일 대화 화면, 전략 카드'],
  ['dl-report', 'reportAlt', 'TETH 모바일 백테스트 결과 화면'],
  ['dl-live', 'liveAlt', 'TETH 모바일 터미널 판단 패널'],
] as const
const suffixes = [' (Korean preview)', '（韓国語プレビュー）', '（韩语预览）', '（韓語預覽）', ' (vista previa en coreano)', ' (aperçu en coréen)', ', Korean screenshot', '、韓国語画面', '，韩语截图', '，韓語截圖', ', captura en coreano', ', capture en coréen']
const removeIncorrectLanguage = (text: string) => suffixes.reduce((value, suffix) => value.replace(suffix, ''), text)
const oldAbout = original('src/client-about-copy.ts').toString()
const sourceCopy = JSON.parse(original('src/client-about-source.json').toString()).copy as string[]
const aboutVariables = { en: 'en', ja: 'ja', 'zh-CN': 'zhCN', 'zh-TW': 'zhTW', es: 'es', fr: 'fr' } as const
const oldDownload = ts.createSourceFile('download.ts', original('src/client-download-copy.ts').toString(), ts.ScriptTarget.Latest, true)
function originalDownloadRow(key: string): string[] {
  let result: string[] | undefined
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(oldDownload) === key && ts.isArrayLiteralExpression(node.initializer)) {
      result = node.initializer.elements.map(value => { if (!ts.isStringLiteral(value)) throw Error('EXPECTED_SOURCE_LITERAL'); return value.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(oldDownload)
  if (!result) throw Error('MISSING_SOURCE_ALT')
  return result
}
function expectedAbout(language: ClientLanguage, korean: string): string {
  if (language === 'ko') return korean
  const rows = oldAbout.match(new RegExp('const ' + aboutVariables[language] + ' = `([\\s\\S]*?)`\\.split'))?.[1].split('\n')
  if (!rows || !rows[sourceCopy.indexOf(korean)]) throw Error('MISSING_SOURCE_ALT')
  return removeIncorrectLanguage(rows[sourceCopy.indexOf(korean)])
}
function expectedDownload(language: ClientLanguage, key: string): string {
  return removeIncorrectLanguage(originalDownloadRow(key)[languages.findIndex(([code]) => code === language)])
}

test('KO8 and source/artwork bytes stay exact; foreign48 remove only the incorrect Korean modifier', () => {
  for (const [language] of languages) {
    for (const [, korean] of about) expect(aboutText(language, korean)).toBe(expectedAbout(language, korean))
    for (const [, key, korean] of download) {
      expect(downloadText(language, key)).toBe(expectedDownload(language, key))
      if (language === 'ko') expect(downloadText(language, key)).toBe(korean)
    }
  }
  expect(readFileSync('src/client-about-source.json')).toEqual(original('src/client-about-source.json'))
  const files = git('ls-tree', '-r', '--name-only', baseline, '--', 'public/client-shots').toString().trim().split('\n').filter(file => file.endsWith('.webp'))
  expect(files.filter(file => file.includes('/localized/'))).toHaveLength(48)
  for (const file of files) expect(sha(readFileSync(file)), file).toBe(sha(original(file)))
})

test('320px: all seven locale image choices match accurate alt text through real public controls', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = [], blocked: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== new URL(baseURL!).origin || request.method() !== 'GET' || /^\/(api|auth)\//.test(url.pathname)) { blocked.push(url.pathname); return route.abort() }
    return route.continue()
  })
  const observed: { language: string; id: string; src: string; alt: string }[] = []
  for (const [language, name] of languages) {
    await page.goto('/about/')
    await page.locator('.public-language-trigger').click()
    await page.locator('#locale-language li button').filter({ hasText: name }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    for (const [id, korean, width, height] of about) {
      const image = page.locator(`.client-info-about main img[src$="/${id}.webp"]`)
      const src = language === 'ko' ? `/client-shots/about/${id}.webp` : `/client-shots/localized/${language}/${id}.webp`
      await expect(image).toHaveAttribute('src', src)
      await expect(image).toHaveAttribute('alt', expectedAbout(language, korean))
      await expect(image).toHaveAttribute('width', width); await expect(image).toHaveAttribute('height', height)
      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true)
      observed.push({ language, id, src, alt: (await image.getAttribute('alt'))! })
    }
    await page.locator('.client-info-about .client-site-footer a[href="/download/"]').click()
    for (const [index, [id, key]] of download.entries()) {
      await page.locator('.download-tabs button').nth(index).click()
      const image = page.locator('.client-info-download .slide.on .scr img')
      const src = language === 'ko' ? `/client-shots/${id}.webp` : `/client-shots/localized/${language}/${id}.webp`
      await expect(image).toHaveAttribute('src', src)
      await expect(image).toHaveAttribute('alt', expectedDownload(language, key))
      await expect(image).toHaveAttribute('width', '780'); await expect(image).toHaveAttribute('height', '1688')
      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true)
      observed.push({ language, id, src, alt: (await image.getAttribute('alt'))! })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(observed).toHaveLength(56)
  expect(observed.filter(row => row.language !== 'ko')).toHaveLength(48)
  for (const row of observed.filter(row => row.language !== 'ko')) expect(row.alt).not.toMatch(/Korean|韓国語|韩语|韓語|coreano|coréen/)
  expect(errors).toEqual([]); expect(blocked).toEqual([])
  await info.attach('localized-artwork-alt-observed.json', { body: JSON.stringify(observed, null, 2), contentType: 'application/json' })
})
