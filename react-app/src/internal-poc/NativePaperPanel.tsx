import { useEffect, useState } from 'react'
import { PaperSessionPanel } from './PaperSessionPanel'
import { createLocalPaperApiAdapter, type NativePaperStorageScope } from './local-paper-api-adapter'
import { createLocalMarketArtifactApiAdapter } from './local-market-artifact-api-adapter'
import type { PaperSessionAdapter, PaperSessionRead } from './paper-session'
import type { PaperMarketArtifactCatalogAdapter } from './paper-market-artifact'
import { useClientPreferences } from '../client-preferences'
import { nativeExecutionUiText } from './native-execution-ui-copy'

type Ports = { paper: Promise<PaperSessionAdapter>; catalog: Promise<PaperMarketArtifactCatalogAdapter> }

/** Existing owner-local ports only. This is not the native FULL backtest path. */
export function NativePaperPanel({ scope, verifyOwner, isCurrent, onClose }: {
  scope: NativePaperStorageScope
  verifyOwner: (mutation: boolean) => Promise<string>
  isCurrent: () => boolean
  onClose: () => void
}) {
  const { language } = useClientPreferences()
  const ui = (text: string, values?: Record<string, string | number>) => nativeExecutionUiText(language, text, values)
  const [ports, setPorts] = useState<Ports | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [capacity, setCapacity] = useState(false)
  const [discard, setDiscard] = useState<{ confirm: () => Promise<void> } | null>(null)
  const [discarding, setDiscarding] = useState(false)
  useEffect(() => {
    let active = true, posting = false
    let startFlight: { command: string; promise: Promise<PaperSessionRead> } | null = null
    const current = () => {
      if (!active || !isCurrent()) throw new Error('PAPER_NATIVE_OWNER_CHANGED')
    }
    const startOnce = (command: string, operation: (token: string) => Promise<PaperSessionRead>) => {
      if (startFlight) return startFlight.command === command ? startFlight.promise : Promise.reject(new Error('PAPER_NATIVE_REQUEST_BUSY'))
      const promise = guarded(operation, true)
      startFlight = { command, promise }
      void promise.then(() => { startFlight = null }, () => { startFlight = null })
      return promise
    }
    const authority = async (mutation: boolean) => {
      current()
      try { const token = await verifyOwner(mutation); current(); return token }
      catch (error) { if (active) setBlocked(true); throw error }
    }
    const guarded = async <T,>(operation: (token: string) => Promise<T>, mutation = false): Promise<T> => {
      current()
      if (mutation && posting) throw new Error('PAPER_NATIVE_REQUEST_BUSY')
      if (mutation) posting = true
      try {
        const token = await authority(mutation)
        const value = await operation(token)
        await authority(false)
        return value
      } catch (error) {
        if (active && error instanceof Error) {
          if (['AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'PAPER_NATIVE_OWNER_CHANGED'].includes(error.message)) setBlocked(true)
          if (error.message === 'PAPER_NATIVE_STORAGE_LIMIT') { setCapacity(true); setBlocked(true) }
        }
        throw error
      } finally { if (mutation) posting = false }
    }
    void authority(false).then(async () => {
      const adapter = await createLocalPaperApiAdapter(scope)
      current()
      const paper: PaperSessionAdapter = {
        ...adapter,
        readActive: strategy => guarded(() => adapter.readActive(strategy)),
        startSession: (strategy, context) => startOnce(JSON.stringify({ strategy }), token => adapter.startSession(strategy, { ...context, csrfToken: token })),
        startSessionForArtifact: (strategy, context, artifact) => startOnce(JSON.stringify({ strategy, artifact }), token => adapter.startSessionForArtifact!(strategy, { ...context, csrfToken: token }, artifact)),
        refreshSession: (id, strategy) => guarded(() => adapter.refreshSession(id, strategy)),
        hasPendingRequest: () => active && isCurrent() && adapter.hasPendingRequest?.() === true,
        resetLocalView: () => { current(); setDiscard({ confirm: () => guarded(async () => { adapter.resetLocalView?.() }) }) },
        // The legacy picker invalidates on a failed catalog read too. Hide the
        // native view without deleting a possibly accepted mutation's key.
        invalidateArtifactBinding: () => { if (active) setBlocked(true) },
      }
      const catalog = createLocalMarketArtifactApiAdapter()
      setPorts({ paper: Promise.resolve(paper), catalog: Promise.resolve({ ...catalog, readCatalog: () => guarded(() => catalog.readCatalog()) }) })
    }).catch(() => { if (active) setBlocked(true) })
    return () => { active = false }
    // The parent keys this boundary to one captured owner/epoch/approval. The
    // callbacks read live parent refs; unrelated parent renders must not replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  return <section aria-label={ui('승인 전략의 기록 Paper')}>
    <h2>{ui('기록 Paper')}</h2>
    <p>{ui('승인 버전 {version}의 내부 기록 실행입니다. 합성 또는 소유자 로컬 기록이며 실제 시장 성과·실거래·과거 데이터 FULL 백테스트가 아닙니다.', { version: scope.strategyVersionId })}</p>
    <p>{ui('서버 catalog에서 입력을 선택한 뒤 직접 실행하세요. 해당 전략을 지원하지 않거나 서버가 준비되지 않으면 오류로 표시하며 다른 전략이나 Mock 결과로 대체하지 않습니다.')}</p>
    <button type="button" onClick={onClose}>{ui('기록 Paper 화면 닫기')}</button>
    <p>{ui('화면을 닫거나 로그아웃해도 서버 실행을 취소하지 않습니다. 미확정 요청 기록은 이전 세션·승인에 묶여 보존되며 다른 계정에서 자동 재전송하지 않습니다.')}</p>
    {blocked ? <p role="alert">{ui(capacity
      ? '이 탭의 Paper 기록 보관 한도(16개)에 도달했습니다. 다른 기록은 삭제하지 않았으며 새 실행을 보내지 않았습니다. 기존 동일 승인 기록을 확인한 뒤 명시적으로 정리해주세요.'
      : '현재 로그인과 Paper 기록의 결속을 확인하지 못해 내용을 숨겼습니다. 요청 기록은 보존했습니다. 화면을 닫은 뒤 같은 로그인과 승인 버전을 서버에서 다시 확인해주세요.')}</p>
      : discard ? <div role="alert"><p>{ui('이 로그인·승인의 브라우저 요청 기록만 폐기할까요? 서버가 이미 받은 실행은 계속될 수 있습니다. 서버 취소·전략 삭제·미접수를 확인한 것이 아닙니다. 폐기 후 실행하면 새 요청이 됩니다.')}</p>
        <button type="button" disabled={discarding} onClick={() => { setDiscarding(true); void discard.confirm().then(() => setDiscard(null)).catch(() => setBlocked(true)).finally(() => setDiscarding(false)) }}>{ui('이 로컬 요청 기록만 폐기')}</button>
        <button type="button" disabled={discarding} onClick={() => setDiscard(null)}>{ui('기록 유지')}</button></div>
      : ports ? <PaperSessionPanel adapterPromise={ports.paper} marketArtifactAdapterPromise={ports.catalog}
        requestedStrategy={scope} csrfToken="" /> : <p role="status">{ui('로그인과 승인된 기록 범위를 확인하고 있습니다.')}</p>}
  </section>
}
