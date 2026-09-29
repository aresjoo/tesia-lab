// R07: 금액 표시는 USD 하나. 안쪽 숫자(예전 원화 기준)는 그대로 두고 표시만 1,000으로 나눠 달러로 보여 준다
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
function run(file,L){ let s=fs.readFileSync(R+file,'utf8'); const out=[];
  for(const [a,b,cnt] of L){ const n=s.split(a).length-1; if(cnt==='any'?n<1:n!==(cnt||1)) throw new Error(file+' anchor '+n+' :: '+a.slice(0,80)); s=s.split(a).join(b); out.push(n); }
  return [s,out]; }
const [idx,o1]=run('index.html',[
 ["function tfWon(n){ return '₩'+Math.round(n).toLocaleString(); }","function tfWon(n){ return '$'+Math.round((+n||0)/1000).toLocaleString(); }"],
 ["function tfTxWon(n){ return '₩'+Math.round(n).toLocaleString(); }","function tfTxWon(n){ return '$'+Math.round((+n||0)/1000).toLocaleString(); }"],
 ["function tfTmWon(n){ return (n<0?'-':'')+'₩'+Math.round(Math.abs(n)).toLocaleString(); }","function tfTmWon(n){ return (n<0?'-':'')+'$'+Math.round(Math.abs(n)/1000).toLocaleString(); }"],
 ["function tfTmWonS(n){ return (n>=0?'+':'-')+'₩'+Math.round(Math.abs(n)).toLocaleString(); }","function tfTmWonS(n){ return (n>=0?'+':'-')+'$'+Math.round(Math.abs(n)/1000).toLocaleString(); }"],
 ["  var W=function(n){ return '₩'+Math.round(n).toLocaleString(); };","  var W=function(n){ return '$'+Math.round(n/1000).toLocaleString(); };"],
 ["<b>₩'+Math.round(","<b>$'+Math.round(",'any'],
 ["'₩'+Math.round(tfSPx(s)[t2.entry]).toLocaleString(),'전량 체결 (시뮬레이션)'","'$'+Math.round(tfSPx(s)[t2.entry]).toLocaleString(),'전량 체결'"],
 ["'₩'+Math.round(xp).toLocaleString(),({sl:'손절 규칙가',tp:'익절 규칙가',time:'종가'}[t2.kind]||'')+' 기준 (시뮬레이션)'","'$'+Math.round(xp).toLocaleString(),({sl:'손절 규칙가',tp:'익절 규칙가',time:'종가'}[t2.kind]||'')+' 기준'"],
 ["₩ 환산, 검증 구간 기준","USD 기준, 검증 구간"],
 ["n.title.match(/\\+₩([\\d,]+)/)","n.title.match(/\\+\\$([\\d,]+)/)",2],
 ["<span class=\"mv up\">+₩'+m2[1]","<span class=\"mv up\">+$'+m2[1]",2],
 ["<span id=\"nfx-rnum\">₩'+total.toLocaleString()","<span id=\"nfx-rnum\">'+tfWon(total)+'"],
 ["promo:'이용 시 영원히 TETH 이용료 ₩0'","promo:'TETH 초대 계정은 이용료 $0'",'any'],
 ["else line='이번 달 청구 ₩0'","else line='이번 달 청구 $0'"],
 ["budget:{i:1,label:'500만원'}","budget:{i:1,label:'$5,000'}",3],
 ["('예산 '+Math.round(s.cap/10000)+'만원으로 바꿔줘')","('예산 '+Math.round(s.cap/1000).toLocaleString()+'달러로 바꿔줘')"],
 ["(m=msg.match(/([\\d,]+(?:\\.\\d+)?)\\s*(만원|만|원)?/))){\r\n    var n=parseFloat(m[1].replace(/,/g,'')); if(m[2]&&m[2].charAt(0)==='만') n*=10000;\r\n    if(!(n>=100000)) return box('예산은 10만원 이상으로','\"예산 500만원으로 바꿔줘\"처럼 말해주세요.');",
  "(m=msg.match(/\\$?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(달러|USD|usd)?/))){\r\n    var n=parseFloat(m[1].replace(/,/g,''))*1000; /* 안쪽 값은 예전 단위, 표시는 달러 */\r\n    if(!(n>=100000)) return box('예산은 $100 이상으로 정합니다','\"예산 5,000달러로 바꿔줘\"처럼 말해 주십시오.');"],
 // 예전 이용 현황 화면은 설정의 결제로 모은다
 ["  if(h.indexOf('#/settings')===0&&typeof stRoute==='function'){","  if(h==='#/plan'&&S.user&&typeof stRoute==='function'){ try{ history.replaceState(null,'','#/settings/billing'); }catch(e){} TF_ONNF=false; if(stRoute('#/settings/billing')) return; }\r\n  if(h.indexOf('#/settings')===0&&typeof stRoute==='function'){"],
]);
const [cp,o2]=run('teth-copy.js',[
 ["['100만원','가볍게 시작'], ['500만원','표준'], ['1,000만원','본격적으로'], ['3,000만원 이상','크게']","['$1,000','가볍게 시작'], ['$5,000','표준'], ['$10,000','본격적으로'], ['$30,000 이상','크게']"],
 ["name: '0원으로 시작', hero: '2분이면 1년에 500만원을 아낄 수 있어요'","name: '$0로 시작', hero: '2분이면 1년에 $3,360를 아낄 수 있습니다'"],
 ["새로 가입하고 연결하면 요금이 0원이에요","새로 가입하고 연결하면 이용료가 $0입니다"],
]);
fs.writeFileSync(R+'index.html',idx); fs.writeFileSync(R+'teth-copy.js',cp);
console.log('ok',o1.join(','),o2.join(','), (idx.match(/₩/g)||[]).length, (idx.match(/\r\n/g)||[]).length);
