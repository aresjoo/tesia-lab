// 선물 백테스트용 실제 데이터 묶음을 만든다.
// 사용: node data/build-fut.mjs   → data/fut-daily.js
// 출처: Bybit USDT 무기한 선물(linear) 일봉 시가, 고가, 저가, 종가와 펀딩비 기록.
// 날짜 칸은 data/px-daily.js 와 같다(2023-01-01부터, UTC 하루 한 칸). 펀딩비는 그날 정산된 비율의 합.
import fs from "fs";
const START = "2023-01-01";
const SYM = { "비트코인": "BTCUSDT", "이더리움": "ETHUSDT", "솔라나": "SOLUSDT", "리플": "XRPUSDT", "도지코인": "DOGEUSDT", "에이다": "ADAUSDT", "아발란체": "AVAXUSDT", "비앤비": "BNBUSDT" };
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const t0 = Date.parse(START + "T00:00:00Z");
const pxSrc = fs.readFileSync(new URL("./px-daily.js", import.meta.url), "utf8");
const asof = /"asof":"(\d{4}-\d{2}-\d{2})"/.exec(pxSrc)[1];
const days = []; for (let t = t0; day(t) <= asof; t += 86400000) days.push(day(t));
const get = async (u) => { for (let k = 0; k < 4; k++) { try { const r = await fetch(u); const j = await r.json(); if (j.retCode === 0) return j.result.list; } catch (e) {} await new Promise((r) => setTimeout(r, 600)); } throw new Error("fetch " + u); };
const sig = (v) => +(+v).toPrecision(7);
const out = {};
for (const [name, sym] of Object.entries(SYM)) {
  /* 일봉 */
  const K = new Map(); let end = Date.parse(asof + "T00:00:00Z") + 86400000;
  for (;;) { const l = await get(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}&interval=D&limit=1000&end=${end}`); if (!l.length) break; l.forEach((k) => K.set(day(+k[0]), [sig(k[1]), sig(k[2]), sig(k[3]), sig(k[4])])); const first = +l[l.length - 1][0]; if (first <= t0 || l.length < 1000) break; end = first - 1; }
  /* 펀딩비 */
  const F = new Map(); let fe = Date.parse(asof + "T00:00:00Z") + 86400000 - 1, n = 0;
  for (;;) { const l = await get(`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${sym}&limit=200&endTime=${fe}`); if (!l.length) break; l.forEach((x) => { const d = day(+x.fundingRateTimestamp); F.set(d, (F.get(d) || 0) + +x.fundingRate); n++; }); const first = +l[l.length - 1].fundingRateTimestamp; if (first <= t0 || l.length < 200) break; fe = first - 1; }
  const o = [], h = [], lo = [], c = [], f = []; let miss = 0, prev = null;
  for (const d of days) { let k = K.get(d); if (!k) { miss++; if (!prev) { const e = [...K.entries()].sort()[0]; prev = e ? e[1][0] : null; } k = [prev, prev, prev, prev]; } o.push(k[0]); h.push(k[1]); lo.push(k[2]); c.push(k[3]); prev = k[3]; f.push(+((F.get(d) || 0) * 1e4).toFixed(3)); /* 만분율(bp) */ }
  out[name] = { o, h, l: lo, c, f };
  console.log(name.padEnd(6), sym.padEnd(9), "days", c.length, "missing", miss, "funding rows", n, "first", c[0], "last", c[c.length - 1], "avg funding bp/day", (f.reduce((a, b) => a + b, 0) / f.length).toFixed(2));
}
const src = "/* 선물 백테스트용 실제 데이터. data/build-fut.mjs 로 만든다. 손으로 고치지 않는다.\n   출처: Bybit USDT 무기한 선물 일봉(o,h,l,c)과 펀딩비(f, 그날 합계, 만분율). */\n"
  + "window.TETH_FUT=" + JSON.stringify({ v: asof + ".bybit", start: START, asof, made: new Date().toISOString(), src: "Bybit linear perpetual, daily klines and funding history", sym: out }) + ";\n";
fs.writeFileSync(new URL("./fut-daily.js", import.meta.url), src);
console.log("wrote", (src.length / 1024).toFixed(0) + "KB", days.length, "days");
