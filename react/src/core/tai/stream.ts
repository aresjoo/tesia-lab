// AI 프록시와 시세 공급처에 닿는 층. 화면을 모른다. (원본 TAI, taiPing, taiEnsure, taiResolveProxy, taiStream, taiBinDirect)
import { binAttachDaily, binSnapshot } from './market';
import { parseSseLine, type StreamEv } from './tags';
import type { ChatMsg, Ohlc } from './types';

const PROXY_POINTER = 'https://raw.githubusercontent.com/aresjoo/tesia-lab/proxy-url/PROXY_URL';

/** TAI 의 연결 쪽 값. url 은 로컬 프록시가 기본이고, 닿지 않으면 배포 프록시 주소로 바뀐다 */
export const NET: {
  url: string;
  ok: boolean | null;
  rq: number;
  req: { id: number; ctrl: AbortController | null; cancelled?: boolean } | null;
  liteNext: boolean;
  /** 요청 상태가 바뀔 때 (보내기 단추와 중지 단추 맞추기) */
  onBusy: () => void;
} = { url: 'http://localhost:8799/api/chat', ok: null, rq: 0, req: null, liteNext: false, onBusy: () => {} };

const isLocalUrl = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u);

/** taiPing(done) */
export function taiPing(done?: (v: boolean) => void) {
  let fin = false;
  const end = (v: boolean) => {
    if (fin) return;
    fin = true;
    NET.ok = v;
    if (done) done(v);
  };
  setTimeout(() => end(false), 3500);
  try {
    fetch(NET.url.replace('/api/chat', '/api/ping'))
      .then((r) => r.json())
      .then((j: { ok?: boolean }) => end(!!j.ok))
      .catch(() => end(false));
  } catch {
    end(false);
  }
}
/** taiResolveProxy(done): 배포 환경에서 프록시 주소를 정한다. 로컬에서는 항상 localhost:8799 */
export function taiResolveProxy(done: () => void, configProxy?: string) {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    done();
    return;
  }
  if (configProxy) {
    NET.url = configProxy.replace(/\/$/, '') + '/api/chat';
    done();
    return;
  }
  let fin = false;
  const go = () => {
    if (!fin) {
      fin = true;
      done();
    }
  };
  setTimeout(go, 4000);
  fetch(PROXY_POINTER + '?t=' + Date.now())
    .then((r) => (r.ok ? r.text() : ''))
    .then((u) => {
      u = (u || '').trim();
      if (/^https:\/\/[\w.-]+$/.test(u)) NET.url = u + '/api/chat';
      go();
    })
    .catch(go);
}
/** taiEnsure(cb): 보내기 직전 연결 확인. 끊김으로 적혀 있으면 한 번 더 보고, 로컬 프록시가 없으면 배포 프록시로 넘어간다 */
export function taiEnsure(cb: (ok: boolean) => void) {
  if (NET.ok !== false) {
    cb(true);
    return;
  }
  taiPing((v) => {
    if (v) {
      cb(true);
      return;
    }
    if (!isLocalUrl(NET.url)) {
      taiResolveProxy(() => taiPing((v2) => cb(v2)));
      return;
    }
    fetch(PROXY_POINTER + '?t=' + Date.now())
      .then((r) => (r.ok ? r.text() : ''))
      .then((u) => {
        u = (u || '').trim();
        if (/^https:\/\/[\w.-]+$/.test(u)) {
          NET.url = u + '/api/chat';
          taiPing((v2) => cb(v2));
        } else cb(false);
      })
      .catch(() => cb(false));
  });
}

export type FailKind = 'abort' | 'abort-partial' | 'error' | 'error-partial';
/**
 * taiStream: 답변을 흘려 받는다. 서버가 보낸 done 이 있어야 성공이다(끊긴 답을 완료로 치지 않는다).
 * 연결이 안 되면 프록시 주소를 다시 읽어 한 번만 다시 보낸다.
 */
export function taiStream(system: string, msgs: ChatMsg[], onText: (t: string) => void, onDone: () => void, onFail: (k: FailKind) => void, onMeta?: (m: StreamEv) => void) {
  let got = false;
  let sawDone = false;
  NET.rq++;
  const myId = NET.rq;
  const lite = NET.liteNext;
  NET.liteNext = false;
  const alive = () => !!NET.req && NET.req.id === myId;
  const fin = () => {
    if (alive()) {
      NET.req = null;
      NET.onBusy();
    }
  };
  const attempt = (retriesLeft: number) => {
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    NET.req = { id: myId, ctrl };
    NET.onBusy();
    fetch(NET.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, messages: msgs, lite: lite || undefined }), signal: ctrl ? ctrl.signal : undefined })
      .then((r) => {
        if (!r.ok || !r.body) throw 0;
        const rd = r.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        const pump = (): Promise<void> =>
          rd.read().then((x) => {
            if (x.done || !alive()) return;
            buf += dec.decode(x.value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const L of lines) {
              const ev = parseSseLine(L);
              if (!ev) continue;
              if (ev.error) throw 0;
              if (alive() && onMeta) {
                if (ev.think) onMeta({ think: ev.think });
                if (ev.tok) onMeta({ tok: ev.tok });
                if (ev.tool) onMeta({ tool: ev.tool });
                if (ev.sres) onMeta({ sres: ev.sres });
                if (ev.fres) onMeta({ fres: ev.fres });
                if (ev.tres) onMeta({ tres: ev.tres });
                if (ev.mres) onMeta({ mres: ev.mres });
                if (ev.done && ev.usage) onMeta({ usage: ev.usage });
              }
              if (ev.done) sawDone = true;
              if (ev.text && alive()) {
                got = true;
                onText(ev.text);
              }
            }
            return pump();
          });
        return pump().then(() => {
          fin();
          if (!got) throw 0;
          if (!sawDone) throw 0;
          NET.ok = true;
          onDone();
        });
      })
      .catch((err: unknown) => {
        const aborted = !!err && (err as { name?: string }).name === 'AbortError';
        if (!aborted && !got && retriesLeft > 0 && alive() && !(NET.req && NET.req.cancelled)) {
          taiResolveProxy(() => {
            if (alive() && !(NET.req && NET.req.cancelled)) attempt(retriesLeft - 1);
            else {
              fin();
              onFail('abort');
            }
          });
          return;
        }
        fin();
        if (!aborted && !got) NET.ok = false;
        onFail(aborted ? (got ? 'abort-partial' : 'abort') : got ? 'error-partial' : 'error');
      });
  };
  attempt(1);
}
/** taiStop() */
export function taiStop() {
  if (NET.req) {
    NET.req.cancelled = true;
    if (NET.req.ctrl) NET.req.ctrl.abort();
  }
}

/** taiBinDirect: 바이낸스 시세는 브라우저에서 바로 받는다 */
export function taiBinDirect(sym: string, iv: string, signal?: AbortSignal | null, n?: number): Promise<Ohlc> {
  n = Math.max(10, Math.min(300, n || 90));
  const mk = (host: string, iv2: string, n2: number) =>
    fetch(host + '/api/v3/klines?symbol=' + encodeURIComponent(sym) + '&interval=' + encodeURIComponent(iv2) + '&limit=' + n2, signal ? { signal } : {}).then((r) => {
      if (!r.ok) throw 0;
      return r.json() as Promise<unknown[][]>;
    });
  const fetchIv = (iv2: string, n2: number) => mk('https://api.binance.com', iv2, n2).catch(() => mk('https://data-api.binance.vision', iv2, n2));
  return fetchIv(iv, n).then((k) => {
    if (!Array.isArray(k) || !k.length) throw 0;
    const out = binSnapshot(k, iv, Date.now());
    if (iv === '1d') {
      binAttachDaily(out, k);
      return out;
    }
    return fetchIv('1d', 31)
      .then((dk) => {
        if (Array.isArray(dk) && dk.length > 1) binAttachDaily(out, dk);
        return out;
      })
      .catch(() => out);
  });
}
/** 프록시의 /api/ohlc (코인 폴백과 주식, 지수) */
export function ohlcViaProxy(src: string, sym: string, iv: string, n?: number, signal?: AbortSignal | null): Promise<Ohlc> {
  return fetch(NET.url.replace('/api/chat', '/api/ohlc') + '?src=' + encodeURIComponent(src) + '&sym=' + encodeURIComponent(sym) + '&iv=' + encodeURIComponent(iv) + (n != null ? '&n=' + n : ''), signal ? { signal } : {}).then((r) => {
    if (!r.ok) throw r.status;
    return r.json() as Promise<Ohlc>;
  });
}
/** 종목 표기("binance:BTCUSDT")로 시세를 받는다 */
export function fetchOhlc(data: string, iv: string, n?: number, signal?: AbortSignal | null): Promise<Ohlc> {
  const p = data.split(':');
  const sym = p.slice(1).join(':');
  return p[0] === 'binance' ? taiBinDirect(sym, iv, signal, n).catch(() => ohlcViaProxy(p[0], sym, iv, n, signal)) : ohlcViaProxy(p[0], sym, iv, n, signal);
}
