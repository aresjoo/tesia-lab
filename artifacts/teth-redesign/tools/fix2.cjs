const fs=require('fs'); let s=fs.readFileSync('rd-ui.js','utf8');
function rep(a,b){ const n=s.split(a).length-1; if(n<1) throw new Error('anchor '+a.slice(0,50)); s=s.split(a).join(b); }
rep("function mkTopTxt(top)","/* 조사: 받침 유무에 따라 고른다 */\nfunction mkJ(w,a,b){ var c=String(w).charCodeAt(String(w).length-1); if(c<0xAC00||c>0xD7A3) return w+a; return w+(((c-0xAC00)%28)?a:b); }\nfunction mkTopTxt(top)");
rep("dec:e.a+'을(를) 새로 고름'","dec:mkJ(e.a,'을','를')+' 새로 고름'");
rep("dec:e.a+'을(를) 거래 대상으로 고름'","dec:mkJ(e.a,'을','를')+' 거래 대상으로 고름'");
rep("obs:e.a+'이(가) 밀렸다가 '","obs:mkJ(e.a,'이','가')+' 밀렸다가 '");
rep("obs:s.asset+'이(가) 충분히 밀린 뒤(하락 강도 '","obs:mkJ(s.asset,'이','가')+' 충분히 밀린 뒤(하락 강도 '");
rep("obs:s.asset+'이(가) 충분히 밀린 뒤 반등'","obs:mkJ(s.asset,'이','가')+' 충분히 밀린 뒤 반등'");
rep("[['언제 사나',s.asset+'이(가) '","[['언제 사나',mkJ(s.asset,'이','가')+' '");
fs.writeFileSync('rd-ui.js',s); console.log('ok');
