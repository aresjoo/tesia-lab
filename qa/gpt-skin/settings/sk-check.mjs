// 설정(ChatGPT 어휘): 셸, 결제(구독 카드, 내역 3건, 관리 창), 보안(행마다 조작 하나), 모바일 목록 → 상세
// 사용: node qa/gpt-skin/settings/sk-check.mjs [url] [w] [h] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html', W=+(process.argv[3]||1440), H=+(process.argv[4]||900), M=W<700, sfx=M?'-m':'';
const DIR=process.argv[5]||decodeURIComponent(new URL('./s2/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,400):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,W,H,{mobile:M});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
const snap=async(n)=>{ await sleep(400); await shot(p,DIR+n+sfx+'.png',{full:false}); };
const load=async(pr)=>{ await goto(p,B+'?v='+Date.now()); await sleep(500); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3200);
  await ev(`window.__errs=window.__errs||[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s);`);
  await ev(`tfQaPreset('${pr}')`); await sleep(1200); };
const SHELL=`(function(){ var h=document.querySelector('#st-main h1'), cs=h?getComputedStyle(h):null, m=getComputedStyle(document.getElementById('g-content')).backgroundColor, card=document.querySelector('#st-main .stg-card'), cc=card?getComputedStyle(card):null, tags=[].filter.call(document.querySelectorAll('#st-main .stg-tag,#st-main .stg-pill'),function(t){ var b=getComputedStyle(t).backgroundColor; return b!=='rgba(0, 0, 0, 0)'&&b!=='transparent'; }).length;
  var fab=document.getElementById('teth-help'); return {fw:cs?cs.fontWeight:'',fs:cs?cs.fontSize:'',bg:m,cardBg:cc?cc.backgroundColor:'',rad:cc?cc.borderTopLeftRadius:'',tags:tags,fab:fab?getComputedStyle(fab).display:'none',scrollW:document.documentElement.scrollWidth,vw:innerWidth}; })()`;
const shellOk=(s)=>s.fw==='400'&&s.fs==='32px'&&s.bg==='rgb(0, 0, 0)'&&(s.cardBg==='rgba(0, 0, 0, 0)'||s.cardBg==='transparent')&&s.rad==='20px'&&s.tags===0&&s.fab==='none'&&s.scrollW<=s.vw;
const TXT=(sel)=>`(function(){ var e=document.querySelector('${sel}'); return e?e.innerText.replace(/\\s+/g,' ').slice(0,700):'NONE'; })()`;

// 구독 회원 결제
await load('13'); await ev(`stGo('billing')`); await sleep(1000);
let s=await J(SHELL); ok('셸: 검정 바탕, 제목 32px 400, 윤곽만 있는 카드 반경 20, 색 배지 없음, 상담 단추 없음, 가로 넘침 없음',shellOk(s),s);
s=await J(`{secs:[].map.call(document.querySelectorAll('#st-main .stg-sec h2'),function(h){ return h.innerText; }),rows:[].map.call(document.querySelectorAll('#st-main .stg-sec:first-of-type .stg-r .k b'),function(b){ return b.innerText; }),hist:document.querySelectorAll('#st-main .stg-hr').length,pills:[].map.call(document.querySelectorAll('#st-main .stg-sec:first-of-type .stg-b'),function(b){ return b.innerText; })}`);
ok('결제: 섹션 둘(구독, 결제 내역), 구독 카드에 TETH 구독, 결제 수단, 청구 정보. 알약 하나씩',s.secs.join()==='구독,결제 내역'&&s.rows.join()==='TETH 구독,결제 수단,청구 정보'&&s.pills.join()==='관리,관리,변경',s);
ok('결제 내역: 최근 3건까지',s.hist===3,s);
s=await J(`{txt:${TXT('#st-main')}}`); ok('결제: 다음 결제 문장, 실패는 글자로',/에 다음 결제가 진행됩니다/.test(s.txt)&&/결제 실패/.test(s.txt)&&!/새로 추가|기본으로|편집/.test(s.txt),s);
await snap('K1-billing');
await ev(`skSubDlg()`); await sleep(400); s=await J(`{dlg:!!document.getElementById('st-dlg'),h:(document.querySelector('#st-dlg h3')||{}).innerText,x:!!document.querySelector('#st-dlg .bx>.x'),cancel:(document.querySelector('#st-dlg .bts .dg')||{}).innerText}`);
ok('구독 관리 창: 요금, 다음 결제일, 결제 수단, "구독 해지"',s.dlg&&s.h==='TETH 구독'&&s.x&&s.cancel==='구독 해지',s); await snap('K2-sub-dlg');
await ev(`document.querySelector('#st-dlg .bts .dg').click()`); await sleep(400); s=await J(`{cf:(document.querySelector('#ac-cf h3')||{}).innerText}`); ok('구독 해지 → 확인 창',/구독을 해지하시겠습니까/.test(s.cf),s); await snap('K3-cancel-confirm'); await ev(`acConfirmClose()`);
await ev(`skCardsDlg()`); await sleep(400); s=await J(`{n:document.querySelectorAll('#st-dlg .stg-r').length,add:(document.querySelector('#st-dlg .bts .ok')||{}).innerText,def:[].map.call(document.querySelectorAll('#st-dlg .stg-b'),function(b){ return b.innerText; })}`);
ok('결제 수단 창: 카드 목록, 기본으로 지정, 삭제, 결제 수단 추가',s.n>=2&&s.add==='결제 수단 추가'&&s.def.indexOf('기본으로 지정')>=0&&s.def.indexOf('삭제')>=0,s); await snap('K4-cards-dlg');
const second=await ev(`acS().cards[1]&&acS().cards[1].id`); await ev(`skCardDef('${second}')`); await sleep(300); ok('기본으로 지정 → 기본 카드가 바뀐다',(await ev(`acS().cards.filter(function(c){ return c.def; })[0].id`))===second); await ev(`stDlgClose()`);
await ev(`skBillDlg()`); await sleep(300); await ev(`document.getElementById('st-be').value='bill@teth.ai'; skBillSave()`); await sleep(400); s=await J(`{em:acS().billTo.email,dlg:!!document.getElementById('st-dlg'),txt:${TXT('#st-main')}}`);
ok('청구 정보 창 저장 → 행 보조 줄에 반영',s.em==='bill@teth.ai'&&!s.dlg&&/bill@teth\.ai/.test(s.txt),s);
// 구독 종료, 초대 계정
await load('15'); await ev(`stGo('billing')`); await sleep(900); s=await J(`{txt:${TXT('#st-main')},p:(document.querySelector('#st-main .stg-b.p')||{}).innerText}`); ok('구독 종료: "구독이 종료되었습니다", 신규 주문 중단, "다시 구독"',/구독이 종료되었습니다/.test(s.txt)&&/신규 주문이 중단되었습니다/.test(s.txt)&&s.p==='다시 구독',s); await snap('K5-billing-expired');
await load('12'); await ev(`stGo('billing')`); await sleep(900); s=await J(`{txt:${TXT('#st-main')},pills:document.querySelectorAll('#st-main .stg-b').length}`); ok('초대 계정: 이용료 없음, 결제 수단과 청구 정보 없음',/TETH 초대 계정/.test(s.txt)&&/이용료가 없습니다/.test(s.txt)&&!/결제 수단/.test(s.txt),s);
// 보안
await load('14'); await ev(`stGo('security')`); await sleep(900);
s=await J(SHELL); ok('보안 셸',shellOk(s),s);
s=await J(`{secs:[].map.call(document.querySelectorAll('#st-main .stg-sec h2'),function(h){ return h.innerText; }),multi:[].filter.call(document.querySelectorAll('#st-main .stg-r'),function(r){ return r.querySelectorAll('.stg-b,.stg-sw').length>1; }).length,txt:${TXT('#st-main')}}`);
ok('보안: 로그인, 로그인한 기기, 거래소 연결. 한 행에 조작 하나. 출금 부정문 없음',s.secs.join()==='로그인,로그인한 기기,거래소 연결'&&s.multi===0&&!/출금/.test(s.txt)&&/현재 기기/.test(s.txt)&&/연결 끊기/.test(s.txt),s);
await snap('K6-security');
// 다른 탭도 같은 셸
for(const t of ['general','account','notify']){ await ev(`stGo('${t}')`); await sleep(700); s=await J(SHELL); ok(t+' 탭도 같은 셸',shellOk(s),s); }
await snap('K7-notify');
// 모바일: 목록 → 상세 → 목록
if(M){ await ev(`stMList()`); await sleep(800); s=await J(`{list:document.getElementById('st-root').classList.contains('m-list'),nav:getComputedStyle(document.querySelector('.stg-nav')).display,main:getComputedStyle(document.getElementById('st-main')).display,items:document.querySelectorAll('.stg-ni').length}`);
  ok('모바일 #/settings: 목록만 보인다',s.list&&s.nav!=='none'&&s.main==='none'&&s.items>=7,s); await snap('K0-list');
  await ev(`stGo('billing')`); await sleep(800); s=await J(`{detail:document.getElementById('st-root').classList.contains('m-detail'),nav:getComputedStyle(document.querySelector('.stg-nav')).display,back:getComputedStyle(document.querySelector('.stg-mback')).display}`);
  ok('목록에서 결제 → 상세, "설정" 뒤로 가기',s.detail&&s.nav==='none'&&s.back!=='none',s);
  await ev(`document.querySelector('.stg-mback').click()`); await sleep(800); ok('뒤로 → 목록',(await ev(`location.hash`))==='#/settings'&&(await ev(`document.getElementById('st-root').classList.contains('m-list')`))===true); }
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'sk-check'+sfx+'.txt',out.join('\n'));
await closePage(p);
