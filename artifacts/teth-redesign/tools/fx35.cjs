// 소개 영상이 첫 진입에 두 번 재생되는 문제: 화면이 다시 그려질 때 재생 위치를 이어 간다
const fs=require('fs');
const f='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{ if(s.indexOf(a)<0&&s.indexOf(a.split(String.fromCharCode(10)).join(String.fromCharCode(13,10)))>=0){ a=a.split(String.fromCharCode(10)).join(String.fromCharCode(13,10)); b=b.split(String.fromCharCode(10)).join(String.fromCharCode(13,10)); } const n=s.split(a).length-1; if(n!==1) throw new Error('count '+n+' '+a.slice(0,50)); s=s.replace(a,b); };
// 1) 정리할 때 재생 위치와 끝남을 기억
rep("  var fx=window.TF_TIN_FX; if(!fx) return;\n  window.TF_TIN_FX=null;",
    "  var fx=window.TF_TIN_FX; if(!fx) return;\n  if(fx.v) window.TF_TIN_MEM={t:fx.v.currentTime||0,done:!!fx.done,at:Date.now()}; /* 곧바로 다시 그려질 때 처음부터 다시 재생하지 않게 */\n  window.TF_TIN_FX=null;");
// 2) 새로 붙일 때 20초 안의 기억이 있으면 이어 가기, 끝났으면 재생하지 않음
rep("    v.src='assets/halo.mp4';\n    floor.appendChild(v); fx.v=v; sync();",
    "    v.src='assets/halo.mp4';\n    var mem=window.TF_TIN_MEM; if(mem&&Date.now()-mem.at<20000){ if(mem.done){ fx.done=true; } else if(mem.t>0){ v.addEventListener('loadedmetadata',function(){ try{ v.currentTime=mem.t; }catch(e){} },{once:true}); } }\n    floor.appendChild(v); fx.v=v; sync();");
fs.writeFileSync(f,s); console.log('ok');
