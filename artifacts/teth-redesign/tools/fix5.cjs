const fs=require('fs'); let s=fs.readFileSync('rd-ui.js','utf8');
function rep(a,b){ if(s.split(a).length!==2) throw new Error('anchor '+a.slice(0,50)); s=s.replace(a,()=>b); }
rep("function mkVs(v,th,unit,plus){ var d=1, s, t2;","function mkVs(v,th,unit,plus,minD){ var d=Math.max(1,minD||0), s, t2;");
rep("if(d<=1&&Math.abs(v-th)>=1.5) s=String(Math.round(v));","if(minD){ if(d<=minD) s=v.toFixed(minD); } else if(d<=1&&Math.abs(v-th)>=1.5) s=String(Math.round(v));");
rep("mkVs(q.bounce,0.5,'%',true)","mkVs(q.bounce,0.5,'%',true,2)");
rep("mkVs(q.gap,3,'%')","mkVs(q.gap,3,'%',false,1)");
fs.writeFileSync('rd-ui.js',s); console.log('ok');
