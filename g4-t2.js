/* G4/T2 스케치(claude): 돈 순서 목록. 흐름 계약 sprint/G4/T2/sketch/claude/flow.md
   T1 통합본(g4-t1.js) 위에 얹는다. 숫자는 전부 G4T1Data.results(= btCompute, amt 1000)에서 받는다. */
(function () {
  'use strict';
  var D = G4T1Data, LIST = '#/trade/strategies', PER = 10, POS = 'g4.t2.pos', FROM = 'g4.t2.from';
  var t1Hub = tfShareHub, t1NF = tfNFRoute, t1Detail = tfSS3DetailRender, t1Card = mkCard, oldContent = gContent;
  var expanded = false, sig = null, keepOpen = false;
  var KIND = { agent: 1, rule: 1, mix: 1 }, MKT = { crypto: 1, stock: 1, index: 1, multi: 1 };
  var HELP = '<p class="cq-help mk-help">막히면 상담원이 24시간 답합니다. <button type="button" class="pl-link" onclick="tfTxHelp()">상담원에게 묻기</button></p>';

  function base() { return location.pathname + location.search; }
  function onList() { var h = location.hash; return h === LIST || h.indexOf(LIST + '?') === 0; }
  function ssGet(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function docScroll() { return document.body.classList.contains('gft-doc'); }
  function getY() { var sc = $('g-scroll'); return docScroll() ? window.scrollY : (sc ? sc.scrollTop : 0); }
  function setY(y) { var sc = $('g-scroll'); if (docScroll()) window.scrollTo(0, y); else if (sc) sc.scrollTop = y; }
  function real(s) { return !!(s && s.cfg && !s.me); }
  function fin(s, per) { return real(s) ? D.results(s, per || 0).final : -1e18; }
  function day(i) { var d = idxToDate(i); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function thin(eq, n) { if (eq.length <= n) return eq; var o = [], st = (eq.length - 1) / (n - 1); for (var j = 0; j < n; j++) o.push(eq[Math.round(j * st)]); return o; }

  /* 주소 ↔ 목록 상태(종류, 정렬, 시장, 검색, 펼침) */
  function url() {
    var t = tfSSState(), q = []; mkSortKey(t);
    if (KIND[t.ss.kind]) q.push('kind=' + t.ss.kind);
    if (t.ss.sort === 'fw') q.push('sort=fw'); else if (t.ss.sort === 'ret') q.push('sort=y1');
    if (MKT[t.ss.asset]) q.push('mkt=' + t.ss.asset);
    if (TF_SS_Q) q.push('q=' + encodeURIComponent(TF_SS_Q));
    if (expanded) q.push('more=1');
    return LIST + (q.length ? '?' + q.join('&') : '');
  }
  function setUrl() { try { history.replaceState(null, '', base() + url()); } catch (_) {} }
  function parse(h) {
    var t = tfSSState(), p = {}; mkSortKey(t);
    (h.split('?')[1] || '').split('&').forEach(function (x) { var i = x.indexOf('='); if (i > 0) p[x.slice(0, i)] = x.slice(i + 1); });
    t.ss.kind = KIND[p.kind] ? p.kind : 'all';
    t.ss.sort = p.sort === 'fw' ? 'fw' : p.sort === 'y1' ? 'ret' : 'pick'; t.ss.dir = 'desc';
    t.ss.asset = MKT[p.mkt] ? p.mkt : 'all';
    var q = ''; try { q = decodeURIComponent(p.q || ''); } catch (_) {}
    TF_SS_Q = q.trim(); expanded = p.more === '1';
    tfSave();
  }

  /* 걸러 내고 세운 줄. 기본 = 전체 기간 금액순 */
  function rowsNow() {
    var t = tfSSState(), rows = tfSSRows(), k = mkSortKey(t);
    if (t.ss.asset && t.ss.asset !== 'all') rows = rows.filter(function (s) { return s.mkt === t.ss.asset; });
    if (t.ss.kind && t.ss.kind !== 'all') rows = rows.filter(function (s) { return (s.kind || 'rule') === t.ss.kind; });
    if (TF_SS_Q) {
      var q = TF_SS_Q.toLowerCase();
      rows = rows.filter(function (s) { return [s.nick, s.asset, mkTitle(s), s.one || '', s.by ? '@' + s.by : '', s.id || '', mkOldNames(s.id), MK_KIND[s.kind] || '', mkUni(s).list.join(' '), mkUni(s).list.map(mkTk).join(' '), mkTk(s.asset || '')].join(' ').toLowerCase().indexOf(q) >= 0; });
    }
    if (typeof tfMyExFilter === 'function') rows = tfMyExFilter(rows);
    rows.sort(k === 'fw' ? function (a, b) { return (b.fw || 0) - (a.fw || 0) || fin(b) - fin(a); }
      : k === 'ret' ? function (a, b) { return fin(b, 365) - fin(a, 365); }
        : function (a, b) { return fin(b) - fin(a); });
    return rows;
  }

  function card(s) {
    if (!s.kind) s.kind = 'rule';
    if (!real(s)) return t1Card(s);
    var r = D.results(s, 0), ne = tfSS3Rid(s), ex = mkEx(s), money = Math.round(r.final), hold = Math.round(r.benchFinal), now = mkNowLine(s);
    return '<article class="mk-card skf g4l k-' + s.kind + '" role="link" tabindex="0" data-id="' + gEsc(s.id) + '" aria-label="' + gEsc(mkHook(s)) + ' 전략 보기" onclick="G4T2.open(event,\'' + ne + '\')" onkeydown="G4T2.open(event,\'' + ne + '\')">'
      + '<div class="skf-top">' + mkGlyph(s, 28) + '<div class="skf-nm"><h3>' + gEsc(mkHook(s)) + '</h3><span><img src="assets/logos/' + ex[0] + '.png" alt="" width="14" height="14" loading="lazy">' + MK_KIND[s.kind] + ', ' + ex[1] + '에서 실행</span></div></div>'
      + '<div class="skf-perf g4l-perf"><div class="skf-ret"><small>$1,000 넣었다면 지금</small><b class="num g4l-amt" data-to="' + money + '">' + cpUsd(money, 0) + '</b></div>' + mkSpark3(thin(r.eq, 140)) + '</div>'
      + '<div class="g4l-info">'
      + '<p class="g4l-sub num">' + (money > hold ? '그냥 들고 있었다면 ' + cpUsd(hold, 0) + ', ' : '') + day(r.i0) + '부터</p>'
      + '<span class="g4l-min num">최소 ' + cpUsd(mkMin(s), 0) + '</span>'
      + '<span class="g4l-now">' + (now ? '지금 ' + gEsc(now) : '') + '</span>'
      + '<span class="skf-fw g4l-fw">' + (s.fw ? mkFwHtml(s.fw) : '') + '</span>'
      + '<span class="g4l-go" aria-hidden="true">이 전략 보기</span>'
      + '</div></article>';
  }
  mkCard = tfSS3Card = card;

  /* 목록 본문: 되풀이 없음, 열 장 뒤 더 보기, 끝 줄 */
  tfSS3GridHtml = function () {
    var t = tfSSState(), rows = rowsNow(), my = typeof tfMyExOn === 'function' && tfMyExOn(), note = '';
    var s2 = [t.ss.asset, t.ss.kind, TF_SS_Q, t.ss.sort, my ? tfMyExGet() : ''].join('|');
    if (sig !== s2) { if (!keepOpen) expanded = false; sig = s2; }
    if (my) {
      var nm = gEsc(tfMyExNames(tfMyExIds()));
      if (!rows.length) return '<div class="myex-empty"><p>' + nm + '에서 실행할 수 있는 전략이 아직 없습니다.</p><button type="button" class="pl-link" onclick="tfMyExSet(\'\')">전체 보기</button></div>' + HELP;
      note = '<p class="myex-note">' + nm + '에서 바로 실행할 수 있는 전략 ' + rows.length + '개입니다.</p>';
    }
    if (!rows.length) return '<div class="ss3-empty">조건에 맞는 전략이 없습니다<br><button type="button" class="mk-btn2" style="margin-top:16px" onclick="tfSS3Reset()">필터 초기화</button></div>' + HELP;
    var shown = expanded ? rows : rows.slice(0, PER), rest = rows.length - shown.length;
    return note + '<div class="mk-grid mk3-grid g4l-grid">' + shown.map(mkCard).join('') + '</div>'
      + (rest > 0 ? '<div class="g4l-morew"><button type="button" class="g4l-more" onclick="G4T2.more()">나머지 ' + rest + '개 더 보기</button></div>' : '') + HELP;
  };

  /* 조작 줄: 제목, 정렬 이름, 전체일 때 한 줄 */
  var c0 = mk3Controls;
  mk3Controls = function (t) {
    var d = document.createElement('div'); d.innerHTML = c0.apply(this, arguments);
    var sort = mkSortKey(t), sel = d.querySelector('.skf-sort select'), row = d.querySelector('.mk3-kindrow');
    if (sort === 'win') sort = 'pick';
    if (sel) sel.innerHTML = [['pick', '전체 기간 금액순'], ['fw', '복사한 사람순'], ['ret', '최근 1년 금액순']].map(function (o) { return '<option value="' + o[0] + '"' + (sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    if (row && !row.querySelector('.mk3-kindhelp') && !(typeof tfMyExOn === 'function' && tfMyExOn())) row.insertAdjacentHTML('beforeend', '<p class="mk3-kindhelp one">전략 ' + tfSSRows().filter(function (s) { return real(s) && (!MKT[t.ss.asset] || s.mkt === t.ss.asset); }).length + '개가 같은 $1,000을 굴린 결과입니다.</p>');
    return '<h1 class="g4l-h1">전략 복사</h1>' + d.innerHTML;
  };

  /* 그리기: T1 통합본의 목록 그리기를 그대로 부르고 주소만 상태에 맞춘다 */
  function draw(o) {
    o = o || {};
    keepOpen = !!o.keep;
    try { history.replaceState(null, '', base() + LIST); t1Hub('find'); } finally { keepOpen = false; }
    setUrl();
    document.body.classList.add('g4-list');
    var page = document.querySelector('#g-content .ss3'), back = page && page.querySelector('.g4-back');
    if (back && !ssGet(FROM)) back.remove();
    if (o.restore) { setY(o.restore.y); requestAnimationFrame(function () { setY(o.restore.y); }); }
    else if (o.fresh) enter();
  }
  /* 새로 들어온 첫 화면만: 큰 금액이 $1,000 에서 제 값으로, 곡선이 왼쪽에서 */
  function enter() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) {}
    var g = document.querySelector('#ss3-grid .g4l-grid'); if (!g) return;
    var els = [], t0 = performance.now();
    [].forEach.call(g.querySelectorAll('.g4l-amt'), function (b) { var r = b.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) els.push({ b: b, to: +b.dataset.to }); });
    g.classList.add('g4l-enter');
    (function tick(now) {
      var p = Math.min(1, ((now || performance.now()) - t0) / 600), e = 1 - Math.pow(1 - p, 3);
      els.forEach(function (x) { x.b.textContent = cpUsd(Math.round(1000 + (x.to - 1000) * e), 0); });
      if (p < 1) requestAnimationFrame(tick); else g.classList.remove('g4l-enter');
    })();
  }

  gContent = function () { document.body.classList.remove('g4-list'); return oldContent.apply(this, arguments); };

  tfShareHub = function (tab) {
    if (tab === 'follow') { tfNav('#/trade'); return; }
    if (onList()) { draw({}); return; }
    expanded = false;
    tfNav(url());
  };
  tfNFRoute = function (h) {
    if (h === LIST || h.indexOf(LIST + '?') === 0) {
      var pm = G.mode, pos = ssGet(POS), back = pm === 'tfss3d' && pos && pos.url === h;
      if (pm === 'nfmain') ssSet(FROM, 1); else if (pm !== 'tfss3d' && pm !== 'tfss3') ssSet(FROM, null);
      parse(h);
      draw({ keep: true, restore: back ? pos : null, fresh: !back && pm !== 'tfss3' });
      ssSet(POS, null);
      return true;
    }
    return t1NF(h);
  };
  var s0 = tfSS3Search;
  tfSS3Search = function () { var r = s0.apply(this, arguments); setUrl(); return r; };

  /* 연결한 사람은 「내 거래소」가 켜진 채 도착한다. 끈 것은 기억한다 */
  tfMyExGet = function () {
    var c = tfMyExConn(); if (!c.length) return '';
    var v = null; try { v = localStorage.getItem('teth.myex'); } catch (_) {}
    if (v === 'off') return '';
    if (!v) return 'all';
    return v !== 'all' && c.indexOf(v) < 0 ? 'all' : v;
  };
  var m0 = tfMyExSet;
  tfMyExSet = function (v) {
    if (v) return m0.apply(this, arguments);
    try { localStorage.setItem('teth.myex', 'off'); } catch (_) {}
    tfMyExMenu(false); tfShareHub('find');
  };
  tfSS3Reset = function () {
    TF_SS_Q = ''; var t = tfSSState(); t.ss.asset = 'all'; t.ss.kind = 'all'; t.ss.risk = 'all'; tfSave();
    if (tfMyExConn().length) { try { localStorage.setItem('teth.myex', 'off'); } catch (_) {} }
    tfShareHub('find');
  };

  /* 상세: 길 표시 「전략 복사」는 뒤로 한 번과 같다. 목록에서 온 사람에게는 「← AI 트레이딩」을 두지 않는다 */
  tfSS3DetailRender = function (ne) {
    var v = t1Detail.apply(this, arguments), page = document.querySelector('#g-content .mk-detail'), pos = ssGet(POS);
    if (page) {
      var lk = page.querySelector('.tfbk-bc .lk'), b = page.querySelector('a.g4-back');
      if (lk) lk.setAttribute('onclick', 'G4T2.back(\'' + tfSSNe(decodeURIComponent(ne)) + '\')');
      if (b && pos && pos.id === ne) b.remove();
    }
    return v;
  };

  window.G4T2 = {
    open: function (e, ne) {
      if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      ssSet(POS, { url: location.hash, y: getY(), id: ne });
      skfOpen(e, ne);
    },
    more: function () {
      var g = document.querySelector('#ss3-grid .g4l-grid'), w = document.querySelector('.g4l-morew'); if (!g) return;
      var n = g.children.length;
      expanded = true;
      g.insertAdjacentHTML('beforeend', rowsNow().slice(n).map(mkCard).join(''));
      if (w) w.remove();
      setUrl();
      if (g.children[n]) try { g.children[n].focus({ preventScroll: true }); } catch (_) {}
    },
    back: function (ne) {
      var pos = ssGet(POS);
      if (pos && pos.id === ne && pos.url) { history.back(); return; }
      expanded = false; tfNav(url());
    },
    url: url
  };
  if (onList()) tfRoute();
})();
