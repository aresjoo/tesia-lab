// 거래 내역의 주문 줄 만들기 (원본 mkOrders, mkWhen, mkQty). 끝난 거래 한 건은 진입과 청산 두 줄이 된다.
import { MK_CRYPTO } from './catalog.data';
import { idxToDate } from './data';
import { mkWords } from './chat';
import type { Strat } from './types';

/** 주문 한 줄. sum 과 q 는 $1,000 로 시작한 기준 */
export type Order = { i: number; side: 'in' | 'out'; a: string; px: number; q: number; sum: number; id: number; ps?: number; pnl?: number; open?: boolean; label: string; when: string };

/** mkWhen(s,i,a,salt): 체결 시각 2026.10.31 08:00 */
export function mkWhen(s: Strat, i: number, a: string | null | undefined, salt: number): string {
  const cr = a ? !!MK_CRYPTO[a] : s.mkt === 'crypto' || s.mkt === 'multi';
  const d = idxToDate(i);
  let h = 0;
  const k = String(s.id || s.nick) + '|' + i + '|' + (salt || 0);
  for (let x = 0; x < k.length; x++) h = (h * 31 + k.charCodeAt(x)) >>> 0;
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + (cr ? 1 : 0), cr ? 0 : 20, 0, 2 + (h % 47)));
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return t.getFullYear() + '.' + p(t.getMonth() + 1) + '.' + p(t.getDate()) + ' ' + p(t.getHours()) + ':' + p(t.getMinutes());
}
/** mkQty(v): 수량 자릿수 */
export function mkQty(v: number): string {
  const a = Math.abs(v);
  return a >= 1000 ? Math.round(v).toLocaleString() : a >= 10 ? v.toFixed(2) : a >= 0.1 ? v.toFixed(3) : v.toFixed(5);
}

/** mkOrders(s): 전체 기간의 주문을 최근 것부터 */
export function mkOrders(s: Strat): Order[] {
  const r = s.r;
  const st = r.state;
  const W = mkWords(s);
  const B = 1000;
  type Raw = Omit<Order, 'label' | 'when'>;
  const o: Raw[] = [];
  (r.trades || []).forEach((t) => {
    if (t.units == null || t.ep == null) return;
    o.push({ i: t.entry, side: 'in', a: t.asset as string, px: t.ep, q: Math.abs(t.units) * B, sum: (t.cost as number) * B, id: t.id as number, ps: t.side });
    o.push({ i: t.exit, side: 'out', a: t.asset as string, px: t.xp as number, q: Math.abs(t.units) * B, sum: (t.got as number) * B, id: t.id as number, pnl: t.pnl * 100, ps: t.side });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const op: any[] = !st ? [] : st.open && st.open.length != null ? st.open : st.open ? [st.open] : [];
  op.forEach((p) => {
    if (p.units != null) o.push({ i: p.entry, side: 'in', a: p.k, px: p.ep, q: Math.abs(p.units) * B, sum: p.cost * B, id: p.tid, open: true, ps: p.side });
  });
  o.sort((x, y) => y.i - x.i || (x.side === y.side ? y.id - x.id : x.side === 'out' ? 1 : -1));
  return o.map((x) => ({ ...x, label: (x.ps ? (x.ps > 0 ? '롱 ' : '숏 ') : '') + (x.side === 'in' ? W.buy : W.sell), when: mkWhen(s, x.i, x.a, x.id + (x.side === 'in' ? 0 : 7)) }));
}
