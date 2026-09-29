/* ═══ 선물 엔진: 롱과 숏, 레버리지, 펀딩비, 강제 청산 ═══
   자료: TETH_FUT(Bybit USDT 무기한 선물 일봉 o,h,l,c 와 그날 펀딩비 합계 f, 만분율).
   순서(하루): ① 전날 종가에 정한 주문을 그날 시가에 체결(미끄러짐 포함) ② 장중 고가와 저가로 강제 청산, 손절, 익절 확인
   ③ 하루 펀딩비 정산 ④ 종가로 다음 날 주문을 정함. AI 재평가 날은 달력에 고정한다(돌려 보는 기간을 바꿔도 같은 날). 같은 날 손절과 익절이 모두 닿으면 손절로 본다.
   격리 증거금: 한 포지션의 손실은 그 포지션에 넣은 증거금까지. 수수료는 체결 금액의 0.055%(시장가), 미끄러짐 0.05%.
   c = {fut:1, kind, asset | uni(list), mode, lev, ...} */
var MK_FUT_FEE=0.00055, MK_FUT_SLIP=0.0005, MK_FUT_MMR=0.005;
function fuD(k){ var d=window.TETH_FUT&&TETH_FUT.sym&&TETH_FUT.sym[k]; if(!d) throw new Error('fut data: '+k); return d; }
function fuSma(A,n,i){ var s=0; for(var k=i-n+1;k<=i;k++) s+=A[k]; return s/n; }
function fuMax(A,a,b){ var m=-Infinity; for(var k=a;k<=b;k++) if(A[k]>m) m=A[k]; return m; }
function fuMin(A,a,b){ var m=Infinity; for(var k=a;k<=b;k++) if(A[k]<m) m=A[k]; return m; }
function fuVol(C,i,n){ var s=0,q=0; for(var k=i-n+1;k<=i;k++){ var r=C[k]/C[k-1]-1; s+=r; q+=r*r; } var m=s/n; return Math.sqrt(Math.max(1e-12,q/n-m*m)); }
function fuFng(i){ var f=window.TETH_PX&&TETH_PX.fng; return f&&f[i]!=null?f[i]:null; }
function fuLedger(){
  var L={cash:1,pos:[],trades:[],fees:0,fund:0,seq:0,liq:0};
  L.eqOf=function(p,price){ return p.margin+p.side*p.units*(price-p.ep)-p.fund; };
  L.value=function(px){ var v=L.cash; L.pos.forEach(function(p){ v+=Math.max(0,L.eqOf(p,px(p.k))); }); return v; };
  L.open=function(k,side,amount,lev,price,i,meta){ amount=Math.min(amount,L.cash); if(!(amount>1e-9)||!(price>0)) return null;
    var fill=price*(1+side*MK_FUT_SLIP), fee=amount*lev*MK_FUT_FEE/(1+lev*MK_FUT_FEE), margin=amount-fee, units=margin*lev/fill;
    L.cash-=amount; L.fees+=fee; var p={id:++L.seq,k:k,side:side,lev:lev,units:units,ep:fill,margin:margin,cost:amount,fee:fee,fund:0,ei:i,best:fill,w:meta&&meta.w}; L.pos.push(p); return p; };
  /* 강제 청산 가격: 증거금에서 손익과 펀딩비를 빼고 남은 돈이 유지 증거금(체결 금액의 0.5%)과 같아지는 가격 */
  L.liqPx=function(p){ return p.ep-p.side*(p.margin-p.fund-MK_FUT_MMR*p.units*p.ep)/p.units; };
  L.close=function(p,price,i,why,raw){ var fill=raw?price:price*(1-p.side*MK_FUT_SLIP), fee=p.units*fill*MK_FUT_FEE, got=why==='liq'?0:Math.max(0,L.eqOf(p,fill)-fee);
    L.cash+=got; L.fees+=fee; L.fund+=p.fund; if(why==='liq') L.liq++; L.pos=L.pos.filter(function(x){ return x!==p; });
    var t={id:p.id,fut:1,entry:p.ei,exit:i,asset:p.k,side:p.side,lev:p.lev,ep:p.ep,xp:fill,units:p.side*p.units,cost:p.cost,got:got,fee:p.fee+fee,fund:p.fund,pnl:got/p.cost-1,kind:why,w:p.w}; L.trades.push(t); return t; };
  return L;
}
function mkFutRun(c){
  var U=c.asset?[c.asset]:c.uni, DT=U.map(fuD), N=DT[0].c.length, endI=N-1, J={}; U.forEach(function(k,j){ J[k]=j; });
  var need=Math.max(61,(c.n||0)+2,(c.look||0)+2,(c.reg||0)+2,(c.slow||0)+2), startI=Math.max(need,c.startI||61), lev=Math.max(1,Math.min(10,c.lev||1));
  var L=fuLedger(), eq=[], ev=[], pend=[], cur=startI, invested=0, px=function(k){ return DT[J[k]].c[cur]; };
  var top=Math.max(1,Math.min(4,c.top||1)), every=c.every||1, pickL=c.asset||null, pickS=c.asset||null, lastTop=null, regime=c.asset?2:0; /* 2=양쪽, 1=롱만, -1=숏만, 0=쉼 */
  function qClose(p,why,i,extra){ if(pend.some(function(o){ return o.t==='close'&&o.p===p; })) return; var e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:why,_pend:1}; if(extra) for(var k in extra) e[k]=extra[k]; ev.push(e); pend.push({t:'close',p:p,why:why,ev:e}); }
  function qOpen(k,side,w,i,extra){ var e={i:i,t:'enter',a:k,side:side,lev:lev,_pend:1}; for(var x in extra) e[x]=extra[x]; ev.push(e); pend.push({t:'open',k:k,side:side,w:w,ev:e}); }
  function fillExit(e,t){ delete e._pend; e.xi=t.exit; e.tid=t.id; e.px=t.xp; e.units=Math.abs(t.units); e.got=t.got; e.fee=t.fee; e.fund=t.fund; e.ep=t.ep; e.chg=t.side*(t.xp/t.ep-1)*100; e.pnl=t.pnl*100; }
  /* 규칙 신호: 그 종목의 그날 종가 기준. +1 롱 진입, -1 숏 진입, 0 없음 */
  function sig(j,i){ var D=DT[j], C=D.c, s=0;
    if(c.mode==='brk'){ if(C[i]>fuMax(D.h,i-c.n,i-1)) s=1; else if(C[i]<fuMin(D.l,i-c.n,i-1)) s=-1; }
    else if(c.mode==='ma'){ var f0=fuSma(C,c.fast,i), s0=fuSma(C,c.slow,i), f1=fuSma(C,c.fast,i-1), s1=fuSma(C,c.slow,i-1); if(f0>s0&&f1<=s1) s=1; else if(f0<s0&&f1>=s1) s=-1; }
    else if(c.mode==='fg'){ var g=fuFng(i), r=C[i]/C[i-1]-1; if(g!=null&&g<=c.lo&&r>0.005) s=1; else if(g!=null&&g>=c.hi&&r<-0.005) s=-1; }
    else if(c.mode==='dip'){ var r2=C[i]/C[i-1]-1, dd=C[i]/fuMax(D.h,i-c.n,i)-1, up=C[i]/fuMin(D.l,i-c.n,i)-1; if(dd<=-c.dip/100&&r2>0.005) s=1; else if(up>=c.dip/100&&r2<-0.005) s=-1; }
    if(s&&c.reg){ var m=fuSma(C,c.reg,i); if(s>0&&C[i]<m) s=0; if(s<0&&C[i]>m) s=0; }
    if(s>0&&c.dir==='short') s=0; if(s<0&&c.dir==='long') s=0;
    return s; }
  function scan(i){ var rows=U.map(function(k,j){ var C=DT[j].c, m=C[i]/C[i-c.look]-1, v=fuVol(C,i,20); return {k:k,j:j,mom:m,vol:v,score:m/(v*Math.sqrt(c.look)),above:C[i]>fuSma(C,60,i)}; });
    var up=rows.filter(function(r){ return r.above; }).length; rows.sort(function(a,b){ return b.score-a.score; }); return {rows:rows,up:up,of:U.length,br:up/U.length}; }
  for(var i=startI;i<=endI;i++){
    cur=i;
    /* ① 전날 정한 주문: 시가 체결. 닫고 나서 연다 */
    if(pend.length){ var opx=function(k){ return DT[J[k]].o[i]; };
      pend.forEach(function(o){ if(o.t!=='close'||L.pos.indexOf(o.p)<0){ if(o.t==='close') o.ev._drop=1; return; } var po=opx(o.p.k), lq=L.liqPx(o.p), gl=o.p.side>0?po<=lq:po>=lq; if(gl) o.ev.why='liq'; fillExit(o.ev,L.close(o.p,po,i,gl?'liq':o.why,gl)); });
      var tot=L.cash; L.pos.forEach(function(p){ tot+=Math.max(0,L.eqOf(p,opx(p.k))); });
      pend.forEach(function(o){ if(o.t!=='open') return; var p=L.open(o.k,o.side,o.w*tot,lev,opx(o.k),i,{w:o.w}), e=o.ev; if(!p){ e._drop=1; return; } delete e._pend; e.xi=i; e.tid=p.id; e.px=p.ep; e.units=p.units; e.cost=p.cost; e.fee=p.fee; e.liq=L.liqPx(p); });
      pend=[]; }
    /* ② 장중: 강제 청산, 손절, 고점 추적 손절, 익절 */
    L.pos.slice().forEach(function(p){ var D=DT[J[p.k]], o=D.o[i], hi=D.h[i], lo=D.l[i], fresh=p.ei===i;
      var liq=L.liqPx(p), stop=c.sl?p.ep*(1-p.side*c.sl/100):null, tr=(c.trail&&!fresh)?p.best*(1-p.side*c.trail/100):null, tp=c.tp?p.ep*(1+p.side*c.tp/100):null;
      var worse=function(a,b){ return a==null?b:b==null?a:(p.side>0?Math.max(a,b):Math.min(a,b)); }, s0=worse(stop,tr), hitAdv=function(x){ return x!=null&&(p.side>0?lo<=x:hi>=x); }, gap=function(x){ return p.side>0?o<=x:o>=x; };
      var e;
      /* 시가가 이미 강제 청산 가격이나 익절 가격을 넘어 시작한 날: 시가에서 먼저 처리한다 */
      if(!fresh&&(p.side>0?o<=liq:o>=liq)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'liq',ref:liq}; ev.push(e); fillExit(e,L.close(p,o,i,'liq',true)); return; }
      if(!fresh&&tp!=null&&(p.side>0?o>=tp:o<=tp)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'tp',ref:tp}; ev.push(e); fillExit(e,L.close(p,o,i,'tp',true)); return; }
      if(s0!=null&&(p.side>0?s0>liq:s0<liq)&&hitAdv(s0)){ var why=(tr!=null&&s0===tr)?'trail':'sl'; e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:why,ref:s0}; ev.push(e); fillExit(e,L.close(p,(!fresh&&gap(s0))?o:s0,i,why)); return; }
      if(hitAdv(liq)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'liq',ref:liq}; ev.push(e); fillExit(e,L.close(p,liq,i,'liq',true)); return; }
      if(tp!=null&&(p.side>0?hi>=tp:lo<=tp)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'tp',ref:tp}; ev.push(e); fillExit(e,L.close(p,(!fresh&&(p.side>0?o>=tp:o<=tp))?o:tp,i,'tp',true)); return; }
    });
    /* ③ 펀딩비: 롱은 펀딩비가 양수일 때 내고, 숏은 받는다 */
    L.pos.forEach(function(p){ var D=DT[J[p.k]]; p.fund+=p.side*p.units*D.c[i]*D.f[i]/1e4; if(p.side>0?D.c[i]>p.best:D.c[i]<p.best) p.best=D.c[i]; });
    /* ④ 종가로 다음 날 주문을 정한다 */
    var held=function(k){ return L.pos.filter(function(p){ return p.k===k; })[0]||null; };
    if(c.kind==='agent'){
      if((i+(c.ph||0))%every===0){ var S=scan(i), rk={}; S.rows.forEach(function(r,q){ rk[r.k]=q; }); var n=S.rows.length;
        var reg=c.neutral?2:(S.br>=c.gate?1:(S.br<=1-c.gate?-1:0)), wantL=(reg===1||reg===2)?S.rows.slice(0,top).filter(function(r){ return c.neutral||(r.above&&r.score>0); }):[], wantS=(reg===-1||reg===2)?S.rows.slice(n-top).filter(function(r){ return c.neutral||(!r.above&&r.score<0); }):[];
        if(c.dir==='long') wantS=[]; if(c.dir==='short') wantL=[];
        var top3=S.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100}; }), bot3=S.rows.slice(n-3).reverse().map(function(r){ return {k:r.k,mom:r.mom*100}; });
        var want={}; wantL.forEach(function(r){ want[r.k]=1; }); wantS.forEach(function(r){ want[r.k]=-1; });
        L.pos.slice().forEach(function(p){ if(want[p.k]!==p.side) qClose(p,want[p.k]?'flip':(reg===0?'rest':'rot'),i); });
        var slots=(c.neutral?2:1)*top, fresh2=0;
        [].concat(wantL.map(function(r){ return [r,1]; }),wantS.map(function(r){ return [r,-1]; })).forEach(function(x){ var r=x[0], sd=x[1], h=held(r.k); if(h&&h.side===sd) return; fresh2++;
          qOpen(r.k,sd,1/slots,i,{mom:r.mom*100,rank:sd>0?rk[r.k]+1:n-rk[r.k],up:S.up,of:S.of,top:top3,bot:bot3,w:1/slots}); });
        if(!fresh2) ev.push({i:i,t:(wantL.length+wantS.length)?'hold':'skip',why:reg===0?'gate':'none',up:S.up,of:S.of,top:top3,bot:bot3,held:L.pos.map(function(p){ return p.k; })}); }
    } else {
      if(c.kind==='mix'&&(i+(c.ph||0))%every===0&&!L.pos.length){ var S2=scan(i), n2=S2.rows.length, a=S2.rows[0], b=S2.rows[n2-1];
        regime=S2.br>=c.gate?1:(S2.br<=1-c.gate?-1:0); lastTop={up:S2.up,of:S2.of,top:S2.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100}; }),bot:S2.rows.slice(n2-3).reverse().map(function(r){ return {k:r.k,mom:r.mom*100}; })};
        var nl=regime>0?a.k:null, ns=regime<0?b.k:null;
        if(nl!==pickL||ns!==pickS){ pickL=nl; pickS=ns; ev.push(nl||ns?{i:i,t:'pick',a:nl||ns,side:nl?1:-1,mom:(nl?a:b).mom*100,up:S2.up,of:S2.of,top:lastTop.top,bot:lastTop.bot}:{i:i,t:'unpick',up:S2.up,of:S2.of}); } }
      var p0=L.pos[0]||null;
      /* 보유 중: 반대 신호나 출구 채널, 보유 기한 */
      if(p0&&!pend.length){ var jj=J[p0.k], D0=DT[jj], sg=sig(jj,i), out=null;
        if(c.exitN&&(p0.side>0?D0.c[i]<fuMin(D0.l,i-c.exitN,i-1):D0.c[i]>fuMax(D0.h,i-c.exitN,i-1))) out='chan';
        else if(c.hold&&i-p0.ei>=c.hold) out='time';
        if(sg&&sg!==p0.side&&(c.kind!=='mix'||regime===sg||regime===2)){ qClose(p0,'flip',i); qOpen(p0.k,sg,1,i,{n:c.n,ref:sg>0?fuMax(D0.h,i-(c.n||1),i-1):fuMin(D0.l,i-(c.n||1),i-1),fng:fuFng(i),up:lastTop&&lastTop.up,of:lastTop&&lastTop.of}); }
        else if(out) qClose(p0,out,i); }
      else if(!p0&&!pend.length){ var cand=c.kind==='mix'?[pickL,pickS].filter(function(k){ return k; }):[c.asset];
        cand.forEach(function(k){ if(pend.length) return; var j2=J[k], D2=DT[j2], s2=sig(j2,i); if(!s2) return;
          if(c.kind==='mix'){ var okSide=(k===pickL&&s2>0)||(k===pickS&&s2<0); if(!okSide){ ev.push({i:i,t:'veto',a:k,side:s2,up:lastTop&&lastTop.up,of:lastTop&&lastTop.of,reg:regime}); return; } }
          qOpen(k,s2,1,i,{n:c.n,ref:c.mode==='brk'?(s2>0?fuMax(D2.h,i-c.n,i-1):fuMin(D2.l,i-c.n,i-1)):null,chg1:(D2.c[i]/D2.c[i-1]-1)*100,fng:fuFng(i),up:lastTop&&lastTop.up,of:lastTop&&lastTop.of}); }); }
    }
    var v=L.value(px); eq.push({i:i,v:v}); invested+=v>0?(v-L.cash)/v:0;
    if(v<=1e-6){ for(var z=i+1;z<=endI;z++) eq.push({i:z,v:0}); break; }
  }
  ev=ev.filter(function(e){ return !e._pend&&!e._drop; });
  cur=endI;
  var r=mkStatsOf(eq,L,{startI:startI,endI:endI},startI,endI,invested), tv=L.value(px);
  r.events=ev; r.fut=1; r.liqN=L.liq; r.fundPaid=L.fund+L.pos.reduce(function(a,p){ return a+p.fund; },0); r.feesPaid=L.fees;
  r.state={asOf:endI,fut:1,cash:tv>0?L.cash/tv:1,pickL:pickL,pickS:pickS,regime:regime,top:lastTop,
    open:(function(a){ return c.kind==='agent'?a:(a[0]||null); })(L.pos.map(function(p){ var v2=px(p.k); return {held:endI-p.ei,k:p.k,tid:p.id,side:p.side,lev:p.lev,entry:p.ei,ep:p.ep,units:p.side*p.units,cost:p.cost,px:v2,chg:p.side*(v2/p.ep-1)*100,pnl:(Math.max(0,L.eqOf(p,v2))/p.cost-1)*100,liq:L.liqPx(p),w:tv>0?Math.max(0,L.eqOf(p,v2))/tv:0,fut:1}; }))};
  return r;
}
