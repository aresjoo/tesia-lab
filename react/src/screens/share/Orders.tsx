// 거래 내역 (원본 mkOrdersSec, mkOrdersTable, mkTradesTab, mkOrdMore, mkGoTrades, mkBackOv).
// 개요 탭 아래에는 최근 주문 5건, 거래 내역 탭에는 30건씩 보여 준다. 금액과 수량은 $1,000 로 시작한 기준이다.
import { useMemo, useState } from 'react';
import { mkPct0, mkPxU, mkTk } from '../../core/engine/format';
import { mkOrders, mkQty, type Order } from '../../core/engine/orders';
import type { Strat } from '../../core/engine/types';
import { tfSSNe } from '../../core/engine/format';
import { replaceHash } from '../../state/route';
import { setSS } from '../../state/share';
import { goDetail } from './Hub';
import { skdBody, skdLabel } from './skd';

/** MK_OV_KEEP: 거래 내역으로 갈 때 개요의 그래프 설정과 스크롤 자리를 기억해 두고, 돌아오면 되살린다 */
export type OvKeep = { id: string; per?: number; tab?: string; gran?: string; top: number };
let MK_OV_KEEP: OvKeep | null = null;
/** 탭을 주소 교체로 바꿀 때 상세가 스크롤 자리를 지키게 하는 표시 (tfSS3DetailRender._keep) */
export const tabKeep = { on: false };
/** mkOvRestore(ne) 가 쓴다: 같은 전략의 기억이 있으면 꺼내고 비운다 */
export function takeOvKeep(id: string): OvKeep | null {
  const k = MK_OV_KEEP;
  if (!k || k.id !== id) return null;
  MK_OV_KEEP = null;
  return k;
}

/** mkOrdersTable(s,rows) */
function OrdersTable({ rows }: { rows: Order[] }) {
  return (
    <div className="mk-tblw">
      <table className="ss3-tbl mko-tbl">
        <thead>
          <tr>
            <th>{skdLabel('종목')}</th>
            <th>{skdLabel('구분')}</th>
            <th>{skdLabel('시간')}</th>
            <th className="r">{skdLabel('가격')}</th>
            <th className="r">{skdLabel('수량')}</th>
            <th className="r">{skdLabel('합계')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((x, i) => (
              <tr key={x.id + x.side + i} className={x.side === 'in' ? 'in' : 'out'}>
                <td>
                  <span className="mko-s" aria-hidden="true">
                    {x.side === 'in' ? '+' : '−'}
                  </span>
                  <b>{skdBody(mkTk(x.a))}</b>
                </td>
                <td>
                  {skdBody(x.label)}
                  {x.open ? <small>{skdBody(' 보유 중')}</small> : null}
                </td>
                <td className="num">{skdBody(x.when)}</td>
                <td className="num r">{skdBody(mkPxU(x.a, x.px))}</td>
                <td className="num r">{skdBody(mkQty(x.q))}</td>
                <td className="num r">
                  {skdBody('$' + Math.round(x.sum).toLocaleString())}
                  {x.pnl != null ? <small className={x.pnl >= 0 ? 'up' : 'dn'}>{skdBody(' ' + mkPct0(x.pnl))}</small> : null}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="mko-e">
                아직 거래가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const countLine = (n: number) => skdBody('주문 ' + n.toLocaleString() + '건, $1,000로 시작한 기준');

/** mkOrdersSec(s,ne): 개요 탭 아래의 거래 내역 구역. keep 은 돌아올 때 되살릴 그래프 설정(상세가 넘긴다) */
export function OrdersSec({ s, keep }: { s: Strat; pd: string; keep?: () => { per: number; tab: string; gran: string } }) {
  const o = useMemo(() => mkOrders(s), [s]);
  /** mkGoTrades(ne) */
  const go = () => {
    const sc = document.getElementById('g-scroll');
    MK_OV_KEEP = { id: s.id, ...(keep ? keep() : {}), top: sc ? sc.scrollTop : 0 };
    goDetail(s.id, 'all', 'trades');
  };
  return (
    <section className="mk3-sec mko">
      <div className="mk3-sec-h">
        <h3>
          <button type="button" className="mko-go" onClick={go}>
            {skdLabel('거래내역')}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </h3>
        <span className="mko-n num">{countLine(o.length)}</span>
      </div>
      <OrdersTable rows={o.slice(0, 5)} />
    </section>
  );
}

/** mkTradesTab(s,r,pd,ne): 거래 내역 탭. 30건을 먼저 보이고 누를 때마다 50건씩 더 */
export function TradesTab({ s }: { s: Strat; pd: string }) {
  const o = useMemo(() => mkOrders(s), [s]);
  const [n, setN] = useState(30); /* MK_ORD_N */
  /** mkBackOv(ne): 개요에서 넘어왔으면 뒤로, 주소로 바로 왔으면 개요로 */
  const back = () => {
    if (MK_OV_KEEP && MK_OV_KEEP.id === s.id && window.history.length > 1) {
      window.history.back();
      return;
    }
    /* tfSS3Go(ne,'all','ov'): 같은 상세 안이라 기록을 쌓지 않고 스크롤 자리도 그대로 둔다 */
    tabKeep.on = true;
    setSS({ pd: 'all' });
    replaceHash('#/share/s/' + tfSSNe(s.id) + '/all');
  };
  const arrow = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
  return (
    <div className="mko mko-all">
      <button type="button" className="mko-go mko-back" onClick={back}>
        {arrow}
        {skdLabel('개요로 돌아가기')}
      </button>
      <div className="mk3-sec-h">
        {/* 여기 제목은 이름표 자리 밖이라 원본도 글자를 바꾸지 않는다 */}
        <h3>거래내역</h3>
        <span className="mko-n num">{countLine(o.length)}</span>
      </div>
      <div id="mko-host">
        <OrdersTable rows={o.slice(0, n)} />
      </div>
      {/* mkOrdMore() */}
      {o.length > n ? (
        <button type="button" className="mkc-more mko-more" id="mko-more" onClick={() => setN(n + 50)}>
          이전 거래 더 보기
        </button>
      ) : null}
      <button type="button" className="mko-go mko-back mko-back2" onClick={back}>
        {arrow}
        {skdLabel('개요로 돌아가기')}
      </button>
    </div>
  );
}
