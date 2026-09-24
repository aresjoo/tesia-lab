import fs from 'node:fs'; import vm from 'node:vm';
let s=fs.readFileSync('index.html','utf8'); const crlf=s.includes('\r\n'); const N=crlf?'\r\n':'\n';
function rep(re,to,name){ const m=s.match(re); if(!m) throw new Error('anchor missing: '+name); s=s.replace(re,to); console.log('ok',name); }

// 1. tfDerive: no counts in status/line; add qualitative display
rep(/signed:'무료 체험 '\+freeLeft\+'회 남았어요\. 연결이나 결제 없이 만들고 검증할 수 있어요',/,
    "signed:'무료 체험 중이에요. 연결이나 결제 없이 만들고 검증할 수 있어요',",'statusLine signed');
rep(/else line='이번 달 청구 ₩0'\+\(freeLeft>0&&key==='signed'\?', 무료 체험 '\+freeLeft\+'회 남음':\(commission>0\?', 거래 혜택으로 상쇄':''\)\);/,
    "else line='이번 달 청구 ₩0'+(commission>0?', 거래 혜택으로 상쇄':'');",'line signed');
// display: bill only + qualitative offset
rep(/var coverage;\r?\n/, "var offsetWord=commission<=0?'':(due===0?'거래 혜택으로 전액 상쇄됐어요':'거래 혜택으로 일부 상쇄됐어요');"+N+
    "  var display=!user?'':('이번 달 청구 '+W(due)+(offsetWord?', '+offsetWord:(plan?'':(freeLeft>0?', 무료 체험 중':''))));"+N+"  var coverage;"+N,'display');
rep(/bill:\{plan:planFee,overage:overage,commission:commission,free:freeKrw,due:due,offsetPct:offsetPct,line:line\},/,
    "bill:{plan:planFee,overage:overage,commission:commission,free:freeKrw,due:due,offsetPct:offsetPct,line:line,display:display,offsetWord:offsetWord},",'bill obj');
rep(/'linked-low':'이용료 '\+W\(gross\)\+' 중 '\+W\(Math\.min\(commission,gross\)\)\+'가 거래 혜택으로 상쇄됐어요\. 부족분은 카드로 청구돼요',/,
    "'linked-low':'거래 혜택으로 이용료 일부가 상쇄됐어요. 부족분은 카드로 청구돼요',",'statusLine linked-low');

// 2. tfPlanView: drop rebates tab, bar and formula; show bill display only
rep(/var tabs=\[\['plan','이용 현황'\],\['rebates','정산'\],\['alerts','알림 설정'\]\];/, "var tabs=[['plan','이용 현황'],['alerts','알림 설정']]; if(tab==='rebates') tab='plan';",'tabs');
rep(/\+'<div class="us-bar"><div class="us-bar-h"><span>거래 혜택 상쇄<\/span><b>'\+pct\+'%<\/b><\/div>'\r?\n\s*\+'<div class="nfx-gtrack"><div class="nfx-gfill" style="width:'\+pct\+'%"><\/div><\/div>'\r?\n\s*\+'<div class="us-line">'\+gEsc\(d\.bill\.line\|\|''\)\+'<\/div><\/div>'/,
    "+'<div class=\"us-bar\"><div class=\"us-line\">'+gEsc(d.bill.display||'')+'</div></div>'",'usage bar');
rep(/if\(tab==='rebates'\) tfNFCount\('nfx-rnum',t2\.rebates\.reduce\(function\(a,r\)\{return a\+r\.amt;\},0\),'₩',''\);/,'','rebates count');

// 3. inactive view free bar: no count
rep(/free='<div class="tx-free"><div class="tx-free-hd"><span>무료 체험<\/span><b>'\+f\.freeLeft\+'회 남음<\/b><\/div><div class="tx-bar"><i style="width:'\+pct\+'%"><\/i><\/div>'/,
    "free='<div class=\"tx-free\"><div class=\"tx-free-hd\"><span>무료 체험</span><b>'+(f.freeLeft>0?'이용 중':'다 썼어요')+'</b></div>'",'inactive free');
rep(/free='<div class="tx-free"><div class="tx-free-hd"><span>이번 달<\/span><b>'\+gEsc\(d\.bill\.line\)\+'<\/b><\/div>'/,
    "free='<div class=\"tx-free\"><div class=\"tx-free-hd\"><span>이번 달</span><b>'+gEsc(d.bill.display)+'</b></div>'",'inactive plan line');

// 4. rebate notification + 정산 filters + pref row
rep(/if\(sum>0&&t\.notifPrefs\.rebate\) tfNotify\('rebate'/, "if(false) tfNotify('rebate'",'rebate notify');
s=s.split("['review','거래복기'],['rebate','정산']]").join("['review','거래복기']]"); console.log('ok notif tabs');
rep(/,\['rebate','수수료 적립','적립이 확정될 때','won','gg'\]/,'','pref row');

fs.writeFileSync('index.html',s);
const re=/<script>([\s\S]*?)<\/script>/g;let m,i=0;while((m=re.exec(s))){i++;try{new vm.Script(m[1],{filename:'s'+i});console.log('syntax ok',i)}catch(e){console.log('SYNTAX ERR',i,e.message)}}
