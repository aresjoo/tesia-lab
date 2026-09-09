import { useId, useState, type CSSProperties } from 'react'
import { Check, ChevronRight, Square } from 'lucide-react'
import { TETH_MODEL_COLORS, type TethRoutedModel } from '../teth-model-routing'
import type { WorkBlock } from '../teth-work-block'
import '../teth-work-block.css'

/* 인라인 work 카드 렌더러 — 정규화된 WorkBlock 만 받는다(어댑터는 teth-work-block.ts).
 * 진행 중: (DEMO_MODE) 모델 뱃지 + 라우팅 선언 + item 순차 라이브 체크.
 * 완료: 한 줄 접힘("✓ item 요약 — 모델")으로 축소, 클릭 시 펼침.
 * 접힘 전환이 곧 릴레이 핸드오프 연출이다 — 다음 say/work 가 이어받는 리듬.
 * DEMO_MODE off: 뱃지·선언 없이 role 라벨만으로 렌더된다(빈 뱃지 금지). */
export function TethWorkBlock({ block, demoMode }: { block: WorkBlock; demoMode: boolean }) {
  const id = useId()
  const running = block.status === 'running'
  const [expanded, setExpanded] = useState(running)
  const [previousStatus, setPreviousStatus] = useState(block.status)
  if (block.status !== previousStatus) { setPreviousStatus(block.status); if (block.status !== 'running') setExpanded(false) }
  const model = demoMode ? block.model as TethRoutedModel | null : null
  const badgeStyle = model ? { '--twk-badge': TETH_MODEL_COLORS[model] } as CSSProperties : undefined
  const summary = block.items.length
    ? block.items.slice(0, 2).map(item => item.label).join(', ') + (block.items.length > 2 ? ` 외 ${block.items.length - 2}` : '')
    : block.role
  return <section className={`teth-work ${running ? 'run' : 'fin'} ${block.status} ${expanded ? 'open' : ''}`} style={badgeStyle} aria-label={`작업: ${block.role}`}>
    <button className="twk-head" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <span className="twk-state" aria-hidden="true">
        {running ? <span className="g-tdots"><i /><i /><i /></span> : block.status === 'stopped' ? <Square size={8} fill="currentColor" /> : <Check size={11} />}
      </span>
      {running
        ? <>
          {model && <span className="twk-badge">{model}</span>}
          <span className="twk-role">{block.role}</span>
        </>
        : <>
          <span className="twk-sum">{summary}</span>
          {model && <span className="twk-model-tail">{model}</span>}
        </>}
      <ChevronRight size={12} className="twk-chev" aria-hidden="true" />
    </button>
    {running && model && <p className="twk-route">이 작업에는 {model}를 사용합니다</p>}
    <div className="twk-body" aria-hidden={!expanded}>
      <div className="twk-inner">
        <ol id={id} className="twk-items">
          {block.items.map(item => <li key={item.id} className={item.status}>
            <span className="twk-ic" aria-hidden="true">
              {item.status === 'running' ? <span className="g-tdots"><i /><i /><i /></span> : item.status === 'stopped' ? <Square size={7} fill="currentColor" /> : <Check size={10} />}
            </span>
            <span className="twk-label">{item.label}</span>
          </li>)}
        </ol>
        {block.sources && block.sources.length > 0 && <ul className="twk-sources" aria-label={`읽은 소스 ${block.sources.length}개`}>
          {block.sources.map(source => <li key={source.id} className={source.status}>
            <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=32`} alt="" width={14} height={14} loading="lazy" />
            <span className="twk-src-title">{source.title}</span>
            <span className="twk-src-domain">{source.domain}</span>
            <span className="twk-src-state">{source.status === 'reading' ? '읽는 중…' : <Check size={10} aria-label="읽기 완료" />}</span>
          </li>)}
        </ul>}
      </div>
    </div>
  </section>
}
