function mkFollowEsc(e){
  var d=$('ss3-dlgw'); /* 시트 위에 다른 대화 상자가 열려 있으면 그쪽이 맨 위다 */
  if(e.key==='Escape'){ if(!d) mkFollowClose(); return; }
  if(e.key!=='Tab') return;
  var w=d||$('mk-follow'); if(!w) return;
  var f=[].filter.call(w.querySelectorAll('button,input,select,textarea,summary,a[href]'),function(x){ var dt=x.closest('details'); if(dt&&!dt.open&&x.tagName!=='SUMMARY') return false; return !x.disabled&&x.tabIndex>=0&&x.getClientRects().length; });
  if(!f.length){ e.preventDefault(); return; }
  var i=f.indexOf(document.activeElement);
  if(e.shiftKey?i<=0:(i<0||i===f.length-1)){ e.preventDefault(); f[e.shiftKey?f.length-1:0].focus(); }
}
function mkFollowInert(on,w){ [].forEach.call(document.body.children,function(x){ if(x===w||x.tagName==='SCRIPT'||x.tagName==='STYLE') return; if(on){ if(!x.inert){ x.inert=true; x.setAttribute('data-mkf-inert','1'); } } else if(x.getAttribute('data-mkf-inert')){ x.inert=false; x.removeAttribute('data-mkf-inert'); } }); }
