// 작업 타임라인 (원본 actStart, actPaint, actRenderFinal, actToggle, actRowToggle 가 그리던 것).
import { useEffect, useId, useRef, useState } from 'react';
import { actFinalHead, actHeadLabel } from '../../core/tai/act';
import type { ActData, ActDetail, ActStep } from '../../core/tai/types';
import { ACT, actToggle } from '../../state/tai';

/** taiLogoDraw(w): 로고를 ∞ 궤적으로 그려 내는 아이콘 */
export function LogoDraw({ w }: { w: number }) {
  const mid = 'tldm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className="spd2" viewBox="0 0 52 32" width={w} height={Math.round((w * 32) / 52)} aria-hidden="true">
      <defs>
        <mask id={mid}>
          <path className="mp" d="M26 16 C26 4.5 3 4.5 3 16 C3 27.5 26 27.5 26 16 C26 4.5 49 4.5 49 16 C49 27.5 26 27.5 26 16" stroke="#fff" strokeWidth="13" fill="none" strokeLinecap="round" />
        </mask>
      </defs>
      <image href="assets/logo.png?v=3" x="0" y="0" width="52" height="32" preserveAspectRatio="xMidYMid meet" mask={'url(#' + mid + ')'} />
    </svg>
  );
}

const Check10 = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);
const HdChev = (
  <svg className="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** actTic(st) */
function Tic({ st }: { st: ActStep }) {
  if (st.kind === 'note') return <span className="tic nt" />;
  if (st.status === 'running')
    return (
      <span className="tic run">
        <i />
      </span>
    );
  if (st.status === 'failed') return <span className="tic fail">!</span>;
  return <span className="tic ok">{Check10}</span>;
}

/** 생각 글 상자: 넘치면 위쪽을 흐리게 하고 맨 아래를 따라간다 */
function Cot({ text, live }: { text: string; live: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [ovf, setOvf] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || !live) return;
    const id = requestAnimationFrame(() => {
      if (!el.isConnected) return;
      if (el.scrollHeight > el.clientHeight + 4) setOvf(true);
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [text, live]);
  return (
    <div className={'cot2' + (ovf ? ' ovf' : '')} ref={box}>
      {text}
    </div>
  );
}
function Detail({ d, st, live }: { d: ActDetail; st: ActStep; live: boolean }) {
  if (d.k === 'cot') return <Cot text={live && st.status === 'running' ? st.think || '' : d.text} live={live} />;
  if (d.k === 'srcs')
    return (
      <div className="srclist">
        {d.rows.map((r, i) => {
          let dm = '';
          try {
            dm = new URL(r.u).hostname.replace(/^www\./, '');
          } catch {
            /* 주소가 아니면 비워 둔다 */
          }
          return (
            <a className="srow" href={r.u} target="_blank" rel="noopener noreferrer" key={i}>
              <img className="fv" src={'https://www.google.com/s2/favicons?domain=' + dm + '&sz=32'} alt="" />
              <span className="tt">{r.t}</span>
              <span className="dm">{dm}</span>
            </a>
          );
        })}
      </div>
    );
  return (
    <>
      {d.parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : 'b' in p ? (
          <b key={i}>{p.b}</b>
        ) : 'a' in p ? (
          <a key={i} href={p.a} target="_blank" rel="noopener noreferrer">
            {p.a}
          </a>
        ) : (
          <br key={i} />
        ),
      )}
    </>
  );
}

/** actPaint(run,st). live 는 아직 도는 묶음 안의 줄(생각 줄이 열린 채 글을 받는다) */
function Row({ st, live }: { st: ActStep; live: boolean }) {
  /* 사용자가 누른 펼침. 줄의 상태가 바뀌면(생각 완료 등) 원본처럼 접힌 데서 다시 시작한다 */
  const [user, setUser] = useState<boolean | null>(null);
  useEffect(() => setUser(null), [st.status]);
  const cls = 'ar ' + st.status + (st.kind === 'note' ? ' note' : '') + (st.kind === 'think' ? ' think' : '');
  if (st.kind === 'note')
    return (
      <div className={cls}>
        <Tic st={st} />
        <div className="ab">
          <div className="an">{st.title}</div>
        </div>
      </div>
    );
  const open = user != null ? user : live && !!st.open;
  const det = st.detail || null;
  return (
    <div className={cls}>
      <Tic st={st} />
      <div className={'ab' + (open ? ' open' : '')}>
        <button className="arh" aria-expanded={det ? open : undefined} disabled={!det} onClick={det ? () => setUser(!open) : undefined}>
          <span className="at">{st.title}</span>
          {st.status === 'failed' && <span className="bdg fail">실패</span>}
          {st.mR && <span className="am">{st.mR}</span>}
          {det && (
            <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          )}
        </button>
        {det && (
          <div className="ad">
            <div className="adin">
              <Detail d={det} st={st} live={live} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Act2({ d }: { d: ActData }) {
  const ui = ACT.ui[d.id] || { open: false, fin: true, els: '' };
  const fin = ui.fin;
  return (
    <div className={'g-act2' + (fin ? ' fin' : '') + (ui.open ? ' open' : '')} id={d.id} data-run={d.id}>
      <button className="hd" aria-expanded={ui.open} aria-controls={d.id + '-tl'} onClick={() => actToggle(d.id)}>
        {fin ? <span className={'tic ' + (d.status === 'done' ? 'ok' : 'fail')}>{d.status === 'done' ? Check10 : '!'}</span> : <LogoDraw w={22} />}
        <span className="hlb">{fin ? actFinalHead(d) : actHeadLabel(d)}</span>
        {!fin && <span className="els">{ui.els}</span>}
        {HdChev}
      </button>
      <div className="tl" id={d.id + '-tl'}>
        <div className="tlin">
          {d.steps.map((s, i) => (
            <Row st={s} live={!fin} key={(fin ? 'f' : 'r') + i} />
          ))}
        </div>
      </div>
    </div>
  );
}
