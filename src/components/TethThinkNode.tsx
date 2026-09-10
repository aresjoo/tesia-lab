import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import '../teth-think.css'

/* 단계별 사고 노드 — 스트림 내 시간순 배치 (단일 글쓰기 지점 원칙).
 * 진행 중: 고정 높이 라이브 티커(최근 줄만 보이고 위는 페이드) — 높이가 안 변해
 * 스트리밍 중 레이아웃이 흔들리지 않는다. burst 가 끝나면 자동으로
 * "✓ 사고 과정 · N초" 한 줄로 접히고, 클릭하면 전체 프로즈를 재열람한다. */
export function TethThinkNode({ text, status, seconds }: { text: string; status: 'running' | 'done'; seconds?: number }) {
  const [open, setOpen] = useState(false)
  if (status === 'running') {
    return <div className="teth-think running" role="status" aria-label="사고 진행 중">
      <div className="tkn-label">생각하는 중</div>
      {text && <div className="tkn-ticker" aria-hidden="true"><div className="tkn-ticker-inner">{text}</div></div>}
    </div>
  }
  return <div className={open ? 'teth-think open' : 'teth-think'}>
    <button type="button" className="tkn-head" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="tkn-check"><Check size={13} aria-hidden="true" /></span>
      <span>사고 과정{typeof seconds === 'number' && <span className="tkn-sec"> · {seconds}초</span>}</span>
      <ChevronRight className="tkn-chev" size={14} aria-hidden="true" />
    </button>
    <div className="tkn-body"><div className="tkn-inner"><p>{text}</p></div></div>
  </div>
}
