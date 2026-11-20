// 전략 찾기 목록 (원본 tfShareHub('find')): 판단 방식, 정렬, 시장, 검색 > 카드 10장 > 쪽 번호 > 상담 한 줄.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MK_KIND } from '../../core/engine/catalog.data';
import { listPage, mk30, mkEx, mkSortKey } from '../../core/engine/catalog';
import { mkPct0, mkSign } from '../../core/engine/format';
import type { Strat } from '../../core/engine/types';
import { nav } from '../../state/route';
import { acName } from '../../core/account/ac';
import { getShare, myExIds, myExSet, setSS, setShare, useShare } from '../../state/share';
import { setState } from '../../state/store';
import { mkWindCheck } from './copyActions';
import { FwLine, Glyph, Spark3 } from './parts';

/** tfSS3Go(ne,pd,tab): 상세로. 기간은 목록에서 고른 값을 따라간다 */
export function goDetail(id: string, pd?: string | null, tab?: string) {
  const p = pd || getShare().ss.pd || 'all';
  nav('#/share/s/' + id + '/' + p + (tab && tab !== 'ov' ? '/' + tab : ''));
}

/** skfCard(s): 이름, 판단 방식과 실행 거래소, 최근 30일 수익률과 작은 그래프, 따라가는 사람 수. 카드 전체가 상세로 가는 링크 */
function Card({ s, i }: { s: Strat; i: number }) {
  const m30 = mk30(s);
  const ex = mkEx(s);
  /** skfOpen(e,ne) */
  const open = (e: MouseEvent | KeyboardEvent) => {
    if (e.type === 'keydown') {
      const k = (e as KeyboardEvent).key;
      if (k !== 'Enter' && k !== ' ') return;
      e.preventDefault();
    }
    goDetail(s.id);
  };
  return (
    <article className={'mk-card skf k-' + s.kind} role="link" tabIndex={0} aria-label={s.name + ' 전략 보기'} onClick={open} onKeyDown={open} style={{ ['--i' as string]: i }}>
      <div className="skf-top">
        <Glyph s={s} z={28} />
        <div className="skf-nm">
          <h3>{s.name}</h3>
          <span>
            <img src={'assets/logos/' + ex[0] + '.png'} alt="" width={14} height={14} loading="lazy" />
            {MK_KIND[s.kind] + ', ' + ex[1] + '에서 실행'}
          </span>
        </div>
      </div>
      <div className="skf-perf">
        <div className="skf-ret">
          <small>최근 30일</small>
          <b className={'num' + mkSign(m30.ret)}>{mkPct0(m30.ret)}</b>
        </div>
        <Spark3 eq={m30.eq} />
      </div>
      <div className="skf-fw">
        <FwLine n={s.fw} />
      </div>
    </article>
  );
}

const KINDS: [string, string, string][] = [
  ['all', '전체', '모든 전략'],
  ['agent', 'AI 판단', 'AI가 종목과 시점, 비중을 정합니다'],
  ['rule', '차트 규칙', '정해 둔 가격 조건이 맞을 때만 거래합니다'],
  ['mix', '혼합 전략', 'AI가 고르고, 규칙이 시점을 정합니다'],
];
const KIND_HELP: Record<string, string> = { agent: 'AI가 종목과 시점, 비중을 정합니다.', rule: '정해 둔 가격 조건이 맞을 때만 거래합니다.', mix: 'AI가 종목을 고르고, 규칙이 시점을 정합니다.' };
const SORTS: [string, string][] = [
  ['pick', '추천순'],
  ['ret', '최근 30일 수익률순'],
  ['fw', '복사한 사람순'],
];
const MKTS: [string, string][] = [
  ['all', '시장 전체'],
  ['crypto', '가상자산'],
  ['stock', '미국 주식'],
  ['index', '지수와 금'],
  ['multi', '여러 시장'],
];

/** tfBkDropSheet(id): 모바일에서는 선택 메뉴를 아래에서 올라오는 시트로 연다 */
function DropSheet({ title, items, cur, pick, close }: { title: string; items: [string, string][]; cur: string; pick: (v: string) => void; close: () => void }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  /* 닫을 때는 내려가는 동안(180ms) 남겨 둔다 */
  const shut = (after?: () => void) => {
    setOn(false);
    setTimeout(() => {
      close();
      after?.();
    }, 180);
  };
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') shut();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div id="tfbk-sheetw" className={on ? 'on' : ''}>
      <div className="sc" onClick={() => shut()} />
      <div className="sh" role="listbox" aria-label={title}>
        <div className="hd">
          <b>{title}</b>
          <button type="button" className="x" aria-label="닫기" onClick={() => shut()}>
            ✕
          </button>
        </div>
        {items.map((it, i) => (
          <button key={it[0]} type="button" className={'it' + (it[0] === cur ? ' on' : '')} data-i={i} onClick={() => shut(() => pick(it[0]))}>
            {it[1]}
            {it[0] === cur ? <span className="ck">✓</span> : null}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** tfBkDrop(id,items,cur,fn): 선택 메뉴 */
function Drop({ id, items, cur, pick }: { id: string; items: [string, string][]; cur: string; pick: (v: string) => void }) {
  const [open, setOpen] = useState<'no' | 'menu' | 'sheet'>('no');
  const wrap = useRef<HTMLSpanElement>(null);
  let lb = items[0][1];
  items.forEach((it) => {
    if (it[0] === cur) lb = it[1];
  });
  /* tfBkDropInit: 바깥을 누르거나 Esc 를 누르면 닫는다 */
  useEffect(() => {
    if (open !== 'menu') return;
    const c = (e: globalThis.MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen('no');
    };
    const k = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen('no');
    };
    document.addEventListener('click', c);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('click', c);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  /** tfBkDropTgl(e,id) */
  const tgl = (e: MouseEvent) => {
    e.stopPropagation();
    if (open !== 'no') {
      setOpen('no');
      return;
    }
    setOpen(window.innerWidth <= 760 ? 'sheet' : 'menu');
  };
  return (
    <span className="tfbk-dropwrap" ref={wrap}>
      <button type="button" className="tfbk-drop" aria-haspopup="listbox" aria-expanded={open === 'menu'} onClick={tgl}>
        {lb}{' '}
        <span className="car" aria-hidden="true">
          ▾
        </span>
      </button>
      <div className="tfbk-menu" id={id} role="listbox" style={{ display: open === 'menu' ? 'block' : 'none' }}>
        {items.map((it) => (
          <button
            key={it[0]}
            type="button"
            className={'mi' + (it[0] === cur ? ' on' : '')}
            role="option"
            aria-selected={it[0] === cur}
            onClick={(e) => {
              e.stopPropagation();
              setOpen('no');
              pick(it[0]);
            }}
          >
            {it[1]}
          </button>
        ))}
      </div>
      {open === 'sheet' ? <DropSheet title={lb} items={items} cur={cur} pick={pick} close={() => setOpen('no')} /> : null}
    </span>
  );
}

/** mkFabDodge(): 모바일에서 상담 단추가 쪽 번호를 가리면 단추를 숨긴다 */
function useFabDodge() {
  useEffect(() => {
    let raf = 0;
    const dodge = () => {
      let on = false;
      if (window.innerWidth <= 640) {
        const fab = document.getElementById('teth-help');
        const tg = document.querySelectorAll('.mk-pager .mk-pg');
        if (fab && fab.offsetWidth) {
          const f = fab.getBoundingClientRect();
          for (let k = 0; k < tg.length; k++) {
            const r = tg[k].getBoundingClientRect();
            if (r.bottom < 0 || r.top > window.innerHeight) continue;
            if (r.left < f.right + 4 && r.right > f.left - 4 && r.top < f.bottom + 4 && r.bottom > f.top - 4) {
              on = true;
              break;
            }
          }
        }
      }
      document.body.classList.toggle('mk-fab-dodge', on);
    };
    const tick = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        dodge();
      });
    };
    const t = setTimeout(tick, 60);
    document.addEventListener('scroll', tick, true);
    window.addEventListener('resize', tick);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      document.removeEventListener('scroll', tick, true);
      window.removeEventListener('resize', tick);
      document.body.classList.remove('mk-fab-dodge');
    };
  }, []);
}

/** tbIcon(id,16) */
function TbIcon({ id }: { id: string }) {
  return <img className="tb-ic" src={'assets/logos/app-' + id + (id === 'gate' ? '.jpg' : '.png')} alt="" width={16} height={16} />;
}
/** tfMyExNames(ids) */
const myExNames = (ids: string[]) => ids.map((k) => acName(k)).join(', ');

/** tfMyExChip(), tfMyExMenu(open): 거래소를 연결한 회원에게만. 하나면 켜고 끄는 알약, 둘 이상이면 작은 목록 */
function MyExChip({ conn, v, set }: { conn: string[]; v: string; set: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const on = !!v;
  const ids = on ? (v === 'all' ? conn : [v]) : conn;
  const multi = conn.length > 1;
  const lb = !on || v === 'all' ? '내 거래소' : myExNames([v]) + '만';
  /* 바깥을 누르거나 Esc 를 누르면 닫는다 */
  useEffect(() => {
    if (!open) return;
    const c = (e: globalThis.MouseEvent) => {
      if (!(e.target as Element).closest?.('.myex-w')) setOpen(false);
    };
    const k = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', c);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('click', c);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  /* 열면 지금 고른 항목에 초점 */
  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    (menu.current.querySelector<HTMLButtonElement>('button.on') || menu.current.querySelector<HTMLButtonElement>('button'))?.focus();
  }, [open]);
  const pick = (val: string) => {
    setOpen(false);
    set(val);
  };
  /* 목록 키보드: 위아래 화살표, Esc 는 닫고 단추로 초점, Tab 은 닫기 */
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menu.current?.querySelectorAll('button') || []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };
  const it = (val: string, lab: string, ic: ReactNode) => {
    const cur = (v || '') === val;
    return (
      <button
        key={'m' + val}
        type="button"
        role="menuitemradio"
        aria-checked={cur}
        className={cur ? 'on' : ''}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          pick(val);
        }}
      >
        {ic}
        <span>{lab}</span>
        {cur ? (
          <svg className="ck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : null}
      </button>
    );
  };
  return (
    <div className="myex-w">
      <button
        type="button"
        ref={btn}
        className={'myex' + (on ? ' on' : '')}
        aria-pressed={on}
        aria-haspopup={multi ? 'true' : undefined}
        aria-expanded={multi ? open : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (multi) setOpen(!open);
          else set(on ? '' : 'all');
        }}
      >
        <span className="myex-ic">
          {ids.slice(0, 3).map((k) => (
            <TbIcon key={k} id={k} />
          ))}
        </span>
        {lb}
        {multi ? (
          <>
            {' '}
            {/* MKT_CHEV */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </>
        ) : null}
      </button>
      {open ? (
        <div className="myex-m" role="menu" ref={menu} onKeyDown={keys}>
          {it(
            'all',
            '연결한 거래소 전체',
            conn.slice(0, 3).map((k) => <TbIcon key={k} id={k} />),
          )}
          {conn.map((k) => it(k, myExNames([k]) + '만', <TbIcon id={k} />))}
          {it('', '끄기, 전체 전략 보기', null)}
        </div>
      ) : null}
    </div>
  );
}

export function Hub() {
  const ss = useShare((s) => s.ss);
  const q = useShare((s) => s.q);
  const myEx = useShare((s) => s.myEx);
  const myExConn = useShare((s) => s.myExConn);
  const myIds = myExIds(getShare());
  const [searchOpen, setSearchOpen] = useState(false);
  const qRef = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const seg = useRef<HTMLDivElement>(null);
  const jump = useRef(false);
  const refocus = useRef(false);
  const sort = mkSortKey(ss.sort) === 'win' ? 'pick' : mkSortKey(ss.sort);
  const kind = ss.kind || 'all';
  const L = listPage(ss, q, myIds);

  /* 조건이 바뀌면 1쪽으로 (원본은 그리는 중에 t.ss.page 를 고쳐 쓴다) */
  useEffect(() => {
    if (ss.pgSig !== L.pgSig || ss.page !== L.page) setSS({ pgSig: L.pgSig, page: L.page });
  }, [ss.pgSig, ss.page, L.pgSig, L.page]);
  useFabDodge();
  /* mkWindCheck(): 목록에 들어올 때마다 「원본 청산 대기」 복사를 정산한다 */
  useEffect(() => {
    mkWindCheck();
  }, []);
  /* mkCardsEnter(): 목록에 들어올 때 한 번 */
  useEffect(() => {
    const g = cards.current;
    if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    g.classList.add('mk3-enter');
    const t = setTimeout(() => g.classList.remove('mk3-enter'), 1400);
    return () => clearTimeout(t);
  }, []);
  /* tfSS3Page(i): 쪽을 넘기면 목록 머리가 보이게 올린다 */
  useLayoutEffect(() => {
    if (!jump.current) return;
    jump.current = false;
    const g = grid.current;
    if (!g) return;
    const y = g.getBoundingClientRect().top;
    if (y < 0) {
      const off = window.innerWidth <= 860 ? 148 : 90;
      const sc = document.getElementById('g-scroll');
      if (document.body.classList.contains('gft-doc')) window.scrollBy(0, y - off);
      else if (sc) sc.scrollTop += y - off;
    }
  }, [L.page]);
  /* mkKindPick(v): 키보드로 골랐으면 고른 단추에 초점을 남긴다 */
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    seg.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [kind]);

  /* 원본은 정렬, 판단 방식, 시장을 바꾸면 화면을 통째로 다시 그린다(gContent): 맨 위로 올라가고, 누른 것의 초점이 풀리고, 모바일 검색 칸이 닫힌다 */
  const redraw = () => {
    const a = document.activeElement as HTMLElement | null;
    if (a && a.closest('#g-content')) a.blur();
    setSearchOpen(false);
    const sc = document.getElementById('g-scroll');
    if (sc) sc.scrollTop = 0;
    window.scrollTo(0, 0);
  };
  /** tfMyExSet(v): 화면을 다시 그린 뒤 알약 단추로 초점을 돌린다 */
  const myExPick = (v: string) => {
    myExSet(v);
    redraw();
    setTimeout(() => document.querySelector<HTMLButtonElement>('.myex')?.focus(), 60);
  };
  /** tfSS3SortPick(v) */
  const sortPick = (v: string) => {
    if (v === 'pick') setSS({ sort: 'pick', dir: 'desc' });
    else if (ss.sort === v) setSS({ dir: ss.dir === 'asc' ? 'desc' : 'asc' });
    else setSS({ sort: v, dir: 'desc' });
    redraw();
  };
  /** tfSS3Page(i): 목록만 다시 그린다. 누른 쪽 번호의 초점은 풀린다 */
  const page = (i: number) => {
    jump.current = true;
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSS({ page: i });
  };
  const pgBtn = (i: number, lb: string, cls: string, dis: boolean) => (
    <button key={cls + lb} type="button" className={'mk-pg' + cls} disabled={dis} aria-current={i === L.page && !cls ? 'page' : undefined} aria-label={lb === '‹' ? '이전 페이지' : lb === '›' ? '다음 페이지' : lb + '페이지'} onClick={() => page(i)}>
      {lb}
    </button>
  );

  return (
    <div className="tf-page tfbk ss3 mk">
      <div className={'mk-bar mk3-bar' + (searchOpen ? ' mk-search-open' : '')}>
        <div className="mk3-kindrow">
          <div className="mk3-seg" role="group" aria-label="판단 방식" ref={seg}>
            {KINDS.map((o) => (
              <button
                key={o[0]}
                type="button"
                aria-pressed={kind === o[0]}
                title={o[2]}
                onClick={() => {
                  refocus.current = !!seg.current?.contains(document.activeElement);
                  setSS({ kind: o[0] });
                  redraw();
                }}
              >
                {o[1]}
              </button>
            ))}
          </div>
          {kind === 'all' ? null : <p className="mk3-kindhelp one">{KIND_HELP[kind]}</p>}
        </div>
        <div className="mk-flt mk3-flt">
          <label className="skf-sort">
            <span className="sr">정렬</span>
            <select aria-label="정렬" value={sort} onChange={(e) => sortPick(e.target.value)}>
              {SORTS.map((o) => (
                <option key={o[0]} value={o[0]}>
                  {o[1]}
                </option>
              ))}
            </select>
          </label>
          <Drop id="ss3-m-asset" items={MKTS} cur={ss.asset || 'all'} pick={(v) => {
              setSS({ asset: v });
              redraw();
            }}
          />
          {myExConn.length ? (
            <MyExChip
              conn={myExConn}
              v={myEx}
              set={myExPick}
            />
          ) : null}
          {/* tfMkSearchToggle(btn) */}
          <button
            type="button"
            className="mk-search-toggle"
            aria-label="전략 검색"
            aria-expanded={searchOpen}
            onClick={() => {
              const o = !searchOpen;
              setSearchOpen(o);
              if (o) setTimeout(() => qRef.current?.focus(), 0);
            }}
          >
            ⌕
          </button>
          <label className="ss3-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input id="ss3-q" ref={qRef} type="search" placeholder="전략 검색" defaultValue={q} aria-label="전략 검색" onInput={(e) => setShare({ q: e.currentTarget.value.trim() })} />
          </label>
        </div>
      </div>
      <div id="ss3-grid" ref={grid}>
        {myIds.length && (!L.myN || L.empty) ? (
          /* 켰는데 걸리는 전략이 없을 때 */
          <div className="myex-empty">
            <p>{myExNames(myIds)}에서 실행할 수 있는 전략이 아직 없습니다.</p>
            <button type="button" className="pl-link" onClick={() => myExPick('')}>
              전체 보기
            </button>
          </div>
        ) : L.empty ? (
          <div className="ss3-empty">
            조건에 맞는 전략이 없습니다
            <br />
            {/* tfSS3Reset() */}
            <button
              type="button"
              className="mk-btn2"
              style={{ marginTop: 16 }}
              onClick={() => {
                if (qRef.current) qRef.current.value = '';
                myExSet('');
                setShare((s) => ({ q: '', ss: { ...s.ss, asset: 'all', kind: 'all' } }));
                redraw();
              }}
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <>
            {myIds.length ? <p className="myex-note">{myExNames(myIds) + '에서 바로 실행할 수 있는 전략 ' + L.myN + '개입니다.'}</p> : null}
            <div className="mk-grid mk3-grid" ref={cards}>
              {L.rows.map((s, i) => (
                <Card key={s.id + '-' + i} s={s} i={i} />
              ))}
            </div>
            {L.pages > 1 ? (
              <nav className="mk-pager" aria-label="페이지">
                {pgBtn(L.page - 1, '‹', ' nav', L.page <= 1)}
                {Array.from({ length: L.pages }, (_, k) => pgBtn(k + 1, String(k + 1), '', false))}
                {pgBtn(L.page + 1, '›', ' nav', L.page >= L.pages)}
              </nav>
            ) : null}
          </>
        )}
        <p className="cq-help mk-help">
          막히면 상담원이 24시간 답합니다.{' '}
          {/* tfTxHelp() */}
          <button
            type="button"
            className="pl-link"
            onClick={(e) => {
              e.stopPropagation();
              setState({ helpOpen: true });
            }}
          >
            상담원에게 묻기
          </button>
        </p>
      </div>
    </div>
  );
}
