// 토큰화 상품 표기, 주문 표의 티커, 세는 말 통일, 날짜 형식, 좁은 화면에서 떠 있는 버튼 비키기
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const cnt=(s,x)=>s.split(x).length-1;
const one=(s,x,y,n)=>{ const c=cnt(s,x); if(c!==(n||1)) throw new Error('x'+c+': '+x.slice(0,70)); return s.split(x).join(y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
// 상품 종류: 가상자산은 현물, 주식과 지수와 금은 토큰화 상품
s=one(s,"/* 주문 용어: 현물은 매수와 매도,","/* 거래하는 상품. 가상자산 거래소에서 주식, 지수, 금은 가격을 따라가는 토큰으로 거래한다 */\nfunction mkInst(a){ return MK_CRYPTO[a]?'현물':(a==='나스닥'||a==='S&P 500')?'토큰화 지수':a==='금'?'토큰화 금':'토큰화 주식'; }\nfunction mkInstList(s){ var l=s.cfg&&s.cfg.uni?mkUni(s).list:[s.asset], o=[]; l.forEach(function(a){ var k=mkInst(a); if(o.indexOf(k)<0) o.push(k); }); return o; }\nfunction mkTagIO(s,a,out){ var W=mkWords(s); return W.inst==='선물'?(out?W.tagOut:W.tagIn):mkInst(a)+(out?' 매도':' 매수'); }\n/* 주문 용어: 현물은 매수와 매도,");
s=one(s,"tag:W.tagIn,a:e.a,","tag:mkTagIO(s,e.a,0),a:e.a,",2);
s=one(s,"tag:W.tagOut,a:e.a,","tag:mkTagIO(s,e.a,1),a:e.a,",2);
s=one(s," '현물':'코인이나 주식을 실제로 사서 보유하는 거래. 가격이 오르면 이익이 난다.',"," '토큰화 주식':'주식의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',\n '토큰화 지수':'나스닥 같은 지수의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',\n '토큰화 금':'금의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',\n '현물':'코인을 실제로 사서 보유하는 거래. 가격이 오르면 이익이 난다.',");
s=one(s,"    +row('실행 거래소',mkEx(s)[1])","    +row('거래 상품',mkInstList(s).join(', '))\n    +row('실행 거래소',mkEx(s)[1])");
// 주문 표는 티커
s=one(s,"</span><b>'+gEsc(x.a)+'</b></td><td>'+x.label","</span><b>'+gEsc(mkTk(x.a))+'</b></td><td>'+x.label");
// 세는 말: 주문은 건, 거래(사고팔기 한 번)는 회
s=one(s,"<span class=\"mko-n num\">전체 '+o.length.toLocaleString()+'건, 1,000 USDT로 시작한 기준</span>","<span class=\"mko-n num\">주문 '+o.length.toLocaleString()+'건, 1,000 USDT로 시작한 기준</span>",2);
// 좁은 화면: 떠 있는 버튼이 카드의 버튼이나 페이지 번호를 가리면 잠시 비킨다
s+=`
/* ── 좁은 화면에서 떠 있는 버튼(고객지원, QA)이 목록의 버튼을 가리지 않게 ── */
var MK_FAB_T=0;
function mkFabDodge(){
  var on=false;
  if(innerWidth<=640&&G.mode==='tfss3'){
    var fabs=[$('teth-help'),$('tf-devbtn')].filter(function(x){ return x&&x.offsetWidth; }), tg=document.querySelectorAll('.mk3-foot .mk3-b, .mk-pager .mk-pg');
    for(var i=0;i<fabs.length&&!on;i++){ var f=fabs[i].getBoundingClientRect();
      for(var k=0;k<tg.length;k++){ var r=tg[k].getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) continue; if(r.left<f.right+4&&r.right>f.left-4&&r.top<f.bottom+4&&r.bottom>f.top-4){ on=true; break; } } }
  }
  document.body.classList.toggle('mk-fab-dodge',on);
}
function mkFabTick(){ if(MK_FAB_T) return; MK_FAB_T=requestAnimationFrame(function(){ MK_FAB_T=0; try{ mkFabDodge(); }catch(e){} }); }
document.addEventListener('scroll',mkFabTick,true); window.addEventListener('resize',mkFabTick); window.addEventListener('hashchange',function(){ setTimeout(mkFabTick,400); });
`;
s=one(s,"if(MK_HUB_TAB==='find'&&prev!=='find') try{ mkCardsEnter(); }catch(e){} return out; };","if(MK_HUB_TAB==='find'&&prev!=='find') try{ mkCardsEnter(); }catch(e){} try{ setTimeout(mkFabTick,60); }catch(e){} return out; };");
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',`
/* 떠 있는 버튼이 목록의 버튼 위에 올 때 */
body.mk-fab-dodge #teth-help,body.mk-fab-dodge #tf-devbtn{opacity:0;pointer-events:none}
#tf-devbtn{transition:opacity .15s ease}
`);
let a=fs.readFileSync(D+'apply2.cjs','utf8');
a=one(a,"rep(\"'%, 체결 '+trM.length+'회'\",\"'%, 끝난 거래 '+trM.length+'건'\",true);","rep(\"'%, 체결 '+trM.length+'회'\",\"'%, 끝난 거래 '+trM.length+'회'\",true);");
a=one(a,"rep(\"'건'+(trM.length?', 승률 '\",\"'건'+(false&&trM.length?', 승률 '\",true);","rep(\"'회'+(trM.length?', 승률 '\",\"'회'+(false&&trM.length?', 승률 '\",true);");
a=a.replace("// 6. rd","// 5y. 따라가기의 입출금 표: 날짜 형식을 거래내역과 같게\nrep(\"new Date(e.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})\",\"mkDT(e.at)\",true);\n// 6. rd");
fs.writeFileSync(D+'apply2.cjs',a);
let t=fs.readFileSync(F,'utf8');
t=one(t,"'%, 끝난 거래 '+trM.length+'건'+(false&&trM.length?', 승률 '","'%, 끝난 거래 '+trM.length+'회'+(false&&trM.length?', 승률 '");
fs.writeFileSync(F,t);
s=fs.readFileSync(D+'rd-ui.js','utf8');
s+="function mkDT(ms){ var t=new Date(ms), p=function(n){ return (n<10?'0':'')+n; }; return t.getFullYear()+'.'+p(t.getMonth()+1)+'.'+p(t.getDate())+' '+p(t.getHours())+':'+p(t.getMinutes()); }\n";
fs.writeFileSync(D+'rd-ui.js',s);
console.log('ok', cnt(t,"toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})"));
