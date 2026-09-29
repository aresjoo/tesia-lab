// 사용: node validate.cjs <번호 1~4 | all>
// 글의 길이, 말투, 금지어, 빠진 열쇠, 자료에 없는 숫자, 같은 시작을 검사한다
const fs=require('fs'), path=require('path'), D=__dirname+path.sep;
const arg=process.argv[2]||'all', nums=arg==='all'?[1,2,3,4]:[+arg];
const BAN=['CPI','FOMC','연준','금리','물가','뉴스','실적','주말','레버리지','펀딩','롱 ','숏 ','시뮬레이션','백테스트','—','·','“','”','"',"'"];
let bad=0, total=0;
for(const n of nums){
  const fp=D+'facts-'+n+'.json', op=D+'out-'+n+'.json'; if(!fs.existsSync(op)){ console.log('out-'+n+'.json 없음'); bad++; continue; }
  const facts=JSON.parse(fs.readFileSync(fp,'utf8')); let out; try{ out=JSON.parse(fs.readFileSync(op,'utf8')); }catch(e){ console.log('out-'+n+'.json JSON 오류: '+e.message); bad++; continue; }
  for(const s of facts){
    const o=out[s.id]||{}, all=JSON.stringify(s), heads={};
    const nums2=new Set((all.match(/\d[\d,]*\.?\d*/g)||[]).map(x=>x.replace(/,/g,'')));
    // 자료의 값에서 바로 얻는 값: 소수 한 자리 반올림, 절댓값, 정수 반올림
    [...nums2].forEach(x=>{ const v=parseFloat(x); if(isFinite(v)){ nums2.add(v.toFixed(1)); nums2.add(String(Math.round(v))); nums2.add(String(+v.toFixed(1))); } });
    ['0.5','25','60','20','10','2','3','4','5','1'].forEach(x=>nums2.add(x));
    for(const m of s.msgs){
      total++; const t=o[m.key], tag=s.id+' '+m.key; const err=[];
      if(typeof t!=='string'){ console.log('X '+tag+': 글 없음'); bad++; continue; }
      if(t.length<205||t.length>295) err.push('길이 '+t.length);
      if(/\n/.test(t)) err.push('줄바꿈');
      const sents=t.split(/(?<=[.!?])\s+/).filter(Boolean);
      const notNida=sents.filter(x=>!/니다[.]$/.test(x)); if(notNida.length) err.push('니다로 끝나지 않는 문장: '+notNida.map(x=>x.slice(-14)).join(' / '));
      const b=BAN.filter(w=>t.includes(w)); if(b.length) err.push('금지어 '+b.join(','));
      if(/[(（]/.test(t)) err.push('괄호');
      const un=(t.match(/\d[\d,]*\.?\d*/g)||[]).map(x=>x.replace(/,/g,'').replace(/\.$/,'')).filter(x=>x&&!nums2.has(x)&&!nums2.has(String(parseFloat(x)))); if(un.length) err.push('자료에 없는 숫자 '+[...new Set(un)].join(','));
      const h=t.slice(0,6); heads[h]=(heads[h]||0)+1;
      if(err.length){ bad++; console.log('X '+tag+': '+err.join(' | ')); }
    }
    Object.entries(heads).filter(([k,v])=>v>1).forEach(([k,v])=>{ bad++; console.log('X '+s.id+': 같은 시작 "'+k+'" '+v+'번'); });
    Object.keys(o).filter(k=>!s.msgs.some(m=>m.key===k)).forEach(k=>{ bad++; console.log('X '+s.id+': 자료에 없는 열쇠 '+k); });
  }
}
console.log(bad?('실패 '+bad+'건 / 글 '+total+'편'):('통과, 글 '+total+'편'));
process.exit(bad?1:0);
