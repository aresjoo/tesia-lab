// 판단 패널의 질문과 자연어 수정. 원본 tfTmSayQ, tfTmSay 의 판단 부분만 옮겼다(모델 호출 없음, 엔진 값으로만 답한다).
// 화면은 돌려받은 결과를 그리기만 한다.
import { PRICE0, rsi, runBacktest, sma, tfScore } from './engine';
import { TFC, type RuleP } from './state';
import { tfTmKey, tfTmP, tfTmPct, tfTmPx, tfTmSign, tfTmWon, type TermCalc, type TermRow } from './term';

/** TF_STOP */
export const TF_STOP = [-3, -5, -8, -12];

/** 답 본문의 조각: 글자, 굵은 글자, 줄바꿈 */
export type Seg = string | { b: string } | { br: true };
export type SayAct = 'deep' | 'last' | 'close';
export type SayAns = { kind: 'ans'; title: string; body: Seg[]; acts: SayAct[]; lastQ?: string };
export type SayCap = { kind: 'cap'; old: number; n: number };
export type TmCand = { key: string; baseVer: string; pKey: string; p2: RuleP; sc2: number; r2: { ret: number; mdd: number; n: number; winRate: number } };
export type SayDiff = {
  kind: 'diff'; ver: string; rows: [string, string, string, string][];
  imp: { ret0: string; ret1: string; retCls: string; mdd0: string; mdd1: string; mddCls: string; n0: number; n1: number; sc2: number; pass: boolean };
  notes: string[]; un: string[]; msg: string; live: boolean; cand: TmCand; fields: string;
};
export type SayResult = SayAns | SayCap | SayDiff | null;

const box = (title: string, b: string): SayAns => ({ kind: 'ans', title, body: [b], acts: ['deep', 'close'] });

/** tfTmSayQ(msg,s,c): 질문 칩 넷과 예산 변경. 해당 없으면 null */
export function tfTmSayQ(msg: string, s: TermRow, c: TermCalc): SayAns | SayCap | null {
  const PRICE = PRICE0;
  const p = s.p;
  const e = p.endI;
  const rp = rsi(PRICE, e - 1);
  const chg = (PRICE[e] / PRICE[e - 1] - 1) * 100;
  const s20 = sma(PRICE, 20, e);
  const s60 = sma(PRICE, 60, e);
  const gap = s20 != null && s60 != null ? (Math.abs(s20 - s60) / PRICE[e]) * 100 : null;
  const gapS = gap == null ? '-' : gap.toFixed(1) + '%';
  let m: RegExpMatchArray | null;
  if (/(예산|운용)/.test(msg) && (m = msg.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(달러|USD|usd)?/))) {
    let n = parseFloat(m[1].replace(/,/g, '')) * 1000; /* 안쪽 값은 예전 단위, 표시는 달러 */
    if (!(n >= 100000)) return box('예산은 $100 이상으로 정합니다', '"예산 5,000달러로 바꿔줘"처럼 말해 주십시오.');
    n = Math.round(n);
    if (n === s.cap) return box('변경 사항이 없습니다', '운용 예산이 이미 ' + tfTmWon(n) + '입니다.');
    return { kind: 'cap', old: s.cap, n };
  }
  const inPos = !!(c.pos && s.status === 'live');
  if (/왜/.test(msg) && /진입/.test(msg)) {
    if (inPos) return box('이미 포지션이 있습니다', 'LONG 보유 중이라 새 진입은 없습니다. 손절 ' + p.sl + '%' + (p.tp != null ? ', 익절 +' + p.tp + '%' : '') + ', 25봉 규칙만 매 봉 점검합니다.');
    const why: string[] = [];
    if (!(rp < p.rsiTh)) why.push('전봉 RSI ' + rp.toFixed(1) + '이 임계 ' + p.rsiTh + ' 아래가 아닙니다');
    if (!(chg > 0.5)) why.push('마지막 봉 반등 ' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%로 +0.5%를 넘지 않았습니다');
    if (p.trendFilter && !((gap as number) > 3)) why.push('20/60 이평 괴리 ' + gapS + '로 3%를 넘지 않았습니다');
    return box('아직 진입하지 않은 이유', (why.length ? why.join('. ') + '.' : '마지막 봉에서 세 조건이 모두 맞아 진입 판단이 났습니다.') + ' 조건이 모두 맞는 봉 마감에만 진입합니다.');
  }
  if (/리스크/.test(msg) && !/(낮|줄|높|키|올|바꿔)/.test(msg)) {
    if (inPos && c.pos) return box('지금 가장 큰 리스크', '보유 포지션 ' + tfTmPct(c.pos.chg * 100, 1) + ', 손절선 ' + tfTmPx(c.pos.stopP) + '까지 ' + ((c.pos.curP / c.pos.stopP - 1) * 100).toFixed(1) + '% 남았습니다. 손절에 닿으면 약 ' + tfTmWon((s.cap * Math.abs(p.sl)) / 100) + ' 손실로 끝납니다.');
    let worst = 0;
    c.trades.forEach((t2) => {
      if (t2.krw < worst) worst = t2.krw;
    });
    return box('지금 가장 큰 리스크', '포지션이 없어 지금 시장 위험은 0입니다. 검증 구간 최대 낙폭은 ' + c.r.mdd.toFixed(1) + '%, 가장 큰 단일 손실은 ' + tfTmWon(worst) + '였습니다. 진입하면 손절 ' + p.sl + '% 규칙이 한 번의 손실을 약 ' + tfTmWon((s.cap * Math.abs(p.sl)) / 100) + '로 제한합니다.');
  }
  if (/진입/.test(msg) && /조건/.test(msg)) {
    return box('다음 진입 조건', '① 전봉 RSI(14)가 ' + p.rsiTh + ' 아래 (지금 ' + rp.toFixed(1) + ') ② 종가가 전봉 대비 +0.5% 초과 반등' + (p.trendFilter ? ' ③ 20/60 이평 괴리가 가격의 3% 초과 (지금 ' + gapS + ')' : '') + '. 조건이 같은 봉 마감에 모두 맞으면 시장가로 진입합니다.');
  }
  return null;
}

/** tfTmSnap(v,arr) */
export function tfTmSnap(v: number, arr: number[]): number {
  let best = arr[0];
  arr.forEach((a) => {
    if (Math.abs(a - v) < Math.abs(best - v)) best = a;
  });
  return best;
}

/** tfTmSay(msg): 질문이면 답, 수정 요청이면 재검증한 변경안 */
export function tfTmSay(msg: string, s: TermRow, c: TermCalc): SayResult {
  const p = s.p;
  const qa = tfTmSayQ(msg, s, c);
  if (qa) return qa;
  /* 설명, 분석 요청: 엔진 값으로 정해진 답 */
  if (/설명|분석|왜|어떻게/.test(msg) && !/바꿔|수정|변경|으로|낮춰|높여|올려|내려/.test(msg)) {
    const last = c.L.evs[c.L.evs.length - 1];
    const sl = /손절/.test(msg);
    return {
      kind: 'ans', title: sl ? '손절 기준' : '최근 판단',
      body: [sl
        ? '이 전략의 손절선은 진입가 대비 ' + p.sl + '%입니다. 검증 구간에서 이 규칙이 최대 낙폭을 ' + c.r.mdd.toFixed(1) + '% 안에서 관리했고, 손절 청산은 총 ' + c.trades.filter((x) => x.kind === 'sl').length + '회 실행됐습니다. 손절 폭을 좁히면 낙폭은 줄지만 거래가 짧게 끊길 수 있습니다. "손절 -3%로 바꿔줘"라고 하면 실제 재검증 수치로 비교해드립니다.'
        : '마지막 평가: ' + (last ? last.txt : '기록 없음') + '. 현재 설정은 전봉 RSI ' + p.rsiTh + ' 이하 + 반등 확인 진입, 손절 ' + p.sl + '%' + (p.tp != null ? ', 익절 +' + p.tp + '%' : '') + ' 규칙입니다. 검증 성과는 수익 ' + tfTmPct(c.r.ret) + ', MDD ' + c.r.mdd.toFixed(1) + '%, 승률 ' + Math.round(c.r.winRate || 0) + '%입니다.'],
      acts: ['deep', 'close'],
    };
  }
  /* 필드 파싱: 허용값으로 맞춘다 */
  const ch: { sl?: number; tp?: number; rsiTh?: number; trendFilter?: boolean } = {};
  const notes: string[] = [];
  const un: string[] = [];
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/손절[^0-9\-+]*(-?\d+(?:\.\d+)?)\s*%/))) {
    const sv = -Math.abs(parseFloat(m[1]));
    const sn = tfTmSnap(sv, TF_STOP);
    ch.sl = sn;
    if (sn !== sv) notes.push('손절 ' + sv + '% → 허용값 ' + sn + '%로 조정');
  }
  if ((m = msg.match(/(?:익절|목표)[^0-9]*\+?(\d+(?:\.\d+)?)\s*%/))) {
    const tv = parseFloat(m[1]);
    const tn = tfTmSnap(tv, [8, 10, 12, 15]);
    ch.tp = tn;
    if (tn !== tv) notes.push('익절 +' + tv + '% → 허용값 +' + tn + '%로 조정');
  }
  if ((m = msg.match(/RSI\s*(\d+)/i))) {
    const rv = parseInt(m[1], 10);
    const rn = tfTmSnap(rv, [38, 40, 42, 44, 46]);
    ch.rsiTh = rn;
    if (rn !== rv) notes.push('RSI ' + rv + ' → 허용값 ' + rn + '으로 조정');
  }
  if (/추세\s*필터/.test(msg)) {
    if (/(꺼|끄|제거|해제|빼)/.test(msg)) ch.trendFilter = false;
    else if (/(켜|사용|추가|넣)/.test(msg)) ch.trendFilter = true;
  }
  if ((/리스크/.test(msg) && /(낮|줄)/.test(msg)) || /보수적/.test(msg)) {
    const ci = TF_STOP.indexOf(p.sl);
    if (ci > 0) {
      ch.sl = TF_STOP[ci - 1];
      notes.push('리스크 축소 → 손절 ' + p.sl + '% → ' + ch.sl + '%');
    } else notes.push('손절이 이미 가장 타이트한 값(' + p.sl + '%)입니다');
    if (!ch.trendFilter && !p.trendFilter) {
      ch.trendFilter = true;
      notes.push('리스크 축소 → 추세 필터 추가');
    }
  }
  if (/리스크/.test(msg) && /(높|키|올)/.test(msg)) {
    const ci2 = TF_STOP.indexOf(p.sl);
    if (ci2 >= 0 && ci2 < TF_STOP.length - 1) {
      ch.sl = TF_STOP[ci2 + 1];
      notes.push('리스크 확대 → 손절 ' + p.sl + '% → ' + ch.sl + '%');
    }
  }
  /* 지금 값과 같은 칸은 변경안에서 뺀다 */
  (Object.keys(ch) as (keyof typeof ch)[]).forEach((k3) => {
    if (ch[k3] === p[k3]) delete ch[k3];
  });
  /* 지원하지 않는 구절 */
  ([[/EMA|이평.*마감|이동평균\s*\d+/i, 'EMA 조건'], [/절반|50%\s*축소|부분\s*청산/, '부분 청산 규칙'], [/레버리지|배율/, '레버리지'], [/시간대|봉\s*주기|타임프레임/i, '타임프레임 변경']] as [RegExp, string][]).forEach((u) => {
    if (u[0].test(msg)) un.push(u[1]);
  });
  const keys = Object.keys(ch);
  if (!keys.length && notes.length) {
    const body: Seg[] = [];
    notes.forEach((n, i) => {
      if (i) body.push({ br: true });
      body.push(n);
    });
    body.push({ br: true }, '현재 설정이 요청값에 가장 가까운 허용값이라 바꿀 것이 없습니다.');
    return { kind: 'ans', title: '조정하면 지금 설정과 같아집니다', body, acts: ['close'] };
  }
  if (!keys.length) {
    const body: Seg[] = un.length
      ? ['지원: 손절(%), 익절(%), 진입 RSI 임계, 추세 필터 켜기/끄기, 리스크 낮춰/높여. 요청하신 ', { b: un.join(', ') }, '은 아직 규칙 엔진이 지원하지 않아 적용할 수 없습니다.']
      : ['지원: 손절(%), 익절(%), 진입 RSI 임계, 추세 필터 켜기/끄기, 리스크 낮춰/높여.'];
    return { kind: 'ans', title: '이 요청은 아직 자동 변환을 지원하지 않습니다', body, acts: ['last', 'close'], lastQ: msg };
  }
  const p2: RuleP = { sl: ch.sl != null ? ch.sl : p.sl, tp: ch.tp != null ? ch.tp : p.tp, rsiTh: ch.rsiTh != null ? ch.rsiTh : p.rsiTh, trendFilter: ch.trendFilter != null ? ch.trendFilter : p.trendFilter, startI: p.startI, endI: p.endI };
  if (tfTmKey(tfTmP(p2)) === tfTmKey(p)) return { kind: 'ans', title: '변경 사항이 없습니다', body: ['요청한 값이 현재 설정과 같습니다. 버전을 만들지 않았습니다.'], acts: ['close'] };
  const r2 = runBacktest(p2);
  const sc2 = tfScore(r2);
  const pass = sc2 >= TFC.score.pass;
  const rows: [string, string, string, string][] = [];
  if (ch.sl != null) rows.push(['손절선', p.sl + '%', p2.sl + '%', (p2.sl > p.sl ? '▲' : '▼') + ' ' + (p2.sl - p.sl) + '%p']);
  if (ch.tp != null) rows.push(['익절 목표', p.tp != null ? '+' + p.tp + '%' : '없음', '+' + p2.tp + '%', p.tp != null ? ((p2.tp as number) > p.tp ? '▲' : '▼') + ' ' + ((p2.tp as number) - p.tp) + '%p' : '신설']);
  if (ch.rsiTh != null) rows.push(['진입 RSI 임계', String(p.rsiTh), String(p2.rsiTh), (p2.rsiTh > p.rsiTh ? '▲' : '▼') + ' ' + (p2.rsiTh - p.rsiTh)]);
  if (ch.trendFilter != null) rows.push(['추세 필터', p.trendFilter ? '사용' : '미사용', p2.trendFilter ? '사용' : '미사용', p2.trendFilter ? '추가' : '제거']);
  return {
    kind: 'diff', ver: s.ver, rows,
    imp: { ret0: tfTmPct(c.r.ret), ret1: tfTmPct(r2.ret), retCls: tfTmSign(r2.ret - c.r.ret), mdd0: c.r.mdd.toFixed(1) + '%', mdd1: r2.mdd.toFixed(1) + '%', mddCls: tfTmSign(r2.mdd - c.r.mdd), n0: c.r.n, n1: r2.n, sc2, pass },
    notes, un, msg, live: s.status === 'live',
    cand: { key: s.key, baseVer: s.ver, pKey: tfTmKey(p), p2, sc2, r2: { ret: r2.ret, mdd: r2.mdd, n: r2.n, winRate: r2.winRate } },
    fields: keys.join(','),
  };
}
