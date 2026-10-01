// 거래소 타일 "연결됨": A(모서리 글자)는 모바일에서 로고와 붙어 답답함 → C(회색 2px 테두리 + 오른쪽 위 체크). 파운더 2026-10-01
const fs=require('fs');
let j=fs.readFileSync('px.js','utf8');
const a=`'<button type="button" onclick="pxPickEx(\\''+b.id+'\\')">'+acLogo(b.id,30)+'<b>'+b.name+'</b>'+(cn?'<small>연결됨</small>':'')+'</button>'`;
if(!j.includes(a)) throw new Error('miss tile');
j=j.replace(a,`'<button type="button"'+(cn?' class="cn" aria-label="'+b.name+', 연결됨"':'')+' onclick="pxPickEx(\\''+b.id+'\\')">'+(cn?'<svg class="ck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':'')+acLogo(b.id,30)+'<b>'+b.name+'</b></button>'`);
fs.writeFileSync('px.js',j);
let c=fs.readFileSync('px.css','utf8');
c=c.replace(/\n\/\* 거래소 타일: 모든 타일 같은 높이[^\n]*\n\.px-exs button\{position:relative\}\n\.px-exs button small\{[^\n]*\n/,'\n/* 거래소 타일: 연결된 거래소는 회색 2px 테두리와 오른쪽 위 체크(높이는 모든 타일 같음) */\n.px-exs button{position:relative}\n.px-exs button.cn{box-shadow:inset 0 0 0 2px #9a9a9a}\n.px-exs button .ck{position:absolute;top:10px;right:12px;color:#cdcdcd}\n');
c=c.replace('  .px-exs button small{top:10px;right:12px;font-size:11px}\n','  .px-exs button .ck{top:9px;right:10px}\n');
fs.writeFileSync('px.css',c);
console.log(c.includes('button.cn'), !c.includes('button small{position:absolute'));
