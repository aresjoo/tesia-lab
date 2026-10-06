import { expect, test } from '@playwright/test'

// Client-approved Korean copy, independently copied from source 9fb
// site-footer.js:29–32 and the user's restoration request. Not service evidence.
const paragraphs = [
  'TETH는 고객이 말로 정한 전략을 AI 에이전트가 판단하고 실행하는 AI 트레이딩 서비스입니다. 고객이 각 거래에 직접 개입하지 않아도 AI 에이전트가 주식, 옵션, 암호화폐 거래를 실행할 수 있으며, 모든 거래는 고객이 연결한 Bitget 계정 안에서 이루어집니다.',
  'Bitget이 선정한 최고의 AI입니다.',
  'TETH는 조회와 주문 권한만 사용하며 출금 권한은 요청하지 않습니다. 거래 한도는 고객이 직접 설정하고, 언제든지 전략을 중지하거나 연결을 해제할 수 있습니다. 판단 근거는 거래마다 기록으로 남깁니다.',
  '© 2026 TETH AI. 모든 권리 보유.',
]

for (const [host, path] of [
  ['Main', '/'],
  ['Native', '/tests/fixtures/client-settings-plan.html?host=service'],
  ['About', '/about/'],
  ['Download', '/download/'],
  ['Policies', '/policies/'],
] as const) for (const width of [320, 1440]) {
  test(`approved original footer ${host} ${width}px`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
    await page.route('**/*', route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== new URL(info.project.use.baseURL as string).origin || !['GET', 'HEAD'].includes(request.method())) return route.abort('blockedbyclient')
      return route.continue()
    })
    await page.goto(path)
    const footer = page.locator('.client-site-footer')
    await expect(footer).toHaveCount(1)
    await expect(footer.locator('.gft-copy > p')).toHaveText(paragraphs)
    await expect(footer.locator('.gft-copy > p').nth(1).locator('b')).toHaveText(paragraphs[1])
    await expect(footer.locator('.gft-copy > p.dim')).toHaveCount(2)
    await footer.scrollIntoViewIfNeeded()
    expect(await footer.evaluate(node => {
      const box = node.getBoundingClientRect()
      return { overflow: document.documentElement.scrollWidth > innerWidth, left: box.left, right: box.right }
    })).toMatchObject({ overflow: false })
    expect(await footer.locator('.gft-copy').evaluate(node => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.left >= 0 && box.right <= innerWidth
    })).toBe(true)
    expect(errors).toEqual([])
    if (host === 'Main') await page.screenshot({ path: info.outputPath(`approved-footer-${width}.png`) })
  })
}
