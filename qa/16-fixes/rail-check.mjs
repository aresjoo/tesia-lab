// 사이드바 아래쪽 설정(톱니)과 프로필 단추를 실제 마우스로 눌러 판정한다. 손님, 회원, 여러 화면에서
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
const pos=async(sel)=>J(`(function(){ var b=document.querySelector('${sel}'); var r=b.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; })()`);
const press=async(sel)=>{ const c=await pos(sel); await move(p,c.x,c.y); await sleep(200); await click(p,c.x,c.y); await sleep(1100); };
const GEAR='#g-gear-btn', PROF='#g-person-row .g-ico-btn';
const st=`{hash:location.hash,mode:G.mode,tab:(document.querySelector('.stg-ni.on')||{innerText:''}).innerText.trim(),menu:!document.getElementById('g-setmenu').hidden,auth:(function(){ var m=document.getElementById('modal-auth'); return !!m&&(m.classList.contains('open')||m.classList.contains('on')); })()}`;

// 손님
await press(GEAR); let s=await J(st); ok('손님: 톱니를 누르면 설정 메뉴가 열린다',s.menu,s); await ev(`gSetMenuClose()`); await sleep(400);
await press(PROF); s=await J(st); ok('손님: 프로필을 누르면 로그인 창',s.auth,s); await ev(`closeModal('modal-auth')`); await sleep(400);

// 회원
await ev(`tfQaPreset('02')`); await sleep(1400);
const pages=[['홈',`gHome()`],['전략 복사',`tfShareHub()`],['전략 상세',`tfSS3Go('f1','all','ov')`],['AI 트레이딩',`location.hash='#/trade'`],['인사이트',`location.hash='#/insight'`],['백테스트',`location.hash='#/share/bt/f1'`],['거래소 연결',`tfBrokersView()`]];
for(const [name,go] of pages){
  await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(500); await ev(go); await sleep(2000);
  const from=(await J(st)).mode;
  await press(GEAR); s=await J(st); ok('회원 '+name+'('+from+'): 톱니 → 설정 일반',s.mode==='tfset'&&s.hash==='#/settings/general'&&s.tab==='일반',s);
  await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(500); await ev(go); await sleep(2000);
  await press(PROF); s=await J(st); ok('회원 '+name+': 프로필 → 설정 계정',s.mode==='tfset'&&s.hash==='#/settings/account'&&s.tab==='계정',s);
}
// 예전에 먹통이 되던 순서: 주소는 설정인데 다른 화면이 그려진 상태에서 다시 누르기
await ev(`history.replaceState(null,'','#/settings/general'); gHome()`); await sleep(700);
await press(GEAR); s=await J(st); ok('주소가 이미 설정일 때 톱니 → 설정이 그려진다',s.mode==='tfset'&&s.tab==='일반',s);
await ev(`history.replaceState(null,'','#/settings/account'); gHome()`); await sleep(700);
await press(PROF); s=await J(st); ok('주소가 이미 계정일 때 프로필 → 계정이 그려진다',s.mode==='tfset'&&s.tab==='계정',s);
await press(GEAR); s=await J(st); ok('설정 화면 안에서 톱니 → 일반 탭',s.mode==='tfset'&&s.tab==='일반',s);
await shot(p,DIR+'user-after.png',{full:false});
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length, all=out.length; out.push('','TOTAL '+pass+' / '+all); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'rail-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
