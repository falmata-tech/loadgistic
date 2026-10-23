type Frame={left:number;top:number;width:number;height:number};
/** Keep the map's center while using viewport room for the public truck summary. */
export function capacityDetailFrame(host:Frame,viewport:{width:number;height:number}):Frame{
 const center=Math.max(16,Math.min(viewport.height-16,host.top+host.height/2));
 const height=2*Math.min(center,viewport.height-center);
 const left=Math.max(0,host.left),width=Math.max(0,Math.min(host.width,viewport.width-left));
 return {left,top:center-height/2,width,height};
}
