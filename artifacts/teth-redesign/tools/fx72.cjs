// 홈 카드 그림 강조색 파랑 → 비트겟 시안(로고, 푸터와 같은 #00f0ff), AI 패널 생각 문장은 지금 상태로 계산, 질문 단추 스크롤바 숨김
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let h=fs.readFileSync(F,'utf8');
const a="var AC='#5b8af7', LN='rgba(255,255,255,.72)'";
if(!h.includes(a)) throw new Error('miss AC');
h=h.replace(a,"var AC='#00f0ff', LN='rgba(255,255,255,.72)'");
fs.writeFileSync(F,h);
let j=fs.readFileSync('sk-brain2.js','utf8');
const b="var now=msgs.filter(function(m){ return m.k==='now'; })[0];";
if(!j.includes(b)) throw new Error('miss now');
/* 미리 써 둔 문장은 다른 날짜 기준이라 보유 종목과 어긋날 수 있다. 터미널은 지금 상태로 계산한 문장을 쓴다 */
j=j.replace(b,"var now=null; try{ var nt=mkChatNow(s2,s2.r); if(nt) now={t:nt}; }catch(e){} if(!now) now=msgs.filter(function(m){ return m.k==='now'; })[0];");
fs.writeFileSync('sk-brain2.js',j);
fs.appendFileSync('sk-brain.css',`
/* 질문 단추 줄: 스크롤바 숨김(클래스가 chips 가 아닌 경우까지) */
.tft-page .tft-comp>div{scrollbar-width:none}
.tft-page .tft-comp>div::-webkit-scrollbar{display:none;height:0}
`);
console.log('ok');
