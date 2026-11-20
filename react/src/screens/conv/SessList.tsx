// 사이드바의 대화 목록과 줄마다의 ⋮ 메뉴, 이름 변경과 삭제 대화상자
// (원본 gSideRender, gRowMenu, gRowPin, gRowDlg, gRowRename, gRowDelete).
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '../../core/tai/types';
import { G, gRename, gRowDeleteGo, gRowPin, gSelect, useConv } from '../../state/conv';

const Ico16 = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const PinPath = (
  <>
    <path d="M9 4h6v6l2 3H7l2-3z" />
    <path d="M12 13v7" />
  </>
);

type Menu = { id: string; left: number; top: number; btnTop: number };
type Dlg = { kind: 'rename' | 'delete'; id: string } | null;

/** gRowDlg(html) */
function RowDlg({ dlg, close }: { dlg: NonNullable<Dlg>; close: () => void }) {
  const sx = G.sessions.find((s) => s.id === dlg.id);
  const inp = useRef<HTMLInputElement>(null);
  const [v, setV] = useState(sx ? sx.title : '');
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', esc);
    inp.current?.focus();
    inp.current?.select();
    return () => document.removeEventListener('keydown', esc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sx) return null;
  const same = !v.trim() || v.trim() === sx.title;
  const renameGo = () => {
    gRename(sx.id, v);
    close();
  };
  return createPortal(
    <div
      className="g-dlg-w"
      id="g-dlg-w"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="g-dlg" role="dialog" aria-modal="true">
        {dlg.kind === 'rename' ? (
          <>
            <h3>연구 이름 변경</h3>
            <input
              id="g-ren-in"
              maxLength={60}
              value={v}
              ref={inp}
              onChange={(e) => setV(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !same) renameGo();
              }}
            />
            <div className="acts">
              <button onClick={close}>취소</button>
              <button className="pr" id="g-ren-ok" disabled={same} onClick={renameGo}>
                이름 변경
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>연구를 삭제하시겠습니까?</h3>
            <p>이 연구의 대화, 검증 기록, 아티팩트가 함께 삭제되며 되돌릴 수 없습니다.</p>
            <div className="acts">
              <button onClick={close}>취소</button>
              <button
                className="pr"
                onClick={() => {
                  close();
                  gRowDeleteGo(sx.id);
                }}
              >
                삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** gRowMenu(ev,id): 누른 ⋮ 옆에 뜬다. 화면 아래로 넘치면 위로 올린다 */
function RowMenu({ menu, sx, close, openDlg }: { menu: Menu; sx: Session; close: () => void; openDlg: (d: Dlg) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(menu.btnTop);
  useEffect(() => {
    if (el.current) setTop(Math.min(menu.btnTop, window.innerHeight - el.current.offsetHeight - 10));
    const id = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', close);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="g-rowmenu" id="g-rowmenu" ref={el} style={{ left: menu.left + 'px', top: top + 'px' }}>
      <button onClick={() => gRowPin(sx.id)}>
        <Ico16>
          {PinPath}
          {sx.pinned && <path d="M4 4l16 16" />}
        </Ico16>
        {sx.pinned ? '고정 해제' : '고정'}
      </button>
      <button onClick={() => openDlg({ kind: 'rename', id: sx.id })}>
        <Ico16>
          <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
        </Ico16>
        이름 변경
      </button>
      <button onClick={() => openDlg({ kind: 'delete', id: sx.id })}>
        <Ico16>
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M10 11v6M14 11v6" />
        </Ico16>
        삭제
      </button>
    </div>,
    document.body,
  );
}

/** gSideRender(): 제목만 보이는 최근 목록. 고정한 것이 맨 위 */
export function SessList() {
  useConv();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);
  let rows = G.sessions.filter((x) => !x.live);
  rows = rows.filter((x) => x.pinned).concat(rows.filter((x) => !x.pinned));
  const openMenu = (e: MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (menu) {
      setMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ id, left: Math.min(r.right + 6, window.innerWidth - 190), top: r.top, btnTop: r.top });
  };
  const menuSx = menu ? G.sessions.find((s) => s.id === menu.id) : null;
  return (
    <>
      <div id="g-sess-list">
        {rows.length ? (
          rows.map((sx) => (
            <div className={'g-sess' + (G.cur === sx ? ' on' : '')} onClick={() => gSelect(sx.id)} key={sx.id}>
              <span className="t">{sx.title}</span>
              {sx.status === 'run' && <span className="g-dot run" style={{ marginLeft: '6px', flexShrink: 0 }} />}
              {sx.pinned && (
                <svg className="pin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {PinPath}
                </svg>
              )}
              <button className={'g-sess-dots' + (menu && menu.id === sx.id ? ' open' : '')} onClick={(e) => openMenu(e, sx.id)} aria-label="메뉴" aria-haspopup="true">
                ⋮
              </button>
            </div>
          ))
        ) : (
          <div className="g-note" style={{ padding: '4px 13px' }}>
            아직 없음
          </div>
        )}
      </div>
      {menu && menuSx && (
        <RowMenu
          menu={menu}
          sx={menuSx}
          close={() => setMenu(null)}
          openDlg={(d) => {
            setMenu(null);
            setDlg(d);
          }}
        />
      )}
      {dlg && <RowDlg dlg={dlg} close={() => setDlg(null)} key={dlg.kind + dlg.id} />}
    </>
  );
}
