import { expect, test, type Page } from '@playwright/test'

type Replay = { seconds: number; status: 'playing' | 'completed' }

async function openResearch(page: Page, replay: Replay, reducedMotion: 'no-preference' | 'reduce') {
  await page.emulateMedia({ reducedMotion })
  await page.clock.setFixedTime(new Date('2026-10-09T00:00:00Z'))
  await page.addInitScript(({ seconds, status }) => {
    if (sessionStorage.getItem('research-status-motion-seeded')) return
    sessionStorage.setItem('research-status-motion-seeded', '1')
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    const id = `research-status-motion-${status}`
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title: '상태 점 모션 검수', renamed: true, idea: '비트코인 과매도 반등 전략', draft: '',
      pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%',
      workspace: 'research', researchStatus: status === 'playing' ? '진행 중' : '검토 필요', turns: [], updatedAt: 1,
    }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({
      seconds, status, view: 'activity', questions: [], clockVersion: 1,
      ...(status === 'playing' ? { clockStartedAt: Date.now() - seconds * 1000 } : {}),
    }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({
      active: 'activity', tabs: ['plan', 'activity'], drafts: {}, replies: [], rowDrafts: {},
      positions: {}, edits: {}, paper: false, paused: false,
    }))
  }, replay)
  await page.goto('/')
  await expect(page.locator('.client-restored-research[data-source="client-fixture"]')).toBeVisible()
}

test('진행 헤더와 작업 중 Critic 점은 원본 1.8초 pulse를 함께 사용하고 완료점은 정적이다', async ({ page }) => {
  await openResearch(page, { seconds: 35, status: 'playing' }, 'no-preference')
  await expect(page.locator('.client-restored-research')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  const firstRow = page.locator('.g-act-row').first()
  await expect(firstRow).toHaveCSS('border-bottom-color', 'rgba(255, 255, 255, 0.04)')
  await expect(firstRow).toHaveCSS('animation-name', 'client-research-row-fade-up')
  await expect(firstRow).toHaveCSS('animation-duration', '0.3s')
  await expect(firstRow).toHaveCSS('animation-timing-function', 'ease')
  await expect(firstRow).toHaveCSS('animation-fill-mode', 'both')
  const title = page.locator('.rw-heading .g-title')
  const edit = title.locator('svg')
  await expect(edit).toHaveCSS('opacity', '0')
  await title.focus()
  await expect(edit).toHaveCSS('opacity', '1')
  const header = page.locator('.rw-title > .g-tag .g-dot.run')
  const critic = page.locator('.rw-team').filter({ hasText: '비판 검토' }).locator('.g-dot.run')
  for (const dot of [header, critic]) {
    await expect(dot).toBeVisible()
    await expect(dot).toHaveCSS('animation-name', 'client-research-pulse')
    await expect(dot).toHaveCSS('animation-duration', '1.8s')
    await expect(dot).toHaveCSS('animation-iteration-count', 'infinite')
  }

  await page.evaluate(() => {
    const id = 'research-status-motion-playing'
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }))
  })
  await page.reload()
  await expect(page.locator('.rw-title .g-dot.run')).toHaveCount(0)
  await expect(page.locator('.rw-team .g-dot.run')).toHaveCount(0)
  const completed = page.locator('.rw-team .g-dot.ok')
  await expect(completed).toHaveCount(7)
  await expect(completed.first()).toHaveCSS('animation-name', 'none')
})

test('감소 모션에서는 진행 의미를 유지하되 반복 pulse를 한 프레임으로 제한한다', async ({ page }) => {
  await openResearch(page, { seconds: 35, status: 'playing' }, 'reduce')
  const firstRow = page.locator('.client-restored-research .g-act-row').first()
  await expect(firstRow).toHaveCSS('animation-name', 'client-research-row-fade-up')
  const rowMotion = await firstRow.evaluate(element => {
    const style = getComputedStyle(element)
    const milliseconds = (value: string) => value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000
    return {
      duration: milliseconds(style.animationDuration),
      delay: milliseconds(style.animationDelay),
      iterations: style.animationIterationCount,
    }
  })
  expect(rowMotion.duration + Math.max(rowMotion.delay, 0)).toBeLessThanOrEqual(1000 / 60)
  expect(rowMotion.iterations).toBe('1')
  const dots = page.locator('.client-restored-research .g-dot.run')
  expect(await dots.count()).toBeGreaterThanOrEqual(2)
  for (const dot of await dots.all()) {
    await expect(dot).toHaveCSS('animation-name', 'client-research-pulse')
    await expect(dot).toHaveCSS('animation-duration', '1e-05s')
    await expect(dot).toHaveCSS('animation-iteration-count', '1')
  }
})
