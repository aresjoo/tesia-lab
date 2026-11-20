// 작업 타임라인의 글 규칙 (actHeadSync, actRenderFinal 의 계산 부분).
import type { ActData } from './types';

/** 진행 중 머리줄: 돌고 있는 마지막 단계의 문구, 없으면 처음 정한 문구 */
export function actHeadLabel(d: ActData): string {
  const running = d.steps.filter((x) => x.status === 'running');
  return running.length ? running[running.length - 1].h || d.label : d.label;
}
/** 끝난 뒤 머리줄: 「작업 완료, 3단계, 12초」. 여러 번 나뉜 생각과 답변 줄은 종류마다 한 단계로 센다 */
export function actFinalHead(d: ActData): string {
  const seen: Record<string, number> = {};
  let n = 0;
  d.steps.forEach((s) => {
    if (s.kind === 'note') return;
    if (s.kind === 'think' || s.kind === 'ans') {
      if (seen[s.kind]) return;
      seen[s.kind] = 1;
    }
    n++;
  });
  const secs = d.ms ? Math.round(d.ms / 1000) + '초' : '';
  const miss = d.missing && d.missing.length ? ', ' + d.missing.join(', ') + ' 없음' : '';
  return d.status === 'done' ? '작업 완료, ' + n + '단계' + (secs ? ', ' + secs : '') + miss : d.status === 'abort' ? '작업 중단, ' + n + '단계' : '작업 오류, ' + n + '단계';
}

/** gConvInterpret 의 읽기: 문장에서 진입 방식, 자산, 손절과 익절 숫자를 찾는다 */
export function readIdea(text: string): { entryMode: string | null; pair: string | null; sl: number | null; tp: number | null } {
  const dip = /떨어|하락|급락|폭락|반등|저가|눌림|물타/.test(text);
  const trend = /오르|추세|상승|따라|돌파/.test(text);
  let entryMode: string | null = null;
  if (dip) entryMode = 'dip';
  if (trend) entryMode = 'trend';
  let pair: string | null = null;
  if (/이더리움|이더|eth/i.test(text)) pair = 'ETH/USDT';
  else if (/비트코인|비트|btc/i.test(text)) pair = 'BTC/USDT';
  const mSl = text.match(/[--]?\s*(\d+(?:\.\d+)?)\s*%[^0-9%]{0,4}손절/) || text.match(/(?:손절|손실)[^0-9%]{0,6}[--]?\s*(\d+(?:\.\d+)?)\s*%/);
  const tTp = mSl ? text.replace(mSl[0], ' ') : text;
  const mTp = tTp.match(/\+?\s*(\d+(?:\.\d+)?)\s*%[^0-9%]{0,4}익절/) || tTp.match(/(?:익절|목표)[^0-9%]{0,6}\+?\s*(\d+(?:\.\d+)?)\s*%?/);
  return { entryMode, pair, sl: mSl ? Math.abs(parseFloat(mSl[1])) : null, tp: mTp ? Math.abs(parseFloat(mTp[1])) : null };
}
