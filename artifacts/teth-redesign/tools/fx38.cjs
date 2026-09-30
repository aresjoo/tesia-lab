// 사이드바 로고(인라인 데이터)와 TETH 글자를 Bitget 청록으로
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
let s=fs.readFileSync(R+'index.html','utf8');
const a=s.indexOf('--logo-uri:url("data:image/png;base64,'); if(a<0) throw new Error('no logo-uri');
const st=a+'--logo-uri:url("'.length, en=s.indexOf('")',st);
const b64=fs.readFileSync(R+'assets/logo-sm.png').toString('base64');
s=s.slice(0,st)+'data:image/png;base64,'+b64+s.slice(en);
const rep=(x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('count '+n+' '+x); s=s.replace(x,y); };
rep('#g-brand-row .g-word{font-size:16px;font-weight:600;color:var(--gt);','#g-brand-row .g-word{font-size:16px;font-weight:600;color:#00f0ff;');
fs.writeFileSync(R+'index.html',s); console.log('index ok');
for(const f of ['about/index.html','policies/index.html','download/index.html']){
  let t=fs.readFileSync(R+f,'utf8'); const x='<a class="brand" href="../">'; const n=t.split(x).length-1; if(n<1) throw new Error(f+' no brand');
  t=t.split(x).join('<a class="brand" href="../" style="color:#00f0ff">'); fs.writeFileSync(R+f,t); console.log(f,n);
}
