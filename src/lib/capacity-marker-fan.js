// Display-only pixel positions. The original vehicle coordinates stay in the
// map source; a short connector points from each source to its spread marker.
const patterns={
  2:[[-58,0],[58,0]],
  3:[[0,-64],[-64,52],[64,52]],
  4:[[-57,-56],[57,-56],[-57,56],[57,56]]
};

/** @param {string[]} ids
 * @param {{x:number,y:number}} anchor
 * @param {{width:number,height:number,top?:number,bottom?:number,left?:number,right?:number}} viewport
 * @param {{width:number,height:number,anchorY:number}} marker
 * @returns {{id:string,offset:[number,number]}[]|null} */
export function capacityMarkerFanLayout(ids,anchor,viewport,marker){
  if(!Array.isArray(ids)||ids.length<2||ids.length>4||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!id))return null;
  const numbers=[anchor?.x,anchor?.y,viewport?.width,viewport?.height,viewport?.top??0,viewport?.bottom??0,viewport?.left??0,viewport?.right??0,marker?.width,marker?.height,marker?.anchorY];
  if(numbers.some(value=>!Number.isFinite(value))||viewport.width<=0||viewport.height<=0||marker.width<=0||marker.height<=0||marker.anchorY<0||marker.anchorY>1)return null;
  const points=patterns[ids.length],left=(viewport.left??0)+8,right=viewport.width-(viewport.right??0)-8;
  const top=(viewport.top??0)+8,bottom=viewport.height-(viewport.bottom??0)-8;
  const minX=Math.min(...points.map(point=>anchor.x+point[0]-marker.width/2));
  const maxX=Math.max(...points.map(point=>anchor.x+point[0]+marker.width/2));
  const minY=Math.min(...points.map(point=>anchor.y+point[1]-marker.height*marker.anchorY));
  const maxY=Math.max(...points.map(point=>anchor.y+point[1]+marker.height*(1-marker.anchorY)));
  if(maxX-minX>right-left||maxY-minY>bottom-top)return null;
  const shiftX=Math.max(left-minX,Math.min(0,right-maxX));
  const shiftY=Math.max(top-minY,Math.min(0,bottom-maxY));
  return [...ids].sort().map((id,index)=>({id,offset:/** @type {[number,number]} */ ([points[index][0]+shiftX,points[index][1]+shiftY])}));
}
