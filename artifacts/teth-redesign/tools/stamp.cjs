// 빌드 번호 찍기: 새로고침해도 예전 페이지가 뜨는 문제(GitHub Pages max-age=600 + CDN) 해결
// 1) index.html 머리에 빌드 번호와 새 버전 확인 스크립트를 넣는다(표시 사이 내용만 바꿔서 여러 번 돌려도 같다)
// 2) version.json 에 같은 번호를 쓴다
// 3) 자주 바뀌는 공용 스크립트 주소 뒤에 ?v=빌드 번호를 붙인다(큰 data/ 파일은 그대로)
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const d=new Date(), p=n=>String(n).padStart(2,'0');
const B=d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
let h=fs.readFileSync(R+'index.html','utf8');
const S='<!--TETH_BUILD-->', E='<!--/TETH_BUILD-->';
const js="(function(){var B='"+B+"';window.TETH_BUILD=B;"
 +"try{var u0=new URL(location.href);if(u0.searchParams.get('_v')===B){u0.searchParams.delete('_v');history.replaceState(history.state,'',u0.pathname+u0.search+u0.hash);}}catch(e){}"
 +"function chk(){try{fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){"
 +"if(!j||!j.b||j.b<=B)return;var k='teth.reloadFor';try{if(sessionStorage.getItem(k)===j.b)return;sessionStorage.setItem(k,j.b);}catch(e){}"
 +"var u=new URL(location.href);u.searchParams.set('_v',j.b);location.replace(u.pathname+u.search+u.hash);}).catch(function(){});}catch(e){}}"
 +"chk();addEventListener('pageshow',function(e){if(e.persisted)chk();});})();";
const block=S+'<meta http-equiv="Cache-Control" content="no-cache"><script>'+js+'</script>'+E;
if(h.includes(S)) h=h.replace(new RegExp(S+'[\\s\\S]*?'+E),block);
else h=h.replace('<title>TETH</title>','<title>TETH</title>\n'+block);
let n=0;
h=h.replace(/(<script src="(?:site-config|site-footer|teth-copy|help-widget)\.js)\?v=[^"]*"/g,(m,a)=>{ n++; return a+'?v='+B+'"'; });
fs.writeFileSync(R+'index.html',h);
fs.writeFileSync(R+'version.json',JSON.stringify({b:B})+'\n');
console.log('stamp',B,'scripts',n,'block',h.includes(S));
