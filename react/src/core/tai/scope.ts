// 사용자의 말에서 종목, 봉 간격, 질문의 무게를 읽는 규칙. 화면 없는 순수 로직이다.
import type { AssetRef } from './types';

/** TAI_AST */
export const TAI_AST: [RegExp, AssetRef][] = [
  [/비트코인|비트\b|\bbtc/i, { tv: 'BINANCE:BTCUSDT', data: 'binance:BTCUSDT', label: '비트코인' }],
  [/이더리움|이더\b|\beth/i, { tv: 'BINANCE:ETHUSDT', data: 'binance:ETHUSDT', label: '이더리움' }],
  [/솔라나|\bsol\b/i, { tv: 'BINANCE:SOLUSDT', data: 'binance:SOLUSDT', label: '솔라나' }],
  [/리플|\bxrp/i, { tv: 'BINANCE:XRPUSDT', data: 'binance:XRPUSDT', label: '리플' }],
  [/도지|\bdoge/i, { tv: 'BINANCE:DOGEUSDT', data: 'binance:DOGEUSDT', label: '도지코인' }],
  [/테슬라|\btsla/i, { tv: 'NASDAQ:TSLA', data: 'yahoo:TSLA', label: '테슬라' }],
  [/애플|\baapl/i, { tv: 'NASDAQ:AAPL', data: 'yahoo:AAPL', label: '애플' }],
  [/엔비디아|\bnvda/i, { tv: 'NASDAQ:NVDA', data: 'yahoo:NVDA', label: '엔비디아' }],
  [/마이크로소프트|\bmsft/i, { tv: 'NASDAQ:MSFT', data: 'yahoo:MSFT', label: '마이크로소프트' }],
  [/아마존|\bamzn/i, { tv: 'NASDAQ:AMZN', data: 'yahoo:AMZN', label: '아마존' }],
  [/구글|알파벳|\bgoogl?/i, { tv: 'NASDAQ:GOOGL', data: 'yahoo:GOOGL', label: '알파벳' }],
  [/메타\b|\bmeta\b/i, { tv: 'NASDAQ:META', data: 'yahoo:META', label: '메타' }],
  [/삼성전자/, { tv: 'KRX:005930', data: 'yahoo:005930.KS', label: '삼성전자' }],
  [/나스닥/, { tv: 'NASDAQ:IXIC', data: 'yahoo:^IXIC', label: '나스닥 종합' }],
  [/에스앤피|s ?& ?p ?500|스탠더드/i, { tv: 'SP:SPX', data: 'yahoo:^GSPC', label: 'S&P 500' }],
];
/** taiAssetFrom(t) */
export function taiAssetFrom(t: string): AssetRef | null {
  for (const [re, a] of TAI_AST) if (re.test(t)) return a;
  return null;
}
/** taiPredictQ(t) */
export const taiPredictQ = (t: string) => /예측|전망|오를|내릴|떨어질|갈까|얼마까지|목표가|어떻게 될|살까|팔까|사도 되|사야|팔아야/.test(t);
/** taiIsStratText(t) */
export const taiIsStratText = (t: string) => /전략|자동매매|매매|매수|매도|사고|팔고|떨어|하락|급락|반등|눌림|오르|추세|상승|돌파|손절|익절|물타/.test(t || '');

/** taiTfFrom(t) */
export function taiTfFrom(t: string): string | null {
  const m = [['1분', '1m'], ['5분', '5m'], ['15분', '15m'], ['30분', '30m'], ['1시간', '1h'], ['4시간', '4h'], ['일봉', '1d'], ['하루', '1d'], ['주봉', '1w'], ['주간', '1w']];
  for (const [k, v] of m) if (t.indexOf(k) >= 0) return v;
  return null;
}
export const TAI_TFL: Record<string, string> = { '1m': '1분봉', '5m': '5분봉', '15m': '15분봉', '30m': '30분봉', '1h': '1시간봉', '4h': '4시간봉', '1d': '일봉', '1w': '주봉' };
export const TAI_SRCNM: Record<string, string> = { binance: '바이낸스', kraken: '크라켄', coinbase: '코인베이스', yahoo: '야후 파이낸스' };
export const TAI_TFTV: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' };

export type Plan = { iv: string; n: number; why: string };
/** taiScope(t,tfReq): 질문이 가리키는 기간으로 받을 봉 간격과 개수를 정한다 */
export function taiScope(t: string, tfReq: string | null): Plan {
  if (tfReq) return { iv: tfReq, n: 90, why: '명시' };
  if (/사이클|반감기|몇\s?년|장기|역대|역사상|장투/.test(t)) return { iv: '1w', n: 260, why: '거시' };
  if (/[1일]\s?년|올해|작년|연간/.test(t)) return { iv: '1d', n: 365, why: '연간' };
  if (/한\s?달|이번\s?달|월간|스윙|조정장/.test(t)) return { iv: '4h', n: 180, why: '월간' };
  if (/이번\s?주|일주일|주간|며칠|어제|요즘/.test(t)) return { iv: '1h', n: 168, why: '주간' };
  if (/새벽|오늘|아침|장중/.test(t)) return { iv: '15m', n: 192, why: '당일' };
  if (/방금|실시간|급등\s?중|급락\s?중|단타/.test(t)) return { iv: '15m', n: 96, why: '초단기' };
  return { iv: '1d', n: 90, why: '기본' };
}
/** taiIvDesc(iv,n): 간격과 개수를 사람이 읽는 기간으로 */
export function taiIvDesc(iv: string, n: number): string {
  const mins = ({ '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080 } as Record<string, number>)[iv] || 1440;
  const h = (mins * n) / 60;
  if (h < 48) return '최근 약 ' + Math.round(h) + '시간';
  if (h < 24 * 70) return '최근 약 ' + Math.round(h / 24) + '일';
  return '최근 약 ' + (h / 24 / 365).toFixed(1).replace(/\.0$/, '') + '년';
}

/** taiMarket 의 질문 무게 가르기: 시세 확인(lite), 판단(pred), 그 밖(std) */
export function taiQKind(t: string, hasAsset: boolean): { isPred: boolean; qKind: 'pred' | 'lite' | 'std' } {
  const isPred = hasAsset && taiPredictQ(t);
  const isSmallTalk = /^(안녕|하이|헬로|반가|고마워|고맙|감사|잘\s?부탁|테스트|ㅎ+|ㅋ+|hi|hello|hey|ㅎㅇ)[!~^.?요하세염\s]*$/i.test(t.trim());
  const needsWhy = /왜|이유|무슨 일|뉴스|소식|분석|흐름|어땠|정리해/.test(t);
  const qKind = isPred ? 'pred' : taiPredictQ(t) ? 'pred' : isSmallTalk ? 'lite' : hasAsset && /가격|얼마|시세|현재가/.test(t) && !needsWhy ? 'lite' : 'std';
  return { isPred, qKind };
}

/** taiMarket 의 stLb: 작업 타임라인 머리줄에 쓰는 요약 문구 */
export function taiStatusLabel(t: string, chartLabel: string | null, isPred: boolean): string {
  const A: string[] = [];
  for (let i = 0; i < TAI_AST.length && A.length < 2; i++) if (TAI_AST[i][0].test(t)) A.push(TAI_AST[i][1].label);
  const subj = A.length ? A.join('과 ') : chartLabel || '';
  if (A.length >= 2 && /비교|vs|중 어디|어느 쪽|뭐가 나|어디에 비중|둘 중/.test(t)) return A.join('과 ') + ' 중 어디에 비중을 둘지 따져보는 중';
  if (/뉴스|이유|왜 |무슨 일|소식/.test(t)) return (subj ? subj + ' ' : '') + '관련 최신 소식을 조사하는 중';
  if (/전략|자동매매|만들|위임|맡길/.test(t)) return (subj ? subj + ' ' : '') + '전략 조건을 정리하는 중';
  if (isPred) return (subj ? subj + ' ' : '시장 ') + '흐름을 보고 방향을 판단하는 중';
  if (/가격|얼마|시세|확인/.test(t) && subj) return subj + ' 현재 시세를 확인하는 중';
  let short = t.replace(/\s+/g, ' ').trim();
  if (short.length > 22) short = short.slice(0, 22) + '…';
  return '"' + short + '" 요청을 살펴보고 있습니다';
}
