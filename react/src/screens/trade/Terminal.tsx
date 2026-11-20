// AI 트레이딩 터미널 (원본 tfDashView, G.mode 'tfdash'). 셸과 왼쪽 전략 목록, 가운데 머리줄을 그리고
// 시세(term/Market), 판단 패널(term/Brain), 하단 패널(term/Bottom)을 끼운다.
// 원본은 그린 뒤 뒤쪽 스크립트가 여러 번 고친다(sk-term 글자, sk-mkt 시세 줄, sk-brain 판단 패널). 여기는 그 마지막 모양이다.
import { useEffect, useRef, useState } from 'react';
import { tfTmPct, tfTmPnl, tfTmSign, TF_TM_ST, tfTmWon, tfTmWonS, type TermRow } from '../../core/trade/term';
import { sktText as K } from '../../core/trade/text';
import { nav } from '../../state/route';
import { setState } from '../../state/store';
import { tfBackToChat } from './bridge';
import { setPreview, usePreview, useRev, useTf } from './store';
import { Bottom, Strip } from './term/Bottom';
import { Brain } from './term/Brain';
import { tfTmDrawer, tfTmHalt, tfTmMenu } from './term/dialogs';
import { MktChart, MktHead, mktStratSym, mktSync } from './term/Market';
import { TermOverlays } from './term/overlay';
import { ExBadge, Flex1, KindBadge, tfExOf2 } from './term/parts';
import { all, calc, evalStep, setTm, TF_TM, tfTmReconnect, tfTmSelect, tfTmSetStatus } from './term/tm';

const MTABS: [string, string][] = [['chart', '차트'], ['brain', '판단'], ['pos', '포지션']];
/** 모바일에서 전략이 없으면 판단 탭을 먼저 보인다. 한 번만 (원본 sktApply 감싸기의 done) */
let mobBrainDone = false;

/** tfTmRail(): 왼쪽 전략 목록. 지금은 판단 패널 머리의 「전략 N개」 단추로 여는 목록이다 */
function Rail({ list, pv }: { list: TermRow[]; pv: boolean }) {
  const rows = list.filter((s) => {
    if (TF_TM.fst !== 'all' && s.status !== TF_TM.fst) return false;
    if (TF_TM.fex !== 'all' && s.ex !== TF_TM.fex) return false;
    if (TF_TM.q && (s.name + ' ' + s.sym).toLowerCase().indexOf(TF_TM.q.toLowerCase()) < 0) return false;
    return true;
  });
  const exs: string[] = [];
  list.forEach((s) => {
    if (s.ex && exs.indexOf(s.ex) < 0) exs.push(s.ex);
  });
  return (
    <aside className="tft-rail" id="tft-rail">
      <div className="tft-rh">
        <b>{K('전략')}</b>
        <span className="ct2">{list.length}</span>
        <Flex1 />
        {!pv && (
          <button type="button" className="tft-new" onClick={tfBackToChat}>
            {K('+ 새 전략')}
          </button>
        )}
      </div>
      <div className="tft-rf">
        <input type="search" placeholder="전략 검색" defaultValue={TF_TM.q} onInput={(e) => setTm({ q: e.currentTarget.value })} aria-label="전략 검색" />
        <div className="fr2">
          <select value={TF_TM.fst} onChange={(e) => setTm({ fst: e.target.value })} aria-label="상태 필터">
            {[['all', '전체 상태'], ['live', '실행 중'], ['off', '일시정지'], ['ready', '실행 전'], ['err', '오류']].map((o) => (
              <option key={o[0]} value={o[0]}>
                {o[1]}
              </option>
            ))}
          </select>
          <select value={TF_TM.fex} onChange={(e) => setTm({ fex: e.target.value })} aria-label="거래소 필터">
            <option value="all">전체 거래소</option>
            {exs.map((x) => (
              <option key={x} value={x}>
                {tfExOf2(x).name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="tft-rl">
        {!list.length ? (
          <div className="tft-empty">
            <b>{K('아직 전략이 없습니다')}</b>
            <span>{K('채팅에서 전략을 만들고 검증을 통과하면 여기서 실행됩니다.')}</span>
            {!pv && (
              <button className="nfx-btn pri" onClick={tfBackToChat}>
                새 전략 만들기
              </button>
            )}
          </div>
        ) : !rows.length ? (
          <div className="tft-empty">
            <b>{K('조건에 맞는 전략이 없습니다')}</b>
            <span>{K('검색어나 필터를 조정해보십시오.')}</span>
          </div>
        ) : (
          rows.map((s) => {
            const c = calc(s);
            const st = TF_TM_ST[s.status] || TF_TM_ST.off;
            const on = TF_TM.sel === s.key;
            return (
              <div
                className={'tft-card' + (on ? ' on' : '') + ' st-' + s.status}
                key={s.key}
                onClick={(e) => {
                  if ((e.target as Element).closest('button')) return;
                  tfTmSelect(s.key);
                }}
              >
                <div className="r1">
                  <ExBadge ex={s.ex} />
                  <span className="nm" title={s.name}>
                    {K(s.name)}
                  </span>
                  <span className={'st st-' + st[2]}>{st[0] + ' ' + st[1]}</span>
                  {!pv && (
                    <button
                      type="button"
                      className="mn"
                      aria-label="전략 메뉴"
                      onClick={(e) => {
                        e.stopPropagation();
                        tfTmMenu(e.currentTarget, s.key);
                      }}
                    >
                      ⋯
                    </button>
                  )}
                </div>
                <div className="r2">
                  <span className="sy">{K(s.sym + ', ' + (s.exL || tfExOf2(s.ex).name))}</span>
                  <span className="ver">{s.ver}</span>
                </div>
                <div className="r3 num">
                  <span className="cap">
                    {tfTmWon(s.cap)}
                    {s.capShared ? <i title="예산 공용">*</i> : null}
                  </span>
                  <span className={'pnl ' + tfTmSign(c.pnl)}>
                    {s.status === 'live' ? null : <small className="vl">{K('검증')}</small>}
                    {tfTmWonS(c.pnl) + ' '}
                    <small>{tfTmPct(c.pnlPct)}</small>
                  </span>
                </div>
                {s.status === 'err' && s.errMsg ? (
                  <div className="r4">
                    {K(s.errMsg.split('. ')[0] + ' ')}
                    <a
                      onClick={(e) => {
                        e.stopPropagation();
                        tfTmReconnect(s.key);
                      }}
                    >
                      {K('다시 연결')}
                    </a>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

/** tfTmCtlBtn(s): 일시정지, 재개, 지금 시작, 다시 연결 */
function CtlBtn({ s, pv }: { s: TermRow; pv: boolean }) {
  if (s.status === 'live')
    return (
      <button type="button" className="tft-halt" disabled={pv} onClick={() => tfTmSetStatus(s.key, 'off', '일시정지')}>
        {K('일시정지')}
      </button>
    );
  if (s.status === 'off' || s.status === 'ready')
    return (
      <button type="button" className="tft-go" disabled={pv} onClick={() => tfTmSetStatus(s.key, 'live')}>
        {K(s.status === 'off' ? '재개' : '지금 시작')}
      </button>
    );
  return (
    <button type="button" className="tft-go" disabled={pv} onClick={() => tfTmReconnect(s.key)}>
      {K('다시 연결')}
    </button>
  );
}

/** tfTmHelp(): 도움 팝업을 연다 (터미널에서는 떠 있는 단추를 숨겨 두므로 아이콘으로만 연다) */
function tfTmHelp() {
  document.body.classList.add('tm-helpon');
  setState({ helpOpen: true });
}

/** tfDashView() */
export function Terminal() {
  /* 들어올 때마다 차트 구역과 포지션 탭에서 시작한다(원본 tfDashView). 알림 딥링크가 있으면 그 구역을 연다 */
  useState(() => {
    const k = TF_TM.nfh;
    TF_TM.nfh = null;
    TF_TM.mt = k || 'chart';
    TF_TM.pane = k || 'pos';
    return 0;
  });
  useRev();
  useTf();
  const pv = usePreview();
  const list = all();
  /* 기본 선택: 지키던 것 → 가장 최근에 켠 실행 중 전략 → 첫째. 목록에서 사라진 것은 버린다 */
  if (!TF_TM.sel || !list.some((x) => x.key === TF_TM.sel)) {
    const lv = list.filter((x) => x.status === 'live').sort((a, b) => b.at - a.at);
    TF_TM.sel = lv.length ? lv[0].key : list[0] ? list[0].key : null;
  }
  if (pv && !TF_TM.pvBase) TF_TM.pvBase = Date.now(); /* 예시 전략은 고정 기준 시각 */
  const s = list.find((x) => x.key === TF_TM.sel) || null;
  const c = s ? calc(s) : null;
  const empty = !list.length;
  /* 탭의 숫자 배지는 화면을 열 때 한 번 센다 (원본 tfDashView 의 CNT) */
  const [cnt] = useState(() => ({ pos: list.filter((x) => x.status === 'live' && !!calc(x).pos && (TF_TM.scope === 'all' || x.key === TF_TM.sel)).length }));
  /* 차트 종목은 고른 전략을 따른다 (mktMount, tfTmSelect 감싸기) */
  const ss = s ? mktStratSym(s.sym) : null;
  const lastSel = useRef<string | null | undefined>(undefined);
  if (lastSel.current !== TF_TM.sel) {
    mktSync(ss, lastSel.current === undefined);
    lastSel.current = TF_TM.sel;
  }
  const [rw] = useState(() => {
    let rz = 0;
    try {
      rz = parseInt(localStorage.getItem('TETH_TFT_R') || '0', 10) || 0;
    } catch {
      /* 무시 */
    }
    return rz >= 320 && rz <= 560 ? rz : 392;
  });
  const wrap = useRef<HTMLDivElement>(null);

  /* tfTmEvalTick(): 60초마다 실행 중 전략의 평가 시각, 10초마다 「N초 전」 */
  useEffect(() => {
    evalStep(true);
    let n = 0;
    const t = setInterval(() => {
      n++;
      evalStep(n % 6 !== 0 ? true : false);
    }, 10000);
    return () => {
      clearInterval(t);
      document.body.classList.remove('tm-helpon');
    };
  }, []);
  /* 모바일에서 전략이 없으면 「전략 찾기」가 있는 판단 탭을 먼저 */
  useEffect(() => {
    if (mobBrainDone || window.innerWidth > 768 || pv || !empty) return;
    if (TF_TM.mt !== 'brain') {
      mobBrainDone = true;
      setTm({ mt: 'brain' });
    }
  }, [pv, empty]);
  /* 목록 밖을 누르면 전략 목록을 닫는다 (mktRailTgl) */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!TF_TM.railOpen) return;
      const t = e.target as Element;
      if (t.closest && (t.closest('.tft-rail') || t.closest('.mks-btn'))) return;
      setTm({ railOpen: false });
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  /** tfTmReszInit(): 판단 패널 폭 조절. 끄는 동안은 폭만, 놓을 때 저장 */
  const reszDown = (e0: React.PointerEvent<HTMLDivElement>) => {
    const rz = e0.currentTarget;
    const w = wrap.current;
    if (!w) return;
    e0.preventDefault();
    rz.setPointerCapture(e0.pointerId);
    const x0 = e0.clientX;
    const w0 = parseInt(getComputedStyle(w).getPropertyValue('--tftr')) || 392;
    rz.onpointermove = (e2) => w.style.setProperty('--tftr', Math.max(320, Math.min(560, w0 + (x0 - e2.clientX))) + 'px');
    rz.onpointerup = () => {
      rz.onpointermove = null;
      rz.onpointerup = null;
      try {
        localStorage.setItem('TETH_TFT_R', String(parseInt(getComputedStyle(w).getPropertyValue('--tftr')) || 392));
      } catch {
        /* 무시 */
      }
    };
  };

  const st = s ? TF_TM_ST[s.status] || TF_TM_ST.off : null;
  const pnl = s && c ? tfTmPnl(s, c) : null;
  const halt = (
    <button type="button" className="tm-halt" onClick={tfTmHalt} disabled={pv}>
      {K('긴급 정지')}
    </button>
  );
  const refEx = s && s.ex ? { id: s.ex, name: s.exL } : null;
  return (
    <>
      <div
        className={'nfx-page nfxh-page nfxh-wrap tft-page mt-' + TF_TM.mt + (pv ? ' tm-pv' : '') + (s ? '' : ' no-sel') + (TF_TM.railOpen ? ' rail-open' : '')}
        id="nfxh-wrap"
        ref={wrap}
        style={{ ['--tftr' as string]: rw + 'px' }}
      >
        {pv && (
          /* tfTmPreviewBar() */
          <div className="tm-preview">
            <span>{K('데모 체험, 시뮬레이션 데이터입니다')}</span>
            <button
              type="button"
              onClick={() => {
                /* tfPreviewClose() */
                setPreview(false);
                nav('#/trade');
              }}
            >
              {K('내 화면으로')}
            </button>
          </div>
        )}
        <div className="tm-mhead" id="tm-mhead">
          {s && st && (
            <>
              <button type="button" className="tm-mttl" onClick={tfTmDrawer} aria-label="전략 선택">
                {K(s.name + ' ')}
                <i>▾</i>
              </button>
              <span className={'st st-' + st[2]}>{st[0] + ' ' + st[1]}</span>
              {halt}
            </>
          )}
        </div>
        <div className="tm-msummary num" id="tm-msummary">
          {s && c && (
            <>
              <span>{K('운용 ' + tfTmWon(s.cap))}</span>
              <span>
                {K('누적 ')}
                <b className={tfTmSign(c.pnl)}>{tfTmWonS(c.pnl) + ' (' + tfTmPct(c.pnlPct) + ')'}</b>
              </span>
            </>
          )}
        </div>
        <MktHead stratSym={ss} />
        <div className="nfxh-tabs m-only tm-seg">
          {/* tfNFHTab: 구역 탭(차트, 판단)은 하단 pane 을 건드리지 않는다 */}
          <Strip list={MTABS} on={TF_TM.mt} sfx="m" cnt={cnt} pick={(k) => setTm(k === 'chart' || k === 'brain' ? { mt: k } : { mt: k, pane: k })} />
        </div>
        <div className="tft-grid">
          <Rail list={list} pv={pv} />
          <div className="tft-ctx" id="tft-ctx">
            {s && c && st && pnl ? (
              <div className="tm-ctx">
                <div className="tm-c1">
                  <span className="tm-ttl" title={s.name}>
                    {K(s.name)}
                  </span>
                  <KindBadge kind={s.kind || 'rule'} />
                  <span className="dv" />
                  <ExBadge ex={s.ex} />
                  <b className="sy num">{K(s.sym)}</b>
                  <span className="mut">{K(s.exL || tfExOf2(s.ex).name)}</span>
                  <span className="dv" />
                  <span className={'st st-' + st[2]}>{st[0] + ' ' + st[1]}</span>
                  <Flex1 />
                  <button
                    type="button"
                    className="tm-help"
                    onClick={(e) => {
                      e.stopPropagation();
                      tfTmHelp();
                    }}
                    aria-label="도움"
                    title="도움"
                  >
                    ?
                  </button>
                </div>
                <div className="tm-c2">
                  <span className="tm-kv num">
                    <small>{K('운용')}</small>
                    <b>{tfTmWon(s.cap)}</b>
                  </span>
                  <span className="tm-kv num">
                    <small>{K('오늘')}</small>
                    <b className={tfTmSign(Math.abs(pnl.today) < 1 ? 0 : pnl.today)}>{tfTmWonS(pnl.today)}</b>
                  </span>
                  <span className="tm-kv num">
                    <small>{K(s.status === 'ready' ? '검증 누적' : '누적')}</small>
                    <b className={tfTmSign(c.pnl)}>
                      {tfTmWonS(c.pnl) + ' '}
                      <em>{tfTmPct(c.pnlPct)}</em>
                    </b>
                  </span>
                  <Flex1 />
                  <CtlBtn s={s} pv={pv} />
                  {halt}
                </div>
              </div>
            ) : (
              <div className="tm-ctx">
                <span className="mut">{K('전략을 선택하면 여기에 표시됩니다')}</span>
              </div>
            )}
          </div>
          <MktChart stratSym={ss} refEx={refEx} />
          <aside className="tft-brain" id="tft-brain">
            <div className="tft-resz" id="tft-resz" title="패널 폭 조절" onPointerDown={reszDown} />
            <div className="tft-brainin" id="tft-brainin">
              <Brain s={s} c={c} count={list.length} />
            </div>
          </aside>
        </div>
        {/* 전략이 없는 첫 화면에는 「시뮬레이션 데이터입니다」 줄을 두지 않는다 (pxTermEmpty) */}
        <Bottom cnt={cnt} simnote={!pv && !empty} />
      </div>
      {/* 복사한 전략 계정 줄(tfTmFollowHtml)은 전략 복사 조각의 cpCalc 원장이 들어오면 여기에 붙인다 */}
      <TermOverlays />
    </>
  );
}
