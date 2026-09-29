// rd 블록을 index.html 에 넣는다(여러 번 실행해도 같은 결과). 사용: node apply2.cjs
const fs=require('fs'); const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html'; let t=fs.readFileSync(F,'utf8');
const nl=s=>s.replace(/\r?\n/g,'\r\n'), D=__dirname+'/';
function rep(a,b,opt){ a=nl(a); b=nl(b); if(opt&&t.includes(b)) return; const n=t.split(a).length-1; if(n!==1){ if(opt&&t.includes(b)) return; throw new Error('anchor x'+n+': '+a.slice(0,80)); } t=t.replace(a,()=>b); }
function block(tag,body,placeBefore,wrapO,wrapC){ const B='/*'+tag+'_BEGIN*/', E='/*'+tag+'_END*/', i=t.indexOf(B), j=t.indexOf(E); const txt=B+'\r\n'+nl(body).trim()+'\r\n'+E;
  if(i>=0&&j>i){ t=t.slice(0,i)+txt+t.slice(j+E.length); return; }
  const k=t.indexOf(nl(placeBefore)); if(k<0||t.indexOf(nl(placeBefore),k+1)>=0) throw new Error('place '+tag); t=t.slice(0,k)+(wrapO||'')+txt+(wrapC||'')+'\r\n'+t.slice(k); }
// 1. 카탈로그 데이터
const cd=JSON.parse(fs.readFileSync(D+'cat-data.json','utf8')), cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
const q=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
const MKT=s=>{ if(s.kind==='rule'){ const a=s.asset; return ['비트코인','이더리움','솔라나','리플','도지코인'].includes(a)?'crypto':['나스닥','S&P 500','금'].includes(a)?'index':'stock'; } return {coin8:'crypto',big3:'crypto',tech8:'stock',idx3:'index',macro6:'multi'}[s.uni]; };
const FW=[1284,911,640,512,431,377,822,298,203,593,705,188,462,349,318,267,156,274,141,233];
const px=Object.keys(cd.cfg).map(k=>q(k)+':['+cd.cfg[k].join(',')+']').join(',');
const uni=Object.keys(cd.uni).map(k=>k+':{label:'+q(cd.uni[k].label)+',list:['+cd.uni[k].list.map(q).join(',')+']}').join(',\r\n  ');
const rows=cd.list.map((s,i)=>{ const c=cp[s.id]; if(!c) throw new Error('copy '+s.id); let f='id:'+q(s.id)+',kind:'+q(s.kind)+',mkt:'+q(MKT(s))+',name:'+q(c.name)+',one:'+q(c.one)+',ex:'+q(s.ex)+',fw:'+FW[i];
  if(s.kind==='rule') f+=',asset:'+q(s.asset)+',rsiTh:'+s.p.rsiTh+',tp:'+s.p.tp+',sl:'+s.p.sl+',tf:'+(s.p.trendFilter?1:0)+',startI:'+s.p.startI;
  else f+=',uni:'+q(s.uni)+','+Object.keys(s.c).map(k=>k+':'+s.c[k]).join(',');
  return '  {'+f+'}'; }).join(',\r\n');
const cat='/* ═══ 전략 카탈로그 20종 (시드 데이터) ═══\n   판단 방식(kind): agent 직접 탐색, rule 조건 실행, mix 혼합. 이름, 설명, 거래소, 행동 값을 여기서만 관리한다.\n   성과와 판단 기록은 적어 넣지 않는다. 아래 값을 자산별 가격(MK_PX_CFG)에 돌린 계산 결과다. 값은 성과를 보기 전에 행동으로 정했다.\n   id 는 바꾸지 않는다(저장된 즐겨찾기와 따라가기의 기준). 이름을 바꾸면 옛 이름을 MK_ALIAS 에 추가한다.\n   실제 운용 데이터가 생기면 이 배열과 mkPx, mkRunCfg 를 API 응답으로 바꾼다. MK_PX_CFG 값은 [씨앗, 시작가, 하루 변동 폭] */\nvar MK_PX_CFG={'+px+'};\nvar MK_UNI={\n  '+uni+'\n};\nvar MK_CAT=[\n'+rows+'\n];';
{ const B='/*MK_CAT_BEGIN*/', E='/*MK_CAT_END*/', i=t.indexOf(B), j=t.indexOf(E); if(i<0||j<0) throw new Error('cat marker'); t=t.slice(0,i)+B+'\r\n'+nl(cat)+'\r\n'+t.slice(j); }
// 2. 목록 조작 줄과 상세 머리글을 새 함수로
{ const a=t.indexOf("    controls='<div class=\"mk-bar\">'"), b=t.indexOf("+'</div></div>';",a); if(a>=0&&b>a){ t=t.slice(0,a)+"    controls=mk3Controls(t);"+t.slice(b+"+'</div></div>';".length); } else if(!t.includes('controls=mk3Controls(t);')) throw new Error('controls'); }
{ const a=t.indexOf("    +'<header class=\"mk-d-head\">'"), b=t.indexOf("+'</header>'",a); if(a>=0&&b>a){ t=t.slice(0,a)+"    +mk3Head(s,ne,pd,watching)"+t.slice(b+"+'</header>'".length); } else if(!t.includes('+mk3Head(s,ne,pd,watching)')) throw new Error('head'); }
// 3. 따라가기 화면: 체결 기록의 가격을 쓴다
rep("var PXB=mkPx(s2&&s2.p&&s2.p.px), eP=PXB[x.entry]||0, xP=(s2&&s2.p&&x.kind==='sl')?eP*(1+s2.p.sl/100):(s2&&s2.p&&x.kind==='tp'&&s2.p.tp!=null)?eP*(1+s2.p.tp/100):(PXB[x.exit]||eP);",
    "var PXB=mkPx(s2&&s2.p&&s2.p.px), eP=x.ep!=null?x.ep:(PXB[x.entry]||0), xP=x.xp!=null?x.xp:(PXB[x.exit]||eP);",true);
// 4. 따라가기 시트의 유형과 주체
rep(`'+gEsc(mkTitle(s2))+' '+tfKindBadge('rule')+'</div><div class="s num">작성자 '+gEsc(s2.nick)+', 검증 수익률 <b class="'+(r.ret>=0?'mk-up':'mk-dn')+'">'+mkPct(r.ret)+'</b> ('+mkPdLabel(pd)+', 백테스트 '+mkMonths(r)+'개월, 수수료 반영)</div></div>'`,
    `'+gEsc(mkTitle(s2))+'</div><div class="s num">'+gEsc(mkFollowLine(s2))+'</div></div>'`,true);
// 5. 원본을 찾지 못한 따라가기는 0 으로 바꿔 보이지 않고 표시한다
rep("if(!s2||!s2.r.eq||s2.r.eq.length<32) return {inv:inv,pnlPct:0,total:0,realized:0,unreal:0,share:0,net:0,est:inv,avail:inv,posOpen:false};",
    "if(!s2||!s2.r.eq||s2.r.eq.length<32) return {inv:inv,pnlPct:0,total:0,realized:0,unreal:0,share:0,net:0,est:inv,avail:inv,posOpen:false,missing:!s2};",true);
// 5b. 따라가기 시트의 성과는 시작 이후 전체(목록에서 기간 선택을 없앴다)
rep("var cp=cpState(), cfg=cpCfg(), pd=mkPd(), r=tfSS3PdCalc(s2,pd), d=tfDerive();","var cp=cpState(), cfg=cpCfg(), pd='all', r=s2.r, d=tfDerive();",true);
// 5c. 가격 캐시 키: 설정, 길이, 데이터 버전
if(!t.includes("(window.MK_DATA_V||''); if(MK_PXC[ck]) return MK_PXC[ck];")){
  rep("  if(MK_PXC[key]) return MK_PXC[key];\n  var c=(window.MK_PX_CFG||{})[key]; if(!c) return PRICE0;","  var c=(window.MK_PX_CFG||{})[key]; if(!c) return PRICE0;\n  var ck=key+'|'+c.join('/')+'|'+PRICE0.length+'|'+(window.MK_DATA_V||''); if(MK_PXC[ck]) return MK_PXC[ck];");
  rep("  return (MK_PXC[key]=p);","  return (MK_PXC[ck]=p);");
  if(!t.includes("(window.MK_DATA_V||''); if(MK_PXC[ck]) return MK_PXC[ck];")) throw new Error('px cache');
}
// 5d. 저장과 중복 검사는 현재 이름 하나로(ID, 옛 이름으로 들어와도 같은 전략)
rep("  var s2=tfSSFind(nick); if(!s2||s2.me) return;\n  if(cpState().copies.some(","  var s2=tfSSFind(nick); if(!s2||s2.me) return;\n  nick=s2.nick; /* ID 나 옛 이름으로 들어와도 같은 전략으로 저장 */\n  if(cpState().copies.some(",true);
rep("  var t=tfS(); t.watch=t.watch||[];\n  var i=t.watch.indexOf(nick);","  var sW=tfSSFind(nick); if(sW&&!sW.me) nick=sW.nick;\n  var t=tfS(); t.watch=t.watch||[];\n  var i=t.watch.indexOf(nick);",true);
rep("  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\n  mkFollowClose(true); tfSS3DlgClose(true);","  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\n  nick=s2.nick; ne=tfSSNe(nick);\n  mkFollowClose(true); tfSS3DlgClose(true);",true);
// 5e. 원본을 찾지 못한 따라가기는 그렇다고 말한다
rep("    +'<div class=\"mk-acct\"><b>내 따라가기 계정</b>","    +(d.missing?'<div class=\"warn3\" style=\"margin:0 0 12px\">이전 목록의 전략이라 지금은 기록을 불러올 수 없어요. 넣은 금액은 그대로 보관돼요.</div>':'')\n    +'<div class=\"mk-acct\"><b>내 따라가기 계정</b>",true);
rep("<small>작성자 '+gEsc(c.nick)+', 내 따라가기 계정</small><span class=\"num\">운용 '+cpUsd(d.inv)+', 순손익 '+cpUsd(d.net)+'</span>","<small>'+(seed?(MK_KIND[seed.kind]||'조건 실행')+', ':'')+'내 따라가기 계정</small><span class=\"num\">'+(d.missing?'원본 전략을 찾을 수 없어요, 넣은 금액 '+cpUsd(d.inv):'운용 '+cpUsd(d.inv)+', 순손익 '+cpUsd(d.net))+'</span>",true);
// 5g. 따라가는 중 목록: 원본을 찾지 못한 계정은 합계에서 빼고 그렇다고 표시
rep("  act.forEach(function(c2){ var d=cpCalc(c2); sum.est+=d.est;","  act.forEach(function(c2){ var d=cpCalc(c2); if(d.missing) return; sum.est+=d.est;",true);
rep(["      +'<span class=\"tag '+(on?'on':'off')+'\">'+(on?'따라가는 중':'중단됨')+'</span>'","      +'<span style=\"flex:1\"></span><span class=\"cps-static num\">'+new Date(c2.at).toLocaleDateString('ko-KR')+' 시작</span></div>'","      +(on?'<div class=\"cpd-kv\">'"].join('\n'),
    ["      +'<span class=\"tag '+(on&&!d.missing?'on':'off')+'\">'+(d.missing?'원본을 찾을 수 없음':on?'따라가는 중':'중단됨')+'</span>'","      +'<span style=\"flex:1\"></span><span class=\"cps-static num\">'+new Date(c2.at).toLocaleDateString('ko-KR')+' 시작</span></div>'","      +(d.missing?'<div class=\"cpd-kv\"><div><small>넣은 금액</small><b class=\"num\">'+cpUsd(d.inv)+'</b></div></div>':on?'<div class=\"cpd-kv\">'"].join('\n'),true);
// 5h. 사람 작성자처럼 읽히는 문장
{ const T0="toast(nick+' 님의 전략을 따라가기 시작했어요. 다음 진입부터 자동으로 따라가요');", T1="toast(nick+' 따라가기를 시작했어요. 다음 진입부터 자동으로 따라가요');", T2="toast(nick+' 따라가기를 시작했어요. '+(c2.adv.existing==='copy'?'지금 든 종목부터 바로 따라가요':'다음 진입부터 자동으로 따라가요'));";
  if(!t.includes(T2)) rep(t.includes(T1)?T1:T0,T2); }
// 5n. 따라가기 시트: Tab 이 시트 안에서 돌고, 열린 동안 뒤 화면은 조작할 수 없다
{ const NL=String.fromCharCode(10), K=fs.readFileSync(D+'sheet-keys.js','utf8').trim();
  rep("function mkFollowEsc(e){ if(e.key==='Escape') mkFollowClose(); }",K,true);
  rep("  var w=$('mk-follow'); if(w){ w.id=''; w.remove(); }"+NL+"  document.removeEventListener('keydown',mkFollowEsc);","  var w=$('mk-follow'); if(w){ w.id=''; w.remove(); }"+NL+"  mkFollowInert(false);"+NL+"  document.removeEventListener('keydown',mkFollowEsc);",true);
  rep("  document.body.appendChild(w);"+NL+"  var gs=$('g-scroll'); if(gs) gs.style.overflow='hidden';"+NL+"  document.addEventListener('keydown',mkFollowEsc);","  document.body.appendChild(w);"+NL+"  mkFollowInert(true,w);"+NL+"  var gs=$('g-scroll'); if(gs) gs.style.overflow='hidden';"+NL+"  document.addEventListener('keydown',mkFollowEsc);",true); }
rep("'</b>로 '+gEsc(TF_MKF.nick||'')+' 님의 전략을 그대로 따라가요.</div>'","'</b>로 '+gEsc(TF_MKF.nick||'')+'의 판단을 그대로 따라가요.</div>'",true);
rep("수익이 나면 '+Math.round(cpMeta(nick).share*100)+'%를 작성자와 나눠요.</div>'","수익이 나면 그중 '+Math.round(cpMeta(nick).share*100)+'%가 전략 이용료로 나가요.</div>'",true);
rep("'%가 작성자에게 분배되고 내역이 여기에 남아요.'","'%가 전략 이용료로 나가고 내역이 여기에 남아요.'",true);
// 5i. 따라가는 중 요약: 원본을 찾지 못한 계정은 진행 건수에서 빼고 따로 센다
rep("<span class=\"mt2\">'+act.length+'건 진행 중, 내 예산 기준 손익 (원본 검증 수치와 달라요), USDT 표기</span>","<span class=\"mt2\">'+act.filter(function(x){ return !cpCalc(x).missing; }).length+'건 진행 중'+(act.some(function(x){ return cpCalc(x).missing; })?', 원본을 찾을 수 없는 계정 '+act.filter(function(x){ return cpCalc(x).missing; }).length+'건은 합계에서 뺐어요':'')+', 내 예산 기준 손익, USDT 표기</span>",true);
// 5j. 성과 차트: 좁은 화면에서는 좌표를 화면 폭에 맞춰 다시 잡는다(글자 크기 유지)
rep("  var W=1136,H=280,pl=54,pr=6,pt=24,pb=32, base=MKD.tab==='bal'?1000:0;","  var W=mkChartW(), mob=W<560, H=mob?236:280,pl=mob?46:54,pr=6,pt=24,pb=32, base=MKD.tab==='bal'?1000:0; /* 좌표 폭을 화면 폭에 맞춘다(글자 크기 유지) */",true);
rep("  var nx=Math.min(5,P.length), xl='',","  var nx=Math.min(mob?4:5,P.length), xl='',",true);
// 5k. 평가할 계정이 없고 찾지 못한 계정만 있으면 합계 칸을 0 이 아니라 비워 둔다
rep("'\">'+cpUsd(v)+'</b></div>'; };\n  var rows=(TF_CPD.flt==='active'?act:all).map(function(c2){","'\">'+(noVal?'-':cpUsd(v))+'</b></div>'; };\n  var rows=(TF_CPD.flt==='active'?act:all).map(function(c2){",true);
rep("  var sum={est:0,avail:0,net:0,unreal:0,realized:0,share:0};\n  act.forEach(","  var sum={est:0,avail:0,net:0,unreal:0,realized:0,share:0}, noVal=act.length>0&&act.every(function(x){ return cpCalc(x).missing; });\n  act.forEach(",true);
// 5l. 새 따라가기에 데이터 세대를 기록한다(저장된 봉 번호의 날짜 기준)
rep("    simStartI:eqA.length>31?eqA[eqA.length-31].i:null,","    gen:{asof:MK_ASOF.slice(),len:PRICE0.length},\n    simStartI:eqA.length>31?eqA[eqA.length-31].i:null,",true);
// 5m. 따라가기 시트의 요약은 판단 방식과 주기, 기존 보유 처리
rep("(TF_MKF.existing==='copy'?' 열려 있는 포지션도 지금 따라 들어가요.':'')+'</div>';","(TF_MKF.existing==='copy'?' 지금 든 종목도 바로 따라 들어가요.':' 지금 든 종목은 건너뛰고 다음 진입부터 따라가요.')+'</div>';",true);
// 6. rd 블록이 선언하는 함수의 옛 정의를 지운다(정의는 하나만 남긴다)
const core=fs.readFileSync(D+'agent-core.js','utf8')+'\n'+fs.readFileSync(D+'rd-ui.js','utf8');
{ const names=[...core.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(m=>m[1]), removed=[];
  for(const nm of names){ for(;;){ const lim=t.indexOf('/*RD_CORE_BEGIN*/'), head='\nfunction '+nm+'(', i=t.indexOf(head); if(i<0||(lim>=0&&i>lim)) break;
      let k=t.indexOf('{',i), d=0, inS=null;
      for(;k<t.length;k++){ const ch=t[k]; if(inS){ if(ch==='\\'){ k++; continue; } if(ch===inS) inS=null; continue; } if(ch==="'"||ch==='"'||ch==='`'){ inS=ch; continue; } if(ch==='/'&&t[k+1]==='*'){ k=t.indexOf('*/',k)+1; continue; } if(ch==='{') d++; else if(ch==='}'){ d--; if(d===0) break; } }
      let e=k+1; while(t[e]===' '||t[e]==='\t') e++; if(t.slice(e,e+2)==='/*'){ const c2=t.indexOf('*/',e); if(c2>0&&t.slice(e,c2).indexOf('\n')<0) e=c2+2; }
      t=t.slice(0,i)+t.slice(e); removed.push(nm); } }
  console.log('removed old definitions:',removed.join(', ')||'none'); }
// 7. 코드 블록과 스타일
block('RD_CORE',core,'</script>\r\n<script>\r\n');
block('RD_CSS',fs.readFileSync(D+'rd.css','utf8'),'<script src="site-config.js','<style>\r\n','\r\n</style>');
fs.writeFileSync(F,t); console.log('applied', t.length);
