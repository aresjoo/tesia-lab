// 앱과 비슷한 요청(긴 시스템 지시문)으로 채팅 기본 경로를 여러 번 부른다
const U='https://teth-ai-proxy.teth-aresjoo.workers.dev/api/chat';
const sys='너는 TETH, 최고 수준의 시니어 금융 리서치 AI다. 한국어 합니다체로 답한다. '.repeat(Number(process.argv[2]||60));
for(let k=0;k<Number(process.argv[3]||3);k++){
  const t0=Date.now(); const r=await fetch(U,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://aresjoo.github.io'},body:JSON.stringify({system:sys,messages:[{role:'user',content:'gdgd'}]})});
  const t=await r.text(); const err=/"error":true/.test(t), txt=t.split('\n').filter(l=>l.startsWith('data:')).map(l=>{ try{ return JSON.parse(l.slice(5)).text||''; }catch(e){ return ''; } }).join('');
  console.log('try',k,'sysLen',sys.length,'HTTP',r.status,(Date.now()-t0)+'ms',err?'ERROR':'ok',txt.slice(0,80).replace(/\n/g,' '));
}
