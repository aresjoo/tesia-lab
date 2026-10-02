import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { delegationQuestions } from '../client-delegation-fixtures'
import type { SharedFollowRecord, SharedFollowStatus } from '../client-shared-follow'
import type { SharedStrategy } from '../client-shared-strategies'
import { useClientPreferences } from '../client-preferences'
import { sharedFollowCopy, type SharedFollowCopyKey } from '../client-shared-follow-copy'
import { sharedCopyCopy } from '../client-shared-copy-copy'
import { sharingCopy } from '../client-sharing-copy'
import { sharedNumber, sharedPercent } from '../client-shared-number-format'
import { copySummaryText } from '../client-copy-trading-copy'
import type { CopyServiceFollows } from '../client-copy-service-data'
import { sharingActionFailed, sharingUnavailable } from '../client-sharing-presentation'
import '../client-shared-follow-list.css'

const statusLabels = ['검증 확인 필요', '보관됨', '실행 중', '실행 꺼짐', '실행 준비', '실행 오류', '실행 상태 확인 필요', '조건 입력 중', '검증 중', '조정 중', '리포트 확인', '연결 단계', '검증 통과'] as const

export type ClientSharedFollowListProps = {
  rows: Array<{ record: SharedFollowRecord; status: SharedFollowStatus; source?: SharedStrategy; curve?: ReactNode }>
  onDetail: (nick: string) => void
  onResume: (id: string) => void
  onEdit: (id: string) => void
  onArchive: (id: string) => void
  onRemove: (id: string) => void
  onFind: () => void
  service?: CopyServiceFollows
  serviceMode?: boolean
  hideEmpty?: boolean
  showHeading?: boolean
  sources?: SharedStrategy[]
  renderCurve?: (source: SharedStrategy) => ReactNode
  onEditService?: (id: string) => Promise<void>
  Dialog?: ComponentType<{ title: string; children: ReactNode; onClose: () => void }>
}

/** Original 501053b follow cards. The parent supplies owner-scoped preview data
 * and actions; this presentation neither infers execution nor mutates a follow. */
export function ClientSharedFollowList({ rows, onDetail, onResume, onEdit, onArchive, onRemove, onFind, service, serviceMode, hideEmpty = false, showHeading = false, sources = [], renderCurve, onEditService, Dialog }: ClientSharedFollowListProps) {
  const { language } = useClientPreferences()
  const headingId = useId()
  const f = (key: SharedFollowCopyKey, values?: Record<string, string | number>) => sharedFollowCopy(language, key, values)
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }), [language])
  const [pending,setPending]=useState(''),[failed,setFailed]=useState(false),[archive,setArchive]=useState<string|null>(null)
  const failure = failed ? sharingActionFailed(language) : ''
  const lifecycle=useRef({active:true,pending:false})
  useEffect(()=>{const current=lifecycle.current;current.active=true;return()=>{current.active=false}},[])
  const perform=async(kind:'onResume'|'onEdit'|'onArchive'|'onRemove',id:string)=>{
    const callback=kind==='onEdit' ? onEditService : service?.[kind];if(!callback||lifecycle.current.pending)return
    lifecycle.current.pending=true;setPending(id);setFailed(false)
    try{await callback(id);if(lifecycle.current.active)setArchive(null)}catch{if(lifecycle.current.active)setFailed(true)}
    finally{lifecycle.current.pending=false;if(lifecycle.current.active)setPending('')}
  }
  const entries = serviceMode ? (service?.state==='ready'?service.rows:[]).map(record=>({record,status:record.status,source:sources.find(source=>source.nick===record.nick),curve:undefined as ReactNode,budget:record.budget,dateAt:record.startedAt,sl:record.stopPercent,tp:record.targetPercent})) : rows.map(row=>({...row,budget:delegationQuestions[2].options[row.record.budgetIndex]?.[0] ? sharedCopyCopy(language,delegationQuestions[2].options[row.record.budgetIndex][0]) : null,dateAt:row.record.confirmedAt,sl:row.record.parameters.sl,tp:row.record.parameters.tp}))
  const active = entries.filter(row => row.status.active).length
  const unavailable = serviceMode && service?.state !== 'ready'
  const disabled=(kind:'onResume'|'onEdit'|'onArchive'|'onRemove')=>Boolean(serviceMode && (!service?.[kind] || (kind==='onEdit'&&!onEditService) || pending))
  return <div className="client-shared-follow-list" role={showHeading && entries.length ? 'region' : undefined} aria-labelledby={showHeading && entries.length ? headingId : undefined}>
    {showHeading && entries.length > 0 && <header className="client-library-heading"><h2 id={headingId}>{copySummaryText(language, '복제 검증')}</h2><p>{copySummaryText(language, '전략을 복제해 내 계정으로 재검증한 기록')}</p></header>}
    {serviceMode && <dl className="ss3-tiles" aria-label={f('따라가는 전략 요약')}>{([['복제한 전략',entries.length],['진행 중',active],['보관됨',entries.length-active]] as const).map(([label,count])=><div className="tl" key={label}><dt>{f(label)}</dt><dd>{unavailable?'—':f('{count}개',{count})}</dd></div>)}</dl>}
    {failure && !archive && <p role="alert">{failure}</p>}
    {unavailable ? <p role={service?.state==='error'?'alert':'status'}>{service?.message || sharingUnavailable(language)}</p> : entries.length === 0 ? hideEmpty ? null : <div className="ss3-empty">
      {f('아직 따라가는 전략이 없어요')}<br />
      {f('전략 찾기에서 마음에 드는 전략을 복제해보세요')}<br />
      <button type="button" className="wbtn" onClick={onFind}>{f('전략 찾기로 가기')}</button>
    </div> : <>
      {!serviceMode && <dl className="ss3-tiles" aria-label={f('따라가는 전략 요약')}>
        {([['복제한 전략', entries.length], ['진행 중', active], ['보관됨', entries.length - active]] as const).map(([label, count]) => <div className="tl" key={label}>
          <dt>{f(label)}</dt><dd>{f('{count}개', { count })}</dd>
        </div>)}
      </dl>}
      {entries.map(({ record, status, source, curve, budget, dateAt, sl, tp }) => {
        const date = dateAt == null || !Number.isFinite(new Date(dateAt).getTime()) ? '' : new Date(dateAt).toISOString().split('T')[0]
        const displayDate = !date ? '—' : language === 'ko' ? date : dateFormat.format(dateAt!)
        // The producer's Korean label drives preview progress. Translate only known display states here.
        const statusKey = statusLabels.find(key => key === status.label)
        const statusLabel = statusKey ? f(statusKey) : status.label
        return <article className={`tfbk-card${source ? '' : ' is-source-missing'}`} data-follow-id={record.id} key={record.id} aria-label={`${record.nick} · ${statusLabel}`}>
          <div className="cin"><div className="lft">
            <div className="nmrow">
              {source ? <button type="button" className="nm" onClick={() => onDetail(record.nick)}>{record.nick}</button> : <span className="nm">{record.nick}</span>}
              <span className={`ss3-st${status.active ? '' : ' idle'}`}>{statusLabel}</span>
            </div>
            <div className="as num">
              {f('복제 설정:')} <span className="ss3-follow-setting">{f('손절 {stop}%', { stop: sl == null ? '—' : sharedNumber(sl, language, 'auto') })}</span>,{' '}
              <span className="ss3-follow-setting">{tp === null ? f('익절 미설정') : f('익절 +{target}%', { target: sharedNumber(tp, language, 'auto') })}</span>
              {budget && <>, <span className="ss3-follow-setting">{f('예산 {budget}', { budget })}</span></>}{' '}
              <span className="ss3-follow-date">({f('시작')} <time dateTime={date}>{displayDate}</time>)</span>
            </div>
            {source && <div className="rtrow num">
              <span className="ctc"><b className={source.result.ret >= 0 ? 'up' : 'dn'}>{sharedPercent(source.result.ret, language)}</b><small>{f('원 전략 검증 수익')}</small></span>
              <span className="ctc"><b>{sharedCopyCopy(language, '{score}점', { score: source.score })}</b><small>{sharingCopy(language, 'TETH 점수')}</small></span>
            </div>}
            <div className="bt">
              {status.running ? <>
                <button type="button" className="wbtn" disabled={disabled('onResume')} onClick={() => serviceMode ? void perform('onResume',record.id) : onResume(record.id)}>{f('실행 현황 보기')}</button>
                <button type="button" className="ss3-dbtn" disabled={disabled('onArchive')} onClick={() => serviceMode ? setArchive(record.id) : onArchive(record.id)}>{f('따라가기 중지')}</button>
              </> : status.active ? <>
                <button type="button" className="wbtn" disabled={disabled('onResume')} onClick={() => serviceMode ? void perform('onResume',record.id) : onResume(record.id)}>{f('이어서 진행')}</button>
                <button type="button" className="obtn" disabled={disabled('onEdit')} onClick={() => serviceMode ? void perform('onEdit',record.id) : onEdit(record.id)}>{f('설정 변경')}</button>
                <button type="button" className="ss3-dbtn" disabled={disabled('onArchive')} onClick={() => serviceMode ? setArchive(record.id) : onArchive(record.id)}>{f('중지')}</button>
              </> : <>
                <button type="button" className="obtn" disabled={disabled('onEdit')} onClick={() => serviceMode ? void perform('onEdit',record.id) : onEdit(record.id)}>{f('다시 검증')}</button>
                <button type="button" className="ss3-dbtn" disabled={disabled('onRemove')} onClick={() => serviceMode ? void perform('onRemove',record.id) : onRemove(record.id)}>{f('목록에서 삭제')}</button>
              </>}
            </div>
          </div>{source && (curve || renderCurve) && <div className="lgo">{curve ?? renderCurve?.(source)}</div>}</div>
        </article>
      })}
    </>}{archive && Dialog && <Dialog title={f('따라가기 중지')} onClose={()=>{if(!pending)setArchive(null)}}><p>{f('{nick} 전략 따라가기를 중지할까요?',{nick:entries.find(entry=>entry.record.id===archive)?.record.nick ?? '—'})}</p><p>{f('항목은 보관 처리되고, 이미 실행 중인 전략은 내 트레이딩에서 계속 관리할 수 있어요.')}</p>{failure&&<p role="alert">{failure}</p>}<div className="ss3-dacts"><button type="button" className="obtn" disabled={Boolean(pending)} onClick={()=>setArchive(null)}>{sharedCopyCopy(language,'취소')}</button><button type="button" className="obtn ss3-archive-confirm" aria-busy={Boolean(pending)} disabled={Boolean(pending)} onClick={()=>{void perform('onArchive',archive)}}>{f('중지하고 보관')}</button></div></Dialog>}
  </div>
}
