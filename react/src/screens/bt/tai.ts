// 모델 프록시 부르기 (원본 TAI, taiPing, taiEnsure, btAiCall). 대화 조각이 같은 것을 옮기면 그쪽으로 모은다.
import { btAiParse } from '../../core/bt/ai';

export const TAI: { url: string; ok: boolean | null } = { url: 'http://localhost:8799/api/chat', ok: null };

/** taiPing(done) */
function taiPing(done: (v: boolean) => void) {
  let fin = false;
  const end = (v: boolean) => {
    if (fin) return;
    fin = true;
    TAI.ok = v;
    done(v);
  };
  setTimeout(() => end(false), 3500);
  try {
    fetch(TAI.url.replace('/api/chat', '/api/ping'))
      .then((r) => r.json())
      .then((j) => end(!!j.ok))
      .catch(() => end(false));
  } catch {
    end(false);
  }
}
/** taiEnsure(cb): 프록시가 죽어 있었으면 다시 찾아본다 */
export function taiEnsure(cb: (ok: boolean) => void) {
  if (TAI.ok !== false) {
    cb(true);
    return;
  }
  taiPing((v) => {
    if (v) {
      cb(true);
      return;
    }
    fetch('https://raw.githubusercontent.com/aresjoo/tesia-lab/proxy-url/PROXY_URL?t=' + Date.now())
      .then((r) => (r.ok ? r.text() : ''))
      .then((u) => {
        u = (u || '').trim();
        if (/^https:\/\/[\w.-]+$/.test(u)) {
          TAI.url = u + '/api/chat';
          taiPing(cb);
        } else cb(false);
      })
      .catch(() => cb(false));
  });
}

/** btAiCall(o,cb): 지시문과 값을 넘겨 글을 받는다. 실패하면 이유만 돌려준다 */
export function btAiCall(o: { system: string; user: string; timeout?: number; think?: boolean }, cb: (err: string | null, t?: string) => void) {
  let done = false;
  const fin = (e: string | null, t?: string) => {
    if (done) return;
    done = true;
    cb(e, t);
  };
  const to = setTimeout(() => fin('timeout'), o.timeout || 25000);
  const go = (ok: boolean) => {
    if (!ok) {
      clearTimeout(to);
      fin('offline');
      return;
    }
    const body: Record<string, unknown> = { messages: [{ role: 'user', content: o.user }], system: o.system };
    if (o.think) body.think = true;
    else body.plain = true;
    fetch(TAI.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.text();
      })
      .then((raw) => {
        clearTimeout(to);
        const t = btAiParse(raw);
        if (t == null) fin('bad');
        else fin(null, t);
      })
      .catch((e) => {
        clearTimeout(to);
        fin(String(e));
      });
  };
  taiEnsure(go);
}
