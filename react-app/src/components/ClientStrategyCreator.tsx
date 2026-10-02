import { Fragment, useId, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { CreatorStoreError, type CreatorCandidate, type CreatorPublication, type CreatorPublishRequest } from '../client-strategy-creator-store'
import { useClientPreferences } from '../client-preferences'
import { creatorCopy, creatorDate, isCreatorCopyKey, type CreatorCopyKey } from '../client-strategy-creator-copy'
import { sharedNumber, sharedPercent } from '../client-shared-number-format'
import '../client-strategy-creator.css'

export type ClientStrategyCreatorProps = {
  candidates: CreatorCandidate[]
  publication: CreatorPublication | null
  visible: boolean
  nick: string
  loggedIn?: boolean
  storageError?: boolean
  unavailableMessage?: string
  onRetryLoad?: () => void
  onPublish: (request: CreatorPublishRequest) => void | Promise<void>
  onVisibility: (visible: boolean) => void | Promise<void>
  onNew: () => void
  renderPreview: (basis: CreatorCandidate | CreatorPublication, description: string) => ReactNode
  Dialog: ComponentType<{ title: string; children: ReactNode; onClose: () => void; step?: number }>
}

type CreatorMessage = { key: CreatorCopyKey } | { detail: string }
const failureMessage = (cause: unknown, fallback: CreatorCopyKey): CreatorMessage => cause instanceof CreatorStoreError && isCreatorCopyKey(cause.message)
  ? { key: cause.message } : { key: fallback }

function Steps({ step, hero = false }: { step: number; hero?: boolean }) {
  const { language } = useClientPreferences()
  const labels: CreatorCopyKey[] = hero ? ['전략 만들기', 'TETH 80점 검증 통과', '공개하고 보상 받기'] : ['전략 선택', '보상, 공개 범위', '검토, 공개']
  return <ol className="ss3-steps" aria-label={creatorCopy(language, hero ? '전략 공개 과정' : '공개 설정 단계')}>{labels.map((label, index) => <Fragment key={label}>
    {index > 0 && <li className="sep3" aria-hidden="true">─</li>}
    <li className={`stp${step >= index + 1 ? ' on' : ''}`} aria-current={!hero && step === index + 1 ? 'step' : undefined}><i aria-hidden="true">{index + 1}</i>{creatorCopy(language, label)}</li>
  </Fragment>)}</ol>
}

/** Source 501053b creator onboarding/center. Public preview presentation only;
 * no ranking, rewards, eligibility or persistence is created by this component. */
export function ClientStrategyCreator({ candidates, publication, visible, nick, loggedIn = true, storageError = false, unavailableMessage, onRetryLoad, onPublish, onVisibility, onNew, renderPreview, Dialog }: ClientStrategyCreatorProps) {
  const { language } = useClientPreferences()
  const c = (key: CreatorCopyKey, values?: Record<string, string | number>) => creatorCopy(language, key, values)
  const percentage = (value: number, signed = true) => sharedPercent(value, language, 1, signed)
  const messageText = (message: CreatorMessage | null) => message === null ? '' : 'key' in message ? c(message.key) : message.detail
  const [open, setOpen] = useState(false), [step, setStep] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewCandidate, setReviewCandidate] = useState<CreatorCandidate | null>(null)
  const [description, setDescription] = useState(''), [draftDescription, setDraftDescription] = useState('')
  const [error, setError] = useState<CreatorMessage | null>(null), [notice, setNotice] = useState<CreatorMessage | null>(null)
  const noticeText = messageText(notice)
  const submitting = useRef(false), lifetime = useRef({ alive: false, version: 0 }), descriptionId = useId()
  const centerTitle = useRef<HTMLHeadingElement>(null), visibilitySwitch = useRef<HTMLButtonElement>(null)
  const focusPublished = useRef(false)
  useLayoutEffect(() => {
    if (!open && publication && focusPublished.current) {
      focusPublished.current = false
      centerTitle.current?.focus({ preventScroll: true })
    }
  }, [open, publication])
  const selected = candidates.find(candidate => candidate.record.id === selectedId)
  const nameCounts = new Map<string, number>()
  candidates.forEach(candidate => nameCounts.set(candidate.record.name, (nameCounts.get(candidate.record.name) ?? 0) + 1))
  const [busy, setBusy] = useState(false)
  useLayoutEffect(() => { const value = lifetime.current; value.alive = true; return () => { value.alive = false; value.version++ } }, [])
  const allowed = loggedIn && !storageError && !busy
  const close = () => { lifetime.current.version++; setOpen(false); setError(null); submitting.current = false; setBusy(false) }
  const begin = (initialStep = 1) => {
    if (!allowed) { if (!loggedIn) onNew(); return }
    const candidate = candidates.find(item => item.eligible && item.record.id === publication?.sourceId) ?? candidates.find(item => item.eligible)
    setSelectedId(candidate?.record.id ?? null); setReviewCandidate(candidate ?? null)
    setDescription(publication?.description ?? ''); setDraftDescription(publication?.description ?? '')
    setStep(candidate ? initialStep : 1); setError(null); submitting.current = false; setOpen(true)
  }
  const move = (next: number) => {
    if (!allowed) { setError({ key: '계정과 저장 상태를 확인한 뒤 다시 시도해주세요.' }); return }
    if (!selected?.eligible) { setStep(1); setError({ key: '검증을 통과한 전략을 선택해주세요' }); return }
    if (step === 2 && next === 3) setDescription(draftDescription.trim())
    // Keep local text across Previous; only Next adopts its trimmed value.
    // Closing still discards this unpersisted draft.
    if (step === 3 && next === 2) setDraftDescription(description)
    if (next === 3) setReviewCandidate(selected)
    setError(null); setStep(next)
  }
  const publish = async () => {
    if (submitting.current) return
    if (!allowed || !selected?.eligible || !reviewCandidate || selected.record.id !== reviewCandidate.record.id) {
      setError({ key: '검증을 통과한 전략을 다시 선택해주세요.' }); return
    }
    submitting.current = true
    setBusy(true)
    const version = ++lifetime.current.version
    try {
      await onPublish({ sourceId: reviewCandidate.record.id, description, expected: reviewCandidate })
      if (!lifetime.current.alive || lifetime.current.version !== version) return
      focusPublished.current = true
      setOpen(false); setError(null); setNotice({ key: '전략이 공개됐어요. 전략 찾기에서 확인할 수 있어요' })
    } catch (cause) {
      if (!lifetime.current.alive || lifetime.current.version !== version) return
      submitting.current = false
      setError(failureMessage(cause, '공개 설정을 저장하지 못했어요. 다시 시도해주세요.'))
    } finally { if (lifetime.current.alive && lifetime.current.version === version) { submitting.current = false; setBusy(false) } }
  }
  const visibility = async (next: boolean, explicit = false) => {
    if (!allowed || !publication || submitting.current) return
    submitting.current = true; setBusy(true)
    const version = ++lifetime.current.version
    try {
      await onVisibility(next)
      if (!lifetime.current.alive || lifetime.current.version !== version) return
      setNotice({ key: explicit && !next ? '비공개로 전환했어요. 스냅샷은 보관돼요' : next ? '전략이 공개됐어요' : '전략 공개를 껐어요' })
      if (explicit) visibilitySwitch.current?.focus({ preventScroll: true })
    } catch (cause) {
      if (lifetime.current.alive && lifetime.current.version === version) setNotice(failureMessage(cause, '공개 상태를 저장하지 못했어요. 다시 시도해주세요.'))
    } finally { if (lifetime.current.alive && lifetime.current.version === version) { submitting.current = false; setBusy(false) } }
  }
  const retry = () => { try { onRetryLoad?.() } catch (cause) { setNotice(failureMessage(cause, '공개 기록을 다시 불러오지 못했어요.')) } }
  return <div className="client-strategy-creator" aria-busy={busy} aria-label={c('{nick} 크리에이터 센터', { nick })} data-publication-source-id={publication?.sourceId}>
    {unavailableMessage && <p role="status" className="ss3-empty">{unavailableMessage}</p>}
    {storageError && <div className="ss3-creator-storage" role="alert"><p>{c('공개 기록을 불러오지 못했어요. 기존 기록은 덮어쓰지 않습니다.')}</p>{onRetryLoad && <button type="button" className="obtn" onClick={retry}>{c('다시 불러오기')}</button>}</div>}
    {!publication ? !storageError && <section className="tfbk-card"><div className="cin ss3-blk ss3-creator-hero">
      <h3>{c('내 전략을 공유해보세요')}</h3><p>{c('검증을 통과한 전략을 닉네임으로 공개하면,')}<br />{c('다른 사용자가 따라할 때마다 이용 요금의 20%가 보상으로 쌓여요.')}</p>
      <Steps hero step={candidates.length ? 2 : 1} />
      {candidates.length ? <button type="button" className="wbtn" onClick={() => begin()}>{c('내 전략 공유하기')}</button> : <button type="button" className="wbtn" onClick={onNew}>{c('채팅에서 전략 만들기')}</button>}
    </div></section> : <>
      <dl className="ss3-creator-tiles" aria-label={c('공개 전략 요약')}>
        <div className="tl"><dt>{c('팔로워')}</dt><dd aria-label={c('팔로워 정보 미제공')}>—</dd></div>
        <div className="tl"><dt>{c('누적 정산 보상')}</dt><dd aria-label={c('누적 정산 보상 정보 미제공')}>—</dd></div>
        <div className="tl"><dt>{c('공개 전략 검증 수익')}</dt><dd className={publication.ret >= 0 ? 'up' : 'dn'}>{percentage(publication.ret)}</dd></div>
        <div className="tl"><dt>{c('TETH 점수')}</dt><dd>{c('{score}점', { score: sharedNumber(publication.score, language, 'auto') })}</dd></div>
      </dl>
      <section className="tfbk-card"><div className="cin ss3-blk"><div className="ss3-mgrid"><div>
        <h3 className="ss3-creator-name" ref={centerTitle} tabIndex={-1}>{publication.name}</h3>
        <div className="ss3-mrow"><button type="button" className="ss3-switch-target" ref={visibilitySwitch} role="switch" aria-label={c('랭킹 공개')} aria-checked={visible} aria-disabled={!allowed} onClick={() => visibility(!visible)}><span className={`tf-swch${visible ? ' on' : ''}`} aria-hidden="true"><i /></span></button><span>{c(visible ? '랭킹에 공개 중' : '비공개 상태')}</span></div>
        <div className="ss3-mrow"><small>{c('보상 요율')}</small><span>{c('팔로워 요금의 20%')}</span></div>
        <div className="ss3-mrow"><small>{c('공개 등록일')}</small><time dateTime={publication.publishedAt}>{creatorDate(publication.publishedAt, language)}</time></div>
        {publication.description && <div className="ss3-mrow"><small>{c('소개')}</small><span>{publication.description}</span></div>}
        <div className="bt"><button type="button" className="obtn" aria-disabled={!allowed} onClick={() => begin(3)}>{c('설정 수정')}</button>{visible && <button type="button" className="ss3-dbtn" aria-disabled={!allowed} onClick={() => visibility(false, true)}>{c('비공개로 전환')}</button>}</div>
      </div><div className="ss3-creator-preview"><div className="ss3-prevl">{c('전략 찾기에 이렇게 노출돼요')}</div>{renderPreview(publication, publication.description)}</div></div></div></section>
    </>}
    {noticeText && <p className="ss3-notice" role="status">{noticeText}</p>}
    {open && <Dialog title={c('내 전략 공유하기')} step={step} onClose={close}><div className="client-strategy-creator-dialog">
      <Steps step={step} />
      {step === 1 ? <>
        <p className="ntc">{c('TETH 점수 80점 이상을 획득한 전략만 공개 랭킹에 등록할 수 있어요.')}</p>
        <div role="group" aria-label={c('공개할 전략 선택')}>{candidates.map(candidate => <button type="button" className={`ss3-radio${candidate.record.id === selectedId ? ' on' : ''}${candidate.eligible ? '' : ' off'}`} key={candidate.record.id} data-source-id={candidate.record.id} aria-pressed={candidate.record.id === selectedId} aria-disabled={!candidate.eligible || !allowed} onClick={() => { if (candidate.eligible && allowed) { setSelectedId(candidate.record.id); setError(null) } }}>
          <span className="rn">{candidate.record.name}{candidate.record.id === selectedId && <span aria-hidden="true"> ✓</span>}</span>
          {(nameCounts.get(candidate.record.name) ?? 0) > 1 && <span className="ss3-source-id">{candidate.record.asset ? `${candidate.record.asset} · ` : ''}{c('전략 ID')} <span aria-hidden="true" title={candidate.record.id}>{candidate.record.id.length > 22 ? `${candidate.record.id.slice(0, 10)}…${candidate.record.id.slice(-8)}` : candidate.record.id}</span><span className="sr-only">{candidate.record.id}</span></span>}
          <span className="rs">{c('TETH {score}점, 검증 수익 {return}, 최대 낙폭 {mdd}', { score: sharedNumber(candidate.record.score, language, 'auto'), return: percentage(candidate.record.ret), mdd: percentage(candidate.record.mdd, false) })}{!candidate.eligible && ` (${candidate.reason ? isCreatorCopyKey(candidate.reason) ? c(candidate.reason) : candidate.reason : c('기준 미달로 공개 불가')})`}</span>
        </button>)}</div>
      </> : step === 2 ? <>
        <p className="ntc"><b>{c('보상 구조')}</b><br />{c('내 전략을 따라하는 사용자가 지불하는 TETH 이용료의 20%가 크리에이터 보상으로 매월 정산돼요.')}</p>
        <p className="ntc"><b>{c('공개 범위')}</b><br />{c('전략 파라미터 원본은 공개되지 않아요. 검증 성과 지표(수익률, 점수, 낙폭, 승률)와 에쿼티 곡선만 닉네임으로 공개됩니다.')}</p>
        <div className="fld3"><label htmlFor={descriptionId}>{c('전략 소개 (선택, 100자)')}</label><input type="text" id={descriptionId} maxLength={100} placeholder={c('예: 하락 후 반등 구간만 노리는 전략이에요')} value={draftDescription} onChange={event => setDraftDescription(event.target.value)} /></div>
      </> : reviewCandidate && <><div className="ss3-prevl">{c('공개되면 전략 찾기에 이렇게 노출돼요')}</div><div className="ss3-creator-preview">{renderPreview(reviewCandidate, description)}</div></>}
      {error && <p className="ss3-creator-error" role="alert">{messageText(error)}</p>}
      <div className="acts3"><button type="button" className="obtn" onClick={() => step === 1 ? close() : move(step - 1)}>{c(step === 1 ? '취소' : '이전')}</button><button type="button" className="wbtn" aria-disabled={!allowed || !selected?.eligible} onClick={() => step === 3 ? publish() : move(step + 1)}>{c(step === 3 ? '공개하고 랭킹 등록하기' : '다음 단계')}</button></div>
    </div></Dialog>}
  </div>
}
