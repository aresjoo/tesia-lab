// 판단 기록: 제목 옆 시간대 표기를 없애고, 시각은 보는 사람의 브라우저 시간대로 보여 준다
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let c=fs.readFileSync(D+'chat.js','utf8');
{ const i=c.indexOf('/* 판단 시각:'), j=c.indexOf('function mkSay('); if(i<0||j<i) throw new Error('ts');
  c=c.slice(0,i)+`/* 판단 시각: 기록의 실제 시점(가상자산은 UTC 0시, 미국 시장은 뉴욕 16시 = UTC 20시)을 보는 사람의 브라우저 시간대로 바꿔 보여 준다. 초는 기록마다 고정 */
function mkTS(s,i,a,salt){
  var cr=a?!!MK_CRYPTO[a]:(s.mkt==='crypto'||s.mkt==='multi'), d=idxToDate(i), h=0, k=String(s.id||s.nick)+'|'+i+'|'+(salt||0);
  for(var x=0;x<k.length;x++) h=(h*31+k.charCodeAt(x))>>>0;
  var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),cr?0:20,0,2+h%47)), now=new Date(Date.UTC(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2],20,0,0));
  var p=function(n){ return (n<10?'0':'')+n; };
  return (t.getFullYear()!==now.getFullYear()?t.getFullYear()+'/':'')+p(t.getMonth()+1)+'/'+p(t.getDate())+' '+p(t.getHours())+':'+p(t.getMinutes())+':'+p(t.getSeconds());
}
`+c.slice(j); }
fs.writeFileSync(D+'chat.js',c);
let u=fs.readFileSync(D+'chat-ui.js','utf8');
u=one(u,"의 판단 기록</h3><span class=\"mkc-tz\">한국 시각, 종가 판단</span></div>'","의 판단 기록</h3></div>'");
fs.writeFileSync(D+'chat-ui.js',u);
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const i=s.indexOf('/* ── 개요의 대화:'); if(i<0) throw new Error('chat block');
s=s.slice(0,s.lastIndexOf('\n',i))+c+u; fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
