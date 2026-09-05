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

async function ohlc(url, h) {
  const q = url.searchParams;
  const src = q.get("src"), sym = String(q.get("sym") || "").slice(0, 24);
  const IV = { "1m": 1, "5m": 1, "15m": 1, "30m": 1, "1h": 1, "4h": 1, "1d": 1, "1w": 1 };
  const iv = IV[q.get("iv")] ? q.get("iv") : "1d";
  try {
    let rows = [];
    if (src === "binance") {
      /* 데이터센터 IP 지역 차단 회피: 공개 시세 미러(binance.vision) 우선, 본 API 폴백 */
      const path = `/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${iv}&limit=90`;
      let j = null;
      for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
        try { const r = await fetch(host + path); if (r.ok) { j = await r.json(); break; } } catch (e) {}
      }
      if (Array.isArray(j)) rows = j.map((k) => [k[0], +k[1], +k[2], +k[3], +k[4], +k[5]]);
    } else if (src === "yahoo") {
      const YIV = { "1m": "5m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "60m", "4h": "60m", "1d": "1d", "1w": "1wk" };
      const YRG = { "5m": "5d", "15m": "5d", "30m": "1mo", "60m": "1mo", "1d": "3mo", "1wk": "2y" };
      const yiv = YIV[iv], yrg = YRG[yiv];
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${yiv}&range=${yrg}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const j = await r.json();
      const d = j?.chart?.result?.[0], ts = d?.timestamp || [], qd = d?.indicators?.quote?.[0];
      if (qd) rows = ts.map((t, i) => [t * 1000, qd.open[i], qd.high[i], qd.low[i], qd.close[i], qd.volume ? qd.volume[i] || 0 : 0]).filter((x) => x[4] != null);
      rows = rows.slice(-90);
    }
    if (!rows.length) throw 0;
    const closes = rows.map((x) => x[4]), last = closes[closes.length - 1];
    const pctFrom = (n) => { const p = closes[closes.length - 1 - n]; return p ? +((last / p - 1) * 100).toFixed(2) : null; };
    return json({
      last: +last.toPrecision(6), chg1d: pctFrom(1), chg7d: pctFrom(7), chg30d: pctFrom(30),
      hi90: +Math.max(...rows.map((x) => x[2])).toPrecision(6), lo90: +Math.min(...rows.map((x) => x[3])).toPrecision(6),
      closes30: closes.slice(-30).map((v) => +v.toPrecision(5)),
      rows: rows.slice(-60).map((x) => [x[0], +x[1].toPrecision(5), +x[2].toPrecision(5), +x[3].toPrecision(5), +x[4].toPrecision(5), +(x[5] || 0).toPrecision(4)]),
    }, h);
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
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    ctx.waitUntil((async () => {
      try {
        const stream = client.beta.messages.stream({
          model: env.TETH_AI_MODEL || MODEL_DEFAULT,
          max_tokens: 16000,
          output_config: { effort: env.TETH_AI_EFFORT || EFFORT_DEFAULT },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: String(payload.system || "").slice(0, 8000),
          messages,
        });
        stream.on("text", (delta) => send({ text: delta }));
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") await send({ text: "이 질문에는 답변드리기 어렵습니다. 전략이나 검증 결과에 대해 물어봐 주세요." });
        await send({ done: true });
      } catch (e) {
        await send({ error: true });
      } finally {
        try { await w.close(); } catch (e) {}
      }
    })());
    return new Response(readable, { headers: { ...c.h, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  },
};
