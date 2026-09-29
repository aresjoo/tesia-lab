/* 수익 낸 거래를 횟수로 말한다. 10번 미만은 실제 횟수 그대로, 그 이상은 10번 기준으로 환산 */
function mkWinTxt(r){
  var n=r&&r.n||0, w=r&&r.winRate; if(!n||typeof w!=='number'||!isFinite(w)) return '';
  if(n<10) return n+'번 중 '+Math.round(w*n/100)+'번';
  var k=Math.round(w/10); if((k===0&&w>0)||(k===10&&w<100)) return Math.round(w)+'%';
  return '10번 중 약 '+k+'번';
}
function mkFwTxt(n){ n=+n||0; if(n<=0) return ''; return (n>=10000?'약 '+(Math.round(n/1000)/10)+'만 명':n.toLocaleString()+'명')+'이 따라가는 중'; }
function mkCard(s){
  if(!s.kind) s.kind='rule';
  var r=tfSS3PdCalc(s,'all'), m30=mk30(s), ne=tfSS3Rid(s), ex=mkEx(s), win=mkWinTxt(r), fw=mkFwTxt(s.fw);
  var bF='<button type="button" class="mk3-b" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>', bD='<button type="button" class="mk3-b fill" onclick="tfSS3Go(\''+ne+'\')">자세히</button>';
  return '<article class="mk-card mk3 mk3v2 k-'+s.kind+'">'
    +'<div class="mk3-head">'+mkGlyph(s,28)+'<div class="mk3-hd"><h3><button type="button" class="mk-c-tb mk3-t" onclick="tfSS3Go(\''+ne+'\')">'+gEsc(mkHook(s))+'</button></h3>'+(s.by?'<span class="mk3-by">@'+gEsc(s.by)+'</span>':'')+'</div></div>'
    +'<div class="mk3-how"><b>'+MK_KIND[s.kind]+'</b><span>'+gEsc(mkScope(s))+'</span><i class="mk3-ex"><img src="assets/logos/'+ex[0]+'.png" alt="" width="12" height="12" loading="lazy">'+ex[1]+'에서 실행</i></div>'
    +'<p class="mk-c-one mk3-one">'+gEsc(mkOne(s)).replace(/%(?=[가-힣])/g,'%⁠')+'</p>'
    +'<div class="mk3-now"><small>지금</small><span>'+gEsc(mkNowLine(s))+'</span></div>'
    +'<div class="mk3-perf"><div class="mk-c-ret mk3-ret"><small>30일 수익률</small><b class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</b></div>'+mkSpark3(m30.eq)+'</div>'
    +'<div class="mk3-facts">'+(win?'<div><small>수익 낸 거래</small><b class="num">'+win+'</b></div>':'')+(fw?'<div class="mk3-fw num">'+fw+'</div>':'')+'</div>'
    +'<div class="mk3-foot">'+(s.me?'':bF)+bD+'</div>'
    +'</article>';
}
