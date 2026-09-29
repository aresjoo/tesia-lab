const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'chat.js','utf8');
const n1=s.split("'+mkPct0(d)+' 아래에 있").length-1; if(n1!==2) throw new Error('dip '+n1);
s=s.split("'+mkPct0(d)+' 아래에 있").join("'+Math.abs(d).toFixed(1)+'% 아래에 있");
const a="return mkSay(['안녕하세요. '+R.what,R.tf,R.sell],[R.cap,R.size,R.rest],R);"; if(s.split(a).length-1!==1) throw new Error('intro');
s=s.replace(a,"return mkSay(['안녕하세요. '+R.what,R.tf,R.sell],[R.cap,R.size,R.rest,'사고파는 건 정해 둔 조건만 따르고, 그때그때 기분으로 바꾸지 않아요.'],R);");
fs.writeFileSync(D+'chat.js',s); console.log('ok');
