// sk-term.js 카피 추가: 금지어(데모, 시뮬레이션) 제거, 영어 라벨, 반말 칩, 합니다체
const fs=require('fs'); const f=__dirname+'/sk-term.js'; let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('count '+n+' '+a.slice(0,60)); s=s.replace(a,b); };
rep(`  '전략 검색':'전략 검색'};`,
`  '데모 체험, 시뮬레이션 데이터입니다':'미리보기 화면입니다. 예시 전략으로 보여 드립니다.',
  '기다리는 것':'기다리는 조건','검증 구간 재생, 일봉':'검증 구간 기록, 일봉','✓ 도달':'도달','✓':'충족','리스크 규칙, 유지':'위험 규칙, 유지',
  '왜 아직 진입 안 했어?':'아직 진입하지 않은 이유','지금 가장 큰 리스크는?':'지금 가장 큰 위험','다음 진입 조건은?':'다음 진입 조건','더 보수적으로 바꿔줘':'더 보수적으로 바꾸기',
  'Equity':'평가 금액','USD 기준, 검증 구간':'USD 기준, 검증 구간 기록','BUY':'매수','SELL':'매도','전략 검색':'전략 검색'};`);
rep(`  [/^진입 신호를 탐색하는 중입니다\\.$/,'진입 신호를 찾고 있습니다.']`,
`  [/^진입 신호를 탐색하는 중입니다\\.$/,'진입 신호를 찾고 있습니다.'],
  [/\\s*\\(시뮬레이션\\)/g,''],
  [/^이전 판단 더 보기 \\((\\d+)\\)$/,'이전 판단 더 보기, $1건']`);
rep(`  [].forEach.call(root.querySelectorAll('.tft-empty .nfx-btn.pri')`,
`  [].forEach.call(root.querySelectorAll('.tft-comp .row input'),function(i){ if(/바꿔줘/.test(i.placeholder)) i.placeholder='예: 손절을 -3%로 바꿔 주십시오'; });
  [].forEach.call(root.querySelectorAll('.tft-empty .nfx-btn.pri')`);
fs.writeFileSync(f,s); console.log('ok');
