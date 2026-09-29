const fs=require('fs'); let s=fs.readFileSync('r4-patch.cjs','utf8');
const a1="[\"'<div class=\\\"mk3-ev-d num\\\">'+mkMD(e.i)+(e.cnt?'<small>'+e.cnt+'번 연속</small>':'')+'</div>'\",\"'<div class=\\\"mk3-ev-d num\\\">'+mkMD(e.i)+(e.cnt?'<small>'+mkMD(e.from)+'부터 '+e.cnt+'번</small>':'')+'</div>'\"]";
if(!s.includes(a1)) throw new Error('a1');
s=s.replace(a1,"[\"+mkMD(e.i)+(e.cnt?'<small>'+e.cnt+'번 연속</small>':'')+'</div>'\",\"+mkMD(e.i)+(e.cnt?'<small>'+mkMD(e.from)+'부터 '+e.cnt+'번</small>':'')+'</div>'\"]");
// 템플릿 안의 줄바꿈 이스케이프
const i=s.indexOf('// 5g.'), j=s.indexOf('// 5h.'); let seg=s.slice(i,j); seg=seg.split("'\n      +").join("'\\n      +"); s=s.slice(0,i)+seg+s.slice(j);
fs.writeFileSync('r4-patch.cjs',s); console.log('fixed', (seg.match(/\\n/g)||[]).length);
