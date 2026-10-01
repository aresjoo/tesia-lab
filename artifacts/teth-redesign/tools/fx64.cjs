const fs=require('fs');
const cut=(f,lines)=>{ let s=fs.readFileSync(f,'utf8'); lines.forEach(l=>{ if(!s.includes(l)) throw new Error('miss '+l.slice(0,60)); s=s.replace(l+'\n',''); }); fs.writeFileSync(f,s); };
// 차트 색 복원: 0선(시작 금액) 위 초록, 아래 빨강, 그라데이션 (파운더 2026-10-01 "통일해")
cut('sk-detail.css',['.mk-detail .mkd-chart path[fill^="url(#mkdg"]{display:none}','.mk-detail .mkd-chart path[stroke="#2fb98a"],.mk-detail .mkd-chart path[stroke="#f0566a"]{stroke:#ececec}']);
cut('sk-bt.css',['#bt-root .bt-chart path[fill="url(#btgu)"],#bt-root .bt-chart path[fill="url(#btgd)"]{display:none}','#bt-root .bt-chart path[stroke="#2fb98a"],#bt-root .bt-chart path[stroke="#f0566a"]{stroke:#ececec}']);
// 판단 기록의 월 묶음 머리 삭제 (파운더 "굳이 월을 왜 나눔? 빼자")
fs.appendFileSync('sk-bt.css','\n/* 판단 기록: 월 묶음 머리 없음(파운더). 첫 행 위 선은 목록 위 선과 겹치지 않게 */\n#bt-root .bt-ym{display:none!important}\n');
console.log('ok');
