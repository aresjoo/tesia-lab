import { useEffect, useRef, useState } from 'react'
import { createNativeStructuralSmoke, type StructuralSmokeBinding } from './native-structural-smoke'
import { formatResultRatePercent } from './native-result-number-format'

type Smoke = ReturnType<typeof createNativeStructuralSmoke>
type Job = Awaited<ReturnType<Smoke['submit']>>
type Bundle = Awaited<ReturnType<Smoke['results']>>
type AutoState = 'idle' | 'running' | 'paused' | 'waiting' | 'hidden' | 'limit' | 'error' | 'complete'
const AUTO_INTERVAL_MS = 5_000
const AUTO_DURATION_MS = 120_000
const AUTO_MAX_STATUS_READS = 24
const terminal = (job: Job) => ['COMPLETED', 'FAILED', 'CANCELLED', 'INVALID'].includes(job.state)

// Rendering safety only, not a decimal/formula/schema verifier. The producer
// validates its report; the existing SDK still owns receipt and owner binding.
const displayMetric = (metrics: unknown, name: 'MAX_DRAWDOWN_RATE' | 'WIN_RATE'): string | undefined => {
  const metric = Array.isArray(metrics) ? metrics.find(item => item !== null && typeof item === 'object'
    && item.name === name && item.derivedBy === 'ENGINE') : undefined
  const value: unknown = metric?.value
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? value : undefined
}

/** A separate, explicit v1 synthetic structural test; never a v7 FULL result. */
export function NativeStructuralSmokePanel({ binding, isCurrent, canDispatch = () => true, verifyOwner, onClose }: {
  binding: StructuralSmokeBinding
  isCurrent: () => boolean
  canDispatch?: () => boolean
  verifyOwner: () => Promise<void>
  onClose: () => void
}) {
  const active = useRef(true), working = useRef(false)
  const api = useRef<Smoke | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [autoState, setAutoState] = useState<AutoState>('idle')
  const watch = useRef({ enabled: false, generation: 0, deadline: 0, reads: 0, timer: null as number | null })
  const automaticOperation = useRef<number | null>(null)
  const stopAuto = (reason: AutoState) => {
    watch.current.enabled = false; watch.current.generation++
    if (watch.current.timer !== null) window.clearTimeout(watch.current.timer)
    watch.current.timer = null
    if (active.current) setAutoState(reason)
  }
  const automaticCurrent = (generation: number) => watch.current.enabled && watch.current.generation === generation && !document.hidden
  const checkDispatch = () => {
    if (!isCurrent()) {
      stopAuto('error'); setJob(null); setBundle(null); setBlocked(true)
      setError('현재 로그인·승인 화면이 변경되어 이전 내용을 숨겼습니다. 서버 작업은 취소하지 않았습니다.')
      return false
    }
    if (!canDispatch()) { stopAuto('waiting'); return false }
    return true
  }
  useEffect(() => {
    active.current = true
    api.current = createNativeStructuralSmoke(binding, () => active.current && isCurrent() && canDispatch()
      && (automaticOperation.current === null || automaticCurrent(automaticOperation.current)))
    const visibility = () => { if (document.hidden && watch.current.enabled) stopAuto('hidden') }
    document.addEventListener('visibilitychange', visibility)
    const currentWatch = watch.current
    return () => {
      active.current = false; api.current = null; currentWatch.enabled = false; currentWatch.generation++
      if (currentWatch.timer !== null) window.clearTimeout(currentWatch.timer)
      document.removeEventListener('visibilitychange', visibility)
    }
    // The parent keys one instance to its observed owner/approval generation.
    // Its callback reads live refs; unrelated parent renders do not recreate it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding])
  const schedule = (observed: Job, generation: number) => {
    if (!automaticCurrent(generation) || !active.current) return
    if (!checkDispatch()) return
    if (terminal(observed) && observed.state !== 'COMPLETED') { stopAuto('complete'); return }
    // Called only by an explicit event or a settled async read, never render.
    // eslint-disable-next-line react-hooks/purity
    if (performance.now() >= watch.current.deadline || watch.current.reads >= AUTO_MAX_STATUS_READS) { stopAuto('limit'); return }
    watch.current.timer = window.setTimeout(() => {
      watch.current.timer = null
      if (!automaticCurrent(generation)) return
      if (!checkDispatch()) return
      if (performance.now() >= watch.current.deadline) { stopAuto('limit'); return }
      const action = observed.state === 'COMPLETED' && observed.resultAvailable ? 'results' : 'status'
      if (action === 'status') watch.current.reads++
      void run(action, generation, observed.backtestId).then(value => {
        if (!automaticCurrent(generation)) return
        if (!value) { stopAuto('paused'); return }
        if ('limitation' in value) stopAuto('complete')
        else schedule(value, generation)
      })
    }, AUTO_INTERVAL_MS)
  }
  const beginAuto = (observed: Job) => {
    if (!active.current || !checkDispatch()) return
    if (document.hidden) { stopAuto('hidden'); return }
    stopAuto('running')
    // Explicit resume/accepted submit continuation only, not a render value.
    // eslint-disable-next-line react-hooks/purity
    watch.current.enabled = true; watch.current.deadline = performance.now() + AUTO_DURATION_MS; watch.current.reads = 0
    schedule(observed, watch.current.generation)
  }
  const run = async (action: 'submit' | 'status' | 'results', autoGeneration?: number, observedId?: string): Promise<Job | Bundle | null> => {
    if (working.current || blocked || !active.current) return null
    if (autoGeneration !== undefined && !automaticCurrent(autoGeneration)) return null
    if (!checkDispatch()) return null
    const port = api.current
    if (!port) return null
    const id = observedId ?? job?.backtestId
    if (action !== 'submit' && !id) return null
    if (autoGeneration === undefined) stopAuto('idle')
    automaticOperation.current = autoGeneration ?? null
    working.current = true; setBusy(true); setError(''); setBundle(null)
    try {
      // The parent binds the captured approval and live AUTH/epoch. The
      // module owns fresh AUTH, CSRF, the same-key journal and wire validation.
      await verifyOwner()
      if (!active.current || (autoGeneration !== undefined && !automaticCurrent(autoGeneration))) return null
      if (!checkDispatch()) return null
      const value = action === 'submit' ? await port.submit() : action === 'status' ? await port.status(id!) : await port.results(id!)
      if (!active.current || (autoGeneration !== undefined && !automaticCurrent(autoGeneration))) return null
      await verifyOwner()
      if (!active.current || (autoGeneration !== undefined && !automaticCurrent(autoGeneration))) return null
      if (!checkDispatch()) return null
      if ('limitation' in value) { setBundle(value); setJob(value.job) }
      else { setJob(value); if (action === 'submit') beginAuto(value) }
      return value
    } catch (failure) {
      if (!active.current || (autoGeneration !== undefined && !automaticCurrent(autoGeneration))) return null
      stopAuto('error')
      setBundle(null)
      const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : failure instanceof Error ? failure.message : ''
      // Module context rejection while captured authority is still current can
      // be a parent busy fence. Never relax AUTH/session/binding rejections.
      if (isCurrent() && code === 'SMOKE_CONTEXT_CHANGED') { stopAuto('waiting'); return null }
      if (!isCurrent() || ['AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'SMOKE_SESSION_CHANGED', 'SMOKE_CONTEXT_CHANGED', 'INVALID_ERROR_STATUS_POLICY', 'INVALID_ERROR_ENVELOPE'].includes(code)) {
        setJob(null); setBlocked(true)
        setError('현재 로그인·승인 결속을 확인하지 못해 이전 내용을 숨겼습니다. 화면을 닫고 같은 승인을 서버에서 다시 확인해주세요. 요청 기록과 서버 작업은 삭제하지 않았습니다.')
      } else setError('서버 응답이나 검증된 결과를 확인하지 못해 자동 확인을 멈췄습니다. 수동으로 다시 조회할 수 있습니다. 동일 승인 실행 버튼은 보존된 요청 키로 재개합니다.')
      return null
    } finally {
      working.current = false; automaticOperation.current = null
      if (active.current) setBusy(false)
    }
  }
  return <section className="run-progress" aria-label="승인 전략의 합성 구조 시험">
    <h2>합성 구조 시험</h2>
    <p>STRUCTURAL_SMOKE · SYNTHETIC_UI_FIXTURE / UNVERIFIED / PRIVATE_ONLY</p>
    <p>서비스 연결과 엔진 흐름을 확인하는 합성 입력 시험입니다. 실제 730일 결과가 아닙니다. 시장 성과·실거래·FULL 백테스트·기록 Paper를 대체하지 않습니다.</p>
    <p>승인 버전 {binding.strategyVersionId}</p>
    <button className="quiet-button" type="button" onClick={onClose}>구조 시험 화면 닫기</button>
    <p>화면을 닫거나 로그아웃해도 서버 작업을 취소하지 않습니다. 요청 기록은 같은 세션·승인·프로필에 묶여 보존하며 다른 계정에서 자동 재전송하지 않습니다.</p>
    <p>이 탭을 종료하거나 저장소를 직접 지우면 요청 키 보존을 보장하지 않습니다. 이후 실행은 새 의도가 될 수 있으며 서버 작업이 중복되지 않는다는 보장이 아닙니다.</p>
    {!blocked && <button className="primary-button" type="button" disabled={busy} onClick={() => void run('submit')}>같은 승인으로 합성 구조 시험 실행</button>}
    {(busy || autoState === 'running') && <p role="status">서버에서 작업 상태와 결과를 확인하고 있습니다.</p>}
    {autoState === 'running' && <><p>같은 작업만 5초 간격으로 확인합니다. 최대 2분·24회 상태 조회 후에는 수동으로 이어갈 수 있습니다.</p>
      <button className="secondary-button" type="button" onClick={() => stopAuto('paused')}>진행 자동 확인 중지</button></>}
    {['hidden', 'paused', 'limit'].includes(autoState) && <p role="status">{autoState === 'hidden' ? '탭을 숨겨 자동 확인을 멈췄습니다.' : autoState === 'limit' ? '자동 확인 한도에 도달했습니다.' : '자동 확인을 멈췄습니다.'} 서버 작업을 취소한 것이 아닙니다. 직접 다시 조회하거나 자동 확인을 재개하세요.</p>}
    {autoState === 'waiting' && <p role="status">다른 화면의 작업 중에는 구조 시험 조회를 잠시 멈춥니다. {job ? '작업을 마친 뒤 직접 다시 조회하거나 자동 확인을 재개하세요.' : '작업을 마친 뒤 같은 승인 실행 버튼으로 보존된 요청을 다시 확인하세요.'} 서버 작업을 취소한 것이 아닙니다.</p>}
    {error && <p role="alert">{error}</p>}
    {job && !blocked && <><p role="status">마지막으로 확인한 서버 상태: {job.state} · revision {job.revision}</p><p>{job.backtestId}</p>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => void run('status')}>구조 시험 상태 다시 조회</button>
      {job.state === 'COMPLETED' && job.resultAvailable && <button className="secondary-button" type="button" disabled={busy} onClick={() => void run('results')}>구조 시험 결과 다시 조회</button>}
      {autoState !== 'running' && !bundle && (!terminal(job) || job.state === 'COMPLETED') && <button className="secondary-button" type="button" disabled={busy} onClick={() => beginAuto(job)}>진행 자동 확인 재개</button>}
      {terminal(job) && job.state !== 'COMPLETED' && <p>서버가 반환한 종료 상태입니다. 결과나 성공을 대신 생성하지 않습니다.</p>}
    </>}
    {bundle && !blocked && <>
      <p>서버 보고서의 원값을 표시합니다. 각 구간 첫 50개 거래까지 조회하며 전체 거래 목록이나 가격 차트가 아닙니다.</p>
      <p>MMR·청산 검증과 실제 시장 체결의 증거가 아닙니다. 누락된 지표를 브라우저에서 계산하지 않습니다.</p>
      <section aria-label="보고서 수준 서버 집계">
        <h3>보고서 수준 서버 집계</h3>
        <p>서버가 제공한 보고서 집계이며 구간별 지표가 아닙니다. MDD는 IS·OOS 중 큰 값, 승률은 두 구간 거래를 합친 서버 집계입니다.</p>
        <dl>
          <dt>MDD (비율 원문)</dt><dd>{displayMetric(bundle.report.derivedMetrics, 'MAX_DRAWDOWN_RATE') ?? 'MDD 미제공 또는 표시 불가'}</dd>
          <dt>승률 (비율 원문)</dt><dd>{displayMetric(bundle.report.derivedMetrics, 'WIN_RATE') ?? '승률 미제공 또는 표시 불가'}</dd>
        </dl>
        <p>수익률 미제공 · 자산·낙폭 시계열 미제공. IS·OOS의 독립 초기 자본을 합쳐 수익률이나 차트를 만들지 않습니다.</p>
      </section>
      <section aria-label="백분율 보조 표시">
        <h3>백분율 보조 (소수 2자리 반올림)</h3>
        <p>위 서버 비율을 소수 둘째 자리까지 표시합니다(셋째 자리에서 반올림). 원문은 그대로 보존하며, 반올림하면 0이 되는 작은 양수는 &lt;0.01%로 구분합니다.</p>
        <dl>
          <dt>MDD (백분율 보조)</dt><dd>{formatResultRatePercent(displayMetric(bundle.report.derivedMetrics, 'MAX_DRAWDOWN_RATE')) ?? '백분율 보조 표시 불가'}</dd>
          <dt>승률 (백분율 보조)</dt><dd>{formatResultRatePercent(displayMetric(bundle.report.derivedMetrics, 'WIN_RATE')) ?? '백분율 보조 표시 불가'}</dd>
        </dl>
      </section>
      <div className="segment-table-wrap"><table aria-label="합성 구조 시험 구간별 서버 결과">
        <caption>합성 입력 · 서버가 반환한 소수 원문</caption>
        <thead><tr><th>구간</th><th>순손익</th><th>수수료</th><th>펀딩 현금흐름</th><th>거래 수</th><th>거절 수</th></tr></thead>
        <tbody>{bundle.report.segments.map(({ segment, runtimeResult: result }) => <tr key={segment}>
          <th>{segment} ({segment === 'IS' ? '인샘플' : '아웃오브샘플'})</th><td>{result.netPnl ?? '미제공'} {result.currency}</td><td>{result.fees ?? '미제공'} {result.currency}</td><td>{result.funding ?? '미제공'} {result.currency}</td><td>{result.tradeCount ?? '미제공'}</td><td>{result.rejectionCount ?? '미제공'}</td>
        </tr>)}</tbody>
      </table></div>
      <p>IS는 인샘플, OOS는 아웃오브샘플 구간입니다. 각 구간의 초기 자본은 독립적이며 손익을 합쳐 수익률을 만들지 않습니다.</p>
      <p>펀딩은 양수 수취·음수 지급인 현금흐름입니다.</p>
      <p>거래 수는 구간 전체 서버 집계이며, 아래 첫 페이지에 표시한 거래 수와 다를 수 있습니다.</p>
      {(['IS', 'OOS'] as const).map(segment => <section key={segment} aria-label={`${segment} 합성 거래 첫 페이지`}>
        <h3>{segment} 거래</h3>
        <p>{bundle.trades[segment].trades.length}개 표시 · {bundle.trades[segment].nextCursor ? '다음 서버 페이지 있음 · 부분 조회' : '이 응답에 다음 페이지 정보 없음 · 전체 조회를 보장하지 않음'}</p>
        {bundle.trades[segment].trades.length === 0 ? <p>이 페이지에 반환된 거래가 없습니다.</p> : <ul>{bundle.trades[segment].trades.map(trade => <li key={`${trade.entryFillRef}:${trade.exitFillRef}`}>
          {trade.exitReason} · 진입 가격 {trade.entryPrice} → 종료 가격 {trade.exitPrice} · 수량 {trade.quantity} · 순손익 {trade.netPnl}
        </li>)}</ul>}
      </section>)}
    </>}
  </section>
}
