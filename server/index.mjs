/* TETH ë¡œì»¬ AI í”„ë¡ì‹œ.
 * ì„¸ì…˜ í™”ë©´ì˜ ìžìœ  ì§ˆë¬¸ì— ì‹¤ì œ Claude ì‘ë‹µì„ ìŠ¤íŠ¸ë¦¬ë°í•œë‹¤.
 * ì‹¤í–‰:  cd server && npm install && npm start
 * í‚¤:    server/.env ì˜ ANTHROPIC_API_KEY (ì—†ìœ¼ë©´ `ant auth login` í”„ë¡œí•„ë¡œ í´ë°±)
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const env = {};
try {
  for (const line of readFileSync(new URL("./.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !m[1].startsWith("#")) env[m[1]] = m[2];
  }
} catch { /* .env ì—†ìœ¼ë©´ SDK ê¸°ë³¸ ìžê²© ì¦ëª… í•´ì„ì— ë§¡ê¸´ë‹¤ */ }

for (const k of ["ANTHROPIC_API_KEY", "TETH_AI_MODEL", "TETH_AI_EFFORT", "TETH_AI_PORT", "TETH_AI_MOCK"]) if (!env[k] && process.env[k]) env[k] = process.env[k];
const MODEL = env.TETH_AI_MODEL || "claude-opus-5";
const EFFORT = env.TETH_AI_EFFORT || "low";
const PORT = Number(env.TETH_AI_PORT || 8799);
let client = null, clientErr = "";
try {
  client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : new Anthropic();
} catch (e) {
  clientErr = "API í‚¤ê°€ ì—†ìŠµë‹ˆë‹¤. server/.env.exampleì„ server/.envë¡œ ë³µì‚¬í•´ ANTHROPIC_API_KEYë¥¼ ì±„ì›Œì£¼ì„¸ìš”.";
  console.error(clientErr);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/* â”€â”€ ê³µê°œ í„°ë„ ë…¸ì¶œ ëŒ€ë¹„ í¬ë ˆë”§ ë³´í˜¸ â”€â”€
 * í—ˆìš© ì˜¤ë¦¬ì§„ì—ì„œ ì˜¨ /api/chatë§Œ í†µê³¼ + IPë‹¹ ë²„ìŠ¤íŠ¸ ì œí•œ + ì¼ì¼ ì´ëŸ‰ ìƒí•œ.
 * ì €ìž¥ì†Œ(/api/state)ëŠ” ë¡œì»¬ ì ‘ì†(Host=localhost)ì—ì„œë§Œ â€” í„°ë„ ê²½ìœ  ë°©ë¬¸ìžì—ê²Œ ëŒ€í™” íŒŒì¼ì„ ì—´ì§€ ì•ŠëŠ”ë‹¤. */
const ORIGIN_OK = [/^https:\/\/aresjoo\.github\.io$/, /^https?:\/\/localhost(?::\d+)?$/, /^https?:\/\/127\.0\.0\.1(?::\d+)?$/];
const DAILY_CAP = 400, BURST_MAX = 8;
const rl = { day: "", n: 0, ip: new Map() };
function chatAllowed(req) {
  const origin = req.headers.origin || "";
  if (!ORIGIN_OK.some((r) => r.test(origin))) return "forbidden";
  const today = new Date().toISOString().slice(0, 10);
  if (rl.day !== today) { rl.day = today; rl.n = 0; rl.ip.clear(); }
  if (rl.n >= DAILY_CAP) return "daily-cap";
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
  const now = Date.now();
  const arr = (rl.ip.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= BURST_MAX) { rl.ip.set(ip, arr); return "rate-limited"; }
  arr.push(now); rl.ip.set(ip, arr); rl.n++;
  if (rl.ip.size > 5000) rl.ip.clear();
  return null;
}
const isLocalHost = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host || ""));

createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (req.url === "/api/ping") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: !!client, error: clientErr || undefined }));
  }
  if (req.url === "/api/state" && !isLocalHost(req)) { res.writeHead(404, CORS); return res.end(); } /* ì €ìž¥ì†ŒëŠ” ë¡œì»¬ ì „ìš© */
  if (req.url === "/api/state" && req.method === "GET") { /* ëŒ€í™” ì„¸ì…˜ ì˜ì† ì €ìž¥ì†Œ (íŒŒì¼) */
    try {
      const f = new URL("./state.json", import.meta.url);
      if (!existsSync(f)) { res.writeHead(404, CORS); return res.end(); }
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      return res.end(readFileSync(f, "utf8"));
    } catch { res.writeHead(500, CORS); return res.end(); }
  }
  if (req.url === "/api/state" && req.method === "POST") {
    let sb = "";
    for await (const c of req) { sb += c; if (sb.length > 4 * 1024 * 1024) { res.writeHead(413, CORS); return res.end(); } }
    try { JSON.parse(sb); writeFileSync(new URL("./state.json", import.meta.url), sb); res.writeHead(200, CORS); return res.end('{"ok":true}'); }
    catch { res.writeHead(400, CORS); return res.end(); }
  }
  if (req.url.startsWith("/api/ohlc")) { /* ì˜ˆì¸¡ ê·¼ê±°ìš© ì‹¤ì‹œì„¸ (ì½”ì¸: Binance, ê·¸ ì™¸: Yahoo), íƒ€ìž„í”„ë ˆìž„ ì§€ì› */
    const q = new URL(req.url, "http://x").searchParams;
    const src = q.get("src"), sym = String(q.get("sym") || "").slice(0, 24);
    const IV = { "1m": 1, "5m": 1, "15m": 1, "30m": 1, "1h": 1, "4h": 1, "1d": 1, "1w": 1 };
    const iv = IV[q.get("iv")] ? q.get("iv") : "1d";
    try {
      let rows = [];
      if (src === "binance") {
        const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${iv}&limit=90`);
        const j = await r.json();
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
      const out = {
        last: +last.toPrecision(6), chg1d: pctFrom(1), chg7d: pctFrom(7), chg30d: pctFrom(30),
        hi90: +Math.max(...rows.map((x) => x[2])).toPrecision(6), lo90: +Math.min(...rows.map((x) => x[3])).toPrecision(6),
        closes30: closes.slice(-30).map((v) => +v.toPrecision(5)),
        rows: rows.slice(-60).map((x) => [x[0], +x[1].toPrecision(5), +x[2].toPrecision(5), +x[3].toPrecision(5), +x[4].toPrecision(5), +(x[5] || 0).toPrecision(4)]), /* ì˜ˆì¸¡ ì‹œë‚˜ë¦¬ì˜¤ ì¹´ë“œ + ì§€í‘œ ê³„ì‚°ìš© */
      };
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      return res.end(JSON.stringify(out));
    } catch { res.writeHead(502, CORS); return res.end(); }
  }
  if (req.method !== "POST" || req.url !== "/api/chat") { res.writeHead(404, CORS); return res.end(); }
  const deny = chatAllowed(req);
  if (deny) { console.log("[teth-ai] blocked:", deny, req.headers.origin || "(no origin)"); res.writeHead(deny === "forbidden" ? 403 : 429, CORS); return res.end(); }

  let body = "";
  for await (const c of req) body += c;
  let payload;
  try { payload = JSON.parse(body); } catch { res.writeHead(400, CORS); return res.end(); }

  const messages = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
    .slice(-16);
  if (!messages.length) { res.writeHead(400, CORS); return res.end(); }
  if (!client) { res.writeHead(503, CORS); return res.end(); }

  res.writeHead(200, { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (obj) => res.write("data: " + JSON.stringify(obj) + "\n\n");

  if (env.TETH_AI_MOCK) { /* í‚¤ ì—†ì´ UI ìŠ¤íŠ¸ë¦¬ë° ê²½ë¡œë¥¼ ì‹œí—˜í•˜ëŠ” ëª© ëª¨ë“œ */
    const demo = "ëª© ëª¨ë“œ ì‘ë‹µìž…ë‹ˆë‹¤. server/.envì— ANTHROPIC_API_KEYë¥¼ ë„£ìœ¼ë©´ ì‹¤ì œ Claudeê°€ ë‹µí•©ë‹ˆë‹¤.";
    for (const ch of demo.match(/.{1,6}/g)) { send({ text: ch }); await new Promise((r) => setTimeout(r, 40)); }
    send({ done: true });
    return res.end();
  }
  try {
    /* think 모드: 경량 모델이 사고 내레이션만 스트리밍 (본답변과 병렬, 도구/사고 없음) */
    const isThink = payload.think === true;
    const stream = isThink ? client.beta.messages.stream({
      model: env.TETH_THINK_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: String(payload.system || "").slice(0, 4000),
      messages,
    }) : client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000, // ì”½í‚¹ í† í° í¬í•¨ ì—¬ìœ  ìƒí•œ, ë‹µë³€ ê¸¸ì´ëŠ” í”„ë¡¬í”„íŠ¸ë¡œ ì œì–´
      thinking: { type: "adaptive" }, // ì‚¬ê³  ë¸”ë¡ í™œì„±í™” â€” í”„ë¡ íŠ¸ ìž‘ì—… íƒ€ìž„ë¼ì¸ì˜ ì‹¤ì œ ì‚¬ê³  ìŠ¤íŠ¸ë¦¼ ì†ŒìŠ¤
      output_config: { effort: EFFORT },
      /* ì‹¤ì œ ì›¹ ê²€ìƒ‰/íŽ˜ì´ì§€ ì—´ê¸° (Anthropic ì„œë²„ì‚¬ì´ë“œ íˆ´) â€” ì¿¼ë¦¬ ì„ íƒë¶€í„° ê²°ê³¼ê¹Œì§€ ì „ë¶€ ì‹¤ë™ìž‘, íƒ€ìž„ë¼ì¸ì— ì´ë²¤íŠ¸ë¡œ ì „ë‹¬ */
      tools: payload.lite === true ? undefined : [ /* lite: 시세 확인형은 도구 없이 즉답 */
        { type: "web_search_20260209", name: "web_search" },
        { type: "web_fetch_20260209", name: "web_fetch" },
      ], /* ì‚¬ìš© íšŸìˆ˜ ìƒí•œ ì—†ìŒ â€” í•„ìš”í•œ ë§Œí¼ ëª¨ë¸ì´ íŒë‹¨ */
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: String(payload.system || "").slice(0, 8000),
      messages,
    });
    stream.on("text", (delta) => send({ text: delta }));
    /* ì‹¤ìž‘ì—… ì´ë²¤íŠ¸: ëª¨ë¸ì˜ ì‚¬ê³  ìŠ¤íŠ¸ë¦¼(think) + ëˆ„ì  ì¶œë ¥ í† í°(tok)ì„ ê·¸ëŒ€ë¡œ ì „ë‹¬ â€” í”„ë¡ íŠ¸ ìž‘ì—… íƒ€ìž„ë¼ì¸ì´ ì‹¤ë°ì´í„°ë¡œ êµ¬ë™ëœë‹¤ */
    const blocks = {}; /* indexë³„ server_tool_use ìž…ë ¥ JSON ëˆ„ì  */
    stream.on("streamEvent", (ev) => {
      try {
        if (process.env.TETH_DEBUG_EV) console.log("[ev]", ev.type, ev.delta ? ev.delta.type : "", ev.content_block ? ev.content_block.type : "");
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
            /* ê·¸ ì™¸ ì„œë²„ íˆ´ ê²°ê³¼ (ì˜ˆ: code_execution) â€” ë²”ìš© ì™„ë£Œ ì‹ í˜¸ */
            send({ tres: { kind: cb.type, error: cb.content && cb.content.type && /error/.test(cb.content.type) ? true : undefined } });
          }
        } else if (ev.type === "content_block_delta" && ev.delta) {
          if (ev.delta.type === "thinking_delta" && ev.delta.thinking) send({ think: ev.delta.thinking });
          else if (ev.delta.type === "input_json_delta" && blocks[ev.index] != null) blocks[ev.index].json += ev.delta.partial_json || "";
        } else if (ev.type === "content_block_stop" && blocks[ev.index] != null) {
          const b = blocks[ev.index]; delete blocks[ev.index];
          let input = b.seed || {}; try { const p = JSON.parse(b.json || "{}"); if (Object.keys(p).length) input = p; } catch (e) {}
          send({ tool: { name: b.kind, q: input.query || input.url || (typeof input.code === "string" ? input.code.slice(0, 120) : "") } });
        } else if (ev.type === "message_delta" && ev.usage && ev.usage.output_tokens) send({ tok: ev.usage.output_tokens });
      } catch (e) {}
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") send({ text: "ì´ ì§ˆë¬¸ì—ëŠ” ë‹µë³€ë“œë¦¬ê¸° ì–´ë µìŠµë‹ˆë‹¤. ì „ëžµì´ë‚˜ ê²€ì¦ ê²°ê³¼ì— ëŒ€í•´ ë¬¼ì–´ë´ ì£¼ì„¸ìš”." });
    send({ done: true, usage: final.usage ? { in: final.usage.input_tokens, out: final.usage.output_tokens } : undefined });
  } catch (e) {
    console.error("[teth-ai]", e?.status || "", e?.message || e);
    send({ error: true });
  }
  res.end();
}).listen(PORT, () => console.log(`TETH AI proxy â€” http://localhost:${PORT} (model: ${MODEL}, effort: ${EFFORT})`));





