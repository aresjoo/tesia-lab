// 대화 머리줄과 그 ⋮ 메뉴 (원본 gChead, gTitleEdit, gTabsRender, gSessMenu, gSessRename, gSessDelete).
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { G_LBL } from '../../core/tai/labels.data';
import { G, STORE, bump, gSessDeleteGo, gSessRenameGo, gShowActivity, useConv } from '../../state/conv';

/** gLbl(k) */
function gLbl(k: string): string {
  if (G_LBL[k]) return G_LBL[k];
  const m = String(k).match(/^(Backtest|Strategy) v(\d+)$/);
  if (m) return (m[1] === 'Backtest' ? '백테스트' : '전략') + ' v' + m[2];
  return k;
}

/** 제목 고치기: 연필 > 입력칸, Enter 나 바깥을 누르면 저장, Esc 는 그만둠 */
function TitleInput({ old, done }: { old: string; done: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const fin = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const end = (save: boolean) => {
    if (fin.current) return;
    fin.current = true;
    done(save ? (ref.current ? ref.current.value.trim() : '') : null);
  };
  return (
    <input
      id="g-title-in"
      className="g-title-in"
      maxLength={40}
      defaultValue={old}
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Enter') end(true);
        else if (e.key === 'Escape') end(false);
      }}
      onBlur={() => end(true)}
    />
  );
}

export function Chead() {
  useConv();
  const sx = G.cur;
  const mode = G.mode;
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);
  const [ren, setRen] = useState(false);
  const [arm, setArm] = useState(false);
  const menuEl = useRef<HTMLDivElement>(null);
  const renIn = useRef<HTMLInputElement>(null);
  /* 화면이나 대화가 바뀌면 고치던 것과 메뉴를 걷는다 */
  useEffect(() => {
    setEdit(false);
    setMenu(null);
  }, [sx, mode]);
  useEffect(() => {
    if (!menu) return;
    const h = (e: globalThis.MouseEvent) => {
      if (menuEl.current && !menuEl.current.contains(e.target as Node)) setMenu(null);
    };
    const id = setTimeout(() => document.addEventListener('click', h), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', h);
    };
  }, [menu]);
  useEffect(() => {
    if (ren && renIn.current && sx) {
      renIn.current.value = sx.title;
      renIn.current.focus();
      renIn.current.select();
    }
  }, [ren]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = sx ? sx.title : mode === 'history' ? '연구 기록' : '';
  const sub = sx ? sx.sub || '' : '';
  const status = sx && mode === 'activity' ? (sx.status === 'run' ? 'run' : sx.status === 'stopped' ? 'stopped' : null) : null;
  /** gSessMenu(ev) */
  const openMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!sx) return;
    if (menu) {
      setMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setRen(false);
    setArm(false);
    setMenu({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };
  const renameGo = () => {
    if (gSessRenameGo(renIn.current ? renIn.current.value : '')) setMenu(null);
  };
  return (
    <>
      <div className="g-chead" id="g-chead" hidden={mode === 'home'}>
        <span id="g-chead-title">
          {edit && sx ? (
            <TitleInput
              old={sx.title}
              done={(v) => {
                if (v) sx.title = v;
                setEdit(false);
                bump();
                STORE.save();
              }}
            />
          ) : (
            <>
              <span id="g-title-txt">{title}</span>
              {sx && (
                <button className="g-title-edit" onClick={() => setEdit(true)} aria-label="이름 바꾸기">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
                  </svg>
                </button>
              )}
            </>
          )}
        </span>
        <span className="sub" id="g-chead-sub">
          {sub}
        </span>
        <span className="g-tabs" id="g-tabs">
          {sx &&
            sx.tabs.map((t) => (
              <button className={'g-tab' + (t.id === '__act' ? ' on' : '')} onClick={t.id === '__act' ? gShowActivity : undefined} key={t.id}>
                {gLbl(t.title)}
              </button>
            ))}
        </span>
        <span style={{ flex: 1 }} />
        <span id="g-chead-status" className="g-tag" hidden={!status}>
          {status === 'run' ? (
            <>
              <span className="g-dot run" />
              연구 진행 중
            </>
          ) : status === 'stopped' ? (
            '중단됨'
          ) : null}
        </span>
        <button className="g-iconbtn" id="g-chead-dots" onClick={openMenu} aria-label="메뉴" aria-haspopup="true" hidden={!sx}>
          ⋮
        </button>
      </div>
      <div id="g-sess-menu" hidden={!menu} ref={menuEl} style={menu ? { top: menu.top + 'px', left: 'auto', right: menu.right + 'px' } : undefined}>
        <div id="g-sess-items" hidden={ren}>
          <button className="gsm-it" onClick={() => setRen(true)}>
            이름 바꾸기
          </button>
          <button
            className="gsm-it danger"
            id="g-sess-del"
            data-arm={arm ? '1' : ''}
            onClick={() => {
              if (!arm) {
                setArm(true);
                return;
              }
              setMenu(null);
              gSessDeleteGo();
            }}
          >
            {arm ? '정말 삭제하겠습니까? 되돌릴 수 없습니다' : '삭제'}
          </button>
        </div>
        <div id="g-sess-ren-form" hidden={!ren}>
          <input
            id="g-sess-ren-in"
            aria-label="전략 이름"
            maxLength={60}
            ref={renIn}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameGo();
              else if (e.key === 'Escape') setMenu(null);
            }}
          />
          <button onClick={renameGo}>저장</button>
        </div>
      </div>
    </>
  );
}
