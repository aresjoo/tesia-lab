// 채팅 기본 경로(도구, 사고 포함)를 실제로 불러 본다. 사용: node server/probe-chat.mjs [url]
const U=(process.argv[2]||'https://teth-ai-proxy.teth-aresjoo.workers.dev')+'/api/chat';
for(const [name,body] of [['main',{messages:[{role:'user',content:'gdgd'}]}],['plain',{plain:true,messages:[{role:'user',content:'한 단어로 답하십시오: 안녕'}]}]]){
  const t0=Date.now(); let r, txt='';
  try{ r=await fetch(U,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://aresjoo.github.io'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)}); txt=await r.text(); }catch(e){ console.log(name,'FETCH ERR',String(e)); continue; }
  const ev=txt.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim());
  const text=ev.map(x=>{ try{ return JSON.parse(x).text||''; }catch(e){ return ''; } }).join('');
  const other=ev.filter(x=>!/^\{"text"/.test(x)).slice(0,8);
  console.log(name,'HTTP',r.status,(Date.now()-t0)+'ms','ctype',r.headers.get('content-type'));
  console.log('  text:',text.slice(0,300));
  console.log('  other events:',JSON.stringify(other).slice(0,900));
  if(!ev.length) console.log('  raw:',txt.slice(0,600));
}
