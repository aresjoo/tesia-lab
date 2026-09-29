
/* 개요의 대화 화면. 모든 말은 펼친 채로 보인다. 첫 문장은 밝게, 부호가 붙은 퍼센트만 초록과 빨강.
   어려운 말에는 점선 밑줄이 붙고, 누르면 뜻이 나온다(말 하나에 같은 낱말은 한 번만) */
var MK_GLOSS={
 '되돌림 점수':'가격이 최근 얼마나 많이 내려왔는지를 0부터 100까지로 나타낸 값. 클수록 많이 내려온 상태다. 전략마다 정한 기준을 넘어야 매수를 검토한다.',
 '추적 손절':'가격이 오르면 파는 기준도 따라 올리는 방식. 가장 높았던 가격에서 정해 둔 폭만큼 내려오면 판다.',
 '이동평균':'최근 며칠 동안의 가격 평균. 60일 이동평균은 최근 60일 가격의 평균이다. 가격이 이 선 위에 있으면 오르는 흐름으로 본다.',
 '상승 추세':'가격이 꾸준히 오르는 흐름. 여기서는 가격이 60일 이동평균 위에 있는 상태를 말한다.',
 '실현 손익':'사고판 뒤 확정된 이익이나 손실. 아직 들고 있는 종목의 평가 손익과 구분한다.',
 '분산 보유':'한 종목에 몰지 않고 여러 종목에 나눠 드는 것.',
 '가용 자금':'지금 바로 주문에 쓸 수 있는 돈.',
 '기간 만료':'정해 둔 최대 보유 기간이 끝난 것. 이 전략은 25일이 지나면 결과와 관계없이 판다.',
 '체결가':'주문이 실제로 이루어진 가격.',
 '되돌림':'오르던 가격이 잠시 내려오는 움직임.',
 '모멘텀':'가격이 움직이는 힘. 최근에 많이 오른 종목일수록 모멘텀이 강하다고 한다.',
 '변동성':'가격이 오르내리는 폭. 변동성이 크면 하루 사이에도 가격이 크게 바뀐다.',
 '재평가':'보유 종목과 후보 종목을 정해진 날에 다시 비교하는 일.',
 '익절':'이익이 난 상태에서 팔아 이익을 확정하는 것.',
 '손절':'손실이 더 커지기 전에 팔아 손실을 확정하는 것.',
 '비중':'전체 자산 중 한 종목에 넣은 돈의 비율.',
 '관망':'사거나 팔지 않고 지켜보는 것.',
 '청산':'들고 있던 종목이나 포지션을 정리해 거래를 끝내는 것.',
 '진입':'새로 사거나 포지션을 여는 것.',
 '반등':'내리던 가격이 다시 오르는 움직임.',
 '종가':'하루 거래가 끝났을 때의 가격.',
 '고점':'일정 기간 중 가장 높았던 가격.',
 '현물':'코인이나 주식을 실제로 사서 보유하는 거래. 가격이 오르면 이익이 난다.',
 '선물':'실물을 사지 않고 가격의 방향에 거는 거래. 오르는 쪽(롱)과 내리는 쪽(숏) 모두 가능하다.',
 '매수':'사는 주문.',
 '매도':'파는 주문.',
 '롱':'가격이 오르면 이익이 나는 방향.',
 '숏':'가격이 내리면 이익이 나는 방향.'
};
var MK_GLOSS_K=Object.keys(MK_GLOSS).sort(function(a,b){ return b.length-a.length; }), MK_CHAT_N=0;
function mkGloss(html,body){
  var hold=[], out=html;
  MK_GLOSS_K.forEach(function(k){ if(body&&(k==='매수'||k==='매도')) return; var i=out.indexOf(k); if(i<0) return; hold.push(k); out=out.slice(0,i)+'\u0001'+(hold.length-1)+'\u0002'+out.slice(i+k.length); });
  return out.replace(/\u0001(\d+)\u0002/g,function(m,n){ var k=hold[+n]; return '<button type="button" class="mkg" data-g="'+k+'" aria-haspopup="dialog" onclick="mkGlossOpen(this,event)">'+k+'</button>'; });
}
function mkGlossClose(){ var p=$('mkg-pop'); if(p) p.remove(); var a=document.querySelector('.mkg[aria-expanded="true"]'); if(a) a.setAttribute('aria-expanded','false'); document.removeEventListener('click',mkGlossDoc,true); document.removeEventListener('keydown',mkGlossKey); var sc=$('g-scroll'); if(sc) sc.removeEventListener('scroll',mkGlossClose); window.removeEventListener('resize',mkGlossClose); }
function mkGlossDoc(e){ var p=$('mkg-pop'); if(p&&p.contains(e.target)) return; if(e.target.closest&&e.target.closest('.mkg')) return; mkGlossClose(); }
function mkGlossKey(e){ if(e.key==='Escape'){ var a=document.querySelector('.mkg[aria-expanded="true"]'); mkGlossClose(); if(a) try{ a.focus(); }catch(x){} } }
function mkGlossOpen(b,ev){
  if(ev) ev.stopPropagation();
  var was=b.getAttribute('aria-expanded')==='true'; mkGlossClose(); if(was) return;
  var k=b.getAttribute('data-g'), p=document.createElement('div'); p.id='mkg-pop'; p.className='mkg-pop'; p.setAttribute('role','dialog'); p.setAttribute('aria-label',k+' 뜻');
  p.innerHTML='<b>'+gEsc(k)+'</b><p>'+gEsc(mkPolite(MK_GLOSS[k]||'').split(/(?<=[.])s+/).map(function(x){ return /니다[.]$/.test(x)?x:x.replace(/[.]$/,'입니다.'); }).join(' '))+'</p>';
  document.body.appendChild(p); b.setAttribute('aria-expanded','true');
  var r=b.getBoundingClientRect(), w=p.offsetWidth, h=p.offsetHeight, x=Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2)), y=r.bottom+8; if(y+h>innerHeight-12) y=Math.max(12,r.top-h-8);
  p.style.left=x+'px'; p.style.top=y+'px';
  document.addEventListener('click',mkGlossDoc,true); document.addEventListener('keydown',mkGlossKey); var sc=$('g-scroll'); if(sc) sc.addEventListener('scroll',mkGlossClose); window.addEventListener('resize',mkGlossClose);
}
function mkChatBody(t){
  var j=t.search(/[.!?]\s/), head=j>0?t.slice(0,j+1):t, rest=j>0?t.slice(j+2):'';
  var col=function(x){ return x.replace(/([+\-]\d[\d,]*(?:\.\d+)?%)/g,function(m){ return '<i class="'+(m.charAt(0)==='+'?'up':'dn')+'">'+m+'</i>'; }); };
  var g=mkGloss(gEsc(head)+'\u0003'+gEsc(rest),true).split('\u0003');
  return '<strong>'+col(g[0])+'</strong>'+(g[1]?' '+col(g[1]):'');
}
function mkChatRow(s,m,first){
  return '<li class="mkc-m k-'+m.k+(first?' first':'')+'">'
    +'<div class="mkc-av" aria-hidden="true">'+mkGlyph(s,36)+'</div>'
    +'<div class="mkc-b"><div class="mkc-h"><b>'+gEsc(mkHook(s))+'</b><span class="mkc-tag">'+mkGloss(gEsc(m.tag))+'</span><time class="num">'+m.ts+'</time></div>'
    +'<div class="mkc-t"><p>'+mkChatBody(m.t)+'</p></div>'
    +(m.cnt?'<p class="mkc-n num">같은 판단 '+m.cnt+'회 연속, '+mkTS(s,m.from,null,3).replace(/ .*$/,'')+'부터</p>':'')
    +'</div></li>';
}
function mkChatMore(b){ var l=b.parentNode.querySelector('.mkc-list'); if(!l) return; l.classList.add('all'); b.remove(); }
function mkChatHtml(s,r,ne,pd){
  var ms=mkChatMsgs(s,r,6); if(!ms.length) return '';
  return '<section class="mk3-sec mkc"><div class="mk3-sec-h"><h3>판단 기록</h3></div>'
    +'<ol class="mkc-list">'+ms.map(function(m,i){ return mkChatRow(s,m,i===0); }).join('')+'</ol>'
    +(ms.length>3?'<button type="button" class="mkc-more" onclick="mkChatMore(this)">이전 기록 '+(ms.length-3)+'건 더 보기</button>':'')
    +'</section>';
}
