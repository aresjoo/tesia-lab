import { expect, test } from '@playwright/test'

test.use({ trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(45_000)

for (const existing of [false, true]) {
  test(`인사이트 질문은 ${existing ? '기존 대화' : '홈'}의 별도 초안을 보존한 새 대화에서 시작한다`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 사용자', email: 'qa@example.test' })))
    await page.goto('/')
    if (existing) {
      await page.locator('textarea').fill('비트코인 하락할 때 사고 싶어')
      await page.locator('textarea').press('Enter')
      await expect(page.locator('.gcl .op').first()).toBeVisible({ timeout: 20_000 })
    }
    const draft = '이 초안은 인사이트 질문과 별개로 보관할게요'
    if (existing) await page.locator('.gcl .direct-trigger').click()
    await page.locator(existing ? '.gcl .op.free input' : 'textarea').fill(draft)
    await expect.poll(() => page.evaluate(() => {
      const state = JSON.parse(sessionStorage.getItem('teth-client-experience') ?? 'null')
      if (!state) return ''
      return state.currentId ? state.sessions.find((session: { id: string }) => session.id === state.currentId)?.draft : state.homeDraft
    })).toBe(draft)
    const previous = await page.evaluate(() => {
      const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
      return { id: state.currentId, title: state.sessions.find((session: { id: string }) => session.id === state.currentId)?.title, count: state.sessions.length }
    })
    await page.evaluate(() => { location.hash = '/insight/bitcoin-miner-cashflow' })
    await page.locator('.nfz-ast').first().click()
    await page.getByRole('button', { name: 'TETH에게 물어보기', exact: true }).click()
    await expect(page.locator('.g-umsg')).toHaveCount(1)
    await expect(page.locator('.g-umsg')).toContainText('현재 시장 상태를 분석해줘')
    await expect(page.locator('.g-umsg')).not.toContainText(draft)
    const started = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
    expect(started.sessions).toHaveLength(previous.count + 1)
    expect(started.currentId).not.toBe(previous.id)
    expect(started.homeDraft).toBe(existing ? '' : draft)
    if (existing) expect(started.sessions.find((session: { id: string }) => session.id === previous.id).draft).toBe(draft)
    await page.reload()
    await expect(page.locator('.g-umsg')).toHaveCount(1)
    if (existing) {
      await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
      await page.locator('.client-session').filter({ hasText: previous.title }).click()
    } else {
      if ((page.viewportSize()?.width ?? 0) <= 860) {
        await page.locator('.client-hamburger').click()
        await page.locator('.client-new-strategy').click()
      } else await page.getByRole('button', { name: '새 전략', exact: true }).click()
    }
    await expect(page.locator('textarea')).toHaveValue(draft)
  })
}

for (const source of ['suggestion', 'composer'] as const) for (const identical of [false, true]) {
  test(`공개 대화 ${source} 전송은 ${identical ? '동일' : '별도'} 문구의 초안을 출처에 따라 처리한다`, async ({ page }) => {
    await page.goto('/')
    await page.locator('textarea').fill('비트코인 하락할 때 사고 싶어')
    await page.locator('textarea').press('Enter')
    const suggestion = page.locator('.gcl .op').first()
    await expect(suggestion).toBeVisible({ timeout: 20_000 })
    const reply = (await suggestion.locator('b').textContent())!
    const draft = identical ? reply : '이 문장은 아직 보내지 않고 더 생각할게요'
    const input = page.locator('.g-composer textarea')
    await page.locator('.gcl .direct-trigger').click()
    await page.locator('.gcl .op.free input').fill(draft)
    if (source === 'suggestion') await suggestion.click()
    else await page.locator('.gcl .op.free input').press('Enter')
    await expect(page.locator('.g-umsg')).toHaveCount(2)
    await expect(page.locator('.g-umsg').last()).toHaveText(source === 'suggestion' ? reply : draft)
    await expect(input).toHaveValue(source === 'suggestion' ? draft : '')
    // The separate draft remains attached to its session after a UI reload.
    await page.reload()
    await expect(page.locator('.g-composer textarea')).toHaveValue(source === 'suggestion' ? draft : '')
    await expect(page.locator('.g-umsg')).toHaveCount(2)
  })
}
