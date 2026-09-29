const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const PT="  var pt=$('mk-follow')&&TF_MKF.trig&&document.body.contains(TF_MKF.trig)?TF_MKF.trig:null;";
let t=fs.readFileSync(F,'utf8'); const n=t.split(PT+'\r\n').length-1; if(n!==1) throw new Error('pt x'+n); t=t.replace(PT+'\r\n',''); fs.writeFileSync(F,t);
let s=fs.readFileSync(D+'apply2.cjs','utf8'); const L=s.split('\n'); const i=L.findIndex(x=>x.includes('mkFollowClose(true); tfSS3DlgClose(true);"+NL+"  TF_MKF=')); if(i<0) throw new Error('line');
L[i]=[
"  rep(\"  var s2=tfSSFind(nick);\"+NL+\"  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\",\"  var s2=tfSSFind(nick), pt=$('mk-follow')&&TF_MKF.trig&&document.body.contains(TF_MKF.trig)?TF_MKF.trig:null;\"+NL+\"  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\",true);",
"  rep(\"ne:ne,nick:nick,trig:document.activeElement};\",\"ne:ne,nick:nick,trig:pt||document.activeElement};\",true);"
].join('\n'); fs.writeFileSync(D+'apply2.cjs',L.join('\n')); console.log('ok');
