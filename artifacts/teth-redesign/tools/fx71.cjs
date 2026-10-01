// 판단 패널 AI 판단형/혼합형 + TETH의 생각: CSS, 빌드 목록, QA 상태
const fs=require('fs');
fs.appendFileSync('sk-brain.css',`
/* AI 판단형과 혼합형, TETH의 생각, 판단 기록(nof1 MODELCHAT 방식) */
.tft-page .tb-copy{display:flex;flex-direction:column;min-height:0;overflow-y:auto;height:100%}
.tft-page .tb-cps{display:flex;gap:6px;padding:14px 20px 0;overflow-x:auto;scrollbar-width:none}
.tft-page .tb-cps button{flex:none;height:32px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:none;color:#cdcdcd;font-size:13px}
.tft-page .tb-cps button.on{border:2px solid #9a9a9a;color:#fff;padding:0 13px}
.tft-page .tm-status.tb .tb-k{margin:0 0 6px;font-size:13px;color:#9a9a9a;display:flex;gap:8px;flex-wrap:wrap}
.tft-page .tm-status.tb .tb-k span{color:#6f6f6f}
.tft-page .tb-w2{color:#9a9a9a;margin-right:6px}
.tft-page .tb-th{padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.1)}
.tft-page .tb-thl{margin:0 0 6px;font-size:13px;color:#9a9a9a}
.tft-page .tb-tht{margin:0;font-size:14px;line-height:1.6;color:#ececec}
.tft-page .tb-mb{font-size:13px;color:#cdcdcd;margin-left:2px}
.tft-page .tb-feed{padding:12px 20px 4px}
.tft-page .tb-fh{margin:0 0 6px;font-size:16px;color:#fff}
.tft-page .tb-fc{border-top:1px solid rgba(255,255,255,.1)}
.tft-page .tb-fc:first-of-type{border-top:0}
.tft-page .tb-fc>summary{list-style:none;cursor:pointer;padding:10px 0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:baseline}
.tft-page .tb-fc>summary::-webkit-details-marker{display:none}
.tft-page .tb-ft{font-size:12px;color:#9a9a9a}
.tft-page .tb-fc b{font-size:13px;font-weight:400;color:#ececec;justify-self:end}
.tft-page .tb-fc b.tb-buy{color:#2ebd85}.tft-page .tb-fc b.tb-sell{color:#ececec}
.tft-page .tb-fs{grid-column:1/-1;font-size:14px;line-height:1.55;color:#cdcdcd}
.tft-page .tb-fr{margin:0 0 10px;font-size:14px;line-height:1.6;color:#9a9a9a}
.tft-page .tb-foot{display:flex;align-items:center;gap:16px;padding:12px 20px 18px}
.tft-page .tb-gray{height:36px;padding:0 16px;border:0;border-radius:999px;background:#2f2f2f;color:#ececec;font-size:14px;cursor:pointer}
`);
let a=fs.readFileSync('apply2.cjs','utf8'); if(!a.includes("'sk-brain2.js'")){ a=a.replace("'sk-brain.js','sk-cpx.js'","'sk-brain.js','sk-brain2.js','sk-cpx.js'"); fs.writeFileSync('apply2.cjs',a); }
let q=fs.readFileSync('sk-qa.js','utf8');
const anchor="  ['복사한 전략, 포지션 있음',function(){ qaAcct('uid'); qaCopyLive(); qaTerm(); }]";
if(!q.includes(anchor)) throw new Error('miss qa anchor');
if(!q.includes('복사한 AI 전략')) q=q.replace(anchor,anchor+",\n  ['복사한 AI 전략(여러 종목)',function(){ qaAcct('uid'); qaCopy({nick:'코인 셋 나눠 담기',back:60,amt:1200}); qaTerm(); }],\n  ['복사한 혼합 전략',function(){ qaAcct('uid'); qaCopy({nick:'대표 코인 돌파 따라가기',back:60,amt:900}); qaTerm(); }],\n  ['복사한 전략 둘(AI와 규칙)',function(){ qaAcct('uid'); qaCopy({nick:'코인 둘 롱숏 갈아타기',back:60,amt:1500}); qaCopyLive(); qaTerm(); }]");
fs.writeFileSync('sk-qa.js',q);
console.log('ok',fs.readFileSync('apply2.cjs','utf8').includes('sk-brain2.js'));
