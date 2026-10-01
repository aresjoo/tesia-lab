// sk-bt.js 에 Codex bt/s3 카피 8건 반영
const fs=require('fs'); const f=__dirname+'/sk-bt.js'; let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('count '+n+' '+a.slice(0,60)); s=s.replace(a,b); };
rep(`'$1일을 돌렸습니다. 숫자나 차트 표시를 누르면 근거를 확인합니다.'`, `'$1일간의 결과입니다. 숫자나 차트 표시를 누르면 판단 근거가 열립니다.'`);
rep(`[/^(최근 \\d+(?:개월|년)|전체 기간) 동안, (\\$[0-9,]+)로$/,'$1, 시작 금액 $2'],`, `[/^(최근 \\d+(?:개월|년)|전체 기간) 동안, (\\$[0-9,]+)로$/,'$1, 시작 금액 $2 기준 손익'],`);
rep(`'전체 기간이 포함된 $1개월 중 $2개월에 수익이 났습니다.'`, `'한 달 전체를 계산한 $1개월 중 $2개월에 수익이 났습니다.'`);
rep(`'가장 유리했던 가격에서 기준만큼 되돌아와 청산했습니다.'`, `'가격이 가장 유리했던 지점에서 청산 기준만큼 되돌아와 청산했습니다.'`);
rep(`  /* 금액 선택지 500 → $500 (em USD 는 CSS로 숨김) */`,
`  /* 결과 카드: 현물 보유 손익, 현물 보유 최대 하락률 값은 계산 결과에서 직접 */
  var v2=root.querySelector('.bt-v2 > span'); if(v2&&v2.firstChild&&v2.firstChild.nodeType===3&&/^현물 보유 $/.test(v2.firstChild.nodeValue)) v2.firstChild.nodeValue='현물 보유 손익 ';
  var em=root.querySelector('.bt-k3 em.num'); if(em&&window.BT&&BT.R&&isFinite(BT.R.benchMdd)&&!/[0-9]%/.test(em.textContent)) em.textContent='현물 보유 최대 하락률 '+BT.R.benchMdd.toFixed(1)+'%';
  /* 금액 선택지 500 → $500 (em USD 는 CSS로 숨김) */`);
fs.writeFileSync(f,s); console.log('ok');
