// 모델에게 넘기는 값 만들기 (원본 bt v2): 판단 문장은 그날까지 알 수 있던 값만, 결과 해석은 계산된 결과 숫자만 넘긴다.
// 결정 자체(사고, 보류하고, 파는 것)는 전략의 계산이 내린다. 호출이 실패하면 지어내지 않는다.
import { FU_WHY_P, MK_CRYPTO, MK_KIND, MK_WHY_P, fngSeries, fuNeed, mkHook, mkPct0, mkPxFmt, mkTk, rsi } from './engine';
import { btAi, btRules, btUps, btYMD, seriesOf, type BtCtx, type BtR, type Dec, type Tr } from './compute';

/** btAiClean(t): 모델의 글에서 표식과 금지 부호를 걷어 낸다 */
export function btAiClean(t: string | null | undefined): string {
  return String(t || '')
    .replace(/\[(?:NEXT|ACT|TITLE|CHART|SETUP|GAUGE|ASK|TLINE)[\s\S]*$/, '')
    .replace(/[*#`>]/g, '')
    .replace(/—|–/g, ', ')
    .replace(/·/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
/** 프록시가 주는 SSE 글줄에서 답을 모은다 (btAiCall 의 응답 풀기). 못 쓰는 답이면 null */
export function btAiParse(raw: string): string | null {
  let t = '';
  let err = false;
  let ok = false;
  raw.split(/\n/).forEach((l) => {
    if (l.indexOf('data:') !== 0) return;
    try {
      const j = JSON.parse(l.slice(5));
      if (j.text) t += j.text;
      if (j.error) err = true;
      if (j.done) ok = true;
    } catch {
      /* 깨진 줄은 건너뛴다 */
    }
  });
  t = btAiClean(t);
  return err || !ok || t.length < 12 ? null : t;
}
const btR1 = (v: number | null, d?: number) => (v == null || !isFinite(v) ? null : +v.toFixed(d == null ? 1 : d));
const num = (v: number) => +mkPxFmt(v).replace(/,/g, '');

/** btJKey(d) */
export const btJKey = (B: BtCtx & { id: string | null }, d: Dec) => B.id + '|' + B.per + '|' + d.ix + '|' + d.i + '|' + d.k;

/** btFactsAt(d): 그날(i) 장 마감까지 알 수 있던 값만 모은다. i 뒤의 가격은 읽지 않는다 */
export function btFactsAt(B: BtCtx, R: BtR, d: Dec): Record<string, unknown> {
  const s = B.s;
  const c = s.cfg || {};
  const i = d.i;
  const e = d.e || {};
  const fut = !!c.fut;
  const a = d.a;
  const o: Record<string, unknown> = { 날짜: btYMD(i), 전략: mkHook(s), 판단방식: MK_KIND[s.kind] + (fut ? ', 선물 롱과 숏' + ((c.lev || 0) > 1 ? ' ' + c.lev + '배' : '') : '') };
  const series = (k: string) => seriesOf(s, k);
  if (a) {
    const P = series(a);
    const ch = (n: number) => (i - n >= 0 ? btR1((P[i] / P[i - n] - 1) * 100) : null);
    let hi = 0;
    let lo = 1e18;
    for (let k = Math.max(0, i - 19); k <= i; k++) {
      if (P[k] > hi) hi = P[k];
      if (P[k] < lo) lo = P[k];
    }
    let s20 = 0;
    let s60 = 0;
    for (let k2 = i - 19; k2 <= i; k2++) s20 += P[Math.max(0, k2)];
    for (let k3 = i - 59; k3 <= i; k3++) s60 += P[Math.max(0, k3)];
    s20 /= 20;
    s60 /= 60;
    const t: Record<string, unknown> = { 이름: a, 종가: num(P[i]), '하루 변화': ch(1), '5일 변화': ch(5), '20일 변화': ch(20), '최근 20일 고점 대비': btR1((P[i] / hi - 1) * 100), '최근 20일 저점 대비': btR1((P[i] / lo - 1) * 100), '20일 평균 가격 대비': btR1((P[i] / s20 - 1) * 100), '60일 평균 가격 대비': btR1((P[i] / s60 - 1) * 100) };
    if (c.look) t[c.look + '일 변화'] = ch(c.look);
    try {
      if (!fut) t['되돌림 점수(낮을수록 많이 밀림)'] = Math.round(rsi(P, i - 1));
    } catch {
      /* 지표를 못 내면 뺀다 */
    }
    if (c.rsiTh && !fut) t['되돌림 점수 기준'] = c.rsiTh + ' 아래';
    if (e.ref) t['돌파 기준 가격'] = num(e.ref);
    o.종목 = t;
  }
  if (e.up != null && e.of) {
    const m: Record<string, unknown> = { '비교한 종목 수': e.of, '오름세 종목 수': e.up, '오름세의 뜻': '가격이 60일 평균 위' };
    const ups = btUps(R.list, R.list.map(series), i);
    if (ups.length === e.up) m['오름세 종목'] = ups.map(mkTk);
    if (c.gate && !fut) m['매수에 필요한 오름세 종목 수'] = Math.ceil(c.gate * e.of);
    if (fut && c.gate) {
      const q = fuNeed(c, e.of);
      m['롱 기준'] = q.L + '개 이상';
      m['숏 기준'] = q.S + '개 이하';
    }
    o.시장 = m;
  }
  if (e.top && e.top.length) o['강한 순서'] = e.top.slice(0, 3).map((x) => mkTk(x.k) + ' ' + mkPct0(x.mom, 1));
  if (e.bot && e.bot.length) o['약한 순서'] = e.bot.slice(0, 3).map((x) => mkTk(x.k) + ' ' + mkPct0(x.mom, 1));
  if (e.rank) o.순위 = e.rank + '위';
  if (e.w) o.비중 = Math.round(e.w * 100) + '%';
  const f = fngSeries();
  if (f && f[i] != null && (fut || (a && MK_CRYPTO[a]))) o['공포 탐욕 지수(0 공포, 100 탐욕)'] = f[i];
  const held: string[] = [];
  R.tr.forEach((t) => {
    if (t.e <= i && (t.x == null || t.x > i)) held.push(mkTk(t.a) + (t.side ? (t.side > 0 ? ' 롱' : ' 숏') : ''));
  });
  o['그날 들고 있던 것'] = held.length ? held : '없음(현금)';
  let prev: Tr | null = null;
  R.tr.forEach((t) => {
    if (t.x != null && t.x <= i && (!prev || t.x > (prev.x as number))) prev = t;
  });
  if (prev) {
    const p = prev as Tr;
    o['직전에 끝난 거래'] = mkTk(p.a) + ' ' + mkPct0(p.pnl, 1) + ', ' + (i - (p.x as number)) + '일 전 종료';
  }
  const j = Math.max(0, Math.min(R.N - 1, d.j - 1));
  o['그날까지 전략의 누적 수익'] = mkPct0((R.eq[j].v - 1) * 100, 1);
  if (d.k === 'sell') o['이 거래'] = { 진입가: e.ep != null ? num(e.ep) : null, 청산가: e.px != null ? num(e.px) : null, 손익: mkPct0(d.pnl as number, 1), 사유: (fut ? FU_WHY_P : MK_WHY_P)[e.why as string] || '' };
  o['내려진 결정'] = d.tag + (d.tk ? ' (' + d.tk + ')' : '');
  o.규칙 = btRules(s).map((x) => x[0] + ': ' + x[1]);
  return o;
}

/** btReadFacts(): 결과 해석에 넘기는 계산된 숫자 */
export function btReadFacts(B: BtCtx, R: BtR): Record<string, unknown> {
  const s = B.s;
  const c = s.cfg || {};
  const r = R.r;
  const fut = !!c.fut;
  const cl = R.tr.filter((t) => !t.open);
  let best: Tr | null = null;
  let worst: Tr | null = null;
  cl.forEach((t) => {
    if (!best || t.pnl > best.pnl) best = t;
    if (!worst || t.pnl < worst.pnl) worst = t;
  });
  const dd = R.dd[R.N - 1];
  const diff = Math.round(R.final) - Math.round(R.benchFinal);
  const o: Record<string, unknown> = {
    전략: mkHook(s),
    판단방식: MK_KIND[s.kind],
    상품: fut ? '선물 롱과 숏, 레버리지 ' + (c.lev || 1) + '배' : '현물',
    기간: btYMD(R.eq[0].i) + '부터 ' + btYMD(R.eq[R.N - 1].i) + '까지 ' + R.N + '일',
    시작금액: '$' + B.amt.toLocaleString() + '',
    전략결과: { 남은금액: '$' + Math.round(R.final).toLocaleString() + '', 수익률: mkPct0(R.ret, 1), 가장크게내려간폭: R.mdd.toFixed(1) + '%', 가장나빴던구간: btYMD(R.eq[dd.a].i) + '부터 ' + btYMD(R.eq[dd.b].i) + '까지' },
    현물로그냥보유: { 남은금액: '$' + Math.round(R.benchFinal).toLocaleString() + '', 수익률: mkPct0(R.benchRet, 1), 가장크게내려간폭: R.benchMdd.toFixed(1) + '%' },
    그냥보유와의차이: diff === 0 ? '같음' : '전략이 ' + '$' + Math.abs(diff).toLocaleString() + ' ' + (diff > 0 ? '더 남김' : '덜 남김'),
    끝난거래: cl.length,
    이긴거래: R.wins.length,
    진거래: R.loss.length,
    평균보유일: Math.round(r.avgHold || 0),
    포지션을든기간의비율: Math.round(Math.min(100, r.exposure || 0)) + '%',
  };
  if (btAi(s)) {
    o[s.kind === 'agent' ? '다시비교한횟수' : '검토한기회'] = R.nOpp;
    o[fut ? '진입' : '매수'] = R.nBuy;
    o[s.kind === 'agent' ? '쉬어간횟수' : '보류'] = R.nSkip;
  }
  if (fut) {
    o.롱진입 = R.D.filter((d) => d.k === 'buy' && (d.side || 0) > 0).length;
    o.숏진입 = R.D.filter((d) => d.k === 'buy' && (d.side || 0) < 0).length;
    o.강제청산 = r.liqN || 0;
    o.낸펀딩비 = mkPct0(-(r.fundPaid || 0) * 100, 1) + ' (시작 금액 대비)';
  }
  if (best) o.가장좋았던거래 = mkTk((best as Tr).a) + ' ' + mkPct0((best as Tr).pnl, 1);
  if (worst) o.가장나빴던거래 = mkTk((worst as Tr).a) + ' ' + mkPct0((worst as Tr).pnl, 1);
  return o;
}
/** btReadKey() */
export const btReadKey = (B: BtCtx & { id: string | null }, R: BtR) => B.id + '|' + B.per + '|' + B.amt + '|' + R.ret.toFixed(3) + '|' + R.N;
