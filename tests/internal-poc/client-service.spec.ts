import { expect, test, type Page } from '@playwright/test'
import { useCandidateServiceAssets } from './service-assets'

// Real cookies/CSRF must never enter traces, console or request screenshots.
test.use({ trace: 'off', video: 'off' })

const IDEA = 'BTC 15분 RSI 30 아래면 100 USDT 롱, 손절 2%, 익절 5%, 레버리지 2배'
const fixtureUrl = '/internal-poc-fixture.html#/client'

async function start(page: Page, url: string, idea = IDEA) {
  await page.goto(url)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.locator('#strategy-idea').fill(idea)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
}

test('내부 fixture도 원본 대화와 문서 구조를 사용하고 출처를 숨기지 않는다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await start(page, fixtureUrl)
  await expect(page.locator('.g-amsg')).toContainText('거래할 심볼')
  await expect(page.locator('.client-development-boundary')).toContainText('Mock fixture 검수')
  await expect(page.getByRole('button', { name: 'BTCUSDT', exact: true })).toBeVisible()
  await expect(page.locator('.client-service-document')).toBeVisible()
  await expect(page.locator('.strategy-summary .status-pill')).toHaveText('조건 확인 중')
  await expect(page.locator('.strategy-summary .status-pill')).toHaveCSS('white-space', 'nowrap')
  await expect(page.locator('.internal-poc-shell')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '응답 중지', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('서버 fixture 초안의 연속 질문과 검증을 원본 대화 안에서 처리한다', async ({ page }) => {
  await start(page, fixtureUrl)
  for (const reply of ['BTCUSDT', 'RSI 14', 'RSI(14)가 30 미만이면 롱']) {
    await page.getByRole('button', { name: reply, exact: true }).click()
  }
  const validate = page.getByRole('button', { name: '계약 검증', exact: true })
  await expect(validate).toBeEnabled()
  await expect(page.locator('.strategy-summary .status-pill')).toHaveText('계약 검증 후보')
  await validate.click()
  await expect(page.getByText('Validator 통과', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '승인하고 백테스트', exact: true })).toBeDisabled()
  expect(page.url()).toContain('#/client')
})

test('공개 첫 화면의 client fragment는 실제 서버 연결을 활성화하지 않는다', async ({ page }) => {
  const api: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url()) })
  await page.goto('/#/client')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.locator('.client-service-app')).toHaveCount(0)
  expect(api).toEqual([])
})

test.describe('승인된 owner-local 실제 HTTP 연결', () => {
  // Real cookies/CSRF must never enter traces, console or screenshots of requests.
  const url = process.env.TETH_CLIENT_SERVICE_URL
  const committedReplay = process.env.TETH_SERVICE_REPLAY === 'committed'
  test.skip(!url, '별도로 실행한 승인된 owner-local service 모드 필요')

  test.beforeEach(async ({ page }) => {
    if (url) await useCandidateServiceAssets(page, url)
  })

  test.beforeAll(() => {
    if (!url) return
    const parsed = new URL(url)
    expect(parsed.protocol).toBe('http:')
    expect(parsed.hostname).toBe('127.0.0.1')
    expect(parsed.pathname).toBe('/internal-poc.html')
    expect(parsed.search).toBe('')
    expect(parsed.hash).toBe('#/client')
  })

  test('실제 익명 대화·검증·승인 차단·로그아웃과 새 세션', async ({ page }) => {
    const errors: string[] = []
    const protectedWrites: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (request.method() === 'POST' && /approval-challenges|strategy-versions|backtests/.test(path)) protectedWrites.push(path)
    })
    await start(page, url!)
    await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()
    await page.getByRole('button', { name: 'RSI(14)가 30 미만이면 롱', exact: true }).click()
    await expect(page.locator('.g-amsg').last()).toBeVisible()
    await expect(page.locator('.g-amsg').last()).toHaveAttribute('data-source', 'service')
    await page.getByRole('button', { name: '계약 검증', exact: true }).click()
    await expect(page.getByText('Validator 통과', { exact: true })).toBeVisible()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: '승인하고 백테스트', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('계정 확인이 필요')
    expect(protectedWrites).toEqual([])
    await page.evaluate(() => {
      const original = Storage.prototype.removeItem
      Object.defineProperty(window, '__restoreTethTestRemoval', { value: () => { Storage.prototype.removeItem = original } })
      Storage.prototype.removeItem = function (key) {
        if (key === 'tesia-internal-poc-client-snapshot-v1') throw new DOMException('Blocked', 'SecurityError')
        return original.call(this, key)
      }
    })
    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'logged-out')
    await expect(page.locator('.g-umsg')).toHaveCount(0)
    await expect(page.getByTestId('local-recovery-storage-warning')).toBeVisible()
    await page.evaluate(() => (window as Window & { __restoreTethTestRemoval: () => void }).__restoreTethTestRemoval())
    await page.getByRole('button', { name: '새 세션 시작', exact: true }).click()
    await expect(page.locator('#strategy-idea')).toBeVisible()
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('실제 미완성 초안 reload는 소유권 GET 후 복구하고 다음 질문을 이어간다', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const actualFetch = window.fetch.bind(window)
      const delivery = new Promise<void>(resolve => Object.defineProperty(window, '__releaseDraftRecovery', { value: resolve }))
      window.fetch = async (input, init) => {
        const response = await actualFetch(input, init)
        if (init?.method === 'GET' && /\/strategy-drafts\/[^/]+$/.test(new URL(response.url).pathname)) await delivery
        return response
      }
    })
    await start(page, url!)
    await expect(page.getByRole('button', { name: 'BTCUSDT', exact: true })).toBeVisible()
    const before = await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')!)
      return { draftId: saved.draftId, draftRevision: saved.draftRevision }
    })
    const get = page.waitForResponse(response => response.request().method() === 'GET' && /\/strategy-drafts\/[^/]+$/.test(new URL(response.url()).pathname), { timeout: 15_000 })
    await page.reload()
    expect((await get).status()).toBe(200)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'loading')
    await expect(page.locator('.g-composer textarea')).toBeDisabled()
    await expect(page.locator('#strategy-idea')).toHaveCount(0)
    await page.evaluate(() => (window as Window & { __releaseDraftRecovery: () => void }).__releaseDraftRecovery())
    await expect(page.locator('.client-service-recovery')).toContainText('서버에서 진행 상태를 다시 확인')
    await expect(page.locator('.client-service-recovery')).toContainText('이전 대화 내용은 복원하지 않았습니다.')
    await expect(page.locator('.client-service-recovery')).toBeInViewport()
    await expect(page.locator('.strategy-summary .status-pill')).toHaveText('조건 확인 중')
    await expect(page.getByRole('button', { name: '계약 검증', exact: true })).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (process.env.TETH_CLIENT_SERVICE_ASSETS) await page.screenshot({ path: testInfo.outputPath('draft-recovered.png'), fullPage: true })
    expect(await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')!)
      return { draftId: saved.draftId, draftRevision: saved.draftRevision }
    })).toEqual(before)
    await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()
    await expect(page.getByRole('button', { name: 'RSI(14)가 30 미만이면 롱', exact: true })).toBeVisible()
  })

  test('실제 새 쿠키 세션은 이전 초안을 조회하거나 자동 이관하지 않는다', async ({ page, context }) => {
    await start(page, url!)
    await expect(page.getByRole('button', { name: 'BTCUSDT', exact: true })).toBeVisible()
    const oldSnapshot = await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')!)
    await context.clearCookies()
    const draftGets: string[] = []
    page.on('request', request => { if (request.method() === 'GET' && /\/strategy-drafts\//.test(new URL(request.url()).pathname)) draftGets.push('GET') })
    await page.reload()
    await expect(page.locator('#strategy-idea')).toBeVisible()
    await expect(page.locator('.client-service-document')).toHaveCount(0)
    expect(draftGets).toEqual([])
    expect(await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))).toBeNull()
    // Even in an EXISTING_SESSION, storage IDs cannot authorize another owner.
    await page.evaluate(saved => sessionStorage.setItem('tesia-internal-poc-client-snapshot-v1', saved), oldSnapshot)
    const denied = page.waitForResponse(response => response.request().method() === 'GET' && /\/strategy-drafts\/[^/]+$/.test(new URL(response.url()).pathname), { timeout: 15_000 })
    await page.reload()
    expect((await denied).status()).toBe(404)
    await expect(page.locator('#strategy-idea')).toBeVisible()
    await expect(page.locator('.client-service-document')).toHaveCount(0)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))).toBeNull()
  })

  test('실제 응답을 기다리는 동안 설정을 열어도 대화 처리는 계속된다', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const actualFetch = window.fetch.bind(window)
      const delivery = new Promise<void>(resolve => {
        Object.defineProperty(window, '__releaseTethTestDelivery', { value: resolve })
      })
      window.fetch = async (input, init) => {
        const response = await actualFetch(input, init)
        if (init?.method === 'POST' && /\/messages$/.test(new URL(response.url).pathname)) {
          // Deterministic test-only delivery gate, never a product thinking timer.
          await delivery
        }
        return response
      }
    })
    const response = page.waitForResponse(response => response.request().method() === 'POST' && /\/messages$/.test(new URL(response.url()).pathname))
    await start(page, url!)
    await expect(page.locator('.g-act2[data-source="service"]')).toBeVisible()
    await expect(page.locator('.g-composer').getByRole('button', { name: '응답 기다리는 중', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: '메시지 수정', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: '메시지 복사', exact: true })).toBeEnabled()
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: '메뉴', exact: true }).click()
    await page.getByRole('button', { name: '설정', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect((await response).status()).toBe(200)
    await page.evaluate(() => (window as Window & { __releaseTethTestDelivery: () => void }).__releaseTethTestDelivery())
    await expect(page.locator('.g-amsg')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.g-amsg')).toContainText('거래할 심볼')
    await expect(page.locator('.g-composer textarea')).toBeEnabled()
    await expect(page.getByRole('button', { name: '메시지 수정', exact: true })).toBeEnabled()
    expect(page.url()).toBe(url)
  })

  for (const completeDraft of [false, true]) test(`실제 turn 응답 유실: ${completeDraft ? '완성' : '미완성'} ${committedReplay ? '원응답·ETag를 동일하게 복원하고 대화 중복을 방지한다' : '초안만 GET으로 복구하고 답변 복원을 주장하지 않음'}`, async ({ page }) => {
    await page.addInitScript(({ targetMessage }) => {
      const actualFetch = window.fetch.bind(window)
      let firstBody: BodyInit | null | undefined
      let firstKey: string | null
      let firstRevision: string | undefined
      let firstMatch: string | null
      let firstData: string | undefined
      let firstEtag: string | null
      const proof = { count: 0, sameRequest: false, wireRevisionMatches: false, committed: false, replayStatus: 0, sameData: false, sameEtag: false }
      Object.defineProperty(window, '__tethReplayProof', { value: proof })
      window.fetch = async (input, init) => {
        const response = await actualFetch(input, init)
        if (init?.method === 'GET' && /\/strategy-drafts\/[^/]+$/.test(new URL(response.url).pathname) && firstRevision) {
          proof.wireRevisionMatches = firstRevision === String((await response.clone().json()).data?.revision)
        }
        if (init?.method !== 'POST' || !/\/conversations\/[^/]+\/messages$/.test(new URL(response.url).pathname)) return response
        if (typeof init.body !== 'string' || JSON.parse(init.body).message !== targetMessage) return response
        proof.count++
        if (proof.count === 1) {
          firstBody = init.body
          firstKey = new Headers(init.headers).get('idempotency-key')
          firstMatch = new Headers(init.headers).get('if-match')
          proof.committed = response.ok
          if (!response.ok) return response
          const data = (await response.clone().json()).data
          firstRevision = data.draftRevision
          firstData = JSON.stringify(data)
          firstEtag = response.headers.get('etag')
          throw new TypeError('Simulated response loss after server commit')
        }
        proof.sameRequest = firstBody === init.body && firstKey === new Headers(init.headers).get('idempotency-key') && firstMatch === new Headers(init.headers).get('if-match')
        proof.replayStatus = response.status
        if (response.ok) {
          proof.sameData = firstData === JSON.stringify((await response.clone().json()).data)
          proof.sameEtag = firstEtag === response.headers.get('etag')
        }
        return response
      }
    }, { targetMessage: completeDraft ? 'RSI(14)가 30 미만이면 롱' : '100 USDT' })
    const targetMessage = completeDraft ? 'RSI(14)가 30 미만이면 롱' : '100 USDT'
    const committedResponse = page.waitForResponse(response => response.request().method() === 'POST'
      && /\/messages$/.test(new URL(response.url()).pathname)
      && response.request().postDataJSON()?.message === targetMessage)
    await start(page, url!, completeDraft ? IDEA : '100 USDT')
    if (completeDraft) {
      await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()
      await page.getByRole('button', { name: 'RSI(14)가 30 미만이면 롱', exact: true }).click()
    }
    expect((await committedResponse).status()).toBe(200)
    await expect(page.getByRole('button', { name: '같은 요청 다시 확인', exact: true })).toBeVisible()
    await expect(page.locator('.g-composer textarea')).toBeDisabled()
    await page.getByRole('button', { name: '같은 요청 다시 확인', exact: true }).click()
    if (committedReplay) {
      await expect(page.getByRole('button', { name: '같은 요청 다시 확인', exact: true })).toHaveCount(0)
      await expect(page.locator('[data-delivery="uncertain"]')).toHaveCount(0)
      const proof = await page.evaluate(() => (window as Window & { __tethReplayProof: unknown }).__tethReplayProof)
      expect(proof).toEqual({ count: 2, sameRequest: true, wireRevisionMatches: false, committed: true, replayStatus: 200, sameData: true, sameEtag: true })
      await expect(page.locator('.g-umsg')).toHaveCount(completeDraft ? 3 : 1)
      await expect(page.locator('.g-amsg')).toHaveCount(completeDraft ? 3 : 1)
      await expect(page.locator('.g-composer textarea')).toBeEnabled()
      if (completeDraft) await expect(page.getByRole('button', { name: '계약 검증', exact: true })).toBeEnabled()
      else await expect(page.getByRole('button', { name: '계약 검증', exact: true })).toBeDisabled()
      return
    }
    await expect(page.getByRole('alert')).toContainText('서버의 최신 초안을 다시 확인했습니다.')
    const proof = await page.evaluate(() => (window as Window & { __tethReplayProof: unknown }).__tethReplayProof)
    expect(proof).toEqual({ count: 2, sameRequest: true, wireRevisionMatches: true, committed: true, replayStatus: 412, sameData: false, sameEtag: false })
    await expect(page.locator('.g-umsg')).toHaveCount(completeDraft ? 3 : 1)
    await expect(page.locator('[data-delivery="uncertain"]')).toHaveCount(1)
    await expect(page.locator('.g-composer textarea')).toBeEnabled()
    await expect(page.getByRole('button', { name: '계약 검증', exact: true })).toBeDisabled()
  })
})
