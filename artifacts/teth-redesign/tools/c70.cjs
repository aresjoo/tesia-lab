// 16-fixes 묶음 1: R01 비회원 의도 보존, R05 판단 기록에서 칩 제거, R06 목록 정리, R15 카드 CTA, R16 상세 CTA 위계
const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
const IC_TEST='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7.5 15l3.5-4 3 2.5 4.5-6"/></svg>';
ed(D+'rd-ui.js',[
  // R06: 숫자와 긴 설명을 뺀다. 고른 분류의 한 줄만 남긴다
  ["return '<button type=\"button\" aria-pressed=\"'+on+'\" onclick=\"mkKindPick(\\''+o[0]+'\\')\">'+o[1]+'<i class=\"num\">'+cnt[o[0]]+'</i></button>'; }).join('')+'</div>'",
   "return '<button type=\"button\" aria-pressed=\"'+on+'\" title=\"'+({all:'모든 전략',agent:'AI가 종목과 시점, 비중을 정합니다',rule:'정해 둔 가격 조건이 맞을 때만 거래합니다',mix:'AI가 고르고, 규칙이 시점을 정합니다'}[o[0]])+'\" onclick=\"mkKindPick(\\''+o[0]+'\\')\">'+o[1]+'</button>'; }).join('')+'</div>'"],
  ["    +'<p class=\"mk3-kindhelp\">'+({all:'AI 판단은 AI가 종목과 비중을 정해요. 차트 규칙은 정해 둔 가격 조건만 따라요. 혼합 전략은 AI가 종목을 고르고 규칙이 시점을 정하되, 조건이 맞아도 시장이 위험하면 AI가 진입을 보류해요.',agent:'여러 종목을 비교해 무엇을 얼마나 들지 AI가 정해요. 시장이 약하면 새로 사지 않아요.',rule:'정해 둔 자산에서 정해 둔 조건이 맞을 때만 사고팔아요. AI는 끼어들지 않아요.',mix:'거래할 종목은 AI가 고르고, 사고파는 시점은 규칙이 정해요. 규칙 조건이 맞아도 큰 악재나 약한 시장이면 AI가 진입을 보류해요.'}[kind])+'</p></div>'",
   "    +(kind==='all'?'':'<p class=\"mk3-kindhelp one\">'+({agent:'AI가 종목과 시점, 비중을 정합니다.',rule:'정해 둔 가격 조건이 맞을 때만 거래합니다.',mix:'AI가 종목을 고르고, 규칙이 시점을 정합니다.'}[kind])+'</p>')+'</div>'"],
  // R15: 카드에는 밝은 단추 하나와 조용한 자세히
  ["  var bF='<button type=\"button\" class=\"mk3-b\" onclick=\"cpSetupGo(\\''+ne+'\\')\">따라가기</button>', bD='<button type=\"button\" class=\"mk3-b fill\" onclick=\"tfSS3Go(\\''+ne+'\\')\">자세히</button>';",
   "  var bF='<button type=\"button\" class=\"mk3-b fill\" onclick=\"cpSetupGo(\\''+ne+'\\')\">전략 복사하기</button>', bD='<button type=\"button\" class=\"mk3-b quiet\" onclick=\"tfSS3Go(\\''+ne+'\\')\">자세히</button>';"],
  // R16: 복사가 첫째, 내 조건 확인이 분명한 둘째
  ["'<button type=\"button\" class=\"mk-pri\" onclick=\"cpSetupGo(\\''+ne+'\\')\">따라가기</button>'+(s.cfg?'<button type=\"button\" class=\"mk3-bt\" onclick=\"btOpen(\\''+ne+'\\')\">내 조건으로 백테스트</button>':'')",
   "'<button type=\"button\" class=\"mk-pri\" onclick=\"cpSetupGo(\\''+ne+'\\')\">전략 복사하기</button>'+(s.cfg?'<button type=\"button\" class=\"mk3-bt2\" onclick=\"btOpen(\\''+ne+'\\')\" aria-label=\"내 조건으로 성과 확인, 백테스트\">"+IC_TEST.replace(/'/g,"\\'")+"<span><b>내 조건으로 성과 확인</b><small>기간과 금액을 정해 과거 성과를 확인</small></span></button>':'')"],
  // R05: 칩 없이, 기록이 스스로 종류를 말한다
  ["function mkChatRow(s,m,first){\n  return '<li class=\"mkc-m k-'+m.k+(first?' first':'')+'\">'\n    +'<div class=\"mkc-av\" aria-hidden=\"true\">'+mkGlyph(s,36)+'</div>'\n    +'<div class=\"mkc-b\"><div class=\"mkc-h\"><b>'+gEsc(mkHook(s))+'</b><span class=\"mkc-tag\">'+mkGloss(gEsc(m.tag))+'</span><time class=\"num\">'+m.ts+'</time></div>'",
   "var MKC_IC={buy:'<path d=\"M12 19V6M6.5 11.5L12 6l5.5 5.5\"/>',sell:'<path d=\"M12 5v13M6.5 12.500L12 18l5.500-5.500\"/>',now:'<circle cx=\"12\" cy=\"12\" r=\"3.2\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"8\"/>',wait:'<path d=\"M9 6v12M15 6v12\"/>',hold:'<path d=\"M6 12h12\"/>',pick:'<path d=\"M5 12.500l4.500 4.500L19 7.500\"/>',intro:'<path d=\"M6 5h12v14H6zM9 9h6M9 13h6\"/>'};\nfunction mkChatTitle(s,m){ var a=m.a?mkTk(m.a):'', fut=/^선물 /.test(m.tag||''), t=fut?m.tag.replace(/^선물 /,''):'';\n  if(m.k==='now') return '현재 판단'; if(m.k==='intro') return '전략 개요';\n  if(m.k==='buy') return a+' '+(fut?t:'매수'); if(m.k==='sell') return a+' '+(fut?t:'매도');\n  if(m.k==='pick') return a+(fut?' '+t:' 선정'); if(m.k==='hold') return '보유 유지'; return a?a+' 관망':'관망'; }\nfunction mkChatOut(m){ if(m.k!=='sell') return ''; var x=/손익은[^+\\-]*([+\\-]\\d[\\d,]*(?:\\.\\d+)?%)/.exec(m.t||''); return x?'<i class=\"mkc-out num '+(x[1].charAt(0)==='+'?'up':'dn')+'\">'+x[1]+'</i>':''; }\nfunction mkChatRow(s,m,first){\n  return '<li class=\"mkc-m v2 k-'+m.k+(first?' first':'')+'\">'\n    +'<div class=\"mkc-ic\" aria-hidden=\"true\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">'+(MKC_IC[m.k]||MKC_IC.wait)+'</svg></div>'\n    +'<div class=\"mkc-b\"><div class=\"mkc-h\"><b>'+gEsc(mkChatTitle(s,m))+'</b>'+mkChatOut(m)+'<time class=\"num\">'+m.ts+'</time></div>'"],
]);
fs.appendFileSync(D+'rd.css',`
/* ── 16-fixes ── */
/* R06 분류: 숫자 없이, 고른 분류의 한 줄만 */
.mk3-kindhelp.one{margin:0;font-size:13px;line-height:1.5;color:#9aa0a6;align-self:center}
/* R15 카드: 밝은 단추 하나, 자세히는 조용히 */
#g-root .mk3v2 .mk3-foot{gap:4px}
#g-root .mk3v2 .mk3-foot .mk3-b.fill{flex:1 1 auto}
#g-root .mk3v2 .mk3-foot .mk3-b.quiet{flex:0 0 auto;width:auto;padding:0 14px;border-color:transparent;background:transparent;color:#aeb3ba;font-weight:500}
#g-root .mk3v2 .mk3-foot .mk3-b.quiet:hover{color:#fff;background:rgba(255,255,255,.06)}
/* R16 상세: 첫째는 복사, 둘째는 내 조건으로 성과 확인 */
.mk3-bt2{display:inline-flex;align-items:center;gap:11px;height:48px;padding:0 18px 0 15px;border-radius:12px;border:0;background:#f2f3f5;color:#0e0f11;font:inherit;cursor:pointer;text-align:left;transition:background-color .12s ease,transform .12s ease}
.mk3-bt2:hover{background:#fff}
.mk3-bt2:active{transform:scale(.985)}
.mk3-bt2 svg{flex:none;color:#0e0f11}
.mk3-bt2 span{display:flex;flex-direction:column;gap:1px;min-width:0}
.mk3-bt2 b{font-size:14.5px;font-weight:700;line-height:1.25;letter-spacing:-.005em}
.mk3-bt2 small{font-size:11.5px;line-height:1.25;color:#5b6067;font-weight:500}
.mk3-dh-acts .mk-pri{height:48px;border-radius:12px;font-size:15px;font-weight:800}
@media (max-width:640px){ .mk3-bt2{flex:1 1 100%;height:52px} .mk3-dh-acts .mk-pri{flex:1 1 100%;height:52px} }
/* R05 판단 기록: 칩 대신 기호, 제목, 결과, 시각 */
.mkc-m.v2{gap:14px;padding:16px 0;border-top:1px solid rgba(255,255,255,.07)}
.mkc-list .mkc-m.v2:first-child{border-top:0;padding-top:4px}
.mkc-ic{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#aeb3ba;background:rgba(255,255,255,.06)}
.k-buy>.mkc-ic{color:#2fb98a;background:rgba(47,185,138,.13)}
.k-sell>.mkc-ic{color:#e9ebee;background:rgba(255,255,255,.1)}
.k-now>.mkc-ic{color:#c8f43c;background:rgba(200,244,60,.1)}
.mkc-m.v2 .mkc-h{min-height:30px;margin:0 0 4px;gap:10px}
.mkc-m.v2 .mkc-h b{font-size:15px;font-weight:700;letter-spacing:-.005em}
.mkc-out{font-style:normal;font-size:13.5px;font-weight:600}
.mkc-out.up{color:#2fb98a}.mkc-out.dn{color:#f0566a}
.mkc-m.v2 .mkc-t{background:none;border:0;padding:0}
.mkc-m.v2 .mkc-t p{margin:0;font-size:14px;line-height:1.7;color:#aeb3ba}
.mkc-m.v2 .mkc-t p strong{color:#e9ebee;font-weight:600}
@media (max-width:640px){ .mkc-m.v2{gap:10px} .mkc-m.v2 .mkc-h{flex-wrap:wrap} .mkc-m.v2 .mkc-h time{flex:1 0 100%;margin-left:0} }
`);
// R01: 의도 하나를 기억했다가 인증이 끝나면 그 자리로 돌아간다
ed(D+'bt-c.js',[
  ["function btOpen(ne){ location.hash='#/share/bt/'+ne; }",
   "/* 하려던 일 하나를 기억한다. 인증이나 실행 준비가 끝나면 한 번만 꺼내 그 자리로 간다 */\nfunction tfIntentSet(o){ o.at=Date.now(); window.TF_INTENT=o; try{ sessionStorage.setItem('teth.intent',JSON.stringify(o)); }catch(e){} }\nfunction tfIntentPeek(){ var o=window.TF_INTENT; if(!o){ try{ o=JSON.parse(sessionStorage.getItem('teth.intent')||'null'); }catch(e){} } return o&&Date.now()-o.at<1800000?o:null; }\nfunction tfIntentClear(){ window.TF_INTENT=null; try{ sessionStorage.removeItem('teth.intent'); }catch(e){} }\nfunction tfIntentRun(){ var o=tfIntentPeek(); if(!o||!S.user) return false; tfIntentClear();\n  if(o.kind==='bt'){ location.hash='#/share/bt/'+o.id; return true; }\n  if(o.kind==='copy'){ if(location.hash.indexOf('#/share/s/')!==0) tfSS3Go(o.id,'all','ov'); setTimeout(function(){ cpSetupGo(o.id); },500); return true; }\n  if(o.kind==='start'&&typeof acStart==='function'){ acStart(o); return true; }\n  return false; }\nfunction btOpen(ne){ if(!S.user){ tfIntentSet({kind:'bt',id:ne,from:location.hash}); try{ tfTrack('bt_guest_gate',{id:ne}); }catch(e){} authOpen('signup'); return; } location.hash='#/share/bt/'+ne; }"],
  ["  if(m&&m[1]==='mine'&&!window.TF_STATE_READY){ TF_ONSHARE=false; return; } /* 부팅이 끝나면 다시 불린다 */",
   "  if(m&&!window.TF_STATE_READY){ TF_ONSHARE=false; return; } /* 저장된 로그인 상태가 복원된 뒤에 판단한다. 부팅이 끝나면 다시 불린다 */\n  if(m&&!S.user){ /* 비회원: 그 전략의 상세로 보내고, 인증이 끝나면 이 백테스트로 돌아온다 */\n    TF_ONSHARE=false; if(m[1]==='mine'){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} gHome(); return; }\n    tfIntentSet({kind:'bt',id:m[1]}); try{ history.replaceState(null,'','#/share/s/'+m[1]); }catch(e){} tfRoute(); setTimeout(function(){ if(!S.user) authOpen('signup'); },400); return; }"],
]);
ed(R+'index.html',[
  ["function cpSetupGo(ne){\r\n  if(!S.user){ authOpen('signup'); return; }","function cpSetupGo(ne){\r\n  if(!S.user){ if(typeof tfIntentSet==='function') tfIntentSet({kind:'copy',id:ne,from:location.hash}); authOpen('signup'); return; }"],
  ["    if(G.pendingRun){ G.pendingRun=false; delay(300,gStartRunGo); }\r\n    if(G.pendingNew!=null){","    if(!G.pendingRun&&G.pendingNew==null&&!(AUTH&&AUTH.draft)&&typeof tfIntentPeek==='function'&&tfIntentPeek()){ delay(320,function(){ tfIntentRun(); }); return; } /* 하려던 일로 돌아간다 */\r\n    if(G.pendingRun){ G.pendingRun=false; delay(300,gStartRunGo); }\r\n    if(G.pendingNew!=null){"],
]);
console.log('ok');
