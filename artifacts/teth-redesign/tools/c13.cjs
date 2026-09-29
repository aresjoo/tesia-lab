// 개요 탭: 성과 영역만 남겨 맨 위에 둔다(지금, 하는 일, 움직이는 방식, 최근 판단 삭제)
const fs=require('fs'), D=__dirname+'/';
let s=fs.readFileSync(D+'rd-ui.js','utf8');
const a="  var does=mkDoes(s), how=mkHowRows(s), evs=mkEvFold(mkEvents(s,R0),4);\n  return '<div class=\"mk3-ov\">'\n";
const b="    +'<section class=\"mk3-sec\"><h3>성과</h3>'\n";
const i=s.indexOf(a), j=s.indexOf(b,i); if(i<0||j<0) throw new Error('anchor');
s=s.slice(0,i)+"  return '<div class=\"mk3-ov\">'\n    +'<section class=\"mk3-sec\" style=\"margin-top:0\"><h3>성과</h3>'\n"+s.slice(j+b.length);
fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
