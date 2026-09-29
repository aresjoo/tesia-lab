const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
s=one(s,"var mkHub0=tfShareHub; tfShareHub=function(){ try{ mkWindCheck(); }catch(e){} return mkHub0.apply(this,arguments); };",
  "var mkHub0=tfShareHub; tfShareHub=function(tab){ try{ mkWindCheck(); }catch(e){} var prev=G.mode==='tfss3'?MK_HUB_TAB:null, out=mkHub0.apply(this,arguments); MK_HUB_TAB=tab||'find'; if(MK_HUB_TAB==='find'&&prev!=='find') try{ mkCardsEnter(); }catch(e){} return out; };");
s=one(s,"  watching=(tfS().watch||[]).indexOf(s.nick)>=0; /* 어떤 주소로 들어와도 현재 이름으로 판정 */","  watching=!!S.user&&(tfS().watch||[]).indexOf(s.nick)>=0; /* 어떤 주소로 들어와도 현재 이름으로 판정. 비로그인은 저장하지 않는다 */");
s=one(s,"  var s=tfSSFind(nick), on=(tfS().watch||[]).indexOf(s?s.nick:nick)>=0;","  var s=tfSSFind(nick), on=!!S.user&&(tfS().watch||[]).indexOf(s?s.nick:nick)>=0;");
s+=fs.readFileSync(D+'c10.js','utf8');
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',`
/* 목록에 처음 들어올 때 카드가 차례로 올라온다 */
@keyframes mk3In{from{opacity:0;transform:translateY(22px) scale(.98)}to{opacity:1;transform:none}}
#g-root .mk3-grid.mk3-enter>.mk3{animation:mk3In .52s cubic-bezier(.2,.75,.2,1) both;animation-delay:calc(var(--i,0) * 60ms)}
@media (prefers-reduced-motion:reduce){#g-root .mk3-grid.mk3-enter>.mk3{animation:none}}
`);
console.log('ok');
