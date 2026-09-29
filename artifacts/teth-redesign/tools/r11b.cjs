const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'rd-ui.js','utf8');
const A="if(had&&a){ try{ a.focus(); }catch(e){} } }", B="if(had){ var bx=document.querySelector('#mk-follow .mk-follow'); try{ if(a&&innerWidth>760) a.focus(); else if(bx){ bx.setAttribute('tabindex','-1'); bx.focus(); } }catch(e){} } } /* 좁은 화면에서는 자판을 띄우지 않는다 */";
if(s.split(A).length-1!==1) throw new Error('a'); s=s.replace(A,()=>B); fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
