const fs=require('fs'); const f=__dirname+'/sk-copy.js'; let s=fs.readFileSync(f,'utf8');
const a="asset:(t.intake&&t.intake.asset)||s.asset||''";
if(s.split(a).length!==2) throw new Error('count');
s=s.replace(a,"asset:skcAssetName((t.intake&&t.intake.asset)||s.asset)");
s+="\n/* 자산은 글자로만 저장한다(예전 저장분의 객체는 불러올 때 바로잡는다): [object Object] 제목 방지 */\nfunction skcAssetName(a){ return (a&&typeof a==='object')?String(a.label||a.name||''):String(a||''); }\n(function(){ var r0=tfSSRows; tfSSRows=function(){ try{ var t=tfS(); if(t&&t.sharedSnap&&t.sharedSnap.asset&&typeof t.sharedSnap.asset==='object'){ t.sharedSnap.asset=skcAssetName(t.sharedSnap.asset); tfSave(); } }catch(e){} return r0.apply(this,arguments); }; })();\n";
fs.writeFileSync(f,s); console.log('ok');
