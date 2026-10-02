import { expect, test, type Page } from '@playwright/test'

const packagedArtifact = {
  artifactId: 'paper_fixture_compiler_rsi14_btcusdt_15m_01',
  displayName: 'RSI14 BTCUSDT 15분 합성 기록',
  source: 'PACKAGED_SYNTHETIC',
  symbol: 'BTCUSDT',
  sourceInterval: '1m',
  interval: '15m',
  eventCount: 16,
  firstEventTime: '2026-01-01T00:00:00Z',
  lastEventTime: '2026-01-01T03:45:00Z',
  fileSha256: '9'.repeat(64),
  contentHash: 'a'.repeat(64),
  provenanceHash: 'b'.repeat(64),
  policyHash: 'c'.repeat(64),
  manifestSha256: null,
  provenance: {
    dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE',
    verification: 'UNVERIFIED',
    verificationStatus: 'SYNTHETIC_ONLY',
    rights: 'PRIVATE_ONLY',
    label: '패키지 합성 기록 시장 fixture',
  },
} as const

const ownerArtifact = {
  artifactId: 'paper_fixture_owner_btcusdt_15m_0001',
  displayName: '내 로컬 BTCUSDT 기록',
  source: 'OWNER_RECORDED_LOCAL_ARTIFACT',
  symbol: 'BTCUSDT',
  sourceInterval: '1m',
  interval: '15m',
  eventCount: 96,
  firstEventTime: '2026-09-04T00:00:00Z',
  lastEventTime: '2026-09-04T23:45:00Z',
  fileSha256: 'd'.repeat(64),
  contentHash: 'c'.repeat(64),
  provenanceHash: 'd'.repeat(64),
  policyHash: 'e'.repeat(64),
  manifestSha256: 'f'.repeat(64),
  provenance: {
    dataClass: 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT',
    verification: 'UNVERIFIED',
    verificationStatus: 'UNVERIFIED_FOR_TRADING',
    rights: 'PRIVATE_ONLY',
    label: '사용자 소유 로컬 기록 시장 artifact',
  },
} as const

const catalog = (items: readonly unknown[]) => ({
  artifactVersion: 'paper-market-artifact-catalog-view/1',
  items,
})

type Scenario = 'success' | 'pending' | 'error'

const mountPicker = async (page: Page, scenario: Scenario, items: readonly unknown[] = []) => {
  await page.goto('/internal-poc-fixture.html')
  await page.evaluate(async ({ initialScenario, initialCatalog }) => {
    type State = {
      scenario: 'success' | 'pending' | 'error'
      calls: number
      catalog: unknown
      selectedArtifactId: string | null
    }
    const scope = window as typeof window & { __paperArtifactPickerState?: State }
    scope.__paperArtifactPickerState = {
      scenario: initialScenario,
      calls: 0,
      catalog: initialCatalog,
      selectedArtifactId: null,
    }
    const reactModuleUrl = '/@id/react'
    const reactDomModuleUrl = '/@id/react-dom/client'
    const componentModuleUrl = '/src/internal-poc/PaperMarketArtifactPicker.tsx'
    const [reactModule, reactDomModule, { PaperMarketArtifactPicker }] = await Promise.all([
      import(reactModuleUrl),
      import(reactDomModuleUrl),
      import(componentModuleUrl),
    ])
    const createElement = reactModule.createElement ?? reactModule.default.createElement
    const createRoot = reactDomModule.createRoot ?? reactDomModule.default.createRoot
    const host = document.createElement('div')
    host.id = 'paper-artifact-picker-test-root'
    document.body.append(host)
    const adapter = {
      kind: 'recorded-ui-fixture' as const,
      async readCatalog() {
        const state = scope.__paperArtifactPickerState
        if (state === undefined) throw new Error('PAPER_ARTIFACT_TEST_STATE_MISSING')
        state.calls += 1
        if (state.scenario === 'pending') return new Promise<never>(() => undefined)
        if (state.scenario === 'error') throw new Error('PAPER_MARKET_ARTIFACT_FIXTURE_ERROR')
        return state.catalog
      },
    }
    createRoot(host).render(createElement(PaperMarketArtifactPicker, {
      adapterPromise: Promise.resolve(adapter),
      onSelectionChange: (artifact: { artifactId: string } | null) => {
        const state = scope.__paperArtifactPickerState
        if (state !== undefined) state.selectedArtifactId = artifact?.artifactId ?? null
      },
    }))
  }, { initialScenario: scenario, initialCatalog: catalog(items) })
}

test('패키지 합성과 owner-recorded artifact를 분리하고 선택을 terminal로 승격하지 않는다', async ({ page }) => {
  await mountPicker(page, 'success', [packagedArtifact, ownerArtifact])
  const picker = page.getByRole('region', { name: 'Paper 입력 artifact 선택' })

  await expect(picker.getByText('MARKET_ARTIFACT_CATALOG · UI_FIXTURE_ONLY')).toBeVisible()
  await expect(picker.getByText('PACKAGED_SYNTHETIC', { exact: true })).toBeVisible()
  await expect(picker.getByText('OWNER_RECORDED_LOCAL_ARTIFACT', { exact: true })).toBeVisible()
  await expect(picker.getByText(/SYNTHETIC_RECORDED_MARKET_FIXTURE · SYNTHETIC_ONLY/)).toBeVisible()
  await expect(picker.getByText(/OWNER_LOCAL_RECORDED_MARKET_ARTIFACT · UNVERIFIED_FOR_TRADING/)).toBeVisible()
  await expect(picker.getByText(/UNVERIFIED는 성과·실거래 검증 전/)).toBeVisible()
  await expect(picker.getByText(/출처·실시간성·성과·거래 검증 전/)).toBeVisible()

  await picker.getByLabel('내 로컬 BTCUSDT 기록').check()
  await expect(picker.getByText('입력 선택만 준비되었습니다.')).toBeVisible()
  expect(await page.evaluate(() => (
    window as typeof window & { __paperArtifactPickerState?: { selectedArtifactId: string | null } }
  ).__paperArtifactPickerState?.selectedArtifactId)).toBe(ownerArtifact.artifactId)
  await expect(picker.getByText(/COMPLETED_LOCAL_RECORDED_ARTIFACT_ONLY/)).toHaveCount(0)
  await expect(picker.getByLabel('Paper ledger 요약')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})

test('loading과 empty 상태에서 artifact를 만들거나 선택하지 않는다', async ({ page }) => {
  await mountPicker(page, 'pending')
  let picker = page.getByRole('region', { name: 'Paper 입력 artifact 선택' })
  await expect(picker.getByText('서버 artifact 목록을 확인하고 있습니다.')).toBeVisible()
  await expect(picker.locator('[aria-busy="true"]')).toBeVisible()
  await expect(picker.getByRole('radio')).toHaveCount(0)

  await page.reload()
  await mountPicker(page, 'success')
  picker = page.getByRole('region', { name: 'Paper 입력 artifact 선택' }).last()
  await expect(picker.getByText('사용 가능한 owner-local artifact가 없습니다.')).toBeVisible()
  await expect(picker.getByRole('radio')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})

test('오류 후 명시적 재시도와 reload가 서버 투영 목록만 다시 읽는다', async ({ page }) => {
  await mountPicker(page, 'error')
  const picker = page.getByRole('region', { name: 'Paper 입력 artifact 선택' })
  await expect(picker.getByText('PAPER_CATALOG_UNAVAILABLE')).toBeVisible()
  await expect(picker).not.toContainText('PAPER_MARKET_ARTIFACT_FIXTURE_ERROR')
  await expect(picker.getByRole('radio')).toHaveCount(0)

  await page.evaluate((nextCatalog) => {
    const state = (
      window as typeof window & {
        __paperArtifactPickerState?: { scenario: 'success' | 'pending' | 'error'; catalog: unknown }
      }
    ).__paperArtifactPickerState
    if (state === undefined) throw new Error('PAPER_ARTIFACT_TEST_STATE_MISSING')
    state.scenario = 'success'
    state.catalog = nextCatalog
  }, catalog([ownerArtifact]))
  await picker.getByRole('button', { name: '다시 시도' }).click()
  await expect(picker.getByText(ownerArtifact.displayName)).toBeVisible()

  await page.evaluate((nextCatalog) => {
    const state = (
      window as typeof window & { __paperArtifactPickerState?: { catalog: unknown } }
    ).__paperArtifactPickerState
    if (state === undefined) throw new Error('PAPER_ARTIFACT_TEST_STATE_MISSING')
    state.catalog = nextCatalog
  }, catalog([packagedArtifact]))
  await picker.getByRole('button', { name: '목록 다시 불러오기' }).click()
  await expect(picker.getByText(packagedArtifact.displayName)).toBeVisible()
  await expect(picker.getByText(ownerArtifact.displayName)).toHaveCount(0)
  expect(await page.evaluate(() => (
    window as typeof window & { __paperArtifactPickerState?: { calls: number } }
  ).__paperArtifactPickerState?.calls)).toBe(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})
