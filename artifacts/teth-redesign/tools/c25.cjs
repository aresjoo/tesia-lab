// 개요, 성과, 거래를 한 페이지로. 탭은 개요와 정보. 거래내역은 주문 한 건씩, 전체는 따로 연다
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
const cutFn=(s,name)=>{ const i=s.indexOf('function '+name+'('); if(i<0) throw new Error('fn '+name); let k=s.indexOf('{',i), d=0, q=null; for(;k<s.length;k++){ const ch=s[k]; if(q){ if(ch==='\\'){ k++; continue; } if(ch===q) q=null; continue; } if(ch==="'"||ch==='"'||ch==='`'){ q=ch; continue; } if(ch==='/'&&s[k+1]==='*'){ k=s.indexOf('*/',k)+1; continue; } if(ch==='{') d++; else if(ch==='}'){ d--; if(d===0) break; } } return s.slice(0,i)+s.slice(k+1); };
// 1. 엔진: 지금 들고 있는 종목에도 수량과 넣은 금액을 남긴다(계산 결과는 그대로)
let a=fs.readFileSync(D+'agent-core.js','utf8');
a=one(a,"return {k:p.k,tid:p.id,entry:p.ei,ep:p.ep,px:v,","return {k:p.k,tid:p.id,entry:p.ei,ep:p.ep,units:p.units,cost:p.cost,px:v,");
a=one(a,"open:o?{k:o.k,tid:o.id,entry:o.ei,ep:o.ep,px:px(o.k),","open:o?{k:o.k,tid:o.id,entry:o.ei,ep:o.ep,units:o.units,cost:o.cost,px:px(o.k),");
fs.writeFileSync(D+'agent-core.js',a);
// 2. 화면
let s=fs.readFileSync(D+'rd-ui.js','utf8');
for(const f of ['mkOvTab','mkTradesTab','mkPerfTab']) s=cutFn(s,f);
s=one(s,"MK_TAB_OK={ov:1,perf:1,trades:1,info:1}; /* 활동 탭은 없앴다. 옛 주소는 개요로 */\n","");
const i=s.indexOf('/* ── 개요의 대화:'); if(i<0) throw new Error('chat block');
const j=s.lastIndexOf('\n',i);
s=s.slice(0,j)+fs.readFileSync(D+'c25.js','utf8')+s.slice(j);
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',`
/* 한 페이지 상세: 달력, 거래내역 */
.mk3-cal{margin-top:28px}
.mko{margin-top:44px}
.mko-go{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
.mko-go:hover{color:#fff}
.mko-go:hover svg{transform:translateX(2px)}
.mko-go svg{transition:transform .12s ease}
.mko-go:focus-visible{outline:2px solid #fff;outline-offset:4px;border-radius:4px}
.mko-n{font-size:12px;color:var(--gt3)}
#g-root .mko-tbl th.r,#g-root .mko-tbl td.r{text-align:right}
#g-root .mko-tbl td{padding-top:16px;padding-bottom:16px;white-space:nowrap}
#g-root .mko-tbl td b{font-weight:600;color:#f2f3f5}
.mko-s{display:inline-block;width:16px;font-weight:700}
.mko-tbl tr.in .mko-s{color:#2ebd85}
.mko-tbl tr.out .mko-s{color:#f0566a}
.mko-tbl small{font-size:12px;color:var(--gt3)}
.mko-tbl small.up{color:#2ebd85}
.mko-tbl small.dn{color:#f0566a}
.mko-e{text-align:center;color:var(--gt3);padding:28px 0}
.mko-back{display:inline-block;margin:0 0 18px}
.mko-more{margin-left:0}
`);
// 3. 탭 줄: 개요와 정보. index 와 적용 스크립트의 같은 문자열을 함께 고친다
const T4="  var TABS=[['ov','개요'],['perf','성과'],['trades','거래'],['info','정보']];", T2="  var TABS=[['ov','개요'],['info','정보']];";
let t=fs.readFileSync(F,'utf8'); if(t.split(T4).length-1!==1) throw new Error('idx tabs'); t=t.replace(T4,T2); fs.writeFileSync(F,t);
let p=fs.readFileSync(D+'apply2.cjs','utf8'); const J=JSON.stringify(T4), J2=JSON.stringify(T2); if(p.split(J).length-1!==1) throw new Error('apply tabs'); p=p.replace(J,J2); fs.writeFileSync(D+'apply2.cjs',p);
console.log('ok');
