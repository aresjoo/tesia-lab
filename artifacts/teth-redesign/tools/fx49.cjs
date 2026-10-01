// 예약 주문: 프롬프트 규칙, [ORDER] 태그 파서와 카드 호출, 태그 제거 정규식
const fs=require('fs');
const f='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(f,'utf8');
const rep=(a,b,n)=>{ const c=s.split(a).length-1; if(c!==(n||1)) throw new Error('count '+c+' '+a.slice(0,60)); s=s.split(a).join(b); };
/* 1) 프롬프트 규칙: 전략 정보 확인 줄 뒤에 */
rep(`   +'\\n면책 금지: `,
`   +'\\n예약 주문: 사용자가 한 번만 하는 조건부 주문을 말하면(예: "비트코인 9만 달러 되면 팔아줘", "이더리움 3천 아래로 내려오면 사줘", "비트코인 10만 넘으면 숏 쳐줘") 전략이 아니라 예약 주문이다. 자산, 방향(buy 매수, sell 매도, long 롱, short 숏), 조건 가격(달러 또는 지금 대비 %), 수량(전부, 절반, 수치), 레버리지(롱이나 숏일 때만), 유효 기간 가운데 대화에서 알 수 없는 것만 [ASK]로 묻는다. 유효 기간은 사용자가 말하지 않았으면 반드시 묻는다(선택지: 취소할 때까지, 7일, 하루). 다 갖춰지면 본문은 "조건을 확인했습니다. 아래에서 예약합니다." 한 문장만 쓰고 마지막 줄에 [ORDER {"asset":"비트코인","side":"sell","trigger":90000,"triggerPct":null,"qty":"all","qtyNum":null,"lev":null,"ttl":"gtc"}] 태그를 붙여라. side 는 buy, sell, long, short 중 하나. trigger 는 달러 가격(모르면 null), triggerPct 는 지금 대비 %(가격 대신 %로 말했을 때), qty 는 all, half, num 중 하나이고 num 이면 qtyNum 에 수량, lev 는 배수 숫자(현물이면 null), ttl 은 gtc(취소할 때까지), 7d, 1d 중 하나. 반복되는 조건("오르면 팔고 또 떨어지면 사")이 섞이면 예약 주문이 아니라 전략(STRATEGY)로 다룬다. 이용료나 수수료 언급은 하지 마라. 이 태그를 붙이면 NEXT, ACT, SETUP, STRATEGY 는 붙이지 않는다.'
   +'\\n면책 금지: `);
/* 2) 파서 */
rep(`      var mSp=acc.match(/\\[STRATEGY\\s+(\\{[\\s\\S]*?\\})\\s*\\]/),spec=null; if(mSp){ try{ spec=JSON.parse(mSp[1]); }catch(e){} } if(spec) setup=null;`,
`      var mSp=acc.match(/\\[STRATEGY\\s+(\\{[\\s\\S]*?\\})\\s*\\]/),spec=null; if(mSp){ try{ spec=JSON.parse(mSp[1]); }catch(e){} } if(spec) setup=null;
      var mOr=acc.match(/\\[ORDER\\s+(\\{[\\s\\S]*?\\})\\s*\\]/),order=null; if(mOr){ try{ order=JSON.parse(mOr[1]); }catch(e){} } if(order){ setup=null; spec=null; } /* 예약 주문 카드 */`);
rep(`      if(spec&&live){ delay(info?1400:600,function(){ if(G.cur===sess) tfAiStrategy(spec); }); }`,
`      if(spec&&live){ delay(info?1400:600,function(){ if(G.cur===sess) tfAiStrategy(spec); }); }
      if(order&&live&&typeof tfOrderCard==='function'){ delay(info?1400:600,function(){ if(G.cur===sess) tfOrderCard(order); }); }`);
/* 3) 태그 제거 */
rep(`/\\[(?:CHART|SETUP|STRATEGY|GAUGE)\\s+\\{[\\s\\S]*?\\}\\s*\\]/g`, `/\\[(?:CHART|SETUP|STRATEGY|GAUGE|ORDER)\\s+\\{[\\s\\S]*?\\}\\s*\\]/g`);
rep(`/\\[(?:CHART|SETUP|STRATEGY|NEXT|ASK|TITLE|GAUGE|ACT|TLINE)/`, `/\\[(?:CHART|SETUP|STRATEGY|NEXT|ASK|TITLE|GAUGE|ACT|TLINE|ORDER)/`, 3);
rep(`/\\[(?:NEXT|ACT|TITLE|CHART|SETUP|GAUGE|ASK|TLINE)[\\s\\S]*$/`, `/\\[(?:NEXT|ACT|TITLE|CHART|SETUP|GAUGE|ASK|TLINE|ORDER)[\\s\\S]*$/`);
fs.writeFileSync(f,s); console.log('ok');
