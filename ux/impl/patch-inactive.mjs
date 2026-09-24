import fs from 'node:fs'; import vm from 'node:vm';
let s=fs.readFileSync('index.html','utf8'); const crlf=s.indexOf(String.fromCharCode(13,10))>=0; s=s.split(String.fromCharCode(13,10)).join(String.fromCharCode(10));
function rep(a,b,n){ if(!s.includes(a)) throw new Error('anchor missing: '+n); s=s.split(a).join(b); console.log('ok',n); }
// 1. 미활성 뷰: 대표 전략 모의 켜기 삭제, 공개 전략 골라보기가 1차, 직접 만들기 2차
rep(`      +'<button type="button" class="tx-lrow'+(activationCTA?'':' pri')+'" onclick="tfTradeInactiveLaunch()"><span class="tx-lrow-t"><b>대표 전략 모의로 켜보기</b><span>TETH 공식 예시 전략을 모의로 바로 실행해요. 연결이나 결제 없이.</span></span><span class="tx-arr" aria-hidden="true">→</span></button>'
      +'<button type="button" class="tx-lrow" onclick="gHome()"><span class="tx-lrow-t"><b>직접 만들기</b><span>원하는 전략을 한 문장으로 말하면 TETH가 만들고 검증해요.</span></span><span class="tx-arr" aria-hidden="true">→</span></button>'
      +'<button type="button" class="tx-lrow" onclick="tfShareHub(\\'find\\')"><span class="tx-lrow-t"><b>공개 전략 골라보기</b><span>다른 사용자의 검증된 전략을 내 예산으로 따라가요.</span></span><span class="tx-arr" aria-hidden="true">→</span></button>'`,
`      +'<button type="button" class="tx-lrow'+(activationCTA?'':' pri')+'" onclick="tfShareHub(\\'find\\')"><span class="tx-lrow-t"><b>공개 전략 골라보기</b><span>검증된 전략을 골라 내 예산으로 따라가요.</span></span><span class="tx-arr" aria-hidden="true">→</span></button>'
      +'<button type="button" class="tx-lrow" onclick="gHome()"><span class="tx-lrow-t"><b>직접 만들기</b><span>원하는 전략을 한 문장으로 말하면 TETH가 만들고 검증해요.</span></span><span class="tx-arr" aria-hidden="true">→</span></button>'`,'launcher');
// 2. 온보딩 2단계: 모의로 보기 → 전략 고르기
rep(`  var paperSeen=f.owned>0||!!t.txPaperAt||strat.some(function(x){ return x&&x.env==='paper'; });`,
    `  var pickSeen=f.owned>0||f.draft||!!(t.follows&&t.follows.length)||!!(t.cp&&t.cp.copies&&t.cp.copies.length);`,'pickSeen');
rep(`['모의로 보기',paperSeen]`,`['전략 고르기',pickSeen]`,'step label');
// 3. 무료 체험 카드 삭제 (비플랜). 플랜 청구 카드는 유지
rep(`    var pct=f.freeQuota>0?Math.round(f.freeLeft/f.freeQuota*100):0;
    free='<div class="tx-free"><div class="tx-free-hd"><span>무료 체험</span><b>'+(f.freeLeft>0?'이용 중':'다 썼어요')+'</b></div>'
      +'<p>'+(f.freeLeft>0?'만들기와 검증에 써요. 모의 실행은 횟수를 쓰지 않아요.':'거래소를 연결하거나 카드를 등록하면 계속 쓸 수 있어요.')+'</p></div>';`,
    `    free='';`,'free card');
// 4. derive: 문구 정리 + 기본 실행 CTA를 공개 전략 골라보기로
rep(`signed:'무료 체험 중이에요. 연결이나 결제 없이 만들고 검증할 수 있어요',`,`signed:'연결이나 결제 없이 만들고 검증할 수 있어요',`,'statusLine');
rep(`statusLine='무료 체험을 다 썼어요. 거래소를 연결하거나 카드를 등록하면 계속 쓸 수 있어요';`,`statusLine='무료로 쓸 수 있는 만큼 다 썼어요. 거래소를 연결하거나 카드를 등록하면 계속 쓸 수 있어요';`,'gate');
rep(`statusLine='무료 체험이 곧 끝나요. 중단 없이 쓰려면 거래소를 연결하거나 카드를 등록하세요';`,`statusLine='무료로 쓸 수 있는 분량이 곧 끝나요. 중단 없이 쓰려면 거래소를 연결하거나 카드를 등록하세요';`,'near');
rep(`(plan?'':(freeLeft>0?', 무료 체험 중':''))`,`''`,'display free');
rep(`{label:'대표 전략 모의로 켜보기',action:'tfXLaunchDemo()'}`,`{label:'공개 전략 골라보기',action:"tfShareHub('find')"}`,'exec cta');
rep(`signed:['대표 전략 모의로 켜보기','₩0, 무료 체험','무료 N회','미연결','inactive','#/trade, 이용 현황'],`,`signed:['공개 전략 골라보기','₩0','가능','미연결','inactive','#/trade, 이용 현황'],`,'qa expect');
rep(`'linked-zero':['이 전략 실행하기 / 모의로 켜보기'`,`'linked-zero':['이 전략 실행하기 / 공개 전략 골라보기'`,'qa expect 3');
if(crlf) s=s.split(String.fromCharCode(10)).join(String.fromCharCode(13,10)); fs.writeFileSync('index.html',s);
const re=/<script>([\s\S]*?)<\/script>/g;let m,i=0;while((m=re.exec(s))){i++;try{new vm.Script(m[1],{filename:'s'+i});console.log('syntax ok',i)}catch(e){console.log('SYNTAX ERR',i,e.message)}}
