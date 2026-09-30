// 사이드바 아래 톱니와 프로필: 예전 팝업 메뉴가 뜨고, 그 안의 "설정"만 설정 페이지로 간다. 실제 마우스로 판정
// 사용: node qa/16-fixes/rail-check.mjs [url]
import { newPage, closePage, goto, evala, viewport, shot, sleep, click, move } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const DIR=decodeURIComponent(new URL('./rail/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); })`);
const pos=async(sel)=>J(`(function(){ var b=document.querySelector('${sel}'); if(!b) return null; var r=b.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:r.width}; })()`);
const press=async(sel,wait)=>{ const c=await pos(sel); if(!c||!c.w) return false; await move(p,c.x,c.y); await sleep(200); await click(p,c.x,c.y); await sleep(wait||700); return true; };
const GEAR='#g-gear-btn', PROF='#g-person-row .g-ico-btn', ITEM='#gm-set-item';
const st=`{hash:location.hash,mode:G.mode,tab:(document.querySelector('.stg-ni.on')||{innerText:''}).innerText.trim(),menu:!document.getElementById('g-setmenu').hidden,items:[].map.call(document.querySelectorAll('#g-setmenu > .gm-item:not([hidden])'),function(x){ return x.innerText.trim().split('\\n')[0]; }),sub:!!document.querySelector('#gm-sub-set.on'),auth:(function(){ var m=document.getElementById('modal-auth'); return !!m&&(m.classList.contains('open')||m.classList.contains('on')); })()}`;
const reset=async()=>{ await ev(`try{ gSetMenuClose(); }catch(e){} try{ closeModal('modal-auth'); }catch(e){}`); await sleep(400); };

// 손님: 팝업이 뜨고, 설정은 하위 메뉴(언어, 화면)
await press(GEAR); let s=await J(st); ok('손님: 톱니 → 팝업 메뉴',s.menu&&s.items[0]==='설정',s.items);
await ev(`(function(){ var i=document.getElementById('gm-set-item'); window.__hov=!!i&&getComputedStyle(i).cursor!==''; i.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); })()`); await sleep(400); s=await J(st); ok('손님: 설정에 올려도 언어 하위 메뉴가 없다',!s.sub&&(await ev(`!!document.querySelector('#gm-sub-set')`))===false,{sub:s.sub});
await press(ITEM); s=await J(st); ok('손님: 팝업의 설정 → 로그인 창',s.auth&&!s.menu,{auth:s.auth});
await shot(p,DIR+'guest-menu.png',{full:false}); await reset();
await press(PROF); s=await J(st); ok('손님: 프로필 → 로그인 창',s.auth); await reset();

// 회원: 팝업이 예전대로 뜨고, 설정 항목만 설정 페이지로
await ev(`tfQaPreset('02')`); await sleep(1400);
const pages=[['홈',`gHome()`],['전략 복사',`tfShareHub()`],['전략 상세',`tfSS3Go('f1','all','ov')`],['AI 트레이딩',`location.hash='#/trade'`],['인사이트',`location.hash='#/insight'`],['백테스트',`location.hash='#/share/bt/f1'`],['거래소 연결',`tfBrokersView()`]];
for(const [name,go] of pages){
  await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(500); await ev(go); await sleep(2000);
  const from=(await J(st)).mode;
  await press(GEAR); s=await J(st); ok('회원 '+name+'('+from+'): 톱니 → 팝업 메뉴',s.menu&&s.items.length>=5,s.items);
  const c0=await pos(ITEM); await move(p,c0.x,c0.y); await sleep(450); s=await J(`{sub:!!document.querySelector('#gm-sub-set'),spin:!!document.querySelector('#g-setmenu .acx-sp, #g-setmenu [style*=acSp]'),spd:(function(){ var e=document.querySelector('#g-setmenu .sp'); return e?getComputedStyle(e).animationName:'none'; })()}`); ok('회원 '+name+': 설정에 올려도 하위 메뉴 없음, 도는 표시 없음',!s.sub&&!s.spin&&s.spd==='none',s);
  const hadLogout=(await J(st)).items.indexOf('로그아웃')>=0;
  await press(ITEM,1100); s=await J(st); ok('회원 '+name+': 팝업의 설정 → 설정 페이지',s.mode==='tfset'&&s.hash==='#/settings/general'&&s.tab==='일반'&&!s.menu,{hash:s.hash,mode:s.mode,tab:s.tab,menu:s.menu,logout:hadLogout});
  await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(500); await ev(go); await sleep(2000);
  await press(PROF); s=await J(st); ok('회원 '+name+': 프로필 → 같은 팝업 메뉴',s.menu&&s.items.indexOf('로그아웃')>=0,s.items); await reset();
}
// 예전에 먹통이 되던 순서: 주소는 이미 설정인데 다른 화면이 그려진 상태
await ev(`history.replaceState(null,'','#/settings/general'); gHome()`); await sleep(700);
await press(GEAR); await press(ITEM,1100); s=await J(st); ok('주소가 이미 설정일 때도 설정 페이지가 그려진다',s.mode==='tfset'&&s.tab==='일반',s);
await press(GEAR); s=await J(st); ok('설정 페이지 안에서 톱니 → 팝업',s.menu,s.items); await shot(p,DIR+'user-menu.png',{full:false}); await reset();
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length, all=out.length; out.push('','TOTAL '+pass+' / '+all); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'rail-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
