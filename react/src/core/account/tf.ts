// 원본 S.user, S.tf 와 저장(STORE)의 자리. 화면 없는 순수 상태다.
// 원본처럼 값을 바로 고친 뒤 tfSave() 를 부르면 저장하고, 보고 있는 화면에 다시 그리라고 알린다.

export type TfUser = { name: string; email?: string } | null;

export type AcRoute = 'partner' | 'paid';
export type AcConn = { via: AcRoute; at: number; uid?: string; kyc?: string };
export type AcCard = { id: string; last4: string; brand: string; exp: string; name: string; def: boolean };
export type AcBill = { id: string; at: number; label: string; amt: number; st: string; last4?: string; brand?: string; card?: string };
export type AcSub = { st: string; since?: number; next?: number; until?: number; price: number; n?: number; [k: string]: unknown };
/** 실행 환경 활성화 상태 (원본 S.tf.ac) */
export type Ac = {
  route: AcRoute | null;
  ex: string | null;
  has: 'yes' | 'no' | null;
  g: number;
  pay: { st: string; at?: number };
  auth: { st: string; ex?: string | null; at?: number; uid?: string };
  uid: { st: string; ex?: string | null; v?: string };
  kyc: { st: string; ex?: string | null };
  conn: Record<string, AcConn>;
  cards: AcCard[];
  bill: AcBill[];
  sub: AcSub | null;
  edit?: string | null;
  routeSel?: AcRoute | null;
  exSel?: string | null;
  adding?: number;
  more?: number;
  newCard?: number;
  joined?: number;
  doneAt?: number | null;
  billTo?: { email: string; name: string; addr: string };
  [k: string]: unknown;
};
/** 원본 S.tf. 다른 조각이 쓰는 칸은 그대로 실어 나른다(모르는 칸을 지우지 않는다). */
export type Tf = {
  intake: Record<string, unknown>;
  qi: number;
  tries: unknown[];
  cur: unknown;
  score: number;
  plan: string | null;
  cycle: string;
  ex: string | null;
  uid: string | null;
  api: { ex: string; last4: string | null; oauth?: boolean } | null;
  shared: boolean;
  followers: number;
  reward: number;
  fills: unknown[];
  strat: { id?: string; name?: string; status?: string; [k: string]: unknown }[];
  ob?: { st: string; ex: string | null; uid: string; err: string | null };
  ac?: Ac | null;
  conn?: boolean;
  uidLinked?: boolean;
  payDone?: boolean;
  cardOn?: boolean;
  /* tfNFInit 이 채우는 칸 */
  creditBal?: number;
  creditGrants?: Record<string, number>;
  creditReqs?: unknown[];
  notifs?: unknown[];
  rebates?: { amt: number; at: number; fid: string; botId?: string }[];
  reviews?: unknown[];
  periodics?: unknown[];
  notifPrefs?: Record<string, boolean>;
  freeUsed?: number;
  creditSeen?: Record<string, unknown>;
  notifKeys?: Record<string, unknown>;
  reviewKeys?: Record<string, unknown>;
  fillLog?: unknown[];
  [k: string]: unknown;
};

/* 원본과 같은 저장 키, 같은 모양이다: localStorage['teth.state'] = { v:1, savedAt, user:{name,email}, tf, sessions, ... }.
   전략 상태(S.tf)는 앱 전체에 이것 하나다: 대화, 백테스트, 터미널 조각도 이 파일의 tfS(), tfSave() 를 쓴다. */
const KEY = 'teth.state';
type Snap = { v?: number; savedAt?: number; user?: { name: string; email?: string }; tf?: Tf | null; sessions?: unknown[]; [k: string]: unknown };
const readSnap = (): Snap | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v === 'object' ? (v as Snap) : null;
  } catch {
    return null;
  }
};
const read = (): Tf | null => {
  const p = readSnap();
  const t = p && p.tf;
  if (!t || typeof t !== 'object') return null;
  /* 과거 저장분에 남은 결제 정보는 읽을 때 지운다 (원본 STORE.restore) */
  const pay = t.pay as Record<string, unknown> | undefined;
  if (pay) {
    delete pay.num;
    delete pay.exp;
    delete pay.nm;
  }
  return t;
};

/** 원본 전역 S (user 와 tf 만) */
export const S: { user: TfUser; tf: Tf | null } = { user: null, tf: null };

let ver = 0;
const subs = new Set<() => void>();
export const tfSubscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export const tfVersion = () => ver;
/** 다시 그리기만 (원본의 acRe, stRe 처럼 값이 바뀐 뒤 화면을 다시 그릴 때) */
export function tfBump() {
  ver++;
  subs.forEach((f) => f());
}

/** 앱이 뜰 때와 로그인, 로그아웃 때 부른다. 로그아웃하면 S.tf 를 비운다 (원본 gLogout). */
export function tfSetUser(u: TfUser, boot = false) {
  S.user = u;
  if (!u) {
    S.tf = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* 무시 */
    }
  } else if (boot) S.tf = read();
  tfBump();
}

/** tfS() */
export function tfS(): Tf {
  if (!S.tf) S.tf = { intake: {}, qi: 0, tries: [], cur: null, score: 0, plan: null, cycle: 'year', ex: null, uid: null, api: null, shared: false, followers: 0, reward: 0, fills: [], strat: [] };
  if (!S.tf.ob) S.tf.ob = { st: 'idle', ex: null, uid: '', err: null }; /* 온보딩 상태 머신 (구버전 저장분 호환) */
  return S.tf;
}

/** tfNFInit() */
export function tfNFInit(): Tf {
  const t = tfS();
  if (t.creditBal == null) t.creditBal = 0;
  t.creditGrants = t.creditGrants || {};
  t.creditReqs = t.creditReqs || [];
  t.notifs = t.notifs || [];
  t.rebates = t.rebates || [];
  t.reviews = t.reviews || [];
  t.periodics = t.periodics || [];
  t.notifPrefs = t.notifPrefs || { pos: true, loss: true, review: true, rebate: true, watch: true, chW: true, chK: false, chT: false, chM: false };
  t.uidLinked = t.uidLinked || false;
  t.freeUsed = t.freeUsed || 0;
  t.creditSeen = t.creditSeen || {};
  t.notifKeys = t.notifKeys || {};
  t.reviewKeys = t.reviewKeys || {};
  t.fillLog = t.fillLog || [];
  return t;
}

/** tfSave(): 회원일 때만 저장한다 (원본 STORE.save 는 700ms 뒤에 쓰지만 여기는 바로 쓴다) */
export function tfSave() {
  if (S.user && S.tf) {
    try {
      const c = JSON.parse(JSON.stringify(S.tf)) as Tf;
      /* 카드번호 등 결제 민감정보는 어떤 저장소에도 남기지 않는다 (원본 STORE.snapshot) */
      const pay = c.pay as Record<string, unknown> | undefined;
      if (pay) {
        delete pay.num;
        delete pay.exp;
        delete pay.nm;
      }
      const prev = readSnap();
      /* 다른 칸(대화 기록, 알림 조건 등)은 그대로 둔다 */
      const next: Snap = { ...(prev || { sessions: [] }), v: 1, savedAt: Date.now(), user: { name: S.user.name, email: (prev && prev.user && prev.user.email) || S.user.email || '' }, tf: c };
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* 저장 못 해도 화면은 그대로 쓴다 */
    }
  }
  tfBump();
}

/** mkHash(str): 계정 번호 흉내 등 결정적 값에 쓴다 (전략 복사 조각의 것과 같은 식) */
export function mkHash(str: string): number {
  let h = 0;
  str = String(str);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
