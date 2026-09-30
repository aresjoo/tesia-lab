// Bitget 청록 로고, 파비콘, 푸터 캐시 무효화
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
function edit(f,pairs){ let s=fs.readFileSync(R+f,'utf8'); for(const [a,b,n] of pairs){ const c=s.split(a).length-1; if(c!==(n||1)) throw new Error(f+' count '+c+' '+a); s=s.split(a).join(b); } fs.writeFileSync(R+f,s); console.log(f,'ok'); }
edit('index.html',[
  ['href="assets/favicon.png"','href="assets/favicon.png?v=3"'],
  ['<image href="assets/logo.png"','<image href="assets/logo.png?v=3"'],
  ['<img src="assets/favicon.png" alt="" width="44"','<img src="assets/favicon.png?v=3" alt="" width="44"'],
  ['site-footer.js?v=14','site-footer.js?v=15'],
]);
for(const f of ['about/index.html','download/index.html','policies/index.html']){
  let s=fs.readFileSync(R+f,'utf8'); const n=s.split('logo.png?v=2').length-1;
  edit(f,[['href="../assets/favicon.png"','href="../assets/favicon.png?v=3"'],['logo.png?v=2','logo.png?v=3',n],['site-footer.js?v=14','site-footer.js?v=15']]);
}
