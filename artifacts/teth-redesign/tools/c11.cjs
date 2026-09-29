// 따라가는 사람: 앞에 사람 아이콘, 인원 구간별 색
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
s=one(s,"(fw?'<div class=\"mk3-fw num\">'+fw+'</div>':'')","(fw?mkFwHtml(s.fw):'')");
s+=`
/* 따라가는 사람 줄. 구간: 1,000명 이상, 500명 이상, 그 아래. 수익과 손실 색(초록, 빨강)과 버튼 색(라임)은 쓰지 않는다 */
function mkFwTier(n){ return n>=1000?'t3':n>=500?'t2':'t1'; }
function mkFwHtml(n){ n=+n||0; if(n<=0) return '';
  var num=n>=10000?'약 '+(Math.round(n/1000)/10)+'만':n.toLocaleString();
  return '<div class="mk3-fw num '+mkFwTier(n)+'"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.5-3.3 3-5.4 6.2-5.4s5.7 2.1 6.2 5.4"/><path d="M15.2 4.9a3.4 3.4 0 0 1 0 6.3"/><path d="M17.6 14.4c2.1.6 3.4 2.4 3.7 5.1"/></svg><span><b>'+num+'명</b>이 따라가는 중</span></div>'; }
`;
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',`
/* 따라가는 사람: 아이콘과 인원 구간별 색 */
#g-root .mk3v2 .mk3-facts .mk3-fw{display:flex;align-items:center;gap:6px;font-size:13px;color:#aeb3ba}
#g-root .mk3v2 .mk3-fw svg{flex:none;display:block}
#g-root .mk3v2 .mk3-fw b{font-weight:700}
#g-root .mk3v2 .mk3-fw.t1 b{color:#e3e5e8}
#g-root .mk3v2 .mk3-fw.t2{color:#8fb8ff}
#g-root .mk3v2 .mk3-fw.t2 b{color:#8fb8ff}
#g-root .mk3v2 .mk3-fw.t3{color:#f2b94b}
#g-root .mk3v2 .mk3-fw.t3 b{color:#f2b94b}
`);
console.log('ok');
