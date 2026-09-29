// 한 페이지 상세 다듬기: 좁은 화면의 머리글 줄바꿈, 거래내역 표를 두 줄 카드로, 달력의 시뮬레이션 문구 삭제
const fs=require('fs'), D=__dirname+'/';
fs.appendFileSync(D+'rd.css',`
/* 상세 머리글: 판단 방식, 범위, 등록자가 좁은 화면에서 낱말 중간에 끊기지 않게 */
.mk3-dh-t p{flex-wrap:wrap;row-gap:2px}
.mk3-dh-t p b,.mk3-dh-t p span{white-space:nowrap}
/* 거래내역: 좁은 화면에서는 한 건을 두 줄로(종목과 합계, 그 아래 구분과 시간과 가격과 수량) */
@media (max-width:640px){
  .mko-n{display:block;margin-top:4px}
  .mko .mk3-sec-h{display:block}
  #g-root .mko-tbl thead{display:none}
  #g-root .mko-tbl,#g-root .mko-tbl tbody{display:block}
  #g-root .mko-tbl tr{display:grid;grid-template-columns:1fr auto;column-gap:12px;row-gap:4px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)}
  #g-root .mko-tbl td{display:block;padding:0;border:0;white-space:normal;font-size:13px;color:var(--gt2)}
  #g-root .mko-tbl td:nth-child(1){grid-column:1;grid-row:1;font-size:15px}
  #g-root .mko-tbl td:nth-child(6){grid-column:2;grid-row:1;font-size:15px;color:#f2f3f5}
  #g-root .mko-tbl td:nth-child(2){grid-column:1;grid-row:2}
  #g-root .mko-tbl td:nth-child(3){grid-column:2;grid-row:2;text-align:right}
  #g-root .mko-tbl td:nth-child(4){grid-column:1;grid-row:3}
  #g-root .mko-tbl td:nth-child(4):before{content:"가격 ";color:var(--gt3)}
  #g-root .mko-tbl td:nth-child(5){grid-column:2;grid-row:3}
  #g-root .mko-tbl td:nth-child(5):before{content:"수량 ";color:var(--gt3)}
  #g-root .mko-tbl td.r{text-align:right}
  #g-root .mko-tbl td:nth-child(4).r{text-align:left}
  #g-root .mko-tbl td.mko-e{grid-column:1 / -1}
}
`);
let a=fs.readFileSync(D+'apply2.cjs','utf8'); const m=a.indexOf('// 6. rd'); if(a.includes('// 5v.')) throw new Error('dup');
a=a.slice(0,m)+"// 5v. 달력의 월 요약에서 시뮬레이션 문구를 뺀다\nrep(\"+'%':'')+', 검증 시뮬레이션</span></div>'\",\"+'%':'')+'</span></div>'\",true);\n"+a.slice(m);
fs.writeFileSync(D+'apply2.cjs',a); console.log('ok');
