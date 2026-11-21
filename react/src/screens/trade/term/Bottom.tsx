// 터미널 하단 실행 패널: 포지션, 미체결 주문, 주문 내역, 체결 내역, 종료 포지션, 자산, 알림.
// 원본 tfTmBottom, tfTmPane, odRowsHtml, tfNFAlertsRender 를 옮겼다.
import type { ReactNode } from 'react';
import { fmtDate, idxToDate, mkPx } from '../../../core/trade/engine';
import { tfExName } from '../../../core/account/derive';
import { tfAssetTicker, tfNFTime, tfTmPct, tfTmSign, tfTmWon, tfTmWonS, type TermRow } from '../../../core/trade/term';
import { sktText as K } from '../../../core/trade/text';
import { nav } from '../../../state/route';
import { toast } from '../../../state/store';
import { tfTmConnGo } from '../bridge';
import { getTf, updateTf } from '../store';
import { exitPx } from './Brain';
import { cpxTermRows } from './Copy';
import { tfTmTradeDlg } from './dialogs';
import { BellIco, ExBadge } from './parts';
import { all, calc, setTm, TF_TM, tfNotifGo, tfNotifReadAll, tfTmSelect, tfTmSetStatus } from './tm';

export const BTABS: [string, string][] = [['pos', '포지션'], ['open', '미체결 주문'], ['orders', '주문 내역'], ['fills', '체결 내역'], ['closed', '종료 포지션'], ['assets', '자산']];
const usd0 = (n: number) => Math.round(n).toLocaleString();

/** tfTmScopeList() */
function scopeList(): TermRow[] {
  const L = all();
  if (TF_TM.scope === 'all' || !TF_TM.sel) return L;
  return L.filter((s) => s.key === TF_TM.sel);
}
/** tfTmCellEx(s) */
const CellEx = ({ ex }: { ex: string | null }) => (
  <>
    <ExBadge ex={ex} sm />
    {' ' + (ex ? tfExName(ex) || 'Binance' : 'Binance')}
  </>
);
/** tfTmCellSt(s) */
const CellSt = ({ s }: { s: TermRow }) => (
  <a className="stlk" onClick={() => tfTmSelect(s.key)}>
    {K(s.name)}
  </a>
);
const Empty = ({ tt, ds }: { tt: string; ds: string }) => (
  <div className="tft-empty" style={{ padding: '34px 16px' }}>
    <b>{K(tt)}</b>
    <span>{K(ds)}</span>
  </div>
);
const Th = ({ cols }: { cols: (string | [string])[] }) => (
  <tr>
    {cols.map((c, i) =>
      typeof c === 'string' ? (
        <th key={i}>{K(c)}</th>
      ) : (
        <th key={i} className="r">
          {K(c[0])}
        </th>
      ),
    )}
  </tr>
);
const Sd = ({ k }: { k: 'LONG' | 'SELL' | 'BUY' }) => <span className={'sd ' + (k === 'SELL' ? 'sh' : 'lg')}>{K(k)}</span>;

type Order = { id: string; status: string; asset: string; side: 'buy' | 'sell' | 'long' | 'short'; lev?: number | null; trigger?: number | null; qty?: string; qtyNum?: number | null; ttl?: string; ex?: string };
const OD_SIDE_S: Record<string, string> = { buy: '매수', sell: '매도', long: '롱', short: '숏' };
/** odCancel(id) */
function odCancel(id: string) {
  updateTf((t) => {
    const x = ((t.orders as Order[] | undefined) || []).find((o) => o.id === id);
    if (x) Object.assign(x, { status: 'cancel', cancelAt: Date.now() });
  });
  toast('예약을 취소했습니다');
}
/** odRowsHtml(): 예약 주문의 조건 대기 행 */
function odRows(): ReactNode[] {
  const L = ((getTf().orders as Order[] | undefined) || []).filter((x) => x.status === 'wait');
  return L.map((x) => (
    <tr className="od-row" key={x.id}>
      <td>{K((x.ex && tfExName(x.ex)) || x.ex || '')}</td>
      <td>{K('예약 주문')}</td>
      <td className="num">{K(tfAssetTicker(x.asset) || x.asset)}</td>
      <td>
        <span className="od-tag">{K(OD_SIDE_S[x.side] + (x.lev ? ' ' + x.lev + '배' : ''))}</span>
      </td>
      <td>{K('조건 주문')}</td>
      <td className="r num">{x.trigger ? '$' + usd0(+x.trigger) : ''}</td>
      <td className="r num">{K(x.qty === 'num' && x.qtyNum ? String(x.qtyNum) : x.qty === 'half' ? '절반' : '전부')}</td>
      <td>{K('조건 대기, ' + (({ gtc: '취소 전까지', '7d': '7일', '1d': '하루' } as Record<string, string>)[x.ttl || ''] || ''))}</td>
      <td className="r">
        <button type="button" className="od-cancel" onClick={() => odCancel(x.id)}>
          {K('취소')}
        </button>
      </td>
    </tr>
  ));
}

/** tfTmPane(k) */
function Pane({ k }: { k: string }) {
  const t = getTf();
  /* 거래소를 연결하지 않았으면 계좌 탭은 연결 안내 */
  if (!t.api) {
    const od = k === 'open' ? odRows() : [];
    if (od.length) return <OpenTable rows={od} />;
    return (
      <div className="tft-empty tft-connempty" style={{ padding: '46px 16px', textAlign: 'center' }}>
        <b>{K('거래소를 연결하면 실계좌 데이터가 표시됩니다')}</b>
        <span>{K('포지션, 주문, 자산, 정산 내역은 API 연결 후 이 자리에 나타납니다.')}</span>
        <button type="button" className="nfx-btn pri" style={{ margin: '16px auto 0' }} onClick={tfTmConnGo}>
          {K('거래소 연결하기')}
        </button>
      </div>
    );
  }
  const list = scopeList();
  /* 복사한 전략의 행은 표 맨 위에 (원본 tfTmPane 의 cpxTermRows 감싸기). 머리줄은 내 전략 표와 같다 */
  const cp = k === 'assets' ? [] : cpxTermRows(k);
  const note = <div className="tft-tnote">{K('검증 구간 파생 기록, ' + (TF_TM.scope === 'all' ? '전체 전략' : '현재 전략') + ' 범위')}</div>;
  const wrap = (head: ReactNode, rows: ReactNode[], empty: ReactNode) =>
    rows.length ? (
      <>
        {note}
        <div className="tft-tblw">
          <table className="tft-tbl">
            <thead>{head}</thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      </>
    ) : (
      <>
        {note}
        {empty}
      </>
    );
  if (k === 'pos') {
    const rows: ReactNode[] = [];
    list.forEach((s) => {
      if (s.status !== 'live') return;
      const c = calc(s);
      if (!c.pos) return;
      const pc = c.pos.chg * 100;
      rows.push(
        <tr key={s.key}>
          <td>
            <CellEx ex={s.ex} />
          </td>
          <td>
            <CellSt s={s} />
          </td>
          <td className="num">{K(s.sym)}</td>
          <td>
            <Sd k="LONG" />
          </td>
          <td className="r num">{c.pos.qty.toFixed(4)}</td>
          <td className="r num">{usd0(c.pos.entryP)}</td>
          <td className="r num">{usd0(c.pos.curP)}</td>
          <td className="r num">{usd0(c.pos.stopP)}</td>
          <td className={'r num ' + tfTmSign(c.pos.krw)}>{tfTmWonS(c.pos.krw)}</td>
          <td className={'r num ' + tfTmSign(pc)}>{tfTmPct(pc, 1)}</td>
          <td className="r">
            <button className="tbtn" onClick={() => tfTmSetStatus(s.key, 'off', '수동 중지')}>
              {K('중지')}
            </button>
          </td>
        </tr>,
      );
    });
    return wrap(<Th cols={['거래소', '전략', '심볼', '방향', ['수량'], ['진입가'], ['현재가'], ['손절가'], ['미실현'], ['%'], ['']]} />, cp.concat(rows), <Empty tt="현재 포지션이 없습니다." ds="실행 중 전략이 진입하면 여기에 표시됩니다." />);
  }
  if (k === 'open') {
    const rows: ReactNode[] = [];
    list.forEach((s) => {
      if (s.status !== 'live') return;
      const c = calc(s);
      if (!c.pos) return;
      rows.push(
        <tr key={s.key + 's'}>
          <td>
            <CellEx ex={s.ex} />
          </td>
          <td>
            <CellSt s={s} />
          </td>
          <td className="num">{K(s.sym)}</td>
          <td>
            <Sd k="SELL" />
          </td>
          <td>{K('손절 STOP')}</td>
          <td className="r num">{usd0(c.pos.stopP)}</td>
          <td className="r num">{c.pos.qty.toFixed(4)}</td>
          <td>{K('대기')}</td>
          <td className="r">
            <span className="mut">{K('규칙 주문, 취소는 전략 중지로')}</span>
          </td>
        </tr>,
      );
      if (c.pos.tpP)
        rows.push(
          <tr key={s.key + 't'}>
            <td>
              <CellEx ex={s.ex} />
            </td>
            <td>
              <CellSt s={s} />
            </td>
            <td className="num">{K(s.sym)}</td>
            <td>
              <Sd k="SELL" />
            </td>
            <td>{K('익절 LIMIT')}</td>
            <td className="r num">{usd0(c.pos.tpP)}</td>
            <td className="r num">{c.pos.qty.toFixed(4)}</td>
            <td>{K('대기')}</td>
            <td className="r">
              <span className="mut">{K('규칙 주문')}</span>
            </td>
          </tr>,
        );
    });
    /* 예약 주문의 조건 대기 행은 맨 위에. 표가 비어 있으면 표를 새로 만든다 (원본 odRowsHtml 감싸기) */
    const od = odRows();
    if (od.length && !rows.length) return <OpenTable rows={cp.concat(od)} />;
    return wrap(<Th cols={['거래소', '전략', '심볼', '방향', '유형', ['가격'], ['수량'], '상태', ['']]} />, cp.concat(od, rows), <Empty tt="미체결 주문이 없습니다." ds="포지션이 열리면 규칙 기반 손절, 익절 주문이 여기 걸립니다." />);
  }
  if (k === 'orders' || k === 'fills') {
    const rows: ReactNode[] = [];
    list.forEach((s) => {
      const c = calc(s);
      const px = mkPx((s.p && s.p.px) || null);
      c.trades
        .slice(-8)
        .reverse()
        .forEach((tr) => {
          const xp = exitPx(s, tr);
          const qty = tr.capB / px[tr.entry];
          const head = (d: number) => (
            <>
              <td>
                <CellEx ex={s.ex} />
              </td>
              <td>
                <CellSt s={s} />
              </td>
              <td className="num">{fmtDate(idxToDate(d))}</td>
              <td className="num">{K(s.sym)}</td>
            </>
          );
          const key = s.key + ':' + tr.entry;
          if (k === 'orders') {
            rows.push(
              <tr key={key + 'x'}>
                {head(tr.exit)}
                <td>
                  <Sd k="SELL" />
                </td>
                <td>{K(({ sl: '손절 STOP', tp: '익절 LIMIT', time: '기간 시장가' } as Record<string, string>)[tr.kind])}</td>
                <td className="r num">{usd0(xp)}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td>
                  <span className="okst">{K('체결 완료')}</span>
                </td>
              </tr>,
              <tr key={key + 'e'}>
                {head(tr.entry)}
                <td>
                  <Sd k="BUY" />
                </td>
                <td>{K('진입 시장가')}</td>
                <td className="r num">{usd0(px[tr.entry])}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td>
                  <span className="okst">{K('체결 완료')}</span>
                </td>
              </tr>,
            );
          } else {
            rows.push(
              <tr key={key + 'x'}>
                {head(tr.exit)}
                <td>
                  <Sd k="SELL" />
                </td>
                <td className="r num">{usd0(xp)}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td className="r num">{tfTmWon(tr.capB * 0.001)}</td>
              </tr>,
              <tr key={key + 'e'}>
                {head(tr.entry)}
                <td>
                  <Sd k="BUY" />
                </td>
                <td className="r num">{usd0(px[tr.entry])}</td>
                <td className="r num">{qty.toFixed(4)}</td>
                <td className="r num">{tfTmWon(tr.capB * 0.001)}</td>
              </tr>,
            );
          }
        });
    });
    return k === 'orders'
      ? wrap(<Th cols={['거래소', '전략', '일자', '심볼', '방향', '유형', ['가격'], ['수량'], '상태']} />, cp.concat(rows), <Empty tt="주문 내역이 없습니다" ds="전략이 거래를 실행하면 주문 이벤트가 기록됩니다." />)
      : wrap(<Th cols={['거래소', '전략', '일자', '심볼', '방향', ['체결가'], ['수량'], ['수수료']]} />, cp.concat(rows), <Empty tt="체결 내역이 없습니다" ds="체결이 발생하면 여기에 표시됩니다." />);
  }
  if (k === 'closed') {
    const rows: ReactNode[] = [];
    list.forEach((s) => {
      const c = calc(s);
      const px = mkPx((s.p && s.p.px) || null);
      c.trades
        .slice(-10)
        .reverse()
        .forEach((tr) => {
          rows.push(
            <tr
              key={s.key + ':' + tr.entry}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                tfTmSelect(s.key);
                setTm({ tab: 'done' });
                tfTmTradeDlg(s.key, tr.entry);
              }}
            >
              <td>
                <CellEx ex={s.ex} />
              </td>
              <td>
                <CellSt s={s} />
              </td>
              <td className="num">{K(s.sym)}</td>
              <td>
                <Sd k="LONG" />
              </td>
              <td className="r num">{usd0(px[tr.entry])}</td>
              <td className="r num">{usd0(exitPx(s, tr))}</td>
              <td className="r num">{tr.exit - tr.entry + '봉'}</td>
              <td className="r num">{tfTmWon(tr.capB * 0.002)}</td>
              <td className={'r num ' + tfTmSign(tr.krw)}>{tfTmWonS(tr.krw) + ' (' + tfTmPct(tr.pnl * 100, 1) + ')'}</td>
            </tr>,
          );
        });
    });
    return wrap(<Th cols={['거래소', '전략', '심볼', '방향', ['진입'], ['청산'], ['보유'], ['수수료'], ['실현 손익']]} />, cp.concat(rows), <Empty tt="종료된 포지션이 없습니다" ds="완결된 거래가 생기면 판단 기록과 연결됩니다." />);
  }
  if (k === 'assets') {
    /* 자산은 늘 계정 전체. 공용 위임 예산은 거래소마다 한 번만 더한다 */
    const byEx: Record<string, { eq: number; used: number; un: number; n: number; shared: boolean; sharedCapDone: boolean; usedSharedDone?: boolean }> = {};
    all().forEach((s) => {
      const ek = s.ex || 'unlinked';
      const g = (byEx[ek] = byEx[ek] || { eq: 0, used: 0, un: 0, n: 0, shared: false, sharedCapDone: false });
      const c = calc(s);
      if (s.capShared) {
        if (!g.sharedCapDone) {
          g.eq += s.cap;
          g.sharedCapDone = true;
        }
        g.eq += c.pnl;
      } else g.eq += c.nav;
      const open = s.status === 'live' && c.pos;
      g.un += open && c.pos ? c.pos.krw : 0;
      g.used += open ? (s.capShared && g.usedSharedDone ? 0 : s.cap) : 0;
      if (s.capShared && open) g.usedSharedDone = true;
      g.n++;
      if (s.capShared) g.shared = true;
    });
    const ks = Object.keys(byEx);
    const note2 = <div className="tft-tnote">{K('계정 전체 범위, 검증 구간 파생')}</div>;
    if (!ks.length)
      return (
        <>
          {note2}
          <Empty tt="연결된 자산이 없습니다" ds="전략을 만들면 거래소별 자산 현황이 여기 모입니다." />
        </>
      );
    return (
      <>
        {note2}
        <div className="tft-assets">
          {ks.map((ek) => {
            const g = byEx[ek];
            const name = ek === 'unlinked' ? '미연결' : tfExName(ek) || 'Binance';
            return (
              <div className="tft-asx num" key={ek}>
                <div className="ah2">
                  {ek === 'unlinked' ? (
                    <span className="exb" style={{ background: '#3a4254', color: '#dbdbdb' }}>
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  ) : (
                    <ExBadge ex={ek} />
                  )}
                  <b>{K(name)}</b>
                  <span className="mut">{K('전략 ' + g.n + '개')}</span>
                </div>
                <div className="ag2">
                  <span>
                    <small>{K('Equity')}</small>
                    <b>{tfTmWon(g.eq)}</b>
                  </span>
                  <span>
                    <small>Available</small>
                    <b>{tfTmWon(g.eq - g.used)}</b>
                  </span>
                  <span>
                    <small>Used</small>
                    <b>{tfTmWon(g.used)}</b>
                  </span>
                  <span>
                    <small>{K('미실현')}</small>
                    <b className={tfTmSign(g.un)}>{tfTmWonS(g.un)}</b>
                  </span>
                </div>
                <div className="af2">{K('USD 기준, 검증 구간' + (g.shared ? ', 예산 공용' : ''))}</div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
  return null;
}
/** 예약 주문만 있을 때의 미체결 표 */
function OpenTable({ rows }: { rows: ReactNode[] }) {
  return (
    <div className="tft-tblw">
      <table className="tft-tbl">
        <thead>
          <Th cols={['거래소', '전략', '심볼', '방향', '유형', ['가격'], ['수량'], '상태', ['']]} />
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

/** tfNFAlertsRender(): 터미널 알림 */
function Alerts() {
  const t = getTf();
  const tab = TF_TM.nfTab;
  const inTab = (n: { type: string }, k: string) => k === 'all' || n.type === k || (k === 'pos' && (n.type === 'pos' || n.type === 'bot'));
  const TB: [string, string][] = [['all', '전체'], ['pos', '포지션'], ['bot', '전략'], ['review', '거래복기']];
  const rows = t.notifs.filter((n) => inTab(n, tab));
  const unread = t.notifs.filter((n) => !n.read).length;
  return (
    <>
      <div className="nfx-sechead">
        <h2 className="nfx-sectit">
          {unread ? (
            <>
              {'알림 '}
              <span className="nfx-badge blue">{unread + '개 안읽음'}</span>
            </>
          ) : (
            '알림'
          )}
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="nfxu-later" onClick={tfNotifReadAll}>
            {K('모두 읽음')}
          </button>
          <button className="nfx-btn out" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => nav('#/plan/alerts')}>
            {K('수신 설정')}
          </button>
        </div>
      </div>
      <div className="nfxh-fchips">
        {TB.map((tb) => {
          const c = t.notifs.filter((n) => inTab(n, tb[0])).length;
          return (
            <button key={tb[0]} className={'nfxh-fchip' + (tab === tb[0] ? ' on' : '')} onClick={() => setTm({ nfTab: tb[0] })}>
              {tb[1]}
              {c ? <span className="c2">{c}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="nfxh-alerts-list">
        {rows.length ? (
          rows.map((n, ni) => {
            const tg = ({ credit: '크레딧', pos: '포지션', bot: '전략', review: '거래복기', rebate: '정산', report: '보고서' } as Record<string, string>)[n.type] || n.type;
            const m1 = n.title.match(/([+-]\d+(?:\.\d+)?)%/);
            const m2 = n.title.match(/\+\$([\d,]+)/);
            return (
              <div className={'nf-item' + (n.read ? ' read' : '')} key={n.id + ':' + ni} onClick={() => tfNotifGo(n.id)}>
                <span className="ic" />
                <div className="bx">
                  <div className="tt" style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className={'tg t-' + n.type}>{K(tg)}</span>
                      {K(n.title)}
                    </span>
                    {m1 ? <span className={'mv ' + (m1[1].charAt(0) === '+' ? 'up' : 'dn')}>{m1[1] + '%'}</span> : m2 ? <span className="mv up">{'+$' + m2[1]}</span> : null}
                  </div>
                  {n.body ? <div className="bd2">{K(n.body)}</div> : null}
                  <div className="tm num">{tfNFTime(n.at)}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="nfx-empty">
            <div className="nfx-eicon">
              <BellIco />
            </div>
            <div className="nfx-etit">{K(t.notifs.length ? '이 분류의 알림이 없습니다' : '아직 알림이 없습니다')}</div>
            <div className="nfx-edesc">{K(t.notifs.length ? '다른 필터에서 ' + t.notifs.length + '건을 확인할 수 있습니다.' : '전략이 실행되면 체결, 복기, 정산 소식이 여기로 옵니다.')}</div>
          </div>
        )}
      </div>
    </>
  );
}

/** 탭 줄 (원본 tfDashView 의 strip). 숫자 배지는 화면을 열 때 센 값이다 */
export function Strip({ list, on, sfx, cnt, pick }: { list: [string, string][]; on: string; sfx: string; cnt: Record<string, number>; pick: (k: string) => void }) {
  return (
    <>
      {list.map((tb) => {
        const c2 = cnt[tb[0]];
        return (
          <button key={tb[0]} className={'nfxh-tab' + (tb[0] === on ? ' on' : '')} data-k={tb[0]} onClick={() => pick(tb[0])}>
            {K(tb[1])}
            {c2 ? (
              <span className="ct" id={'nfxh-ct-' + tb[0] + '-' + sfx}>
                {c2}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

/** 하단 패널 전체 (tfDashView 의 .tft-bottom) */
export function Bottom({ cnt, simnote }: { cnt: Record<string, number>; simnote: boolean }) {
  const pane = TF_TM.pane;
  return (
    <div className="tft-bottom">
      <div className="nfxh-tabs m2-only">
        {/* tfTmMTab2: 구역(mt-*)은 두고 pane 만 바꾼다 */}
        <Strip list={BTABS} on={pane} sfx="m2" cnt={cnt} pick={(k) => setTm({ pane: k })} />
      </div>
      <div className="tft-botbar tm-botbar">
        <div className="tft-scope">
          <select id="tft-scope" aria-label="데이터 범위" value={TF_TM.scope} onChange={(e) => setTm({ scope: e.target.value as 'cur' | 'all' })}>
            <option value="cur">현재 전략</option>
            <option value="all">전체 전략</option>
          </select>
        </div>
        <div className="nfxh-tabs d-only" style={{ borderBottom: 0, flex: 1, minWidth: 0 }}>
          {/* tfNFHTab */}
          <Strip list={BTABS} on={pane} sfx="d" cnt={cnt} pick={(k) => setTm({ pane: k, mt: k })} />
        </div>
        {simnote && <span className="tm-simnote">{K('시뮬레이션 데이터입니다')}</span>}
      </div>
      {BTABS.map((tb) => (
        <div className={'nfxh-pane' + (pane === tb[0] ? ' on' : '')} data-p={tb[0]} key={tb[0]}>
          <div id={'tft-p-' + tb[0]}>
            <Pane k={tb[0]} />
          </div>
        </div>
      ))}
      <div className={'nfxh-pane' + (pane === 'alerts' ? ' on' : '')} data-p="alerts">
        <div id="nfxh-alerts">
          <Alerts />
        </div>
      </div>
    </div>
  );
}
