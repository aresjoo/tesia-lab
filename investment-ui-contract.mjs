/** Display-only schema. It creates neither a DraftPatch nor execution authority. */
const keys = (v, expected) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...expected].sort().join(',');
const string = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const chartIdentities = {
  'BINANCE:BTCUSDT':['binance:BTCUSDT',['비트코인','BTC','BTC/USDT','Bitcoin']],
  'BINANCE:ETHUSDT':['binance:ETHUSDT',['이더리움','ETH','ETH/USDT','Ethereum']],
  'BINANCE:SOLUSDT':['binance:SOLUSDT',['솔라나','SOL','Solana']],
  'BINANCE:XRPUSDT':['binance:XRPUSDT',['리플','XRP']],
  'BINANCE:DOGEUSDT':['binance:DOGEUSDT',['도지코인','DOGE','Dogecoin']],
  'NASDAQ:TSLA':['yahoo:TSLA',['테슬라','TSLA','Tesla']],
  'NASDAQ:AAPL':['yahoo:AAPL',['애플','AAPL','Apple']],
  'NASDAQ:NVDA':['yahoo:NVDA',['엔비디아','NVDA','NVIDIA']],
  'NASDAQ:MSFT':['yahoo:MSFT',['마이크로소프트','MSFT','Microsoft']],
  'NASDAQ:AMZN':['yahoo:AMZN',['아마존','AMZN','Amazon']],
  'NASDAQ:GOOGL':['yahoo:GOOGL',['알파벳','구글','GOOGL','Alphabet','Google']],
  'NASDAQ:META':['yahoo:META',['메타','META']],
  'KRX:005930':['yahoo:005930.KS',['삼성전자','005930']],
  'NASDAQ:IXIC':['yahoo:^IXIC',['나스닥 종합','나스닥','IXIC','NASDAQ Composite']],
  'SP:SPX':['yahoo:^GSPC',['S&P 500','SPX','S&P500']],
};
export function validInvestmentDisplay(name, value, { allowTitle = true } = {}) {
  if (name === 'TITLE') return allowTitle && string(value, 80);
  if (name === 'NEXT') return Array.isArray(value) && value.length >= 1 && value.length <= 2 && value.every(v => string(v, 160)) && new Set(value).size === value.length;
  if (name === 'ASK') {
    if (!keys(value, ['steps']) || !Array.isArray(value.steps) || value.steps.length !== 1) return false;
    const step = value.steps[0];
    return keys(step, ['title', 'multi', 'options']) && string(step.title, 160) && step.multi === false && Array.isArray(step.options) && step.options.length >= 2 && step.options.length <= 4 && step.options.every(o => keys(o, ['t', 'd']) && string(o.t, 80) && string(o.d, 160)) && new Set(step.options.map(o => o.t)).size === step.options.length;
  }
  if (name === 'CHART') {
    if (!keys(value, ['tv', 'data', 'label']) || !string(value.label, 80) || !string(value.tv, 100) || !/^[A-Z0-9_]{1,32}:[A-Z0-9._/-]{1,64}$/.test(value.tv)) return false;
    const identity=chartIdentities[value.tv];
    if(identity) return (value.data==='none'||value.data===identity[0])&&[value.tv.split(':')[1],...identity[1]].some(label=>label.toUpperCase()===value.label.trim().toUpperCase());
    // An unknown company name cannot relabel a verified symbol as another asset.
    if(value.label.trim().toUpperCase().replace(/\//g,'')!==value.tv.split(':')[1]) return false;
    if (value.data === 'none') return true;
    if (typeof value.data !== 'string') return false;
    const binance = /^binance:([A-Z0-9]{2,32})$/.exec(value.data);
    if (binance) return value.tv === `BINANCE:${binance[1]}`;
    const yahoo = /^yahoo:([A-Za-z0-9.^=-]{1,32})$/.exec(value.data);
    return !!yahoo && value.tv.split(':')[1] === yahoo[1].toUpperCase();
  }
  return false;
}

/** Locate one complete JSON tag, respecting JSON strings and nested brackets. */
export function readInvestmentDisplay(text) {
  const match = /\[(CHART|ASK|NEXT|TITLE)\s*(?=[{["])/i.exec(text);
  if (!match) return null;
  const start = match.index, from = start + match[0].length;
  let quoted = false, escaped = false, depth = 0, end = -1;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') { quoted = false; if (!depth) { end = i + 1; break; } }
    } else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { if (--depth === 0) { end = i + 1; break; } if (depth < 0) return { start, invalid: true }; }
  }
  if (end < 0) return { start, incomplete: true };
  let close = end;
  while (/\s/.test(text[close] || '') && close < text.length) close++;
  if (close === text.length) return { start, incomplete: true };
  if (text[close] !== ']') return { start, invalid: true };
  try { return { start, end: close + 1, name: match[1], value: JSON.parse(text.slice(from, end)) }; }
  catch { return { start, invalid: true }; }
}

if(typeof window!=='undefined') window.TETH_INVESTMENT_UI=Object.freeze({ validInvestmentDisplay, readInvestmentDisplay });
