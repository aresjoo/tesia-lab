// AI 트레이딩 소개: 실행 환경이 없는 회원도 손님과 같은 화면. 시작하기는 거래소 연결로
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(R,'utf8');
function ed(a,b){ if(s.split(a).length!==2) throw new Error(a.slice(0,60)); s=s.replace(a,()=>b); }
ed(`  var ctaAct=S.user?"tfNav('#/trade')":"authOpen('signup')", ctaLbl=S.user?'AI 트레이딩으로 돌아가기':'시작하기';`,
   `  var rdy=!!(S.user&&typeof acReady==='function'&&acReady(null)); /* 실행 환경이 갖춰진 회원만 "돌아가기" */\r\n  var ctaAct=rdy?"tfNav('#/trade')":(S.user?"acStart({after:{kind:'terminal'}})":"authOpen('signup')"), ctaLbl=rdy?'AI 트레이딩으로 돌아가기':'시작하기';`);
ed(`    +'<section class="txh-hero'+(S.user?' has-back':'')+'" aria-labelledby="txh-h">'\r\n    +(S.user?'<button type="button" class="txh-back" onclick="tfNav(\\'#/trade\\')">← AI 트레이딩으로 돌아가기</button>':'')`,
   `    +'<section class="txh-hero'+(rdy?' has-back':'')+'" aria-labelledby="txh-h">'\r\n    +(rdy?'<button type="button" class="txh-back" onclick="tfNav(\\'#/trade\\')">← AI 트레이딩으로 돌아가기</button>':'')`);
fs.writeFileSync(R,s); console.log('ok');
