// 로그인 창 아래 문구: "가입은 무료" → "영원히 무료, 카드 등록 없음" (파운더 2026-10-01). 본문 HTML과 다국어 사전 둘 다
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let h=fs.readFileSync(F,'utf8'), n=0;
const rep=(a,b)=>{ if(!h.includes(a)) throw new Error('miss '+a.slice(0,50)); h=h.split(a).join(b); n++; };
rep('<div class="au-free" id="au-free">가입은 무료, 카드 등록 없음</div>','<div class="au-free" id="au-free">영원히 무료, 카드 등록 없음</div>');
rep("'auth.free':{ko:'가입은 무료, 카드 등록 없음',en:'Free to start, no card needed',ja:'無料で始める、カード登録不要','zh-CN':'免费开始，无需绑卡','zh-TW':'免費開始，無需綁卡',es:'Empieza gratis, sin tarjeta',fr:'Commencez gratuitement, sans carte'}",
    "'auth.free':{ko:'영원히 무료, 카드 등록 없음',en:'Free forever, no card needed',ja:'ずっと無料、カード登録不要','zh-CN':'永久免费，无需绑卡','zh-TW':'永久免費，無需綁卡',es:'Gratis para siempre, sin tarjeta',fr:'Gratuit pour toujours, sans carte'}");
fs.writeFileSync(F,h); console.log('ok',n);
