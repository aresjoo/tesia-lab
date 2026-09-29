const fs=require('fs'), F='AGENTS.md'; let s=fs.readFileSync(F,'utf8'); const L=s.split('\n');
const keep=L.filter(x=>!/^\| `artifacts\/teth-redesign\/r\d/.test(x)); const i=keep.findIndex(x=>x.startsWith('| `index.html` |')); if(i<0) throw new Error('row');
const cr=L[i+0].endsWith('\r')?'\r':'';
keep.splice(i+1,0,'| `artifacts/teth-redesign/` | 전략 목록과 상세 개편(2026-09-29)의 기록. 라운드별 Claude, Codex 비평(`r0` ~ `r8`), 기준과 최종 스크린샷, `tools/` 에 `index.html` 의 `MK_CAT`, `RD_CORE`, `RD_CSS` 블록을 만드는 소스와 적용 스크립트가 있다. 세 판단 방식(직접 탐색, 조건 실행, 혼합)은 하나의 원장 엔진으로 계산한다. |'+cr);
fs.writeFileSync(F,keep.join('\n')); console.log(L.length-keep.length+1,'rows removed');
