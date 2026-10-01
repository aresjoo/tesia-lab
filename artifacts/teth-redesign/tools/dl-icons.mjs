// 바이낸스 선물 전 종목(기초 자산 740개)의 실제 아이콘을 내려받아 assets/coins/ 에 저장하고 목록(index.json)을 만든다
// 순서: 바이낸스 자산 로고 → CoinCap → TradingView 로고 → 주식 로고(FMP, 한국은 종목 코드)
import fs from 'fs';
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const S='C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/';
const OUT=R+'assets/coins/'; fs.mkdirSync(OUT,{recursive:true});
const exi=JSON.parse(fs.readFileSync(S+'exi.json','utf8'));
const ba=JSON.parse(fs.readFileSync(S+'bassets.json','utf8')).data||[];
const BL={}; ba.forEach(a=>{ if(a.logoUrl) BL[a.assetCode]=a.logoUrl; });
const L=exi.symbols.filter(s=>s.status==='TRADING'&&/PERPETUAL/.test(s.contractType));
const T={}; L.forEach(s=>{ if(!T[s.baseAsset]) T[s.baseAsset]=s.underlyingType; });
const KR={SAMSUNG:'005930.KS',SKHYNIX:'000660.KS',HYUNDAI:'005380.KS',SAMSUNGEM:'009150.KS',HANMI:'042700.KS',LGELECTRONICS:'066570.KS',NAVER:'035420.KS',KODEX200:'069500.KS'};
const HK={HK0700:'0700.HK',TENCENT:'0700.HK',HK1810:'1810.HK',POPMART:'9992.HK',KUAISHOU:'1024.HK',MEITUAN:'3690.HK',BYD:'1211.HK',HK0992:'0992.HK',HK0625:'0625.HK',GIGADEV:'603986.SS',ZHONGJI:'300308.SZ',CSOPSKHYNIX2L:'000660.KS',CSOPSAMSUNG2L:'005930.KS'};
const TVN={XAU:'metal/gold',XAG:'metal/silver',XPT:'metal/platinum',XPD:'metal/palladium',COPPER:'metal/copper',CL:'crude-oil',BZ:'crude-oil',NATGAS:'natural-gas',OPENAI:'openai',ANTHROPIC:'anthropic',MOONSHOT:'moonshot-ai',OURA:'oura',MINIMAX:'minimax',ZHIPU:'zhipu-ai',CXMT:'cxmt',UNITREE:'unitree',BTCDOM:'crypto/XTVCBTC',USDBRL:'country/BR'};
const strip=b=>b.replace(/^1000000|^1000|^1M(?=[A-Z])/,'');
function cands(b){ const t=T[b], c=strip(b), lc=c.toLowerCase(), u=[];
  if(t==='COIN'||t==='INDEX'){ if(BL[b]) u.push(BL[b]); if(BL[c]) u.push(BL[c]); u.push('https://assets.coincap.io/assets/icons/'+lc+'@2x.png'); u.push('https://s3-symbol-logo.tradingview.com/crypto/XTVC'+c+'.svg'); }
  if(t==='EQUITY') u.push('https://financialmodelingprep.com/image-stock/'+b+'.png');
  if(t==='KR_EQUITY'&&KR[b]) u.push('https://financialmodelingprep.com/image-stock/'+KR[b]+'.png');
  if((t==='HK_EQUITY'||t==='CN_EQUITY')&&HK[b]) u.push('https://financialmodelingprep.com/image-stock/'+HK[b]+'.png');
  if(TVN[b]) u.push('https://s3-symbol-logo.tradingview.com/'+TVN[b]+'.svg');
  if(BL[b]&&!u.includes(BL[b])) u.push(BL[b]);
  return u; }
async function get(u){ try{ const r=await fetch(u,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}}); if(!r.ok) return null; const ct=r.headers.get('content-type')||''; if(!/image/.test(ct)) return null; const buf=Buffer.from(await r.arrayBuffer()); if(buf.length<200) return null; return {buf,ext:/svg/.test(ct)?'svg':/jpe?g/.test(ct)?'jpg':/webp/.test(ct)?'webp':'png'}; }catch(e){ return null; } }
const bases=Object.keys(T), man={}, miss=[]; let i=0;
async function worker(){ while(i<bases.length){ const b=bases[i++]; let ok=null;
  for(const u of cands(b)){ ok=await get(u); if(ok) break; }
  if(ok){ const f=b+'.'+ok.ext; fs.writeFileSync(OUT+f,ok.buf); man[b]=f; } else miss.push(b+':'+T[b]); } }
await Promise.all(Array.from({length:10},worker));
fs.writeFileSync(OUT+'index.json',JSON.stringify(man));
console.log('ok',Object.keys(man).length,'/',bases.length,'missing',miss.length);
console.log(miss.join(' '));
