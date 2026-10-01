/* ═══ 판단 패널 Codex s3 반영 (sk-brain3) ═══
   제목은 모두 "지금 무엇을 들고 있는지". 금액 대신 진입가 대비 %(예시 데이터의 가격표 오류를 보이지 않게). 손익은 넣은 돈 기준 하나로.
   생각은 1인칭 두 문장(결정, 바꾸는 조건) + 더 보기. 기록 꼬리표는 중립색, 규칙형 검사표는 nof1식 카드로 바꾸고 연속 유지는 묶는다 */
function tbFirst(L,kind,fut){ var nm=mkList(L.map(function(x){ return mkTk(x.k); }));
  if(!L.length) return '';
  if(fut&&L.length===1) return mkTk(L[0].k)+' '+(L[0].side<0?'숏':'롱')+' 포지션을 보유하고 있습니다';
  if(fut) return mkJ(mkList(L.map(function(x){ return mkTk(x.k)+(x.side<0?' 숏':' 롱'); })),'을','를')+' 보유하고 있습니다';
  return mkJ(nm,'을','를')+' 보유하고 있습니다'; }
function tbPnl(x){ return x.pnl!=null&&x.fut?+x.pnl:(+x.chg||0); }
/* 규칙형 상태 블록: 금액 대신 % */
tfTmStatusBlock=function(s,c){
  var p=s.p||{}, st=s.status, watch=!window.TF_PREVIEW&&typeof bcInit==='function'&&bcInit().mode==='watch', inPos=!!(c.pos&&st==='live');
  var tk=gEsc(tfAssetTicker(s.asset));
  var head=st==='live'?(watch?'AI 판단이 잠시 멈춰 있습니다':inPos?tk+' 롱 포지션을 보유하고 있습니다':'진입 조건을 기다리고 있습니다'):st==='off'?'일시정지 중입니다':st==='ready'?'실행 전입니다':'연결 오류로 멈췄습니다';
  var ex=s.exL||'', line=(ex?tbIcon(s.ex)+'<span>'+gEsc(ex)+(st==='live'?'에서 운용 중,':'에 연결,'):'<span>')+' 마지막 확인 <b id="tm-lastchk">'+tfTmAgo(tfTmEvalAt(s))+'</b></span>';
  var rows='', th='';
  if(inPos){ var pc=c.pos.chg*100, left=Math.max(0,25-c.pos.bars);
    rows+=tbRow('포지션','롱 '+c.pos.qty.toFixed(4)+' '+tk+' <i class="'+(pc>0.05?'u':pc<-0.05?'d':'z')+'">'+tfTmPct(pc,1)+'</i>');
    rows+=tbRow('손절','진입가 대비 '+p.sl+'%');
    if(c.pos.tpP) rows+=tbRow('익절','진입가 대비 +'+p.tp+'%');
    rows+=tbRow('보유 기간',c.pos.bars+'일, 최대 25일');
    th='저는 정해 둔 청산 조건에 따라 '+tfAssetTicker(s.asset)+' 롱을 유지합니다. 진입가 대비 '+p.sl+'%에 닿거나'+(c.pos.tpP?' +'+p.tp+'%에 닿거나':'')+' '+left+'일 뒤 보유 기간이 끝나면 정리합니다.';
  } else {
    rows+=tbRow('포지션',c.flat?'없음, 긴급 정지로 정리됨':'없음');
    rows+=tbRow('진입 조건','RSI '+p.rsiTh+' 아래에서 0.5% 넘게 반등'+(p.trendFilter?', 20일과 60일 평균 차이 3% 초과':''));
    if(st==='live') th='저는 지금 포지션 없이 기다립니다. RSI가 '+p.rsiTh+' 아래로 눌렸다가 하루 0.5% 넘게 반등하는 날에만 진입합니다.';
    else if(st==='off') th='일시정지 중이라 새 주문을 내지 않습니다. 다시 시작하면 다음 봉 마감부터 판단합니다.';
  }
  return '<div class="tm-status tb st-'+st+'"><h3 class="tb-t">'+head+'</h3><p class="tb-d">'+line+'</p><div class="tb-list">'+rows+'</div>'
    +(watch?'<p class="tb-w">이용 한도로 AI 판단이 멈춰 있습니다. 손절과 익절 규칙은 계속 작동합니다.</p>':'')+'</div>'+tbThought(th);
};
/* 복사 전략: 행과 생각의 손익을 같은 값으로, 현물은 보유, 제목 통일, 생각은 결정 + 바꾸는 조건 */
tbHoldRows=function(s2){ var st=s2.r&&s2.r.state||{}, c=s2.cfg||{}, o=st.open, L=!o?[]:o.length!=null?o:[o], rows='', fut=fuIs(s2), wsum=0;
  L.forEach(function(x){ var pc=tbPnl(x), tk=gEsc(mkTk(x.k)), side=fut?(x.side<0?' 숏':' 롱')+(x.lev>1?' '+x.lev+'배':''):' 보유', w=x.w!=null&&L.length>1?Math.round(x.w*100):null; if(w!=null) wsum+=w;
    rows+=tbRow(tk+side,(w!=null?'<span class="tb-w2">비중 '+w+'%</span> ':'')+'<i class="'+(pc>0.05?'u':pc<-0.05?'d':'z')+'">'+mkPct0(pc,1)+'</i>'); });
  if(L.length>1&&wsum<98) rows+=tbRow('현금','<span class="tb-w2">비중 '+Math.max(0,100-wsum)+'%</span>');
  if(!L.length) rows+=tbRow('포지션','없음');
  if(s2.kind==='mix'&&!L.length&&st.pick) rows+=tbRow('선정 종목',gEsc(mkTk(st.pick)));
  rows+=tbRow('정리 기준',tbRuleTxt(s2));
  return rows; };
function tbRuleTxt(s2){ var c=s2.cfg||{}; return fuIs(s2)?(c.trail?'유리한 가격에서 '+c.trail+'% 되돌리면':c.sl?'진입가에서 '+c.sl+'% 불리하면':'재평가에서 방향이나 순위가 바뀌면'):s2.kind==='agent'?'고점 대비 -'+c.trail+'%, 재평가 순위 하락':(c.sl!=null?'손절 '+c.sl+'%, 익절 +'+c.tp+'%':''); }
tbTitle=function(s2){ var st=s2.r&&s2.r.state||{}, o=st.open, L=!o?[]:o.length!=null?o:[o];
  if(L.length) return tbFirst(L,s2.kind,fuIs(s2));
  if(s2.kind==='mix'&&st.pick) return mkTk(st.pick)+' 진입 신호를 기다리고 있습니다';
  return '현금으로 기다리고 있습니다'; };
function tbCopyThought(s2){ var st=s2.r&&s2.r.state||{}, o=st.open, L=!o?[]:o.length!=null?o:[o], c=s2.cfg||{}, fut=fuIs(s2);
  var nm=mkList(L.map(function(x){ return mkTk(x.k)+(fut?(x.side<0?' 숏':' 롱'):''); }));
  var a=L.length?'저는 '+mkJ(nm,'을','를')+' 유지합니다.':'저는 지금 현금으로 기다립니다.';
  var b=s2.kind==='agent'?(L.length?'보유 종목이 고점 대비 '+c.trail+'% 밀리거나 '+(st.nextEval!=null?mkMD(st.nextEval)+' ':'다음 ')+'재평가에서 순위가 밀리면 정리합니다.':(st.nextEval!=null?mkMD(st.nextEval)+' ':'다음 ')+'재평가에서 기준을 넘는 종목이 있으면 진입합니다.')
    :L.length?tbRuleTxt(s2)+' 정리합니다.':'신호가 켜지고 시장 확인을 통과하는 날에만 진입합니다.';
  var rest=''; try{ rest=mkChatNow(s2,s2.r)||''; }catch(e){}
  return a+' '+b+(rest?' '+rest:''); }
(function(){ var b0=tbCopyBlock; tbCopyBlock=function(c2){ var h=b0.apply(this,arguments); try{ var s2=tfSSFind(c2.nick); if(!s2) return h;
  var t=tbCopyThought(s2); h=h.replace(/<div class="tb-th">[\s\S]*?<\/p><\/div>(?=<div class="tb-feed"|<div class="tb-foot")/,tbThought(t));
  h=h.replace(/다음 판단 다음 거래일 종가/,'다음 판단 다음 거래일 마감'); }catch(e){} return h; }; })();
/* 생각: 두 문장 + 더 보기 */
tbThought=function(t,lab){ if(!t) return ''; var s=tbSent(t,2);
  return '<div class="tb-th"><p class="tb-thl">'+(lab||'TETH의 생각')+'</p><p class="tb-tht">'+gEsc(s.head)+(s.rest?'<span class="tb-more" hidden> '+gEsc(s.rest)+'</span> <button type="button" class="pl-link tb-mb" onclick="var m=this.previousElementSibling;m.hidden=!m.hidden;this.textContent=m.hidden?\'더 보기\':\'접기\'">더 보기</button>':'')+'</p></div>'; };
/* 복사 전략 기록: 꼬리표 중립색, 판단 전문 표시, 문장 다듬기 */
tbFeed=function(msgs){ var L=(msgs||[]).filter(function(m){ return m.k!=='now'&&m.k!=='intro'; }); if(!L.length) return '';
  var fix=function(x){ return String(x||'').replace(/ ([\d,.$]+)을\(를\) 넘음\.?/g,' $1를 넘었습니다.').replace(/([가-힣A-Z]+), 종가가 최근 20일 최고가/g,'$1 종가가 최근 20일 최고가인'); };
  return '<div class="tb-feed"><p class="tb-fh">판단 기록</p>'+L.map(function(m){ var s=tbSent(fix(m.t),2);
    return '<details class="tb-fc"><summary><span class="tb-ft num">'+gEsc(m.ts||'')+'</span><b>'+gEsc(m.tag||'')+(m.cnt>1?' '+m.cnt+'회':'')+'</b><span class="tb-fs">'+gEsc(s.head)+(s.rest?' <u class="tb-fx">판단 전문</u>':'')+'</span></summary>'+(s.rest?'<p class="tb-fr">'+gEsc(s.rest)+'</p>':'')+'</details>'; }).join('')+'</div>'; };
/* 규칙형 기록: 검사표 카드 → 날짜, 꼬리표, 한 문장, 펼치면 검사표. 연속 보유 유지와 관망은 묶는다 */
var TB_RULE={ho:['보유 유지','손절과 익절 조건에 닿지 않아 그대로 들고 있습니다.'],wa:['관망','진입 조건이 맞지 않아 주문을 내지 않았습니다.'],en:['진입','진입 조건이 모두 맞아 롱 포지션을 열었습니다.'],tp:['익절 청산','익절 목표에 닿아 정리했습니다.'],sl:['손절 청산','손절 기준에 닿아 정리했습니다.'],tm:['기간 청산','최대 보유 기간이 지나 정리했습니다.']};
function tbRuleLog(){ try{ var box=document.getElementById('tft-bbody'); if(!box||box.getAttribute('data-tb')==='1') return; var cards=[].slice.call(box.querySelectorAll('.tm-card.rule')); if(!cards.length) return;
  var groups=[]; cards.forEach(function(cd){ var res=cd.querySelector('.tm-res'), cls=res?(['ho','wa','en','tp','sl','tm'].filter(function(k){ return res.classList.contains(k); })[0]||'ho'):'ho', d=(cd.querySelector('.tm-t')||{}).textContent||'';
    var g=groups[groups.length-1]; if(g&&g.cls===cls&&(cls==='ho'||cls==='wa')){ g.n++; g.from=d; g.inner=g.inner||cd.querySelector('.tm-rows'); return; }
    groups.push({cls:cls,n:1,to:d,from:d,el:cd}); });
  var html=groups.map(function(g){ var m=TB_RULE[g.cls]||TB_RULE.ho, rows=g.el.querySelector('.tm-rows'), outs=[].map.call(g.el.querySelectorAll('.tm-out'),function(o){ return o.outerHTML; }).join('');
    var when=g.n>1?g.from.replace(/^\d{4}\. /,'')+' ~ '+g.to.replace(/^\d{4}\. /,''):g.to;
    return '<details class="tb-fc tb-rl"><summary><span class="tb-ft num">'+gEsc(when)+'</span><b>'+m[0]+(g.n>1?' '+g.n+'회':'')+'</b><span class="tb-fs">'+m[1]+' <u class="tb-fx">판단 전문</u></span></summary><div class="tb-fr">'+(rows?rows.outerHTML:'')+outs+'</div></details>'; }).join('');
  cards.forEach(function(cd){ cd.remove(); });
  var w=document.createElement('div'); w.className='tb-feed tb-rfeed'; w.innerHTML=html; box.appendChild(w); box.setAttribute('data-tb','1'); }catch(e){} }
(function(){ var t=0; var go=function(){ clearTimeout(t); t=setTimeout(function(){ var b=document.getElementById('tft-bbody'); if(b&&b.getAttribute('data-tb')==='1'&&b.querySelector('.tm-card.rule')) b.removeAttribute('data-tb'); tbRuleLog(); },120); };
  try{ new MutationObserver(go).observe(document.getElementById('g-content'),{childList:true,subtree:true}); }catch(e){} })();
TB_TXT.push(['거래만','거래 기록']);

/* 선물 AI 전략은 추적 손절 값이 없다: 생각 문장의 정리 조건은 정리 기준 문장으로 */
(function(){ var t0=tbCopyThought; tbCopyThought=function(s2){ if(fuIs(s2)&&s2.kind==='agent'){ var st=s2.r&&s2.r.state||{}, o=st.open, L=!o?[]:o.length!=null?o:[o];
  var nm=mkList(L.map(function(x){ return mkTk(x.k)+(x.side<0?' 숏':' 롱'); })); var rest=''; try{ rest=mkChatNow(s2,s2.r)||''; }catch(e){}
  return (L.length?'저는 '+mkJ(nm,'을','를')+' 유지합니다. '+tbRuleTxt(s2)+' 정리합니다.':'저는 지금 현금으로 기다립니다. 다음 재평가에서 방향이 정해지면 진입합니다.')+(rest?' '+rest:''); } return t0.apply(this,arguments); }; })();
/* 복사 전략의 차트 종목: 거래쌍이 "가상자산 8종"처럼 묶음이면 지금 들고 있는 첫 종목으로 */
(function(){ var s0=mktStratSym; mktStratSym=function(){ var r=s0(); if(r) return r; try{ if(TF_TM.sel) return null; var act=cpState().copies.filter(function(x){ return x.status==='active'&&tfSSFind(x.nick); }); var c=act[Math.min(typeof TB_CP!=='undefined'?TB_CP:0,act.length-1)]; if(!c) return null;
  var s2=tfSSFind(c.nick), o=s2&&s2.r&&s2.r.state&&s2.r.state.open, L=!o?[]:o.length!=null?o:[o]; if(L.length){ var m=String(mkTk(L[0].k)).toUpperCase()+'USDT'; return /^[A-Z0-9]+USDT$/.test(m)?m:null; } }catch(e){} return null; }; })();
/* 복사 전략을 바꿔 고르면 차트도 그 전략의 종목으로 */
(function(){ var p0=pxTermSide; pxTermSide=function(){ var h=p0.apply(this,arguments); setTimeout(function(){ try{ if(MKT.picked) return; var ss=mktStratSym(); if(ss&&ss!==MKT.sym){ MKT.sym=ss; MKT.tick=null; MKT.prem=null; mktHead(); mktPoll(); mktChart(true); } }catch(e){} },60); return h; }; })();
/* 차트를 다시 만든 뒤 칸 너비에 맞게 크기를 다시 잡는다(오른쪽 회색 빈 띠 방지) */
(function(){ if(typeof mktChart!=='function') return; var c0=mktChart; mktChart=function(){ var r=c0.apply(this,arguments); [400,1200,2500].forEach(function(ms){ setTimeout(function(){ try{ var h=document.getElementById('nfxh-tv'), f=h&&h.querySelector('iframe'); if(f){ f.style.width='100%'; f.style.height='100%'; } window.dispatchEvent(new Event('resize')); }catch(e){} },ms); }); return r; }; })();
