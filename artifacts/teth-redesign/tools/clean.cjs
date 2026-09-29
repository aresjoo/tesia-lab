// 비교 렌더용 변형 스위치를 걷어 낸다(확정안만 남긴다)
const fs=require('fs'); const D=__dirname+'/';
let s=fs.readFileSync(D+'rd-ui.js','utf8');
const one=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('x'+n+': '+a.slice(0,60)); s=s.replace(a,()=>b); };
{ const i=s.indexOf('var MK_VAR='), j=s.indexOf('\n',i); if(i<0) throw new Error('var'); s=s.slice(0,i)+s.slice(j+1); }
{ const i=s.indexOf('function mkGlyphB2('), j=s.indexOf('function mkGlyph(s,z){'); if(i<0||j<i) throw new Error('b2'); s=s.slice(0,i)+s.slice(j); }
one("  return MK_VAR.id==='B2'?mkGlyphB2(s,z):mkGlyphB1(s,z);","  return mkGlyphB1(s,z);");
{ const i=s.indexOf("  var pos=function(q,th){ return MK_VAR.now"), j=s.indexOf('\n',i); if(i<0) throw new Error('pos'); s=s.slice(0,i)+"  var pos=function(){ return ''; };"+s.slice(j); }
one("var cta=MK_VAR.cta, bF='<button type=\"button\" class=\"mk3-b'+(cta==='P0'?' lime':'')+'\"","var bF='<button type=\"button\" class=\"mk3-b\"");
one("class=\"mk3-b'+(cta==='P1'?' fill':'')+'\"","class=\"mk3-b fill\"");
one("(MK_VAR.hero==='img'?'mkh-s2 mkh-dim':'mkh-kd')+' mkh-k'","'mkh-kd mkh-k'");
one("(MK_VAR.hero==='img'?'':mkHeroArt())","mkHeroArt()");
one("MK_VAR.ev||4","4");
if(s.includes('MK_VAR')||s.includes("cta===")) throw new Error('left: '+s.split('\n').filter(l=>/MK_VAR|cta===/.test(l)).join('\n').slice(0,400));
fs.writeFileSync(D+'rd-ui.js',s);
let c=fs.readFileSync(D+'rd.css','utf8');
c=c.split('\n').filter(l=>!l.startsWith('.mk3-b.lime{')&&!l.startsWith('.mkh-s2.mkh-dim{')).join('\n').replace(".mk3-b:not(.fill):not(.lime):hover",".mk3-b:not(.fill):hover");
fs.writeFileSync(D+'rd.css',c); console.log('clean ok');
