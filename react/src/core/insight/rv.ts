// 아쉬운 백테스트 결과 뒤의 행동(원본 rv*) 가운데 화면 없는 규칙.
// 나쁨 판정, 규칙을 풀어 쓴 문장, 바뀐 조건 하나 고르기, 이전 판과의 비교 문장, AI 에게 보내는 숨은 지시문.
// 단추와 카드(rvActs, rvCompare 의 마크업, rvProposal)는 백테스트 결과 화면과 대화 화면에 붙는 것이라 그 조각에서 이 함수들을 부른다.

/** 백테스트 결과에서 rv 가 읽는 것 (원본 BT.R) */
export type RvResult = { wins: unknown[]; loss: unknown[]; final: number; benchFinal: number; ret: number; mdd: number; benchRet: number; benchMdd: number };
export type RvDepth = 'shallow' | 'mid' | 'deep';
export type RvSpec = { asset: string; depth: RvDepth | string; tp: number | null; sl: number; fng: number | null; trend: boolean; period: string; name: string | null; change?: string | null };
/** 원본 tfS().aiSpec, tfS().intake 가운데 rv 가 읽는 것 */
export type RvAiSpec = { rsiTh?: number; tp?: number | null; sl?: number; fng?: number | null; tf?: boolean; name?: string | null };
export type RvIntake = { asset?: { label?: string }; period?: { i?: number } };
/** 이전 판 (원본 tfS().btVers 의 한 칸, rvSnapNow 가 만든다) */
export type RvSnap = { at: number; spec: RvSpec; rule: string; ai: RvAiSpec; pi?: number; per: string; amt: number; ret: number; mdd: number; n: number; bench: number; final: number };

/** mkPct0(v,d) */
export function mkPct0(v: number, d?: number): string {
  const n = d != null ? d : 1;
  const x = +v.toFixed(n);
  return (x > 0 ? '+' : '') + x.toFixed(n) + '%';
}
/** mkSign(v): 오르면 ' mk-up', 내리면 ' mk-dn' */
export function mkSign(v: number): string {
  const x = +v.toFixed(1);
  return x > 0 ? ' mk-up' : x < 0 ? ' mk-dn' : '';
}

/** rvTrades() */
export const rvTrades = (R: RvResult | null) => (R ? R.wins.length + R.loss.length : 0);
/** rvBad(): 시작 돈보다 줄었거나 그냥 보유보다 낮으면 나쁨. 단추 순서의 기준일 뿐 딱지가 아니다 */
export function rvBad(R: RvResult | null, amt: number): boolean {
  if (!R || !rvTrades(R)) return false;
  return R.final < amt || R.final < R.benchFinal;
}
/** rvSpecNow() */
export function rvSpecNow(aiSpec: RvAiSpec | null | undefined, intake: RvIntake | null | undefined): RvSpec {
  const s = aiSpec || {};
  const iv = intake || {};
  const depth: RvDepth = (s.rsiTh as number) >= 52 ? 'shallow' : (s.rsiTh as number) <= 38 ? 'deep' : 'mid';
  return {
    asset: (iv.asset || {}).label || '',
    depth,
    tp: s.tp == null ? null : s.tp,
    sl: s.sl as number,
    fng: s.fng == null ? null : s.fng,
    trend: !!s.tf,
    period: ['1y', '2y', 'all'][(iv.period || {}).i || 0] || '1y',
    name: s.name || null,
  };
}
/** rvRuleText(sp): 규칙을 사는 때와 파는 때로 풀어 쓴다 */
export function rvRuleText(sp: RvSpec): string {
  const dep = ({ shallow: '조금', mid: '적당히', deep: '크게' } as Record<string, string>)[sp.depth] || '적당히';
  return (
    '사는 때: ' +
    sp.asset +
    '이 ' +
    dep +
    ' 밀렸다가 하루 0.5% 넘게 반등한 날' +
    (sp.trend ? ', 방향이 뚜렷할 때만' : '') +
    (sp.fng != null ? ', 공포 탐욕 지수 ' + sp.fng + ' 이하일 때만' : '') +
    '. 파는 때: ' +
    (sp.tp != null ? '산 가격보다 ' + sp.tp + '% 오르거나 ' : '') +
    Math.abs(sp.sl) +
    '% 내리면, 또는 25일이 지나면'
  );
}
/** rvSnapNow(): 지금 판을 이전 판으로 남길 꼴 */
export function rvSnapNow(R: RvResult, aiSpec: RvAiSpec | null | undefined, intake: RvIntake | null | undefined, per: string, amt: number, at = Date.now()): RvSnap {
  const sp = rvSpecNow(aiSpec, intake);
  return { at, spec: sp, rule: rvRuleText(sp), ai: JSON.parse(JSON.stringify(aiSpec || {})), pi: ((intake || {}).period || {}).i, per, amt, ret: R.ret, mdd: R.mdd, n: rvTrades(R), bench: R.benchRet, final: R.final };
}

/** rvOne(sp): AI 가 준 설정에서 바뀐 항목을 하나만 받아들인다 */
export function rvOne(sp: Partial<RvSpec> & { change?: string | null }, cur: RvSpec): RvSpec {
  const F = ['depth', 'tp', 'sl', 'fng', 'trend'] as const;
  type K = (typeof F)[number];
  let ch: K | null = sp && (F as readonly string[]).indexOf(sp.change || '') >= 0 ? (sp.change as K) : null;
  if (!ch) {
    const d = F.filter((k) => String(sp[k]) !== String(cur[k]));
    ch = d[0] || null;
  }
  const out: RvSpec = { ...cur };
  if (ch) {
    (out as Record<string, unknown>)[ch] = sp[ch];
    if (ch === 'sl') out.sl = -Math.abs(Number(sp.sl) || 5);
    if (ch === 'tp') out.tp = sp.tp == null ? null : Number(sp.tp);
    if (ch === 'fng') out.fng = sp.fng == null ? null : Number(sp.fng);
    if (ch === 'trend') out.trend = !!sp.trend;
  }
  out.change = ch;
  return out;
}
/** rvChangeText(cur,sp): 바뀔 조건을 한 문장으로 */
export function rvChangeText(cur: RvSpec, sp: RvSpec): string {
  const k = sp.change;
  const pct = (v: number | null) => (v == null ? null : Math.abs(v) + '%');
  if (k === 'tp') return cur.tp == null ? '산 가격보다 ' + pct(sp.tp) + ' 오르면 파는 조건을 새로 넣습니다' : sp.tp == null ? '산 가격보다 ' + pct(cur.tp) + ' 오르면 팔던 조건을 없앱니다' : '산 가격보다 ' + pct(cur.tp) + ' 오르면 팔던 조건을 ' + pct(sp.tp) + '로 바꿉니다';
  if (k === 'sl') return '산 가격보다 ' + pct(cur.sl) + ' 내리면 팔던 조건을 ' + pct(sp.sl) + '로 바꿉니다';
  if (k === 'fng') return cur.fng == null ? '공포 탐욕 지수 ' + sp.fng + ' 이하일 때만 사는 조건을 새로 넣습니다' : sp.fng == null ? '공포 탐욕 지수 ' + cur.fng + ' 이하일 때만 사던 조건을 없앱니다' : '공포 탐욕 지수 ' + cur.fng + ' 이하일 때만 사던 조건을 ' + sp.fng + ' 이하로 바꿉니다';
  if (k === 'depth') {
    const D: Record<string, string> = { shallow: '조금', mid: '적당히', deep: '크게' };
    return '사기 전에 밀리는 정도를 "' + (D[cur.depth] || '적당히') + '"에서 "' + (D[sp.depth] || '적당히') + '"로 바꿉니다';
  }
  if (k === 'trend') return sp.trend ? '방향이 뚜렷할 때만 사는 조건을 켭니다' : '방향이 뚜렷할 때만 사던 조건을 끕니다';
  return '조건 하나를 바꿉니다';
}

/** rvCompare() 의 판단: 같은 기간과 금액일 때만 숫자를 나란히 놓고, 그때의 요약 문장 */
export function rvCompareSum(v: RvSnap, R: RvResult, per: string, amt: number): { same: boolean; sum: string } {
  const same = v.per === per && v.amt === amt;
  const up = R.ret > v.ret;
  const sum = same
    ? '수정 후 수익률은 ' +
      mkPct0(v.ret, 1) +
      '에서 ' +
      mkPct0(R.ret, 1) +
      '로 ' +
      (up ? '높아졌습니다' : R.ret < v.ret ? '낮아졌습니다' : '같습니다') +
      '. 가장 크게 내려간 폭은 ' +
      Math.abs(v.mdd).toFixed(1) +
      '%에서 ' +
      Math.abs(R.mdd).toFixed(1) +
      '%로 ' +
      (Math.abs(R.mdd) < Math.abs(v.mdd) ? '줄었습니다' : Math.abs(R.mdd) > Math.abs(v.mdd) ? '커졌습니다' : '같습니다') +
      '.'
    : '';
  return { same, sum };
}

/** rvHidden(): 규칙 수정 대화를 여는 숨은 지시문. facts 는 원본 btReadFacts() 의 결과 */
export function rvHidden(sp: RvSpec, facts: unknown): string {
  return (
    '[규칙 수정 요청] 내가 만든 전략을 백테스트했더니 결과가 아쉽다. 규칙 하나만 고쳐 다시 검증하려고 한다.\n지금 규칙: ' +
    rvRuleText(sp) +
    '\n설정값: ' +
    JSON.stringify(sp) +
    '\n결과: ' +
    JSON.stringify(facts) +
    '\n지시 1(지금): 아직 바꿀 조건을 정하지 마라. 합니다체 2문장으로 짧게 답하라. 첫 문장은 결과에서 가장 눈에 띄는 숫자 하나(예: 24번 중 14번이 손실로 끝났습니다), 둘째 문장은 "어느 쪽을 바꿔 보겠습니까? 아래에서 고르시거나 원하는 방향을 적어 주십시오."처럼 방향을 묻는 말. 그리고 [ASK] 태그로 질문 하나를 붙여라: title은 "어느 조건을 바꿔 보겠습니까?", multi는 false, options는 이 결과에 맞는 수정 방향 4개. 각 선택지 t는 10자 안팎의 짧은 이름(예: 파는 조건 넓히기, 사는 조건 까다롭게, 오르면 파는 조건 추가, 방향 확인 켜기), d는 무엇이 바뀌고 무엇을 기대하는지 한 문장(결과 숫자 근거). 결과 근거로 가장 먼저 비교해 볼 선택지를 첫째에 두고 d 끝에 "(추천)"을 붙여라. 이번 답에는 [STRATEGY] 태그를 붙이지 마라.' +
    '\n지시 2(사용자가 고르거나, 직접 적거나, 알아서 판단해 달라고 한 다음 답): 그 방향에서 바꿔 볼 조건을 정확히 하나만 고르고, 그 대가(예: 더 오래 들면 수익과 손실 폭이 함께 커질 수 있음)를 함께 말하라. 원인을 단정하지 말고 "비교해 볼 값"으로 말하고, 더 좋은 결과를 뜻하지 않는다고 덧붙여라. 합니다체 3~4문장. 익절, 손절 같은 용어 대신 "산 가격보다 8% 오르면 파는 조건"처럼 풀어 써라. 검색과 도구는 쓰지 마라. 그 답에는 질문 카드(ASK), 선택 칩(NEXT), 실행(ACT) 태그를 붙이지 마라. 다음 답의 마지막 줄에 바뀐 설정 전체를 [STRATEGY {...}] 태그로 붙이되 "change" 키에 바꾼 항목 이름 하나(depth, tp, sl, fng, trend 중 하나)를 넣어라. asset, period, name은 그대로 두고 바꾼 값 하나만 다르게 하라.'
  );
}
/** rvNew() 의 숨은 지시문. hook 은 원본 mkHook(s) 의 결과 */
export function rvNewHidden(hook: string, facts: unknown): string {
  return (
    '[새 전략 요청] "' +
    hook +
    '" 전략을 백테스트했더니 결과가 아쉽다. 결과: ' +
    JSON.stringify(facts) +
    '\n지시: 이 결과를 근거로 같은 자산에서 접근이 다른 전략 방향 2가지를 짧게 제안하고, 어느 쪽으로 갈지 물어라. 각 방향은 사는 때와 파는 때를 한 문장씩. 합니다체. 더 좋은 결과를 보장하지 않는다고 덧붙여라. 검색과 도구는 쓰지 마라. 아직 [STRATEGY] 태그는 붙이지 말고, 사용자가 방향을 고르면 그때 붙여라.'
  );
}
/** rvDraft(): AI 를 못 부르면 입력창에 넣는 초안 */
export const rvDraftText = (sp: RvSpec) => '지금 규칙: ' + rvRuleText(sp) + '. 결과가 그냥 보유보다 낮았습니다. 파는 조건 하나를 바꿔 다시 검증하고 싶습니다.';
