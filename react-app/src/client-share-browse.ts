import type { ClientTurn } from './client-experience-store'
import type { ClientLanguage } from './client-preferences'

// Source 621cbed index.html:15669–15671. Navigation intent only, never a trade
// recommendation or a claim that the shared strategies have been verified.
const intent = /전략[^.]{0,14}(추천|찾아|둘러|골라|어떤 게|뭐가|보여)|따라\s?(할|가|하고 싶)|카피\s?트레이딩|다른 사람[^.]{0,10}전략|잘 하는 사람|고수[^.]{0,8}(전략|따라)/

/** Derive a single stable anchor from the saved transcript, not a timer or a
 * component-local "shown" flag that resets when navigating/reloading. */
export function shareBrowseTurnId(turns: readonly Pick<ClientTurn, 'id' | 'status' | 'question'>[]): string | undefined {
  // inlineRequest means historical validation, not the source's explicit SETUP
  // consent. The public preview has no SETUP observation; never infer one here.
  return turns.find(turn => turn.status === 'done' && intent.test(turn.question))?.id
}

const labels: Record<ClientLanguage, string> = {
  ko: '공유 전략 둘러보기', en: 'Explore Shared Strategies', ja: '共有戦略を探索',
  'zh-CN': '探索共享策略', 'zh-TW': '探索共享策略',
  es: 'Explorar estrategias compartidas', fr: 'Explorer les stratégies partagées',
}
export function shareBrowseLabel(language: ClientLanguage): string { return labels[language] }
