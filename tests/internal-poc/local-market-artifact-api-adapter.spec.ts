import { expect, test, type Route } from '@playwright/test'

const packaged = {
  fixtureId: 'paper_fixture_compiler_rsi14_btcusdt_15m_01',
  dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE',
  symbol: 'BTCUSDT',
  sourceTimeframe: '1m',
  evaluationTimeframe: '15m',
  eventCount: 16,
  firstOpenTime: '2026-01-01T00:00:00Z',
  lastCloseTime: '2026-01-01T03:45:00Z',
  fileSha256: 'a'.repeat(64),
  contentHash: 'b'.repeat(64),
  provenanceHash: 'c'.repeat(64),
  policyHash: 'd'.repeat(64),
  manifestSha256: null,
  privateOnly: true,
  verified: false,
  verificationStatus: 'SYNTHETIC_ONLY',
}

const ownerRecorded = {
  fixtureId: 'paper_fixture_owner_btcusdt_15m_0001',
  dataClass: 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT',
  symbol: 'BTCUSDT',
  sourceTimeframe: '1m',
  evaluationTimeframe: '15m',
  eventCount: 96,
  firstOpenTime: '2026-09-04T00:00:00Z',
  lastCloseTime: '2026-09-04T23:45:00Z',
  fileSha256: 'e'.repeat(64),
  contentHash: 'f'.repeat(64),
  provenanceHash: '1'.repeat(64),
  policyHash: '2'.repeat(64),
  manifestSha256: '3'.repeat(64),
  privateOnly: true,
  verified: false,
  verificationStatus: 'UNVERIFIED_FOR_TRADING',
}

const meta = {
  internalContractVersion: 'owner-local-paper-api/0.1',
  requestId: 'req_market_artifact_00000001',
  traceId: 'trace_market_artifact_00000001',
  resourceRevision: null,
}

const fulfill = async (route: Route, artifacts: readonly unknown[]) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ meta, data: { artifacts } }),
  })
}

test('server catalog의 field names를 한 adapter에서만 UI projection으로 변환한다', async ({ page }) => {
  let method: string | null = null
  let headers: Record<string, string> = {}
  let postData: string | null = null
  await page.route('**/internal/poc/market-artifacts', async (route) => {
    method = route.request().method()
    headers = route.request().headers()
    postData = route.request().postData()
    await fulfill(route, [packaged, ownerRecorded])
  })
  await page.goto('/internal-poc-fixture.html')
  const catalog = await page.evaluate(async () => {
    const { createLocalMarketArtifactApiAdapter } = await import('/src/internal-poc/local-market-artifact-api-adapter.ts')
    return createLocalMarketArtifactApiAdapter().readCatalog()
  })

  expect(method).toBe('GET')
  expect(headers.accept).toBe('application/json')
  expect(postData).toBeNull()
  expect(catalog).toEqual({
    artifactVersion: 'paper-market-artifact-catalog-view/1',
    items: [
      {
        artifactId: packaged.fixtureId,
        displayName: 'BTCUSDT 15m 패키지 합성 기록',
        source: 'PACKAGED_SYNTHETIC',
        symbol: packaged.symbol,
        sourceInterval: packaged.sourceTimeframe,
        interval: packaged.evaluationTimeframe,
        eventCount: packaged.eventCount,
        firstEventTime: packaged.firstOpenTime,
        lastEventTime: packaged.lastCloseTime,
        fileSha256: packaged.fileSha256,
        contentHash: packaged.contentHash,
        provenanceHash: packaged.provenanceHash,
        policyHash: packaged.policyHash,
        manifestSha256: null,
        provenance: {
          dataClass: packaged.dataClass,
          verification: 'UNVERIFIED',
          verificationStatus: 'SYNTHETIC_ONLY',
          rights: 'PRIVATE_ONLY',
          label: '서버 패키지 합성 기록 시장 fixture · 성과/실거래 검증 전',
        },
      },
      {
        artifactId: ownerRecorded.fixtureId,
        displayName: 'BTCUSDT 15m 소유자 로컬 기록',
        source: 'OWNER_RECORDED_LOCAL_ARTIFACT',
        symbol: ownerRecorded.symbol,
        sourceInterval: ownerRecorded.sourceTimeframe,
        interval: ownerRecorded.evaluationTimeframe,
        eventCount: ownerRecorded.eventCount,
        firstEventTime: ownerRecorded.firstOpenTime,
        lastEventTime: ownerRecorded.lastCloseTime,
        fileSha256: ownerRecorded.fileSha256,
        contentHash: ownerRecorded.contentHash,
        provenanceHash: ownerRecorded.provenanceHash,
        policyHash: ownerRecorded.policyHash,
        manifestSha256: ownerRecorded.manifestSha256,
        provenance: {
          dataClass: ownerRecorded.dataClass,
          verification: 'UNVERIFIED',
          verificationStatus: 'UNVERIFIED_FOR_TRADING',
          rights: 'PRIVATE_ONLY',
          label: '사용자 소유 로컬 기록 · 출처/실시간/성과/거래 검증 전',
        },
      },
    ],
  })
})

test('unknown·extra·non-NFC·owner boundary·duplicate 응답을 fail-close한다', async ({ page }) => {
  let mode: 'extra' | 'unknown' | 'nonNfc' | 'ownerBoundary' | 'duplicate' = 'extra'
  await page.route('**/internal/poc/market-artifacts', async (route) => {
    const artifacts = mode === 'extra'
      ? [{ ...ownerRecorded, sourcePath: '/not/client-visible' }]
      : mode === 'unknown'
        ? [{ ...ownerRecorded, dataClass: 'UNSCOPED_MARKET_ARTIFACT' }]
        : mode === 'nonNfc'
          ? [{ ...ownerRecorded, evaluationTimeframe: '1e\u0301m' }]
          : mode === 'ownerBoundary'
            ? [{ ...ownerRecorded, privateOnly: false }]
            : [ownerRecorded, ownerRecorded]
    await fulfill(route, artifacts)
  })
  await page.goto('/internal-poc-fixture.html')

  const readError = async () => page.evaluate(async () => {
    const { createLocalMarketArtifactApiAdapter } = await import('/src/internal-poc/local-market-artifact-api-adapter.ts')
    try {
      await createLocalMarketArtifactApiAdapter().readCatalog()
      return null
    } catch (reason) {
      return reason instanceof Error ? reason.message : 'UNKNOWN'
    }
  })

  expect(await readError()).toBe('PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  mode = 'unknown'
  expect(await readError()).toBe('PAPER_MARKET_ARTIFACT_DATA_CLASS_INVALID')
  mode = 'nonNfc'
  expect(await readError()).toBe('PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  mode = 'ownerBoundary'
  expect(await readError()).toBe('PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  mode = 'duplicate'
  expect(await readError()).toBe('PAPER_MARKET_ARTIFACT_CATALOG_INVALID')
})

test('owner-scoped 오류 envelope의 코드만 전달하고 임의 fallback을 만들지 않는다', async ({ page }) => {
  await page.route('**/internal/poc/market-artifacts', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ meta, error: { code: 'NOT_FOUND', message: 'NOT_FOUND' } }),
    })
  })
  await page.goto('/internal-poc-fixture.html')
  const outcome = await page.evaluate(async () => {
    const { createLocalMarketArtifactApiAdapter } = await import('/src/internal-poc/local-market-artifact-api-adapter.ts')
    try {
      return await createLocalMarketArtifactApiAdapter().readCatalog()
    } catch (reason) {
      return reason instanceof Error ? reason.message : 'UNKNOWN'
    }
  })
  expect(outcome).toBe('NOT_FOUND')
})
