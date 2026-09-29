// 카드 2라운드: Codex 검수(c2-codex.md) 반영
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,60)); return s.replace(x,()=>y); };
// 1. 이름과 설명
const cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
const ch={
 d2:['네 시장 둘 나눠 담기','AI가 지수, 금, 주식, 코인 6종을 20일마다 비교해, 최대 두 종목에 나눠 담아요.'],
 d3:['코인 매일 비교하기','AI가 코인 8종을 매일 비교해, 산 코인이 약해지면 팔고 더 강한 코인이 있으면 사요.'],
 d5:['기술주 함께 오를 때','기술주 8종 중 여섯 이상이 두 달 평균 가격보다 높을 때만 AI가 새로 사요.'],
 d6:['대표 코인 하나 담기','AI가 비트코인, 이더리움, 솔라나를 10일마다 비교해 하나만 골라 담아요.'],
 h3:['지수와 금 짧게','AI가 나스닥, S&P 500, 금 중 하나를 골라, 산 가격보다 5% 넘게 오른 날 팔아요.'],
 h4:['네 시장 회복 기다리기','AI가 지수, 금, 주식, 코인 중 하나를 골라, 떨어졌다가 다시 오를 때 사요.'],
 h5:['강한 코인 회복 때','AI가 대표 코인 셋 중 두 달간 많이 오른 하나를 골라, 떨어졌다 다시 오를 때 사요.'],
 r2:['나스닥 4% 챙기기','나스닥이 떨어졌다 오를 때 사서, 산 가격보다 4% 넘게 오른 날 팔아요.'],
 r3:['이더리움 빨리 접기','이더리움이 산 가격보다 3% 넘게 떨어진 날 팔아요. 오르면 15%까지 기다려요.'],
 r4:['금 뚜렷할 때만','금이 크게 떨어졌다 다시 오를 때, 최근 흐름이 뚜렷한지도 확인하고 사요.'],
 r5:['테슬라 큰 하락 뒤','테슬라가 크게 떨어진 뒤 다시 오르면 사서, 18% 넘게 오르거나 25일이 지나면 팔아요.'],
 r6:['솔라나 짧게 자주','솔라나가 다시 오를 때 사서, 5% 넘게 오르거나 3% 넘게 떨어진 날 팔아요.'],
 r7:['리플 4% 챙기기','리플이 다시 오를 때 사서, 4% 넘게 오르거나 5% 넘게 떨어진 날 팔아요.'],
 r8:['엔비디아 8% 목표','엔비디아가 떨어졌다 오를 때 사서, 산 가격보다 8% 넘게 오른 날 팔아요.'],
 r9:['비트코인 뚜렷할 때만','비트코인이 떨어졌다 다시 오를 때, 최근 흐름이 뚜렷한지도 확인하고 사요.']};
const prev=[]; for(const id of Object.keys(ch)){ if(cp[id].name!==ch[id][0]) prev.push("'"+cp[id].name+"':'"+id+"'"); cp[id].name=ch[id][0]; cp[id].one=ch[id][1]; }
const names=Object.values(cp).map(x=>x.name); names.forEach(n=>{ if(n.length>12) throw new Error('long '+n); }); if(new Set(names).size!==names.length) throw new Error('dup name');
fs.writeFileSync(D+'copy.json',JSON.stringify(cp,null,1));
let s=fs.readFileSync(D+'rd-ui.js','utf8');
// 2. 1차 구현의 이름도 별칭으로
s=one(s,"  /* 2026-09-29 이름 개편 전 이름 */\n","  /* 2026-09-29 카드 1차 구현의 이름 */\n  "+prev.join(',')+",\n  /* 2026-09-29 이름 개편 전 이름 */\n");
// 3. 주소와 버튼은 고정 ID 로(이름이 같아도 고른 전략이 열린다)
s+="\n/* 목록, 상세, 시트를 잇는 열쇠는 고정 ID. 이름은 표시용 */\nfunction tfSS3Rid(s){ return s.me?'me':tfSSNe(s.id||s.nick); }\n";
// 4. 수익 낸 거래: 기간을 밝히고, 끝값은 소수로
s=one(s,"if((k===0&&w>0)||(k===10&&w<100)) return Math.round(w)+'%';","if((k===0&&w>0)||(k===10&&w<100)) return (w<1||w>99?w.toFixed(1):String(Math.round(w)))+'%';");
s=one(s,"<small>수익 낸 거래</small>","<small>전체 기간 수익 낸 거래</small>");
// 5. 등록자 역할을 밝힌다
s=one(s,"(s.by?'<span class=\"mk3-by\">@'+gEsc(s.by)+'</span>':'')+'<span class=\"mk3-ex\">","(s.by?'<span class=\"mk3-by\">@'+gEsc(s.by)+' 등록</span>':'')+'<span class=\"mk3-ex\">");
// 6. 검색: 이전 이름과 ID 로도 찾는다
s=one(s,"s.by?'@'+s.by:'',","s.by?'@'+s.by:'',s.id||'',mkOldNames(s.id),");
s+="function mkOldNames(id){ if(!id) return ''; var o=[]; for(var k in MK_ALIAS) if(MK_ALIAS[k]===id) o.push(k); return o.join(' '); }\n";
// 7. 방향 → 흐름
s=one(s,"'방향이 잡히기를 기다리는 중'","'흐름이 뚜렷해지기를 기다리는 중'");
// 8. 따라가기 시트에도 등록자
s=one(s,"function mkFollowLine(s){ var c=s.cfg||{};","function mkFollowLine(s){ var c=s.cfg||{}, by=s.by?'@'+s.by+' 등록, ':'';");
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',"\n/* 좁은 화면: 떠 있는 상담 버튼이 마지막 카드의 버튼을 가리지 않게 */\n@media (max-width:640px){ #g-root .mk .mk-pager{margin-bottom:84px} }\n");
console.log('ok', prev.length);
{ let s2=fs.readFileSync(D+'rd-ui.js','utf8'); s2=one(s2,"if(!s.cfg) return (MK_KIND[s.kind]||'조건 실행')+', '+mkScope(s); return MK_KIND[s.kind]+","if(!s.cfg) return by+(MK_KIND[s.kind]||'조건 실행')+', '+mkScope(s); return by+MK_KIND[s.kind]+"); fs.writeFileSync(D+'rd-ui.js',s2); }
