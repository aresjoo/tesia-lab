// 터미널에 복사한 전략을 보이는 곳들. 원본은 뒤쪽 스크립트가 터미널 함수를 여러 번 감싸 복사한 전략을 끼운다:
// 판단 패널(pxTermSide, tbCopyBlock 과 sk-brain3, sk-brain4 의 덮어쓰기), 차트 종목(mktStratSym 감싸기 둘),
// 시세 출처 한 줄(mktRefNote 최종본), 아래 표(cpxTermRows 와 손익률 고침), 숨은 복사 계정 줄(tfTmFollowHtml).
// 여기는 그 감싸기를 다 거친 마지막 모양이다. 계산은 전략 복사의 원장(core/copy.ts 의 cpCalc, cpxTrades)을 그대로 쓴다.
import type { ReactNode } from 'react';
import { acConnList, acName, acS } from '../../../core/account/ac';
import { MK_KIND } from '../../../core/engine/catalog.data';
import { fuIs, tfSSFind } from '../../../core/engine/catalog';
import { mkChatMsgs, mkChatNow, type ChatMsg } from '../../../core/engine/chat';
import { idxToDate } from '../../../core/engine/data';
import { cpUsd, mkJ, mkMD, mkPct0, mkPxFmt, mkTk } from '../../../core/engine/format';
import type { Strat } from '../../../core/engine/types';
import { cpCalc, cpxTrades, openList, type Copy } from '../../../core/copy';
import { fmtDate } from '../../../core/trade/engine';
import { brainText, sktText as K } from '../../../core/trade/text';
import { cpDetailGo, tfBackToChat, tfShareHub } from '../bridge';
import { getTf } from '../store';
import { ExBadge, TbIcon, tfExOf2, Thought } from './parts';
import { setTm, TF_TM } from './tm';

type Bt = (t: string) => string;
/** 판단 패널 안의 글자 (tbText). 복사한 전략은 고른 전략이 아니므로 보유 문구 고침(mktHoldFix)은 타지 않는다 */
const B: Bt = (t) => brainText(t, false);
const mkList = (a: string[]) => a.join(', ');

/** cpState().copies 가운데 진행 중인 것 */
export function activeCopies(): Copy[] {
  const cp = (getTf() as unknown as { cp?: { copies?: Copy[] } }).cp;
  const L = (cp && Array.isArray(cp.copies) && cp.copies) || [];
  return L.filter((c) => c.status === 'active');
}
/** 판단 패널이 보이는 복사 전략 (원본 전략 기록이 있는 것만) */
const actFound = () => activeCopies().filter((c) => !!tfSSFind(c.nick));
/** mkTitle(s) */
const mkTitle = (s: Strat) => s.name || s.nick;

/** mktStratSym 감싸기 둘: 고른 전략이 없을 때 진행 중인 첫 복사의 거래쌍, 묶음이면 고른 복사 전략이 들고 있는 첫 종목 */
export function copyStratSym(): string | null {
  try {
    const c = activeCopies()[0];
    if (!c) return null;
    const m = String((c.pairs && c.pairs[0]) || '').replace(/[/\-\s]/g, '').toUpperCase();
    if (/^[A-Z0-9]+USDT$/.test(m)) return m;
  } catch {
    /* 무시 */
  }
  try {
    const act = actFound();
    const c = act[Math.min(TF_TM.cp, act.length - 1)];
    if (!c) return null;
    const L = openList(tfSSFind(c.nick));
    if (L.length) {
      const m = String(mkTk(L[0].k)).toUpperCase() + 'USDT';
      return /^[A-Z0-9]+USDT$/.test(m) ? m : null;
    }
  } catch {
    /* 무시 */
  }
  return null;
}
/** mktRefNote 최종본: 고른 전략이 없으면 진행 중인 복사가 도는 거래소(연결한 첫 거래소, 없으면 Bitget) */
export function copyRefEx(): { id: string; name: string } | null {
  if (!activeCopies().length) return null;
  const id = acConnList()[0] || 'bitget';
  return { id, name: acName(id) || id };
}

/* ── 판단 패널 ── */
/** tbRow(k,v) */
const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="tb-r">
    <span>{B(k)}</span>
    <b className="num">{children}</b>
  </div>
);
const pcCls = (pc: number) => (pc > 0.05 ? 'u' : pc < -0.05 ? 'd' : 'z');
/** tbPnl(x): 선물은 넣은 돈 기준 손익, 현물은 가격 변화 */
const tbPnl = (x: { pnl?: number; fut?: number; chg?: number }) => (x.pnl != null && x.fut ? +x.pnl : +(x.chg || 0));
/** tbRuleTxt(s2) */
function tbRuleTxt(s2: Strat): string {
  const c = s2.cfg || {};
  if (fuIs(s2)) return c.trail ? '유리한 가격에서 ' + c.trail + '% 되돌리면' : c.sl ? '진입가에서 ' + c.sl + '% 불리하면' : '재평가에서 방향이나 순위가 바뀌면';
  if (s2.kind === 'agent') return '고점 대비 -' + c.trail + '%, 재평가 순위 하락';
  return c.sl != null ? '손절 ' + c.sl + '%, 익절 +' + c.tp + '%' : '';
}
/** tbTitle(s2) + tbFirst */
function tbTitle(s2: Strat): string {
  const st = (s2.r && s2.r.state) || {};
  const L = openList(s2);
  const fut = fuIs(s2);
  if (L.length) {
    if (fut && L.length === 1) return mkTk(L[0].k) + ' ' + ((L[0].side as number) < 0 ? '숏' : '롱') + ' 포지션을 보유하고 있습니다';
    if (fut) return mkJ(mkList(L.map((x) => mkTk(x.k) + ((x.side as number) < 0 ? ' 숏' : ' 롱'))), '을', '를') + ' 보유하고 있습니다';
    return mkJ(mkList(L.map((x) => mkTk(x.k))), '을', '를') + ' 보유하고 있습니다';
  }
  if (s2.kind === 'mix' && st.pick) return mkTk(st.pick) + ' 진입 신호를 기다리고 있습니다';
  return '현금으로 기다리고 있습니다';
}
/** tbHoldRows(s2) 최종본 */
function HoldRows({ s2 }: { s2: Strat }) {
  const st = (s2.r && s2.r.state) || {};
  const L = openList(s2);
  const fut = fuIs(s2);
  let wsum = 0;
  const rows: ReactNode[] = L.map((x, i) => {
    const pc = tbPnl(x);
    const side = fut ? ((x.side as number) < 0 ? ' 숏' : ' 롱') + ((x.lev as number) > 1 ? ' ' + x.lev + '배' : '') : ' 보유';
    const w = x.w != null && L.length > 1 ? Math.round(x.w * 100) : null;
    if (w != null) wsum += w;
    return (
      <Row k={mkTk(x.k) + side} key={'p' + i}>
        {w != null && (
          <>
            <span className="tb-w2">{B('비중 ' + w + '%')}</span>{' '}
          </>
        )}
        <i className={pcCls(pc)}>{mkPct0(pc, 1)}</i>
      </Row>
    );
  });
  if (L.length > 1 && wsum < 98)
    rows.push(
      <Row k="현금" key="cash">
        <span className="tb-w2">{B('비중 ' + Math.max(0, 100 - wsum) + '%')}</span>
      </Row>,
    );
  if (!L.length)
    rows.push(
      <Row k="포지션" key="none">
        {B('없음')}
      </Row>,
    );
  if (s2.kind === 'mix' && !L.length && st.pick)
    rows.push(
      <Row k="선정 종목" key="pick">
        {B(mkTk(st.pick))}
      </Row>,
    );
  rows.push(
    <Row k="정리 기준" key="rule">
      {B(tbRuleTxt(s2))}
    </Row>,
  );
  return <>{rows}</>;
}
/** tbCopyThought(s2) (선물 AI 판단은 정리 기준 문장으로) */
function tbCopyThought(s2: Strat): string {
  const st = (s2.r && s2.r.state) || {};
  const L = openList(s2);
  const c = s2.cfg || {};
  const fut = fuIs(s2);
  let rest = '';
  try {
    rest = mkChatNow(s2, s2.r) || '';
  } catch {
    /* 무시 */
  }
  const tail = rest ? ' ' + rest : '';
  if (fut && s2.kind === 'agent') {
    const nm = mkList(L.map((x) => mkTk(x.k) + ((x.side as number) < 0 ? ' 숏' : ' 롱')));
    return (L.length ? '저는 ' + mkJ(nm, '을', '를') + ' 유지합니다. ' + tbRuleTxt(s2) + ' 정리합니다.' : '저는 지금 현금으로 기다립니다. 다음 재평가에서 방향이 정해지면 진입합니다.') + tail;
  }
  const nm = mkList(L.map((x) => mkTk(x.k) + (fut ? ((x.side as number) < 0 ? ' 숏' : ' 롱') : '')));
  const a = L.length ? '저는 ' + mkJ(nm, '을', '를') + ' 유지합니다.' : '저는 지금 현금으로 기다립니다.';
  const when = (st.nextEval != null ? mkMD(st.nextEval) + ' ' : '다음 ') + '재평가에서 ';
  const b =
    s2.kind === 'agent'
      ? L.length
        ? '보유 종목이 고점 대비 ' + c.trail + '% 밀리거나 ' + when + '순위가 밀리면 정리합니다.'
        : when + '기준을 넘는 종목이 있으면 진입합니다.'
      : L.length
        ? tbRuleTxt(s2) + ' 정리합니다.'
        : '신호가 켜지고 시장 확인을 통과하는 날에만 진입합니다.';
  return a + ' ' + b + tail;
}
/** tbNextClose(): 일봉 마감(한국 시간 09:00) 기준 다음 판단 날짜 */
function tbNextClose(): string {
  const n = new Date();
  const k = new Date(n.getTime() + 9 * 3600e3);
  let d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 0, 0, 0));
  if (k.getUTCHours() >= 9) d = new Date(d.getTime() + 864e5);
  return d.getUTCMonth() + 1 + '월 ' + d.getUTCDate() + '일 09:00';
}
/** tbSent(t,n) */
function tbSent(t: string, n: number): { head: string; rest: string } {
  const a = String(t || '').split(/(?<=\.)\s+/);
  if (a.length <= n) return { head: t, rest: '' };
  return { head: a.slice(0, n).join(' '), rest: a.slice(n).join(' ') };
}
/** tbFeed(msgs) 최종본: 꼬리표 중립색, 펼치면 판단 전문 (닫힘과 열림 글자는 CSS) */
function Feed({ msgs }: { msgs: ChatMsg[] }) {
  const L = msgs.filter((m) => m.k !== 'now' && m.k !== 'intro');
  if (!L.length) return null;
  const fix = (x: string) =>
    String(x || '')
      .replace(/ ([\d,.$]+)을\(를\) 넘음\.?/g, ' $1를 넘었습니다.')
      .replace(/([가-힣A-Z]+), 종가가 최근 20일 최고가/g, '$1 종가가 최근 20일 최고가인');
  return (
    <div className="tb-feed">
      <p className="tb-fh">{B('판단 기록')}</p>
      {L.map((m, i) => {
        const s = tbSent(fix(m.t), 2);
        return (
          <details className="tb-fc" key={i}>
            <summary>
              <span className="tb-ft num">{B(m.ts || '')}</span>
              <b>{B((m.tag || '') + ((m.cnt as number) > 1 ? ' ' + m.cnt + '회' : ''))}</b>
              <span className="tb-fs">
                {B(s.head)}
                {s.rest && (
                  <>
                    {' '}
                    <u className="tb-fx" aria-hidden="true" />
                  </>
                )}
              </span>
            </summary>
            {s.rest && <p className="tb-fr">{B(s.rest)}</p>}
          </details>
        );
      })}
    </div>
  );
}
/** tbCopyBlock(c2) 최종본 */
function CopyBlock({ c2 }: { c2: Copy }) {
  const s2 = tfSSFind(c2.nick);
  if (!s2 || !s2.r) return null;
  const st = s2.r.state || {};
  const id = acConnList()[0] || 'bitget';
  const ex = acName(id) || id;
  const nx = st.nextEval != null ? '다음 판단 ' + mkMD(st.nextEval) + ' 09:00' : '다음 판단 ' + tbNextClose();
  let msgs: ChatMsg[] = [];
  try {
    msgs = mkChatMsgs(s2, s2.r, 6) || [];
  } catch {
    /* 무시 */
  }
  let now: string | null = null;
  try {
    now = mkChatNow(s2, s2.r) || null;
  } catch {
    /* 무시 */
  }
  if (!now) {
    const m = msgs.filter((x) => x.k === 'now')[0];
    now = m ? m.t : null;
  }
  const kind = s2.kind === 'agent' ? 'AI 판단' : s2.kind === 'mix' ? '혼합 전략' : '차트 규칙';
  return (
    <>
      <div className="tm-status tb st-live">
        <p className="tb-k">
          {B(mkTitle(s2))}
          <span>{B(kind + ', 복사한 전략')}</span>
        </p>
        <h3 className="tb-t">{B(tbTitle(s2))}</h3>
        <p className="tb-d">
          <TbIcon id={id} />
          <span>{B(ex + '에서 운용 중, ' + nx)}</span>
        </p>
        <div className="tb-list">
          <HoldRows s2={s2} />
        </div>
      </div>
      {/* 생각은 원본 전략에 지금 판단 문장이 있을 때만 (감싸기가 있는 생각 칸을 바꿔 끼운다) */}
      {now && <Thought t={tbCopyThought(s2)} B={B} />}
      <Feed msgs={msgs} />
      <div className="tb-foot">
        <button type="button" className="cq-gray tb-gray" onClick={() => cpDetailGo(c2.id)}>
          {B('복사 관리')}
        </button>
        <button type="button" className="pl-link" onClick={() => tfShareHub()}>
          {B('전략 더 찾기')}
        </button>
      </div>
    </>
  );
}
/** pxTermSide(): 내 전략이 없을 때의 오른쪽 칸. 복사한 전략이 있으면 그 전략의 판단 화면, 둘 이상이면 위에 고르는 단추 */
export function TermSide() {
  const act = actFound();
  if (act.length) {
    if (TF_TM.cp >= act.length) TF_TM.cp = 0;
    return (
      <div className="tb-copy">
        {act.length > 1 && (
          <div className="tb-cps">
            {act.map((c, i) => {
              const s = tfSSFind(c.nick);
              return (
                <button type="button" key={c.id} className={i === TF_TM.cp ? 'on' : ''} onClick={() => setTm({ cp: i })}>
                  {B(s ? mkTitle(s) : c.nick)}
                </button>
              );
            })}
          </div>
        )}
        <CopyBlock c2={act[TF_TM.cp]} />
      </div>
    );
  }
  const cps = activeCopies();
  if (!cps.length)
    return (
      <div className="px-tbrain">
        <b>{B('실행 중인 전략이 없습니다')}</b>
        <span>{B('전략을 고르면 TETH의 판단과 주문이 여기에 표시됩니다.')}</span>
        <button type="button" className="pl-cta pl-cta-w" onClick={() => tfShareHub()}>
          {B('전략 찾기')}
        </button>
        <button type="button" className="pl-link" onClick={tfBackToChat}>
          {B('새 전략 만들기')}
        </button>
      </div>
    );
  return (
    <div className="px-tbrain">
      <b>{B('복사한 전략 ' + cps.length + '개가 실행 중입니다')}</b>
      <div className="px-tcps">
        {cps.map((c) => {
          const d = cpCalc(c);
          const s = tfSSFind(c.nick);
          return (
            <div className="r" key={c.id}>
              <div>
                <b>{B(s ? mkTitle(s) : c.nick)}</b>
                <span className="num">
                  {B('운용 ' + cpUsd(d.inv, 0) + ', 순손익 ')}
                  <i className={d.net >= 0 ? 'mk-up' : 'mk-dn'}>{cpUsd(d.net)}</i>
                </span>
              </div>
              <button type="button" className="pl-link" onClick={() => cpDetailGo(c.id)}>
                {B('관리')}
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="pl-link" onClick={() => tfShareHub()}>
        {B('전략 더 찾기')}
      </button>
    </div>
  );
}

/* ── 아래 표 ── */
const cpxSgn = (v: number, dd?: number) => (v > 0.004 ? '+' : '') + cpUsd(v, dd);
/** cpxSym(c2,k) */
function cpxSym(c2: Copy, k?: string): string {
  if (k) return mkTk(k);
  const p = (c2.pairs && c2.pairs[0]) || '';
  return String(p).replace(/\/USDT?$/, '');
}
/** cpxPxStop(s2,x) */
function cpxPxStop(s2: Strat, x: { ep?: number; side?: number }): number | null {
  const c = s2.cfg || {};
  const sl = c.sl != null ? c.sl : null;
  if (sl == null || !x.ep) return null;
  const a = Math.abs(sl) / 100;
  return (x.side as number) < 0 ? x.ep * (1 + a) : x.ep * (1 - a);
}
/** cpxPxTp(s2,x) */
function cpxPxTp(s2: Strat, x: { ep?: number }): number | null {
  const c = s2.cfg || {};
  const tp = c.tp != null ? c.tp : null;
  if (tp == null || !x.ep || fuIs(s2)) return null;
  return x.ep * (1 + Math.abs(tp) / 100);
}
/** cpxSd(side,buy): 원본처럼 BUY, SELL 글자를 터미널 글자 규칙에 맡긴다 */
const Sd = ({ buy }: { buy: boolean }) => (buy ? <span className="sd lg">{K('BUY')}</span> : <span className="sd sh">{K('SELL')}</span>);
const Dir = ({ sh }: { sh: boolean }) => (sh ? <span className="sd sh">SHORT</span> : <span className="sd lg">LONG</span>);
/** cpxTermEx(): 연결한 첫 거래소 (tfTmCellEx) */
function CellEx() {
  let ex = 'bitget';
  try {
    const k = Object.keys(acS().conn || {})[0];
    if (k) ex = k;
  } catch {
    /* 무시 */
  }
  return (
    <>
      <ExBadge ex={ex} sm />
      {' ' + tfExOf2(ex).name}
    </>
  );
}
/** cpxTermRows(k): 진행 중인 복사의 열린 포지션과 내 돈이 들어간 거래. 거래소를 연결했고 전체 전략이거나 고른 전략이 없을 때만 */
export function cpxTermRows(k: string): ReactNode[] {
  const out: ReactNode[] = [];
  try {
    if (!getTf().api) return out;
    if (TF_TM.sel && TF_TM.scope !== 'all') return out;
    activeCopies().forEach((c2) => {
      const s2 = tfSSFind(c2.nick);
      if (!s2) return;
      const d = cpCalc(c2);
      if (d.missing) return;
      const st = (
        <>
          <a className="stlk" onClick={() => cpDetailGo(c2.id)}>
            {K(mkTitle(s2))}
          </a>{' '}
          <span className="mut">{K('복사')}</span>
        </>
      );
      const sym = (kk?: string) => K(cpxSym(c2, kk) + 'USDT');
      if (k === 'pos' || k === 'open') {
        if (!d.posOpen) return;
        let list = openList(s2);
        if (d.stopI != null) list = list.filter((x) => x.entry == null || x.entry <= (d.stopI as number));
        const wsum = list.reduce((a, x) => a + (x.w != null ? x.w : 1), 0) || 1;
        list.forEach((x, i) => {
          const w = (x.w != null ? x.w : 1) / wsum;
          const amt = d.invested * w;
          const qty = x.ep ? (amt * (x.lev || 1)) / x.ep : 0;
          const u = d.unreal * w;
          const sp = cpxPxStop(s2, x);
          const tp = cpxPxTp(s2, x);
          const key = c2.id + ':' + i;
          const sh = (x.side as number) < 0;
          if (k === 'pos') {
            /* 손익률은 넣은 돈 기준 (선물은 판단 패널과 같은 값) */
            const pv = x.fut && x.pnl != null ? +x.pnl : +(x.chg || 0);
            out.push(
              <tr key={key}>
                <td>
                  <CellEx />
                </td>
                <td>{st}</td>
                <td className="num">{sym(x.k)}</td>
                <td>
                  <Dir sh={sh} />
                </td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td className="r num">{mkPxFmt(x.ep)}</td>
                <td className="r num">{mkPxFmt(x.px)}</td>
                <td className="r num">{sp ? mkPxFmt(sp) : '-'}</td>
                <td className={'r num ' + (u >= 0 ? 'u' : 'd')}>{cpxSgn(u)}</td>
                <td className={'r num ' + (pv >= 0 ? 'u' : 'd')}>{mkPct0(pv, 1)}</td>
                <td className="r">
                  <button className="tbtn" onClick={() => cpDetailGo(c2.id)}>
                    {K('정리')}
                  </button>
                </td>
              </tr>,
            );
          } else {
            const row = (kk: string, buy: boolean, ty: string, px: number) => (
              <tr key={key + kk}>
                <td>
                  <CellEx />
                </td>
                <td>{st}</td>
                <td className="num">{sym(x.k)}</td>
                <td>
                  <Sd buy={buy} />
                </td>
                <td>{K(ty)}</td>
                <td className="r num">{mkPxFmt(px)}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td>{K('대기')}</td>
                <td className="r">
                  <span className="mut">{K('원본 규칙 주문')}</span>
                </td>
              </tr>
            );
            if (sp) out.push(row('s', sh, '손절 STOP', sp));
            if (tp) out.push(row('t', false, '익절 LIMIT', tp));
          }
        });
        return;
      }
      cpxTrades(c2, d)
        .slice(0, k === 'closed' ? 10 : 8)
        .forEach((r, i) => {
          const x = r.x;
          const sh = (x.side as number) < 0;
          const ep = x.ep as number;
          const qty = ep ? (r.inv * (x.lev || 1)) / ep : 0;
          const xp = x.xp != null ? x.xp : ep;
          const fee = x.cost ? (r.inv * (x.fee || 0)) / x.cost : 0;
          const ty = ({ sl: '손절 STOP', tp: '익절 LIMIT' } as Record<string, string>)[x.kind] || '시장가';
          const key = c2.id + ':' + i;
          const head = (at: number) => (
            <>
              <td>
                <CellEx />
              </td>
              <td>{st}</td>
              <td className="num">{K(fmtDate(idxToDate(at)))}</td>
              <td className="num">{sym(x.asset)}</td>
            </>
          );
          if (k === 'orders') {
            out.push(
              <tr key={key + 'x'}>
                {head(x.exit)}
                <td>
                  <Sd buy={sh} />
                </td>
                <td>{K(ty)}</td>
                <td className="r num">{mkPxFmt(xp)}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td>
                  <span className="okst">{K('체결 완료')}</span>
                </td>
              </tr>,
              <tr key={key + 'e'}>
                {head(x.entry)}
                <td>
                  <Sd buy={!sh} />
                </td>
                <td>{K('진입 시장가')}</td>
                <td className="r num">{mkPxFmt(ep)}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td>
                  <span className="okst">{K('체결 완료')}</span>
                </td>
              </tr>,
            );
          } else if (k === 'fills') {
            out.push(
              <tr key={key + 'x'}>
                {head(x.exit)}
                <td>
                  <Sd buy={sh} />
                </td>
                <td className="r num">{mkPxFmt(xp)}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td className="r num">{cpUsd(fee / 2)}</td>
              </tr>,
              <tr key={key + 'e'}>
                {head(x.entry)}
                <td>
                  <Sd buy={!sh} />
                </td>
                <td className="r num">{mkPxFmt(ep)}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td className="r num">{cpUsd(fee / 2)}</td>
              </tr>,
            );
          } else if (k === 'closed') {
            out.push(
              <tr key={key} onClick={() => cpDetailGo(c2.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <CellEx />
                </td>
                <td>{st}</td>
                <td className="num">{sym(x.asset)}</td>
                <td>
                  <Dir sh={sh} />
                </td>
                <td className="r num">{mkPxFmt(ep)}</td>
                <td className="r num">{mkPxFmt(xp)}</td>
                <td className="r num">{x.exit - x.entry + '일'}</td>
                <td className="r num">{cpUsd(fee)}</td>
                <td className={'r num ' + (r.pnl >= 0 ? 'u' : 'd')}>{cpxSgn(r.pnl) + ' (' + mkPct0(x.pnl * 100, 1) + ')'}</td>
              </tr>,
            );
          }
        });
    });
  } catch {
    /* 무시 */
  }
  return out;
}

/** tfTmFollowHtml(): 복사한 전략 계정 줄. 터미널 뒤에 붙지만 CSS(.tft-page ~ .tm-follow)가 숨긴다 */
export function TermFollow() {
  const rows = activeCopies();
  if (!rows.length) return null;
  return (
    <section className="tm-follow">
      <h2>복사한 전략</h2>
      {rows.map((c) => {
        const d = cpCalc(c);
        const seed = tfSSFind(c.nick);
        return (
          <div className="tm-follow-row" key={c.id}>
            <div>
              <b>{seed ? mkTitle(seed) : c.nick}</b>
              <small>{(seed ? (MK_KIND[seed.kind] || '조건 실행') + ', ' : '') + '내 전략 복사 계정'}</small>
              <span className="num">{d.missing ? '원본 전략을 찾을 수 없습니다, 넣은 금액 ' + cpUsd(d.inv) : '운용 ' + cpUsd(d.inv) + ', 순손익 ' + cpUsd(d.net)}</span>
            </div>
            <button type="button" className="cx-sec sm" onClick={() => cpDetailGo(c.id)}>
              관리
            </button>
          </div>
        );
      })}
    </section>
  );
}
