/**
 * Place a measured hover card in client coordinates. Keep it on the chosen
 * side of the marker whenever it fits, then center it along that side.
 * @param {{left:number, top:number, right:number, bottom:number}} marker
 * @param {{left:number, top:number, right:number, bottom:number}} bounds
 * @param {{width:number, height:number}} card
 * @returns {{direction:'top'|'bottom'|'left'|'right',left:number,top:number}|null}
 */
export function capacityHoverPlacement(marker,bounds,{width,height}){
  const gap=8;
  const centerX=(marker.left+marker.right)/2,centerY=(marker.top+marker.bottom)/2;
  const candidates=/** @type {const} */ ([
    {direction:'top',left:centerX-width/2,top:marker.top-gap-height,vertical:true},
    {direction:'bottom',left:centerX-width/2,top:marker.bottom+gap,vertical:true},
    {direction:'right',left:marker.right+gap,top:centerY-height/2,vertical:false},
    {direction:'left',left:marker.left-gap-width,top:centerY-height/2,vertical:false},
  ]);
  let best=null,sideShift=Infinity,alignmentShift=Infinity;
  for(const candidate of candidates){
    const left=Math.max(bounds.left,Math.min(candidate.left,bounds.right-width));
    const top=Math.max(bounds.top,Math.min(candidate.top,bounds.bottom-height));
    const dx=Math.abs(left-candidate.left),dy=Math.abs(top-candidate.top);
    const primary=candidate.vertical?dy:dx,cross=candidate.vertical?dx:dy;
    if(primary>sideShift||(primary===sideShift&&cross>=alignmentShift))continue;
    best={direction:candidate.direction,left,top};
    sideShift=primary;
    alignmentShift=cross;
  }
  return best;
}
