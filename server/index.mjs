/* TETH 로컬 AI 프록시.
 * 세션 화면의 자유 질문에 실제 Claude 응답을 스트리밍한다.
 * 실행:  cd server && npm install && npm start
 * 키:    server/.env 의 ANTHROPIC_API_KEY (없으면 `ant auth login` 프로필로 폴백)
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const env = {};
try {
  for (const line of readFileSync(new URL("./.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !m[1].startsWith("#")) env[m[1]] = m[2];
  }
} catch { /* .env 없으면 SDK 기본 자격 증명 해석에 맡긴다 */ }

for (const k of ["ANTHROPIC_API_KEY", "TETH_AI_MODEL", "TETH_AI_EFFORT", "TETH_AI_PORT", "TETH_AI_MOCK"]) if (!env[k] && process.env[k]) env[k] = process.env[k];
const MODEL = env.TETH_AI_MODEL || "claude-opus-5";
const EFFORT = env.TETH_AI_EFFORT || "low";
const PORT = Number(env.TETH_AI_PORT || 8799);
let client = null, clientErr = "";
try {
  client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : new Anthropic();
} catch (e) {
  clientErr = "API 키가 없습니다. server/.env.example을 server/.env로 복사해 ANTHROPIC_API_KEY를 채워주세요.";
  console.error(clientErr);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (req.url === "/api/ping") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: !!client, error: clientErr || undefined }));
  }
  if (req.url.startsWith("/api/ohlc")) { /* 예측 근거용 실시세 (코인: Binance, 그 외: Yahoo) */
    const q = new URL(req.url, "http://x").searchParams;
    const src = q.get("src"), sym = String(q.get("sym") || "").slice(0, 24);
    try {
      let rows = [];
      if (src === "binance") {
        const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=1d&limit=90`);
        const j = await r.json();
        if (Array.isArray(j)) rows = j.map((k) => [k[0], +k[1], +k[2], +k[3], +k[4]]);
      } else if (src === "yahoo") {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const j = await r.json();
        const d = j?.chart?.result?.[0], ts = d?.timestamp || [], qd = d?.indicators?.quote?.[0];
        if (qd) rows = ts.map((t, i) => [t * 1000, qd.open[i], qd.high[i], qd.low[i], qd.close[i]]).filter((x) => x[4] != null);
      }
      if (!rows.length) throw 0;
      const closes = rows.map((x) => x[4]), last = closes[closes.length - 1];
      const pctFrom = (n) => { const p = closes[closes.length - 1 - n]; return p ? +((last / p - 1) * 100).toFixed(2) : null; };
      const out = {
        last: +last.toPrecision(6), chg1d: pctFrom(1), chg7d: pctFrom(7), chg30d: pctFrom(30),
        hi90: +Math.max(...rows.map((x) => x[2])).toPrecision(6), lo90: +Math.min(...rows.map((x) => x[3])).toPrecision(6),
        closes30: closes.slice(-30).map((v) => +v.toPrecision(5)),
      };
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      return res.end(JSON.stringify(out));
    } catch { res.writeHead(502, CORS); return res.end(); }
  }
  if (req.method !== "POST" || req.url !== "/api/chat") { res.writeHead(404, CORS); return res.end(); }

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

  if (env.TETH_AI_MOCK) { /* 키 없이 UI 스트리밍 경로를 시험하는 목 모드 */
    const demo = "목 모드 응답입니다. server/.env에 ANTHROPIC_API_KEY를 넣으면 실제 Claude가 답합니다.";
    for (const ch of demo.match(/.{1,6}/g)) { send({ text: ch }); await new Promise((r) => setTimeout(r, 40)); }
    send({ done: true });
    return res.end();
  }
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000, // 씽킹 토큰 포함 여유 상한, 답변 길이는 프롬프트로 제어
      output_config: { effort: EFFORT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: String(payload.system || "").slice(0, 8000),
      messages,
    });
    stream.on("text", (delta) => send({ text: delta }));
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") send({ text: "이 질문에는 답변드리기 어렵습니다. 전략이나 검증 결과에 대해 물어봐 주세요." });
    send({ done: true });
  } catch (e) {
    console.error("[teth-ai]", e?.status || "", e?.message || e);
    send({ error: true });
  }
  res.end();
}).listen(PORT, () => console.log(`TETH AI proxy — http://localhost:${PORT} (model: ${MODEL}, effort: ${EFFORT})`));
