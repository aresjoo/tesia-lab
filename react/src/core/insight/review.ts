// 거래복기(#/review/<id>)와 주간, 월간 보고서(#/periodic/<id>)의 화면 없는 규칙.
// 원본 index.html 의 tfReviewCommit, tfPeriodicCheck, tfReviewView, tfPeriodicView 의 계산을 옮겼다.
import type { TfBot } from './insight';

/** 원본 TFC.rebate.rate (teth-copy.js) */
export const REBATE_RATE = 0.1;

export type Review = { id: string; fid?: string; botId?: string; asset: string; kind?: string; kindL: string; pnl: number; at: number; budget: number; causes: [string, string][]; sim?: boolean };
export type Periodic = { id: string; kind: string; label: string; from?: number | null; until: number; n: number; wins: number; pnl: number; rebate: number; sim?: boolean; at?: number };
export type Rebate = { fid?: string; botId?: string; amt: number; at: number; sim?: boolean };
export type Fill = { fid: string; pnl: number; kind?: string; at: number };
export type RuleP = { sl: number; tp: number | null; rsiTh: number; trendFilter?: boolean };

/** tfWon(n): 원 단위 장부 값을 달러 표기로 */
export const tfWon = (n: number) => '$' + Math.round((+n || 0) / 1000).toLocaleString();
/** 손익 비율을 +1.2% 꼴로 */
export const pnlPct = (pnl: number) => (pnl >= 0 ? '+' : '') + (pnl * 100).toFixed(1) + '%';

/** tfBotFind(id) */
export const tfBotFind = (strat: (TfBot | null)[] | undefined, id: string | undefined) => (strat || []).find((x) => !!x && String(x.at) === String(id)) || undefined;

/** tfReviewCommit(botId,f,p,asset,budget): 체결 하나의 복기를 만든다. 엔진이 남긴 신호만 인용한다 */
export function tfReviewCommit(botId: string, f: Fill, p: RuleP, asset: string, budget: number): Review {
  const rid = 'rv' + f.fid;
  const kindL = ({ sl: '손절', tp: '익절', time: '기간 청산' } as Record<string, string>)[f.kind || ''] || '청산';
  const won = f.pnl >= 0;
  const causes: [string, string][] = [];
  if (won) {
    causes.push(['진입 근거', 'RSI ' + p.rsiTh + ' 이하로 눌린 뒤 전일 대비 +0.5% 반등이 확인된 봉에서 진입했습니다.' + (p.trendFilter ? ' 추세 필터(20일/60일 이평 괴리)가 통과된 구간이었습니다.' : '')]);
    causes.push(['청산 근거', f.kind === 'tp' ? '설정한 익절 목표 +' + p.tp + '% 에 도달해 규칙대로 청산했습니다.' : f.kind === 'time' ? '보유 25일 경과로 기간 청산 규칙이 실행됐습니다.' : '설정한 청산 규칙이 실행됐습니다.']);
    causes.push(['다음 제안', '같은 조건이 유지되면 규칙을 바꾸지 않는 것이 검증 결과와 일치합니다.']);
  } else {
    causes.push(['손실 원인', '진입 후 반등이 이어지지 못하고 가격이 손절선 ' + p.sl + '% 에 먼저 닿았습니다. 손절 규칙이 작동해 손실을 ' + (f.pnl * 100).toFixed(1) + '% 로 제한했습니다.']);
    causes.push(['규칙 평가', '손절 규칙이 설정된 폭 안에서 그대로 작동한 거래입니다.']);
    causes.push(['다음 제안', '진입 조건(RSI ' + p.rsiTh + ')과 손절 폭은 검증 화면에서 다시 조정해 재검증할 수 있습니다.']);
  }
  return { id: rid, fid: f.fid, botId, asset, kind: f.kind, kindL, pnl: f.pnl, at: f.at, budget, causes, sim: true };
}

/** tfPeriodicCheck(): 지난 주와 지난 달의 보고서를 기간이 끝난 뒤 한 번씩 만든다. 새로 만든 것만 돌려준다 */
export function tfPeriodicCheck(reviews: Review[], rebates: Rebate[], periodics: Periodic[], now = new Date()): Periodic[] {
  if (!reviews.length && !rebates.length) return [];
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const made: Periodic[] = [];
  const cfgs: [string, number, number, string][] = [
    ['W', weekStart.getTime() - 7 * 864e5, weekStart.getTime(), '주간'],
    ['M', prevMonthStart, monthStart.getTime(), '월간'],
  ];
  cfgs.forEach(([kind, from, boundary, label]) => {
    const evs = reviews.filter((r) => r.at >= from && r.at < boundary);
    if (!evs.length) return;
    const pid = kind + ':' + new Date(boundary - 1).toISOString().slice(0, 10);
    if (periodics.some((p) => p.id === pid)) return;
    const wins = evs.filter((r) => r.pnl > 0).length;
    const pnl = evs.reduce((a, r) => a + r.pnl, 0);
    const rb = rebates.filter((r) => r.at >= from && r.at < boundary).reduce((a, r) => a + r.amt, 0);
    made.push({ id: pid, kind, label, from, until: boundary, n: evs.length, wins, pnl, rebate: rb, sim: true, at: now.getTime() });
  });
  return made;
}

/** tfReviewView(id) 의 단계 표: 이름 > [영문 꼬리표, 색 class, 아이콘] */
export const REVIEW_STEP: Record<string, [string, string, 'doc' | 'trend' | 'warn' | 'star']> = {
  '진입 근거': ['ENTRY', 'e', 'doc'],
  '청산 근거': ['EXIT', 'x', 'trend'],
  '손실 원인': ['CAUSE', 'r', 'warn'],
  '규칙 평가': ['RULE', 'x', 'doc'],
  '다음 제안': ['SUGGESTION', 'g', 'star'],
};
/** tfReviewView(id): 이 복기가 든 기간 보고서 */
export const reviewPeriodic = (r: Review, periodics: Periodic[]) => periodics.find((x) => r.at < x.until && (x.from == null || r.at >= x.from));
/** tfReviewView(id): 수수료 적립 (명목 x 수수료율 x 적립률) */
export const reviewRebate = (r: Review) => Math.round(r.budget * 0.002 * REBATE_RATE);

/** tfPeriodicView(id): 승률(%)과 기간 안의 복기 열 건 */
export const periodicWr = (p: Periodic) => (p.n ? Math.round((p.wins / p.n) * 100) : 0);
export const periodicEvs = (p: Periodic, reviews: Review[]) => reviews.filter((r) => r.at < p.until && (p.from == null || r.at >= p.from)).slice(0, 10);
export const koDate = (at: number) => new Date(at).toLocaleDateString('ko-KR');
