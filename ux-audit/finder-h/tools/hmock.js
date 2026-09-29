/* 전략 찾기 검수 H1, H4, H5, H6 의 시안을 실제 화면에 얹는다. 제품 코드는 고치지 않는다 */
window.HM={base:{mkOvKpi:mkOvKpi,mkCard:mkCard,mkdChartHtml:mkdChartHtml,mkdTicks:mkdTicks,tfSS3CalHtml:tfSS3CalHtml}};
HM.reset=function(){ mkOvKpi=HM.base.mkOvKpi; mkCard=HM.base.mkCard; mkdChartHtml=HM.base.mkdChartHtml; mkdTicks=HM.base.mkdTicks; tfSS3CalHtml=HM.base.tfSS3CalHtml; var o=document.getElementById('hm-css'); if(o) o.remove(); };
HM.css=function(t){ var o=document.getElementById('hm-css'); if(!o){ o=document.createElement('style'); o.id='hm-css'; document.head.appendChild(o); } o.textContent=t; };
HM.cell=function(l,k,v,sg){ return '<div><small>'+mkdTerm(l,MK_TIP[k])+'</small><b class="num'+(sg||'')+'">'+v+'</b></div>'; };
HM.h1=function(v){
  mkOvKpi=function(s,per){
    var r=per?mkSlice(s,per):s.r, a=s.r, w=(typeof a.winRate==='number'&&(a.n||0)>=5)?Math.round(a.winRate)+'%':'-', n=Number(a.n||0).toLocaleString()+'회';
    var c1=HM.cell(MK_PER_L[per]+' 수익률','ret',mkPct0(r.ret),mkSign(r.ret)), c2=HM.cell('최대 낙폭','mdd',r.mdd.toFixed(1)+'%');
    if(v===1) return '<div class="mk3-kpis num">'+c1+c2+HM.cell('승률 (전체 기간)','win',w)+HM.cell('거래 수 (전체 기간)','n',n)+'</div>';
    if(v===2) return '<div class="mk3-kpis num">'+c1+c2+HM.cell('승률','win',w)+HM.cell('거래 수','n',n)+'</div><p class="hm-note">승률과 거래 수는 전체 기간</p>';
    return '<div class="mk3-kpis num hm-k3">'+c1+c2+HM.cell('전체 기간 거래 '+n.replace('회','')+'회 중 승률','win',w)+'</div>';
  };
  HM.css('.hm-note{margin:-6px 0 14px;text-align:right;font-size:12px;color:var(--gt3)}@media (min-width:641px){#g-root .hm-k3{grid-template-columns:repeat(3,1fr)}}');
};
HM.h4=function(v){
  if(v==='C') return;
  mkCard=function(s){
    var h=HM.base.mkCard(s), r=tfSS3PdCalc(s,'all'), m30=mk30(s);
    var a=h.indexOf('<div class="mk3-facts">'), b=h.indexOf('<div class="mk3-foot">');
    var fw=s.fw?mkFwHtml(s.fw):'';
    if(v==='A'){
      var f='<div class="mk3-facts"><div class="hm-two"><span><small>전체 기간</small><b class="num'+mkSign(r.ret)+'">'+mkPct0(r.ret)+'</b></span><span><small>최대 낙폭</small><b class="num">'+r.mdd.toFixed(1)+'%</b></span></div>'+fw+'</div>';
      return h.slice(0,a)+f+h.slice(b);
    }
    var f2='<div class="mk3-facts"><div><small>최대 낙폭</small><b class="num">'+r.mdd.toFixed(1)+'%</b></div>'+fw+'</div>';
    h=h.slice(0,a)+f2+h.slice(b);
    var x='<small>30일 수익률</small><b class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</b>';
    if(h.indexOf(x)<0) return h;
    return h.replace(x,function(){ return '<small>전체 기간 수익률</small><b class="num'+mkSign(r.ret)+'">'+mkPct0(r.ret)+'</b><small class="hm-sub">최근 30일 <i class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</i></small>'; });
  };
  HM.css('.hm-two{display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}.hm-two span{display:inline-flex;gap:7px;align-items:baseline}.hm-sub{display:block;margin-top:4px}.hm-sub i{font-style:normal}.hm-sub i.up{color:#2ebd85}.hm-sub i.dn{color:#f0566a}');
};
HM.flat=function(){ var P=mkdSeries(); return P.length>1&&P.every(function(p){ return Math.abs(p.y-P[0].y)<1e-9; }); };
HM.h5=function(v){
  if(v===1){
    mkdTicks=function(a,b,n){ if(a===b){ var pad=MKD.tab==='ret'?1:10; return [a-pad,a,a+pad]; } return HM.base.mkdTicks(a,b,n); };
    mkdChartHtml=function(){ var h=HM.base.mkdChartHtml(); return HM.flat()?h+'<div class="hm-flat">이 기간에는 거래 없이 현금으로 있었어요</div>':h; };
    HM.css('.hm-flat{position:absolute;left:54px;right:6px;top:34%;text-align:center;font-size:13px;color:var(--gt3);pointer-events:none}');
  } else {
    mkdChartHtml=function(){ if(!HM.flat()) return HM.base.mkdChartHtml(); var W=mkChartW(), H=W<560?236:280; return '<div class="hm-box" style="height:'+Math.round(H*(document.getElementById('mkd-chart')||{offsetWidth:W}).offsetWidth/W)+'px">이 기간에는 거래 없이 현금으로 있었어요</div>'; };
    HM.css('.hm-box{display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08);border-radius:12px;font-size:13.5px;color:var(--gt3)}');
  }
};
HM.h6=function(v){
  tfSS3CalHtml=function(r,m){ var h=HM.base.tfSS3CalHtml(r,m);
    return h.replace(/끝난 거래 (\d+)건, 승률 (\d+)%/,function(x,n,w){ return (v===2&&+n>=5)?x:'끝난 거래 '+n+'건'; }); };
};
