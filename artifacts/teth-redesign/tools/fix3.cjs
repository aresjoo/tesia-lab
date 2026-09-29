const fs=require('fs'); let s=fs.readFileSync('apply.cjs','utf8');
function rep(a,b){ if(s.split(a).length!==2) throw new Error('anchor '+a.slice(0,50)); s=s.replace(a,()=>b); }
rep("',nA:'+q(c.A)+',nB:'+q(c.B)+',nC:'+q(c.C)+',one:'+q(c.one)+',ex:'+q(s.ex)+',av:'+q('t'+String(i+1).padStart(2,'0'))+',fw:'+FW[i];","',name:'+q(c.name)+',one:'+q(c.one)+',ex:'+q(s.ex)+',fw:'+FW[i];");
rep("f+=',asset:'+q(s.asset)+',sl:'+s.p.sl+',tp:'+s.p.tp+',rsiTh:'+s.p.rsiTh+',tf:'+(s.p.trendFilter?1:0)+',startI:'+s.p.startI;","f+=',asset:'+q(s.asset)+',rsiTh:'+s.p.rsiTh+',tp:'+s.p.tp+',sl:'+s.p.sl+',tf:'+(s.p.trendFilter?1:0)+',startI:'+s.p.startI;");
// 옛 정의 제거 + 따라가기 시트 + 찾지 못한 따라가기
rep("// 5. 코드 블록과 스타일",`// 4b. 따라가기 시트의 유형과 주체
rep("'+gEsc(mkTitle(s2))+' '+tfKindBadge('rule')+'</div><div class=\\"s num\\">작성자 '+gEsc(s2.nick)+', 검증 수익률 <b class=\\"'+(r.ret>=0?'mk-up':'mk-dn')+'\\">'+mkPct(r.ret)+'</b> ('+mkPdLabel(pd)+', 백테스트 '+mkMonths(r)+'개월, 수수료 반영)</div></div>'",
    "'+gEsc(mkTitle(s2))+'</div><div class=\\"s num\\">'+(MK_KIND[s2.kind]||'조건 실행')+', '+gEsc(mkScope(s2))+', 시작 이후 <b class=\\"'+(r.ret>=0?'mk-up':'mk-dn')+'\\">'+mkPct(r.ret)+'</b> ('+mkMonths(r)+'개월, 비용 반영)</div></div>'",true);
// 4c. 원본을 찾지 못한 따라가기는 0 으로 바꿔 보이지 않고 표시한다
rep("if(!s2||!s2.r.eq||s2.r.eq.length<32) return {inv:inv,pnlPct:0,total:0,realized:0,unreal:0,share:0,net:0,est:inv,avail:inv,posOpen:false};",
    "if(!s2||!s2.r.eq||s2.r.eq.length<32) return {inv:inv,pnlPct:0,total:0,realized:0,unreal:0,share:0,net:0,est:inv,avail:inv,posOpen:false,missing:!s2};",true);
// 4d. rd 블록이 다시 선언하는 함수의 옛 정의를 지운다(정의는 하나만)
{ const core=fs.readFileSync(D+'agent-core.js','utf8')+'\n'+fs.readFileSync(D+'rd-ui.js','utf8'); const names=[...core.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(m=>m[1]); const B=t.indexOf('/*RD_CORE_BEGIN*/'); let removed=[];
  for(const nm of names){ for(;;){ const lim=t.indexOf('/*RD_CORE_BEGIN*/'); const head='\nfunction '+nm+'('; const i=t.indexOf(head); if(i<0||(lim>=0&&i>lim)) break; let j=t.indexOf('{',i), d=0, k=j, inS=null; for(;k<t.length;k++){ const ch=t[k]; if(inS){ if(ch==='\\'){ k++; continue; } if(ch===inS) inS=null; continue; } if(ch==="'"||ch==='"'||ch==='\`'){ inS=ch; continue; } if(ch==='/'&&t[k+1]==='*'){ k=t.indexOf('*/',k)+1; continue; } if(ch==='{') d++; else if(ch==='}'){ d--; if(d===0) break; } } let e=k+1; while(t[e]===' '||t[e]==='\t') e++; if(t.slice(e,e+2)==='/*'){ const c2=t.indexOf('*/',e); if(c2>0&&t.slice(e,c2).indexOf('\n')<0) e=c2+2; } t=t.slice(0,i)+t.slice(e); removed.push(nm); } }
  console.log('removed old definitions:',removed.join(', ')||'none'); }
// 5. 코드 블록과 스타일`);
fs.writeFileSync('apply.cjs',s); console.log('apply patched');
