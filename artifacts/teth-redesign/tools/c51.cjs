// 예전 검증 페이지(#/strategy/backtest)를 없애고, 대화로 만든 전략을 새 백테스트 화면의 "내 전략"(mine)으로 태운다.
// 80점 실행 게이트를 없앤다.
const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const mk=(src)=>{ let s=src; return { rep(x,y){ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); }, get(){ return s; } }; };

// ── 1. rd-ui.js: 'mine' 을 찾고, 주소는 'mine'
{ const f=mk(fs.readFileSync(D+'rd-ui.js','utf8'));
  f.rep("function tfSSFind(nick){\n","function tfSSFind(nick){\n  if(nick==='mine') return typeof btMine==='function'?btMine():null; /* 대화로 만든 내 전략(아직 공개 전) */\n");
  f.rep("function tfSS3Rid(s){ return s.me?'me':tfSSNe(s.id||s.nick); }","function tfSS3Rid(s){ return s.mine?'mine':s.me?'me':tfSSNe(s.id||s.nick); }");
  fs.writeFileSync(D+'rd-ui.js',f.get()); }

// ── 2. bt-c.js: 내 전략 만들기, 결과를 대화 흐름의 검증 기록으로 남기기, 라우팅
{ const f=mk(fs.readFileSync(D+'bt-c.js','utf8'));
  f.rep("/* ── 들어오고 나가기 ── */",
`/* ── 내 전략: 대화에서 정한 조건을 새 백테스트 화면이 쓰는 차트 규칙 전략으로 옮긴다 ── */
var BT_MINE_ALIAS={'나스닥 종합':'나스닥'};
function btMineAsset(){ var t=tfS(), a=((t.intake||{}).asset||{}).label||''; a=BT_MINE_ALIAS[a]||a; return MK_PX_CFG[a]?a:null; }
function btMine(){
  var t=tfS(); if(!S.user||!t.intake||!t.intake.asset) return null;
  var a=btMineAsset(); if(!a) return null;
  var p=t.pendingP||tfParams(), iv=t.intake, st=((iv.style||{}).label||'').replace(/으로$/,''), sl=Math.abs(p.sl);
  var cfg={id:'mine',kind:'rule',asset:a,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:p.trendFilter?1:0,startI:61};
  var sig=JSON.stringify(cfg), h=0; for(var i=0;i<sig.length;i++) h=(h*31+sig.charCodeAt(i))>>>0;
  var name=(t.cloneFrom?t.cloneFrom+' 님 전략, ':'')+a+' 반등 매수';
  var one=a+'이(가) 내려왔다가 다시 오르는 날 사요. '+(p.tp!=null?'산 가격보다 '+p.tp+'% 오르면 팔고, ':'')+sl+'% 내려가면 팔아요.';
  return {id:'mine-'+h.toString(36),mine:true,kind:'rule',mkt:/비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/.test(a)?'crypto':'stock',
    nick:name,name:name,one:one,asset:a,uni:null,cfg:cfg,ex:null,p:p,fw:0,by:'',style:st};
}
/* 결과가 나오면 대화 흐름이 쓰는 검증 기록(t.cur)을 이 결과로 채운다. 점수 게이트는 없다 */
function btMineDone(){
  var t=tfS(), s=BT.s, R=BT.R; if(!s||!s.mine||!R) return;
  var p={}; for(var k in s.p) p[k]=s.p[k]; p.startI=R.eq[0].i; p.endI=R.eq[R.N-1].i;
  t.pendingP=s.p; t.cur={ret:R.ret,mdd:R.mdd,n:R.tr.length,winRate:R.tr.length?R.wins/R.tr.length*100:0,p:p,
    trades:R.tr.map(function(x){ return {entry:x.e,exit:x.x,pnl:x.pnl,kind:x.why||x.kind}; })};
  try{ t.score=tfScore(t.cur); }catch(e){ t.score=0; }
  t.workDone=true; if(t.stage==='verify'||t.stage==='ready'||!t.stage) t.stage='connect'; tfSave();
}

/* ── 들어오고 나가기 ── */`);
  f.rep("function btBack(){ if(BT.phase==='run'){ btStop(); btReady(); return; } var ne=BT.s?tfSS3Rid(BT.s):'';",
        "function btBack(){ if(BT.phase==='run'){ btStop(); btReady(); return; } if(BT.s&&BT.s.mine){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} TF_ONSTRAT=false; tfBackToChat(); return; } var ne=BT.s?tfSS3Rid(BT.s):'';");
  f.rep("  if(!s||!s.cfg){ TF_ONSHARE=false; tfShareHub('find'); return; }",
        "  if(!s&&m[1]==='mine'){ TF_ONSHARE=false; toast('이 자산은 아직 백테스트할 가격 자료가 없어요'); try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} tfBackToChat(); return; }\n  if(!s||!s.cfg){ TF_ONSHARE=false; tfShareHub('find'); return; }\n  if(s.mine){ TF_ONSHARE=false; TF_ONSTRAT=true; } /* 뒤로 가면 전략 목록이 아니라 대화로 */");
  f.rep("if(t.id===s.id){ if(t.per!=null) BT.per=t.per; if(t.amt) BT.amt=t.amt; } }",
        "if(t.id===s.id){ if(t.per!=null) BT.per=t.per; if(t.amt) BT.amt=t.amt; } else if(s.mine){ var pi=((tfS().intake||{}).period||{}).i; BT.per=pi===0?365:pi===1?730:pi===2?0:365; } }");
  fs.writeFileSync(D+'bt-c.js',f.get()); }

// ── 3. bt-b.js: 결과가 나오면 기록
{ const f=mk(fs.readFileSync(D+'bt-b.js','utf8'));
  f.rep("t.bt.fin=R.final; tfSave(); tfTrack('bt_done',{id:BT.id,ret:R.ret}); }catch(e){}",
        "t.bt.fin=R.final; tfSave(); tfTrack('bt_done',{id:BT.id,ret:R.ret}); }catch(e){}\n  if(BT.s&&BT.s.mine) btMineDone();");
  fs.writeFileSync(D+'bt-b.js',f.get()); }

// ── 4. bt-go.js: 내 전략은 연결 뒤 바로 시작 준비로
{ const f=mk(fs.readFileSync(D+'bt-go.js','utf8'));
  f.rep("function btGoNext(){\n  var f=btF();\n",
        "function btGoNext(){\n  var f=btF();\n  if(BT.s&&BT.s.mine){ var t=tfS(), bud=TF_BUDGET[((t.intake||{}).budget||{}).i!=null?t.intake.budget.i:1];\n    return '<section class=\"btg-next\"><h3>다음은 전략 시작이에요</h3><p>대화에서 정한 투자금으로 바로 시작하거나, 가상으로 먼저 돌려 볼 수 있어요.</p>'\n      +'<dl class=\"bt-dl\"><div><dt>실행 계정</dt><dd>'+btExLogo(f.api.ex,16)+btExName(f.api.ex)+'</dd></div><div><dt>투자금</dt><dd>'+tfWon(bud)+'</dd></div><div><dt>TETH 이용료</dt><dd>'+(f.path==='own'?'월 49,000원, 시작하는 날부터':'0원')+'</dd></div></dl></section>'\n      +'<button type=\"button\" class=\"bt-cta\" onclick=\"btFinal()\">시작 준비로</button>'; }\n");
  f.rep("function btFinal(){ try{ tfTrack('bt_final',{id:BT.id}); }catch(e){} cpSetupGo(btNe()); }",
        "function btFinal(){ try{ tfTrack('bt_final',{id:BT.id}); }catch(e){}\n  if(BT.s&&BT.s.mine){ var t=tfS(); if(!t.cur) btMineDone(); t.stage='done'; tfSave(); tfNav('#/strategy/done'); return; }\n  cpSetupGo(btNe()); }");
  fs.writeFileSync(D+'bt-go.js',f.get()); }

// ── 5. index.html 기본 코드: 예전 검증 라우트는 새 화면으로, 점수 게이트 문구 정리, 금지어
{ const f=mk(fs.readFileSync(R+'index.html','utf8'));
  f.rep("  if(h==='#/strategy/report') tfReportView();\r\n  else if(h==='#/strategy/connect') tfConnectView();\r\n  else if(h==='#/strategy/done') tfDoneView();\r\n  else tfWorkView();",
        "  /* 예전 검증, 리포트, 연결 화면은 새 백테스트 화면(내 전략)과 실행 준비로 옮겼다 */\r\n  if(h==='#/strategy/done'){ tfDoneView(); return; }\r\n  var go=h==='#/strategy/connect'&&t.cur?'/go':'';\r\n  try{ history.replaceState(null,'','#/share/bt/mine'+go); }catch(e){}\r\n  TF_ONSTRAT=false; tfRoute();");
  f.rep("  t.stage='verify'; t.tries=[]; t.workDone=false; tfSave();\r\n  tfNav('#/strategy/backtest');",
        "  t.stage='verify'; t.tries=[]; t.workDone=false; tfSave();\r\n  tfNav('#/share/bt/mine');");
  f.rep("+'<div style=\"font-size:11.5px;color:var(--gt3);line-height:1.7;margin:-4px 0 13px\">데이터: 2023~2026 일봉 시뮬레이션, '+days+'일 구간. 체결: 신호 봉 종가 기준. 비용: 거래당 수수료 0.2% 반영.</div>'\r\n    +'<button class=\"tf-btn p\" onclick=\"tfVerifyGo(\\''+id+'\\')\">전략 검증 시작</button>'",
        "+'<div style=\"font-size:11.5px;color:var(--gt3);line-height:1.7;margin:-4px 0 13px\">하루 한 번, 그날 마지막 가격으로 판단해요. 살 때와 팔 때마다 수수료 0.1%를 빼고 계산해요.</div>'\r\n    +'<button class=\"tf-btn p\" onclick=\"tfVerifyGo(\\''+id+'\\')\">과거로 돌려 보기</button>'");
  f.rep("    +'<div class=\"r\"><span class=\"k\">TETH Score</span><span class=\"v\">'+t.score+'</span></div>'\r\n","");
  // 게이트 기본값 대체 표기(|| 80)는 0 을 존중하게
  let s=f.get(); const n0=(s.match(/\(TFC\.score&&TFC\.score\.pass\)\|\|80/g)||[]).length;
  s=s.split('(TFC.score&&TFC.score.pass)||80').join('((TFC.score&&TFC.score.pass!=null)?TFC.score.pass:80)');
  s=s.split("<span class=\"vd\">TETH SCORE, '+(pass?'실행 기준 통과':'기준 '+TFC.score.pass+'점 미달')+'</span>").join("<span class=\"vd\">TETH SCORE</span>");
  s=s.split("+'점</b> ('+(pass?'통과':'기준 '+TFC.score.pass+'점 미달')+'), 검증 수익").join("+'점</b>, 검증 수익");
  s=s.split("(b.score>=TFC.score.pass?'검증 통과 전략':'재검증 필요')").join("'검증한 전략'");
  fs.writeFileSync(R+'index.html',s); console.log('fallbacks fixed',n0); }

// ── 6. 게이트 점수 0
{ let c=fs.readFileSync(R+'teth-copy.js','utf8'); const x=/pass: *80,/; if(!x.test(c)) throw new Error('pass anchor'); c=c.replace(x,'pass: 0,'); fs.writeFileSync(R+'teth-copy.js',c); }
console.log('ok');
