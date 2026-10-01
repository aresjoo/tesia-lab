/* ═══ 터미널 시장 (sk-mkt) ═══
   바이낸스 선물 화면처럼: 맨 위 시장 줄(현재가, 표시가격, 지수가격, 펀딩비와 남은 시간, 24시간 고가, 저가, 거래량, 거래대금),
   종목 선택 창(검색, 무기한/즐겨찾기, 분류, 정렬 표), 차트/정보/데이터 탭, 그리기 도구와 이동평균이 켜진 트레이딩뷰 차트.
   가운데 전략 목록 칸은 판단 패널 머리의 "전략 N개" 선택 목록으로 옮긴다. 데이터는 바이낸스 선물 공개 API와 CoinGecko에서 브라우저가 직접 받는다. */
var MKT={sym:null,picked:false,tick:null,prem:null,tab:'chart',per:'5m',all:null,allAt:0,fav:[],src:'all',cat:'all',q:'',sort:'qv',desc:true,info:{},glob:null,exi:null,timer:0,cdt:0};
try{ MKT.fav=JSON.parse(localStorage.getItem('teth.mkt.fav')||'["BTCUSDT","ETHUSDT"]'); MKT.sym=localStorage.getItem('teth.mkt.sym')||null; }catch(e){}
var MKT_CATS=[['all','전체'],['ai','AI'],['defi','디파이'],['l1','레이어 1'],['l2','레이어 2'],['meme','밈']];
var MKT_CAT={
  ai:['FET','RENDER','TAO','WLD','ARKM','NEAR','VIRTUAL','AIXBT','IO','GRT','AI16Z','THETA','AGLD','PHB','NMR','COOKIE','GRIFFAIN','ZEREBRO'],
  defi:['UNI','AAVE','LINK','MKR','CRV','LDO','PENDLE','ENA','COMP','SUSHI','DYDX','JUP','RAY','CAKE','1INCH','SNX','GMX','ETHFI','EIGEN','MORPHO','ONDO','SKY'],
  l1:['BTC','ETH','SOL','BNB','ADA','AVAX','DOT','TRX','SUI','APT','NEAR','TON','SEI','XRP','LTC','ATOM','HBAR','ICP','ALGO','HYPE','BCH','ETC','XLM','INJ','TIA','KAS','FTM','S','BERA'],
  l2:['ARB','OP','POL','STRK','ZK','MANTA','IMX','METIS','MNT','BLAST','SCR','TAIKO','LINEA'],
  meme:['DOGE','SHIB','PEPE','WIF','BONK','FLOKI','BOME','TRUMP','PENGU','FARTCOIN','POPCAT','MEW','BRETT','SATS','PNUT','NEIRO','MOODENG','GOAT','TURBO','PEOPLE']
};
var MKT_CG={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',BNB:'binancecoin',XRP:'ripple',DOGE:'dogecoin',ADA:'cardano',AVAX:'avalanche-2',LINK:'chainlink',DOT:'polkadot',TRX:'tron',LTC:'litecoin',BCH:'bitcoin-cash',SUI:'sui',TON:'the-open-network',NEAR:'near',APT:'aptos',ARB:'arbitrum',OP:'optimism',UNI:'uniswap',AAVE:'aave',PEPE:'pepe',SHIB:'shiba-inu',WIF:'dogwifcoin',ENA:'ethena',HYPE:'hyperliquid',ATOM:'cosmos',ETC:'ethereum-classic',XLM:'stellar',FIL:'filecoin',INJ:'injective-protocol',SEI:'sei-network',TIA:'celestia',FET:'fetch-ai',RENDER:'render-token',TAO:'bittensor',WLD:'worldcoin-wld',BONK:'bonk',FLOKI:'floki',TRUMP:'official-trump',PENGU:'pudgy-penguins',HBAR:'hedera-hashgraph',ICP:'internet-computer',ALGO:'algorand',MKR:'maker',LDO:'lido-dao',CRV:'curve-dao-token',PENDLE:'pendle',JUP:'jupiter-exchange-solana',POL:'polygon-ecosystem-token',STRK:'starknet',IMX:'immutable-x'};
var MKT_CHEV='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function mktApi(u){ return fetch('https://fapi.binance.com'+u).then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.json(); }); }
function mktCg(u){ return fetch('https://api.coingecko.com/api/v3'+u).then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.json(); }); }
function mktBase(s){ return String(s||'').replace(/USDT$/,'').replace(/^1000+/,'').replace(/^1M/,''); }
function mktStratSym(){ try{ var s=TF_TM.sel?tfTmOf(TF_TM.sel):null; if(!s) return null; var m=String(s.sym||'').replace(/[\/\-\s]/g,'').toUpperCase(); return /USDT$/.test(m)?m:null; }catch(e){ return null; } }
function mktSym(){ return MKT.sym||mktStratSym()||'BTCUSDT'; }
function mktDec(v){ var s=String(v); return (s.split('.')[1]||'').replace(/0+$/,'').length; }
function mktFmt(v,d){ var n=+v; if(!isFinite(n)) return '-'; if(d==null) d=Math.min(mktDec(v),Math.abs(n)>=1000?2:8); return n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function mktBig(n,cur){ n=+n; if(!isFinite(n)) return '-'; var a=Math.abs(n), s=a>=1e12?(n/1e12).toFixed(2)+'T':a>=1e9?(n/1e9).toFixed(2)+'B':a>=1e6?(n/1e6).toFixed(2)+'M':a>=1e3?(n/1e3).toFixed(2)+'K':n.toFixed(2); return (cur?'$':'')+s; }
function mktIcon(base,sz){ sz=sz||22; var b=String(base).toLowerCase();
  return '<span class="mk-ic" style="width:'+sz+'px;height:'+sz+'px"><img src="https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/'+b+'.svg" alt="" width="'+sz+'" height="'+sz+'" onerror="this.remove()"><i>'+gEsc(String(base).charAt(0))+'</i></span>'; }
function mktCd(ts){ var d=Math.max(0,Math.floor((+ts-Date.now())/1000)); var h=Math.floor(d/3600), m=Math.floor(d%3600/60), s=d%60; var p=function(x){ return (x<10?'0':'')+x; }; return p(h)+':'+p(m)+':'+p(s); }
/* ── 맨 위 시장 줄 ── */
function mktHeadHtml(){
  var sym=mktSym(), base=mktBase(sym), t=MKT.tick&&MKT.tick.symbol===sym?MKT.tick:null, p=MKT.prem&&MKT.prem.symbol===sym?MKT.prem:null;
  var up=t?(+t.priceChangePercent>=0):true, cls=t?(up?'up':'dn'):'';
  var kv=function(k,v){ return '<div><dt>'+k+'</dt><dd class="num">'+v+'</dd></div>'; };
  var fr=p?(+p.lastFundingRate*100):null, dp=t?Math.min(mktDec(t.lastPrice),Math.abs(+t.lastPrice)>=1000?2:8):(p?Math.min(mktDec(p.markPrice),8):2);
  return '<div class="mkh" id="mkh"><button type="button" class="mkh-sym" onclick="mktPick()" aria-label="종목 바꾸기">'+mktIcon(base,26)+'<b>'+gEsc(sym)+'</b><span class="tag">무기한</span>'+MKT_CHEV+'</button>'
    +'<div class="mkh-px '+cls+'"><b class="num">'+(t?mktFmt(t.lastPrice):'-')+'</b><span class="num">'+(t?(up?'+':'')+mktFmt(t.priceChange)+' '+(up?'+':'')+(+t.priceChangePercent).toFixed(2)+'%':'')+'</span></div>'
    +'<dl class="mkh-kv">'+kv('표시가격',p?mktFmt(p.markPrice,dp):'-')+kv('지수가격',p?mktFmt(p.indexPrice,dp):'-')
    +kv('펀딩비(8시간) / 남은 시간',p?'<i class="'+(fr>=0?'up':'dn')+'">'+fr.toFixed(4)+'%</i> / <span id="mkh-cd">'+mktCd(p.nextFundingTime)+'</span>':'-')
    +kv('24시간 고가',t?mktFmt(t.highPrice):'-')+kv('24시간 저가',t?mktFmt(t.lowPrice):'-')+kv('24시간 거래량('+gEsc(base)+')',t?mktBig(t.volume):'-')+kv('24시간 거래대금(USDT)',t?mktBig(t.quoteVolume):'-')+'</dl></div>';
}
function mktHead(){ var g=document.querySelector('#g-content .tft-page .tft-grid'); if(!g) return; var h=document.getElementById('mkh'); var html=mktHeadHtml();
  if(h){ h.outerHTML=html; return; } var mt=document.querySelector('#g-content .tft-page > .nfxh-tabs.m-only'); (mt||g).insertAdjacentHTML('beforebegin',html); }
function mktPoll(){ var sym=mktSym();
  Promise.all([mktApi('/fapi/v1/ticker/24hr?symbol='+sym),mktApi('/fapi/v1/premiumIndex?symbol='+sym)]).then(function(a){ if(sym!==mktSym()) return; MKT.tick=a[0]; MKT.prem=a[1]; mktHead(); }).catch(function(){}); }
function mktLoop(){ clearInterval(MKT.timer); clearInterval(MKT.cdt);
  MKT.timer=setInterval(function(){ if(!document.getElementById('mkh')){ clearInterval(MKT.timer); clearInterval(MKT.cdt); return; } if(!document.hidden) mktPoll(); },3000);
  MKT.cdt=setInterval(function(){ var e=document.getElementById('mkh-cd'); if(e&&MKT.prem) e.textContent=mktCd(MKT.prem.nextFundingTime); },1000); }
/* ── 차트: 바이낸스 무기한 심볼, 그리기 도구, 이동평균 7/25/99 ── */
function mktTv(sym){ return 'BINANCE:'+sym+'.P'; }
function mktChart(force){
  var tv=mktTv(mktSym()); if(!force&&TF_TM.tvSym===tv&&document.querySelector('#nfxh-tv iframe')) return;
  TF_TM.tvSym=tv; var gen=++TF_TM.gen; var host=document.getElementById('nfxh-tv'); if(!host) return; host.innerHTML='';
  var ph=document.getElementById('nfxh-ph'); if(ph) ph.hidden=false;
  if(typeof taiTv!=='function') return;
  taiTv(function(){ try{ if(gen!==TF_TM.gen) return; var h2=document.getElementById('nfxh-tv'); if(!h2||h2.childNodes.length) return;
    new TradingView.widget({container_id:'nfxh-tv',symbol:tv,interval:'15',timezone:'Asia/Seoul',theme:'dark',style:'1',locale:'kr',autosize:true,
      toolbar_bg:'#141414',backgroundColor:'#141414',gridColor:'rgba(255,255,255,0.05)',enable_publishing:false,hide_side_toolbar:false,hide_top_toolbar:false,withdateranges:false,
      allow_symbol_change:false,save_image:true,details:false,hotlist:false,calendar:false,
      studies:[{id:'MASimple@tv-basicstudies',inputs:{length:7}},{id:'MASimple@tv-basicstudies',inputs:{length:25}},{id:'MASimple@tv-basicstudies',inputs:{length:99}}]});
    var p2=document.getElementById('nfxh-ph'); if(p2) p2.hidden=true; }catch(e){} });
}
/* ── 종목 선택 창 ── */
function mktAll(){ if(MKT.all&&Date.now()-MKT.allAt<15000) return Promise.resolve(MKT.all);
  return mktApi('/fapi/v1/ticker/24hr').then(function(L){ var now=Date.now(); MKT.all=L.filter(function(s){ return /USDT$/.test(s.symbol)&&+s.quoteVolume>0&&now-(+s.closeTime)<2*864e5; }); MKT.allAt=now; return MKT.all; }); }
function mktPick(){
  mktPickClose(); var ov=document.createElement('div'); ov.id='mkp'; ov.className='mkp-ov';
  ov.addEventListener('click',function(e){ if(e.target===ov) mktPickClose(); });
  ov.innerHTML='<div class="mkp" role="dialog" aria-label="종목 선택"><div class="mkp-hd"><div><h3>종목 선택</h3><p>거래할 종목을 검색해 고릅니다.</p></div><button type="button" class="mkp-x" aria-label="닫기" onclick="mktPickClose()">✕</button></div>'
    +'<label class="mkp-q"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="mkp-q" type="search" placeholder="종목 검색" autocomplete="off" value="'+gEsc(MKT.q)+'"></label>'
    +'<div class="mkp-tabs"><div class="mkp-seg" id="mkp-src">'+[['all','무기한'],['fav','즐겨찾기']].map(function(x){ return '<button type="button" data-v="'+x[0]+'" class="'+(MKT.src===x[0]?'on':'')+'">'+x[1]+'</button>'; }).join('')+'</div>'
    +'<div class="mkp-seg" id="mkp-cat">'+MKT_CATS.map(function(x){ return '<button type="button" data-v="'+x[0]+'" class="'+(MKT.cat===x[0]?'on':'')+'">'+x[1]+'</button>'; }).join('')+'</div></div>'
    +'<div class="mkp-th">'+[['sym','종목'],['px','최근가'],['chg','24시간 변동'],['qv','거래대금']].map(function(x){ return '<button type="button" data-s="'+x[0]+'" class="'+(MKT.sort===x[0]?'on':'')+'">'+x[1]+(MKT.sort===x[0]?(MKT.desc?' ↓':' ↑'):'')+'</button>'; }).join('')+'</div>'
    +'<div class="mkp-rows" id="mkp-rows"><p class="mkp-ld">불러오는 중</p></div></div>';
  document.body.appendChild(ov);
  var q=document.getElementById('mkp-q'); q.addEventListener('input',function(){ MKT.q=this.value.trim().toUpperCase(); mktRows(); }); if(innerWidth>860) setTimeout(function(){ q.focus(); },30);
  ov.querySelector('#mkp-src').addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; MKT.src=b.dataset.v; [].forEach.call(this.children,function(x){ x.classList.toggle('on',x===b); }); mktRows(); });
  ov.querySelector('#mkp-cat').addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; MKT.cat=b.dataset.v; [].forEach.call(this.children,function(x){ x.classList.toggle('on',x===b); }); mktRows(); });
  ov.querySelector('.mkp-th').addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; var s=b.dataset.s; if(MKT.sort===s) MKT.desc=!MKT.desc; else { MKT.sort=s; MKT.desc=s!=='sym'; }
    [].forEach.call(this.children,function(x){ var on=x.dataset.s===MKT.sort; x.classList.toggle('on',on); x.textContent=x.textContent.replace(/ [↓↑]$/,'')+(on?(MKT.desc?' ↓':' ↑'):''); }); mktRows(); });
  document.addEventListener('keydown',mktEsc);
  mktAll().then(mktRows).catch(function(){ var r=document.getElementById('mkp-rows'); if(r) r.innerHTML='<p class="mkp-ld">종목을 불러오지 못했습니다. 잠시 뒤 다시 열어 주십시오.</p>'; });
}
function mktEsc(e){ if(e.key==='Escape') mktPickClose(); }
function mktPickClose(){ var o=document.getElementById('mkp'); if(o) o.remove(); document.removeEventListener('keydown',mktEsc); }
function mktRows(){
  var box=document.getElementById('mkp-rows'); if(!box||!MKT.all) return;
  var L=MKT.all.filter(function(s){ var b=mktBase(s.symbol);
    if(MKT.src==='fav'&&MKT.fav.indexOf(s.symbol)<0) return false;
    if(MKT.cat!=='all'&&(MKT_CAT[MKT.cat]||[]).indexOf(b)<0) return false;
    if(MKT.q&&s.symbol.indexOf(MKT.q)<0) return false; return true; });
  var key={sym:function(s){ return s.symbol; },px:function(s){ return +s.lastPrice; },chg:function(s){ return +s.priceChangePercent; },qv:function(s){ return +s.quoteVolume; }}[MKT.sort];
  L.sort(function(a,b){ var x=key(a), y=key(b); var r=x<y?-1:x>y?1:0; return MKT.desc?-r:r; });
  var cur=mktSym();
  box.innerHTML=L.length?L.slice(0,300).map(function(s){ var b=mktBase(s.symbol), up=+s.priceChangePercent>=0, fav=MKT.fav.indexOf(s.symbol)>=0;
    return '<div class="mkp-r'+(s.symbol===cur?' on':'')+'" role="button" tabindex="0" onclick="mktSet(\''+s.symbol+'\')" onkeydown="if(event.key===\'Enter\')mktSet(\''+s.symbol+'\')">'
      +'<button type="button" class="mkp-st'+(fav?' on':'')+'" aria-label="즐겨찾기" onclick="event.stopPropagation();mktFav(\''+s.symbol+'\',this)">'+(fav?'★':'☆')+'</button>'
      +'<span class="mkp-s">'+mktIcon(b,20)+'<b>'+gEsc(s.symbol)+'</b></span><span class="num">'+mktFmt(s.lastPrice)+'</span><span class="num '+(up?'up':'dn')+'">'+(up?'+':'')+(+s.priceChangePercent).toFixed(2)+'%</span><span class="num">'+mktBig(s.quoteVolume)+'</span></div>'; }).join('')
    :'<p class="mkp-ld">'+(MKT.src==='fav'?'즐겨찾기한 종목이 없습니다. 별을 눌러 추가합니다.':'찾는 종목이 없습니다.')+'</p>';
}
function mktFav(sym,el){ var i=MKT.fav.indexOf(sym); if(i>=0) MKT.fav.splice(i,1); else MKT.fav.push(sym); try{ localStorage.setItem('teth.mkt.fav',JSON.stringify(MKT.fav)); }catch(e){} if(el){ var on=i<0; el.classList.toggle('on',on); el.textContent=on?'★':'☆'; } if(MKT.src==='fav') mktRows(); }
function mktSet(sym){ MKT.sym=sym; MKT.picked=true; try{ localStorage.setItem('teth.mkt.sym',sym); }catch(e){} mktPickClose(); MKT.tick=null; MKT.prem=null; mktHead(); mktPoll(); mktChart(true); if(MKT.tab==='info') mktInfo(); if(MKT.tab==='data') mktData(); }
/* ── 차트 / 정보 / 데이터 탭 ── */
function mktTabsMount(){ var c=document.querySelector('#g-content .tft-page .tft-chart'); if(!c||c.querySelector('.mkt-tabs')) return;
  c.insertAdjacentHTML('afterbegin','<div class="mkt-tabs" role="tablist">'+[['chart','차트'],['info','정보'],['data','데이터']].map(function(x){ return '<button type="button" role="tab" data-t="'+x[0]+'">'+x[1]+'</button>'; }).join('')+'</div>');
  c.insertAdjacentHTML('beforeend','<div class="mkt-pane" id="mkt-info" hidden></div><div class="mkt-pane" id="mkt-data" hidden></div>');
  c.querySelector('.mkt-tabs').addEventListener('click',function(e){ var b=e.target.closest('button'); if(b) mktTab(b.dataset.t); });
  mktTab(MKT.tab,true); }
function mktTab(t,quiet){ MKT.tab=t; var c=document.querySelector('#g-content .tft-page .tft-chart'); if(!c) return;
  [].forEach.call(c.querySelectorAll('.mkt-tabs button'),function(b){ var on=b.dataset.t===t; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); });
  var tv=document.getElementById('nfxh-tv'); if(tv) tv.style.visibility=t==='chart'?'':'hidden';
  var i=document.getElementById('mkt-info'), d=document.getElementById('mkt-data'); if(i) i.hidden=t!=='info'; if(d) d.hidden=t!=='data';
  if(t==='info') mktInfo(); if(t==='data') mktData(); }
function mktExi(sym){ var go=MKT.exi?Promise.resolve(MKT.exi):mktApi('/fapi/v1/exchangeInfo').then(function(x){ MKT.exi={}; (x.symbols||[]).forEach(function(s){ MKT.exi[s.symbol]=s; }); return MKT.exi; });
  return go.then(function(m){ return m[sym]||null; }).catch(function(){ return null; }); }
function mktInfo(){
  var sym=mktSym(), base=mktBase(sym), box=document.getElementById('mkt-info'); if(!box) return; box.innerHTML='<p class="mkt-ld">불러오는 중</p>';
  var gid=MKT_CG[base]?Promise.resolve(MKT_CG[base]):mktCg('/search?query='+encodeURIComponent(base)).then(function(r){ var c=(r.coins||[]).filter(function(x){ return String(x.symbol).toUpperCase()===base; })[0]; if(!c) throw new Error('none'); return c.id; });
  var coin=gid.then(function(id){ return MKT.info[id]||mktCg('/coins/'+id+'?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false').then(function(d){ MKT.info[id]=d; return d; }); });
  var glob=MKT.glob?Promise.resolve(MKT.glob):mktCg('/global').then(function(g){ MKT.glob=g; return g; }).catch(function(){ return null; });
  Promise.all([coin.catch(function(){ return null; }),glob,mktExi(sym)]).then(function(a){ if(sym!==mktSym()) return; var d=a[0], g=a[1], x=a[2], m=d&&d.market_data||{};
    var mc=m.market_cap&&m.market_cap.usd, fd=m.fully_diluted_valuation&&m.fully_diluted_valuation.usd, vol=m.total_volume&&m.total_volume.usd, tot=g&&g.data&&g.data.total_market_cap&&g.data.total_market_cap.usd;
    var num=function(v,u){ return v==null?'-':Math.round(v).toLocaleString('en-US')+(u?' '+u:''); };
    var row=function(k,v){ return '<div class="mki-r"><span>'+k+'</span><b class="num">'+v+'</b></div>'; };
    var lk=function(lab,u){ return u?'<a class="mki-lk" href="'+gEsc(u)+'" target="_blank" rel="noopener noreferrer">'+lab+'</a>':''; };
    var f=function(t){ var r=(x&&x.filters||[]).filter(function(y){ return y.filterType===t; })[0]; return r||{}; };
    var links=d?(lk('공식 웹사이트',(d.links&&d.links.homepage||[])[0])+lk('백서',d.links&&d.links.whitepaper)+lk('블록 탐색기',(d.links&&d.links.blockchain_site||[])[0])):'';
    box.innerHTML='<div class="mki"><div class="mki-hd">'+mktIcon(base,28)+'<b>'+gEsc(d?d.name:base)+'</b></div><div class="mki-g"><div class="mki-c">'
      +(d?row('순위',d.market_cap_rank?d.market_cap_rank+'위':'-')+row('시가총액',mktBig(mc,1))+row('완전 희석 시가총액',mktBig(fd,1))+row('시장 점유율',mc&&tot?(mc/tot*100).toFixed(2)+'%':'-')+row('거래량',mktBig(vol,1))+row('거래량 / 시가총액',mc&&vol?(vol/mc*100).toFixed(2)+'%':'-')
        +row('유통 공급량',num(m.circulating_supply,base))+row('최대 공급량',num(m.max_supply,base))+row('총 공급량',num(m.total_supply,base)):'<p class="mkt-ld">이 종목의 코인 정보는 아직 없습니다.</p>')
      +'</div><div class="mki-c">'+(links?'<h4>링크</h4><div class="mki-lks">'+links+'</div>':'')
      +'<h4>거래 규칙</h4>'+(x?row('가격 단위',f('PRICE_FILTER').tickSize?mktFmt(f('PRICE_FILTER').tickSize):'-')+row('최소 주문 수량',f('LOT_SIZE').minQty?mktFmt(f('LOT_SIZE').minQty)+' '+gEsc(base):'-')+row('최소 주문 금액',f('MIN_NOTIONAL').notional?mktFmt(f('MIN_NOTIONAL').notional)+' USDT':'-')+row('상장일',x.onboardDate?stDate(+x.onboardDate):'-'):'<p class="mkt-ld">거래 규칙을 불러오지 못했습니다.</p>')
      +'</div></div><p class="mki-src">코인 정보 출처 CoinGecko, 거래 규칙 출처 Binance</p></div>'; });
}
/* 데이터 탭: 작은 선, 막대 그래프 */
var MKT_PER=[['5m','5분'],['15m','15분'],['30m','30분'],['1h','1시간'],['4h','4시간'],['1d','1일']];
function mktSvg(x,series,o){ o=o||{}; var W=520,H=190,L=8,R=8,T=12,B=26, iw=W-L-R, ih=H-T-B, n=x.length; if(!n) return '<p class="mkt-ld">자료가 없습니다.</p>';
  var axes={}; series.forEach(function(s){ var a=s.axis||'l'; var v=s.v.filter(isFinite); if(!v.length) return; var mn=Math.min.apply(null,v), mx=Math.max.apply(null,v); if(s.kind==='bar'&&!s.base) mn=Math.min(0,mn); var A=axes[a]||{mn:mn,mx:mx}; A.mn=Math.min(A.mn,mn); A.mx=Math.max(A.mx,mx); axes[a]=A; });
  Object.keys(axes).forEach(function(a){ var A=axes[a]; if(A.mx===A.mn){ A.mx+=1; A.mn-=1; } var pad=(A.mx-A.mn)*0.08; if(A.mn!==0) A.mn-=pad; A.mx+=pad; });
  var X=function(i){ return L+(n===1?iw/2:i*iw/(n-1)); }, Y=function(v,a){ var A=axes[a||'l']; return T+ih-(v-A.mn)/(A.mx-A.mn)*ih; };
  var bars=series.filter(function(s){ return s.kind==='bar'; }), bw=Math.max(2,iw/n*0.7/Math.max(1,bars.length));
  var g='<line x1="'+L+'" y1="'+(T+ih)+'" x2="'+(W-R)+'" y2="'+(T+ih)+'" stroke="rgba(255,255,255,.1)"/>'+[0.25,0.5,0.75].map(function(f){ var y=T+ih*f; return '<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="rgba(255,255,255,.05)"/>'; }).join('');
  bars.forEach(function(s,bi){ var a=s.axis||'l'; s.v.forEach(function(v,i){ if(!isFinite(v)) return; var y0=Y(Math.max(axes[a].mn,0),a), y=Y(v,a); var cx=X(i)-bw*bars.length/2+bw*bi; g+='<rect x="'+cx.toFixed(1)+'" y="'+Math.min(y,y0).toFixed(1)+'" width="'+(bw*0.9).toFixed(1)+'" height="'+Math.max(1,Math.abs(y0-y)).toFixed(1)+'" fill="'+s.color+'"/>'; }); });
  series.filter(function(s){ return s.kind!=='bar'; }).forEach(function(s){ var a=s.axis||'l'; var d=''; s.v.forEach(function(v,i){ if(!isFinite(v)) return; d+=(d?'L':'M')+X(i).toFixed(1)+' '+Y(v,a).toFixed(1); }); g+='<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="1.6"'+(s.dash?' stroke-dasharray="3 3"':'')+'/>'; });
  var fl=o.fl||function(v){ return mktBig(v); }, fr=o.fr||fl;
  if(axes.l) g+='<text x="'+L+'" y="'+(T+9)+'" fill="#9a9a9a" font-size="11">'+fl(axes.l.mx)+'</text><text x="'+L+'" y="'+(T+ih-4)+'" fill="#9a9a9a" font-size="11">'+fl(axes.l.mn)+'</text>';
  if(axes.r) g+='<text x="'+(W-R)+'" y="'+(T+9)+'" fill="#9a9a9a" font-size="11" text-anchor="end">'+fr(axes.r.mx)+'</text><text x="'+(W-R)+'" y="'+(T+ih-4)+'" fill="#9a9a9a" font-size="11" text-anchor="end">'+fr(axes.r.mn)+'</text>';
  var tf=o.day?function(t){ var d=new Date(+t); return (d.getMonth()+1)+'/'+d.getDate(); }:function(t){ var d=new Date(+t); var p=function(z){ return (z<10?'0':'')+z; }; return p(d.getHours())+':'+p(d.getMinutes()); };
  [0,Math.floor((n-1)/2),n-1].forEach(function(i,k){ g+='<text x="'+X(i).toFixed(1)+'" y="'+(H-6)+'" fill="#9a9a9a" font-size="11" text-anchor="'+(k===0?'start':k===2?'end':'middle')+'">'+tf(x[i])+'</text>'; });
  return '<svg viewBox="0 0 '+W+' '+H+'" class="mkx-svg" role="img">'+g+'</svg>'; }
function mktLeg(items){ return '<div class="mkx-leg">'+items.map(function(x){ return '<span><i style="background:'+x[1]+'"></i>'+x[0]+'</span>'; }).join('')+'</div>'; }
function mktData(){
  var sym=mktSym(), base=mktBase(sym), per=MKT.per, box=document.getElementById('mkt-data'); if(!box) return;
  var day=per==='1d';
  var cards=[['oi','미결제약정'],['acct','상위 트레이더 롱숏 비율(계정)'],['pos','상위 트레이더 롱숏 비율(포지션)'],['glob','전체 롱숏 비율'],['taker','테이커 매수와 매도량'],['basis','베이시스'],['fund','펀딩비(최근 40회)'],['ratio','미결제약정 / 유통량 비율']];
  box.innerHTML='<div class="mkx-per">'+MKT_PER.map(function(p){ return '<button type="button" class="'+(p[0]===per?'on':'')+'" onclick="MKT.per=\''+p[0]+'\';mktData()">'+p[1]+'</button>'; }).join('')+'</div><div class="mkx-grid">'+cards.map(function(c){ return '<section class="mkx-card" id="mkx-'+c[0]+'"><h4>'+c[1]+'</h4><div class="mkx-body"><p class="mkt-ld">불러오는 중</p></div></section>'; }).join('')+'</div>';
  var put=function(id,html){ if(sym!==mktSym()||per!==MKT.per) return; var e=document.querySelector('#mkx-'+id+' .mkx-body'); if(e) e.innerHTML=html; };
  var fail=function(id){ return function(){ put(id,'<p class="mkt-ld">이 종목은 자료가 없습니다.</p>'); }; };
  var q='?symbol='+sym+'&period='+per+'&limit=30', N=function(v){ return +v; };
  mktApi('/futures/data/openInterestHist'+q).then(function(L){ var x=L.map(function(r){ return r.timestamp; });
    put('oi',mktSvg(x,[{kind:'bar',base:1,v:L.map(function(r){ return +r.sumOpenInterest; }),color:'#5a5a5a'},{kind:'line',axis:'r',v:L.map(function(r){ return +r.sumOpenInterestValue; }),color:'#ececec'}],{day:day,fr:function(v){ return mktBig(v,1); }})+mktLeg([['미결제약정('+base+')','#5a5a5a'],['미결제약정 금액','#ececec']]));
    put('ratio',mktSvg(x,[{kind:'line',v:L.map(function(r){ var c=+r.CMCCirculatingSupply; return c?(+r.sumOpenInterest/c*100):NaN; }),color:'#ececec'}],{day:day,fl:function(v){ return v.toFixed(3)+'%'; }})+mktLeg([['미결제약정 / 유통 공급량','#ececec']]));
  }).catch(function(){ fail('oi')(); fail('ratio')(); });
  [['acct','/futures/data/topLongShortAccountRatio'],['pos','/futures/data/topLongShortPositionRatio'],['glob','/futures/data/globalLongShortAccountRatio']].forEach(function(c){
    mktApi(c[1]+q).then(function(L){ put(c[0],mktSvg(L.map(function(r){ return r.timestamp; }),[{kind:'line',v:L.map(function(r){ return +r.longShortRatio; }),color:'#ececec'}],{day:day,fl:function(v){ return v.toFixed(2); }})+mktLeg([['롱숏 비율','#ececec']])); }).catch(fail(c[0])); });
  mktApi('/futures/data/takerlongshortRatio'+q).then(function(L){ put('taker',mktSvg(L.map(function(r){ return r.timestamp; }),[{kind:'bar',v:L.map(function(r){ return +r.sellVol; }),color:'#c75a5a'},{kind:'bar',v:L.map(function(r){ return +r.buyVol; }),color:'#3f9e7c'}],{day:day})+mktLeg([['테이커 매도량('+base+')','#c75a5a'],['테이커 매수량('+base+')','#3f9e7c']])); }).catch(fail('taker'));
  mktApi('/futures/data/basis?pair='+sym+'&contractType=PERPETUAL&period='+per+'&limit=30').then(function(L){ put('basis',mktSvg(L.map(function(r){ return r.timestamp; }),[{kind:'line',v:L.map(function(r){ return +r.futuresPrice; }),color:'#ececec'},{kind:'line',v:L.map(function(r){ return +r.indexPrice; }),color:'#9a9a9a',dash:1},{kind:'bar',axis:'r',base:1,v:L.map(function(r){ return +r.basis; }),color:'#3a3a3a'}],{day:day,fl:function(v){ return mktFmt(v,v>=1000?0:2); },fr:function(v){ return v.toFixed(2); }})+mktLeg([['선물 가격','#ececec'],['지수 가격','#9a9a9a'],['베이시스','#3a3a3a']])); }).catch(fail('basis'));
  mktApi('/fapi/v1/fundingRate?symbol='+sym+'&limit=40').then(function(L){ put('fund',mktSvg(L.map(function(r){ return r.fundingTime; }),[{kind:'line',v:L.map(function(r){ return +r.fundingRate*100; }),color:'#ececec'}],{day:1,fl:function(v){ return v.toFixed(4)+'%'; }})+mktLeg([['펀딩비','#ececec']])); }).catch(fail('fund'));
}
/* ── 가운데 전략 목록 → 판단 패널 머리의 선택 목록 ── */
function mktRailMount(){ var br=document.getElementById('tft-brainin'); if(!br||br.querySelector('.mks-hd')) return; var all=[]; try{ all=tfTmAll(); }catch(e){} if(!all.length) return;
  var s=TF_TM.sel?tfTmOf(TF_TM.sel):null;
  br.insertAdjacentHTML('afterbegin','<div class="mks-hd"><button type="button" class="mks-btn" onclick="event.stopPropagation();mktRailTgl()" aria-haspopup="true"><span>전략 '+all.length+'개</span><b>'+gEsc(s?s.name:'전략 선택')+'</b>'+MKT_CHEV+'</button></div>'); }
function mktRailTgl(on){ var pg=document.querySelector('#g-content .tft-page'); if(!pg) return; var o=on==null?!pg.classList.contains('rail-open'):!!on; pg.classList.toggle('rail-open',o); }
document.addEventListener('click',function(e){ var pg=document.querySelector('#g-content .tft-page.rail-open'); if(!pg) return; if(e.target.closest('.tft-rail')||e.target.closest('.mks-btn')) return; pg.classList.remove('rail-open'); });
/* ── 붙이기 ── */
function mktMount(){ var pg=document.querySelector('#g-content .tft-page'); if(!pg||!pg.querySelector('.tft-grid')) return;
  if(!MKT.picked){ var ss=mktStratSym(); if(ss) MKT.sym=ss; }
  pg.classList.toggle('no-sel',!TF_TM.sel); mktHead(); mktTabsMount(); mktRailMount(); mktPoll(); mktLoop(); }
(function(){
  if(typeof tfTmChart==='function') tfTmChart=function(){ mktChart(); };
  if(typeof tfDashView==='function'){ var d0=tfDashView; tfDashView=function(){ var r=d0.apply(this,arguments); try{ mktMount(); }catch(e){} return r; }; }
  if(typeof tfTmBrain==='function'){ var b0=tfTmBrain; tfTmBrain=function(){ var r=b0.apply(this,arguments); try{ mktRailMount(); }catch(e){} return r; }; }
  if(typeof tfTmSelect==='function'){ var s0=tfTmSelect; tfTmSelect=function(key){ try{ var s=tfTmOf(key); var m=s&&String(s.sym||'').replace(/[\/\-\s]/g,'').toUpperCase(); if(m&&/USDT$/.test(m)){ MKT.sym=m; MKT.tick=null; MKT.prem=null; } }catch(e){}
    var r=s0.apply(this,arguments); try{ var pg=document.querySelector('#g-content .tft-page'); if(pg) pg.classList.toggle('no-sel',!TF_TM.sel); mktRailTgl(false); mktHead(); mktPoll(); mktChart(); var br=document.getElementById('tft-brainin'); var hd=br&&br.querySelector('.mks-hd'); if(hd) hd.remove(); mktRailMount(); }catch(e){} return r; }; }
  if(typeof pxTermEmpty==='function'){ var p0=pxTermEmpty; pxTermEmpty=function(){ var host=document.getElementById('nfxh-tv'); var had=host&&host.childNodes.length; var r=p0.apply(this,arguments); try{ mktChart(true); }catch(e){} return r; }; }
})();
