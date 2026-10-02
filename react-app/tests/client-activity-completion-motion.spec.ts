import { expect, test, type Locator, type Page } from '@playwright/test'

const runningLabel = '생각을 정리하는 중'
const endings = [
  { status: 'done', button: '완료 이벤트 주입', label: '작업 완료' },
  { status: 'failed', button: '실패 이벤트 주입', label: '작업 실패' },
  { status: 'stopped', button: '중지 이벤트 주입', label: '작업 중지됨' },
] as const
const activity = (page: Page) => page.locator('.g-act2').first()

async function mount(page: Page, query = '', reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  const start = new Date('2026-09-20T00:00:00Z')
  await page.emulateMedia({ reducedMotion })
  await page.clock.install({ time: start })
  await page.goto(`/tests/fixtures/research-activity.html?${query}`)
  await expect(activity(page)).toBeVisible()
  // Freeze the event origin. runFor below advances only the specified display
  // transition, never a fabricated research/validation completion timer.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 5_000))
}
async function inject(page: Page, name: string) {
  // Fixture event injection deliberately preserves the actual user's focus.
  // Header interactions below still use real keyboard/click actions.
  await page.getByRole('button', { name, exact: true }).evaluate(node => (node as HTMLButtonElement).click())
}
async function closedSemantics(block: Locator, status: string, label: string) {
  await expect(block).toHaveAttribute('data-activity-state', status)
  await expect(block.locator('.activity-announcer')).toHaveText(label)
  await expect(block.locator('.activity-announcer')).toHaveAttribute('aria-live', 'polite')
  await expect(block.locator('.hd')).toHaveAccessibleName(new RegExp(`^${label}`))
  await expect(block.locator('.hd')).not.toHaveAccessibleName(new RegExp(runningLabel))
  await expect(block.locator('.hd')).toHaveAttribute('aria-expanded', 'false')
  await expect(block.locator('.tl')).toHaveAttribute('aria-hidden', 'true')
  expect(await block.locator('.tl').evaluate(node => (node as HTMLElement).inert)).toBe(true)
  await expect(block.locator('.ar.running')).toHaveCount(0)
}
async function finalized(block: Locator, status: string, label: string) {
  await expect(block).not.toHaveAttribute('data-header-closing', 'true')
  await expect(block).toHaveClass(/\bfin\b/)
  await expect(block.locator('.hd > svg.activity-logo')).toHaveCount(0)
  await expect(block.locator(`.hd > .tic.${status}`)).toHaveCount(1)
  await expect(block.locator('.hlb')).toHaveText(label)
}

for (const scope of ['public', 'native'] as const) for (const ending of endings) {
  test(`${scope} ${ending.status}: 상태는 즉시 종료하고 헤더만 239·259·260ms 순서로 전환한다`, async ({ page }) => {
    await mount(page, scope === 'native' ? 'native' : '')
    const block = activity(page)
    await expect(block.locator('.hd')).toHaveAttribute('aria-expanded', 'true')
    await expect(block.locator('.els')).toHaveText(/^\d+초$/)
    await inject(page, ending.button)
    await closedSemantics(block, ending.status, ending.label)
    await expect(block).toHaveAttribute('data-header-closing', 'true')
    await expect(block).not.toHaveClass(/\bfin\b/)
    await expect(block.locator('svg.activity-logo')).toHaveCount(1)
    await expect(block.locator('.hlb')).toHaveText(runningLabel)
    await expect(block.locator('.hlb')).toHaveAttribute('aria-hidden', 'true')
    const frozenElapsed = await block.locator('.els').textContent()
    for (const duration of [239, 20]) {
      await page.clock.runFor(duration)
      await closedSemantics(block, ending.status, ending.label)
      await expect(block).toHaveAttribute('data-header-closing', 'true')
      await expect(block.locator('svg.activity-logo')).toHaveCount(1)
      await expect(block.locator('.hlb')).toHaveText(runningLabel)
      await expect(block.locator('.els')).toHaveText(frozenElapsed!)
    }
    await page.clock.runFor(1)
    await finalized(block, ending.status, ending.label)
    await page.clock.runFor(2_000)
    await closedSemantics(block, ending.status, ending.label)
    await expect(block.locator('.els')).toHaveText(frozenElapsed!)
  })
}

test('사용자가 미리 닫은 연구는 완료 즉시 정적 헤더로 바뀌며 다시 열리지 않는다', async ({ page }) => {
  await mount(page)
  const block = activity(page), header = block.locator('.hd')
  await header.focus(); await page.keyboard.press('Enter')
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await inject(page, '완료 이벤트 주입')
  await closedSemantics(block, 'done', '작업 완료')
  await finalized(block, 'done', '작업 완료')
  await expect(header).toBeFocused()
  await page.clock.runFor(1_000)
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await expect(header).toBeFocused()
})

test('감소 모션과 처음부터 완료된 기록에는 260ms 지연을 만들지 않는다', async ({ page }) => {
  await mount(page, '', 'reduce')
  await inject(page, '완료 이벤트 주입')
  await closedSemantics(activity(page), 'done', '작업 완료')
  await finalized(activity(page), 'done', '작업 완료')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/tests/fixtures/research-activity.html?terminal=done')
  await closedSemantics(activity(page), 'done', '작업 완료')
  await finalized(activity(page), 'done', '작업 완료')
})

test('접히는 중 명시적으로 다시 열면 헤더를 즉시 확정하고 옛 타이머가 다시 닫지 않는다', async ({ page }) => {
  await mount(page)
  const block = activity(page), header = block.locator('.hd')
  await inject(page, '완료 이벤트 주입')
  await page.clock.runFor(100)
  await expect(block).toHaveAttribute('data-header-closing', 'true')
  await header.focus(); await page.keyboard.press('Enter')
  await finalized(block, 'done', '작업 완료')
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  expect(await block.locator('.tl').evaluate(node => (node as HTMLElement).inert)).toBe(false)
  await expect(header).toBeFocused()
  await page.clock.runFor(1_000)
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  await expect(header).toBeFocused()
})

test('빠른 재시작과 두 번째 종료는 첫 종료의 타이머를 재사용하지 않는다', async ({ page }) => {
  await mount(page)
  const block = activity(page)
  await inject(page, '완료 이벤트 주입'); await page.clock.runFor(100)
  await inject(page, '재시작 이벤트 주입')
  await expect(block).toHaveAttribute('data-activity-state', 'running')
  await expect(block).not.toHaveAttribute('data-header-closing', 'true')
  await expect(block.locator('.hlb')).toHaveText(runningLabel)
  // Reopening is an explicit user choice, not an assumption that a restart
  // overrides a previously collapsed transcript.
  if (await block.locator('.hd').getAttribute('aria-expanded') !== 'true') await block.locator('.hd').evaluate(node => (node as HTMLButtonElement).click())
  await page.clock.runFor(100)
  await inject(page, '중지 이벤트 주입')
  await closedSemantics(block, 'stopped', '작업 중지됨')
  await expect(block).toHaveAttribute('data-header-closing', 'true')
  await page.clock.runFor(60) // The first completion would have fired now.
  await expect(block).toHaveAttribute('data-header-closing', 'true')
  await expect(block.locator('.hlb')).toHaveText(runningLabel)
  await page.clock.runFor(199)
  await expect(block).toHaveAttribute('data-header-closing', 'true')
  await page.clock.runFor(1)
  await finalized(block, 'stopped', '작업 중지됨')
})

test('연구 교체와 제거 이후에는 이전 완료 헤더가 늦게 반영되지 않는다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await inject(page, '완료 이벤트 주입'); await page.clock.runFor(100)
  await inject(page, '연구 교체')
  const block = activity(page)
  await expect(block).toHaveAttribute('data-activity-state', 'running')
  await expect(block).not.toHaveAttribute('data-header-closing', 'true')
  await page.clock.runFor(1_000)
  await expect(block).toHaveAttribute('data-activity-state', 'running')
  await expect(block.locator('svg.activity-logo')).toHaveCount(1)
  await expect(block.locator('.hd > .tic')).toHaveCount(0)
  await inject(page, '완료 이벤트 주입'); await page.clock.runFor(100)
  await inject(page, '표시 제거')
  await expect(page.locator('.g-act2')).toHaveCount(0)
  await page.clock.runFor(1_000)
  await expect(page.locator('.g-act2')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('전환 중 감소 모션과 언어 변경은 지연 헤더를 즉시 정리한다', async ({ page }) => {
  await mount(page)
  const block = activity(page)
  await inject(page, '완료 이벤트 주입'); await page.clock.runFor(100)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await finalized(block, 'done', '작업 완료')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await inject(page, '연구 교체')
  await inject(page, '완료 이벤트 주입'); await page.clock.runFor(100)
  await expect(block).toHaveAttribute('data-header-closing', 'true')
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; const { setClientPreference } = await import(/* @vite-ignore */ path); setClientPreference('language', 'en') })
  await finalized(block, 'done', '작업 완료') // Supplied prose is not auto-translated.
  await expect(block.locator('.activity-announcer')).toHaveText('작업 완료')
  await page.clock.runFor(1_000)
  await finalized(block, 'done', '작업 완료')
})

test('상세 초점은 즉시 헤더로 회수하고 외부 초점은 완료 전환이 빼앗지 않는다', async ({ page }) => {
  await mount(page)
  const block = activity(page), header = block.locator('.hd')
  await block.locator('.arh').focus()
  await inject(page, '완료 이벤트 주입')
  await expect(header).toBeFocused()
  await page.clock.runFor(260)
  await expect(header).toBeFocused()
  await inject(page, '연구 교체')
  const outside = page.getByRole('button', { name: '중지 이벤트 주입', exact: true })
  await outside.focus(); await inject(page, '완료 이벤트 주입')
  await expect(outside).toBeFocused()
  await page.clock.runFor(260)
  await expect(outside).toBeFocused()
})

test('화면을 숨기면 전환을 정리하고 숨김 중 종료도 복귀 후 재생하지 않는다', async ({ page }) => {
  await mount(page)
  const block = activity(page)
  await inject(page, '완료 이벤트 주입'); await page.clock.runFor(100)
  await expect(block).toHaveAttribute('data-header-closing', 'true')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await finalized(block, 'done', '작업 완료')
  await inject(page, '연구 교체')
  await inject(page, '중지 이벤트 주입')
  await closedSemantics(block, 'stopped', '작업 중지됨')
  await finalized(block, 'stopped', '작업 중지됨')
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.runFor(1_000)
  await finalized(block, 'stopped', '작업 중지됨')
})
