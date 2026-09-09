import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CLIENT_RANKING, RESEARCH_PAGES, type ResearchPage, type ResearchRecord } from '../research-library'
import { ClientIcon } from './ClientIcon'
import '../client-research-hub.css'

type Props = {
  page: ResearchPage
  records: ResearchRecord[]
  onSelect: (id: string) => void
  onNew: () => void
  onFollow: (idea: string) => void
  onReturn: () => void
  shareable?: { id: string; title: string; returnRate: number }
  notice?: ReactNode
  externalBoundary?: boolean
}

export function ClientResearchHub({ page, records, onSelect, onNew, onFollow, onReturn, shareable, notice, externalBoundary = false }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [shared, setShared] = useState<string[]>(() => {
    try { const value: unknown = JSON.parse(sessionStorage.getItem('teth-sharing-preview') ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [] }
    catch { return [] }
  })
  const [shareNotice, setShareNotice] = useState('')
  const title = page === 'ranking' ? '전략 랭킹' : RESEARCH_PAGES.find(item => item.id === page)!.label
  const Container = externalBoundary ? 'section' : 'main'
  const scheduled = records.filter(record => record.live)
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }) }, [page])
  return <Container id="research-main" className="client-research-hub" aria-labelledby="research-title">
    <header className="hub-header"><h1 id="research-title" ref={titleRef} tabIndex={-1}>{title}</h1><button type="button" onClick={onReturn}>대화로 돌아가기</button></header>
    <div className={`hub-content ${page === 'ranking' || page === 'sharing' ? 'wide' : ''}`}>
      {notice}
      {!externalBoundary && <p className="hub-boundary">MOCK · 디자인 검토용 화면입니다. 실제 예약·공개·보상은 발생하지 않습니다.</p>}
      {page === 'history' && (records.length ? <ul className="hub-history">{records.map(record => <li key={record.id}><button onClick={() => onSelect(record.id)} type="button"><span className="record-title">{record.title}</span><span className="record-market">{record.market}</span><span className="record-status">{record.status}</span><span className="record-open" aria-hidden="true">›</span></button></li>)}</ul> : <div className="hub-empty"><ClientIcon name="history" size={28} /><p>아직 연구 기록이 없어요. 새 전략으로 시작해보세요.</p><button type="button" onClick={onNew}>＋ 새 전략</button></div>)}
      {page === 'schedule' && (scheduled.length ? <><ul className="hub-history">{scheduled.map(record => <li key={record.id}><button type="button" onClick={() => onSelect(record.id)}><span className="record-title">{record.title}</span><span className="record-market">매주 월 09:00</span><span className="record-status">홀드아웃 재검증</span></button></li>)}</ul><p className="hub-description">실행 중인 전략은 매주 최신 구간으로 자동 재검증됩니다.</p></> : <div className="hub-empty"><ClientIcon name="schedule" size={28} /><p>예약된 검증이 없어요. 전략을 실행하면 정기 재검증 일정이 여기에 표시됩니다.</p>{!externalBoundary && <small>현재는 예약 서버가 연결되지 않았습니다.</small>}</div>)}
      {page === 'ranking' && <>
        <h2>전략 랭킹</h2><p className="hub-description">검증을 통과한 공개 전략들이에요. 따라하기를 누르면 내 계정으로 같은 전략을 검증부터 다시 진행해요.</p>
        <ol className="hub-rank-list">{CLIENT_RANKING.map((row, index) => <li className="tf-rank" key={row.id}>
          <span className="no">{index + 1}</span><span className="who"><strong>{row.nick}</strong><small>{row.asset} 전략</small></span>
          <span className="sc">TETH <b>{row.score}점</b></span><span className="sc">검증 수익 <b className="positive">+{row.returnRate.toFixed(1)}%</b></span>
          <span className="fw">팔로워 {row.followers.toLocaleString('ko-KR')}</span>
          <button className="go" type="button" aria-label={`${row.nick} 전략 따라하기`} onClick={() => onFollow(`${row.nick} 님의 ${row.asset} 전략을 검토하고 싶어요. RSI ${row.rsi} 아래에서 진입, 손절 ${row.stop}%, 익절 ${row.take}%, 추세 필터를 포함해 주세요.`)}>따라하기</button>
        </li>)}{externalBoundary && shareable && shared.includes(shareable.id) && <li className="tf-rank"><span className="no">{CLIENT_RANKING.length + 1}</span><span className="who"><strong>{shareable.title}</strong><small>내 공개 전략</small></span><span className="sc">검증 수익 <b className="positive">{shareable.returnRate >= 0 ? '+' : ''}{shareable.returnRate.toFixed(1)}%</b></span><span className="fw">팔로워 0</span><button className="go" type="button" onClick={() => onSelect(shareable.id)}>열기</button></li>}</ol>
        {!externalBoundary && <p className="hub-footnote">점수·수익·팔로워는 클라이언트 원본의 샘플입니다. 따라하기는 검토할 문구를 입력창에 가져오며, 검증이나 주문을 자동 실행하지 않습니다.</p>}
      </>}
      {page === 'sharing' && <>
        <h2>전략 공유</h2><p className="hub-description">내 전략을 공개하면 랭킹에 닉네임으로 노출돼요. 누가 내 전략을 따라하면 보상을 드려요 (요금의 10%)</p>
        {shareable ? <div className="tf-share">
          <button className="tf-switch" role="switch" aria-checked={shared.includes(shareable.id)} aria-label={`${shareable.title} 공개 미리보기`} type="button" onClick={() => {
            const next = shared.includes(shareable.id) ? shared.filter(id => id !== shareable.id) : [...shared, shareable.id]
            setShared(next)
            try { sessionStorage.setItem('teth-sharing-preview', JSON.stringify(next)); setShareNotice(next.includes(shareable.id) ? '공개 미리보기를 켰습니다. 외부에 공유되지 않습니다.' : '공개 미리보기를 껐습니다.') }
            catch { setShareNotice('이 탭에 설정을 저장하지 못했습니다. 외부에 공유되지 않습니다.') }
          }}><i /></button>
          <div className="share-identity"><strong>{shareable.title}</strong><small>{externalBoundary ? '' : 'Mock '}검증 수익 {shareable.returnRate >= 0 ? '+' : ''}{shareable.returnRate.toFixed(1)}%</small></div>
          <span className="share-reward">팔로워 0명, 누적 보상 ₩0</span>
        </div> : <div className="hub-empty"><ClientIcon name="sharing" size={28} /><p>공유할 전략이 아직 없어요. 채팅에서 전략을 맡기고 검증을 통과하면 여기서 공유할 수 있어요.</p><button type="button" onClick={onReturn}>대화로 돌아가기</button></div>}
        {shareNotice && <p className="hub-footnote" role="status">{shareNotice}</p>}
        {!externalBoundary && <p className="hub-footnote">공개·보상 설명은 원본 디자인 카피입니다. 실제 공유 기능과 보상 정책은 아직 제공되지 않습니다.</p>}
      </>}
    </div>
  </Container>
}
