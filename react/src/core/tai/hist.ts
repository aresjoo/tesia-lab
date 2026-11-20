// 연구 기록 화면의 날짜 글과 검색 (원본 gHistDate, gHistText, gHistRows).
import { mdText, taiMd } from './md';
import type { Item, Session } from './types';

/** gHistDate(ts) */
export function gHistDate(ts: number, nowMs: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date(nowMs);
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((d0.getTime() - dd.getTime()) / 864e5);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (d.getFullYear() === now.getFullYear()) return d.getMonth() + 1 + '월 ' + d.getDate() + '일';
  return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
}

function itemText(it: Item): string {
  switch (it.k) {
    case 'user':
      return it.text;
    case 'usum':
      return it.rows.map((r) => r.b + ' ' + r.v).join(' ');
    case 'ai':
      return it.plain != null ? it.plain : mdText(taiMd(it.md || ''));
    case 'chart':
      return it.label;
    case 'px':
      return [it.as, it.pv, it.chg, it.meta].join(' ');
    case 'status':
    case 'chip':
    case 'think':
      return it.label;
    case 'next':
      return it.rows.map((r) => (r.t === 'n' ? r.q : r.a.label)).join(' ');
    case 'tfmsg':
      return it.text;
    case 'tfsum':
      return [it.card.title, it.card.asset, it.card.buy, it.card.sell, it.card.period, it.card.skip || ''].join(' ');
    case 'tfdone':
      return it.asset + ' 전략 검증';
    case 'chips':
      return (it.card ? it.card.title + ' ' : '') + it.items.map((c) => c.label + ' ' + (c.desc || '')).join(' ');
    default:
      return '';
  }
}
const cache = new WeakMap<Session, { n: number; t: string }>();
/** gHistText(sx): 제목뿐 아니라 대화 내용도 찾는다 */
export function gHistText(sx: Session): string {
  const n = sx.items.length;
  const c = cache.get(sx);
  if (c && c.n === n) return c.t;
  const t = sx.items.map(itemText).join(' ').replace(/\s+/g, ' ').toLowerCase();
  cache.set(sx, { n, t });
  return t;
}
/** gHistRows(): 여러 낱말은 모두 들어 있어야 한다. 새것이 위 */
export function gHistRows(sessions: Session[], q: string): { sx: Session; ts: number }[] {
  const toks = q.split(/\s+/).filter(Boolean);
  return sessions
    .map((sx) => ({ sx, ts: +String(sx.id).replace(/^s/, '') || 0 }))
    .filter((r) => {
      if (!toks.length) return true;
      const title = r.sx.title.toLowerCase();
      let body: string | null = null;
      return toks.every((tk) => {
        if (title.indexOf(tk) >= 0) return true;
        if (body === null) body = gHistText(r.sx);
        return body.indexOf(tk) >= 0;
      });
    })
    .sort((a, b) => b.ts - a.ts);
}
