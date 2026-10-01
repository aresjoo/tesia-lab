// 내 거래소 필터: 목록 함수에 거르기 한 줄, 켜졌을 때 반복 페이지 끄기. CSS, 빌드 목록, QA 상태
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let h=fs.readFileSync(F,'utf8');
const a="mkOldNames(s.id),MK_KIND[s.kind]||'',mkUni(s).list.join(' '),mkUni(s).list.map(mkTk).join(' '),mkTk(s.asset||'')].join(' ').toLowerCase().indexOf(q)>=0; }); }";
if(!h.includes(a)) throw new Error('miss q filter');
if(!h.includes('rows=tfMyExFilter(rows)')) h=h.replace(a,a+"\r\n  if(typeof tfMyExFilter==='function') rows=tfMyExFilter(rows);");
const b="var plain=(!t.ss.asset||t.ss.asset==='all')&&(!t.ss.kind||t.ss.kind==='all')&&!TF_SS_Q;";
if(!h.includes(b)) throw new Error('miss plain');
h=h.replace(b,"var plain=(!t.ss.asset||t.ss.asset==='all')&&(!t.ss.kind||t.ss.kind==='all')&&!TF_SS_Q&&!(typeof tfMyExOn==='function'&&tfMyExOn());");
fs.writeFileSync(F,h);
fs.appendFileSync('sk-main.css',`
/* 전략 목록 "내 거래소" 알약 */
.myex-w{position:relative;display:inline-flex}
.myex{height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:none;color:#cdcdcd;font:inherit;font-size:14px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap}
.myex:hover{color:#fff}
.myex.on{border:2px solid #9a9a9a;color:#fff;padding:0 15px}
.myex-ic{display:inline-flex}
.myex-ic .tb-ic{width:16px;height:16px;border-radius:4px;margin:0}
.myex-ic .tb-ic+.tb-ic{margin-left:-4px;box-shadow:0 0 0 2px #000}
.myex svg{width:14px;height:14px}
.myex-m{position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:220px;padding:6px;border-radius:16px;background:#2f2f2f;border:1px solid rgba(255,255,255,.1);box-shadow:0 12px 32px rgba(0,0,0,.5)}
.myex-m button{display:flex;align-items:center;gap:8px;width:100%;height:40px;padding:0 12px;border:0;border-radius:10px;background:none;color:#ececec;font:inherit;font-size:14px;text-align:left;cursor:pointer}
.myex-m button:hover{background:#3a3a3a}
.myex-m button.on{background:#3a3a3a;color:#fff}
.myex-m .tb-ic{width:16px;height:16px;border-radius:4px;margin:0}
.myex-note{margin:0 0 12px;font-size:14px;color:#cdcdcd}
.myex-empty{padding:40px 0;text-align:center;font-size:16px;color:#cdcdcd}
.myex-empty p{margin:0 0 10px}
.myex-empty .pl-link{font-size:14px}
`);
let a2=fs.readFileSync('apply2.cjs','utf8'); if(!a2.includes("'sk-myex.js'")){ a2=a2.replace("'sk-brain2.js','sk-cpx.js'","'sk-brain2.js','sk-myex.js','sk-cpx.js'"); fs.writeFileSync('apply2.cjs',a2); }
let q=fs.readFileSync('sk-qa.js','utf8');
const anc="  ['목록',function(){ qaAcct('free'); qaClean(); tfShareHub('find'); }],";
if(!q.includes(anc)) throw new Error('miss qa list');
if(!q.includes('목록(내 거래소 하나')) q=q.replace(anc,anc+"\n  ['목록(내 거래소 하나 연결)',function(){ qaAcct('uid'); qaClean(); tfShareHub('find'); }],\n  ['목록(내 거래소 둘 연결)',function(){ qaAcct('both'); try{ var a=acS(); a.conn.okx={via:'paid',at:Date.now(),uid:'77120011',kyc:'ok'}; acSave(); }catch(e){} qaClean(); tfShareHub('find'); }],");
fs.writeFileSync('sk-qa.js',q);
console.log('ok',fs.readFileSync('apply2.cjs','utf8').includes('sk-myex.js'));
