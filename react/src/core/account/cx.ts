// 거래소 연결 상태 (원본 ==JS:cx== 구역의 tfCxStatus, tfCxStBadge). tfDerive().activation 만 읽는다.
// 배지 다섯 가지: none(미연결) pending(연결 중) partial(부분 완료) done(연결됨) error(오류).
// UID 연동은 거래소와 무관한 값이라 ex 가 비어 있으면 추천 거래소(Bitget)가 그 상태를 받는다.
import type { Broker } from './brokers.data';
import { tfDerive, type Derive } from './derive';
import { S, tfS } from './tf';

export type CxStK = 'none' | 'pending' | 'partial' | 'done' | 'error';
export type CxSt = { k: CxStK; label: string };

/** tfCxStatus(b,d) */
export function tfCxStatus(b: Pick<Broker, 'id' | 'name' | 'conn'>, d?: Derive | null): CxSt {
  d = d || tfDerive();
  const t = tfS();
  const a = d.activation || ({} as Partial<Derive['activation']>);
  if (!S.user || !b.conn) return { k: 'none', label: '미연결' };
  const mine = a.ex === b.id || (!a.ex && b.id === 'bitget');
  if (mine && a.uid === 'done' && a.api === 'done') return { k: 'done', label: b.name + ' 연결됨' };
  if (t.ob && t.ob.ex === b.id && t.ob.err) return { k: 'error', label: '오류, 다시 시도해 주십시오' };
  if (mine && (a.uid === 'done' || a.api === 'done')) return { k: 'partial', label: '부분 완료: ' + (a.uid === 'done' ? '요금 연동 완료, 실행 연결 필요' : '실행 연결 완료, 요금 연동은 선택') };
  if (t.ob && t.ob.ex === b.id && /pending/.test(String(t.ob.st || ''))) return { k: 'pending', label: '연결 중' };
  return { k: 'none', label: '미연결' };
}

/** tfCxStBadge(st): 원본은 `<span class="cx-st <k>">라벨</span>` 글자를 만든다. 여기는 그 class 와 글자를 돌려주고 화면이 span 으로 그린다 */
export function tfCxStBadge(st: CxSt): { className: string; label: string } {
  return { className: 'cx-st ' + st.k, label: st.label };
}
