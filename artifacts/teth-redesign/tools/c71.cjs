const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
ed(R+'index.html',[
  ["  window.TF_BK_RESUME=null; /* 거래소 상세 복귀 컨텍스트도 동일 규약","  if(typeof tfIntentClear==='function') tfIntentClear(); /* 하려던 일도 같은 규약: 인증 창을 연 쪽이 연 다음에 다시 적는다 */\r\n  window.TF_BK_RESUME=null; /* 거래소 상세 복귀 컨텍스트도 동일 규약"],
  ["  if(!S.user){ if(typeof tfIntentSet==='function') tfIntentSet({kind:'copy',id:ne,from:location.hash}); authOpen('signup'); return; }","  if(!S.user){ authOpen('signup'); if(typeof tfIntentSet==='function') tfIntentSet({kind:'copy',id:ne,from:location.hash}); return; }"],
]);
ed(D+'bt-c.js',[
  ["tfIntentSet({kind:'bt',id:ne,from:location.hash}); try{ tfTrack('bt_guest_gate',{id:ne}); }catch(e){} authOpen('signup'); return; }","authOpen('signup'); tfIntentSet({kind:'bt',id:ne,from:location.hash}); try{ tfTrack('bt_guest_gate',{id:ne}); }catch(e){} return; }"],
  ["tfIntentSet({kind:'bt',id:m[1]}); try{ history.replaceState(null,'','#/share/s/'+m[1]); }catch(e){} tfRoute(); setTimeout(function(){ if(!S.user) authOpen('signup'); },400); return; }","try{ history.replaceState(null,'','#/share/s/'+m[1]); }catch(e){} tfRoute(); var gid=m[1]; setTimeout(function(){ if(!S.user){ authOpen('signup'); tfIntentSet({kind:'bt',id:gid}); } },400); return; }"],
]);
console.log('ok');
