// 복사한 전략 상세 (원본 cpxView): 현재 금액과 손익 > 예산 조정, 설정, 복사 중단 > 금액 상세 > 현재 포지션 > 거래 기록과 예산 내역.
// 주소 #/share/c/<cid>[/bal]. 조정, 설정, 중단, 정리 창은 tfSS3Dlg(CopyDlg.tsx) 위에 뜬다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CPX_KIND } from '../../core/share.data';
import { CP_CFG, cpCalc, cpMeta, cpxTrades, openList, type Copy, type CpCalc } from '../../core/copy';
import { idxToDate } from '../../core/engine/data';
import { fuIs, tfSSFind } from '../../core/engine/catalog';
import { cpUsd, mkMD, mkPct0, mkPxFmt, mkTk, tfSSNe } from '../../core/engine/format';
import type { Strat } from '../../core/engine/types';
import { replaceHash } from '../../state/route';
import { useShare } from '../../state/share';
import { setState, toast } from '../../state/store';
import { SS3Dlg } from './CopyDlg';
import { cpAdjCommit, cpFlat, goFollowList, mkStopGo } from './copyActions';
import { goDetail } from './Hub';

/** cpxCls(v) */
const cpxCls = (v: number) => (Math.abs(v) < 0.005 ? '' : v > 0 ? ' u' : ' d');
/** cpxSgn(v,dd) */
const cpxSgn = (v: number, dd?: number) => (v > 0.004 ? '+' : '') + cpUsd(v, dd);
/** cpxDate(ms) */
function cpxDate(ms: number): string {
  const t = new Date(ms);
  return t.getFullYear() + '년 ' + (t.getMonth() + 1) + '월 ' + t.getDate() + '일';
}
/** cpxDot(t) */
const cpxDot = (t: Date) => t.getFullYear() + '. ' + (t.getMonth() + 1) + '. ' + t.getDate() + '.';
/** cpxSide(x) */
const cpxSide = (x: { side?: number; lev?: number }) => ((x.side as number) < 0 ? '숏' : '롱') + ((x.lev as number) > 1 ? ' ' + x.lev + '배' : '');
/** cpxStatus(c2) */
const cpxStatus = (c2: Copy) => (c2.status !== 'active' ? '복사 중단됨' : c2.winding ? '종료 대기' : '복사 중');
/** cpxSym(c2,k) */
function cpxSym(c2: Copy, k?: string): string {
  if (k) return mkTk(k);
  const p = (c2.pairs && c2.pairs[0]) || '';
  return String(p).replace(/\/USDT?$/, '');
}

/** cpxRow(l,ls,r,rs,cls) */
function Row({ l, ls, r, rs, cls }: { l: ReactNode; ls?: ReactNode; r: ReactNode; rs?: ReactNode; cls?: string }) {
  return (
    <div className="cq-row">
      <div className="a">
        <b>{l}</b>
        {ls ? <span>{ls}</span> : null}
      </div>
      <div className="z">
        <b className={'num' + (cls || '')}>{r}</b>
        {rs ? <span className="num">{rs}</span> : null}
      </div>
    </div>
  );
}
/** cpxEmpty(t,s) */
function Empty({ t, s }: { t: string; s?: string }) {
  return (
    <div className="cq-list">
      <div className="cq-row cq-none">
        <div className="a">
          <b>{t}</b>
          {s ? <span>{s}</span> : null}
        </div>
      </div>
    </div>
  );
}

/** cpxPos2(c2,d): 현재 포지션 */
function Pos({ c2, d, s2, onFlat }: { c2: Copy; d: CpCalc; s2: Strat | null; onFlat: () => void }) {
  const on = c2.status === 'active';
  const hd = (n: number, act?: ReactNode) => (
    <div className="cq-sh">
      <h2>{n ? '현재 포지션 ' + n + '건' : '현재 포지션'}</h2>
      {act}
    </div>
  );
  if (!s2 || !d.posOpen || !on)
    return (
      <>
        {hd(0)}
        <Empty t="현재 포지션 없음" s={on ? (c2.winding ? '새 진입을 멈췄습니다. 남은 포지션이 없습니다.' : '') : '복사를 중단해 포지션이 없습니다.'} />
      </>
    );
  const c = s2.cfg || {};
  let list = openList(s2);
  if (d.stopI != null) list = list.filter((x) => x.entry == null || x.entry <= (d.stopI as number)); /* 새 진입을 멈춘 뒤에 원본이 산 종목은 내 포지션이 아니다 */
  const wsum = list.reduce((a, x) => a + (x.w != null ? x.w : 1), 0) || 1;
  const rule = fuIs(s2)
    ? c.trail
      ? '유리한 가격에서 ' + c.trail + '% 되돌리면 종료'
      : c.sl
        ? '진입가에서 ' + c.sl + '% 불리하면 종료'
        : c.exitN
          ? c.exitN + '일 기준선 이탈 때 종료'
          : '방향이 바뀌면 종료'
    : s2.kind === 'agent'
      ? '고점에서 ' + c.trail + '% 밀리면 종료'
      : c.sl != null
        ? '손절 ' + c.sl + '%, 익절 +' + c.tp + '%'
        : '원본과 같은 조건';
  return (
    <>
      {hd(
        list.length || 1,
        <button type="button" className="cq-gray" onClick={onFlat}>
          {c2.winding ? '포지션 정리 후 복사 종료' : '포지션 전체 정리'}
        </button>,
      )}
      <div className="cq-list">
        {list.length ? (
          list.map((x, i) => {
            const w = (x.w != null ? x.w : 1) / wsum;
            const u = d.unreal * w;
            return (
              <Row
                key={i}
                l={cpxSym(c2, x.k) + ' ' + cpxSide(x)}
                ls={
                  <>
                    {'반영 금액 ' + cpUsd(d.invested * w, 0) + ', 진입가 ' + mkPxFmt(x.ep) + ', 현재가 ' + mkPxFmt(x.px)}
                    <br />
                    {rule}
                  </>
                }
                r={cpxSgn(u)}
                rs={'원본 수익률 ' + mkPct0(x.chg as number, 1)}
                cls={cpxCls(u)}
              />
            );
          })
        ) : (
          <Row
            l={cpxSym(c2) + ' 롱'}
            ls={
              <>
                {'반영 금액 ' + cpUsd(d.invested, 0)}
                <br />
                {rule}
              </>
            }
            r={cpxSgn(d.unreal)}
            cls={cpxCls(d.unreal)}
          />
        )}
      </div>
    </>
  );
}

/** cpxTradesTab(c2,d): 거래 기록 */
function TradesTab({ c2, d }: { c2: Copy; d: CpCalc }) {
  const L = cpxTrades(c2, d);
  if (!L.length) return <Empty t="종료된 거래가 없습니다" s="참여한 거래가 종료되면 여기에 표시합니다." />;
  return (
    <div className="cq-list">
      {L.slice(0, 40).map((r, i) => {
        const x = r.x;
        const ex = x.exit != null ? x.exit : x.entry;
        return (
          <details className="cq-row cq-det" key={i}>
            <summary>
              <div className="a">
                <b>{cpxSym(c2, x.asset) + ' ' + cpxSide(x)}</b>
                <span>{cpxDot(idxToDate(ex)) + ' 종료, ' + (CPX_KIND[x.kind] || '종료 조건')}</span>
              </div>
              <div className="z">
                <b className={'num' + cpxCls(r.pnl)}>{cpxSgn(r.pnl)}</b>
                <span className="num">{'원본 수익률 ' + mkPct0(x.pnl * 100, 1)}</span>
              </div>
            </summary>
            <div className="cq-more">
              <span>{'진입 ' + cpxDot(idxToDate(x.entry)) + ', 원본 진입가 ' + mkPxFmt(x.ep)}</span>
              <span>{'원본 종료가 ' + mkPxFmt(x.xp != null ? x.xp : x.ep) + ', 반영 금액 ' + cpUsd(r.inv, 0)}</span>
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** cpxBudgetTab(c2,d): 예산 내역 */
function BudgetTab({ c2, d }: { c2: Copy; d: CpCalc }) {
  const rows = c2.ledger.map((e, ix) => ({ e, ix })).reverse();
  if (!rows.length) return <Empty t="예산 변경이 없습니다" s="" />;
  const when = (r: { e: Copy['ledger'][number]; ix: number }) => {
    const l = (d.lots || [])[r.ix];
    if (r.e.type !== 'add' || !l) return '';
    if (l.inv == null || (d.stopI != null && l.inv > d.stopI)) return c2.status === 'active' && d.stopI == null ? '진입 대기' : '반영 전 회수';
    if (l.inv === l.i) return '즉시 반영';
    return cpxDot(idxToDate(l.inv)) + ' 진입';
  };
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return (
    <div className="cq-list">
      {rows.map((r) => {
        const e = r.e;
        const add = e.type === 'add';
        const t = new Date(e.at);
        return <Row key={r.ix} l={add ? '예산 추가' : '예산 회수'} ls={cpxDot(t) + ' ' + p(t.getHours()) + ':' + p(t.getMinutes())} r={(add ? '+' : '-') + cpUsd(e.amt, e.amt % 1 ? 2 : 0)} rs={when(r)} cls="" />;
      })}
    </div>
  );
}

/** cpAddNote(c2,d): 추가한 금액이 언제 들어가는지 */
function cpAddNote(c2: Copy, d: CpCalc): string {
  const s2 = tfSSFind(c2.nick);
  const st = (s2 && s2.r && s2.r.state) || {};
  if (!s2) return '추가한 금액은 다음 진입부터 반영됩니다.';
  if (s2.kind === 'agent') {
    if (st.open && st.open.length) return '추가한 금액은 바로 지금 비중대로 들어갑니다. 현금 비중도 원본과 같습니다.';
    return '지금은 원본이 ' + (st.scan && st.scan.weak ? '시장이 약해' : '살 종목이 없어') + ' 현금으로 기다립니다. 추가한 금액도 현금으로 있다가 ' + (st.nextEval != null ? mkMD(st.nextEval) + ' 재평가' : '다음 재평가') + ' 때 함께 들어갑니다.';
  }
  if (d.immediate) return st.open ? '추가한 금액은 지금 든 포지션에 바로 들어갑니다.' : '지금은 포지션이 없어서 다음 진입 때 들어갑니다.';
  const n = d.entriesYear || 0;
  return '추가한 금액은 다음 진입부터 반영됩니다. ' + (n ? '이 전략은 최근 1년간 ' + n + '번 진입했습니다 (평균 ' + Math.round(365 / n) + '일에 한 번).' : '이 전략은 최근 1년간 진입이 없었습니다.');
}

/** cpAdjRender(cid), cpAdjSync(cid), cpAdjGo(cid): 예산 조정 창. 손실 구간의 추가는 한 번 더 묻는다 */
function AdjDlg({ c2, d, spot, onClose, onDone }: { c2: Copy; d: CpCalc; spot: number; onClose: () => void; onDone: () => void }) {
  const [dir, setDir] = useState<'add' | 'out'>('add'); /* TF_CPA.dir */
  const [val, setVal] = useState('');
  const [guard, setGuard] = useState<number | null>(null);
  const pnlP = d.myPct * 100;
  const up = pnlP >= 0;
  const sp = d.pnlPct * 100;
  const v = parseFloat(val);
  let msg = '';
  if (val !== '') {
    if (!isFinite(v) || v <= 0) msg = '0보다 큰 금액을 입력해주십시오';
    else if (dir === 'add' && v > spot) msg = '사용 가능 금액보다 큽니다';
    else if (dir === 'out' && v > d.avail + 1e-9) msg = '회수 가능 금액을 넘었습니다';
  }
  const ok = val !== '' && isFinite(v) && v > 0 && !msg;
  const commit = (amt: number, dr: 'add' | 'out') => {
    if (cpAdjCommit(c2.id, amt, dr)) onDone();
  };
  if (guard != null)
    return (
      <SS3Dlg title="잠깐, 손실 구간입니다" onClose={onClose}>
        <div className="ntc">
          이 전략 복사는 지금 <b style={{ color: '#ee766a' }}>{(d.myPct * 100).toFixed(1) + '%'}</b> 손실 중입니다.
          <br />
          손실 후 반복 입금은 수익률을 실제보다 부풀려 보이게 하고, 같은 전략에 위험만 키울 수 있습니다.
          <br />
          그래도 추가하겠습니까?
        </div>
        <div className="acts3" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="obtn"
            onClick={() => {
              setGuard(null);
              setVal('');
            }}
          >
            다시 생각하겠습니다
          </button>
          <button type="button" className="wbtn" onClick={() => commit(guard, 'add')}>
            {cpUsd(guard, 0) + ' 추가하겠습니다'}
          </button>
        </div>
      </SS3Dlg>
    );
  const pick = (x: 'add' | 'out') => {
    setDir(x);
    setVal(''); /* 원본은 방향을 바꾸면 창을 새로 그린다 */
  };
  return (
    <SS3Dlg title={'예산 조정, ' + c2.nick} onClose={onClose}>
      <div className="cpa-pnl">
        내 수익률 <b className={'num ' + (up ? 'u' : 'd')}>{(up ? '+' : '') + pnlP.toFixed(1) + '%'}</b>, 같은 기간 전략 수익률 <b className="num">{(sp >= 0 ? '+' : '') + sp.toFixed(1) + '%'}</b>
        {!up && pnlP <= (CP_CFG.LOSS_GUARD || -0.2) * 100 ? (
          <>
            <br />
            <span style={{ color: '#e8d49a' }}>손실 구간에서 추가 입금은 평균 단가를 낮추지만 위험도 같이 커집니다.</span>
          </>
        ) : null}
      </div>
      <div className="cpa-tgl">
        <button type="button" className={dir === 'add' ? 'on' : ''} onClick={() => pick('add')}>
          예산 추가
        </button>
        <button type="button" className={dir === 'out' ? 'on' : ''} onClick={() => pick('out')}>
          회수
        </button>
      </div>
      <div className="cps-fld" style={{ marginBottom: 6 }}>
        <div className="cps-in">
          <input id="cpa-amt" type="number" inputMode="decimal" placeholder="금액" value={val} onChange={(e) => setVal(e.target.value)} />
          <span className="un">USD</span>
          <button type="button" className="mx" onClick={() => setVal(String(dir === 'add' ? spot : Math.floor(d.avail * 100) / 100))}>
            최대
          </button>
        </div>
        <div className="cps-bal">
          {dir === 'add' ? '추가 가능 ' : '회수 가능 '}
          <b className="num">{cpUsd(dir === 'add' ? spot : d.avail, 2)}</b>
        </div>
        <div className="cps-err" id="cpa-err" style={{ display: 'block', color: '#ee9a91' }}>
          {msg}
        </div>
      </div>
      <div className="cpa-note">{dir === 'add' ? cpAddNote(c2, d) : '포지션에 잡혀 있는 금액은 회수할 수 없습니다.'}</div>
      <div className="acts3" style={{ marginTop: 16 }}>
        <button type="button" className="obtn" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="wbtn"
          id="cpa-go"
          disabled={!ok}
          onClick={() => {
            if (!ok) return;
            /* 보호 장치: 손실 -20% 이하에서 추가 입금은 확인을 한 번 더 */
            if (dir === 'add' && d.myPct <= (CP_CFG.LOSS_GUARD || -0.2)) setGuard(v);
            else commit(v, dir);
          }}
        >
          확인
        </button>
      </div>
    </SS3Dlg>
  );
}

type DlgKind = null | 'adj' | 'edit' | 'stop' | 'flat';

export function CopyDetail({ cid, tab: tabProp }: { cid: string; tab: string }) {
  const c2 = useShare((s) => s.cp.copies.find((x) => x.id === cid) || null);
  const spot = useShare((s) => s.cp.spot);
  /* 탭은 둘이다: 거래 기록(tr), 예산 내역(bal). 예전 주소의 pos, hist, share, tx 는 거래 기록으로 */
  const [tab, setTab] = useState(tabProp === 'bal' ? 'bal' : 'tr');
  const [dlg, setDlg] = useState<DlgKind>(null);
  const gone = useRef(false);
  useEffect(() => {
    setTab(tabProp === 'bal' ? 'bal' : 'tr');
  }, [tabProp]);
  /* 기록이 없으면 복사한 전략 목록으로 */
  useEffect(() => {
    if (c2 || gone.current) return;
    gone.current = true;
    toast('전략 복사 기록을 찾을 수 없습니다');
    goFollowList();
  }, [c2]);
  if (!c2) return null;

  const d = cpCalc(c2);
  const m = cpMeta(c2.nick);
  const ne = tfSSNe(c2.nick);
  const on = c2.status === 'active';
  const s2 = tfSSFind(c2.nick);
  const title = s2 ? s2.name : c2.nick;
  /* 한 줄 설명: 상태에 따라 하나 */
  const line = !on ? cpxDate(c2.closedAt || c2.at) + '에 복사를 중단했습니다.' : c2.winding ? '새 진입을 멈췄습니다. 열린 포지션은 ' + (c2.stopMode === 'wait' ? '원본 전략이 종료할 때 함께 정리합니다.' : '직접 정리할 때까지 남아 있습니다.') : cpxDate(c2.at) + '부터 복사 중입니다.';
  /* 원본 비교: 원인을 단정하지 않는다 */
  const showCmp = !d.missing && d.grossIn > 0;
  const why = on && d.waiting > 0.005 ? '원본 전략이 다음에 진입하면 예산 ' + cpUsd(d.waiting, 0) + '을 반영합니다.' : Math.abs((d.myPct - d.pnlPct) * 100) >= 1 ? '내 수익률에는 예산을 넣고 뺀 시점이 반영됩니다.' : '';
  const det: [string, number, number][] = ([['회수 가능 금액', d.avail, 0]] as [string, number, number][])
    .concat(on && d.waiting > 0.005 ? [['진입 대기 금액', d.waiting, 0]] : [])
    .concat([
      ['미실현 손익', d.unreal, 1],
      ['실현 손익', d.realized, 1],
    ])
    .concat(m.share > 0 ? [['수익 분배 지급', d.share, 0]] : [])
    .concat([['넣은 금액', d.inv, 0]]);
  /** cpDetailView(cid,tab): 다시 그리고 맨 위로 */
  const view = (t: string) => {
    setDlg(null);
    setTab(t);
    const sc = document.getElementById('g-scroll');
    if (sc) sc.scrollTop = 0;
  };
  /** cpxTab(cid,tab) */
  const pickTab = (t: string) => {
    setTab(t);
    replaceHash('#/share/c/' + cid + (t === 'bal' ? '/bal' : ''));
  };
  const close = () => setDlg(null);

  return (
    <div className="tf-page cq-page cpx">
      <button type="button" className="cq-back" onClick={goFollowList}>
        ← 복사한 전략
      </button>
      <header className="cq-hd">
        <h1>{title}</h1>
        <p>
          {line + ' '}
          {/* cpProfileGo(ne) */}
          <button type="button" className="pl-link" onClick={() => goDetail(ne, null, 'ov')}>
            원본 전략 보기
          </button>
        </p>
      </header>
      {d.missing ? (
        <p className="cq-why">{'전략 기록을 불러올 수 없습니다. 넣은 금액 ' + cpUsd(d.inv, 0) + '은 그대로 있습니다.'}</p>
      ) : (
        <section className="cq-hero">
          <small>
            현재 금액 <i>{cpxStatus(c2)}</i>
          </small>
          <div className="big num">{cpUsd(d.est)}</div>
          <div className="cq-pl">
            <span>
              총손익 <b className={'num' + cpxCls(d.net)}>{cpxSgn(d.net)}</b>
            </span>
            <span>
              내 수익률 <b className={'num' + cpxCls(d.myPct)}>{mkPct0(d.myPct * 100, 1)}</b>
            </span>
          </div>
          {showCmp ? (
            <>
              <p className="cq-cmp">
                같은 기간 원본 수익률 <b className={'num' + cpxCls(d.pnlPct)}>{mkPct0(d.pnlPct * 100, 1)}</b>
              </p>
              {why ? <p className="cq-why">{why}</p> : null}
            </>
          ) : null}
        </section>
      )}
      {on && !c2.winding ? (
        <div className="cq-acts">
          <button type="button" className="cq-cta" onClick={() => setDlg('adj')}>
            예산 조정
          </button>
          <button type="button" className="pl-link" onClick={() => setDlg('edit')}>
            설정
          </button>
          {/* cpCloseDlg(cid) */}
          <button type="button" className="pl-link" onClick={() => setDlg('stop')}>
            복사 중단
          </button>
        </div>
      ) : on && c2.winding ? (
        <div className="cq-acts">
          <button type="button" className="cq-cta" onClick={() => setDlg('flat')}>
            포지션 정리 후 복사 종료
          </button>
        </div>
      ) : null}
      {d.missing ? null : (
        <details className="cq-amt">
          <summary>금액 상세</summary>
          <div className="cq-list">
            {det.map((r) => (
              <Row key={r[0]} l={r[0]} r={r[2] ? cpxSgn(r[1]) : cpUsd(r[1])} cls={r[2] ? cpxCls(r[1]) : ''} />
            ))}
          </div>
        </details>
      )}
      <section className="cq-sec">
        <Pos c2={c2} d={d} s2={s2} onFlat={() => setDlg('flat')} />
      </section>
      <section className="cq-sec">
        <div className="cq-tabs" role="tablist">
          {(
            [
              ['tr', '거래 기록'],
              ['bal', '예산 내역'],
            ] as [string, string][]
          ).map((t2) => (
            <button key={t2[0]} type="button" role="tab" aria-selected={tab === t2[0]} className={tab === t2[0] ? 'on' : ''} onClick={() => pickTab(t2[0])}>
              {t2[1]}
            </button>
          ))}
        </div>
        <div id="cq-tabb">{tab === 'bal' ? <BudgetTab c2={c2} d={d} /> : <TradesTab c2={c2} d={d} />}</div>
      </section>
      <p className="cq-help">
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

      {dlg === 'adj' && on ? <AdjDlg c2={c2} d={d} spot={spot} onClose={close} onDone={() => view('bal')} /> : null}
      {/* cpEditSheet(cid) */}
      {dlg === 'edit' ? (
        <SS3Dlg title="복사 설정" onClose={close}>
          <div className="cq-list cq-dlg">
            <Row l="복사 방식" r="원본 비율" cls="" />
            <Row l="시작일" r={cpxDot(new Date(c2.at))} cls="" />
            <Row l="따라갈 종목" r={(c2.pairs || []).map((p) => String(p).replace(/\/USDT?$/, '')).join(', ')} cls="" />
            <Row l="손실 중단 기준" r={Math.abs((c2.adv && c2.adv.maxLoss) || -20) + '%'} cls="" />
          </div>
          <p className="cq-why" style={{ margin: '14px 0 0' }}>
            손실 중단 기준은 복사를 중단한 뒤 다시 시작할 때 바꿀 수 있습니다.
          </p>
          <div className="acts3" style={{ marginTop: 18 }}>
            <button type="button" className="obtn" onClick={close}>
              닫기
            </button>
            <button type="button" className="wbtn" onClick={() => setDlg(on ? 'adj' : null)}>
              예산 조정
            </button>
          </div>
        </SS3Dlg>
      ) : null}
      {/* mkStopDlg(cid): 중단 세 갈래 */}
      {dlg === 'stop' && on ? (
        <SS3Dlg title={'전략 복사 중단, ' + c2.nick} onClose={close}>
          <div className="ntc">어떻게 정리할지 골라주십시오. 어떤 선택이든 새 진입은 바로 멈춥니다.</div>
          <div className="cpd-kv" style={{ margin: '0 0 14px' }}>
            <div>
              <small>순손익</small>
              <b className={'num ' + (d.net >= 0 ? 'u' : 'd')}>{cpUsd(d.net)}</b>
            </div>
            <div>
              <small>돌려받을 예산</small>
              <b className="num">{cpUsd(Math.max(0, d.est))}</b>
            </div>
          </div>
          <div className="mk-stop">
            {(
              [
                ['now', '지금 정리', d.posOpen ? '열린 포지션을 현재가로 정리하고 예산을 바로 돌려받습니다' : '열린 포지션이 없습니다. 예산을 바로 돌려받습니다'],
                ['wait', '원본 청산 대기', '새 진입은 멈추고, 열린 포지션은 원본 전략이 청산할 때 함께 정리합니다'],
                ['manual', '직접 관리', '새 진입은 멈추고, 열린 포지션은 내가 직접 정리합니다'],
              ] as [string, string, string][]
            ).map((o) => (
              <button
                key={o[0]}
                type="button"
                className="mk-stop-o"
                onClick={() => {
                  setDlg(null);
                  if (mkStopGo(cid, o[0])) view('tr');
                }}
              >
                <b>{o[1]}</b>
                <span>{o[2]}</span>
              </button>
            ))}
          </div>
          <div className="acts3" style={{ marginTop: 14 }}>
            <button type="button" className="obtn" style={{ width: '100%' }} onClick={close}>
              계속 전략 복사
            </button>
          </div>
        </SS3Dlg>
      ) : null}
      {/* cpFlatDlg(cid) */}
      {dlg === 'flat' ? (
        <SS3Dlg title={c2.winding ? '포지션 정리하고 끝내기' : '포지션 전체 정리'} onClose={close}>
          <div className="ntc">
            열려 있는 전략 복사 포지션을 현재가로 정리합니다.
            <br />
            {'미실현 ' + cpUsd(d.unreal) + '이 실현 손익으로 확정되고, ' + (c2.winding ? '전략 복사를 끝내고 예산을 돌려받습니다.' : '전략 복사는 유지되어 다음 진입부터 다시 따라갑니다.')}
          </div>
          <div className="acts3" style={{ marginTop: 16 }}>
            <button type="button" className="obtn" onClick={close}>
              취소
            </button>
            <button
              type="button"
              className="ss3-dbtn"
              onClick={() => {
                setDlg(null);
                if (cpFlat(cid)) view('tr');
              }}
            >
              정리하기
            </button>
          </div>
        </SS3Dlg>
      ) : null}
    </div>
  );
}
