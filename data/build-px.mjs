// 백테스트용 실제 일봉 시세 묶음을 만든다.
// 사용: node data/build-px.mjs   → data/px-daily.js
// 출처: 야후 파이낸스 일봉 종가(코인은 USD, 주식과 지수는 각 통화), 공포 탐욕 지수(alternative.me).
// 달력 기준으로 2023-01-01부터 어제까지 하루 한 칸. 쉬는 날(주식, 지수, 금)은 직전 종가를 그대로 쓴다.
import fs from "fs";
const START = "2023-01-01";
const SYM = {
  "비트코인": "BTC-USD", "이더리움": "ETH-USD", "솔라나": "SOL-USD", "리플": "XRP-USD", "도지코인": "DOGE-USD",
  "에이다": "ADA-USD", "아발란체": "AVAX-USD", "비앤비": "BNB-USD",
  "테슬라": "TSLA", "엔비디아": "NVDA", "애플": "AAPL", "마이크로소프트": "MSFT", "아마존": "AMZN", "메타": "META", "알파벳": "GOOGL", "에이엠디": "AMD",
  "금": "GC=F", "나스닥": "^IXIC", "S&P 500": "^GSPC",
};
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const t0 = Date.parse(START + "T00:00:00Z");
const today = day(Date.now());
const last = day(Date.parse(today + "T00:00:00Z") - 86400000); /* 오늘은 아직 끝나지 않은 봉이라 뺀다 */
const days = []; for (let t = t0; day(t) <= last; t += 86400000) days.push(day(t));
async function yahoo(sym) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&period1=${Math.floor(t0 / 1000) - 86400 * 10}&period2=${Math.floor(Date.now() / 1000)}`;
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(sym + " http " + r.status);
  const j = (await r.json()).chart.result[0], ts = j.timestamp, c = j.indicators.quote[0].close;
  const m = new Map(); ts.forEach((t, i) => { if (c[i] != null && isFinite(c[i]) && c[i] > 0) m.set(day(t * 1000), c[i]); });
  return m;
}
function align(m, name) {
  const out = []; let prev = null, firstReal = null, filled = 0;
  /* 시작일 이전 마지막 값으로 출발한다(1월 1일은 주식 휴장) */
  for (const [d, v] of [...m.entries()].sort()) if (d < START) prev = v;
  for (const d of days) { if (m.has(d)) { prev = m.get(d); if (!firstReal) firstReal = d; } else filled++; if (prev == null) throw new Error(name + " no value at " + d); out.push(+prev.toPrecision(7)); }
  return { out, filled };
}
const px = {}, meta = {};
for (const [name, sym] of Object.entries(SYM)) {
  const m = await yahoo(sym); const { out, filled } = align(m, name);
  px[name] = out; meta[name] = { sym, real: out.length - filled, filled };
  console.log(name.padEnd(8), sym.padEnd(8), "days", out.length, "real", out.length - filled, "first", out[0], "last", out[out.length - 1]);
}
/* 공포 탐욕 지수: 그날 00시(UTC)에 발표되므로 그날 종가 판단에 쓸 수 있다 */
const fj = await (await fetch("https://api.alternative.me/fng/?limit=0&format=json")).json();
const fm = new Map(fj.data.map((x) => [day(+x.timestamp * 1000), +x.value]));
let fp = null; const fng = days.map((d) => { if (fm.has(d)) fp = fm.get(d); return fp; });
console.log("fng days", fng.filter((x) => x != null).length, "last", fng[fng.length - 1]);
const src = "/* 백테스트용 실제 일봉 시세. data/build-px.mjs 로 만든다. 손으로 고치지 않는다.\n   출처: Yahoo Finance 일봉 종가, alternative.me 공포 탐욕 지수. 쉬는 날은 직전 종가. */\n"
  + "window.TETH_PX=" + JSON.stringify({ v: last + ".real", start: START, asof: last, made: new Date().toISOString(), src: { px: "Yahoo Finance 일봉 종가", fng: "alternative.me Fear & Greed" }, meta, px, fng }) + ";\n";
fs.writeFileSync(new URL("./px-daily.js", import.meta.url), src);
console.log("wrote", (src.length / 1024).toFixed(0) + "KB", days[0], "→", last, days.length, "days");
