import type { ClientSession, ConversationPhase } from './client-experience-store'
import type { ClientClarification } from './components/ClientClarificationCard'

// Client-authored T8 text, observed at 621cbed. Preview-only choices/defaults;
// native uses the server's nextQuestion and never imports this catalog.
const cards: Record<Exclude<ConversationPhase, 'plan'>, ClientClarification & { skip: string }> = {
  mode: { title: '진입 방식을 정해주세요', sub: '전략의 성격을 결정하는 질문이에요.', freeHint: '예: 반등 매수로', skip: '내려왔을 때 반등 매수', options: [
    { label: '내려왔을 때 반등 매수', description: '과매도 후 되돌림을 노려요. 거래가 적고 느긋해요.', value: '내려왔을 때 반등 매수' },
    { label: '오르는 흐름에 진입', description: '상승 확인 후 따라가요. 거래가 잦고 빠릅니다.', value: '오르는 흐름에 진입' },
    { label: '차이를 더 알려주세요', description: '두 방식의 차이를 설명해드려요.', value: '차이 설명' },
  ] },
  pair: { title: '어떤 자산으로 할까요?', sub: '검증과 실행의 대상이 되는 자산이에요.', freeHint: '예: 비트코인으로', skip: '추천', options: [
    { label: 'BTC/USDT', description: '유동성이 가장 깊어 검증 데이터가 안정적이에요.', value: 'BTC/USDT' },
    { label: 'ETH/USDT', description: '변동성이 조금 더 커서 기회와 위험이 함께 커져요.', value: 'ETH/USDT' },
    { label: 'AI 추천으로', description: '거래량과 데이터 안정성 기준으로 골라드려요.', value: '추천' },
  ] },
  timeframe: { title: '얼마나 자주 확인할까요?', sub: '짧을수록 거래가 잦아집니다.', freeHint: '예: 1시간마다', skip: '추천', options: [
    { label: '1시간마다', description: '기회를 자주 잡지만 거래도 잦아져요.', value: '1시간' },
    { label: '하루 1회', description: '느긋하게 굵직한 흐름만 봐요.', value: '하루 1회' },
    { label: 'AI 추천으로', description: '진입 방식에 맞는 균형점을 골라드려요.', value: '추천' },
  ] },
  risk: { title: '한 번의 거래에서 얼마까지 잃어도 될까요?', sub: '이 선에 닿으면 자동으로 손절해요.', freeHint: '예: -3%', skip: '−3% (표준)', options: [
    { label: '-2%', description: '보수적으로. 손실은 작지만 자주 잘릴 수 있어요.', value: '−2%' },
    { label: '-3% (표준)', description: '대부분의 검증에서 균형이 좋았던 기본값이에요.', value: '−3% (표준)' },
    { label: '-5%', description: '여유를 주는 대신 한 번의 손실이 커져요.', value: '−5%' },
  ] },
  take: { title: '수익은 어디서 확정할까요?', sub: '확정 지점이 없으면 벌었다가 되돌려줄 수 있어요.', freeHint: '예: +8% 또는 없이', skip: '익절 +8% 설정', options: [
    { label: '익절 +8% 설정', description: '수익 확정 지점을 두고 낙폭을 관리해요.', value: '익절 +8% 설정' },
    { label: '익절 없이 진행', description: '추세를 끝까지 따라가요. 되돌림은 감수합니다.', value: '익절 없이 진행' },
  ] },
}

/** Exact visible labels also work when typed. No fuzzy financial inference. */
export function intakeChoiceValue(phase: ConversationPhase, input: string): string {
  if (phase === 'plan' || !Object.hasOwn(cards, phase)) return input
  return cards[phase].options.find(option => option.label === input.trim())?.value ?? input
}

export function intakeCard(session: ClientSession): (ClientClarification & { skip: string }) | null {
  const latest = session.turns.at(-1)
  if (!latest || latest.status !== 'done' || !latest.suggestions.length || latest.phase !== session.phase || session.phase === 'plan' || !Object.hasOwn(cards, session.phase)) return null
  const card = cards[session.phase]
  if (!card) return null
  // Count distinct unanswered-question stages, not retries or explanation turns.
  // Derive from saved turns so reload requires no second source of state.
  const asked = new Set(session.turns.map(turn => turn.phase).filter(phase => Object.hasOwn(cards, phase)))
  const remaining = [session.mode, session.pair, session.timeframe, session.risk, session.takeProfit].filter(value => !value).length
  const current = Math.max(1, asked.size)
  return { ...card, progress: [current, Math.min(5, current + Math.max(0, remaining - 1))] }
}
