/* T3 independent code sketch. Input: G4/T3/decision-1.md, N1.
   Existing engines, copy ledger and T2 history remain the owners of their data. */
(function () {
  'use strict';
  var D = G4T1Data, KEY = 'g4.t3.detail', HANDOFF = 'g4.t1.handoff';
  var current = null, frame = 0;
  var oldHead = mk3Head, oldOverview = mkOvTab, oldDetail = tfSS3DetailRender;
  var oldContent = gContent, oldSave = D.save, oldSet = mkdSet;
  var labels = {
    ko: ['전략 복사','$1,000 넣었다면 지금','그냥 들고 있었다면','차이','전체','최근 1년','최근 30일','기간 선택','전략','그냥 들고 있기','지금','다음 판단','TETH의 판단 기록','최근 체결 내역','전체 거래 내역 보기','직접 검증하기','TETH에게 분석시키기','영원히 무료, 카드 등록 필요없음','복사 중','내 돈','예산 조정','복사 예산','최소','연결 완료','에서 실행','연결 후 실행','전략 정보','관심 전략','링크 복사','막히면 상담원이 24시간 답합니다.','상담원에게 묻기','신호','체결','전체 판단 기록','상세로 돌아가기','넣은 돈'],
    en: ['Copy strategies','If you invested $1,000','If you had held','Difference','All time','Past year','Past 30 days','Period','Strategy','Buy and hold','Now','Next decision','TETH decisions','Recent orders','View all orders','Verify yourself','Ask TETH to analyze','Free forever, no card needed','Copying','My balance','Adjust budget','Copy budget','Minimum','Connected','Execution on','Connect to run','Strategy details','Watchlist','Copy link','Support answers 24/7.','Ask support','Signal','Execution','All decisions','Back to strategy','Invested'],
    ja: ['戦略コピー','$1,000を入れていたら','そのまま保有していたら','差額','全期間','過去1年','過去30日','期間','戦略','そのまま保有','現在','次の判断','TETHの判断記録','最近の注文','すべての注文を見る','自分で検証','TETHに分析を依頼','ずっと無料、カード登録不要','コピー中','自分の残高','予算を調整','コピー予算','最低','接続済み','実行先','接続して実行','戦略情報','ウォッチリスト','リンクをコピー','サポートは24時間対応します。','サポートに相談','シグナル','約定','すべての判断','戦略に戻る','投資額'],
    'zh-CN': ['策略跟单','投入$1,000后现在','如果一直持有','差额','全部','近一年','近30天','期间','策略','一直持有','当前','下次判断','TETH判断记录','最近订单','查看全部订单','自行验证','让TETH分析','永久免费，无需绑卡','跟单中','我的资金','调整预算','跟单预算','最低','已连接','执行交易所','连接后执行','策略信息','自选策略','复制链接','客服24小时解答。','联系客服','信号','成交','全部判断','返回策略','投入金额'],
    'zh-TW': ['策略跟單','投入$1,000後現在','如果一直持有','差額','全部','近一年','近30天','期間','策略','一直持有','目前','下次判斷','TETH判斷紀錄','最近訂單','查看全部訂單','自行驗證','讓TETH分析','永久免費，無需綁卡','跟單中','我的資金','調整預算','跟單預算','最低','已連接','執行交易所','連接後執行','策略資訊','自選策略','複製連結','客服24小時解答。','聯絡客服','訊號','成交','全部判斷','返回策略','投入金額'],
    es: ['Copiar estrategias','Si hubieras invertido $1,000','Si hubieras mantenido','Diferencia','Todo','Último año','Últimos 30 días','Período','Estrategia','Comprar y mantener','Ahora','Próxima decisión','Decisiones de TETH','Órdenes recientes','Ver todas las órdenes','Verificar','Pedir análisis a TETH','Gratis para siempre, sin tarjeta','Copiando','Mi saldo','Ajustar presupuesto','Presupuesto','Mínimo','Conectado','Ejecución en','Conectar para ejecutar','Detalles','Favoritos','Copiar enlace','Soporte disponible las 24 horas.','Contactar soporte','Señal','Ejecución','Todas las decisiones','Volver a la estrategia','Invertido'],
    fr: ['Copier des stratégies','Avec $1,000 investis','En conservant les actifs','Écart','Tout','Dernière année','30 derniers jours','Période','Stratégie','Conserver les actifs','Maintenant','Prochaine décision','Décisions de TETH','Ordres récents','Voir tous les ordres','Vérifier','Demander une analyse à TETH','Gratuit pour toujours, sans carte','Copie active','Mon solde','Ajuster le budget','Budget de copie','Minimum','Connecté','Exécution sur','Connecter pour exécuter','Détails','Favoris','Copier le lien','Assistance disponible 24 h/24.','Contacter l’assistance','Signal','Exécution','Toutes les décisions','Retour à la stratégie','Investi']
  };
  var timeNotes = {
    ko:'신호는 판단한 시각, 체결은 그 판단에 따른 주문이 실행된 시각입니다.',
    en:'Signal time records a decision; execution time records when its order was filled.',
    ja:'シグナルは判断した時刻、約定はその注文が成立した時刻です。',
    'zh-CN':'信号时间是作出判断的时间，成交时间是对应订单执行的时间。',
    'zh-TW':'訊號時間是作出判斷的時間，成交時間是對應訂單執行的時間。',
    es:'La señal indica cuándo se decidió; la ejecución, cuándo se completó la orden.',
    fr:'Le signal indique la décision ; l’exécution indique quand son ordre a été exécuté.'
  };
  function lang() { return typeof GLC !== 'undefined' && labels[GLC.lang] ? GLC.lang : 'ko'; }
  function L(i) { return labels[lang()][i]; }
  function esc(v) { return gEsc(String(v == null ? '' : v)); }
  function money(v, cents) { return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }); }
  function pct(v) { return (v >= 0 ? '+' : '') + Number(v).toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%'; }
  function delta(v) { return (v >= 0 ? '+' : '−') + money(Math.abs(v)); }
  function read(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function write(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function real(s) { return !!(s && s.cfg && !s.me && !s.mine); }
  function per(v) { return [0, 365, 30].indexOf(+v) >= 0 ? +v : 0; }
  function route(s) { return '#/share/s/' + encodeURIComponent(s.id) + '/all'; }
  function state(s) { var x = read(KEY); return x && x.id === s.id ? x : {id:s.id, per:0, y:0}; }
  function day(i) {
    var d = idxToDate(i);
    return lang() === 'ko' ? d.getFullYear() + '. ' + (d.getMonth()+1) + '. ' + d.getDate() + '.' : d.toLocaleDateString(lang());
  }
  function copyFor(s) { return D.mine().find(function (x) { return x.s.id === s.id; }) || null; }
  function budget(s) { var h = D.handoff(); return h && h.strategyId === s.id && Number.isFinite(h.budget) && h.budget > 0 ? h.budget : 1000; }
  function copyLabel(s) {
    var amount = money(budget(s)), c = lang();
    return c === 'ko' ? amount + '으로 복사' : c === 'ja' ? amount + 'でコピー' : c === 'zh-TW' ? amount + '跟單' : c === 'zh-CN' ? amount + '跟单' : c === 'es' ? 'Copiar con ' + amount : c === 'fr' ? 'Copier avec ' + amount : 'Copy with ' + amount;
  }
  function followers(s) {
    var n = Number(s.fw || 0).toLocaleString('en-US'), c = lang();
    return c === 'ko' ? n + '명이 따라가는 중' : c === 'ja' ? n + '人がコピー中' : /^zh/.test(c) ? n + '人跟单中' : c === 'es' ? n + ' personas copiando' : c === 'fr' ? n + ' personnes copient' : n + ' people copying';
  }
  function series(s, p) {
    p = per(p);
    if (p !== 30) return D.results(s, p);
    // N1 explicitly retains the recent-30-day slice; it is not a new engine run.
    var r = mkSlice(s, 30), eq = r.eq, first = eq[0].i, prices = mkUni(s).list.map(mkPx);
    var hold = eq.map(function (point) { return prices.reduce(function (sum, px) { return sum + px[point.i] / px[first]; }, 0) / prices.length; });
    return {r:r, eq:eq, bench:hold, i0:first, T:eq[eq.length-1].i, final:1000*eq[eq.length-1].v, benchFinal:1000*hold[hold.length-1], ret:r.ret};
  }
  function curve(r) {
    var values = r.eq.map(function (p) { return p.v; }).concat(r.bench), lo = Math.min.apply(null,values), hi = Math.max.apply(null,values), span = hi-lo || 1;
    var n = r.eq.length, width = 720, height = 224;
    function path(hold) { return r.eq.map(function (p,j) { return (j?'L':'M') + (6+j/Math.max(1,n-1)*(width-12)).toFixed(2) + ',' + (12+(1-((hold?r.bench[j]:p.v)-lo)/span)*(height-24)).toFixed(2); }).join(' '); }
    return '<figure class="t3-curve" data-strategy-end="'+r.final+'" data-hold-end="'+r.benchFinal+'">'
      +'<svg viewBox="0 0 720 224" preserveAspectRatio="none" role="img" aria-label="'+esc(L(8)+' '+money(r.final)+', '+L(9)+' '+money(r.benchFinal))+'">'
      +'<path class="t3-grid" d="M6 12H714 M6 112H714 M6 212H714"/><path class="t3-hold" d="'+path(true)+'"/><path class="t3-line" d="'+path(false)+'"/></svg>'
      +'<figcaption><span>'+esc(day(r.i0))+'</span><span>'+esc(day(r.eq[n-1].i))+'</span></figcaption></figure>';
  }
  function periodPicker(p) {
    return '<label class="t3-period"><span>'+L(7)+'</span><select class="mkd-per" aria-label="'+L(7)+'" onchange="G4T3.period(this.value)">'
      +[[0,4],[365,5],[30,6]].map(function (x) { return '<option value="'+x[0]+'"'+(p===x[0]?' selected':'')+'>'+L(x[1])+'</option>'; }).join('')+'</select></label>';
  }
  function proof(s,p) {
    var r = series(s,p), diff = Math.round(r.final)-Math.round(r.benchFinal);
    return '<section class="t3-proof" aria-label="'+L(8)+'" data-period="'+p+'"><div class="t3-proof-top"><p>'+L(1)+'</p>'+periodPicker(p)+'</div>'
      +'<div class="t3-money"><strong class="t3-final num" data-value="'+r.final+'">'+money(r.final)+'</strong><span class="num '+(r.ret>=0?'up':'dn')+'">'+pct(p===0?s.r.ret:r.ret)+'</span></div>'
      +'<p class="t3-range">'+esc(day(r.i0))+' → '+esc(day(r.eq[r.eq.length-1].i))+'</p>'
      +'<div id="t3-chart">'+curve(r)+'</div><div class="t3-compare"><span><i class="t3-key"></i>'+L(8)+' <b class="num">'+money(r.final)+'</b></span>'
      +'<span><i class="t3-key dashed"></i>'+L(2)+' <b class="num">'+money(r.benchFinal)+'</b></span></div>'
      +'<p class="t3-difference">'+L(3)+' <span class="num '+(diff>=0?'up':'dn')+'">'+delta(diff)+'</span></p></section>';
  }
  function now(s,row) {
    return '<section class="t3-now"><div><span class="t3-eyebrow">'+L(10)+'</span><p>'+esc(D.pos(s,row))+'</p></div><p class="t3-next">'+L(11)+' <time>'+esc(tbNextClose())+'</time></p></section>';
  }
  function records(s) {
    var messages = mkChatMsgs(s,s.r,8).filter(function(m){return m.k!=='now'&&m.k!=='intro';});
    function item(m) {
      // Signals and executed orders have separate timestamps. Do not relabel a signal as a fill.
      var signal = m.ts || day(m.i), text = skdText(m.t || ''), split = tbSent(text,1);
      return '<li><details><summary><span class="t3-record-meta"><time>'+L(31)+' '+esc(signal)+'</time><span>'+esc(skdText(m.tag))+'</span></span><span class="t3-record-head">'+esc(split.head)+'</span></summary>'
        +(split.rest?'<p>'+esc(split.rest)+'</p>':'')+'</details></li>';
    }
    return '<section class="t3-records" aria-labelledby="t3-record-title"><h2 id="t3-record-title">'+L(12)+'</h2><p class="t3-record-note">'+timeNotes[lang()]+'</p><ol>'+messages.slice(0,2).map(item).join('')+'</ol>'
      +(messages.length>2?'<details class="t3-more-records"><summary>'+L(33)+'</summary><ol>'+messages.slice(2).map(item).join('')+'</ol></details>':'')+'</section>';
  }
  function orders(s,ne) {
    var rows = mkOrders(s);
    return '<section class="t3-orders"><div class="t3-section-head"><h2>'+L(13)+'</h2><button class="t3-link" type="button" onclick="G4T3.orders()">'+L(14)+' ('+rows.length+')</button></div>'
      +'<p class="t3-order-note">'+L(32)+' / $1,000</p>'+mkOrdersTable(s,rows.slice(0,3))+'</section>';
  }
  function action(s,row,mobile) {
    var ex = D.exchange(s), connected = D.linked().indexOf(ex)>=0, r = series(s,current && current.s.id===s.id ? current.per : per(state(s).per)), id = mobile?'t3-mobile-copy':'t3-copy';
    if(mobile) return '<div class="t3-mobile-bar"><div><span>'+L(row?19:1)+'</span><strong class="num">'+(row?money(row.d.value,true):'$1,000 → '+money(r.final))+'</strong></div>'
      +'<button id="'+id+'" class="t3-primary" type="button" onclick="G4T3.copy()">'+(row?L(20):copyLabel(s))+'</button></div>';
    return '<aside class="t3-action"><p class="t3-eyebrow">'+L(row?18:21)+'</p><strong class="t3-budget num">'+money(row?row.d.value:budget(s),!!row)+'</strong>'
      +'<p class="t3-action-name">'+esc(mkHook(s))+'</p><p class="t3-exchange">'+mkExTag(s)+'<span>'+L(connected?23:25)+'</span></p>'
      +'<button id="'+id+'" class="t3-primary" type="button" onclick="G4T3.copy()">'+(row?L(20):copyLabel(s))+'</button>'
      +(!row?'<p class="t3-free">'+L(17)+'</p><p class="t3-min">'+L(22)+' '+money(mkMin(s))+'</p>':'')
      +'<div class="t3-secondary"><button class="t3-link" type="button" onclick="G4T3.verify()">'+L(15)+'</button><button class="t3-link" type="button" onclick="G4T3.analyze()">'+L(16)+'</button></div></aside>';
  }
  mk3Head = function(s,ne,pd,watching) {
    if(!real(s)) return oldHead.apply(this,arguments);
    var row = copyFor(s);
    return '<header class="t3-header"><div><div class="t3-title-row"><h1>'+esc(mkHook(s))+'</h1>'+(row?'<span class="t3-copying">'+L(18)+'</span>':'')+'</div>'
      +'<p>'+mkExTag(s)+'<span>'+esc(MK_KIND[s.kind])+'</span><span>'+esc(followers(s))+'</span></p></div>'
      +'<details class="t3-menu"><summary aria-label="'+L(26)+'">⋯</summary><div><button type="button" onclick="tfSS3WatchTgl(\''+ne+'\')">'+L(27)+'</button>'
      +'<button type="button" onclick="tfSS3CopyLink(\''+ne+'\',\'all\')">'+L(28)+'</button></div></details></header>';
  };
  mkOvTab = function(s,r,pd,ne) {
    if(!real(s)) return oldOverview.apply(this,arguments);
    var x=state(s), row=copyFor(s); current={s:s,per:per(x.per),row:row,ne:ne};
    MKD.s=s; MKD.per=current.per; MKD.tab='bal'; MKD.gran='day'; MKD.eq=s.r.eq;
    return '<div class="t3-layout"><div class="t3-main">'
      +(row?'<div class="t3-owned"><span>'+L(19)+'</span><strong>'+money(row.d.value,true)+'</strong><small>'+L(35)+' '+money(row.d.inv,true)+'</small></div>':'')
      +'<div id="t3-proof-host">'+proof(s,current.per)+'</div>'+now(s,row)
      +'<nav class="t3-mobile-secondary"><button class="t3-link" type="button" onclick="G4T3.verify()">'+L(15)+'</button><button class="t3-link" type="button" onclick="G4T3.analyze()">'+L(16)+'</button></nav>'
      +records(s)+orders(s,ne)+'<details class="t3-info"><summary>'+L(26)+'</summary><p>'+esc(mkOne(s))+'</p>'+mkInfoTab(s,r,ne)+'</details></div>'
      +action(s,row,false)+'</div>'+action(s,row,true)+'<p class="t3-help">'+L(29)+' <button class="t3-link" type="button" onclick="tfTxHelp()">'+L(30)+'</button></p>';
  };
  function preserve() {
    if(!current) return;
    var sc=$('g-scroll'), y=document.body.classList.contains('gft-doc')?window.scrollY:sc?sc.scrollTop:0;
    write(KEY,{id:current.s.id,per:current.per,y:y});
  }
  function handoff() {
    if(!current) return null;
    preserve(); var h=D.save(current.s.id,budget(current.s));
    h.per=current.per; h.returnTo=route(current.s); write(HANDOFF,h); return h;
  }
  D.save = function(id,amount) {
    var prev=read(HANDOFF), v=oldSave.apply(this,arguments);
    if(v) { var x=read(KEY); v.per=x&&x.id===v.strategyId?per(x.per):prev&&prev.strategyId===v.strategyId?per(prev.per):0; write(HANDOFF,v); }
    return v;
  };
  function countIn(s) {
    var seenKey='g4.t3.seen.'+s.id, pos=read('g4.t2.pos');
    if(read(seenKey)||pos&&pos.id===encodeURIComponent(s.id)) { write(seenKey,true); return; }
    write(seenKey,true);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var el=document.querySelector('.t3-final'); if(!el) return;
    var target=+el.dataset.value, start=null;
    el.textContent=money(1000);
    frame=requestAnimationFrame(function step(t) {
      if(!el.isConnected) return;
      if(start===null) start=t;
      var p=Math.max(0,Math.min(1,(t-start)/600));
      el.textContent=money(1000+(target-1000)*(1-Math.pow(1-p,3)));
      if(p<1) frame=requestAnimationFrame(step);
    });
  }
  tfSS3DetailRender = function(ne,pd,tab) {
    var s; try{s=tfSSFind(decodeURIComponent(ne));}catch(_){}
    if(!real(s)) return oldDetail.apply(this,arguments);
    var restore=state(s), v=oldDetail.apply(this,arguments), page=document.querySelector('#g-content .mk-detail');
    if(!page) return v;
    page.querySelectorAll(':scope > .g4-n1,:scope > a.g4-back').forEach(function(el){el.remove();});
    page.classList.add('t3-detail'); page.lang=lang(); document.body.classList.add('g4-t3');
    var nav=page.querySelector('.mk-dtabs'); if(nav) nav.hidden=true;
    var crumb=page.querySelector('.tfbk-bc');
    if(crumb) crumb.innerHTML='<button type="button" class="t3-link" onclick="G4T3.'+(!tab||tab==='ov'?'back':'overview')+'()">← '+L(!tab||tab==='ov'?0:34)+'</button>';
    current={s:s,per:per(restore.per),row:copyFor(s),ne:encodeURIComponent(s.id)};
    if(!tab||tab==='ov') {
      if(restore.y) requestAnimationFrame(function(){var sc=$('g-scroll');if(document.body.classList.contains('gft-doc'))window.scrollTo(0,restore.y);else if(sc)sc.scrollTop=restore.y;});
      countIn(s);
      if(typeof MK_OV_KEEP!=='undefined' && MK_OV_KEEP && MK_OV_KEEP.ne===ne) MK_OV_KEEP=null;
    } else {
      var body=page.querySelector('.mk-dbody');
      if(body && !body.classList.contains('t3-layout')) {
        var main=document.createElement('div');main.className='t3-main';
        while(body.firstChild)main.appendChild(body.firstChild);
        body.appendChild(main);body.classList.add('t3-layout');body.insertAdjacentHTML('beforeend',action(s,current.row,false));
      }
      if(!page.querySelector('.t3-mobile-bar'))page.insertAdjacentHTML('beforeend',action(s,current.row,true));
    }
    return v;
  };
  gContent = function() { cancelAnimationFrame(frame); document.body.classList.remove('g4-t3'); return oldContent.apply(this,arguments); };
  var listOpen=G4T2.open;
  G4T2.open=function(e,ne){
    if(e&&e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;
    var s=tfSSFind(decodeURIComponent(ne)); if(real(s)) write(KEY,{id:s.id,per:0,y:0});
    return listOpen.apply(this,arguments);
  };
  mkdSet=function(k,v){if(document.querySelector('.t3-detail')&&k==='per')return window.G4T3.period(v);return oldSet.apply(this,arguments);};
  var tradesGo=mkGoTrades;
  mkGoTrades=function(ne){if(current)preserve();return tradesGo.apply(this,arguments);};
  var oldAdjust=cpAdjCommit;
  cpAdjCommit=function(){var on=!!document.querySelector('.t3-detail'), id=current&&current.s.id, v=oldAdjust.apply(this,arguments);if(on&&id){preserve();tfSS3DetailRender(id,'all','ov');}return v;};
  // T4 receives the chosen context; its own login and playback flow is not rewritten here.
  var oldBTView=btView;
  btView=function(){var h=read('g4.t3.verify');if(h&&BT.s&&h.strategyId===BT.s.id){BT.per=h.per;BT.amt=h.budget;BT.R=null;write('g4.t3.verify',null);}return oldBTView.apply(this,arguments);};
  window.G4T3={
    series:series, curve:curve, labels:labels,
    period:function(v){if(!current)return;current.per=per(v);MKD.per=current.per;preserve();var host=$('t3-proof-host');if(host)host.innerHTML=proof(current.s,current.per);var bar=document.querySelector('.t3-mobile-bar');if(bar)bar.outerHTML=action(current.s,copyFor(current.s),true);handoff();},
    copy:function(){if(!current)return;var row=copyFor(current.s);handoff();if(row){cpAdjDlg(row.c.id);return;}cpSetupGo(current.ne);},
    orders:function(){if(current){preserve();mkGoTrades(current.ne);}},
    overview:function(){if(current)mkBackOv(current.ne);},
    back:function(){if(!current)return;preserve();G4T2.back(current.ne);},
    verify:function(){if(!current)return;var h=handoff();write('g4.t3.verify',h);btOpen(current.ne);},
    analyze:function(){
      if(!current)return;var h=handoff();
      tfSS3Ask(current.ne,'all');
      if(G.mode==='tfss3d') {history.replaceState(history.state,'',location.pathname+location.search+h.returnTo);return;}
      var content=$('g-content');if(content&&!content.querySelector('.t3-return')) content.insertAdjacentHTML('afterbegin','<a class="t3-return t3-link" href="'+esc(h.returnTo)+'">← '+L(34)+'</a>');
    }
  };
  if(/^#\/share\/s\//.test(location.hash)&&window.TF_STATE_READY) tfRoute();
})();
