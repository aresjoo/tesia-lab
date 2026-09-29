// Opus 5.5 빠름(fast) 설정이 API 에서 받아들여지는지, 실제로 빠른지 잰다. 키는 .env 에서 읽고 출력하지 않는다.
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
const env = Object.fromEntries(fs.readFileSync(new URL("./.env", import.meta.url), "utf8").split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const q = "비트코인 반감기가 가격에 주는 영향을 세 문장으로 설명해줘.";
async function run(label, extra) {
  const t0 = Date.now(); let first = 0, out = 0, model = "", speed = "";
  try {
    const s = client.beta.messages.stream({ model: "claude-opus-5-5", max_tokens: 600, output_config: { effort: "medium" }, messages: [{ role: "user", content: q }], ...extra });
    s.on("text", () => { if (!first) first = Date.now() - t0; });
    const m = await s.finalMessage();
    out = m.usage.output_tokens; model = m.model; speed = m.usage.speed || "";
    const ms = Date.now() - t0;
    console.log(label, JSON.stringify({ ok: true, model, speed, firstTokenMs: first, totalMs: ms, outTok: out, tokPerSec: Math.round(out / ((ms - first) / 1000)) }));
  } catch (e) { console.log(label, JSON.stringify({ ok: false, status: e.status, msg: String(e.message).slice(0, 300) })); }
}
await run("standard", {});
await run("fast", { speed: "fast", betas: ["fast-mode-2026-02-01"] });
await run("standard", {});
await run("fast", { speed: "fast", betas: ["fast-mode-2026-02-01"] });
