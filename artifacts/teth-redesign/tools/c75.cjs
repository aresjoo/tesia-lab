// Round 1 수정: 무료 조건 문구, 통화 질문 예시, 예전 API 키 입력 제거, 상담 문구
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
function ed(f,L){ let s=fs.readFileSync(f,'utf8'); for(const [a,b,c] of L){ const n=s.split(a).length-1; if(n!==(c||1)) throw new Error(f+' anchor '+n+' :: '+a.slice(0,70)); s=s.split(a).join(b); } fs.writeFileSync(f,s); }
let s=fs.readFileSync(R+'index.html','utf8');
const i=s.indexOf('<details class="manual" id="cn-manual">'), j=s.indexOf('</details>',i);
if(i<0||j<0) throw new Error('manual'); s=s.slice(0,i)+s.slice(j+10);
fs.writeFileSync(R+'index.html',s);
ed(R+'index.html',[
 ["<div class=\"au-free\" id=\"au-free\">영원히 $0, 신용카드 필요 없음</div>","<div class=\"au-free\" id=\"au-free\">가입은 무료, 카드 등록 없음</div>"],
 ["<div class=\"fr\">영원히 $0 • 신용카드 필요 없음</div>","<div class=\"fr\">TETH 초대 계정은 이용료 무료, 카드 등록 없음</div>"],
 ["<span class=\"txh-note\">영원히 무료, 카드 등록 필요없음</span>","<span class=\"txh-note\">TETH 초대 계정은 이용료 무료, 카드 등록 없음</span>",2],
 ["{\"title\":\"가격 표시 통화는?\",\"multi\":false,\"options\":[{\"t\":\"USD (달러)\",\"d\":\"글로벌 표준\"},{\"t\":\"KRW (원화)\",\"d\":\"업비트 기준\"}]}","{\"title\":\"어느 기간을 보겠습니까?\",\"multi\":false,\"options\":[{\"t\":\"최근 3개월\",\"d\":\"단기 흐름\"},{\"t\":\"최근 1년\",\"d\":\"큰 흐름\"}]}"],
 ["$('api-key-input').addEventListener('input',function(){ this.classList.remove('err'); $('api-key-err').classList.remove('show'); });","if($('api-key-input')) $('api-key-input').addEventListener('input',function(){ this.classList.remove('err'); $('api-key-err').classList.remove('show'); });"],
 ["'auth.free':{ko:'무료로 시작, 카드 등록 없음'","'auth.free':{ko:'가입은 무료, 카드 등록 없음'"],
]);
let h=fs.readFileSync(R+'help-widget.js','utf8');
const a="'실시간 채팅은 곧 제공됩니다. support@teth.ai','Live chat coming soon. support@teth.ai'";
if(h.split(a).length!==2) throw new Error('help'); h=h.replace(a,"'상담원이 24시간 답합니다. support@teth.ai','Our team answers 24/7. support@teth.ai'"); fs.writeFileSync(R+'help-widget.js',h);
console.log('ok');
