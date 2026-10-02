import { createApiAdapter, readApiAdapterConfig } from './api-adapter'
import type { BacktestJob } from './contracts/generated/api-v0.1/index.js'
import { assertLocalSyntheticSource, assertResultBundleBindings, requireResultBinding } from './structural-smoke-results'

const META_NAMES = [
  'tesia-structural-smoke-profile-hash', 'tesia-report-verifier-name',
  'tesia-report-verifier-version', 'tesia-report-verifier-commit-sha',
  'tesia-report-trust-anchor-hash', 'tesia-report-receipt-content-hash',
  'tesia-report-subject-content-hash',
] as const
const MAX_BOOTSTRAP_BYTES = 1_048_576

/** Read the existing authenticated bootstrap, never execute or install its HTML. */
export const refreshStructuralSmokeAdapter = async (expectedProfileHash: string) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch('/internal-poc.html', {
      credentials: 'same-origin', redirect: 'manual', cache: 'no-store', signal: controller.signal,
    })
    if (response.status !== 200 || response.redirected
      || response.url !== new URL('/internal-poc.html', window.location.origin).href
      || response.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'text/html'
      || !response.headers.get('cache-control')?.split(',').some(value => value.trim().toLowerCase() === 'no-store')
      || response.body === null) throw new Error('SMOKE_BOOTSTRAP_UNAVAILABLE')
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let bytes = 0
    let html = ''
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > MAX_BOOTSTRAP_BYTES) throw new Error('SMOKE_BOOTSTRAP_TOO_LARGE')
        html += decoder.decode(value, { stream: true })
      }
      html += decoder.decode()
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
    // Template contents are inert, including resource elements. Nothing from
    // the response is inserted into the live document or evaluated as script.
    const template = document.createElement('template')
    template.innerHTML = html
    const metadata = document.implementation.createHTMLDocument('')
    for (const name of META_NAMES) {
      const matches = template.content.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`)
      if (matches.length > 1) throw new Error('SMOKE_BOOTSTRAP_DUPLICATE_META')
      if (matches.length === 1) {
        const meta = metadata.createElement('meta')
        meta.name = name
        meta.content = matches[0].content
        metadata.head.append(meta)
      }
    }
    const config = readApiAdapterConfig(metadata)
    requireResultBinding(config.structuralSmokeProfileContentHash === expectedProfileHash)
    return createApiAdapter(config)
  } finally { window.clearTimeout(timeout) }
}

export interface StructuralSmokeBinding {
  readonly sessionId: string
  readonly strategyVersionId: string
  readonly semanticHash: string
  readonly profileContentHash: string
}

export interface StructuralSmokeCommand {
  readonly binding: StructuralSmokeBinding
  readonly idempotencyKey: string
}

/** No credentials are persisted. A command remains pending after response loss.
 * A different approval/session has a different namespace; no fallback/migration.
 * Stored commands are locators/intent only, never authenticated authority. */
export const structuralSmokeCommand = (binding: StructuralSmokeBinding): StructuralSmokeCommand => {
  const key = `tesia-native-smoke-command:${JSON.stringify(binding)}`
  const saved = sessionStorage.getItem(key)
  if (saved !== null) {
    let value: StructuralSmokeCommand
    try { value = JSON.parse(saved) as StructuralSmokeCommand } catch { throw new Error('SMOKE_COMMAND_STORAGE_INVALID') }
    if (JSON.stringify(value.binding) !== JSON.stringify(binding)
      || typeof value.idempotencyKey !== 'string'
      || !/^smoke_[0-9a-f-]{36}$/.test(value.idempotencyKey)) throw new Error('SMOKE_COMMAND_STORAGE_INVALID')
    return value
  }
  const command = { binding: { ...binding }, idempotencyKey: `smoke_${crypto.randomUUID()}` }
  sessionStorage.setItem(key, JSON.stringify(command))
  // Storage failure must precede any POST. No automatic replacement key/reset.
  if (sessionStorage.getItem(key) !== JSON.stringify(command)) throw new Error('SMOKE_COMMAND_STORAGE_UNAVAILABLE')
  return command
}

/** One consumer belongs to one live UI approval epoch. All actions are explicit;
 * no anonymous-session creation, polling, automatic submit or fixture fallback. */
export const createNativeStructuralSmoke = (binding: StructuralSmokeBinding, isCurrent: () => boolean) => {
  const adapter = createApiAdapter({ structuralSmokeProfileContentHash: binding.profileContentHash })
  let busy = false
  const fence = () => { if (!isCurrent()) throw new Error('SMOKE_CONTEXT_CHANGED') }
  const session = async () => {
    fence()
    const current = (await adapter.sdk.session.current()).body.data
    fence()
    if (current.state !== 'AUTHENTICATED' || current.sessionId !== binding.sessionId) throw new Error('SMOKE_SESSION_CHANGED')
  }
  const boundJob = (job: BacktestJob, id?: string) => {
    requireResultBinding(job.strategyVersionId === binding.strategyVersionId && job.semanticHash === binding.semanticHash
      && job.profileId === 'STRUCTURAL_SMOKE' && job.profileContentHash === binding.profileContentHash
      && (id === undefined || job.backtestId === id))
    assertLocalSyntheticSource(job.sourceProvenance)
    return job
  }
  const action = async <T>(run: () => Promise<T>): Promise<T> => {
    fence()
    if (busy) throw new Error('SMOKE_REQUEST_IN_FLIGHT')
    busy = true
    try { await session(); const result = await run(); await session(); return result }
    finally { busy = false }
  }
  return {
    submit: () => action(async () => {
      const command = structuralSmokeCommand(binding)
      const { csrfToken } = (await adapter.sdk.session.csrf()).body.data
      await session()
      return boundJob((await adapter.sdk.backtest.submit({
        body: { strategyVersionId: binding.strategyVersionId, expectedSemanticHash: binding.semanticHash, profileId: 'STRUCTURAL_SMOKE' },
        context: { csrfToken, idempotencyKey: command.idempotencyKey },
      })).body.data)
    }),
    status: (id: string) => action(async () => boundJob((await adapter.sdk.backtest.status({ id })).body.data, id)),
    results: (id: string) => action(async () => {
      const job = boundJob((await adapter.sdk.backtest.status({ id })).body.data, id)
      requireResultBinding(job.state === 'COMPLETED' && job.resultAvailable)
      const resultAdapter = await refreshStructuralSmokeAdapter(binding.profileContentHash)
      fence()
      if (!resultAdapter.canReadResults) throw new Error('SMOKE_REPORT_AUTHORITY_PENDING')
      // Wait for every request, even on failure, before releasing the retry lock.
      const settled = await Promise.allSettled([
        resultAdapter.sdk.report.report({ id }), resultAdapter.sdk.report.manifest({ id }),
        resultAdapter.sdk.report.trades({ id, request: { segment: 'IS', limit: 50 } }),
        resultAdapter.sdk.report.trades({ id, request: { segment: 'OOS', limit: 50 } }),
      ] as const)
      fence()
      const [report, manifest, isPage, oosPage] = settled.map(result => {
        if (result.status === 'rejected') throw result.reason
        return result.value
      }) as [Awaited<ReturnType<typeof resultAdapter.sdk.report.report>>, Awaited<ReturnType<typeof resultAdapter.sdk.report.manifest>>,
        Awaited<ReturnType<typeof resultAdapter.sdk.report.trades>>, Awaited<ReturnType<typeof resultAdapter.sdk.report.trades>>]
      for (const response of [report, manifest, isPage, oosPage]) assertLocalSyntheticSource(response.body.data.sourceProvenance)
      assertResultBundleBindings(job, report.body.data, manifest.body.data, isPage.body.data, oosPage.body.data)
      return { job, report: report.body.data, manifest: manifest.body.data, trades: { IS: isPage.body.data, OOS: oosPage.body.data },
        limitation: 'STRUCTURAL_SMOKE_SYNTHETIC_NOT_730D' as const }
    }),
  }
}
