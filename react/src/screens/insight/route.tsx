// 해시 경로로 인사이트, 거래복기, 정기 보고 화면을 고른다 (원본 tfNFRoute 가운데 이 조각의 경로).
// #/trade, #/plan 은 다른 조각이라 여기서 다루지 않는다.
import { useEffect, type ReactNode } from 'react';
import { nav } from '../../state/route';
import { authOpen, toast, useApp } from '../../state/store';
import { Insight } from './Insight';
import { PeriodicView, ReviewView } from './Review';
import { useTf } from './tfState';

export type NFScreen = { mode: 'nfins' | 'nfreview' | 'nfperiodic'; title: string; el: ReactNode };

/** gHome() 으로 돌아갈 때처럼 주소를 지우고 홈을 그리게 한다 */
function toHome() {
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* 무시 */
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** tfNFRoute(h): 이 조각의 화면이면 { mode, title, el }, 아니면 null (홈을 그린다) */
export function useNFRoute(hash: string): NFScreen | null {
  const user = useApp((s) => !!s.user);
  const tf = useTf();
  const ins = /^#\/insight(?:\/|$)/.test(hash);
  const mine = !ins && /^#\/(review|periodic)(\/|$)/.test(hash);

  let scr: NFScreen | null = null;
  /** 화면을 못 그릴 때 할 일 */
  let bounce: (() => void) | null = null;
  if (ins) scr = { mode: 'nfins', title: '인사이트', el: <Insight hash={hash} /> }; /* 인사이트는 손님도 본다 */
  else if (mine) {
    let m: RegExpMatchArray | null;
    if (!user)
      bounce = () => {
        /* 손님: 로그인 창을 열고 홈으로 */
        toast('로그인하면 트레이딩과 크레딧을 관리할 수 있습니다');
        authOpen('login');
        toHome();
        /* 원본은 인증 창을 연 다음 gHome() 이 PC 에서 홈 입력칸에 초점을 둔다 (인증 창의 닫기 단추가 아니라) */
        if (window.innerWidth > 860) setTimeout(() => document.getElementById('g-home-in')?.focus(), 40);
      };
    else if ((m = hash.match(/^#\/review\/([A-Za-z0-9-]+)$/))) {
      const r = tf.reviews.find((x) => x.id === m![1]);
      if (r) scr = { mode: 'nfreview', title: '거래복기', el: <ReviewView r={r} periodics={tf.periodics} strat={tf.strat} /> };
      else
        bounce = () => {
          toast('복기 리포트를 찾을 수 없습니다');
          nav('#/trade');
        };
    } else if ((m = hash.match(/^#\/periodic\/([A-Za-z0-9:-]+)$/))) {
      const p = tf.periodics.find((x) => x.id === m![1]);
      if (p) scr = { mode: 'nfperiodic', title: p.label + ' 보고서', el: <PeriodicView p={p} reviews={tf.reviews} /> };
      else
        bounce = () => {
          toast('보고서를 찾을 수 없습니다');
          nav('#/trade');
        };
    } else bounce = toHome; /* 주소 꼴이 맞지 않으면 원래 있던 곳(홈)으로 */
  }

  const doBounce = bounce;
  const key = doBounce ? hash + '|' + user : '';
  useEffect(() => {
    if (doBounce) doBounce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return scr;
}
