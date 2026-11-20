// 대화 화면(gShowConv), 연구 과정 화면(gShowActivity), 연구 기록(gHistory).
import { useEffect, useRef, useState } from 'react';
import { gHistDate, gHistRows } from '../../core/tai/hist';
import { G, gScrollBottom, gSelect, useConv } from '../../state/conv';
import { ThreadItem } from './items';

/** gShowConv() 가 그리던 대화 줄. 끝의 빈 자리(g-spacer)는 보낸 말을 화면 위로 올릴 때만 있다 */
export function Conv() {
  useConv();
  const sx = G.cur;
  if (!sx) return null;
  return (
    <div className="g-doc">
      <div className="g-thread" id="g-thread">
        {sx.items.map((it) => (
          <ThreadItem it={it} sess={sx} key={it.id} />
        ))}
        {G.spacer != null && <div id="g-spacer" style={{ height: G.spacer + 'px' }} />}
      </div>
    </div>
  );
}

/** gShowActivity(): 연구 실행 기록이 쌓이는 자리. 실행 기록과 중단 뒤 다시 잇기는 연구 실행 조각이 채운다 */
export function Activity() {
  useConv();
  useEffect(() => {
    gScrollBottom();
  }, []);
  return (
    <div className="g-doc">
      <div className="g-act" id="g-act-list" />
      <div id="g-act-done" />
    </div>
  );
}

/** gHistory(), gHistList() */
export function History() {
  useConv();
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(20);
  const input = useRef<HTMLInputElement>(null);
  const rows = gHistRows(G.sessions, q);
  const total = rows.length;
  const lim = useRef({ limit, total });
  lim.current = { limit, total };
  useEffect(() => {
    if (window.innerWidth > 860) input.current?.focus();
    /* 목록 바닥 가까이 가면 20개씩 더 보인다 */
    const sc = document.getElementById('g-scroll');
    if (!sc) return;
    const h = () => {
      if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 320 && lim.current.total > lim.current.limit) setLimit((v) => v + 20);
    };
    sc.addEventListener('scroll', h);
    return () => sc.removeEventListener('scroll', h);
  }, []);
  const slice = rows.slice(0, limit);
  const now = Date.now();
  return (
    <div className="g-hist">
      <div className="g-hist-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          id="g-hist-q"
          type="search"
          placeholder="연구 기록 검색"
          aria-label="연구 기록 검색"
          autoComplete="off"
          ref={input}
          onChange={(e) => {
            setQ(e.target.value.trim().toLowerCase());
            setLimit(20);
          }}
        />
      </div>
      <div className="g-hist-sec">최근</div>
      <div id="g-hist-list">
        {slice.length ? (
          slice.map((r) => (
            <div className="g-hist-row" onClick={() => gSelect(r.sx.id)} key={r.sx.id}>
              <span className="t">{r.sx.title}</span>
              <span className="d num">{gHistDate(r.ts, now)}</span>
            </div>
          ))
        ) : (
          <div className="g-note" style={{ padding: '26px 4px', textAlign: 'center' }}>
            {q ? '검색 결과가 없습니다' : '아직 연구 기록이 없습니다. 새 전략을 만들면 여기에 쌓입니다.'}
          </div>
        )}
      </div>
      <div id="g-hist-more" className="g-note" style={{ textAlign: 'center', padding: '16px 0 6px' }} hidden={total <= limit}>
        아래로 내리면 더 불러옵니다
      </div>
    </div>
  );
}
