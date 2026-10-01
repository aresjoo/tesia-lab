/* ═══ 종목 선택: 바이낸스 선물 전 종목(코인, 미국 주식, 한국 주식, 홍콩과 중국, 원자재, 프리 IPO)과 실제 아이콘 (sk-sym) ═══
   아이콘은 assets/coins/ 에 내려받은 파일(index.json) → 공개 코인 아이콘 묶음 → 첫 글자 순. 분류는 바이낸스 exchangeInfo 의 underlyingType/SubType */
var MKT_ICONS=null, MKT_EXI=null;
var MKT_KO={SAMSUNG:'삼성전자',SKHYNIX:'SK하이닉스',HYUNDAI:'현대차',SAMSUNGEM:'삼성전기',HANMI:'한미반도체',LGELECTRONICS:'LG전자',NAVER:'네이버',KODEX200:'KODEX 200',
  HK0700:'텐센트',TENCENT:'텐센트',HK1810:'샤오미',POPMART:'팝마트',KUAISHOU:'콰이쇼우',MEITUAN:'메이퇀',BYD:'BYD',HK0992:'레노버',XAU:'금',XAG:'은',XPT:'백금',XPD:'팔라듐',COPPER:'구리',CL:'WTI 원유',BZ:'브렌트유',NATGAS:'천연가스',
  TSLA:'테슬라',NVDA:'엔비디아',AAPL:'애플',MSFT:'마이크로소프트',AMZN:'아마존',GOOGL:'알파벳',META:'메타',SPY:'S&P 500',QQQ:'나스닥 100',SOXL:'반도체 3배',EWY:'한국 ETF',EWJ:'일본 ETF',OPENAI:'오픈AI',ANTHROPIC:'앤트로픽'};
var MKT_CATS2=[['all','전체'],['us','미국 주식'],['kr','한국 주식'],['hk','홍콩, 중국'],['cmd','원자재'],['pre','프리 IPO'],['ai','AI'],['defi','디파이'],['l1','레이어 1'],['l2','레이어 2'],['meme','밈']];
function mktIconsLoad(){ if(MKT_ICONS) return Promise.resolve(MKT_ICONS); return fetch('assets/coins/index.json').then(function(r){ return r.ok?r.json():{}; }).catch(function(){ return {}; }).then(function(j){ MKT_ICONS=j||{}; return MKT_ICONS; }); }
function mktExiLoad(){ if(MKT_EXI) return Promise.resolve(MKT_EXI); return mktApi('/fapi/v1/exchangeInfo').then(function(j){ var m={}; (j.symbols||[]).forEach(function(s){ if(s.status==='TRADING'&&/PERPETUAL/.test(s.contractType)) m[s.symbol]={t:s.underlyingType||'',st:(s.underlyingSubType||[]).join('|'),b:s.baseAsset}; }); MKT_EXI=m; return m; }).catch(function(){ MKT_EXI={}; return MKT_EXI; }); }
mktIcon=function(base,sz){ sz=sz||22; var B=String(base).toUpperCase(), f=MKT_ICONS&&MKT_ICONS[B];
  var src=f?'assets/coins/'+f:'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/'+B.toLowerCase()+'.svg';
  return '<span class="mk-ic" style="width:'+sz+'px;height:'+sz+'px"><img src="'+src+'" alt="" width="'+sz+'" height="'+sz+'" loading="lazy" onerror="this.remove()"><i>'+gEsc(B.charAt(0))+'</i></span>'; };
function mktCatOf(sym){ var e=MKT_EXI&&MKT_EXI[sym]; if(!e) return {}; var t=e.t, st=e.st;
  return {us:t==='EQUITY',kr:t==='KR_EQUITY',hk:t==='HK_EQUITY'||t==='CN_EQUITY',cmd:t==='COMMODITY',pre:t==='PREMARKET',ai:/\bAI\b/.test(st),defi:/DeFi/.test(st),l1:/Layer-1/.test(st),l2:/Layer-2/.test(st),meme:/Meme/.test(st)}; }
(function(){
  /* 종목 목록: 미국 주식처럼 주말에 쉬는 종목도 빠지지 않게 7일 안에 거래가 있으면 넣는다 */
  mktAll=function(){ if(MKT.all&&Date.now()-MKT.allAt<15000) return Promise.resolve(MKT.all);
    return Promise.all([mktApi('/fapi/v1/ticker/24hr'),mktExiLoad(),mktIconsLoad()]).then(function(r){ var now=Date.now(), L=r[0];
      MKT.all=L.filter(function(s){ return /USDT$/.test(s.symbol)&&(!MKT_EXI||!Object.keys(MKT_EXI).length||MKT_EXI[s.symbol])&&now-(+s.closeTime)<7*864e5; }); MKT.allAt=now; return MKT.all; }); };
  var p0=mktPick; mktPick=function(){ var r=p0.apply(this,arguments); try{ var seg=document.getElementById('mkp-cat'); if(seg){ seg.innerHTML=MKT_CATS2.map(function(x){ return '<button type="button" data-v="'+x[0]+'" class="'+(MKT.cat===x[0]?'on':'')+'">'+x[1]+'</button>'; }).join(''); } }catch(e){} return r; };
  mktRows=function(){
    var box=document.getElementById('mkp-rows'); if(!box||!MKT.all) return;
    var q=MKT.q;
    var L=MKT.all.filter(function(s){ var b=mktBase(s.symbol);
      if(MKT.src==='fav'&&MKT.fav.indexOf(s.symbol)<0) return false;
      if(MKT.cat!=='all'&&!mktCatOf(s.symbol)[MKT.cat]) return false;
      if(q){ var ko=MKT_KO[b]||''; if(s.symbol.indexOf(q)<0&&ko.indexOf(q)<0&&ko.toUpperCase().indexOf(q)<0) return false; } return true; });
    var key={sym:function(s){ return s.symbol; },px:function(s){ return +s.lastPrice; },chg:function(s){ return +s.priceChangePercent; },qv:function(s){ return +s.quoteVolume; }}[MKT.sort];
    L.sort(function(a,b){ var x=key(a), y=key(b); var r=x<y?-1:x>y?1:0; return MKT.desc?-r:r; });
    var cur=mktSym();
    box.innerHTML=L.length?L.map(function(s){ var b=mktBase(s.symbol), up=+s.priceChangePercent>=0, fav=MKT.fav.indexOf(s.symbol)>=0, ko=MKT_KO[b];
      return '<div class="mkp-r'+(s.symbol===cur?' on':'')+'" role="button" tabindex="0" onclick="mktSet(\''+s.symbol+'\')" onkeydown="if(event.key===\'Enter\')mktSet(\''+s.symbol+'\')">'
        +'<button type="button" class="mkp-st'+(fav?' on':'')+'" aria-label="즐겨찾기" onclick="event.stopPropagation();mktFav(\''+s.symbol+'\',this)">'+(fav?'★':'☆')+'</button>'
        +'<span class="mkp-s">'+mktIcon(b,20)+'<b>'+gEsc(s.symbol)+'</b>'+(ko?'<em>'+gEsc(ko)+'</em>':'')+'</span><span class="num">'+mktFmt(s.lastPrice)+'</span><span class="num '+(up?'up':'dn')+'">'+(up?'+':'')+(+s.priceChangePercent).toFixed(2)+'%</span><span class="num">'+mktBig(s.quoteVolume)+'</span></div>'; }).join('')
      :'<p class="mkp-ld">'+(MKT.src==='fav'?'즐겨찾기한 종목이 없습니다. 별을 눌러 추가합니다.':'찾는 종목이 없습니다.')+'</p>';
  };
  /* 시장 줄 아이콘도 같은 파일을 쓰도록 미리 목록을 읽어 둔다 */
  mktIconsLoad().then(function(){ try{ if(document.getElementById('mkh')) mktHead(); }catch(e){} });
})();
