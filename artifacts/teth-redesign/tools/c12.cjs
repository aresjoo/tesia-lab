const fs=require('fs'), D=__dirname+'/'; let c=fs.readFileSync(D+'rd.css','utf8');
const rm=["#g-root .mk3v2 .mk3-fw.t1 b{color:#e3e5e8}\n","#g-root .mk3v2 .mk3-fw.t2{color:#8fb8ff}\n","#g-root .mk3v2 .mk3-fw.t2 b{color:#8fb8ff}\n","#g-root .mk3v2 .mk3-fw.t3{color:#f2b94b}\n","#g-root .mk3v2 .mk3-fw.t3 b{color:#f2b94b}\n"];
for(const r of rm){ if(c.split(r).length-1!==1) throw new Error('rm '+r); c=c.replace(r,''); }
c=c.replace("/* 따라가는 사람: 아이콘과 인원 구간별 색 */","/* 따라가는 사람: 아이콘, 숫자만 굵게 */");
const a="#g-root .mk3v2 .mk3-fw b{font-weight:700}"; if(c.split(a).length-1!==1) throw new Error('b'); c=c.replace(a,"#g-root .mk3v2 .mk3-fw b{font-weight:700;color:#e3e5e8}");
fs.writeFileSync(D+'rd.css',c); console.log('ok');
