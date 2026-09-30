// rd 블록을 index.html 에 넣는다(여러 번 실행해도 같은 결과). 사용: node apply2.cjs
const fs=require('fs'); const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html'; let t=fs.readFileSync(F,'utf8');
const nl=s=>s.replace(/\r?\n/g,'\r\n'), D=__dirname+'/';
const HP0=require('./hapnida.cjs').convText, RN=require('./rename.cjs').renameText, US=require('./usd.cjs').usdText, HP=s=>RN(HP0(s)), HU=s=>US(HP(s));
function rep(a,b,opt){ a=nl(a); b=nl(b); if(opt&&t.includes(b)) return; if(t.indexOf(a)<0){ /* 합니다체로 바뀐 뒤의 본문에도 맞춘다 */ const V=[[HU(a),HU(b)],[HP(a),HP(b)],[HP0(a),HP0(b)],[US(a),US(b)]]; for(const [a2,b2] of V){ if(t.includes(b2)&&(opt||t.indexOf(a2)<0)) return; if(t.indexOf(a2)>=0){ a=a2; b=b2; break; } } } const n=t.split(a).length-1; if(n!==1){ if(opt&&t.includes(b)) return; throw new Error('anchor x'+n+': '+a.slice(0,80)); } t=t.replace(a,()=>b); }
function block(tag,body,placeBefore,wrapO,wrapC){ const B='/*'+tag+'_BEGIN*/', E='/*'+tag+'_END*/', i=t.indexOf(B), j=t.indexOf(E); const txt=B+'\r\n'+nl(body).trim()+'\r\n'+E;
  if(i>=0&&j>i){ t=t.slice(0,i)+txt+t.slice(j+E.length); return; }
  const k=t.indexOf(nl(placeBefore)); if(k<0||t.indexOf(nl(placeBefore),k+1)>=0) throw new Error('place '+tag); t=t.slice(0,k)+(wrapO||'')+txt+(wrapC||'')+'\r\n'+t.slice(k); }
// 1. 카탈로그 데이터
const cd=JSON.parse(fs.readFileSync(D+'cat-data.json','utf8')), cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
const q=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
const MKT=s=>{ if(s.c&&s.c.fut) return 'crypto'; if(s.kind==='rule'){ const a=s.asset; return ['비트코인','이더리움','솔라나','리플','도지코인'].includes(a)?'crypto':['나스닥','S&P 500','금'].includes(a)?'index':'stock'; } return {coin8:'crypto',big3:'crypto',tech8:'stock',idx3:'index',macro6:'multi'}[s.uni]; };
const FW=[612,548,731,496,455,389,342,527,418,377,1284,911,640,512,431,377,822,298,203,593,705,188,462,349,318,267,156,274,141,233,486];
const px=Object.keys(cd.cfg).map(k=>q(k)+':['+cd.cfg[k].join(',')+']').join(',');
const uni=Object.keys(cd.uni).map(k=>k+':{label:'+q(cd.uni[k].label)+',list:['+cd.uni[k].list.map(q).join(',')+']}').join(',\r\n  ');
const rows=cd.list.map((s,i)=>{ const c=cp[s.id]; if(!c) throw new Error('copy '+s.id); let f='id:'+q(s.id)+',kind:'+q(s.kind)+',mkt:'+q(MKT(s))+',name:'+q(c.name)+',one:'+q(c.one)+',ex:'+q(s.ex)+',fw:'+FW[i]+',by:'+q(c.by);
  if(s.c&&s.c.fut) f+=(s.asset?',asset:'+q(s.asset):',uni:'+q(s.uni))+',inst:'+q('futures')+','+Object.keys(s.c).map(k=>k+':'+(typeof s.c[k]==='string'?q(s.c[k]):s.c[k])).join(',');
  else if(s.kind==='rule') f+=',asset:'+q(s.asset)+',rsiTh:'+s.p.rsiTh+',tp:'+s.p.tp+',sl:'+s.p.sl+',tf:'+(s.p.trendFilter?1:0)+',startI:'+s.p.startI;
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
// 5. (뺌) 원본을 찾지 못한 따라가기 표시: 좌수 계산으로 다시 쓴 cpCalc 의 none 값에 missing 이 들어 있다
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
    ["      +'<span class=\"tag '+(on&&!d.missing?'on':'off')+'\">'+(d.missing?'원본을 찾을 수 없음':on?(c2.winding?'정리 대기':'따라가는 중'):'중단됨')+'</span>'","      +'<span style=\"flex:1\"></span><span class=\"cps-static num\">'+new Date(c2.at).toLocaleDateString('ko-KR')+' 시작</span></div>'","      +(d.missing?'<div class=\"cpd-kv\"><div><small>넣은 금액</small><b class=\"num\">'+cpUsd(d.inv)+'</b></div></div>':on?'<div class=\"cpd-kv\">'"].join('\n'),true);
// 5h. 사람 작성자처럼 읽히는 문장
{ const T0="toast(nick+' 님의 전략을 따라가기 시작했어요. 다음 진입부터 자동으로 따라가요');", T1="toast(nick+' 따라가기를 시작했어요. 다음 진입부터 자동으로 따라가요');", T2="toast(nick+' 따라가기를 시작했어요. '+(c2.adv.existing==='copy'?'지금 든 종목부터 바로 따라가요':'다음 진입부터 자동으로 따라가요'));";
  if(!t.includes(T2)) rep(t.includes(T1)?T1:T0,T2); }
// 5n. 따라가기 시트: Tab 이 맨 위 창 안에서 돌고, 열린 동안 뒤 화면은 조작할 수 없다
{ const NL=String.fromCharCode(10), K=fs.readFileSync(D+'sheet-keys.js','utf8').trim();
  const i=t.indexOf('function mkFollowEsc('), j=t.indexOf('function mkFollowClose(',i); if(i<0||j<i) throw new Error('sheet keys'); t=t.slice(0,i)+nl(K)+'\r\n'+t.slice(j);
  rep("  var w=$('mk-follow'); if(w){ w.id=''; w.remove(); }"+NL+"  document.removeEventListener('keydown',mkFollowEsc);","  var w=$('mk-follow'); if(w){ w.id=''; w.remove(); }"+NL+"  mkFollowInert(false);"+NL+"  document.removeEventListener('keydown',mkFollowEsc);",true);
  rep("  document.body.appendChild(w);"+NL+"  var gs=$('g-scroll'); if(gs) gs.style.overflow='hidden';"+NL+"  document.addEventListener('keydown',mkFollowEsc);","  document.body.appendChild(w);"+NL+"  mkFollowInert(true,w);"+NL+"  var gs=$('g-scroll'); if(gs) gs.style.overflow='hidden';"+NL+"  document.addEventListener('keydown',mkFollowEsc);",true);
  // 5o. 시트를 다시 열 때(예산 추가 뒤) 처음 누른 버튼을 기억해 닫을 때 그리로 돌아간다
  rep("  var s2=tfSSFind(nick);"+NL+"  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }","  var s2=tfSSFind(nick), pt=$('mk-follow')&&TF_MKF.trig&&document.body.contains(TF_MKF.trig)?TF_MKF.trig:null;"+NL+"  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }",true);
  rep("ne:ne,nick:nick,trig:document.activeElement};","ne:ne,nick:nick,trig:pt||document.activeElement};",true);
  // 5p. 시트 위에서 닫힌 대화 상자는 뒤 화면 스크롤을 풀지 않는다
  rep("  var w=$('ss3-dlgw'); if(w){ w.id=''; w.remove(); }"+NL+"  var gs=$('g-scroll'); if(gs) gs.style.overflow='';","  var w=$('ss3-dlgw'); if(w){ w.id=''; w.remove(); }"+NL+"  var gs=$('g-scroll'); if(gs&&!$('mk-follow')) gs.style.overflow='';",true);
 }
// 5q. 시트 안의 상태 알림(화면 읽기 도구용, 보이지 않음)
rep("    +'<div class=\"mk-f-sum\" id=\"mk-f-sum\"></div>'","    +'<div class=\"mk-f-sum\" id=\"mk-f-sum\"></div><div id=\"mk-f-live\" role=\"status\" aria-live=\"polite\" style=\"position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)\"></div>'",true);
// 5r. 중단의 정리 대기 상태를 따라가는 중 화면에 표시
rep("'\">'+(on?'따라가는 중':'중단됨')+'</span></div></div>'","'\">'+(on?(c2.winding?'정리 대기':'따라가는 중'):'중단됨')+'</span></div></div>'",true);
rep("    +(on?'<button type=\"button\" class=\"obtn\" onclick=\"cpAdjDlg(\\''+cid+'\\')\">예산 조정</button>'","    +(on&&c2.winding?mkWindActs(cid):on?'<button type=\"button\" class=\"obtn\" onclick=\"cpAdjDlg(\\''+cid+'\\')\">예산 조정</button>'",true);
rep("      +(on?'<div class=\"cpd-acts\"><button type=\"button\" class=\"wbtn\" onclick=\"cpDetailGo(\\''+c2.id+'\\')\">상세</button>'","      +(on&&c2.winding?'<div class=\"cpd-acts\"><button type=\"button\" class=\"wbtn\" onclick=\"cpDetailGo(\\''+c2.id+'\\')\">상세</button>'+mkWindActs(c2.id)+'</div>':on?'<div class=\"cpd-acts\"><button type=\"button\" class=\"wbtn\" onclick=\"cpDetailGo(\\''+c2.id+'\\')\">상세</button>'",true);
// 5s. 전략 따라하기 상단 소개 영역(제목, 공지, 배너)을 없앤다
rep("  gContent('<div class=\"tf-page tfbk ss3 mk\">'\n    +mkHero()\n    +tabs+controls+body","  gContent('<div class=\"tf-page tfbk ss3 mk\">'\n    +tabs+controls+body",true);
// 5t. 활동 탭 삭제, 그래프 이름(수익금, 잔고)
rep("  var TABS=[['ov','개요'],['perf','성과'],['trades','거래'],['log','활동'],['info','정보']];","  var TABS=[['ov','개요'],['info','정보']];",true);
rep("aria-label=\"'+({ret:'수익률',pnl:'번 돈',bal:'든 돈'}[MKD.tab])+' 그래프\"","aria-label=\"'+({ret:'수익률',pnl:'수익금',bal:'잔고'}[MKD.tab])+' 그래프\"",true);
rep("MKD.tab==='pnl'?'번 돈 '+(p.y>=0?'+':'-')+Math.abs(Math.round(p.y)).toLocaleString()+' USDT':'든 돈 '+Math.round(p.y).toLocaleString()+' USDT';","MKD.tab==='pnl'?'수익금 '+(p.y>=0?'+':'-')+Math.abs(Math.round(p.y)).toLocaleString()+' USDT':'잔고 '+Math.round(p.y).toLocaleString()+' USDT';",true);
// 5u. 주소의 기간 값에 30일, 7일
rep("(all|1y|2y))?(?:","(all|1y|2y|30d|7d))?(?:",true);
// 5v. 달력의 월 요약에서 시뮬레이션 문구를 뺀다
rep("+'%':'')+', 검증 시뮬레이션</span></div>'","+'%':'')+'</span></div>'",true);
// 5w. 달력의 월 요약: 세는 것은 끝난 거래다
rep("'%, 체결 '+trM.length+'회'","'%, 끝난 거래 '+trM.length+'회'",true);
// 5x. 달력 머리: 달의 승률은 보이지 않는다(승률은 성과 줄의 전체 기간 값 하나만). 이름은 그 달 수익률
rep("'회'+(trM.length?', 승률 '","'회'+(false&&trM.length?', 승률 '",true);
rep("<span class=\"mt2\">월 합산 '+(mtot>=0","<span class=\"mt2\">'+(mo+1)+'월 수익률 '+(mtot>=0",true);
// 5y. 따라가기의 입출금 표: 날짜 형식을 거래내역과 같게
rep("new Date(e.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})","mkDT(e.at)",true);
rep("new Date(c2.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})","mkDT(c2.at)",true);
// 5z. 백테스트 여정의 주소(#/share/bt/<id>)를 라우터에 잇는다
rep("  if(h.indexOf('#/share/s/')===0){ tfSS3Route(h); return; }","  if(h.indexOf('#/share/bt/')===0){ TF_ONNF=false; btRoute(h); return; } /* 백테스트 여정 */\n  if(h.indexOf('#/share/s/')===0){ tfSS3Route(h); return; }",true);
if(!t.includes('share\\/(s|t|copy|c|bt)')){ const n0=t.split('share\\/(s|t|copy|c)').length-1; if(n0<2) throw new Error('route regex '+n0); t=t.split('share\\/(s|t|copy|c)').join('share\\/(s|t|copy|c|bt)'); }
// 6. rd 블록이 선언하는 함수의 옛 정의를 지운다(정의는 하나만 남긴다)
const core=fs.readFileSync(D+'agent-core.js','utf8')+'\n'+fs.readFileSync(D+'fut-core.js','utf8')+'\n'+fs.readFileSync(D+'fut-ui.js','utf8')+'\n'+fs.readFileSync(D+'rd-ui.js','utf8');
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
// 8. 백테스트 여정: 코드와 스타일을 따로 둔다
function blockAfter(tag,body,after){ const B='/*'+tag+'_BEGIN*/', E='/*'+tag+'_END*/', i=t.indexOf(B), j=t.indexOf(E); const txt=B+'\r\n'+nl(body).trim()+'\r\n'+E;
  if(i>=0&&j>i){ t=t.slice(0,i)+txt+t.slice(j+E.length); return; }
  const k=t.indexOf(after); if(k<0||t.indexOf(after,k+1)>=0) throw new Error('after '+tag); t=t.slice(0,k+after.length)+'\r\n'+txt+t.slice(k+after.length); }
blockAfter('BT_CORE',['bt-a.js','bt-b.js','bt-c.js','bt-go.js','ac.js','st.js','bt-v2.js','bt-fut.js','an.js','rv.js','p16.js'].map(f=>fs.readFileSync(D+f,'utf8')).join('\n'),'/*RD_CORE_END*/');
blockAfter('BT_CSS',fs.readFileSync(D+'bt.css','utf8'),'/*RD_CSS_END*/');
fs.writeFileSync(F,t); console.log('applied', t.length);
