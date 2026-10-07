import { MARKET_TOOL, MARKET_TOOL_POLICY, toolRequestReceipt } from './investment-tool-policy.mjs';
/* TETH AI 프록시 — Cloudflare Workers 배포판.
 * 로컬 개발은 index.mjs(Node), 실배포는 이 파일. 프로토콜은 동일:
 *   POST /api/chat  → SSE data:{text}/{done}/{error}
 *   GET  /api/ohlc  → 실시세 스냅샷 (코인: Binance, 그 외: Yahoo)
 *   GET  /api/ping  → {ok}
 * /api/state 는 의도적으로 미구현(404) — 공개 환경에서 대화 저장은 기기 localStorage로 폴백된다.
 * 크레딧 보호: 허용 오리진 제한 + IP당 분당 버스트 제한 + KV 일일 총량 상한. */
import Anthropic from "@anthropic-ai/sdk";
import { buildInvestmentRequest } from "./investment-prompts.mjs";
import { createInvestmentOutputGate } from "./investment-output-gate.mjs";

const MODEL_DEFAULT = "claude-opus-5-5";
const EFFORT_DEFAULT = "medium";
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
async function coinRows(sym, iv, n, endMs) {
  const path = `/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${iv}&limit=${n}${endMs ? `&endTime=${endMs}` : ""}`;
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
/* ── 2단: AI 청구형 시장 데이터 툴 (market_data) ──
 * 모델이 스냅샷 밖 데이터(비교 자산·다른 인터벌·과거 구간)를 턴 중간에 스스로 청구한다.
 * 가격 계산은 전부 이쪽(결정론) — 모델은 요청만. 요약 JSON(~1.2KB)만 tool_result 로 반환. */
async function runMarketData(input, cache) {
  const fail = (code, message) => ({ ok: false, code, message });
  const sym = String(input.symbol || "").toUpperCase().replace(/[^A-Z0-9^.\-=]/g, "").slice(0, 20);
  const iv = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"].includes(input.interval) ? input.interval : null;
  const n = Math.max(10, Math.min(300, parseInt(input.count, 10) || 90));
  if (!sym || !iv) return fail("UNKNOWN_SYMBOL", "symbol 또는 interval 이 유효하지 않습니다.");
  let endMs = null;
  if (input.end_time) {
    const t = Date.parse(String(input.end_time));
    if (!isFinite(t)) return fail("HISTORY_UNAVAILABLE", "end_time 형식이 유효하지 않습니다 (YYYY-MM-DD).");
    endMs = t;
  }
  const isCoin = /USDT$/.test(sym);
  if (endMs && !isCoin) return fail("HISTORY_UNAVAILABLE", "과거 구간(end_time) 조회는 현재 코인 페어만 지원합니다.");
  const key = sym + "|" + iv + "|" + n + "|" + (endMs || "");
  if (cache.has(key)) return { ...cache.get(key), cached: true };
  const run = (async () => {
    const got = isCoin ? await coinRows(sym, iv, n, endMs) : await yahooRows(sym, iv, n);
    if (!got || !got.rows.length) return fail(endMs ? "HISTORY_UNAVAILABLE" : "UPSTREAM_TIMEOUT", "요청한 데이터를 현재 공급자에서 받지 못했습니다." + (endMs ? " 과거 구간은 바이낸스 직접 응답이 필요합니다." : ""));
    const s = summarize(got.rows);
    return {
      ok: true,
      meta: { src: got.src, iv: got.iv, n: got.rows.length, at: Date.now(), quality: got.iv === iv ? "complete" : "adjusted", ...(endMs ? { end: new Date(endMs).toISOString().slice(0, 10) } : {}) },
      last: s.last, prevBarChg: s.ivChg, chg7: s.chg7d, chg30: s.chg30d, hi: s.hi90, lo: s.lo90,
      closes: s.closesS.map((x) => [new Date(x[0]).toISOString().slice(0, 10), x[1]]),
      note: "closes 는 관측 구간 전체의 균등 샘플(과거→현재). 등락(prevBarChg)은 직전 봉 종가 대비.",
    };
  })();
  const out = await Promise.race([run, new Promise((res) => setTimeout(() => res(fail("UPSTREAM_TIMEOUT", "조회가 8초를 초과했습니다.")), 8000))]);
  if (out.ok) cache.set(key, out);
  return out;
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
    let investment;
    try { investment = await buildInvestmentRequest(payload); }
    catch (error) { return new Response(null, { status: error.status || 400, headers: c.h }); }
    const messages = investment.messages;
    if (!env.ANTHROPIC_API_KEY) return new Response(null, { status: 503, headers: c.h });

    const { readable, writable } = new TransformStream();
    const w = writable.getWriter();
    const enc = new TextEncoder();
    const outputGate = createInvestmentOutputGate((o) => w.write(enc.encode("data: " + JSON.stringify(o) + "\n\n")).catch(() => {}), { settingsPreview: investment.settingsPreview, allowDisplay: investment.mode === "dialogue", allowTitle: investment.allowTitle, allowQuestions: investment.responsePreferences.values.questionsStopped !== true });
    const send = (o) => outputGate.send(o);
    /* Workers에서 api.anthropic.com 직접 호출은 엣지에서 빈 400으로 차단됨 (알려진 이슈).
     * Cloudflare AI Gateway를 경유해 우회한다 — 키는 그대로 Anthropic 키를 쓴다. */
    const AI_GATEWAY_BASE = env.TETH_AI_GATEWAY || "https://gateway.ai.cloudflare.com/v1/6c44d33270e146fd313f864ef2b07568/teth/anthropic";
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: AI_GATEWAY_BASE, maxRetries: 0 });
    ctx.waitUntil((async () => {
      try {
        /* plain: 도구와 검색 없이 본 모델이 짧은 글만 쓴다(백테스트 판단 문장, 결과 해석). 입력은 클라이언트가 계산한 값뿐이다 */
        if (investment.mode !== "dialogue") {
          const stream = client.beta.messages.stream({
            model: env.TETH_AI_MODEL || MODEL_DEFAULT,
            max_tokens: 900,
            output_config: { effort: "low" },
            system: investment.system,
            messages,
          });
          stream.on("text", (delta) => { send({ text: delta }); if (outputGate.failed) stream.abort(); });
          const final = await stream.finalMessage();
          if (final.stop_reason !== "end_turn") { await send({ error: true }); return; }
          await send({ done: true, usage: final.usage ? { in: final.usage.input_tokens, out: final.usage.output_tokens, model: final.model || null, promptId: investment.promptId, promptSha256: investment.promptSha256, basePolicySha256: investment.basePolicySha256, ...(await toolRequestReceipt(undefined)) } : undefined });
          return;
        }
        /* ── 본 경로: 커스텀 툴(market_data) 루프 — 모델 호출 ≤6(초회+pause_turn 포함), 툴 ≤3회/턴.
         * assistant content 는 원본 그대로 보존(사고 서명 포함), tool_result 만 담은 user 턴으로 재개.
         * 브라우저에는 라운드 경계 없이 연속 SSE 로 중계된다. */
        const TOOLS = [
          { type: "web_search_20260209", name: "web_search", max_uses: 3 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
          MARKET_TOOL,
        ];
        const requestTools = payload.lite === true ? undefined : TOOLS;
        const toolReceipt = await toolRequestReceipt(requestTools);
        const convo = messages.map((m) => ({ role: m.role, content: m.content }));
        const mdCache = new Map();
        let modelCalls = 0, toolCalls = 0, totIn = 0, totOut = 0, tokBase = 0;
        const useFast = env.TETH_AI_SPEED === "fast";
        const mkStream = () => client.beta.messages.stream({
          ...(useFast ? { speed: "fast" } : {}),
          model: env.TETH_AI_MODEL || MODEL_DEFAULT,
          max_tokens: 16000,
          thinking: { type: "adaptive", display: "omitted" },
          output_config: { effort: env.TETH_AI_EFFORT || EFFORT_DEFAULT },
          tools: requestTools,
          ...(useFast ? { betas: ["fast-mode-2026-02-01"] } : {}),
          system: investment.system,
          messages: convo,
        });
        /* 실작업 이벤트 중계 — 라운드마다 새 스트림에 부착. blocks 는 라운드 로컬 */
        const attach = (stream, blocks) => {
          stream.on("text", (delta) => { send({ text: delta }); if (outputGate.failed) stream.abort(); });
          stream.on("streamEvent", (ev) => {
            try {
              if (ev.type === "content_block_start") {
                const cb = ev.content_block || {};
                if (cb.type === "server_tool_use") blocks[ev.index] = { kind: cb.name, json: "", seed: cb.input && Object.keys(cb.input).length ? cb.input : null };
                else if (cb.type === "tool_use") blocks[ev.index] = { kind: cb.name, id: cb.id, json: "", seed: cb.input && Object.keys(cb.input).length ? cb.input : null };
                else if (cb.type === "web_search_tool_result") {
                  const ok = Array.isArray(cb.content);
                  const rs = ok ? cb.content.filter((r) => r && r.url).map((r) => ({ t: r.title || r.url, u: r.url })) : [];
                  send({ sres: { n: rs.length, results: rs.slice(0, 8), error: ok ? undefined : true } });
                } else if (cb.type === "web_fetch_tool_result") {
                  const c2 = cb.content || {};
                  const err = c2.type === "web_fetch_tool_error";
                  send({ fres: { u: (c2.content && c2.content.url) || c2.url || "", error: err ? (c2.error_code || true) : undefined } });
                } else if (/_tool_result$/.test(cb.type || "")) {
                  send({ tres: { kind: cb.type, error: cb.content && cb.content.type && /error/.test(cb.content.type) ? true : undefined } });
                }
              } else if (ev.type === "content_block_delta" && ev.delta) {
                if (ev.delta.type === "input_json_delta" && blocks[ev.index] != null) blocks[ev.index].json += ev.delta.partial_json || "";
              } else if (ev.type === "content_block_stop" && blocks[ev.index] != null) {
                const b = blocks[ev.index]; delete blocks[ev.index];
                let input = b.seed || {}; try { const p = JSON.parse(b.json || "{}"); if (Object.keys(p).length) input = p; } catch (e) {}
                if (b.kind === "market_data") {
                  /* 모델의 purpose는 노출하지 않고 요청 심볼/봉만 표시한다. 실행 결과는 별도 이벤트다. */
                  send({ tool: { id: b.id, name: "market_data", q: ((input.symbol || "") + " " + (input.interval || "")).trim() } });
                } else {
                  /* 실제 도구 요청 데이터만 표시한다. 조회 성공이나 검증 완료를 뜻하지 않는다. */
                  send({ tool: { name: b.kind, q: input.query || input.url || (typeof input.code === "string" ? input.code.slice(0, 120) : "") } });
                }
              } else if (ev.type === "message_delta" && ev.usage && ev.usage.output_tokens) send({ tok: tokBase + ev.usage.output_tokens });
            } catch (e) {}
          });
        };
        let final = null;
        for (;;) {
          if (++modelCalls > 6) { console.error("model call budget exceeded"); await send({ error: true }); return; }
          const blocks = {};
          const stream = mkStream();
          attach(stream, blocks);
          final = await stream.finalMessage();
          if (final.usage) { totIn += final.usage.input_tokens || 0; totOut += final.usage.output_tokens || 0; tokBase = totOut; }
          /* 사고 서명·툴 상태 보존을 위해 assistant content 원본 그대로 이어붙인다 (재구성 금지) */
          convo.push({ role: "assistant", content: final.content });
          if (final.stop_reason === "pause_turn") continue;
          if (final.stop_reason === "tool_use") {
            const uses = final.content.filter((b) => b.type === "tool_use");
            if (!uses.length) continue; /* 서버 툴만 보류된 케이스: 같은 구성으로 재개 */
            const results = [];
            for (const u of uses) {
              let out;
              if (u.name !== "market_data") out = { ok: false, code: "UNKNOWN_TOOL", message: "지원하지 않는 툴입니다." };
              else if (toolCalls >= 3) out = { ok: false, code: "BUDGET_EXCEEDED", message: "이번 턴의 데이터 조회 한도(3회)를 초과했습니다. 확보한 데이터로 답하십시오." };
              else { toolCalls++; out = await runMarketData(u.input || {}, mdCache); }
              send({ mres: { id: u.id, ok: !!out.ok, ...(out.ok ? { meta: out.meta, cached: out.cached || undefined } : { code: out.code }) } });
              results.push({ type: "tool_result", tool_use_id: u.id, ...(out.ok ? {} : { is_error: true }), content: JSON.stringify(out) });
            }
            convo.push({ role: "user", content: results });
            continue;
          }
          break;
        }
        if (final.stop_reason !== "end_turn") { await send({ error: true }); return; }
        await send({ done: true, usage: { in: totIn, out: totOut, model: final.model || null, promptId: investment.promptId, promptSha256: investment.promptSha256, basePolicySha256: investment.basePolicySha256, ...toolReceipt, requestedSpeed: useFast ? "fast" : "standard" } });
      } catch (e) {
        console.error("chat provider failure", e && e.status || "unknown");
        await send({ error: true });
      } finally {
        try { await w.close(); } catch (e) {}
      }
    })());
    return new Response(readable, { headers: { ...c.h, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  },
};
