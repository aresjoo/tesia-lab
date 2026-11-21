// 터미널의 시세 줄, 차트/정보/데이터 탭, 종목 선택 창. 원본 sk-mkt, sk-sym 구역(mkt*)을 옮겼다.
// 시세는 원본과 같이 브라우저가 바이낸스 선물 공개 API 와 CoinGecko 에서 직접 받는다.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MktChev, TbIcon } from './parts';

type Tick = { symbol: string; lastPrice: string; priceChange: string; priceChangePercent: string; highPrice: string; lowPrice: string; volume: string; quoteVolume: string; closeTime: number };
type Prem = { symbol: string; markPrice: string; indexPrice: string; lastFundingRate: string; nextFundingTime: number };
type Exi = { t: string; st: string; b: string };
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** MKT */
export const MKT = {
  sym: null as string | null,
  picked: false,
  tick: null as Tick | null,
  prem: null as Prem | null,
  tab: 'chart' as 'chart' | 'info' | 'data',
  per: '5m',
  all: null as Tick[] | null,
  allAt: 0,
  fav: ['BTCUSDT', 'ETHUSDT'] as string[],
  src: 'all',
  cat: 'all',
  q: '',
  sort: 'qv' as 'sym' | 'px' | 'chg' | 'qv',
  desc: true,
  info: {} as Record<string, Any>,
  glob: null as Any | null,
  exi: null as Record<string, Any> | null,
  pickOpen: false,
};
try {
  MKT.fav = JSON.parse(localStorage.getItem('teth.mkt.fav') || '["BTCUSDT","ETHUSDT"]');
  MKT.sym = localStorage.getItem('teth.mkt.sym') || null;
} catch {
  /* 무시 */
}
let MKT_ICONS: Record<string, string> | null = null;
let MKT_EXI: Record<string, Exi> | null = null;
let rev = 0;
const subs = new Set<() => void>();
const emit = () => {
  rev++;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const useMkt = () => useSyncExternalStore(subscribe, () => rev);

const MKT_CG: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', DOT: 'polkadot', TRX: 'tron', LTC: 'litecoin', BCH: 'bitcoin-cash', SUI: 'sui', TON: 'the-open-network', NEAR: 'near', APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', UNI: 'uniswap', AAVE: 'aave', PEPE: 'pepe', SHIB: 'shiba-inu', WIF: 'dogwifcoin', ENA: 'ethena', HYPE: 'hyperliquid', ATOM: 'cosmos', ETC: 'ethereum-classic', XLM: 'stellar', FIL: 'filecoin', INJ: 'injective-protocol', SEI: 'sei-network', TIA: 'celestia', FET: 'fetch-ai', RENDER: 'render-token', TAO: 'bittensor', WLD: 'worldcoin-wld', BONK: 'bonk', FLOKI: 'floki', TRUMP: 'official-trump', PENGU: 'pudgy-penguins', HBAR: 'hedera-hashgraph', ICP: 'internet-computer', ALGO: 'algorand', MKR: 'maker', LDO: 'lido-dao', CRV: 'curve-dao-token', PENDLE: 'pendle', JUP: 'jupiter-exchange-solana', POL: 'polygon-ecosystem-token', STRK: 'starknet', IMX: 'immutable-x' };
const MKT_KO: Record<string, string> = { SAMSUNG: '삼성전자', SKHYNIX: 'SK하이닉스', HYUNDAI: '현대차', SAMSUNGEM: '삼성전기', HANMI: '한미반도체', LGELECTRONICS: 'LG전자', NAVER: '네이버', KODEX200: 'KODEX 200', HK0700: '텐센트', TENCENT: '텐센트', HK1810: '샤오미', POPMART: '팝마트', KUAISHOU: '콰이쇼우', MEITUAN: '메이퇀', BYD: 'BYD', HK0992: '레노버', XAU: '금', XAG: '은', XPT: '백금', XPD: '팔라듐', COPPER: '구리', CL: 'WTI 원유', BZ: '브렌트유', NATGAS: '천연가스', TSLA: '테슬라', NVDA: '엔비디아', AAPL: '애플', MSFT: '마이크로소프트', AMZN: '아마존', GOOGL: '알파벳', META: '메타', SPY: 'S&P 500', QQQ: '나스닥 100', SOXL: '반도체 3배', EWY: '한국 ETF', EWJ: '일본 ETF', OPENAI: '오픈AI', ANTHROPIC: '앤트로픽' };
const MKT_CATS2: [string, string][] = [['all', '전체'], ['us', '미국 주식'], ['kr', '한국 주식'], ['hk', '홍콩, 중국'], ['cmd', '원자재'], ['pre', '프리 IPO'], ['ai', 'AI'], ['defi', '디파이'], ['l1', '레이어 1'], ['l2', '레이어 2'], ['meme', '밈']];
const MKT_PER: [string, string][] = [['5m', '5분'], ['15m', '15분'], ['30m', '30분'], ['1h', '1시간'], ['2h', '2시간'], ['4h', '4시간'], ['6h', '6시간'], ['12h', '12시간'], ['1d', '1일']];

/** mktApi(u) */
const mktApi = (u: string) =>
  fetch('https://fapi.binance.com' + u).then((r) => {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  });
/** mktCg(u) */
const mktCg = (u: string) =>
  fetch('https://api.coingecko.com/api/v3' + u).then((r) => {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  });
/** mktBase(s) */
export const mktBase = (s: string) => String(s || '').replace(/USDT$/, '').replace(/^1000+/, '').replace(/^1M/, '');
const mktDec = (v: string | number) => (String(v).split('.')[1] || '').replace(/0+$/, '').length;
/** mktFmt(v,d) */
export function mktFmt(v: string | number, d?: number): string {
  const n = +v;
  if (!isFinite(n)) return '-';
  if (d == null) d = Math.min(mktDec(v), Math.abs(n) >= 1000 ? 2 : 8);
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
/** mktBig(n,cur) */
export function mktBig(n0: string | number, cur?: boolean | number): string {
  const n = +n0;
  if (!isFinite(n)) return '-';
  const a = Math.abs(n);
  const s = a >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (n / 1e3).toFixed(2) + 'K' : n.toFixed(2);
  return (cur ? '$' : '') + s;
}
/** mktCd(ts) */
function mktCd(ts: number): string {
  const d = Math.max(0, Math.floor((+ts - Date.now()) / 1000));
  const p = (x: number) => (x < 10 ? '0' : '') + x;
  return p(Math.floor(d / 3600)) + ':' + p(Math.floor((d % 3600) / 60)) + ':' + p(d % 60);
}
/** mktIconsLoad() */
function mktIconsLoad(): Promise<Record<string, string>> {
  if (MKT_ICONS) return Promise.resolve(MKT_ICONS);
  return fetch('assets/coins/index.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((j) => {
      MKT_ICONS = j || {};
      emit();
      return MKT_ICONS as Record<string, string>;
    });
}
/** mktExiLoad() */
function mktExiLoad(): Promise<Record<string, Exi>> {
  if (MKT_EXI) return Promise.resolve(MKT_EXI);
  return mktApi('/fapi/v1/exchangeInfo')
    .then((j: Any) => {
      const m: Record<string, Exi> = {};
      (j.symbols || []).forEach((s: Any) => {
        if (s.status === 'TRADING' && /PERPETUAL/.test(s.contractType)) m[s.symbol] = { t: s.underlyingType || '', st: (s.underlyingSubType || []).join('|'), b: s.baseAsset };
      });
      MKT_EXI = m;
      return m;
    })
    .catch(() => {
      MKT_EXI = {};
      return MKT_EXI;
    });
}
function mktCatOf(sym: string): Record<string, boolean> {
  const e = MKT_EXI && MKT_EXI[sym];
  if (!e) return {};
  const t = e.t;
  const st = e.st;
  return { us: t === 'EQUITY', kr: t === 'KR_EQUITY', hk: t === 'HK_EQUITY' || t === 'CN_EQUITY', cmd: t === 'COMMODITY', pre: t === 'PREMARKET', ai: /\bAI\b/.test(st), defi: /DeFi/.test(st), l1: /Layer-1/.test(st), l2: /Layer-2/.test(st), meme: /Meme/.test(st) };
}

const badIcon = new Set<string>();
/** mktIcon(base,sz): 내려받은 파일 → 공개 아이콘 묶음 → 첫 글자 순 */
export function MktIcon({ base, sz = 22 }: { base: string; sz?: number }) {
  const [, force] = useState(0);
  const B = String(base).toUpperCase();
  const f = MKT_ICONS && MKT_ICONS[B];
  const src = f ? 'assets/coins/' + f : 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/' + B.toLowerCase() + '.svg';
  return (
    <span className="mk-ic" style={{ width: sz + 'px', height: sz + 'px' }}>
      {!badIcon.has(src) && (
        <img
          src={src}
          alt=""
          width={sz}
          height={sz}
          loading="lazy"
          onError={() => {
            badIcon.add(src);
            force((n) => n + 1);
          }}
        />
      )}
      <i>{B.charAt(0)}</i>
    </span>
  );
}

/** mktSym(): 고른 종목 → 전략의 종목 → BTCUSDT */
export const mktSym = (stratSym: string | null) => MKT.sym || stratSym || 'BTCUSDT';
/** mktStratSym(): 고른 전략의 거래쌍을 무기한 심볼로 */
export function mktStratSym(sym: string | null | undefined): string | null {
  const m = String(sym || '').replace(/[/\-\s]/g, '').toUpperCase();
  return /USDT$/.test(m) ? m : null;
}
/** 전략을 고르면 차트 종목도 그 전략의 종목으로 (tfTmSelect 감싸기, mktMount) */
export function mktFollow(stratSym: string | null) {
  if (!stratSym || stratSym === MKT.sym) return;
  MKT.sym = stratSym;
  MKT.picked = false;
  MKT.tick = null;
  MKT.prem = null;
  emit();
}
/** mktMount, tfTmSelect 감싸기: 처음 들어올 때는 직접 고른 종목이 없을 때만, 전략을 바꿔 고르면 늘 그 전략의 종목으로 */
export function mktSync(stratSym: string | null, first: boolean) {
  if (first) {
    if (!MKT.picked && stratSym) MKT.sym = stratSym;
    return;
  }
  MKT.picked = false;
  if (stratSym && stratSym !== MKT.sym) {
    MKT.sym = stratSym;
    MKT.tick = null;
    MKT.prem = null;
  }
}
/** 복사한 전략을 바꿔 고르면 차트도 그 전략의 종목으로 (pxTermSide 감싸기). 직접 고른 종목이 있으면 두고 */
export function mktCopyFollow(stratSym: string | null) {
  if (MKT.picked || !stratSym || stratSym === MKT.sym) return;
  MKT.sym = stratSym;
  MKT.tick = null;
  MKT.prem = null;
}
/** mktPoll() */
function mktPoll(sym: string) {
  Promise.all([mktApi('/fapi/v1/ticker/24hr?symbol=' + sym), mktApi('/fapi/v1/premiumIndex?symbol=' + sym)])
    .then((a) => {
      if (sym !== (MKT.sym || sym)) return;
      MKT.tick = a[0];
      MKT.prem = a[1];
      emit();
    })
    .catch(() => {});
}
/** mktSet(sym) */
function mktSet(sym: string) {
  MKT.sym = sym;
  MKT.picked = true;
  try {
    localStorage.setItem('teth.mkt.sym', sym);
  } catch {
    /* 무시 */
  }
  MKT.pickOpen = false;
  MKT.tick = null;
  MKT.prem = null;
  emit();
}

/** mktHeadHtml(): 맨 위 시장 줄 */
export function MktHead({ stratSym }: { stratSym: string | null }) {
  useMkt();
  const [, tickSec] = useState(0);
  const sym = mktSym(stratSym);
  const base = mktBase(sym);
  const t = MKT.tick && MKT.tick.symbol === sym ? MKT.tick : null;
  const p = MKT.prem && MKT.prem.symbol === sym ? MKT.prem : null;
  useEffect(() => {
    mktIconsLoad();
  }, []);
  /* mktPoll + mktLoop: 3초마다 시세, 1초마다 펀딩 남은 시간 */
  useEffect(() => {
    mktPoll(sym);
    const a = setInterval(() => {
      if (!document.hidden) mktPoll(sym);
    }, 3000);
    const b = setInterval(() => {
      if (MKT.prem) tickSec((n) => n + 1);
    }, 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [sym]);
  const up = t ? +t.priceChangePercent >= 0 : true;
  const cls = t ? (up ? 'up' : 'dn') : '';
  const fr = p ? +p.lastFundingRate * 100 : null;
  const dp = t ? Math.min(mktDec(t.lastPrice), Math.abs(+t.lastPrice) >= 1000 ? 2 : 8) : p ? Math.min(mktDec(p.markPrice), 8) : 2;
  const kv = (k: string, v: ReactNode) => (
    <div>
      <dt>{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
  return (
    <div className="mkh" id="mkh">
      <button
        type="button"
        className="mkh-sym"
        aria-label="종목 바꾸기"
        onClick={() => {
          MKT.pickOpen = true;
          emit();
        }}
      >
        <MktIcon base={base} sz={26} />
        <b>{sym}</b>
        <span className="tag">무기한</span>
        <MktChev />
      </button>
      <div className={'mkh-px ' + cls}>
        <b className="num">{t ? mktFmt(t.lastPrice) : '-'}</b>
        <span className="num">{t ? (up ? '+' : '') + mktFmt(t.priceChange) + ' ' + (up ? '+' : '') + (+t.priceChangePercent).toFixed(2) + '%' : ''}</span>
      </div>
      <dl className="mkh-kv">
        {kv('표시가격', p ? mktFmt(p.markPrice, dp) : '-')}
        {kv('지수가격', p ? mktFmt(p.indexPrice, dp) : '-')}
        {kv(
          '펀딩비(8시간) / 남은 시간',
          p && fr != null ? (
            <>
              <i className={fr >= 0 ? 'up' : 'dn'}>{fr.toFixed(4)}%</i> / <span id="mkh-cd">{mktCd(p.nextFundingTime)}</span>
            </>
          ) : (
            '-'
          ),
        )}
        {kv('24시간 고가', t ? mktFmt(t.highPrice) : '-')}
        {kv('24시간 저가', t ? mktFmt(t.lowPrice) : '-')}
        {kv('24시간 거래량(' + base + ')', t ? mktBig(t.volume) : '-')}
        {kv('24시간 거래대금(USD)', t ? mktBig(t.quoteVolume) : '-')}
      </dl>
      {MKT.pickOpen && <MktPick cur={sym} />}
    </div>
  );
}

/* ── 차트: 바이낸스 무기한 심볼, 그리기 도구, 이동평균 7/25/99 ── */
type TvWin = Window & { TradingView?: { widget: new (o: Any) => unknown } };
let tvq: (() => void)[] | null = null;
/** taiTv(cb): 트레이딩뷰 위젯 스크립트를 한 번만 싣는다 */
function taiTv(cb: () => void) {
  if ((window as TvWin).TradingView) return cb();
  if (tvq) {
    tvq.push(cb);
    return;
  }
  tvq = [cb];
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/tv.js';
  s.onload = () => {
    const q = tvq || [];
    tvq = null;
    q.forEach((f) => f());
  };
  s.onerror = () => {
    tvq = null;
    try {
      s.remove();
    } catch {
      /* 무시 */
    }
  };
  document.head.appendChild(s);
}
/** mktChart(): #nfxh-tv 안은 위젯이 채운다. React 는 그 안을 건드리지 않는다 */
function Chart({ sym, hidden }: { sym: string; hidden: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const ph = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    let live = true;
    const tv = 'BINANCE:' + sym + '.P';
    h.innerHTML = '';
    if (ph.current) ph.current.hidden = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    taiTv(() => {
      try {
        if (!live || !host.current || host.current.childNodes.length) return;
        const TV = (window as TvWin).TradingView;
        if (!TV) return;
        new TV.widget({
          container_id: 'nfxh-tv', symbol: tv, interval: '15', timezone: 'Asia/Seoul', theme: 'dark', style: '1', locale: 'kr', autosize: true,
          toolbar_bg: '#141414', backgroundColor: '#141414', gridColor: 'rgba(255,255,255,0.05)', enable_publishing: false, hide_side_toolbar: false, hide_top_toolbar: false, withdateranges: false,
          allow_symbol_change: false, save_image: true, details: false, hotlist: false, calendar: false,
          studies: [{ id: 'MASimple@tv-basicstudies', inputs: { length: 7 } }, { id: 'MASimple@tv-basicstudies', inputs: { length: 25 } }, { id: 'MASimple@tv-basicstudies', inputs: { length: 99 } }],
        });
        if (ph.current) ph.current.hidden = true;
      } catch {
        /* 무시 */
      }
    });
    /* 차트를 다시 만든 뒤 칸 너비에 맞게 크기를 다시 잡는다 */
    [400, 1200, 2500].forEach((ms) =>
      timers.push(
        setTimeout(() => {
          const f = host.current && host.current.querySelector('iframe');
          if (f) {
            f.style.width = '100%';
            f.style.height = '100%';
          }
          window.dispatchEvent(new Event('resize'));
        }, ms),
      ),
    );
    return () => {
      live = false;
      timers.forEach(clearTimeout);
    };
  }, [sym]);
  return (
    <>
      <div className="ph" id="nfxh-ph" ref={ph}>
        차트 불러오는 중…
      </div>
      <div id="nfxh-tv" ref={host} style={hidden ? { visibility: 'hidden' } : undefined} />
    </>
  );
}

/** stDate(ms) */
const stDate = (ms: number) => {
  const d = new Date(ms);
  return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
};
/** mktExi(sym) */
function mktExi(sym: string): Promise<Any | null> {
  const go = MKT.exi
    ? Promise.resolve(MKT.exi)
    : mktApi('/fapi/v1/exchangeInfo').then((x: Any) => {
        MKT.exi = {};
        (x.symbols || []).forEach((s: Any) => {
          (MKT.exi as Record<string, Any>)[s.symbol] = s;
        });
        return MKT.exi as Record<string, Any>;
      });
  return go.then((m) => m[sym] || null).catch(() => null);
}
/** mktInfo(): 정보 탭 */
function Info({ sym }: { sym: string }) {
  const base = mktBase(sym);
  const [res, setRes] = useState<{ sym: string; d: Any | null; g: Any | null; x: Any | null } | null>(null);
  useEffect(() => {
    let live = true;
    setRes(null);
    const gid: Promise<string> = MKT_CG[base]
      ? Promise.resolve(MKT_CG[base])
      : mktCg('/search?query=' + encodeURIComponent(base)).then((r: Any) => {
          const c = (r.coins || []).filter((x: Any) => String(x.symbol).toUpperCase() === base)[0];
          if (!c) throw new Error('none');
          return c.id as string;
        });
    const coin = gid.then(
      (id) =>
        MKT.info[id] ||
        mktCg('/coins/' + id + '?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false').then((d: Any) => {
          MKT.info[id] = d;
          return d;
        }),
    );
    const glob = MKT.glob
      ? Promise.resolve(MKT.glob)
      : mktCg('/global')
          .then((g: Any) => {
            MKT.glob = g;
            return g;
          })
          .catch(() => null);
    Promise.all([coin.catch(() => null), glob, mktExi(sym)]).then((a) => {
      if (live) setRes({ sym, d: a[0], g: a[1], x: a[2] });
    });
    return () => {
      live = false;
    };
  }, [sym, base]);
  if (!res || res.sym !== sym) return <p className="mkt-ld">불러오는 중</p>;
  const { d, g, x } = res;
  const m: Any = (d && d.market_data) || {};
  const mc = m.market_cap && m.market_cap.usd;
  const fd = m.fully_diluted_valuation && m.fully_diluted_valuation.usd;
  const vol = m.total_volume && m.total_volume.usd;
  const tot = g && g.data && g.data.total_market_cap && g.data.total_market_cap.usd;
  const num = (v: number | null | undefined, u?: string) => (v == null ? '-' : Math.round(v).toLocaleString('en-US') + (u ? ' ' + u : ''));
  const row = (k: string, v: string) => (
    <div className="mki-r">
      <span>{k}</span>
      <b className="num">{v}</b>
    </div>
  );
  const lk = (lab: string, u?: string) =>
    u ? (
      <a className="mki-lk" href={u} target="_blank" rel="noopener noreferrer" key={lab}>
        {lab}
      </a>
    ) : null;
  const f = (t: string): Any => ((x && x.filters) || []).filter((y: Any) => y.filterType === t)[0] || {};
  const links = d ? [lk('공식 웹사이트', ((d.links && d.links.homepage) || [])[0]), lk('백서', d.links && d.links.whitepaper), lk('블록 탐색기', ((d.links && d.links.blockchain_site) || [])[0])].filter(Boolean) : [];
  return (
    <div className="mki">
      <div className="mki-hd">
        <MktIcon base={base} sz={28} />
        <b>{d ? d.name : base}</b>
      </div>
      <div className="mki-g">
        <div className="mki-c">
          {d ? (
            <>
              {row('순위', d.market_cap_rank ? d.market_cap_rank + '위' : '-')}
              {row('시가총액', mktBig(mc, 1))}
              {row('완전 희석 시가총액', mktBig(fd, 1))}
              {row('시장 점유율', mc && tot ? ((mc / tot) * 100).toFixed(2) + '%' : '-')}
              {row('거래량', mktBig(vol, 1))}
              {row('거래량 / 시가총액', mc && vol ? ((vol / mc) * 100).toFixed(2) + '%' : '-')}
              {row('유통 공급량', num(m.circulating_supply, base))}
              {row('최대 공급량', num(m.max_supply, base))}
              {row('총 공급량', num(m.total_supply, base))}
            </>
          ) : (
            <p className="mkt-ld">이 종목의 코인 정보는 아직 없습니다.</p>
          )}
        </div>
        <div className="mki-c">
          {links.length > 0 && (
            <>
              <h4>링크</h4>
              <div className="mki-lks">
                {links}
              </div>
            </>
          )}
          <h4>거래 규칙</h4>
          {x ? (
            <>
              {row('가격 단위', f('PRICE_FILTER').tickSize ? mktFmt(f('PRICE_FILTER').tickSize) : '-')}
              {row('최소 주문 수량', f('LOT_SIZE').minQty ? mktFmt(f('LOT_SIZE').minQty) + ' ' + base : '-')}
              {row('최소 주문 금액', f('MIN_NOTIONAL').notional ? mktFmt(f('MIN_NOTIONAL').notional) + ' USDT' : '-')}
              {row('상장일', x.onboardDate ? stDate(+x.onboardDate) : '-')}
            </>
          ) : (
            <p className="mkt-ld">거래 규칙을 불러오지 못했습니다.</p>
          )}
        </div>
      </div>
      <p className="mki-src">코인 정보 출처 CoinGecko, 거래 규칙 출처 Binance</p>
    </div>
  );
}

/* ── 데이터 탭: 작은 선, 막대 그래프 ── */
type Series = { kind: 'bar' | 'line'; v: number[]; color: string; axis?: 'l' | 'r'; base?: number; dash?: number };
type SvgOpt = { day?: boolean | number; fl?: (v: number) => string; fr?: (v: number) => string };
/** mktSvg(x,series,o) */
function MktSvg({ x, series, o = {} }: { x: number[]; series: Series[]; o?: SvgOpt }) {
  const W = window.innerWidth <= 768 ? Math.max(300, Math.min(520, window.innerWidth - 56)) : 520;
  const H = 190;
  const L = 8;
  const R = 8;
  const T = 12;
  const B = 26;
  const iw = W - L - R;
  const ih = H - T - B;
  const n = x.length;
  if (!n) return <p className="mkt-ld">자료가 없습니다.</p>;
  const axes: Record<string, { mn: number; mx: number }> = {};
  series.forEach((s) => {
    const a = s.axis || 'l';
    const v = s.v.filter(isFinite);
    if (!v.length) return;
    let mn = Math.min.apply(null, v);
    const mx = Math.max.apply(null, v);
    if (s.kind === 'bar' && !s.base) mn = Math.min(0, mn);
    const A = axes[a] || { mn, mx };
    A.mn = Math.min(A.mn, mn);
    A.mx = Math.max(A.mx, mx);
    axes[a] = A;
  });
  Object.keys(axes).forEach((a) => {
    const A = axes[a];
    if (A.mx === A.mn) {
      A.mx += 1;
      A.mn -= 1;
    }
    const pad = (A.mx - A.mn) * 0.08;
    if (A.mn !== 0) A.mn -= pad;
    A.mx += pad;
  });
  const X = (i: number) => L + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const Y = (v: number, a?: string) => {
    const A = axes[a || 'l'];
    return T + ih - ((v - A.mn) / (A.mx - A.mn)) * ih;
  };
  const bars = series.filter((s) => s.kind === 'bar');
  const bw = Math.max(2, ((iw / n) * 0.7) / Math.max(1, bars.length));
  const g: ReactNode[] = [];
  g.push(<line key="b" x1={L} y1={T + ih} x2={W - R} y2={T + ih} stroke="rgba(255,255,255,.1)" />);
  [0.25, 0.5, 0.75].forEach((fq) => {
    const y = T + ih * fq;
    g.push(<line key={'g' + fq} x1={L} y1={y} x2={W - R} y2={y} stroke="rgba(255,255,255,.05)" />);
  });
  bars.forEach((s, bi) => {
    const a = s.axis || 'l';
    if (!axes[a]) return;
    s.v.forEach((v, i) => {
      if (!isFinite(v)) return;
      const y0 = Y(Math.max(axes[a].mn, 0), a);
      const y = Y(v, a);
      const cx = X(i) - (bw * bars.length) / 2 + bw * bi;
      g.push(<rect key={'r' + bi + '_' + i} x={cx.toFixed(1)} y={Math.min(y, y0).toFixed(1)} width={(bw * 0.9).toFixed(1)} height={Math.max(1, Math.abs(y0 - y)).toFixed(1)} fill={s.color} />);
    });
  });
  series
    .filter((s) => s.kind !== 'bar')
    .forEach((s, si) => {
      const a = s.axis || 'l';
      if (!axes[a]) return;
      let d = '';
      s.v.forEach((v, i) => {
        if (!isFinite(v)) return;
        d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v, a).toFixed(1);
      });
      g.push(<path key={'p' + si} d={d} fill="none" stroke={s.color} strokeWidth="1.6" strokeDasharray={s.dash ? '3 3' : undefined} />);
    });
  const fl = o.fl || ((v: number) => mktBig(v));
  const fr = o.fr || fl;
  if (axes.l)
    g.push(
      <text key="l1" x={L} y={T + 9} fill="#9a9a9a" fontSize="12">
        {fl(axes.l.mx)}
      </text>,
      <text key="l2" x={L} y={T + ih - 4} fill="#9a9a9a" fontSize="12">
        {fl(axes.l.mn)}
      </text>,
    );
  if (axes.r)
    g.push(
      <text key="r1" x={W - R} y={T + 9} fill="#9a9a9a" fontSize="12" textAnchor="end">
        {fr(axes.r.mx)}
      </text>,
      <text key="r2" x={W - R} y={T + ih - 4} fill="#9a9a9a" fontSize="12" textAnchor="end">
        {fr(axes.r.mn)}
      </text>,
    );
  const p2 = (z: number) => (z < 10 ? '0' : '') + z;
  const tf = o.day
    ? (t: number) => {
        const d = new Date(+t);
        return d.getMonth() + 1 + '/' + d.getDate();
      }
    : (t: number) => {
        const d = new Date(+t);
        return p2(d.getHours()) + ':' + p2(d.getMinutes());
      };
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i, k) => {
    g.push(
      <text key={'x' + k} x={X(i).toFixed(1)} y={H - 6} fill="#9a9a9a" fontSize="12" textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>
        {tf(x[i])}
      </text>,
    );
  });
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className="mkx-svg" role="img">
      {g}
    </svg>
  );
}
/** mktLeg(items) */
const MktLeg = ({ items }: { items: [string, string][] }) => (
  <div className="mkx-leg">
    {items.map((x) => (
      <span key={x[0]}>
        <i style={{ background: x[1] }} />
        {x[0]}
      </span>
    ))}
  </div>
);
const DATA_CARDS: [string, string][] = [['oi', '미결제약정'], ['acct', '상위 트레이더 롱숏 비율(계정)'], ['pos', '상위 트레이더 롱숏 비율(포지션)'], ['glob', '전체 롱숏 비율'], ['taker', '테이커 매수와 매도량'], ['basis', '베이시스'], ['fund', '펀딩비(최근 40회)'], ['ratio', '미결제약정 / 유통량 비율']];
/** mktData(): 데이터 탭 */
function Data({ sym }: { sym: string }) {
  const base = mktBase(sym);
  const [per, setPer] = useState(MKT.per);
  const [cards, setCards] = useState<Record<string, ReactNode>>({});
  const perRow = useRef<HTMLDivElement>(null);
  /* 원본은 기간을 바꾸면 탭 전체를 다시 그려서 가로로 밀어 둔 기간 줄이 처음으로 돌아간다 */
  useLayoutEffect(() => {
    if (perRow.current) perRow.current.scrollLeft = 0;
  }, [per, sym]);
  useEffect(() => {
    let live = true;
    setCards({});
    const day = ['4h', '6h', '12h', '1d'].indexOf(per) >= 0;
    const put = (id: string, node: ReactNode) => {
      if (live) setCards((c) => ({ ...c, [id]: node }));
    };
    const fail = (id: string) => () => put(id, <p className="mkt-ld">이 종목은 자료가 없습니다.</p>);
    const q = '?symbol=' + sym + '&period=' + per + '&limit=30';
    mktApi('/futures/data/openInterestHist' + q)
      .then((L: Any[]) => {
        const x = L.map((r) => r.timestamp);
        put('oi', <><MktSvg x={x} series={[{ kind: 'bar', base: 1, v: L.map((r) => +r.sumOpenInterest), color: '#5a5a5a' }, { kind: 'line', axis: 'r', v: L.map((r) => +r.sumOpenInterestValue), color: '#ececec' }]} o={{ day, fr: (v) => mktBig(v, 1) }} /><MktLeg items={[['미결제약정(' + base + ')', '#5a5a5a'], ['미결제약정 금액', '#ececec']]} /></>);
        put('ratio', <><MktSvg x={x} series={[{ kind: 'line', v: L.map((r) => { const c = +r.CMCCirculatingSupply; return c ? (+r.sumOpenInterest / c) * 100 : NaN; }), color: '#ececec' }]} o={{ day, fl: (v) => v.toFixed(3) + '%' }} /><MktLeg items={[['미결제약정 / 유통 공급량', '#ececec']]} /></>);
      })
      .catch(() => {
        fail('oi')();
        fail('ratio')();
      });
    ([['acct', '/futures/data/topLongShortAccountRatio'], ['pos', '/futures/data/topLongShortPositionRatio'], ['glob', '/futures/data/globalLongShortAccountRatio']] as [string, string][]).forEach((c) => {
      mktApi(c[1] + q)
        .then((L: Any[]) => put(c[0], <><MktSvg x={L.map((r) => r.timestamp)} series={[{ kind: 'line', v: L.map((r) => +r.longShortRatio), color: '#ececec' }]} o={{ day, fl: (v) => v.toFixed(2) }} /><MktLeg items={[['롱숏 비율', '#ececec']]} /></>))
        .catch(fail(c[0]));
    });
    mktApi('/futures/data/takerlongshortRatio' + q)
      .then((L: Any[]) => put('taker', <><MktSvg x={L.map((r) => r.timestamp)} series={[{ kind: 'bar', v: L.map((r) => +r.sellVol), color: '#c75a5a' }, { kind: 'bar', v: L.map((r) => +r.buyVol), color: '#3f9e7c' }]} o={{ day }} /><MktLeg items={[['테이커 매도량(' + base + ')', '#c75a5a'], ['테이커 매수량(' + base + ')', '#3f9e7c']]} /></>))
      .catch(fail('taker'));
    mktApi('/futures/data/basis?pair=' + sym + '&contractType=PERPETUAL&period=' + per + '&limit=30')
      .then((L: Any[]) => put('basis', <><MktSvg x={L.map((r) => r.timestamp)} series={[{ kind: 'line', v: L.map((r) => +r.futuresPrice), color: '#ececec' }, { kind: 'line', v: L.map((r) => +r.indexPrice), color: '#9a9a9a', dash: 1 }, { kind: 'bar', axis: 'r', base: 1, v: L.map((r) => +r.basis), color: '#3a3a3a' }]} o={{ day, fl: (v) => mktFmt(v, v >= 1000 ? 0 : 2), fr: (v) => v.toFixed(2) }} /><MktLeg items={[['선물 가격', '#ececec'], ['지수 가격', '#9a9a9a'], ['베이시스', '#3a3a3a']]} /></>))
      .catch(fail('basis'));
    mktApi('/fapi/v1/fundingRate?symbol=' + sym + '&limit=40')
      .then((L: Any[]) => put('fund', <><MktSvg x={L.map((r) => r.fundingTime)} series={[{ kind: 'line', v: L.map((r) => +r.fundingRate * 100), color: '#ececec' }]} o={{ day: 1, fl: (v) => v.toFixed(4) + '%' }} /><MktLeg items={[['펀딩비', '#ececec']]} /></>))
      .catch(fail('fund'));
    return () => {
      live = false;
    };
  }, [sym, per, base]);
  return (
    <>
      <div className="mkx-per" ref={perRow}>
        {MKT_PER.map((p) => (
          <button
            key={p[0]}
            type="button"
            className={p[0] === per ? 'on' : ''}
            onClick={() => {
              MKT.per = p[0];
              setPer(p[0]);
            }}
          >
            {p[1]}
          </button>
        ))}
      </div>
      <div className="mkx-grid">
        {DATA_CARDS.map((c) => (
          <section className="mkx-card" id={'mkx-' + c[0]} key={c[0]}>
            <h4>{c[1]}</h4>
            <div className="mkx-body">{cards[c[0]] || <p className="mkt-ld">불러오는 중</p>}</div>
          </section>
        ))}
      </div>
    </>
  );
}

/** 차트 칸: 탭 줄(mktTabsMount) + 차트 + 정보 + 데이터. ref 는 시세 출처와 운용 거래소가 다를 때의 한 줄(mktRefNote) */
export function MktChart({ stratSym, refEx }: { stratSym: string | null; refEx: { id: string; name: string } | null }) {
  useMkt();
  const sym = mktSym(stratSym);
  const tab = MKT.tab;
  const setTab = (t: typeof MKT.tab) => {
    MKT.tab = t;
    emit();
  };
  const showRef = refEx && refEx.id !== 'binance';
  return (
    <div className="tft-chart">
      <div className="mkt-tabs" role="tablist">
        {([['chart', '차트'], ['info', '정보'], ['data', '데이터']] as [typeof MKT.tab, string][]).map((x) => (
          <button key={x[0]} type="button" role="tab" data-t={x[0]} className={tab === x[0] ? 'on' : undefined} aria-selected={tab === x[0]} onClick={() => setTab(x[0])}>
            {x[1]}
          </button>
        ))}
        {showRef && refEx && (
          <span className="mkt-ref" data-k={refEx.id + '|' + refEx.name}>
            <TbIcon id="binance" z={14} />
            <span>Binance 시세</span>
            <span className="sp" />
            <TbIcon id={refEx.id} z={14} />
            <span>{refEx.name}에서 운용</span>
          </span>
        )}
      </div>
      <Chart sym={sym} hidden={tab !== 'chart'} />
      <div className="mkt-pane" id="mkt-info" hidden={tab !== 'info'}>
        {tab === 'info' && <Info sym={sym} />}
      </div>
      <div className="mkt-pane" id="mkt-data" hidden={tab !== 'data'}>
        {tab === 'data' && <Data sym={sym} />}
      </div>
    </div>
  );
}

/* ── 종목 선택 창 (mktPick) ── */
function MktPick({ cur }: { cur: string }) {
  useMkt();
  const [state, setState] = useState<'load' | 'ok' | 'fail'>(MKT.all ? 'ok' : 'load');
  const ov = useRef<HTMLDivElement>(null);
  const qRef = useRef<HTMLInputElement>(null);
  const close = () => {
    MKT.pickOpen = false;
    emit();
  };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', esc);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (window.innerWidth > 860) t = setTimeout(() => qRef.current?.focus(), 30);
    /* mktAll(): 7일 안에 거래가 있는 종목 전부 */
    const go: Promise<unknown> =
      MKT.all && Date.now() - MKT.allAt < 15000
        ? Promise.resolve()
        : Promise.all([mktApi('/fapi/v1/ticker/24hr'), mktExiLoad(), mktIconsLoad()]).then((r) => {
            const now = Date.now();
            const L = r[0] as Tick[];
            MKT.all = L.filter((s) => /USDT$/.test(s.symbol) && (!MKT_EXI || !Object.keys(MKT_EXI).length || MKT_EXI[s.symbol]) && now - +s.closeTime < 7 * 864e5);
            MKT.allAt = now;
          });
    go.then(() => setState('ok')).catch(() => setState('fail'));
    return () => {
      document.removeEventListener('keydown', esc);
      clearTimeout(t);
    };
  }, []);
  const q = MKT.q;
  let rows: ReactNode = <p className="mkp-ld">불러오는 중</p>;
  if (state === 'fail') rows = <p className="mkp-ld">종목을 불러오지 못했습니다. 잠시 뒤 다시 열어 주십시오.</p>;
  else if (state === 'ok' && MKT.all) {
    const L = MKT.all.filter((s) => {
      const b = mktBase(s.symbol);
      if (MKT.src === 'fav' && MKT.fav.indexOf(s.symbol) < 0) return false;
      if (MKT.cat !== 'all' && !mktCatOf(s.symbol)[MKT.cat]) return false;
      if (q) {
        const ko = MKT_KO[b] || '';
        if (s.symbol.indexOf(q) < 0 && ko.indexOf(q) < 0 && ko.toUpperCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    const key = { sym: (s: Tick) => s.symbol as string | number, px: (s: Tick) => +s.lastPrice, chg: (s: Tick) => +s.priceChangePercent, qv: (s: Tick) => +s.quoteVolume }[MKT.sort];
    L.sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return MKT.desc ? -r : r;
    });
    rows = L.length ? (
      L.map((s) => {
        const b = mktBase(s.symbol);
        const up = +s.priceChangePercent >= 0;
        const fav = MKT.fav.indexOf(s.symbol) >= 0;
        const ko = MKT_KO[b];
        return (
          <div
            key={s.symbol}
            className={'mkp-r' + (s.symbol === cur ? ' on' : '')}
            role="button"
            tabIndex={0}
            onClick={() => mktSet(s.symbol)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') mktSet(s.symbol);
            }}
          >
            <button
              type="button"
              className={'mkp-st' + (fav ? ' on' : '')}
              aria-label="즐겨찾기"
              onClick={(e) => {
                e.stopPropagation();
                const i = MKT.fav.indexOf(s.symbol);
                if (i >= 0) MKT.fav.splice(i, 1);
                else MKT.fav.push(s.symbol);
                try {
                  localStorage.setItem('teth.mkt.fav', JSON.stringify(MKT.fav));
                } catch {
                  /* 무시 */
                }
                emit();
              }}
            >
              {fav ? '★' : '☆'}
            </button>
            <span className="mkp-s">
              <MktIcon base={b} sz={20} />
              <b>{s.symbol}</b>
              {ko ? <em>{ko}</em> : null}
            </span>
            <span className="num">{mktFmt(s.lastPrice)}</span>
            <span className={'num ' + (up ? 'up' : 'dn')}>{(up ? '+' : '') + (+s.priceChangePercent).toFixed(2) + '%'}</span>
            <span className="num">{mktBig(s.quoteVolume)}</span>
          </div>
        );
      })
    ) : (
      <p className="mkp-ld">{MKT.src === 'fav' ? '즐겨찾기한 종목이 없습니다. 별을 눌러 추가합니다.' : '찾는 종목이 없습니다.'}</p>
    );
  }
  const seg = (list: [string, string][], curV: string, set: (v: string) => void) =>
    list.map((x) => (
      <button key={x[0]} type="button" data-v={x[0]} className={curV === x[0] ? 'on' : ''} onClick={() => set(x[0])}>
        {x[1]}
      </button>
    ));
  return createPortal(
    <div
      id="mkp"
      className="mkp-ov"
      ref={ov}
      onClick={(e) => {
        if (e.target === ov.current) close();
      }}
    >
      <div className="mkp" role="dialog" aria-label="종목 선택">
        <div className="mkp-hd">
          <div>
            <h3>종목 선택</h3>
            <p>거래할 종목을 검색해 고릅니다.</p>
          </div>
          <button type="button" className="mkp-x" aria-label="닫기" onClick={close}>
            ✕
          </button>
        </div>
        <label className="mkp-q">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            id="mkp-q"
            type="search"
            placeholder="종목 검색"
            autoComplete="off"
            defaultValue={MKT.q}
            ref={qRef}
            onInput={(e) => {
              MKT.q = e.currentTarget.value.trim().toUpperCase();
              emit();
            }}
          />
        </label>
        <div className="mkp-tabs">
          <div className="mkp-seg" id="mkp-src">
            {seg([['all', '무기한'], ['fav', '즐겨찾기']], MKT.src, (v) => {
              MKT.src = v;
              emit();
            })}
          </div>
          <div className="mkp-seg" id="mkp-cat">
            {seg(MKT_CATS2, MKT.cat, (v) => {
              MKT.cat = v;
              emit();
            })}
          </div>
        </div>
        <div className="mkp-th">
          {([['sym', '종목'], ['px', '최근가'], ['chg', '24시간 변동'], ['qv', '거래대금']] as [typeof MKT.sort, string][]).map((x) => (
            <button
              key={x[0]}
              type="button"
              data-s={x[0]}
              className={MKT.sort === x[0] ? 'on' : ''}
              onClick={() => {
                if (MKT.sort === x[0]) MKT.desc = !MKT.desc;
                else {
                  MKT.sort = x[0];
                  MKT.desc = x[0] !== 'sym';
                }
                emit();
              }}
            >
              {x[1] + (MKT.sort === x[0] ? (MKT.desc ? ' ↓' : ' ↑') : '')}
            </button>
          ))}
        </div>
        <div className="mkp-rows" id="mkp-rows">
          {rows}
        </div>
      </div>
    </div>,
    document.body,
  );
}
