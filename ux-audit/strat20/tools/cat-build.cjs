// texts.json(이름, 소개, 거래소, 순서) + 탐색 결과(out.json) → index.html 의 카탈로그 블록. 사용: node cat-build.cjs out.json
const fs=require('fs'); const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const out=JSON.parse(fs.readFileSync(process.argv[2],'utf8')), texts=JSON.parse(fs.readFileSync(__dirname+'/texts.json','utf8'));
const q=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
const px=Object.keys(out.assets).map(k=>q(k)+':['+out.assets[k].seed+','+out.assets[k].p0+','+out.assets[k].vol+']').join(',');
const rows=texts.map(tx=>{ const s=out.strategies.find(x=>x.id===tx.n); if(!s||!s.pick) throw new Error('no pick '+tx.n); const p=s.pick.p;
  const d0=new Date(2023,0,2); d0.setDate(d0.getDate()+p.startI); const one=tx.one.replace('{hold}',Math.round(s.pick.m.hold)).replace('{start}',d0.getFullYear()+'년 '+(d0.getMonth()+1)+'월');
  return '  {id:'+q('t'+String(tx.n).padStart(2,'0'))+',name:'+q(tx.name)+',one:'+q(one)+',asset:'+q(s.asset)+',ex:'+q(tx.ex)+',px:'+q(s.asset)+',sl:'+p.sl+',tp:'+p.tp+',rsiTh:'+p.rsiTh+',tf:'+(p.tf?1:0)+',startI:'+p.startI+',fw:'+tx.fw+'}'; });
const block='/*MK_CAT_BEGIN*/\r\n/* ═══ 전략 카탈로그: 목록에 나오는 20종 (시드 데이터) ═══\r\n   이름, 한줄소개, 거래소, 규칙값을 여기서만 관리한다. 성과 수치는 적어 넣지 않는다: 아래 규칙값을 자산별 가격(MK_PX_CFG)에 돌린 엔진 계산 결과다.\r\n   실제 운용 데이터가 생기면 이 배열과 mkPx 를 API 응답으로 바꾼다. MK_PX_CFG 값은 [씨앗, 시작가, 하루 변동 폭] */\r\nvar MK_PX_CFG={'+px+'};\r\nvar MK_CAT=[\r\n'+rows.join(',\r\n')+'\r\n];\r\n/*MK_CAT_END*/';
let t=fs.readFileSync(F,'utf8'); const i=t.indexOf('/*MK_CAT_BEGIN*/'), j=t.indexOf('/*MK_CAT_END*/'); if(i<0||j<0) throw new Error('marker');
t=t.slice(0,i)+block+t.slice(j+'/*MK_CAT_END*/'.length); fs.writeFileSync(F,t); console.log('catalog written',rows.length);
