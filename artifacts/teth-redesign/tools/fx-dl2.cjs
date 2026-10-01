// 다운로드: 휴대전화에서는 QR 대신 링크로 설치 안내
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/download/index.html';
let h=fs.readFileSync(F,'utf8');
h=h.split('<span>휴대전화 카메라로 스캔해 설치합니다</span>').join('<span class="pc">휴대전화 카메라로 스캔해 설치합니다</span><span class="mo">스토어에서 바로 설치합니다</span>');
if(!h.includes('.store .mo{')) h=h.replace('@media (prefers-reduced-motion:reduce)','.store .mo{display:none}\n@media (max-width:640px){ .store .qr{display:none} .store{grid-template-columns:24px minmax(0,1fr)} .store .pc{display:none} .store .mo{display:block} .store .link{margin-top:0} }\n@media (prefers-reduced-motion:reduce)');
fs.writeFileSync(F,h); console.log('ok');
