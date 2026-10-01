// 소개 단계 카드 이미지를 2배 선명 캡처로 교체, 첫 화면 이미지 아래를 부드럽게 끊기, 세로 이미지(판단 패널) 배치
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/about/index.html';
let h=fs.readFileSync(F,'utf8');
const rep=(a,b)=>{ if(!h.includes(a)) throw new Error('miss '+a.slice(0,60)); h=h.replace(a,b); };
rep('<img src="../assets/shots/v2/about-plan.webp" width="1200" height="900"','<img src="../assets/shots/v2/about-plan2.webp" width="844" height="517"');
rep('<img src="../assets/shots/v2/about-backtest.webp" width="1200" height="900"','<img src="../assets/shots/v2/about-backtest2.webp" width="1216" height="700"');
rep('<div class="ab-shot"><img src="../assets/shots/v2/about-live.webp" width="1376" height="900" loading="lazy" alt="TETH 터미널 판단 패널">','<div class="ab-shot ab-tall"><img src="../assets/shots/v2/about-brain.webp" width="392" height="560" loading="lazy" alt="TETH 터미널 판단 패널">');
const CSS=`.ab-heroshot{-webkit-mask-image:linear-gradient(#000 78%,transparent);mask-image:linear-gradient(#000 78%,transparent);border-bottom:0}
.ab-tall{display:flex;justify-content:center;padding:28px 0 0;background:#141414;max-height:460px;-webkit-mask-image:linear-gradient(#000 80%,transparent);mask-image:linear-gradient(#000 80%,transparent)}
.ab-tall img{width:72%;max-width:392px;border-radius:14px 14px 0 0}
@media (max-width:860px){ .ab-tall{max-height:380px;padding-top:20px} .ab-tall img{width:84%} }
</style>`;
if(!h.includes('.ab-tall{')) h=h.replace(/(<style id="sk-sub">[\s\S]*?)<\/style>/,'$1'+CSS);
fs.writeFileSync(F,h); console.log('ok');
