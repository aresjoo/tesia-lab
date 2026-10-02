import {
  AlertTriangle,
  Boxes,
  Database,
  FileClock,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PaperMarketArtifact,
  PaperMarketArtifactCatalogAdapter,
} from './paper-market-artifact'
import type { PaperSessionMarketArtifactBinding } from './paper-session'
import {
  assertPaperMarketArtifactCatalog,
  LOCAL_MARKET_ARTIFACT_CATALOG_MARKER,
} from './paper-market-artifact'
import { describePaperCatalogIssue, type PaperUiIssue } from './paper-service-status'

const shortHash = (value: string): string => `${value.slice(0, 10)}…${value.slice(-8)}`

const sameAuthority = (left: PaperMarketArtifact, right: PaperMarketArtifact): boolean => (
  left.artifactId === right.artifactId
  && left.source === right.source
  && left.fileSha256 === right.fileSha256
  && left.contentHash === right.contentHash
  && left.provenanceHash === right.provenanceHash
  && left.policyHash === right.policyHash
  && left.manifestSha256 === right.manifestSha256
  && left.provenance.dataClass === right.provenance.dataClass
  && left.provenance.verificationStatus === right.provenance.verificationStatus
)

const matchesBinding = (artifact: PaperMarketArtifact, binding: PaperSessionMarketArtifactBinding): boolean => (
  artifact.artifactId === binding.artifactId
  && artifact.source === binding.source
  && artifact.fileSha256 === binding.fileSha256
  && artifact.contentHash === binding.contentHash
  && artifact.provenanceHash === binding.provenanceHash
  && artifact.policyHash === binding.policyHash
  && artifact.manifestSha256 === binding.manifestSha256
  && artifact.provenance.verificationStatus === binding.verificationStatus
)

const sourceCopy = (artifact: PaperMarketArtifact) => artifact.source === 'PACKAGED_SYNTHETIC'
  ? {
      badge: 'PACKAGED_SYNTHETIC',
      title: '패키지에 고정된 합성 fixture',
      detail: '제품 코드와 함께 검증된 합성 기록 입력입니다. 실제 시장에서 수집한 데이터가 아닙니다.',
    }
  : {
      badge: 'OWNER_RECORDED_LOCAL_ARTIFACT',
      title: '소유자 로컬 기록 artifact',
      detail: '사용자 소유 로컬 기록입니다. 출처·실시간성·성과·거래 검증 전이며 외부 공개 증거가 아닙니다.',
    }

export function PaperMarketArtifactPicker({
  adapterPromise,
  initialSelectedArtifactId = null,
  onSelectionChange,
  onAuthorityInvalidated,
  authoritativeBinding,
  lockedArtifactId = null,
}: {
  adapterPromise?: Promise<PaperMarketArtifactCatalogAdapter>
  initialSelectedArtifactId?: string | null
  onSelectionChange?: (artifact: PaperMarketArtifact | null) => void
  onAuthorityInvalidated?: (artifactId: string) => void
  authoritativeBinding?: PaperSessionMarketArtifactBinding
  lockedArtifactId?: string | null
}) {
  const [adapter, setAdapter] = useState<PaperMarketArtifactCatalogAdapter | null>(null)
  const [items, setItems] = useState<readonly PaperMarketArtifact[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedArtifactId)
  const [loading, setLoading] = useState(adapterPromise !== undefined)
  const [error, setError] = useState<PaperUiIssue | null>(null)
  const selectedArtifactRef = useRef<PaperMarketArtifact | null>(null)
  const lockedArtifactIdRef = useRef(lockedArtifactId)

  useEffect(() => {
    lockedArtifactIdRef.current = lockedArtifactId
  }, [lockedArtifactId])

  const invalidateUnstartedSelection = useCallback(() => {
    const previous = selectedArtifactRef.current
    if (previous === null || lockedArtifactIdRef.current !== null) return
    selectedArtifactRef.current = null
    setSelectedId(null)
    onSelectionChange?.(null)
    onAuthorityInvalidated?.(previous.artifactId)
  }, [onAuthorityInvalidated, onSelectionChange])

  const readCatalog = useCallback(async (nextAdapter: PaperMarketArtifactCatalogAdapter) => {
    setLoading(true)
    setError(null)
    try {
      const catalog = assertPaperMarketArtifactCatalog(await nextAdapter.readCatalog())
      setItems(catalog.items)
      const previous = selectedArtifactRef.current
      if (previous !== null) {
        const current = catalog.items.find((item) => item.artifactId === previous.artifactId)
        if (current === undefined || !sameAuthority(previous, current)) {
          selectedArtifactRef.current = null
          setSelectedId(null)
          onSelectionChange?.(null)
          onAuthorityInvalidated?.(previous.artifactId)
          setError(describePaperCatalogIssue(new Error('PAPER_MARKET_ARTIFACT_AUTHORITY_CHANGED')))
          return
        }
      }
      setSelectedId((current) => {
        if (current === null || catalog.items.some((item) => item.artifactId === current)) return current
        onSelectionChange?.(null)
        return null
      })
    } catch (reason) {
      setItems([])
      invalidateUnstartedSelection()
      setError(describePaperCatalogIssue(reason))
    } finally {
      setLoading(false)
    }
  }, [invalidateUnstartedSelection, onAuthorityInvalidated, onSelectionChange])

  useEffect(() => {
    let active = true
    if (adapterPromise === undefined) return () => { active = false }
    adapterPromise.then(async (nextAdapter) => {
      if (!active) return
      setAdapter(nextAdapter)
      await readCatalog(nextAdapter)
    }).catch((reason: unknown) => {
      if (!active) return
      setItems([])
      invalidateUnstartedSelection()
      setError(describePaperCatalogIssue(reason))
      setLoading(false)
    })
    return () => { active = false }
  }, [adapterPromise, invalidateUnstartedSelection, readCatalog])

  useEffect(() => {
    if (authoritativeBinding === undefined || items.length === 0) return
    const timer = window.setTimeout(() => {
      const current = items.find((item) => item.artifactId === authoritativeBinding.artifactId)
      if (current !== undefined && matchesBinding(current, authoritativeBinding)) {
        selectedArtifactRef.current = current
        setSelectedId(current.artifactId)
        onSelectionChange?.(current)
        return
      }
      selectedArtifactRef.current = null
      setSelectedId(null)
      onSelectionChange?.(null)
      onAuthorityInvalidated?.(authoritativeBinding.artifactId)
      setError(describePaperCatalogIssue(new Error('PAPER_MARKET_ARTIFACT_AUTHORITY_CHANGED')))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [authoritativeBinding, items, onAuthorityInvalidated, onSelectionChange])

  const select = (artifact: PaperMarketArtifact) => {
    if (lockedArtifactId !== null && artifact.artifactId !== lockedArtifactId) {
      return
    }
    selectedArtifactRef.current = artifact
    setSelectedId(artifact.artifactId)
    onSelectionChange?.(artifact)
  }

  const fixtureOnly = adapter?.kind === 'recorded-ui-fixture'

  return (
    <section className="paper-artifact-picker" aria-labelledby="paper-artifact-title" data-marker={LOCAL_MARKET_ARTIFACT_CATALOG_MARKER}>
      <div className="paper-artifact-heading">
        <div>
          <p className="eyebrow">{fixtureOnly
            ? 'MARKET_ARTIFACT_CATALOG · UI_FIXTURE_ONLY'
            : 'OWNER_LOCAL_MARKET_ARTIFACT_CATALOG · PRIVATE_LOOPBACK_ONLY'}</p>
          <h3 id="paper-artifact-title">Paper 입력 artifact 선택</h3>
          <p>서버가 제공한 목록에서만 선택합니다. 파일 경로 입력, 업로드, 외부 조회는 지원하지 않습니다.</p>
        </div>
        {adapter !== null && (
          <button type="button" className="paper-artifact-reload" onClick={() => void readCatalog(adapter)} disabled={loading}>
            <RefreshCw size={15} aria-hidden="true" /> 목록 다시 불러오기
          </button>
        )}
      </div>

      <div className="paper-artifact-boundary" role="note">
        <ShieldAlert size={18} aria-hidden="true" />
        <p><strong>모든 항목은 PRIVATE_ONLY · UNVERIFIED입니다.</strong> UNVERIFIED는 성과·실거래 검증 전을 뜻하며 content/provenance hash 무결성 표시와는 별개입니다. 선택만으로 Paper 완료 증거가 되지 않습니다.</p>
      </div>

      {loading && (
        <div className="paper-artifact-state" aria-busy="true" aria-live="polite">
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
          <div><strong>서버 artifact 목록을 확인하고 있습니다.</strong><span>브라우저가 항목을 생성하거나 경로를 추측하지 않습니다.</span></div>
        </div>
      )}

      {!loading && error !== null && (
        <div className="paper-artifact-state error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><strong>{error.title}</strong><span>{error.description}</span><code>{error.diagnosticCode}</code></div>
          {adapter !== null && <button type="button" className="secondary-button" onClick={() => void readCatalog(adapter)}>다시 시도</button>}
        </div>
      )}

      {!loading && error === null && adapter === null && (
        <div className="paper-artifact-state empty">
          <Database size={20} aria-hidden="true" />
          <div><strong>서버 catalog adapter가 연결되지 않았습니다.</strong><span>Backend 계약이 연결되기 전에는 항목을 임의로 만들지 않습니다.</span></div>
        </div>
      )}

      {!loading && error === null && adapter !== null && items.length === 0 && (
        <div className="paper-artifact-state empty">
          <Boxes size={20} aria-hidden="true" />
          <div><strong>사용 가능한 owner-local artifact가 없습니다.</strong><span>로컬 서버가 목록을 제공한 뒤 다시 불러오세요.</span></div>
        </div>
      )}

      {!loading && error === null && items.length > 0 && (
        <fieldset className="paper-artifact-list">
          <legend>사용할 기록 시장 입력</legend>
          {items.map((artifact) => {
            const copy = sourceCopy(artifact)
            const selected = selectedId === artifact.artifactId
            return (
              <label key={artifact.artifactId} className={`paper-artifact-card ${selected ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="paper-market-artifact"
                  checked={selected}
                  disabled={lockedArtifactId !== null && artifact.artifactId !== lockedArtifactId}
                  onChange={() => select(artifact)}
                />
                <span className={`paper-artifact-source ${artifact.source === 'PACKAGED_SYNTHETIC' ? 'synthetic' : 'owner'}`}>
                  {copy.badge}
                </span>
                <span className="paper-artifact-main">
                  <strong>{artifact.displayName}</strong>
                  <small>{copy.title} · {artifact.symbol} · source {artifact.sourceInterval} → evaluation {artifact.interval}</small>
                  <span>{copy.detail}</span>
                </span>
                <dl>
                  <div><dt>MarketEvent</dt><dd>{artifact.eventCount.toLocaleString('ko-KR')}건</dd></div>
                  <div><dt>기록 범위</dt><dd>{artifact.firstEventTime} → {artifact.lastEventTime}</dd></div>
                  <div><dt>File SHA-256</dt><dd><code>{shortHash(artifact.fileSha256)}</code></dd></div>
                  <div><dt>Content hash</dt><dd><code>{shortHash(artifact.contentHash)}</code></dd></div>
                  <div><dt>Provenance hash</dt><dd><code>{shortHash(artifact.provenanceHash)}</code></dd></div>
                  <div><dt>Policy hash</dt><dd><code>{shortHash(artifact.policyHash)}</code></dd></div>
                  <div><dt>Manifest SHA-256</dt><dd>{artifact.manifestSha256 === null ? '해당 없음' : <code>{shortHash(artifact.manifestSha256)}</code>}</dd></div>
                  <div><dt>Provenance</dt><dd>{artifact.provenance.dataClass} · {artifact.provenance.verificationStatus}</dd></div>
                </dl>
              </label>
            )
          })}
        </fieldset>
      )}

      {selectedId !== null && (
        <div className="paper-artifact-selected" role="status">
          <FileClock size={17} aria-hidden="true" />
          <p><strong>입력 선택만 준비되었습니다.</strong> 실제 Paper 시작 시 서버가 선택 ID·content hash·StrategyVersion 결속을 검증하기 전에는 완료 상태로 승격하지 않습니다.</p>
        </div>
      )}
    </section>
  )
}
