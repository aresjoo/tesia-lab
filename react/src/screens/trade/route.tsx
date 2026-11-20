// AI 트레이딩 경로 고르기. 원본 tfNFRoute(h) 의 trade 쪽과, 뒤쪽 스크립트가 바꿔 끼운 진입 규칙
// (tfTradeInactiveView → acEntryView → acReadyView)을 한 곳에 모았다.
import { useEffect } from 'react';
import { acReady } from '../../core/account/ac';
import { tfDerive } from '../../core/account/derive';
import { DASH_TITLE } from '../../core/trade/state';
import { goHome } from '../../state/route';
import { authOpen, toast, useApp } from '../../state/store';
import { Bot } from './Bot';
import { Intro } from './Intro';
import { getTf, usePreview, useTf } from './store';
import { Terminal } from './Terminal';

/** 원본 G.mode 가운데 이 조각의 화면 */
export type TradeMode = 'tfintro' | 'tfdash' | 'nfbot';
export type TradePick = { mode: TradeMode; botId?: string } | { mode: 'gate' } | null;

export const isTradeHash = (h: string) => /^#\/trade(\/|$)/.test(h);

/** tfNFRoute(h): 어느 화면을 그릴지. 이 조각의 경로가 아니면 null */
export function useTradePick(hash: string): TradePick {
  const user = useApp((s) => s.user);
  useTf(); /* 계정 상태가 바뀌면 다시 고른다 */
  const preview = usePreview();
  if (!isTradeHash(hash)) return null;
  if (hash === '#/trade') {
    /* 손님의 AI 트레이딩은 소개 화면. 미리 보기와 소유 전략이 하나라도 있으면 터미널 */
    if (preview) return { mode: 'tfdash' };
    if (!user) return { mode: 'tfintro' };
    if (tfDerive().terminalMode !== 'inactive') return { mode: 'tfdash' };
    /* 전략이 없는 회원: 실행 환경이 있으면 빈 터미널(acReadyView), 없으면 손님과 같은 소개 화면(acEntryView) */
    return { mode: acReady() ? 'tfdash' : 'tfintro' };
  }
  if (!user) return { mode: 'gate' };
  const m = hash.match(/^#\/trade\/bot\/([A-Za-z0-9]+)$/);
  if (m) return { mode: 'nfbot', botId: m[1] };
  return { mode: 'gate' };
}

/** gChead(title): 머리줄 제목. 전략 상세는 전략 이름, 나머지는 「AI 트레이딩」 */
export function tradeTitle(pick: TradePick): string {
  if (pick && pick.mode === 'nfbot') {
    const b = (getTf().strat || []).find((x) => String(x.at) === pick.botId);
    if (b) return b.name;
  }
  return DASH_TITLE;
}

/** 손님이 회원 전용 주소로 들어왔거나 없는 주소: 로그인 창을 띄우고 홈으로 */
function Gate() {
  const user = useApp((s) => s.user);
  useEffect(() => {
    if (!user) {
      toast('로그인하면 트레이딩과 크레딧을 관리할 수 있습니다');
      authOpen('login');
    }
    goHome();
    /* 원본은 로그인 창을 띄운 뒤 gHome 이 PC 에서만 입력칸에 포커스를 둔다. 홈이 뜬 다음이라야 해서 조금 뒤에 준다 */
    if (window.innerWidth > 860) setTimeout(() => document.getElementById('g-home-in')?.focus(), 60);
  }, [user]);
  return null;
}

export function TradeScreen({ pick }: { pick: NonNullable<TradePick> }) {
  if (pick.mode === 'gate') return <Gate />;
  if (pick.mode === 'tfintro') return <Intro />;
  if (pick.mode === 'nfbot') return <Bot id={pick.botId || ''} />;
  return <Terminal />;
}
