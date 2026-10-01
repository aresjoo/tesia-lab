/* ═══ 판단 패널과 내 거래소 Codex s5 반영 (sk-brain4) ═══ */
/* 다음 판단 시각: 일봉 마감(한국 시간 09:00) 기준 실제 날짜 */
function tbNextClose(){ var n=new Date(), k=new Date(n.getTime()+9*3600e3), d=new Date(Date.UTC(k.getUTCFullYear(),k.getUTCMonth(),k.getUTCDate(),0,0,0)); if(k.getUTCHours()>=9) d=new Date(d.getTime()+864e5); return (d.getUTCMonth()+1)+'월 '+d.getUTCDate()+'일 09:00'; }
(function(){ var b0=tbCopyBlock; tbCopyBlock=function(){ var h=b0.apply(this,arguments); return h.replace('다음 판단 다음 거래일 마감','다음 판단 '+tbNextClose()).replace(/다음 판단 (\d+월 \d+일)(?! \d)/,'다음 판단 $1 09:00'); }; })();
/* 판단 기록: 닫힘 "판단 전문", 열림 "접기" (글자는 CSS 로 바꾼다) */
(function(){ var f0=tbFeed; tbFeed=function(){ return f0.apply(this,arguments).split('<u class="tb-fx">판단 전문</u>').join('<u class="tb-fx" aria-hidden="true"></u>'); }; })();
(function(){ var r0=tbRuleLog; tbRuleLog=function(){ r0.apply(this,arguments); try{ [].forEach.call(document.querySelectorAll('#tft-bbody u.tb-fx'),function(u){ if(u.textContent==='판단 전문'){ u.textContent=''; u.setAttribute('aria-hidden','true'); } }); }catch(e){} }; })();
/* 아래 포지션 표의 손익률도 넣은 돈 기준(판단 패널과 같은 값), 열 이름 "손익률" */
if(typeof CPX_TH!=='undefined') CPX_TH.pos=CPX_TH.pos.replace('<th class="r">%</th>','<th class="r">손익률</th>');
(function(){ if(typeof cpxTermRows!=='function') return; var t0=cpxTermRows; cpxTermRows=function(k){ var rows=t0.apply(this,arguments); if(k!=='pos') return rows;
  try{ var fix=[]; cpState().copies.filter(function(c){ return c.status==='active'; }).forEach(function(c2){ var s2=tfSSFind(c2.nick); var o=s2&&s2.r&&s2.r.state&&s2.r.state.open, L=!o?[]:o.length!=null?o:[o]; L.forEach(function(x){ if(x.fut&&x.pnl!=null) fix.push([mkPct0(x.chg,1),mkPct0(+x.pnl,1),+x.pnl]); }); });
    return rows.map(function(r){ for(var i=0;i<fix.length;i++){ var a='">'+fix[i][0]+'</td>'; if(r.indexOf(a)>=0){ return r.replace(/<td class="r num (u|d)">([+-]?[\d.]+%)<\/td>/,function(m){ return '<td class="r num '+(fix[i][2]>=0?'u':'d')+'">'+fix[i][1]+'</td>'; }); } } return r; }); }catch(e){ return rows; } }; })();
/* 전략 목록: 떠 있는 상담 단추 대신 목록 아래 한 줄 */
(function(){ var g0=tfSS3GridHtml; tfSS3GridHtml=function(){ var h=g0.apply(this,arguments); return h+'<p class="cq-help mk-help">막히면 상담원이 24시간 답합니다. <button type="button" class="pl-link" onclick="tfTxHelp()">상담원에게 묻기</button></p>'; }; })();
/* 내 거래소 목록: 키보드(열면 현재 항목에 초점, 위아래 화살표, Esc 와 선택 뒤 단추로 초점 복귀), 현재 항목 체크 표시 */
(function(){ var m0=tfMyExMenu; tfMyExMenu=function(open){ var had=!!document.querySelector('.myex-m'); m0.apply(this,arguments); var m=document.querySelector('.myex-m'), b=document.querySelector('.myex');
  if(m&&!had){ var items=[].slice.call(m.querySelectorAll('button')); items.forEach(function(x){ x.setAttribute('tabindex','-1'); if(x.classList.contains('on')) x.insertAdjacentHTML('beforeend','<svg class="ck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'); });
    var cur=m.querySelector('button.on')||items[0]; if(cur) cur.focus();
    m.addEventListener('keydown',function(e){ var i=items.indexOf(document.activeElement); if(e.key==='ArrowDown'){ e.preventDefault(); items[(i+1)%items.length].focus(); } else if(e.key==='ArrowUp'){ e.preventDefault(); items[(i-1+items.length)%items.length].focus(); } else if(e.key==='Escape'){ e.preventDefault(); tfMyExMenu(false); if(b) b.focus(); } else if(e.key==='Tab'){ tfMyExMenu(false); } }); }
  if(!m&&had&&b&&document.activeElement&&document.activeElement.closest&&!document.activeElement.closest('.myex-w')){} }; })();
(function(){ var s0=tfMyExSet; tfMyExSet=function(){ var r=s0.apply(this,arguments); setTimeout(function(){ var b=document.querySelector('.myex'); if(b) b.focus(); },60); return r; }; })();
