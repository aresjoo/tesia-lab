/* TETH AI 프록시 — Cloudflare Workers 배포판.
 * 로컬 개발은 index.mjs(Node), 실배포는 이 파일. 프로토콜은 동일:
 *   POST /api/chat  → SSE data:{text}/{done}/{error}
 *   GET  /api/ohlc  → 실시세 스냅샷 (코인: Binance, 그 외: Yahoo)
 *   GET  /api/ping  → {ok}
 * /api/state 는 의도적으로 미구현(404) — 공개 환경에서 대화 저장은 기기 localStorage로 폴백된다.
 * 크레딧 보호: 허용 오리진 제한 + IP당 분당 버스트 제한 + KV 일일 총량 상한. */
import Anthropic from "@anthropic-ai/sdk";

const MODEL_DEFAULT = "claude-fable-5";
const EFFORT_DEFAULT = "high";
const DAILY_CAP = 400; /* KV 바인딩(RL) 있을 때 하루 chat 요청 총량 상한 */
const BURST_MAX = 8;   /* IP당 60초 내 chat 요청 상한 (아이솔레이트 단위 근사) */
const ORIGIN_OK = [/^https:\/\/aresjoo\.github\.io$/, /^https?:\/\/localhost(?::\d+)?$/, /^https?:\/\/127\.0\.0\.1(?::\d+)?$/];

const burst = new Map();
function burstOk(ip) {
  const now = Date.now();
  const arr = (burst.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= BURST_MAX) { burst.set(ip, arr); return false; }
  arr.push(now); burst.set(ip, arr);
  if (burst.size > 5000) burst.clear(); /* 메모리 상한 */
  return true;
}
async function dailyOk(env) {
  if (!env.RL) return true;
  try {
    const key = "chat:" + new Date().toISOString().slice(0, 10);
    const n = parseInt((await env.RL.get(key)) || "0", 10);
    if (n >= DAILY_CAP) return false;
    await env.RL.put(key, String(n + 1), { expirationTtl: 172800 });
  } catch (e) { /* KV 장애가 서비스를 막지 않게 */ }
  return true;
}
function cors(origin) {
  const ok = ORIGIN_OK.some((r) => r.test(origin || ""));
  return { ok, h: {
    "Access-Control-Allow-Origin": ok ? origin : "https://aresjoo.github.io",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  } };
}
const json = (o, h, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { ...h, "Content-Type": "application/json" } });

/* ── 시장 데이터 계약(0단): count 관통·실공급처/실인터벌 meta·듀얼 스냅샷(24h 기준선+일봉 30) ──
   폴백이 요청 간격을 몰래 다른 간격으로 채우지 않는다: Coinbase 4h=1h×4·30m=15m×2 재집계,
   불가 조합(1w 등)은 정직하게 실패. 구 클라이언트 호환 필드(chg1d/closes30/rows) 유지. */
function aggBars(rows, m) {
  const out = [];
  for (let i = rows.length % m; i + m <= rows.length; i += m) {
    const g = rows.slice(i, i + m);
    out.push([g[0][0], g[0][1], Math.max(...g.map((x) => x[2])), Math.min(...g.map((x) => x[3])), g[g.length - 1][4], g.reduce((s, x) => s + (x[5] || 0), 0)]);
  }
  return out;
}
async function coinRows(sym, iv, n) {
  const path = `/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${iv}&limit=${n}`;
  for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
    try { const r = await fetch(host + path); if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j.length) return { src: "binance", iv, rows: j.map((k) => [k[0], +k[1], +k[2], +k[3], +k[4], +k[5]]) }; } } catch (e) {}
  }
  const base = sym.replace(/USDT$/, "");
  if (!base) return null;
  const KIV = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440, "1w": 10080 };
  try {
    const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent((base === "BTC" ? "XBT" : base) + "USDT")}&interval=${KIV[iv] || 1440}`);
    if (r.ok) {
      const kj = await r.json();
      const key = kj && kj.result && Object.keys(kj.result).find((k) => k !== "last");
      const arr = key ? kj.result[key] : null;
      if (Array.isArray(arr) && arr.length) return { src: "kraken", iv, rows: arr.slice(-n).map((k) => [k[0] * 1000, +k[1], +k[2], +k[3], +k[4], +k[6]]) };
    }
  } catch (e) {}
  const CB = { "1m": [60, 1], "5m": [300, 1], "15m": [900, 1], "30m": [900, 2], "1h": [3600, 1], "4h": [3600, 4], "1d": [86400, 1] };
  const cb = CB[iv];
  if (!cb) return null; /* 1w 등 재집계 불가 조합은 정직 실패 */
  try {
    const r = await fetch(`https://api.exchange.coinbase.com/products/${encodeURIComponent(base + "-USD")}/candles?granularity=${cb[0]}`, { headers: { "User-Agent": "teth-ai-proxy" } });
    if (r.ok) {
      const cj = await r.json();
      if (Array.isArray(cj) && cj.length) {
        let rows = cj.slice(0, Math.min(300, n * cb[1])).reverse().map((k) => [k[0] * 1000, +k[3], +k[2], +k[1], +k[4], +k[5]]);
        if (cb[1] > 1) rows = aggBars(rows, cb[1]);
        return { src: "coinbase", iv, rows: rows.slice(-n) };
      }
    }
  } catch (e) {}
  return null;
}
async function yahooRows(sym, iv, n) {
  const YIV = { "1m": "5m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "60m", "4h": "60m", "1d": "1d", "1w": "1wk" };
  const yiv = YIV[iv] || "1d";
  const YRG = { "5m": "5d", "15m": "5d", "30m": "1mo", "60m": "1mo", "1d": n > 120 ? "2y" : "6mo", "1wk": "5y" };
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${yiv}&range=${YRG[yiv] || "6mo"}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  const j = await r.json();
  const d = j?.chart?.result?.[0], ts = d?.timestamp || [], qd = d?.indicators?.quote?.[0];
  if (!qd) return null;
  const rows = ts.map((t, i) => [t * 1000, qd.open[i], qd.high[i], qd.low[i], qd.close[i], qd.volume ? qd.volume[i] || 0 : 0]).filter((x) => x[4] != null);
  const actual = (iv === "4h" && yiv === "60m") ? "1h" : (iv === "1m" ? "5m" : iv); /* 요청과 다른 실인터벌은 그대로 보고 */
  return { src: "yahoo", iv: actual, rows: rows.slice(-n) };
}
function summarize(rows) {
  const closes = rows.map((x) => x[4]), last = closes[closes.length - 1];
  const pctFrom = (k) => { const p = closes[closes.length - 1 - k]; return p ? +((last / p - 1) * 100).toFixed(2) : null; };
  const samp = [];
  for (let i = 0; i < Math.min(30, rows.length); i++) samp.push(rows[Math.min(rows.length - 1, Math.round(i * (rows.length - 1) / Math.max(1, Math.min(30, rows.length) - 1)))]);
  return {
    last: +last.toPrecision(6), chg1d: pctFrom(1), chg7d: pctFrom(7), chg30d: pctFrom(30),
    ivChg: pctFrom(1),
    hi90: +Math.max(...rows.map((x) => x[2])).toPrecision(6), lo90: +Math.min(...rows.map((x) => x[3])).toPrecision(6),
    closes30: closes.slice(-30).map((v) => +v.toPrecision(5)),
    closesS: samp.map((r) => [r[0], +r[4].toPrecision(6)]), /* 전 구간 균등 샘플 [ts, close] — 장기 조회가 헛되지 않게 */
    rows: rows.slice(-300).map((x) => [x[0], +x[1].toPrecision(6), +x[2].toPrecision(6), +x[3].toPrecision(6), +x[4].toPrecision(6), +(x[5] || 0).toPrecision(4)]),
  };
}
function attachDaily(out, drows, isCoin) {
  const closes = drows.map((x) => x[4]);
  const last = closes[closes.length - 1], prev = closes[closes.length - 2];
  out.base = { chg: prev ? +((last / prev - 1) * 100).toFixed(2) : null, label: isCoin ? "24H" : "전일比" };
  out.daily = drows.slice(-30).map((x) => [new Date(x[0]).toISOString().slice(0, 10), +x[4].toPrecision(6)]);
}
async function ohlc(url, h) {
  const q = url.searchParams;
  const src = q.get("src"), sym = String(q.get("sym") || "").slice(0, 24);
  const IV = { "1m": 1, "5m": 1, "15m": 1, "30m": 1, "1h": 1, "4h": 1, "1d": 1, "1w": 1 };
  const iv = IV[q.get("iv")] ? q.get("iv") : "1d";
  const n = Math.max(10, Math.min(300, parseInt(q.get("n") || "90", 10) || 90));
  try {
    const got = src === "binance" ? await coinRows(sym, iv, n) : src === "yahoo" ? await yahooRows(sym, iv, n) : null;
    if (!got || !got.rows.length) throw 0;
    const out = summarize(got.rows);
    out.meta = { src: got.src, iv: got.iv, n: got.rows.length, at: Date.now(), quality: got.iv === iv ? "complete" : "adjusted" };
    if (iv !== "1d") {
      try {
        const dg = src === "binance" ? await coinRows(sym, "1d", 31) : await yahooRows(sym, "1d", 31);
        if (dg && dg.rows.length > 1) attachDaily(out, dg.rows, src === "binance");
      } catch (e) {}
    } else attachDaily(out, got.rows, src === "binance");
    return json(out, h);
  } catch (e) { return new Response(null, { status: 502, headers: h }); }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const c = cors(req.headers.get("Origin"));
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c.h });
    if (url.pathname === "/api/ping") return json({ ok: !!env.ANTHROPIC_API_KEY }, c.h);
    if (url.pathname === "/api/ohlc") return ohlc(url, c.h);
    if (url.pathname !== "/api/chat" || req.method !== "POST") return new Response("not found", { status: 404, headers: c.h });

    if (!c.ok) return new Response("forbidden", { status: 403, headers: c.h });
    const ip = req.headers.get("CF-Connecting-IP") || "?";
    if (!burstOk(ip)) return new Response("rate limited", { status: 429, headers: c.h });
    if (!(await dailyOk(env))) return new Response("daily cap", { status: 429, headers: c.h });

    let payload;
    try { payload = await req.json(); } catch (e) { return new Response(null, { status: 400, headers: c.h }); }
    const messages = (Array.isArray(payload.messages) ? payload.messages : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
      .slice(-16);
    if (!messages.length) return new Response(null, { status: 400, headers: c.h });
    if (!env.ANTHROPIC_API_KEY) return new Response(null, { status: 503, headers: c.h });

    const { readable, writable } = new TransformStream();
    const w = writable.getWriter();
    const enc = new TextEncoder();
    const send = (o) => w.write(enc.encode("data: " + JSON.stringify(o) + "\n\n")).catch(() => {});
    /* Workers에서 api.anthropic.com 직접 호출은 엣지에서 빈 400으로 차단됨 (알려진 이슈).
     * Cloudflare AI Gateway를 경유해 우회한다 — 키는 그대로 Anthropic 키를 쓴다. */
    const AI_GATEWAY_BASE = env.TETH_AI_GATEWAY || "https://gateway.ai.cloudflare.com/v1/6c44d33270e146fd313f864ef2b07568/teth/anthropic";
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: AI_GATEWAY_BASE });
    ctx.waitUntil((async () => {
      try {
        const isThink = payload.think === true;
        const stream = isThink ? client.beta.messages.stream({
          model: env.TETH_THINK_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: String(payload.system || "").slice(0, 4000),
          messages,
        }) : client.beta.messages.stream({
          model: env.TETH_AI_MODEL || MODEL_DEFAULT,
          max_tokens: 16000,
          thinking: { type: "adaptive", display: "summarized" }, // display 미지정 시 기본 omitted — thinking_delta 가 빈 값으로 온다
          output_config: { effort: env.TETH_AI_EFFORT || EFFORT_DEFAULT },
          tools: [
            { type: "web_search_20260209", name: "web_search" },
            { type: "web_fetch_20260209", name: "web_fetch" },
          ],
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: String(payload.system || "").slice(0, 8000),
          messages,
        });
        /* 서버사이드 chips 검증 — 프롬프트를 신뢰하지 않는다. <chips> 이후 텍스트를 보류했다가
         * 스트림 종료 시 스키마(허용 타입 4종, 액션 최대 2개)를 통과할 때만 원문 그대로 방류한다.
         * 프로토콜은 그대로라 클라이언트는 이 검증의 존재를 몰라도 된다. */
        const CHIP_OPEN = "<chips>";
        const CHIP_ACTIONS = ["backtest", "alert", "delegate", "auto"];
        let chipTail = "", chipHold = "", chipMode = false;
        const emitText = (t) => { if (t) send({ text: t }); };
        const chipsValid = (block) => {
          const m = /^<chips>([\s\S]*)<\/chips>\s*$/.exec(block.trim());
          if (!m) return false;
          try {
            const parsed = JSON.parse(m[1]);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
            if (parsed.suggest !== undefined && !Array.isArray(parsed.suggest)) return false;
            if (parsed.action !== undefined) {
              if (!Array.isArray(parsed.action) || parsed.action.length > 2) return false;
              for (const a of parsed.action) if (!a || typeof a !== "object" || !CHIP_ACTIONS.includes(a.type) || typeof a.label !== "string" || !a.label.trim()) return false;
            }
            return true;
          } catch (e) { return false; }
        };
        /* work model 라벨 서버 검증 — 라우팅 표 밖 model 은 속성째 제거해 클라이언트
         * 뱃지에 도달하지 못하게 한다. 표는 src/teth-model-routing.ts 와 동기 유지. */
        const WORK_MODELS = ["claude-fable-5", "gemini-agy-flash", "gpt-sol", "claude-opus-5", "claude-fable-5-1"];
        const WORK_HEAD = "<work";
        const WORK_ATTR_MAX = 192;
        let workTail = "";
        const scrubWorkTag = (tag) => tag.replace(/\s*\bmodel\s*=\s*"([^"]*)"/, (m, v) => WORK_MODELS.includes(v) ? m : "");
        const scrubWork = (delta) => {
          let pending = workTail + delta;
          workTail = "";
          let out = "";
          for (;;) {
            const at = pending.indexOf(WORK_HEAD);
            if (at === -1) {
              let keep = 0; /* 청크 경계에서 잘린 '<work' 접두 꼬리 이월 */
              for (let k = Math.min(WORK_HEAD.length - 1, pending.length); k > 0; k--) {
                if (WORK_HEAD.startsWith(pending.slice(pending.length - k))) { keep = k; break; }
              }
              out += pending.slice(0, pending.length - keep);
              workTail = keep ? pending.slice(pending.length - keep) : "";
              return out;
            }
            out += pending.slice(0, at);
            const rest = pending.slice(at);
            const gt = rest.indexOf(">");
            if (gt === -1) {
              if (rest.length > WORK_ATTR_MAX) { out += WORK_HEAD; pending = rest.slice(WORK_HEAD.length); continue; }
              workTail = rest;
              return out;
            }
            if (gt > WORK_ATTR_MAX) { out += WORK_HEAD; pending = rest.slice(WORK_HEAD.length); continue; }
            out += scrubWorkTag(rest.slice(0, gt + 1));
            pending = rest.slice(gt + 1);
          }
        };
        const flushWork = () => { const rest = workTail; workTail = ""; return rest; };
        const onDelta = (delta) => {
          if (chipMode) { chipHold += delta; return; }
          const pending = chipTail + delta;
          const at = pending.indexOf(CHIP_OPEN);
          if (at !== -1) { emitText(pending.slice(0, at)); chipMode = true; chipHold = pending.slice(at); chipTail = ""; return; }
          let keep = 0; /* 청크 경계에서 잘린 '<chips>' 접두 꼬리는 다음 델타로 이월 */
          for (let k = Math.min(CHIP_OPEN.length - 1, pending.length); k > 0; k--) {
            if (CHIP_OPEN.startsWith(pending.slice(pending.length - k))) { keep = k; break; }
          }
          emitText(pending.slice(0, pending.length - keep));
          chipTail = keep ? pending.slice(pending.length - keep) : "";
        };
        const flushChips = () => {
          if (chipMode) {
            if (chipsValid(chipHold)) emitText(chipHold);
            else console.error("chips drop: schema violation", chipHold.slice(0, 200));
            chipMode = false; chipHold = "";
          } else { emitText(chipTail); }
          chipTail = "";
        };
        stream.on("text", (delta) => { const scrubbed = scrubWork(delta); if (scrubbed) onDelta(scrubbed); });
        /* 실작업 이벤트: 검색/페이지/코드 실행 툴 + 사고 스트림 + 누적 출력 토큰 전달 (index.mjs와 동일 프로토콜) */
        const blocks = {};
        stream.on("streamEvent", (ev) => {
          try {
            if (ev.type === "content_block_start") {
              const cb = ev.content_block || {};
              if (cb.type === "server_tool_use") blocks[ev.index] = { kind: cb.name, json: "", seed: cb.input && Object.keys(cb.input).length ? cb.input : null };
              else if (cb.type === "web_search_tool_result") {
                const ok = Array.isArray(cb.content);
                const rs = ok ? cb.content.filter((r) => r && r.url).map((r) => ({ t: r.title || r.url, u: r.url })) : [];
                send({ sres: { n: rs.length, results: rs.slice(0, 8), error: ok ? undefined : true } });
              } else if (cb.type === "web_fetch_tool_result") {
                const c = cb.content || {};
                const err = c.type === "web_fetch_tool_error";
                send({ fres: { u: (c.content && c.content.url) || c.url || "", error: err ? (c.error_code || true) : undefined } });
              } else if (/_tool_result$/.test(cb.type || "")) {
                send({ tres: { kind: cb.type, error: cb.content && cb.content.type && /error/.test(cb.content.type) ? true : undefined } });
              }
            } else if (ev.type === "content_block_delta" && ev.delta) {
              if (ev.delta.type === "thinking_delta" && ev.delta.thinking) send({ think: ev.delta.thinking });
              else if (ev.delta.type === "input_json_delta" && blocks[ev.index] != null) blocks[ev.index].json += ev.delta.partial_json || "";
            } else if (ev.type === "content_block_stop" && blocks[ev.index] != null) {
              const b = blocks[ev.index]; delete blocks[ev.index];
              let input = b.seed || {}; try { const p = JSON.parse(b.json || "{}"); if (Object.keys(p).length) input = p; } catch (e) {}
              /* p = 생성 시점 purpose 메타 (있을 때만) — 클라이언트 사고 패널 번역 레이어가 소비 */
              send({ tool: { name: b.kind, q: input.query || input.url || (typeof input.code === "string" ? input.code.slice(0, 120) : ""), ...(typeof input.purpose === "string" ? { p: input.purpose.slice(0, 80) } : {}) } });
            } else if (ev.type === "message_delta" && ev.usage && ev.usage.output_tokens) send({ tok: ev.usage.output_tokens });
          } catch (e) {}
        });
        const final = await stream.finalMessage();
        { const rest = flushWork(); if (rest) onDelta(rest); }
        flushChips();
        if (final.stop_reason === "refusal") await send({ text: "이 질문에는 답변드리기 어렵습니다. 전략이나 검증 결과에 대해 물어봐 주세요." });
        await send({ done: true, usage: final.usage ? { in: final.usage.input_tokens, out: final.usage.output_tokens } : undefined });
      } catch (e) {
        console.error("chat error:", e && e.status, e && e.name, e && e.message, e && e.error ? JSON.stringify(e.error) : "(no error body)", e && e.headers ? (e.headers.get ? e.headers.get("request-id") : e.headers["request-id"]) : "");
        await send({ error: true });
      } finally {
        try { await w.close(); } catch (e) {}
      }
    })());
    return new Response(readable, { headers: { ...c.h, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  },
};
