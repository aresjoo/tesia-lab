// 파운더 지시 묶음: 판단 방식 이름, 수익금과 잔고, 기간, 성과 탭 정리, 활동 탭 삭제, 정보 탭, 지표 설명, 대화(시각, 전문 용어, 평서문, 낱말 설명)
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,70)); return s.replace(x,()=>y); };
const cutFn=(s,name)=>{ const i=s.indexOf('function '+name+'('); if(i<0) throw new Error('fn '+name); let k=s.indexOf('{',i), d=0, q=null; for(;k<s.length;k++){ const ch=s[k]; if(q){ if(ch==='\\'){ k++; continue; } if(ch===q) q=null; continue; } if(ch==="'"||ch==='"'||ch==='`'){ q=ch; continue; } if(ch==='/'&&s[k+1]==='*'){ k=s.indexOf('*/',k)+1; continue; } if(ch==='{') d++; else if(ch==='}'){ d--; if(d===0) break; } } return s.slice(0,i)+s.slice(k+1); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
// 1. 대화 부분을 새 파일로
{ const i=s.indexOf('/* ── 개요의 대화:'); if(i<0) throw new Error('chat'); s=s.slice(0,s.lastIndexOf('\n',i)); }
// 2. 판단 방식 이름
s=one(s,"var MK_KIND={agent:'직접 탐색',rule:'조건 실행',mix:'혼합'};","var MK_KIND={agent:'AI 판단',rule:'차트 규칙',mix:'AI+규칙'};");
s=s.split("||'조건 실행')").join("||'차트 규칙')");
s=one(s,"[['all','전체'],['agent','직접 탐색'],['rule','조건 실행'],['mix','혼합']]","[['all','전체'],['agent','AI 판단'],['rule','차트 규칙'],['mix','AI+규칙']]");
s=one(s,"all:'직접 탐색은 AI가 종목을 고르고, 조건 실행은 정해 둔 조건만 따르고, 혼합은 둘이 나눠 맡아요.'","all:'AI 판단은 AI가 종목과 비중을 정하고, 차트 규칙은 정해 둔 가격 조건만 따르고, AI+규칙은 AI가 종목을 고르고 규칙이 시점을 정해요.'");
// 3. 옛 정의를 지우고 새 정의로
for(const f of ['tfSS3PdCalc','mkPerfTab','mkTradesTab','mkInfoTab']) s=cutFn(s,f);
// 4. 개요: 지표 이름에 설명, 거래소에 설명
s=one(s,"    +'<div class=\"mk3-kpis num\"><div><small>30일 수익률</small><b class=\"'+mkSign(m30.ret).trim()+'\">'+mkPct0(m30.ret)+'</b></div><div><small>최대 낙폭</small><b>'+R0.mdd.toFixed(1)+'%</b></div><div><small>승률</small><b>'+w+'</b></div><div><small>거래 수</small><b>'+Number(R0.n||0).toLocaleString()+'회</b></div></div>'",
        "    +mkKpi4('mk3-kpis num','',['30일 수익률','ret30',mkPct0(m30.ret),mkSign(m30.ret)],['최대 낙폭','mdd',R0.mdd.toFixed(1)+'%'],['승률','win',w],['거래 수','n',Number(R0.n||0).toLocaleString()+'회'])");
s=one(s,"<span class=\"mk3-dh-meta\"><span class=\"mk-xtag\"><img src=\"assets/logos/'+ex[0]+'.png\" alt=\"\" width=\"16\" height=\"16\">'+ex[1]+'</span>","<span class=\"mk3-dh-meta\"><span class=\"mk-xtag\"><img src=\"assets/logos/'+ex[0]+'.png\" alt=\"\" width=\"16\" height=\"16\">'+mkdTerm(ex[1],MK_TIP.ex)+'</span>");
s+=fs.readFileSync(D+'c17.js','utf8')+fs.readFileSync(D+'chat.js','utf8')+fs.readFileSync(D+'chat-ui.js','utf8');
fs.writeFileSync(D+'rd-ui.js',s);
let c=fs.readFileSync(D+'rd.css','utf8'); const k=c.indexOf('/* 개요의 대화 */'); if(k<0) throw new Error('css');
c=c.slice(0,c.lastIndexOf('\n',k))+fs.readFileSync(D+'chat.css','utf8'); fs.writeFileSync(D+'rd.css',c);
// 5. 적용 스크립트: 활동 탭 삭제, 그래프의 번 돈과 든 돈
let a=fs.readFileSync(D+'apply2.cjs','utf8'); const m=a.indexOf('// 6. rd'); if(m<0||a.includes('// 5t.')) throw new Error('apply');
const J=JSON.stringify, reps=[
 ["  var TABS=[['ov','개요'],['perf','성과'],['trades','거래'],['log','활동'],['info','정보']];","  var TABS=[['ov','개요'],['perf','성과'],['trades','거래'],['info','정보']];"],
 ["tab=(tab&&MK_TAB_OK[tab])?tab:'ov';","tab=(tab&&MK_TAB_OK[tab]&&tab!=='log')?tab:'ov';"],
 ["aria-label=\"'+({ret:'수익률',pnl:'번 돈',bal:'든 돈'}[MKD.tab])+' 그래프\"","aria-label=\"'+({ret:'수익률',pnl:'수익금',bal:'잔고'}[MKD.tab])+' 그래프\""],
 ["MKD.tab==='pnl'?'번 돈 '+(p.y>=0?'+':'-')+Math.abs(Math.round(p.y)).toLocaleString()+' USDT':'든 돈 '+Math.round(p.y).toLocaleString()+' USDT';","MKD.tab==='pnl'?'수익금 '+(p.y>=0?'+':'-')+Math.abs(Math.round(p.y)).toLocaleString()+' USDT':'잔고 '+Math.round(p.y).toLocaleString()+' USDT';"]
];
a=a.slice(0,m)+'// 5t. 활동 탭 삭제, 그래프 이름(수익금, 잔고)\n'+reps.map(r=>'rep('+J(r[0])+','+J(r[1])+',true);').join('\n')+'\n'+a.slice(m);
fs.writeFileSync(D+'apply2.cjs',a);
console.log('ok');
