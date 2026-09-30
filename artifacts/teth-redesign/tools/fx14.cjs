const fs=require('fs');let s=fs.readFileSync('rd-ui.js','utf8').split('\n');
if(!/var bF=/.test(s[188])||!/mk3-foot/.test(s[197])) throw new Error('lines');
s[188]="  var bV='<button type=\"button\" class=\"mk3-b fill\" onclick=\"tfSS3Go(\''+ne+'\')\">전략 보기</button>'; /* 카드 단추는 하나: 상세로 */";
s[197]="    +'<div class=\"mk3-foot\">'+bV+'</div>'";
fs.writeFileSync('rd-ui.js',s.join('\n')); console.log('ok');
