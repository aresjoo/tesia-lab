import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

// Golden values extracted independently from tesia-lab 9fbff821 about/index.html:
// inert main.ab + its reviewed static plan renderer. Never regenerate these
// from the React output. Source changes require a fresh source review.
const original = {
  texts: '485d1a91acb0fcb103519bdfd1eb5d1a6546c4e63c5e21d3f6bb7a6e3fa114eb',
  svg: '5d1c84a46b790f82c16088d0b58e16650669bb612e303682fa51cc13f9bf89cf',
}

test('소개의 전체 원문102개와29개 SVG 형상·속성은 독립 원본 golden과 일치한다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.goto('/about/')
  await expect(page.locator('.ab-h1')).toHaveText('거래하는 사람을 위한 AI 트레이딩')
  const result = await page.locator('main.ab').evaluate(main => {
    const content = main.cloneNode(true) as HTMLElement
    // Existing publication gate copy is additional, not authored source copy.
    content.querySelectorAll('.prototype-notice,.pricing-preview,.faq-preview').forEach(el => el.remove())
    const texts: string[] = []
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim()
        if (text) texts.push(text)
      } else node.childNodes.forEach(walk)
    }
    walk(content)
    const svg = [...content.querySelectorAll('svg')].map(root =>
      [root, ...root.querySelectorAll('*')].map(node => node.tagName + JSON.stringify(
        [...node.attributes].map(attr => [attr.name, attr.value]).sort(),
      )).join('|'),
    )
    return { texts, svg }
  })
  expect(result.texts).toHaveLength(102)
  expect(result.svg).toHaveLength(29)
  for (const key of ['texts', 'svg'] as const) {
    expect(createHash('sha256').update(JSON.stringify(result[key])).digest('hex'), key).toBe(original[key])
  }
})
