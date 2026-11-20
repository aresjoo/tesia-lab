// 계정 상태 가운데 인사이트, 거래복기, 정기 보고가 읽는 것 (원본 tfS(), tfNFInit(), G.sessions).
// 원본은 로그인한 계정의 상태를 localStorage 'teth.state' 에 { v, user, tf, sessions } 로 둔다.
// React 판에는 아직 이 상태를 쓰는 화면(전략 실행, 터미널, 대화)이 없어서 같은 자리를 읽기만 한다.
// 그 화면들이 store 로 옮겨지면 이 파일의 tfS() 만 store 를 읽게 바꾸면 된다.
import { useMemo } from 'react';
import type { TfBot, TfForIns } from '../../core/insight/insight';
import type { Periodic, Rebate, Review } from '../../core/insight/review';
import { useHash } from '../../state/route';
import { useApp } from '../../state/store';

export type TfState = Omit<TfForIns, 'strat' | 'reviews'> & { strat: (TfBot | null)[]; reviews: Review[]; periodics: Periodic[]; rebates: Rebate[]; sessions: number };
const EMPTY: TfState = { strat: [], reviews: [], periodics: [], rebates: [], fills: [], fillLog: [], intake: {}, sessions: 0 };

/** tfS() + tfNFInit(): 없는 칸은 빈 값으로 채운다. 손님은 빈 상태 */
export function tfS(user: boolean): TfState {
  if (!user) return EMPTY;
  try {
    const p = JSON.parse(localStorage.getItem('teth.state') || 'null');
    if (!p || !p.v || !p.user || !p.tf) return EMPTY;
    const t = p.tf;
    return {
      strat: Array.isArray(t.strat) ? t.strat : [],
      reviews: Array.isArray(t.reviews) ? t.reviews : [],
      periodics: Array.isArray(t.periodics) ? t.periodics : [],
      rebates: Array.isArray(t.rebates) ? t.rebates : [],
      fills: Array.isArray(t.fills) ? t.fills : [],
      fillLog: Array.isArray(t.fillLog) ? t.fillLog : [],
      intake: t.intake || {},
      sessions: Array.isArray(p.sessions) ? p.sessions.length : 0,
    };
  } catch {
    return EMPTY;
  }
}

/** 화면에서 쓰는 꼴: 로그인 상태나 주소가 바뀌면 다시 읽는다 */
export function useTf(): TfState {
  const user = useApp((s) => !!s.user);
  const hash = useHash();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => tfS(user), [user, hash]);
}
