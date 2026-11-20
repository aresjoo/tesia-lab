// 모델에 보내는 지침을 조립한다. 지침 글 자체는 원본에서 꺼낸 prompt.data.ts 에 있다.
import { TAI_CONV_FREE, TAI_CONV_STEP, TAI_MARKET_RULES, TAI_SYSTEM } from './prompt.data';
import { TAI_TFL } from './scope';
import type { AiState, Strategy } from './types';

/** taiConvSystem(): 자유 대화 단계와 필수 설정 단계의 말투 */
export function taiConvSystem(gStep: string | null): string {
  if (!gStep) return TAI_CONV_FREE;
  return TAI_CONV_STEP[gStep] || TAI_CONV_STEP.tp;
}
/** taiMarketRules() */
export function taiMarketRules(chart: { label: string; tv: string } | null): string {
  return TAI_MARKET_RULES + (chart ? '\n현재 열린 차트: ' + chart.label + ' (' + chart.tv + ').' : '');
}
/**
 * taiBuildSystem(fin,conv): 페르소나 + 규칙 + 대화의 작업 상태 + 기억 원칙.
 * 검증 결과(fin)가 붙는 문서 화면 쪽 문맥은 그 화면을 옮길 때 더한다.
 */
export function taiBuildSystem(o: { conv: boolean; gStep: string | null; mirrorChart: { label: string; tv: string } | null; ai: AiState | null; strategy: Strategy | null; nowKst: string }): string {
  const s = (o.conv ? taiConvSystem(o.gStep) : TAI_SYSTEM) + taiMarketRules(o.mirrorChart);
  let ws = '\n[세션 작업 상태] 현재 시각 ' + o.nowKst + ' (KST, Asia/Seoul).';
  if (o.ai && o.ai.chart) ws += ' 분석 대상 ' + o.ai.chart.label + ' (' + o.ai.chart.tv + '), 기준 타임프레임 ' + (TAI_TFL[o.ai.tf] || '일봉') + '.';
  if (o.strategy) {
    if (o.strategy.pair) ws += ' 전략 설정 자산 ' + o.strategy.pair + '.';
    if (o.strategy.entryMode) ws += ' 진입 방식 ' + (o.strategy.entryMode === 'dip' ? '하락 후 반등' : '추세 추종') + '.';
  }
  ws +=
    '\n[메모리 원칙] 위 작업 상태와 이전 대화에 이미 있는 정보(자산, 타임프레임, 조건, 비교 대상)는 절대 다시 묻지 말고 그대로 사용한다. "아까", "그거", "첫 번째" 같은 지시어는 이전 대화에서 지칭 대상을 찾아 해석한다. 컨텍스트에 없는 사실을 기억한다고 주장하지 않는다. 시세 등 실시간 수치는 이번 요청에 포함된 실시세 스냅샷만 근거로 쓰고, 스냅샷이 없으면 구체적 수치를 만들지 말고 확인이 필요하다고 말한다. 사용자의 새 지시가 이전 조건과 충돌하면 최신 지시를 따른다.';
  return s + ws;
}
