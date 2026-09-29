/* 카드의 30일 그래프.
   가로축: 30일의 하루하루를 같은 간격으로, 왼쪽 끝이 30일 전이고 오른쪽 끝이 오늘. 점을 다시 뽑거나 곡선으로 부풀리지 않는다.
   세로축: 그 30일의 최저와 최고에 맞춰 높이를 다 쓴다. 시작값(0%)은 항상 범위에 넣는다.
   0% 아래로 내려간 구간만 붉게, 그때만 0% 선을 옅게 그린다. 면은 채우지 않는다 */
function mkSpark3(eq){
  var W=150, H=56, pad=4, n=eq?eq.length:0;
  if(n<2) return '<span class="mk-spark"></span>';
  var base=eq[0].v, min=base, max=base, i;
  for(i=0;i<n;i++){ if(eq[i].v<min) min=eq[i].v; if(eq[i].v>max) max=eq[i].v; }
  if(max-min<1e-9) return '<svg class="mk-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="'+(H/2)+'" x2="'+W+'" y2="'+(H/2)+'" stroke="rgba(255,255,255,.34)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  var X=function(j){ return 1+j/(n-1)*(W-2); }, Y=function(v){ return pad+(1-(v-min)/(max-min))*(H-pad*2); };
  var P=eq.map(function(e,j){ return [X(j),Y(e.v)]; });
  /* 꺾이는 곳만 살짝 둥글게(반지름 2.5). 평평한 구간은 평평하게 남는다 */
  var d='M'+P[0][0].toFixed(1)+' '+P[0][1].toFixed(1), R=2.5;
  for(i=1;i<n-1;i++){
    var a=P[i-1], b=P[i], c=P[i+1], l1=Math.sqrt((b[0]-a[0])*(b[0]-a[0])+(b[1]-a[1])*(b[1]-a[1])), l2=Math.sqrt((c[0]-b[0])*(c[0]-b[0])+(c[1]-b[1])*(c[1]-b[1]));
    var r1=Math.min(R,l1/2), r2=Math.min(R,l2/2);
    if(l1<1e-6||l2<1e-6){ d+=' L'+b[0].toFixed(1)+' '+b[1].toFixed(1); continue; }
    d+=' L'+(b[0]-(b[0]-a[0])/l1*r1).toFixed(1)+' '+(b[1]-(b[1]-a[1])/l1*r1).toFixed(1)
      +' Q'+b[0].toFixed(1)+' '+b[1].toFixed(1)+' '+(b[0]+(c[0]-b[0])/l2*r2).toFixed(1)+' '+(b[1]+(c[1]-b[1])/l2*r2).toFixed(1);
  }
  d+=' L'+P[n-1][0].toFixed(1)+' '+P[n-1][1].toFixed(1);
  var yb=Y(base), neg=min<base-1e-9, id='mk3s'+(++MK_SPARK_N), G='#2ebd85', Rd='#f0566a';
  var ln=function(col){ return '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'; };
  if(!neg) return '<svg class="mk-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'+ln(G)+'</svg>';
  return '<svg class="mk-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><defs>'
    +'<clipPath id="'+id+'u"><rect x="-2" y="-2" width="'+(W+4)+'" height="'+(yb+2).toFixed(1)+'"/></clipPath>'
    +'<clipPath id="'+id+'d"><rect x="-2" y="'+yb.toFixed(1)+'" width="'+(W+4)+'" height="'+(H-yb+2).toFixed(1)+'"/></clipPath></defs>'
    +'<line x1="0" y1="'+yb.toFixed(1)+'" x2="'+W+'" y2="'+yb.toFixed(1)+'" stroke="rgba(255,255,255,.2)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>'
    +'<g clip-path="url(#'+id+'u)">'+ln(G)+'</g><g clip-path="url(#'+id+'d)">'+ln(Rd)+'</g></svg>';
}
