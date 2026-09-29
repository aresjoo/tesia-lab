// rd 블록을 index.html 에 넣는다(여러 번 실행해도 같은 결과). 사용: node apply2.cjs
const fs=require('fs'); const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html'; let t=fs.readFileSync(F,'utf8');
const nl=s=>s.replace(/\r?\n/g,'\r\n'), D=__dirname+'/';
function rep(a,b,opt){ a=nl(a); b=nl(b); const n=t.split(a).length-1; if(n!==1){ if(opt&&t.includes(b)) return; throw new Error('anchor x'+n+': '+a.slice(0,80)); } t=t.replace(a,()=>b); }
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
    `'+gEsc(mkTitle(s2))+'</div><div class="s num">'+(MK_KIND[s2.kind]||'조건 실행')+', '+gEsc(mkScope(s2))+', 시작 이후 <b class="'+(r.ret>=0?'mk-up':'mk-dn')+'">'+mkPct(r.ret)+'</b> ('+mkMonths(r)+'개월, 비용 반영)</div></div>'`,true);
// 5. 원본을 찾지 못한 따라가기는 0 으로 바꿔 보이지 않고 표시한다
rep("if(!s2||!s2.r.eq||s2.r.eq.length<32) return {inv:inv,pnlPct:0,total:0,realized:0,unreal:0,share:0,net:0,est:inv,avail:inv,posOpen:false};",
    "if(!s2||!s2.r.eq||s2.r.eq.length<32) return {inv:inv,pnlPct:0,total:0,realized:0,unreal:0,share:0,net:0,est:inv,avail:inv,posOpen:false,missing:!s2};",true);
// 5b. 따라가기 시트의 성과는 시작 이후 전체(목록에서 기간 선택을 없앴다)
rep("var cp=cpState(), cfg=cpCfg(), pd=mkPd(), r=tfSS3PdCalc(s2,pd), d=tfDerive();","var cp=cpState(), cfg=cpCfg(), pd='all', r=s2.r, d=tfDerive();",true);
// 5c. 가격 캐시는 설정까지 포함한 키로
rep("  if(MK_PXC[key]) return MK_PXC[key];\n  var c=(window.MK_PX_CFG||{})[key]; if(!c) return PRICE0;","  var c=(window.MK_PX_CFG||{})[key]; if(!c) return PRICE0;\n  var ck=key+'|'+c.join('/'); if(MK_PXC[ck]) return MK_PXC[ck];",true);
rep("  return (MK_PXC[key]=p);","  return (MK_PXC[ck]=p);",true);
// 5d. 저장과 중복 검사는 현재 이름 하나로(ID, 옛 이름으로 들어와도 같은 전략)
rep("  var s2=tfSSFind(nick); if(!s2||s2.me) return;\n  if(cpState().copies.some(","  var s2=tfSSFind(nick); if(!s2||s2.me) return;\n  nick=s2.nick; /* ID 나 옛 이름으로 들어와도 같은 전략으로 저장 */\n  if(cpState().copies.some(",true);
rep("  var t=tfS(); t.watch=t.watch||[];\n  var i=t.watch.indexOf(nick);","  var sW=tfSSFind(nick); if(sW&&!sW.me) nick=sW.nick;\n  var t=tfS(); t.watch=t.watch||[];\n  var i=t.watch.indexOf(nick);",true);
rep("  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\n  mkFollowClose(true); tfSS3DlgClose(true);","  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\n  nick=s2.nick; ne=tfSSNe(nick);\n  mkFollowClose(true); tfSS3DlgClose(true);",true);
// 5e. 원본을 찾지 못한 따라가기는 그렇다고 말한다
rep("    +'<div class=\"mk-acct\"><b>내 따라가기 계정</b>","    +(d.missing?'<div class=\"warn3\" style=\"margin:0 0 12px\">이전 목록의 전략이라 지금은 기록을 불러올 수 없어요. 넣은 금액은 그대로 보관돼요.</div>':'')\n    +'<div class=\"mk-acct\"><b>내 따라가기 계정</b>",true);
rep("<small>작성자 '+gEsc(c.nick)+', 내 따라가기 계정</small><span class=\"num\">운용 '+cpUsd(d.inv)+', 순손익 '+cpUsd(d.net)+'</span>","<small>'+(seed?(MK_KIND[seed.kind]||'조건 실행')+', ':'')+'내 따라가기 계정</small><span class=\"num\">'+(d.missing?'원본 전략을 찾을 수 없어요, 넣은 금액 '+cpUsd(d.inv):'운용 '+cpUsd(d.inv)+', 순손익 '+cpUsd(d.net))+'</span>",true);
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
