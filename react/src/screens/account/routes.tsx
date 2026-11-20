// 이 조각의 화면 고르기: 거래소 연결(#/brokers), 설정(#/settings/<탭>), 이용 현황(#/plan...).
// App 은 accountScreen 이 돌려준 화면을 그리고, 없으면 홈을 그린다.
import type { ReactNode } from 'react';
import { goHome } from '../../state/route';
import { authOpen, toast, type User } from '../../state/store';
import { Brokers } from './brokers/Brokers';
import { Plan } from './plan/Plan';
import { Settings } from './settings/Settings';
import './session';

/** mode 는 원본 G.mode, title 은 gChead 의 제목 */
export type Screen = { mode: string; title: string; node: ReactNode };

const RE_BROKERS = /^#\/brokers(?:\/([a-z]+))?$/;
const RE_SET = /^#\/settings(?:\/([a-z]+))?$/;
const RE_PLAN = /^#\/plan(?:\/(rebates|alerts))?$/;

export function accountScreen(hash: string, user: User): Screen | null {
  let m: RegExpMatchArray | null;
  if ((m = hash.match(RE_BROKERS))) return { mode: 'tfbrokers', title: '거래소 연결', node: <Brokers ex={m[1] || null} /> };
  if (!user) return null; /* 설정과 이용 현황은 회원만. 손님은 accountGuard 가 홈으로 돌려보낸다 */
  if ((m = hash.match(RE_SET))) return { mode: 'tfset', title: '설정', node: <Settings tab={m[1] || null} /> };
  if ((m = hash.match(RE_PLAN)) && m[1]) return { mode: 'nfplan', title: '이용 현황', node: <Plan tab={m[1] as 'rebates' | 'alerts'} /> };
  return null;
}

/** 경로가 바뀔 때 App 이 effect 에서 부른다 (원본 tfRoute, stRoute, tfNFRoute 의 문지기 부분) */
export function accountGuard(hash: string, user: User) {
  if (RE_SET.test(hash) && !user) {
    /* stRoute: 손님은 홈으로 보내고 로그인 창 */
    goHome();
    authOpen('login');
    return;
  }
  if (RE_PLAN.test(hash)) {
    if (!user) {
      /* tfNFRoute: 게스트 접근 */
      toast('로그인하면 트레이딩과 크레딧을 관리할 수 있습니다');
      authOpen('login');
      goHome();
      /* 원본은 로그인 창을 연 뒤 gHome() 이 PC 에서 입력창에 초점을 준다 */
      if (window.innerWidth > 860) setTimeout(() => document.getElementById('g-home-in')?.focus(), 30);
    } else if (hash === '#/plan') {
      /* tfRoute: 회원의 #/plan 은 결제 설정으로 모은다 */
      history.replaceState(null, '', '#/settings/billing');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }
}
