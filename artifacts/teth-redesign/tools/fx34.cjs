// AI 지시문: 면책, 과거 성과 경고 문장 금지 한 줄 추가
const fs=require('fs');
const f='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(f,'utf8');
const anchor="합리적으로 채워 STRATEGY 로 바로 만든다.'";
const n=s.split(anchor).length-1; if(n!==1) throw new Error('count '+n);
s=s.replace(anchor,anchor+"\n   +'\\n면책 금지: \"과거 성과일 뿐\", \"수익을 보장하지 않는다\", \"투자 권유가 아니다\" 같은 면책이나 경고 문장, 경고 상자를 쓰지 마라. 사실과 조건만 말한다.'");
fs.writeFileSync(f,s); console.log('ok');
