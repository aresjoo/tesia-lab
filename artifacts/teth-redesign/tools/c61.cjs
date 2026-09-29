const fs=require('fs'), D=__dirname+'/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
ed(D+'fut-core.js',[
  ["    open:L.pos.map(function(p){ var v2=px(p.k); return {k:p.k,","    open:(function(a){ return c.kind==='agent'?a:(a[0]||null); })(L.pos.map(function(p){ var v2=px(p.k); return {held:endI-p.ei,k:p.k,"],
  ["w:tv>0?Math.max(0,L.eqOf(p,v2))/tv:0,fut:1}; })};","w:tv>0?Math.max(0,L.eqOf(p,v2))/tv:0,fut:1}; }))};"],
]);
ed(D+'fut-ui.js',[
  ["function fuIs(s){","function fuOp(st){ var o=st&&st.open; return !o?[]:o.length!=null?o:[o]; }\nfunction fuNowLine(s){ var st=s.r&&s.r.state, op=fuOp(st), c=s.cfg; if(op.length) return op.map(function(o){ return mkTk(o.k)+' '+fuSd(o.side); }).join(', ')+' 보유 중'; if(c.kind==='mix') return st.pickL?mkTk(st.pickL)+' 롱 신호를 기다리는 중':st.pickS?mkTk(st.pickS)+' 숏 신호를 기다리는 중':'방향이 애매해 쉬는 중'; return '신호를 기다리는 중'; }\nfunction fuIs(s){"],
  ["function fuNow(s,r){ var st=r.state, end=PRICE0.length-1, c=s.cfg, rows='', head='', op=st.open||[];","function fuNow(s,r){ var st=r.state, end=PRICE0.length-1, c=s.cfg, rows='', head='', op=fuOp(st);"],
  ["function fuChatNow(s,r){ var st=r.state, R=fuRules(s), op=st.open||[];","function fuChatNow(s,r){ var st=r.state, R=fuRules(s), op=fuOp(st);"],
]);
ed(D+'rd-ui.js',[["  var pos=function(){ return ''; };\n","  var pos=function(){ return ''; };\n  if(fuIs(s)) return fuNowLine(s);\n"]]);
console.log('ok');
