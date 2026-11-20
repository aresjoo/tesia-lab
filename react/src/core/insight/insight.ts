// 인사이트의 화면 없는 규칙: 목록 고르기, 시간 표기, 주제 집계, 손님 본문 자르기, 공유 주소, 맞춤 글.
// 원본 index.html 의 tfIns2* 를 같은 이름으로 옮겼다. 글과 저자 표는 insight.data.ts (생성 파일).
import { INS_TAG_KO, TF_INS2, TF_INS2_AUTH, type InsAuthor, type InsPost, type InsSec } from './insight.data';

/** TF_INS2_T0: 세션 고정 기준시각 (상대시간과 노출 필터의 단일 기준) */
export const TF_INS2_T0 = Date.now();

/** tfIns2Of(slug) */
export function tfIns2Of(slug: string): InsPost | null {
  return TF_INS2.find((p) => p.slug === slug) || null;
}
/** tfIns2Ts(p) */
export const tfIns2Ts = (p: InsPost) => TF_INS2_T0 - p.min * 60000;
/** tfIns2Ago(ts): 60분 안은 N분 전, 24시간 안은 약 N시간 전, 그 뒤는 N일 전 */
export function tfIns2Ago(ts: number): string {
  const ms = Math.max(0, TF_INS2_T0 - ts);
  if (ms < 60 * 60000) return Math.max(1, Math.floor(ms / 60000)) + '분 전';
  if (ms < 24 * 3600000) return '약 ' + Math.max(1, Math.floor(ms / 3600000)) + '시간 전';
  return Math.max(1, Math.floor(ms / 86400000)) + '일 전';
}
/** tfIns2Fresh(p): 최근 72시간까지만 보인다 (홈, 많이 읽는 글, 다음 글 공통) */
export const tfIns2Fresh = (p: InsPost) => p.min <= 72 * 60;
/** tfIns2Rows() */
export const tfIns2Rows = () =>
  TF_INS2.filter(tfIns2Fresh)
    .slice()
    .sort((a, b) => a.min - b.min);
/** tfIns2Trend() */
export const tfIns2Trend = () =>
  TF_INS2.filter(tfIns2Fresh)
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 5);
/** tfIns2Url(slug): 공유할 주소 (지금 문서의 주소 + 해시) */
export const tfIns2Url = (base: string, slug: string) => base + '#/insight/' + slug;
/** tfIns2AuOf(id) */
export const tfIns2AuOf = (id: string): InsAuthor => TF_INS2_AUTH[id] || TF_INS2_AUTH.a1;
/** tfIns2Meta(p): "이름, 약 N시간 전" */
export const tfIns2Meta = (p: InsPost) => tfIns2AuOf(p.au).nm + ', ' + tfIns2Ago(tfIns2Ts(p));
/** tfIns2DateLine() */
export function tfIns2DateLine(d = new Date()): string {
  return d.getMonth() + 1 + '월 ' + d.getDate() + '일';
}
/** tfInsTagKo(t): 영어 태그를 한국어 이름으로 (주소는 영어 그대로) */
export function tfInsTagKo(t: string): string {
  return INS_TAG_KO[String(t || '').toLowerCase()] || t;
}

/** tfIns2Md(s): **굵게** 만 푼다. 굵은 조각은 b: true */
export function tfIns2Md(s: string): { t: string; b: boolean }[] {
  const out: { t: string; b: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), b: false });
    out.push({ t: m[1], b: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), b: false });
  return out;
}

/** tfIns2Home(tag) 의 주제 집계: 많이 달린 태그 12개 */
export function insTopics(): string[] {
  const tcnt: Record<string, number> = {};
  TF_INS2.filter(tfIns2Fresh).forEach((p) => p.tags.forEach((t) => (tcnt[t] = (tcnt[t] || 0) + 1)));
  return Object.keys(tcnt)
    .sort((a, b) => tcnt[b] - tcnt[a])
    .slice(0, 12);
}
/** tfIns2Home(tag) 의 자리 나누기: 태그가 없으면 머리 글 하나(lv 1), 왼쪽 작은 둘(lv 2), 나머지는 아래 그리드 */
export function insHomeRows(tag: string | null): { rows: InsPost[]; head: InsPost | null; t1: InsPost[]; t3: InsPost[] } {
  let rows = tfIns2Rows();
  if (tag) {
    const tg = String(tag).toLowerCase();
    rows = rows.filter((p) => p.tags.indexOf(tg) >= 0);
  }
  let head: InsPost | null = null;
  const t1: InsPost[] = [];
  const t3: InsPost[] = [];
  rows.forEach((p) => {
    if (!tag && p.lv === 1 && !head) head = p;
    else if (!tag && p.lv === 2 && t1.length < 2) t1.push(p);
    else t3.push(p);
  });
  return { rows, head, t1, t3 };
}

/** tfIns2View(slug) 의 본문 자르기: 손님은 글 단락 둘까지만, 잘린 뒤의 글은 화면에 싣지 않는다 */
export function insBodyFor(p: InsPost, guest: boolean): InsSec[] {
  const cut = guest ? 2 : 1e9;
  let txtSeen = 0;
  const out: InsSec[] = [];
  for (const sc of p.body) {
    if (sc.h) {
      txtSeen++;
      if (txtSeen > cut) break;
      out.push(sc);
    } else if (sc.q) {
      if (guest && txtSeen >= cut) break;
      out.push(sc);
    } else if (sc.fig) {
      if (guest && txtSeen >= cut) break;
      out.push(sc);
    }
  }
  return out;
}
/** tfIns2View(slug) 의 다음 글 넷 */
export const insNext = (slug: string) =>
  TF_INS2.filter((x) => x.slug !== slug && tfIns2Fresh(x))
    .sort((a, b) => a.min - b.min)
    .slice(0, 4);

/** tfIns2Sh(net,slug) 의 공유 주소 */
export function insShareUrl(net: 'fb' | 'x' | 'in', base: string, slug: string): string {
  const u = tfIns2Url(base, slug);
  const p = tfIns2Of(slug);
  const tt = p ? p.title : 'TETH 인사이트';
  return net === 'fb'
    ? 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u)
    : net === 'x'
      ? 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tt) + '&url=' + encodeURIComponent(u)
      : 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u);
}

/** tfIns2AssetGo() 가 TETH 에게 보내는 질문 */
export function insAssetAsk(q0: { sym: string; name: string; t: string }, extra: string): string {
  return (
    q0.name + '(' + q0.sym + ')의 현재 시장 상태를 분석해줘. 최근 가격 흐름, 주요 뉴스, 변동성, 핵심 기술적 구간과, 방금 읽은 인사이트 "' + (q0.t || '') + '" 내용과의 관련성을 함께 설명해줘.' + (extra ? ' 추가로 궁금한 점: ' + extra : '')
  );
}

/** tfInsRoute(h): 주소를 화면으로 */
export type InsRoute = { k: 'home'; tag: string | null; toast?: string } | { k: 'email' } | { k: 'p'; token: string } | { k: 'view'; slug: string };
export function tfInsRoute(h: string): InsRoute {
  let m: RegExpMatchArray | null;
  if (h === '#/insight') return { k: 'home', tag: null };
  if (h === '#/insight/email') return { k: 'email' };
  if ((m = h.match(/^#\/insight\/t\/([^/]+)$/))) {
    let tg: string | null = null;
    try {
      tg = decodeURIComponent(m[1]);
    } catch {
      /* 풀 수 없는 주소 */
    }
    if (!tg) return { k: 'home', tag: null, toast: '잘못된 태그 주소입니다' };
    return { k: 'home', tag: tg };
  }
  if ((m = h.match(/^#\/insight\/p\/([A-Za-z0-9.-]+)$/))) return { k: 'p', token: m[1] };
  if ((m = h.match(/^#\/insight\/([A-Za-z0-9-]+)$/))) return { k: 'view', slug: m[1] };
  return { k: 'home', tag: null, toast: '페이지를 찾을 수 없습니다' };
}

/* ── 맞춤 글: 계정의 실제 상태에서 만든다 ── */

export type TfBot = { name?: string; status?: string; ret?: number | null; mdd?: number | null; score?: number | null; at?: number | string };
/** 원본 tfS() 가운데 인사이트가 읽는 것만 */
export type TfForIns = { strat?: (TfBot | null)[]; fillLog?: unknown[]; fills?: unknown[]; reviews?: unknown[]; intake?: { asset?: { label?: string } } | null };
export type InsPInfo = { st: 'b'; bot: TfBot; run: boolean } | { st: 'c'; bot: TfBot | null; lastAt: TfBot['at'] | null } | { st: 'a'; asset: string | null };

/** tfIns2PInfo(): 로그인 여부, 전략 상태, 대화 수로 맞춤 글의 종류를 정한다 */
export function tfIns2PInfo(user: boolean, t: TfForIns, sessions: number): InsPInfo | null {
  if (!user) return null;
  const st = t.strat || [];
  /* 알 수 없는 상태가 하나라도 있으면 맞춤 글을 만들지 않는다 */
  if (st.some((x) => !x || ['live', 'off', 'ready', 'paused', 'err'].indexOf(x.status || '') < 0)) return null;
  let live: TfBot | null = null;
  let ready: TfBot | null = null;
  let any: TfBot | null = null;
  for (const x of st) {
    if (!x) continue;
    if (x.status === 'live' && !live) live = x;
    if (x.status === 'ready' && !ready) ready = x;
    if (!any) any = x;
  }
  const lr = live || ready;
  if (lr) return { st: 'b', bot: lr, run: !!live };
  const had = st.length || (t.fillLog || []).length || (t.fills || []).length || (t.reviews || []).length;
  if (had) return { st: 'c', bot: any, lastAt: any ? any.at : null };
  const label = (t.intake && t.intake.asset && t.intake.asset.label) || null;
  const sig = label || sessions > 0;
  if (!sig) return null;
  return { st: 'a', asset: label };
}
/** tfIns2PTok(): 종류와 발행 날짜(UTC) */
export function tfIns2PTok(i: InsPInfo | null, d = new Date()): string | null {
  if (!i) return null;
  const z = (n: number) => (n < 10 ? '0' : '') + n;
  return i.st + '-' + d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate());
}
/** tfIns2BotAsset(b) */
export const tfIns2BotAsset = (b: TfBot | null) => (b && b.name ? b.name.replace(' 위임 전략', '') : '비트코인');

/** tfNFTime(at) */
export function tfNFTime(at: number, now = Date.now()): string {
  const d = now - at;
  if (d < 60e3) return '방금 전';
  if (d < 36e5) return Math.floor(d / 60e3) + '분 전';
  if (d < 864e5) return Math.floor(d / 36e5) + '시간 전';
  return new Date(at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

export type InsPData = { st: 'a' | 'b' | 'c'; title: string; sub: string; chips: (string | null)[]; ask: string; ctaLb: string; secs: { h: string; ps: string[] }[] };
/** tfIns2PData() */
export function tfIns2PData(i: InsPInfo | null, now = Date.now()): InsPData | null {
  if (!i) return null;
  const num = (v: number | null | undefined, d2?: number) => (v != null && isFinite(v) ? (+v).toFixed(d2 != null ? d2 : 1) : null);
  if (i.st === 'b') {
    const b = i.bot;
    const a = tfIns2BotAsset(b);
    const ret = num(b.ret);
    const mdd = num(b.mdd);
    return {
      st: 'b',
      title: '지금 ' + (i.run ? '실행 중인' : '실행 대기 중인') + ' ' + a + ' 전략 포지션, 계속 들고 가도 되겠습니까?',
      sub: '현재 전략의 검증 지표와 최근 시장 변화를 기준으로, 유지, 축소, 정리 시나리오를 비교했습니다.',
      chips: [a, i.run ? '검증 실행 중' : '실행 대기', b.score ? 'TETH ' + b.score + '점' : null],
      ask: a + ' 시장의 현재 상태를 분석해줘. 내가 ' + (i.run ? '실행 중인' : '실행 대기 중인') + ' 전략(검증 수익 ' + (ret || '?') + '%, 최대 낙폭 ' + (mdd || '?') + '%)을 ' + (i.run ? '유지할지, 축소할지, 정리할지' : '지금 시작해도 될지, 조건을 조정해야 할지') + ' 판단 기준을 알려줘.',
      ctaLb: i.run ? '이 포지션, 지금 어떻게 관리하겠습니까? 지금 TETH에게 물어보십시오' : '이 전략, 지금 시작해도 되겠습니까? 지금 TETH에게 물어보십시오',
      secs: [
        {
          h: i.run ? '파트 1: 현재 포지션에서 먼저 봐야 할 것' : '파트 1: 실행 버튼을 누르기 전에 봐야 할 것',
          ps: [
            '현재 전략에서 가장 중요한 것은 단순한 수익률이 아닙니다. 검증 기준으로 이 전략은 ' +
              (ret != null ? '수익 **' + ((b.ret as number) >= 0 ? '+' : '') + ret + '%**' : '수익 지표') +
              (mdd != null ? ', 최대 낙폭 **' + mdd + '%**' : '') +
              (b.score ? ', TETH **' + b.score + '점**' : '') +
              '을 기록했습니다. ' +
              (i.run ? '포지션을 유지할지' : '지금 시작할지') +
              ' 판단하려면, 수익 크기보다 현재 시장이 이 전략의 전제(하락 뒤 반등)와 여전히 맞는 상태인지를 먼저 봐야 합니다.',
            (i.run ? '이미 포지션을 보유한 사용자에게는 "새로 들어갈까"보다 **"어떻게 들고 갈까"**가 더 중요합니다.' : '실행 대기 상태에서는 "언제 시작할까"보다 **"어떤 조건이 확인되면 시작할까"**를 먼저 정하는 편이 안전합니다.') +
              ' 특히 변동성이 커지는 구간에서는 거래량 없는 급한 움직임 뒤에 짧은 되돌림이 나올 가능성을 염두에 둬야 합니다.',
          ],
        },
        {
          h: '파트 2: 유지, 축소, 정리를 가르는 기준',
          ps: [
            '무조건 홀딩하거나 무조건 청산하는 이분법보다, **유지, 축소, 정리 조건을 미리 분리해두는 방식**이 효율적입니다. 이 전략에는 이미 손절 규칙이 정의되어 있고, 검증 구간에서 그 규칙이 낙폭을 ' + (mdd != null ? mdd + '% 안에서' : '규칙 범위 안에서') + ' 관리했습니다.',
            '결국 지금 필요한 것은 상승 전망 자체가 아니라, 현재 포지션을 관리하는 명확한 기준입니다. 진입가, 손절선, 목표 구간과 포지션 축소 시점을 함께 정리해두면 감정 개입을 크게 줄일 수 있습니다. 즉, 지금 이 포지션의 핵심은 **예측보다 관리 가능한 시나리오**입니다.',
          ],
        },
      ],
    };
  }
  if (i.st === 'c') {
    const b2 = i.bot;
    const a2 = b2 ? tfIns2BotAsset(b2) : null;
    const ret2 = b2 ? num(b2.ret) : null;
    return {
      st: 'c',
      title: '쉬고 있는 동안 시장은 바뀌었습니다. 다시 볼 만한 기회가 왔습니까?',
      sub: '마지막 전략 이후 무엇이 달라졌는지, 예전에 보던 전략이 지금도 유효한지 정리했습니다.',
      chips: [a2 || '시장 전반', '휴면 복귀', b2 ? '전략 등록 ' + tfNFTime(+(b2.at as number) || now, now) : null],
      ask: (a2 || '비트코인') + ' 시장이 최근 어떻게 달라졌는지 분석해줘. 내가 예전에 쓰던 전략' + (ret2 != null ? '(검증 수익 ' + ((b2 as TfBot).ret! >= 0 ? '+' : '') + ret2 + '%)' : '') + '이 지금 시장에서도 유효한지, 복귀 전에 무엇을 재검증해야 하는지 알려줘.',
      ctaLb: '복귀 전 재검증, 지금 TETH에게 물어보십시오',
      secs: [
        {
          h: '파트 1: 마지막 전략 이후 달라진 것',
          ps: [
            '한동안 거래를 쉬는 사이 시장은 단순히 가격만 바뀐 것이 아니라, 움직이는 방식 자체가 달라졌을 수 있습니다. 예전에는 잘 먹히던 진입 패턴도 지금은 반응 속도나 손익 구조가 달라질 수 있습니다. 그래서 복귀를 고민할 때는 감으로 접근하기보다, **과거 전략이 지금 시장에서도 여전히 유효한지**부터 다시 점검하는 편이 중요합니다.',
            '당신이 마지막으로 관심 있게 보던 자산' + (a2 ? '(' + a2 + ')' : '') + '은 여전히 핵심 자산이지만, 최근 시장은 더 선별적으로 움직이고 있습니다. 예전처럼 넓게 보기보다 확실한 자산 몇 개에 흐름이 집중되는 구간일 가능성이 큽니다.',
          ],
        },
        {
          h: '파트 2: 복귀는 재진입이 아니라 재설정',
          ps: [
            '거래를 쉬었다는 사실은 나쁜 신호가 아닙니다. 오히려 시장과 거리를 둔 덕분에, 예전 손실이나 과열된 심리에서 벗어나 다시 시작할 여지가 생긴 것일 수도 있습니다. 다만 바로 진입하기보다, **최근 흐름을 짧게 재학습하고 복귀 조건을 다시 세우는 과정**이 먼저 필요합니다.',
            'TETH 관점에서 지금 당신에게 필요한 것은 "바로 다시 들어갈까"에 대한 충동적인 답이 아닙니다. 이전에 사용했던 전략을 현재 시장 구조와 비교하고, 지금 다시 써도 되는지 검증하는 과정이 우선입니다. 즉, 지금의 복귀는 단순한 재진입보다 **복귀 조건의 재설정**에 더 가깝습니다.',
          ],
        },
      ],
    };
  }
  const a3 = i.asset;
  return {
    st: 'a',
    title: '아직 거래를 시작하지 않았다면, 지금 어떤 전략부터 보는 게 좋겠습니까?',
    sub: (a3 ? '최근 관심을 보인 ' + a3 : '최근 관심 자산') + '과 단기 매매 성향을 기준으로, 첫 거래 전에 꼭 확인해야 할 시장 조건을 정리했습니다.',
    chips: [a3 || 'BTC, ETH', '첫 전략', '검증 우선'],
    ask: (a3 || '비트코인과 이더리움') + ' 중심으로 첫 자동매매 전략을 시작하려고 해. 지금 시장 조건에서 어떤 진입 조건과 손절 기준으로 시작하는 게 좋을지, 첫 검증 전에 확인할 것을 알려줘.',
    ctaLb: '첫 거래가 고민되십니까? 지금 TETH에게 물어보십시오',
    secs: [
      {
        h: '파트 1: 첫 거래 전에 먼저 봐야 할 것',
        ps: [
          '처음 거래를 시작할 때 가장 흔한 실수는 종목보다 타이밍을 먼저 확신하는 것입니다. 하지만 지금 시장은 **방향성은 살아 있으면서도 단기 변동성은 여전히 큰 구간**입니다. 따라서 첫 진입은 "무조건 지금"이 아니라, 어떤 조건에서 들어갈지 정해두는 편이 훨씬 좋습니다.',
          '당신이 최근 자주 본 자산' + (a3 ? '은 ' + a3 + '입니다' : '들은 중장기 구조가 양호한 편입니다') + '. 다만 단기적으로는 급등 직후 추격 매수보다 눌림을 기다리는 전략이 더 유리할 가능성이 큽니다. TETH는 지금 구간에서 "한 번에 크게"보다 **"작게 나눠서 확인하는 진입"**을 우선 추천합니다.',
        ],
      },
      {
        h: '파트 2: 첫 전략의 목적은 수익이 아니라 확인',
        ps: [
          '아직 거래 이력이 없다는 점은 오히려 장점일 수 있습니다. 손실 복구 압박이 없기 때문에, 현재 시장을 처음부터 차분히 학습하면서 접근할 수 있기 때문입니다. 첫 거래의 목적은 수익 극대화보다 **자신에게 맞는 진입 방식과 리스크 허용 범위를 확인하는 것**에 있어야 합니다.',
          'TETH 관점에서 지금 가장 현실적인 시작 방법은 단순합니다. 관심 자산 1~2개를 정하고, 진입 조건, 손절 기준, 목표 구간을 먼저 시뮬레이션한 뒤, 그다음에 실제 거래로 넘어가는 것입니다. 즉, 첫 전략에서 필요한 것은 "확신"보다 **검증 가능한 첫 전략**입니다.',
        ],
      },
    ],
  };
}

/** tfIns2PView(token) 의 주소 검사: 종류-YYYYMMDD(UTC). 발행 뒤 48시간이 지나면 만료 */
export type InsPTok = { ok: false } | { ok: true; st: 'a' | 'b' | 'c'; expired: boolean };
export function insPTokCheck(token: string, now = Date.now()): InsPTok {
  const m = String(token || '').match(/^([abc])-(\d{8})$/);
  if (!m) return { ok: false };
  const yy = +m[2].slice(0, 4);
  const mo = +m[2].slice(4, 6);
  const dd = +m[2].slice(6, 8);
  const born = Date.UTC(yy, mo - 1, dd);
  const bd = new Date(born);
  if (mo < 1 || mo > 12 || dd < 1 || bd.getUTCMonth() !== mo - 1 || bd.getUTCDate() !== dd || born > now + 24 * 3600 * 1000) return { ok: false };
  return { ok: true, st: m[1] as 'a' | 'b' | 'c', expired: now > born + 48 * 3600 * 1000 };
}
