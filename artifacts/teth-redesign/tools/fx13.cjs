// 설정 화면: GPT처럼 앱 사이드바를 감추고 설정 메뉴가 그 자리를 차지한다
const fs=require('fs');
function ed(f,a,b){ let s=fs.readFileSync(f,'utf8'); if(s.split(a).length!==2) throw new Error(f+' :: '+a.slice(0,60)); fs.writeFileSync(f,s.replace(a,()=>b)); }
ed('p16.js',"  /* 좁은 화면: 지금 보는 설정 탭이 보이게 */",
"  /* 설정 화면에 있는 동안만 전체 화면 모드. 어떤 화면이 그려지든 G.mode 로 다시 판정한다 */\n  var stFull=function(){ document.body.classList.toggle('st-full',!!(window.G&&G.mode==='tfset')); };\n  var gc0=gContent; gContent=function(){ var r=gc0.apply(this,arguments); stFull(); return r; };\n  var gh0=gHome; gHome=function(){ var r=gh0.apply(this,arguments); stFull(); return r; };\n  window.addEventListener('hashchange',function(){ setTimeout(stFull,0); });\n  /* 좁은 화면: 지금 보는 설정 탭이 보이게 */");
ed('st.js',"function stBack(){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} gHome(); }",
"function stBack(){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} document.body.classList.remove('st-full'); gHome(); }");
fs.appendFileSync('bt6.css',`
/* 설정 전체 화면 (GPT 방식): 앱 사이드바, 위쪽 막대, 알림 단추를 감추고 설정 메뉴가 왼쪽 전체 높이를 쓴다 */
body.st-full #g-side,body.st-full #g-chead,body.st-full #nf-util,body.st-full #g-hamburger,body.st-full #g-auth-btns,body.st-full #g-globe,body.st-full .g-terms{display:none!important}
body.st-full .stg{display:block;max-width:none;margin:0;padding:0}
body.st-full .stg-nav{position:fixed;left:0;top:0;bottom:0;width:280px;z-index:40;display:flex;flex-direction:column;gap:2px;padding:14px 10px 20px;background:var(--g1,#171717);overflow-y:auto;scrollbar-width:thin}
body.st-full .stg-nav small{margin:20px 12px 6px}
body.st-full .stg-back{height:40px;margin-bottom:4px;font-size:14px;color:#e9ebee}
body.st-full .stg-main{max-width:820px;margin:0 auto;padding:48px 40px 120px;margin-left:max(320px,calc(280px + (100vw - 280px - 820px)/2))}
body.st-full .stg-main h1{font-size:28px;margin-bottom:30px}
@media (max-width:900px){
  body.st-full .stg-nav{position:sticky;top:0;bottom:auto;width:auto;height:auto;flex-direction:row;align-items:center;padding:10px 12px;gap:4px;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.08);background:var(--g0,#0e0f11)}
  body.st-full .stg-nav small{display:none}
  body.st-full .stg-back{margin:0 4px 0 0;font-size:0;width:38px;padding:0;justify-content:center}
  body.st-full .stg-back svg{width:18px;height:18px}
  body.st-full .stg-main{margin:0;padding:20px 16px 120px;max-width:none}
}
`);
console.log('ok');
