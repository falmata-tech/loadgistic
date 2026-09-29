/** @typedef {{x:number,y:number}} PixelPoint */
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const difference=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;

/** Choose a bounded lane against parallel portions of already-rendered signals. */
function clearLane(a,b,normal,preferred,references){
  const delta=difference(b,a),length=Math.hypot(delta.x,delta.y);
  const unit={x:delta.x/length,y:delta.y/length};
  const ranges=[];
  for(const path of references)for(let i=1;i<path.length;i++){
    const start=path[i-1],end=path[i],edge=difference(end,start),edgeLength=Math.hypot(edge.x,edge.y);
    if(!edgeLength||Math.abs(dot(unit,edge)/edgeLength)<.98)continue;
    const t0=dot(difference(start,a),unit),t1=dot(difference(end,a),unit);
    const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(length,Math.max(t0,t1));
    if(hi-lo<Math.min(8,Math.min(length,edgeLength)/4))continue;
    const d0=dot(difference(start,a),normal),d1=dot(difference(end,a),normal);
    const at=t=>d0+(d1-d0)*(t-t0)/(t1-t0);
    const min=Math.min(at(lo),at(hi)),max=Math.max(at(lo),at(hi));
    if(min<=36&&max>=-36)ranges.push({min,max});
  }
  if(!ranges.length)return preferred;
  const clearance=lane=>Math.min(...ranges.map(({min,max})=>lane<min?min-lane:lane>max?lane-max:0));
  if(clearance(preferred)>=12-1e-6)return preferred;
  const candidates=[...new Set([preferred,-preferred,6,-6,12,-12,18,-18,24,-24])].sort((a,b)=>Math.abs(a)-Math.abs(b)||Math.abs(a-preferred)-Math.abs(b-preferred));
  return candidates.find(lane=>clearance(lane)>=12-1e-6)??candidates.reduce((best,lane)=>clearance(lane)>clearance(best)?lane:best,preferred);
}

/**
 * Display-only projected-pixel lanes. Closed rings default inward/outward;
 * open paths default to a canonical direction. References resolve partially
 * shared legs independently of either path's overall endpoint order.
 * Input coordinates are never mutated or used for matching/persistence.
 * @param {PixelPoint[]} points
 * @param {number} offset
 * @param {boolean} closed
 * @param {PixelPoint[][]} references Already-rendered current signal paths.
 * @returns {PixelPoint[]}
 */
export function offsetSignalPath(points,offset,closed=false,references=[]){
  if(points.length<2||!offset)return points.map(point=>({...point}));
  const repeatedEnd=same(points[0],points.at(-1));
  const ring=closed||repeatedEnd;
  const source=points.filter((point,index)=>!index||!same(point,points[index-1]));
  if(repeatedEnd&&source.length>1)source.pop();
  if(source.length<2)return points.map(point=>({...point}));
  const area=ring?source.reduce((sum,p,i)=>sum+cross(p,source[(i+1)%source.length]),0):0;
  const perimeter=ring?source.reduce((sum,p,i)=>{const q=source[(i+1)%source.length];return sum+Math.hypot(p.x-q.x,p.y-q.y);},0):0;
  // Reduce the inward lane for tiny areas instead of inverting their boundary.
  const preferred=ring&&offset<0?-Math.min(-offset,Math.abs(area)/(4*perimeter||1)):offset;
  const first=source[0],last=source.at(-1);
  const direction=ring?(area>=0?-1:1):(first.x<last.x||(first.x===last.x&&first.y<=last.y)?1:-1);
  const segments=source.slice(0,ring?source.length:-1).map((a,index)=>{
    const b=source[(index+1)%source.length],delta=difference(b,a),length=Math.hypot(delta.x,delta.y);
    const unit={x:delta.x/length,y:delta.y/length};
    const normal={x:-unit.y*direction,y:unit.x*direction};
    const lane=references.length?clearLane(a,b,normal,preferred,references):preferred;
    const shift=p=>({x:p.x+normal.x*lane,y:p.y+normal.y*lane});
    return{start:shift(a),end:shift(b),unit,lane};
  });
  const join=(index)=>{
    const before=segments[(index-1+segments.length)%segments.length],after=segments[index%segments.length];
    if(same(before.end,after.start))return[before.end];
    const denominator=cross(before.unit,after.unit);
    if(Math.abs(denominator)>1e-6){
      const t=cross(difference(after.start,before.end),after.unit)/denominator;
      const point={x:before.end.x+t*before.unit.x,y:before.end.y+t*before.unit.y};
      const maxCorner=Math.max(Math.abs(before.lane),Math.abs(after.lane))*2;
      if(Math.hypot(point.x-source[index].x,point.y-source[index].y)<=maxCorner+1e-6)return[point];
    }
    // Preserve both segment lanes at sharp/reversing turns rather than moving
    // a shared segment's endpoint back toward the other signal.
    return[before.end,after.start];
  };
  const shifted=ring?source.flatMap((_,index)=>join(index)):[segments[0].start,...source.slice(1,-1).flatMap((_,index)=>join(index+1)),segments.at(-1).end];
  return repeatedEnd?[...shifted,{...shifted[0]}]:shifted;
}
