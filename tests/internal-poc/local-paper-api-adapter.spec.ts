import { createHash } from 'node:crypto'
import { expect, test, type Page, type Route } from '@playwright/test'
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'

const BACKEND_PROFILE_HASH = 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497'
const STRATEGY_VERSION_ID = 'sv_fixture_00000001'
const SEMANTIC_HASH = '39cbfd0090218a159ae03ef11e9d686482a644772dab291b03b864658caf2e46'
const PAPER_SESSION_ID = 'paper_session_local_00000001'
const FIXTURE_ID = 'paper_fixture_compiler_rsi14_btcusdt_15m_01'
const FIXTURE_FILE_SHA = '06e627d4e9462e86b5a386ed8d3c28c090be7d4994c87a45bf715ee6bfbd9bfd'
const FIXTURE_CONTENT_HASH = 'a'.repeat(64)
const FIXTURE_PROVENANCE_HASH = 'b'.repeat(64)
const FIXTURE_POLICY_HASH = 'c'.repeat(64)
const SIGNAL_HASH = '1e024dc7c1e8e986a2d3f9163bbaf99a314eaec9c3702b837f209562adcc225e'
const ORDER_INTENT_HASH = '5ac48f355731c4abc1e46af0d75f9a52454b1ff2e33e28d237fe37674dc6e691'
const FILL_HASH = '81639ab107d10dcd17b1aeb7463b743acbdf6b3c2d74e2780e1b1770f2d897bf'

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

const startRequestDigest = (value: unknown): string => createHash('sha256')
  .update(`tesia.owner-local.start-paper.v1\0${canonicalJson(value)}`)
  .digest('hex')

const internalMeta = (revision: string | null) => ({
  internalContractVersion: 'owner-local-paper-api/0.1',
  requestId: 'req_local_paper_00000001',
  traceId: 'trace_local_paper_00000001',
  resourceRevision: revision,
})

const publicMeta = (revision: string | null = null) => ({
  apiContractVersion: '0.1.0',
  requestId: 'request_fixture_00000001',
  traceId: 'trace_fixture_00000001',
  resourceRevision: revision,
})

const ledger = {
  initialWallet: '1000',
  markPrice: '78',
  wallet: '999.95062500',
  equity: '998.70062500',
  quantity: '1.25',
  averageEntry: '79.0',
  realizedPnl: '0',
  unrealizedPnl: '-1.250',
  fees: '0.04937500',
  funding: '0',
}

// Literal hashes below were produced by tesia-contracts 0.12.0rc2 at
// badad94a34908de7b608fd6c644cb8a0891d5d36, through runtime_content_hash_v04.
// They intentionally do not use this Web implementation as the test oracle.
const ledgerHash = '4d79cb520a801104f1d4f35063ba54c375af4e224485bbf5c62b16aa685506bd'
const OLD_PLAIN_LEDGER_HASH = 'b981eced129e3e7352bbc798de5cac2c24620358b4b0965dfef0dd7831d1ff92'

const replayPreimage = {
  artifactVersion: 'local-paper-replay/1',
  strategySemanticHash: SEMANTIC_HASH,
  signalHash: SIGNAL_HASH,
  orderIntentHash: ORDER_INTENT_HASH,
  terminalCheckpoint: {
    artifactVersion: 'local-paper-checkpoint/1',
    sessionId: PAPER_SESSION_ID,
    revision: 2,
  },
  terminalLedger: ledger,
}

const REPLAY_HASH = '40f483b65e4c64261032542b5b64c472d6b23919b664364ff06c05129b43bdef'

const reportWithoutHash = {
  artifactVersion: 'owner-local-paper-session-report/1',
  status: 'COMPLETED_LOCAL_FIXTURE_ONLY',
  provenance: {
    dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE',
    verified: false,
    privateOnly: true,
    label: '실제 Paper 엔진 실행·합성 기록 시장 데이터',
  },
  externalEffects: {
    evidenceKind: 'STATIC_OFFLINE_CAPABILITY_BOUNDARY',
    networkCalls: 0,
    exchangeCalls: 0,
    credentialReads: 0,
    orders: 0,
  },
  strategy: {
    strategyVersionId: STRATEGY_VERSION_ID,
    semanticHash: SEMANTIC_HASH,
    strategyVersionContentHash: 'c'.repeat(64),
    strategyVersionFileSha256: 'd'.repeat(64),
    approvalAuthority: 'OWNER_LOCAL_SQLITE_APPROVAL_RECORD',
    approvalRecordFileSha256: 'e'.repeat(64),
  },
  fixture: { fixtureFileSha256: FIXTURE_FILE_SHA },
  strategyCoverage: {
    entryRuleEvaluated: true,
    riskLimitsApplied: true,
    exitRulesEvaluated: false,
    unevaluatedExitRuleIds: ['exit_stop', 'exit_take'],
  },
  execution: {
    evaluationCandleCount: 16,
    recordedMarketEventCount: 2,
    signalCount: 1,
    intentCount: 1,
    fillCount: 1,
    positionQuantity: '1.25',
    signalHash: SIGNAL_HASH,
    orderIntentHash: ORDER_INTENT_HASH,
    fillHashes: [FILL_HASH],
    ledger,
  },
  restart: {
    firstCheckpointRevision: 1,
    terminalCheckpointRevision: 2,
    fencingToken: 2,
    duplicateIntentCount: 1,
    duplicateEventCount: 1,
    newFillCountAfterDuplicateReplay: 0,
  },
  replayPreimage,
  replayHash: REPLAY_HASH,
  replayEqual: true,
}

const reportHash = '870c79b6ae5ea4fac502eea7815b9c3a71f664110980b82cc4a380a237565a88'
const report = { ...reportWithoutHash, reportHash }

const BACKEND_RUNTIME_HASH_V04_OMISSION_VECTOR = {
  artifactVersion: 'runtime-content-hash-v04-fixed-vector/1',
  contentHash: '0'.repeat(64),
  runHash: '1'.repeat(64),
  nested: {
    contentHash: 'nested-content-hash-is-not-omitted',
    runHash: 'nested-run-hash-is-not-omitted',
  },
  label: '실제 Paper 엔진 실행·합성 기록 시장 데이터',
}
const BACKEND_RUNTIME_HASH_V04_OMISSION_HASH = '19bbae6feb32e09fcb06b70a582a806b947be6a6c4964685457f0ae09704badf'

const queuedStatus = {
  paperSessionId: PAPER_SESSION_ID,
  strategyVersionId: STRATEGY_VERSION_ID,
  semanticHash: SEMANTIC_HASH,
  fixtureId: FIXTURE_ID,
  state: 'QUEUED',
  revision: '1',
  attempt: '0',
  createdAt: '2026-09-05T12:00:00Z',
  updatedAt: '2026-09-05T12:00:00Z',
  resultAvailable: false,
  provenance: { dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE', verified: false, privateOnly: true },
}

const completedStatus = {
  ...queuedStatus,
  state: 'COMPLETED',
  revision: '3',
  attempt: '1',
  updatedAt: '2026-09-05T12:00:02Z',
  resultAvailable: true,
  resultHashes: { reportHash, replayHash: REPLAY_HASH, ledgerHash, fixtureFileSha256: FIXTURE_FILE_SHA },
}

const result = {
  artifactVersion: 'owner-local-paper-result/1',
  paperSessionId: PAPER_SESSION_ID,
  strategyVersionId: STRATEGY_VERSION_ID,
  semanticHash: SEMANTIC_HASH,
  fixtureId: FIXTURE_ID,
  fixtureFileSha256: FIXTURE_FILE_SHA,
  reportHash,
  replayHash: REPLAY_HASH,
  ledgerHash,
  report,
}

const marketArtifactCatalog = {
  artifacts: [{
    fixtureId: FIXTURE_ID,
    dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE',
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    evaluationTimeframe: '15m',
    eventCount: 16,
    firstOpenTime: '2026-01-01T00:00:00Z',
    lastCloseTime: '2026-01-01T03:45:00Z',
    fileSha256: FIXTURE_FILE_SHA,
    contentHash: FIXTURE_CONTENT_HASH,
    provenanceHash: FIXTURE_PROVENANCE_HASH,
    policyHash: FIXTURE_POLICY_HASH,
    manifestSha256: null,
    privateOnly: true,
    verified: false,
    verificationStatus: 'SYNTHETIC_ONLY',
  }],
}
const packagedArtifactBinding = {
  artifactId: FIXTURE_ID,
  source: 'PACKAGED_SYNTHETIC' as const,
  fileSha256: FIXTURE_FILE_SHA,
  contentHash: FIXTURE_CONTENT_HASH,
  provenanceHash: FIXTURE_PROVENANCE_HASH,
  policyHash: FIXTURE_POLICY_HASH,
  manifestSha256: null,
  verificationStatus: 'SYNTHETIC_ONLY' as const,
}

const fulfill = async (route: Route, data: unknown, status = 200, revision: string | null = null) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ meta: internalMeta(revision), data }),
  })
}

const installCompletedStrategyRecovery = async (page: Page) => {
  const payloads = await createFixtureRecoveryPayloads(BACKEND_PROFILE_HASH)
  await page.route('**/internal-poc.html*', async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    const meta = `<meta name="tesia-structural-smoke-profile-hash" content="${BACKEND_PROFILE_HASH}" />`
    await route.fulfill({
      response,
      body: html.replace('<meta name="robots" content="noindex,nofollow" />', `<meta name="robots" content="noindex,nofollow" />${meta}`),
    })
  })

  const job = payloads.job
  const backtestReport = payloads.report
  if (
    job.strategyVersionId !== STRATEGY_VERSION_ID
    || job.semanticHash !== SEMANTIC_HASH
    || backtestReport.strategyVersionId !== STRATEGY_VERSION_ID
    || backtestReport.semanticHash !== SEMANTIC_HASH
  ) throw new Error('WEB_RECORDED_COMPILER_FIXTURE_BINDING_INVALID')
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let data: unknown
    let etag: string | undefined
    let revision: string | null = null
    if (url.pathname === '/api/v1/me') {
      data = { authenticated: true, principalDisplay: '로컬 POC 사용자' }
    } else if (url.pathname === '/api/v1/auth/csrf') {
      data = { csrfToken: 'csrf_local_paper_token_00000001', expiresAt: '2026-09-05T13:00:00Z' }
    } else if (url.pathname === `/api/v1/strategy-drafts/${payloads.ids.draftId}`) {
      data = payloads.draft
      etag = '"etag_fixture_recovery_0001"'
      revision = '2'
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}`) {
      data = job
      etag = '"etag_backtest_fixture_0007"'
      revision = job.revision
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}/report`) {
      data = backtestReport
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}/manifest`) {
      data = payloads.manifest
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}/trades`) {
      data = url.searchParams.get('segment') === 'OOS' ? payloads.trades.OOS : payloads.trades.IS
    } else {
      await route.abort('blockedbyclient')
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      ...(etag === undefined ? {} : { headers: { ETag: etag } }),
      body: JSON.stringify({ meta: publicMeta(revision), data }),
    })
  })

  await page.goto('/internal-poc.html')
  await page.evaluate(({ draftId, backtestId }) => {
    sessionStorage.setItem('tesia-internal-poc-client-snapshot-v1', JSON.stringify({
      conversationId: 'conversation_fixture_0001',
      draftId,
      draftEtag: 'etag_draft_fixture_00000002',
      draftRevision: '2',
      backtestId,
    }))
  }, payloads.ids)
  await page.reload()
  await expect(page.getByRole('heading', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })).toBeVisible()
}

test('Web focused mock에서 exact semantic의 owner-local adapter shape와 status/result 결속을 검증한다', async ({ page }) => {
  let postedBody: unknown
  let postedHeaders: Record<string, string> = {}
  let tamper: 'none' | 'statusSemantic' | 'statusMetaRevision' | 'resultMetaRevision' | 'resultAvailable' | 'resultReplay' | 'replayPreimage' | 'exitRules' | 'ledgerBody' | 'plainLedgerHash' | 'failedStatus' = 'none'
  const productConsoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const source = message.location().url
    // Shared node_modules font serving and Vite HMR are known local harness
    // limits; keep them separate from console errors emitted by product code.
    if (source.includes('geist-latin-wght-normal.woff2') || source.includes('/@vite/client')) return
    productConsoleErrors.push(`${source}:${message.text()}`)
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.route('**/internal/poc/market-artifacts', async (route) => {
    await fulfill(route, marketArtifactCatalog, 200, '1')
  })

  await page.route('**/internal/poc/paper-sessions**', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST' && url.pathname === '/internal/poc/paper-sessions') {
      postedBody = route.request().postDataJSON()
      postedHeaders = route.request().headers()
      await fulfill(route, queuedStatus, 201, '1')
      return
    }
    if (url.pathname === `/internal/poc/paper-sessions/${PAPER_SESSION_ID}`) {
      await fulfill(route, tamper === 'failedStatus'
        ? {
            ...queuedStatus,
            state: 'FAILED',
            revision: '3',
            updatedAt: '2026-09-04T10:00:03Z',
            resultAvailable: false,
            failureCode: 'postgres://owner:password@private-db response cookie=session_secret csrf=csrf_secret',
          }
        : tamper === 'statusSemantic'
          ? { ...completedStatus, semanticHash: '0'.repeat(64) }
        : tamper === 'resultAvailable'
          ? { ...completedStatus, resultAvailable: 'true' }
          : tamper === 'plainLedgerHash'
            ? { ...completedStatus, resultHashes: { ...completedStatus.resultHashes, ledgerHash: OLD_PLAIN_LEDGER_HASH } }
            : completedStatus, 200, tamper === 'statusMetaRevision' ? '2' : '3')
      return
    }
    if (url.pathname === `/internal/poc/paper-sessions/${PAPER_SESSION_ID}/result`) {
      const response = tamper === 'resultReplay'
        ? { ...result, replayHash: '0'.repeat(64) }
        : tamper === 'replayPreimage'
          ? {
              ...result,
              report: {
                ...report,
                replayPreimage: { ...replayPreimage, strategySemanticHash: '0'.repeat(64) },
              },
            }
          : tamper === 'exitRules'
            ? {
                ...result,
                report: {
                  ...report,
                  strategyCoverage: { ...report.strategyCoverage, unevaluatedExitRuleIds: ['exit_unknown'] },
                },
              }
        : tamper === 'ledgerBody'
          ? {
              ...result,
              report: {
                ...report,
                execution: { ...report.execution, ledger: { ...ledger, wallet: '1999.95062500' } },
              },
            }
          : tamper === 'plainLedgerHash'
            ? { ...result, ledgerHash: OLD_PLAIN_LEDGER_HASH }
            : result
      await fulfill(route, response, 200, tamper === 'resultMetaRevision' ? '2' : '3')
      return
    }
    await route.abort('blockedbyclient')
  })
  await installCompletedStrategyRecovery(page)

  const paper = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(paper.getByText('OWNER_LOCAL_PAPER_SESSION · PRIVATE_LOOPBACK_ONLY')).toBeVisible()
  await paper.getByRole('radio', { name: /BTCUSDT 15m 패키지 합성 기록/ }).check()
  await paper.getByRole('button', { name: 'Paper 실행' }).click()
  await expect(paper.getByText('서버 실행 대기').first()).toBeVisible()
  expect(postedBody).toEqual({
    strategyVersionId: STRATEGY_VERSION_ID,
    expectedSemanticHash: SEMANTIC_HASH,
    fixtureId: FIXTURE_ID,
  })
  expect(postedHeaders['x-csrf-token']).toBe('csrf_local_paper_token_00000001')
  expect(postedHeaders['idempotency-key']).toMatch(/^paper_[A-Za-z0-9_]{16,128}$/)

  await paper.getByRole('button', { name: '새로고침' }).click()
  await expect(paper.getByText('COMPLETED_LOCAL_FIXTURE_ONLY', { exact: true })).toBeVisible()
  await expect(paper.getByText('999.95062500 USDT')).toBeVisible()
  await expect(paper.getByText('exitRulesEvaluated=false')).toBeVisible()
  await expect(paper.getByText(/exit_stop, exit_take/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)

  await page.reload()
  const restored = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(restored.getByText('서버 active Paper session을 복원했습니다.')).toBeVisible({ timeout: 15_000 })
  await expect(restored.getByText('999.95062500 USDT')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)

  tamper = 'statusSemantic'
  await page.reload()
  let failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'statusMetaRevision'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'resultMetaRevision'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'resultAvailable'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'resultReplay'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'replayPreimage'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'exitRules'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'ledgerBody'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'plainLedgerHash'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible({ timeout: 15_000 })
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)

  tamper = 'failedStatus'
  await page.reload()
  failed = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failed.getByText('PAPER_EXECUTION_UNAVAILABLE')).toBeVisible({ timeout: 15_000 })
  await expect(failed).not.toContainText(/private-db|password|session_secret|csrf_secret/)
  await expect(failed.getByLabel('Paper ledger 요약')).toHaveCount(0)
  expect(productConsoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('runtime_content_hash_v04는 Backend fixed vector의 domain과 top-level field omission을 따른다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  const observed = await page.evaluate(async (vector) => {
    const { runtimeContentHashV04 } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    let nonNfcKeyError: string | null = null
    try {
      await runtimeContentHashV04({ ['e\u0301']: 1 })
    } catch (reason) {
      nonNfcKeyError = reason instanceof Error ? reason.message : 'UNKNOWN'
    }
    return {
      original: await runtimeContentHashV04(vector),
      changedOmittedFields: await runtimeContentHashV04({
        ...vector,
        contentHash: 'a'.repeat(64),
        runHash: 'b'.repeat(64),
      }),
      changedNestedField: await runtimeContentHashV04({
        ...vector,
        nested: { ...vector.nested, runHash: 'changed-and-not-omitted' },
      }),
      nonNfcKeyError,
    }
  }, BACKEND_RUNTIME_HASH_V04_OMISSION_VECTOR)

  expect(observed.original).toBe(BACKEND_RUNTIME_HASH_V04_OMISSION_HASH)
  expect(observed.changedOmittedFields).toBe(BACKEND_RUNTIME_HASH_V04_OMISSION_HASH)
  expect(observed.changedNestedField).not.toBe(BACKEND_RUNTIME_HASH_V04_OMISSION_HASH)
  expect(observed.nonNfcKeyError).toBe('PAPER_API_CANONICAL_VALUE_INVALID')
})

test('owner-recorded terminal은 catalog authority 8필드와 status/report/replay를 exact 결속한다', async ({ page }) => {
  const ownerId = 'paper_fixture_owner_btcusdt_15m_0001'
  const ownerBinding = {
    artifactId: ownerId,
    source: 'OWNER_RECORDED_LOCAL_ARTIFACT' as const,
    fileSha256: 'd'.repeat(64),
    contentHash: 'e'.repeat(64),
    provenanceHash: 'f'.repeat(64),
    policyHash: '1'.repeat(64),
    manifestSha256: '2'.repeat(64),
    verificationStatus: 'UNVERIFIED_FOR_TRADING' as const,
  }
  const authority = {
    dataClass: 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT',
    verificationStatus: 'UNVERIFIED_FOR_TRADING',
    fixtureFileSha256: ownerBinding.fileSha256,
    artifactContentHash: ownerBinding.contentHash,
    provenanceHash: ownerBinding.provenanceHash,
    executionProfileHash: ownerBinding.policyHash,
  }
  const ownerReplayPreimage = { ...replayPreimage, marketArtifactAuthority: authority }
  const ownerReplayHash = 'c4a47c22c423b86930c5b84978f868ac2560d9b3e7d3abfe3cf290615a23702f'
  const ownerReportWithoutHash = {
    ...reportWithoutHash,
    status: 'COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY',
    provenance: {
      dataClass: 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT', verified: false, privateOnly: true,
      label: '실제 Paper 엔진 실행·소유자 로컬 공개시장 기록 데이터',
      verificationStatus: 'UNVERIFIED_FOR_TRADING',
    },
    fixture: { ...authority, fixtureId: ownerId, manifestSha256: ownerBinding.manifestSha256 },
    replayPreimage: { ...ownerReplayPreimage, marketArtifactAuthority: { ...authority, fixtureId: ownerId, manifestSha256: ownerBinding.manifestSha256 } },
    replayHash: ownerReplayHash,
  }
  const ownerReportHash = '9cf25a2fbf89b244d2770bbd340cefcddbd084508adb00726f10bceb4cada547'
  const ownerStatus = {
    ...completedStatus,
    fixtureId: ownerId,
    provenance: { dataClass: 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT', verified: false, privateOnly: true, verificationStatus: 'UNVERIFIED_FOR_TRADING' },
    resultHashes: {
      reportHash: ownerReportHash, replayHash: ownerReplayHash, ledgerHash,
      fixtureFileSha256: ownerBinding.fileSha256,
      artifactContentHash: ownerBinding.contentHash, provenanceHash: ownerBinding.provenanceHash,
      policyHash: ownerBinding.policyHash, manifestSha256: ownerBinding.manifestSha256,
    },
  }
  const ownerResult = {
    ...result,
    fixtureId: ownerId,
    fixtureFileSha256: ownerBinding.fileSha256,
    reportHash: ownerReportHash,
    replayHash: ownerReplayHash,
    report: { ...ownerReportWithoutHash, reportHash: ownerReportHash },
    marketArtifactAuthority: { ...authority, fixtureId: ownerId, manifestSha256: ownerBinding.manifestSha256 },
  }
  let tamper = false
  await page.route('**/internal/poc/paper-sessions**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'POST') return fulfill(route, Object.fromEntries(Object.entries({ ...ownerStatus, state: 'QUEUED', revision: '1', attempt: '0', resultAvailable: false, updatedAt: queuedStatus.updatedAt }).filter(([key]) => key !== 'resultHashes')), 201, '1')
    if (path.endsWith('/result')) return fulfill(route, ownerResult, 200, '3')
    return fulfill(route, tamper
      ? { ...ownerStatus, resultHashes: { ...ownerStatus.resultHashes, artifactContentHash: '0'.repeat(64) } }
      : ownerStatus, 200, '3')
  })
  await page.goto('/internal-poc-fixture.html')
  const observed = await page.evaluate(async ({ selected, strategy }) => {
    const { createLocalPaperApiAdapter } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    const adapter = await createLocalPaperApiAdapter()
    const started = await adapter.startSessionForArtifact?.(strategy, { csrfToken: 'csrf_local_paper_token_00000001' }, selected)
    const done = await adapter.refreshSession(started?.snapshot?.sessionId ?? '', strategy)
    return done.snapshot
  }, { selected: ownerBinding, strategy: { strategyVersionId: STRATEGY_VERSION_ID, semanticHash: SEMANTIC_HASH } })
  expect(observed?.stage).toBe('COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY')
  expect(observed?.marketArtifact).toEqual(ownerBinding)
  tamper = true
  const error = await page.evaluate(async (strategy) => {
    const { createLocalPaperApiAdapter } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    const adapter = await createLocalPaperApiAdapter()
    try { await adapter.readActive(strategy); return null } catch (reason) { return reason instanceof Error ? reason.message : 'UNKNOWN' }
  }, { strategyVersionId: STRATEGY_VERSION_ID, semanticHash: SEMANTIC_HASH })
  expect(error).toBe('PAPER_API_ARTIFACT_AUTHORITY_MISMATCH')
})

test('owner-local adapter는 incompatible semantic을 Golden으로 대체하지 않고 409를 전달한다', async ({ page }) => {
  let postedBody: unknown
  await page.route('**/internal/poc/paper-sessions', async (route) => {
    postedBody = route.request().postDataJSON()
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        meta: internalMeta(null),
        error: { code: 'PAPER_FIXTURE_STRATEGY_MISMATCH', message: 'PAPER_FIXTURE_STRATEGY_MISMATCH' },
      }),
    })
  })
  await page.goto('/internal-poc-fixture.html')
  const error = await page.evaluate(async (selectedArtifact) => {
    const { createLocalPaperApiAdapter } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    const adapter = await createLocalPaperApiAdapter()
    try {
      await adapter.startSessionForArtifact?.({
        strategyVersionId: 'strategy_version_fixture_00000001',
        semanticHash: '2'.repeat(64),
      }, { csrfToken: 'csrf_local_paper_token_00000001' }, selectedArtifact)
      return null
    } catch (reason) {
      return reason instanceof Error ? reason.message : 'UNKNOWN'
    }
  }, packagedArtifactBinding)
  expect(error).toBe('PAPER_FIXTURE_STRATEGY_MISMATCH')
  expect(postedBody).toEqual({
    strategyVersionId: 'strategy_version_fixture_00000001',
    expectedSemanticHash: '2'.repeat(64),
    fixtureId: FIXTURE_ID,
  })
})

test('POST 응답 유실 뒤 exact 요청은 persisted idempotency key를 재사용하고 성공 뒤 제거한다', async ({ page }) => {
  const idempotencyKeys: string[] = []
  let requestCount = 0
  await page.route('**/internal/poc/paper-sessions', async (route) => {
    requestCount += 1
    idempotencyKeys.push(route.request().headers()['idempotency-key'])
    if (requestCount === 1) {
      await route.abort('connectionreset')
      return
    }
    await fulfill(route, queuedStatus, 201, '1')
  })
  await page.goto('/internal-poc-fixture.html')
  const outcome = await page.evaluate(async ({ strategyVersionId, semanticHash, selectedArtifact }) => {
    const {
      createLocalPaperApiAdapter,
      LOCAL_PAPER_PENDING_REQUEST_KEY,
    } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    const adapter = await createLocalPaperApiAdapter()
    const strategy = { strategyVersionId, semanticHash }
    let firstError: string | null = null
    try {
      await adapter.startSessionForArtifact?.(strategy, { csrfToken: 'csrf_local_paper_token_00000001' }, selectedArtifact)
    } catch (reason) {
      firstError = reason instanceof Error ? reason.message : 'UNKNOWN'
    }
    const pendingAfterLoss = JSON.parse(sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY) ?? 'null') as null | {
      version: string
      idempotencyKey: string
      strategy: { strategyVersionId: string; semanticHash: string }
      artifact: unknown
      requestDigest: string
    }
    const retried = await adapter.startSessionForArtifact?.(strategy, { csrfToken: 'csrf_local_paper_token_00000001' }, selectedArtifact)
    return {
      firstError,
      pendingAfterLoss,
      retriedStage: retried.snapshot?.stage ?? null,
      pendingAfterSuccess: sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY),
    }
  }, { strategyVersionId: STRATEGY_VERSION_ID, semanticHash: SEMANTIC_HASH, selectedArtifact: packagedArtifactBinding })

  expect(outcome.firstError).not.toBeNull()
  expect(outcome.pendingAfterLoss).toEqual({
    version: 'pending-paper-request/2',
    idempotencyKey: idempotencyKeys[0],
    strategy: { strategyVersionId: STRATEGY_VERSION_ID, semanticHash: SEMANTIC_HASH },
    artifact: packagedArtifactBinding,
    requestDigest: startRequestDigest({
      strategyVersionId: STRATEGY_VERSION_ID,
      expectedSemanticHash: SEMANTIC_HASH,
      fixtureId: FIXTURE_ID,
    }),
  })
  expect(idempotencyKeys).toHaveLength(2)
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])
  expect(outcome.retriedStage).toBe('QUEUED')
  expect(outcome.pendingAfterSuccess).toBeNull()
})

test('유실된 pending 요청과 다른 strategy binding은 POST 전에 차단하고 명시 reset만 폐기한다', async ({ page }) => {
  let requestCount = 0
  await page.route('**/internal/poc/paper-sessions', async (route) => {
    requestCount += 1
    await route.abort('connectionreset')
  })
  await page.goto('/internal-poc-fixture.html')
  const outcome = await page.evaluate(async ({ strategyVersionId, semanticHash, selectedArtifact }) => {
    const {
      createLocalPaperApiAdapter,
      LOCAL_PAPER_PENDING_REQUEST_KEY,
    } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    const adapter = await createLocalPaperApiAdapter()
    const approved = { strategyVersionId, semanticHash }
    try {
      await adapter.startSessionForArtifact?.(approved, { csrfToken: 'csrf_local_paper_token_00000001' }, selectedArtifact)
    } catch {
      // The response-loss path intentionally leaves the pending request intact.
    }
    let mismatchError: string | null = null
    try {
      await adapter.startSessionForArtifact?.({ ...approved, semanticHash: '0'.repeat(64) }, { csrfToken: 'csrf_local_paper_token_00000001' }, selectedArtifact)
    } catch (reason) {
      mismatchError = reason instanceof Error ? reason.message : 'UNKNOWN'
    }
    let artifactMismatchError: string | null = null
    try {
      await adapter.startSessionForArtifact?.(approved, { csrfToken: 'csrf_local_paper_token_00000001' }, {
        ...selectedArtifact,
        artifactId: 'paper_fixture_changed_btcusdt_15m_0002',
        contentHash: '7'.repeat(64),
      })
    } catch (reason) {
      artifactMismatchError = reason instanceof Error ? reason.message : 'UNKNOWN'
    }
    const pendingBeforeReset = sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY)
    adapter.resetLocalView?.()
    return {
      mismatchError,
      artifactMismatchError,
      pendingBeforeReset: pendingBeforeReset !== null,
      pendingAfterReset: sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY),
    }
  }, { strategyVersionId: STRATEGY_VERSION_ID, semanticHash: SEMANTIC_HASH, selectedArtifact: packagedArtifactBinding })

  expect(requestCount).toBe(1)
  expect(outcome).toEqual({
    mismatchError: 'PAPER_API_PENDING_REQUEST_BINDING_MISMATCH',
    artifactMismatchError: 'PAPER_API_PENDING_REQUEST_BINDING_MISMATCH',
    pendingBeforeReset: true,
    pendingAfterReset: null,
  })
})

test('응답 유실 UI는 pending을 보존해 동일 idempotency key로 재전송하고 폐기 액션과 분리한다', async ({ page }) => {
  const idempotencyKeys: string[] = []
  let postCount = 0
  await page.route('**/internal/poc/market-artifacts', (route) => fulfill(route, marketArtifactCatalog, 200, '1'))
  await page.route('**/internal/poc/paper-sessions', async (route) => {
    postCount += 1
    idempotencyKeys.push(route.request().headers()['idempotency-key'])
    if (postCount === 1) return route.abort('connectionreset')
    return fulfill(route, queuedStatus, 201, '1')
  })
  await installCompletedStrategyRecovery(page)
  const paper = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await paper.getByRole('radio', { name: /BTCUSDT 15m 패키지 합성 기록/ }).check()
  await paper.getByRole('button', { name: 'Paper 실행' }).click()
  await expect(paper.getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  await expect(paper.getByRole('button', { name: '요청 명시적 폐기' })).toBeVisible()
  expect(await page.evaluate(async () => {
    const { LOCAL_PAPER_PENDING_REQUEST_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    return sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY) !== null
  })).toBe(true)
  await paper.getByRole('button', { name: '동일 요청 재전송' }).click()
  await expect(paper.getByText('서버 실행 대기').first()).toBeVisible()
  expect(idempotencyKeys).toHaveLength(2)
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])
  expect(await page.evaluate(async () => {
    const { LOCAL_PAPER_PENDING_REQUEST_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    return sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY)
  })).toBeNull()
})

test('미시작 catalog refresh 실패는 선택과 pending을 폐기하고 새 Paper start를 차단한다', async ({ page }) => {
  let catalogError = false
  let postCount = 0
  await page.route('**/internal/poc/market-artifacts', async (route) => {
    if (catalogError) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          meta: internalMeta(null),
          error: {
            code: 'CATALOG_TEMPORARILY_UNAVAILABLE',
            message: 'private response csrf=csrf_secret cookie=session_secret',
          },
        }),
      })
      return
    }
    return fulfill(route, marketArtifactCatalog, 200, '1')
  })
  await page.route('**/internal/poc/paper-sessions', async (route) => {
    postCount += 1
    await route.abort('connectionreset')
  })
  await installCompletedStrategyRecovery(page)

  const paper = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  const picker = paper.getByRole('region', { name: 'Paper 입력 artifact 선택' })
  await picker.getByRole('radio').check()
  await paper.getByRole('button', { name: 'Paper 실행' }).click()
  await expect(paper.getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  expect(await page.evaluate(async () => {
    const { LOCAL_PAPER_PENDING_REQUEST_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    return sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY) !== null
  })).toBe(true)

  catalogError = true
  await picker.getByRole('button', { name: '목록 다시 불러오기' }).click()
  await expect(picker.getByText('PAPER_CATALOG_UNAVAILABLE')).toBeVisible()
  await expect(picker).not.toContainText(/CATALOG_TEMPORARILY_UNAVAILABLE|csrf_secret|session_secret/)
  await expect(paper.getByRole('button', { name: '동일 요청 재전송' })).toHaveCount(0)
  await expect(paper.getByRole('button', { name: 'Paper 실행' })).toBeDisabled()
  expect(await page.evaluate(async () => {
    const { LOCAL_PAPER_PENDING_REQUEST_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    return sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY)
  })).toBeNull()
  expect(postCount).toBe(1)

  catalogError = false
  await picker.getByRole('button', { name: '다시 시도' }).click()
  await expect(picker.getByRole('radio')).not.toBeChecked()
  await expect(paper.getByRole('button', { name: 'Paper 실행' })).toBeDisabled()
  expect(postCount).toBe(1)
})

test('catalog refresh의 동일 ID authority 변경은 선택과 pending·active pointer를 모두 무효화한다', async ({ page }) => {
  let contentHash = FIXTURE_CONTENT_HASH
  let catalogError = false
  let postCount = 0
  await page.route('**/internal/poc/market-artifacts', async (route) => {
    if (catalogError) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ meta: internalMeta(null), error: { code: 'CATALOG_TEMPORARILY_UNAVAILABLE', message: 'CATALOG_TEMPORARILY_UNAVAILABLE' } }),
      })
      return
    }
    return fulfill(route, { artifacts: [{ ...marketArtifactCatalog.artifacts[0], contentHash }] }, 200, '1')
  })
  await page.route('**/internal/poc/paper-sessions**', async (route) => {
    if (route.request().method() !== 'POST') return fulfill(route, queuedStatus, 200, '1')
    postCount += 1
    if (postCount === 1) return route.abort('connectionreset')
    return fulfill(route, queuedStatus, 201, '1')
  })
  await installCompletedStrategyRecovery(page)
  const paper = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  const picker = paper.getByRole('region', { name: 'Paper 입력 artifact 선택' })
  await picker.getByRole('radio').check()
  await paper.getByRole('button', { name: 'Paper 실행' }).click()
  await expect(paper.getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  contentHash = '8'.repeat(64)
  await picker.getByRole('button', { name: '목록 다시 불러오기' }).click()
  await expect(picker.getByText('PAPER_CATALOG_CHANGED')).toBeVisible()
  expect(await page.evaluate(async () => {
    const { LOCAL_PAPER_PENDING_REQUEST_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    return sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY)
  })).toBeNull()

  await picker.getByRole('button', { name: '다시 시도' }).click()
  await picker.getByRole('radio').check()
  await paper.getByRole('button', { name: 'Paper 실행' }).click()
  await expect(paper.getByText('서버 실행 대기').first()).toBeVisible()
  expect(postCount).toBe(2)

  await page.reload()
  await expect(paper.getByText('서버 active Paper session을 복원했습니다.')).toBeVisible({ timeout: 15_000 })
  await expect(picker.getByRole('radio')).toBeChecked()
  await expect(paper.getByRole('button', { name: 'Paper 실행' })).toHaveCount(0)
  expect(postCount).toBe(2)

  catalogError = true
  await picker.getByRole('button', { name: '목록 다시 불러오기' }).click()
  await expect(picker.getByText('PAPER_CATALOG_UNAVAILABLE')).toBeVisible()
  await expect(picker).not.toContainText('CATALOG_TEMPORARILY_UNAVAILABLE')
  await expect(paper.getByText('서버 실행 대기').first()).toBeVisible()
  expect(await page.evaluate(async () => {
    const { LOCAL_PAPER_ACTIVE_POINTER_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    return sessionStorage.getItem(LOCAL_PAPER_ACTIVE_POINTER_KEY) !== null
  })).toBe(true)

  catalogError = false
  await picker.getByRole('button', { name: '다시 시도' }).click()
  await expect(picker.getByRole('radio')).toBeChecked()
  const activeGuardError = await page.evaluate(async ({ selected, strategy }) => {
    const { createLocalPaperApiAdapter } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    const adapter = await createLocalPaperApiAdapter()
    try {
      await adapter.startSessionForArtifact?.(strategy, { csrfToken: 'csrf_local_paper_token_00000001' }, selected)
      return null
    } catch (reason) {
      return reason instanceof Error ? reason.message : 'UNKNOWN'
    }
  }, {
    selected: { ...packagedArtifactBinding, contentHash: '8'.repeat(64) },
    strategy: { strategyVersionId: STRATEGY_VERSION_ID, semanticHash: SEMANTIC_HASH },
  })
  expect(activeGuardError).toBe('PAPER_API_ACTIVE_SESSION_DISCARD_REQUIRED')
  expect(postCount).toBe(2)
  await paper.getByRole('button', { name: '로컬 재개 연결 해제' }).click()
  await expect(paper.getByRole('button', { name: 'Paper 실행' })).toBeVisible()
  await paper.getByRole('button', { name: 'Paper 실행' }).click()
  await expect(paper.getByText('서버 실행 대기').first()).toBeVisible()
  expect(postCount).toBe(3)

  await page.reload()
  await expect(paper.getByText('서버 active Paper session을 복원했습니다.')).toBeVisible({ timeout: 15_000 })
  contentHash = '9'.repeat(64)
  await picker.getByRole('button', { name: '목록 다시 불러오기' }).click()
  await expect(picker.getByText('PAPER_CATALOG_CHANGED')).toBeVisible()
  const cursors = await page.evaluate(async () => {
    const { LOCAL_PAPER_ACTIVE_POINTER_KEY, LOCAL_PAPER_PENDING_REQUEST_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    return {
      active: sessionStorage.getItem(LOCAL_PAPER_ACTIVE_POINTER_KEY),
      pending: sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY),
    }
  })
  expect(cursors).toEqual({ active: null, pending: null })
  await expect(picker.getByRole('radio')).toHaveCount(0)
  await expect(paper.getByText('서버 실행 대기').first()).toHaveCount(0)
})
