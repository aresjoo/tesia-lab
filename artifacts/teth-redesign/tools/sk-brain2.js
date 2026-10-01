/* ═══ 판단 패널: AI 판단형과 혼합형, nof1식 "TETH의 생각"과 판단 기록 (sk-brain2) ═══
   복사한 전략이 있으면 오른쪽 패널에 그 전략의 판단 화면. 문장은 전략 상세와 같은 mkChatMsgs(미리 써 둔 MK_VOICE 포함).
   요약 두 문장 → 더 보기로 전문. 같은 결론이 이어지면 묶는다(mkChatMsgs 가 cnt 로 묶어 준다) */
var TB_CP=0;
function tbSent(t,n){ var a=String(t||'').split(/(?<=\.)\s+/); if(a.length<=n) return {head:t,rest:''}; return {head:a.slice(0,n).join(' '),rest:a.slice(n).join(' ')}; }
function tbThought(t,lab){ if(!t) return ''; var s=tbSent(t,2);
  return '<div class="tb-th"><p class="tb-thl">'+(lab||'TETH의 생각')+'</p><p class="tb-tht">'+gEsc(s.head)+(s.rest?'<span class="tb-more" hidden> '+gEsc(s.rest)+'</span> <button type="button" class="pl-link tb-mb" onclick="var m=this.previousElementSibling;m.hidden=!m.hidden;this.textContent=m.hidden?\'더 보기\':\'접기\'">더 보기</button>':'')+'</p></div>'; }
var TB_TAGC={buy:'tb-buy',sell:'tb-sell',hold:'',wait:'',pick:''};
function tbFeed(msgs){ var L=(msgs||[]).filter(function(m){ return m.k!=='now'&&m.k!=='intro'; }); if(!L.length) return '';
  return '<div class="tb-feed"><p class="tb-fh">판단 기록</p>'+L.map(function(m){ var s=tbSent(m.t,2);
    return '<details class="tb-fc"><summary><span class="tb-ft num">'+gEsc(m.ts||'')+'</span><b class="'+(TB_TAGC[m.k]||'')+'">'+gEsc(m.tag||'')+(m.cnt>1?' '+m.cnt+'회':'')+'</b><span class="tb-fs">'+gEsc(s.head)+'</span></summary>'+(s.rest?'<p class="tb-fr">'+gEsc(s.rest)+'</p>':'')+'</details>'; }).join('')+'</div>'; }
function tbHoldRows(s2){ var st=s2.r&&s2.r.state||{}, c=s2.cfg||{}, o=st.open, L=!o?[]:o.length!=null?o:[o], rows='';
  L.forEach(function(x){ var pc=+x.chg||0, tk=gEsc(mkTk(x.k)), side=x.side<0?'숏':'롱', lev=x.lev>1?' '+x.lev+'배':'', w=x.w!=null&&L.length>1?' '+Math.round(x.w*100)+'%':'';
    rows+=tbRow(tk+' '+side+lev,(w?'<span class="tb-w2">비중'+w+'</span> ':'')+'<i class="'+(pc>=0?'u':'d')+'">'+mkPct0(pc,1)+'</i>'); });
  if(!L.length) rows+=tbRow('포지션','없음');
  if(s2.kind==='mix'&&!L.length&&st.pick) rows+=tbRow('선정 종목',gEsc(mkTk(st.pick)));
  var rule=fuIs(s2)?(c.trail?'유리한 가격에서 '+c.trail+'% 되돌리면':c.sl?'진입가에서 '+c.sl+'% 불리하면':'방향이 바뀌면'):s2.kind==='agent'?'고점 대비 -'+c.trail+'%':(c.sl!=null?'손절 '+c.sl+'%, 익절 +'+c.tp+'%':'');
  if(rule) rows+=tbRow('정리 기준',rule);
  return rows; }
function tbTitle(s2){ var st=s2.r&&s2.r.state||{}, o=st.open, L=!o?[]:o.length!=null?o:[o];
  if(L.length) return mkJ(mkList(L.map(function(x){ return mkTk(x.k); })),'을','를')+' 들고 있습니다';
  if(s2.kind==='mix'&&st.pick) return mkTk(st.pick)+' 진입 신호를 기다리고 있습니다';
  return '현금으로 기다리고 있습니다'; }
function tbCopyBlock(c2){ var s2=tfSSFind(c2.nick); if(!s2||!s2.r) return '';
  var st=s2.r.state||{}, id=(acConnList&&acConnList()[0])||'bitget', ex=acName?acName(id):id;
  var nx=st.nextEval!=null?'다음 판단 '+mkMD(st.nextEval):'다음 판단 다음 거래일 종가';
  var msgs=[]; try{ msgs=mkChatMsgs(s2,s2.r,6)||[]; }catch(e){}
  var now=null; try{ var nt=mkChatNow(s2,s2.r); if(nt) now={t:nt}; }catch(e){} if(!now) now=msgs.filter(function(m){ return m.k==='now'; })[0];
  var kind=s2.kind==='agent'?'AI 판단':s2.kind==='mix'?'혼합 전략':'차트 규칙';
  return '<div class="tm-status tb st-live">'
    +'<p class="tb-k">'+gEsc(mkTitle(s2))+'<span>'+kind+', 복사한 전략</span></p>'
    +'<h3 class="tb-t">'+tbTitle(s2)+'</h3>'
    +'<p class="tb-d">'+tbIcon(id)+'<span>'+gEsc(ex)+'에서 운용 중, '+nx+'</span></p>'
    +'<div class="tb-list">'+tbHoldRows(s2)+'</div>'
    +'</div>'
    +tbThought(now&&now.t)
    +tbFeed(msgs)
    +'<div class="tb-foot"><button type="button" class="cq-gray tb-gray" onclick="cpDetailGo(\''+c2.id+'\')">복사 관리</button><button type="button" class="pl-link" onclick="tfShareHub()">전략 더 찾기</button></div>'; }
(function(){
  if(typeof pxTermSide!=='function') return;
  var p0=pxTermSide;
  pxTermSide=function(){ var act=[]; try{ act=cpState().copies.filter(function(x){ return x.status==='active'&&tfSSFind(x.nick); }); }catch(e){}
    if(!act.length) return p0.apply(this,arguments);
    if(TB_CP>=act.length) TB_CP=0;
    var sel=act.length>1?'<div class="tb-cps">'+act.map(function(c,i){ var s=tfSSFind(c.nick); return '<button type="button" class="'+(i===TB_CP?'on':'')+'" onclick="TB_CP='+i+';var b=document.getElementById(\'tft-brainin\');if(b)b.innerHTML=pxTermSide()">'+gEsc(s?mkTitle(s):c.nick)+'</button>'; }).join('')+'</div>':'';
    return '<div class="tb-copy">'+sel+tbCopyBlock(act[TB_CP])+'</div>'; };
})();
/* 규칙형(내 전략, 미리 보기)에도 "TETH의 생각" 두세 문장 */
(function(){
  if(typeof tfTmStatusBlock!=='function') return;
  var b0=tfTmStatusBlock;
  tfTmStatusBlock=function(s,c){ var h=b0.apply(this,arguments); try{
    var p=s.p||{}, tk=tfAssetTicker(s.asset), t='';
    if(c.pos&&s.status==='live'){ var pc=c.pos.chg*100, room=c.pos.curP&&c.pos.stopP?(c.pos.curP/c.pos.stopP-1)*100:null, left=Math.max(0,25-c.pos.bars);
      t=tk+' 롱을 '+c.pos.bars+'일째 들고 있고 지금 '+tfTmPct(pc,1)+'입니다. '+(room!=null?'손절가까지 '+room.toFixed(1)+'% 여유가 있어 서두를 이유는 없다고 봅니다. ':'')+(c.pos.tpP?'익절 목표 +'+p.tp+'%에 닿거나 ':'')+left+'일 뒤 보유 한도가 되면 정리합니다.'; }
    else if(s.status==='live') t='지금은 포지션 없이 기다리고 있습니다. RSI가 '+p.rsiTh+' 아래로 눌렸다가 하루 0.5% 넘게 반등하는 날에만 들어갑니다. 조건이 맞지 않는 날은 주문을 내지 않습니다.';
    else if(s.status==='off') t='일시정지 중이라 새 주문을 내지 않습니다. 다시 시작하면 다음 봉 마감부터 판단합니다.';
    if(t) h=h.replace(/<\/div>$/,'</div>'+tbThought(t));
  }catch(e){} return h; };
})();
