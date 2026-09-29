// 판단 기록의 말투: 다 → 합니다, 입니다. 문장을 만들 때 조각마다 바꾼 뒤 길이를 잰다
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let c=fs.readFileSync(D+'chat.js','utf8');
c=one(c,"function mkSay(core,opt,R){\n  var t=core.filter(Boolean).join(' '), i=0, all=opt.slice();\n  if(R) for(var k in R) all.push(R[k]);\n  for(;i<all.length&&t.length<205;i++){ var x=all[i]; if(!x||t.indexOf(x)>=0) continue;",
`/* 문장 끝을 합니다체로. 끝 글자의 받침을 보고 바꾼다: 한다 → 합니다, 했다 → 했습니다, 있다 → 있습니다, 않는다 → 않습니다, 이다와 명사 뒤의 다 → 입니다 */
function mkPolite(x){
  return String(x||'').replace(/(.)(.)다\\.(?=\\s|$)/g,function(m,a,b){
    var cb=b.charCodeAt(0), han=cb>=0xAC00&&cb<=0xD7A3, j=han?(cb-0xAC00)%28:-1;
    if(b==='이') return a+'입니다.';
    if(b==='하') return a+'합니다.';
    if(b==='는') return a+'습니다.';
    if(j===20||j===18) return a+b+'습니다.';
    if(j===4) return a+String.fromCharCode(cb-4+17)+'니다.';
    return a+b+'입니다.';
  });
}
function mkSay(core,opt,R){
  core=core.map(mkPolite); opt=opt.map(mkPolite);
  var t=core.filter(Boolean).join(' '), i=0, all=opt.slice();
  if(R) for(var k in R) all.push(mkPolite(R[k]));
  for(;i<all.length&&t.length<205;i++){ var x=all[i]; if(!x||t.indexOf(x)>=0) continue;`);
c=one(c,"+'였다(괄호 없이 적은 값은 상승률, 순위는 상승률을 변동성으로 나눠 매긴다).'","+'였다. 순위는 상승률을 변동성으로 나눠 매긴다.'");
c=one(c,"MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='trail'","MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='trail'");
fs.writeFileSync(D+'chat.js',c);
let u=fs.readFileSync(D+'chat-ui.js','utf8');
u=one(u,"'</b><p>'+gEsc(MK_GLOSS[k]||'')+'</p>'","'</b><p>'+gEsc(mkPolite(MK_GLOSS[k]||''))+'</p>'");
fs.writeFileSync(D+'chat-ui.js',u);
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const i=s.indexOf('/* ── 개요의 대화:'); if(i<0) throw new Error('chat block');
s=s.slice(0,s.lastIndexOf('\n',i))+c+u; fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
