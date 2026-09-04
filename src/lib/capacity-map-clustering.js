const MAX_CLUSTER_MEMBERS=8;
const MAX_VISUAL_OFFSET_PX=32;

const PART_VISUAL_OFFSETS=[
  [0,0],
  [-12,-12],
  [12,-12],
  [-12,12],
  [12,12],
  [-20,0],
  [20,0],
  [0,-20],
  [0,20],
  [-20,-12],
  [20,-12],
  [-20,12],
  [20,12]
];

export function capacityClusterCellSize(zoom){
  if(zoom<=6)return 64;
  if(zoom<=8)return 72;
  return 88;
}

function markerStatus(status){
  return status==='PARTIAL'?'PARTIAL':'EMPTY';
}

function stableEntryOrder(first,second){
  return first.y-second.y||first.x-second.x||first.lat-second.lat||first.lng-second.lng||(first.id<second.id?-1:first.id>second.id?1:0);
}

function boundedOffset(x,y){
  const length=Math.hypot(x,y);
  if(length<=MAX_VISUAL_OFFSET_PX)return{x,y};
  const scale=MAX_VISUAL_OFFSET_PX/length;
  return{x:x*scale,y:y*scale};
}

function separateNearbyGroups(groups){
  const collisionSize=64;
  const buckets=new Map();
  for(const group of groups){
    const cellX=Math.floor(group.projectedAnchor.x/collisionSize);
    const cellY=Math.floor(group.projectedAnchor.y/collisionSize);
    const key=`${cellX}:${cellY}`;
    const bucket=buckets.get(key);
    if(bucket)bucket.push(group);else buckets.set(key,[group]);
  }
  return groups.map(group=>{
    const centerX=group.projectedAnchor.x+group.visualOffset.x;
    const centerY=group.projectedAnchor.y+group.visualOffset.y;
    const cellX=Math.floor(group.projectedAnchor.x/collisionSize);
    const cellY=Math.floor(group.projectedAnchor.y/collisionSize);
    let nearest=null;
    let nearestDistance=Number.POSITIVE_INFINITY;
    for(let x=cellX-1;x<=cellX+1;x+=1){
      for(let y=cellY-1;y<=cellY+1;y+=1){
        for(const candidate of buckets.get(`${x}:${y}`)||[]){
          if(candidate===group)continue;
          const otherX=candidate.projectedAnchor.x+candidate.visualOffset.x;
          const otherY=candidate.projectedAnchor.y+candidate.visualOffset.y;
          const deltaX=centerX-otherX,deltaY=centerY-otherY;
          if(Math.abs(deltaX)>=collisionSize||Math.abs(deltaY)>=collisionSize)continue;
          const distance=Math.hypot(deltaX,deltaY);
          if(distance<nearestDistance){nearest={deltaX,deltaY,groupStatus:candidate.status,groupKey:candidate.key};nearestDistance=distance;}
        }
      }
    }
    if(!nearest)return group;
    let directionX=0,directionY=0;
    if(Math.abs(nearest.deltaX)>=Math.abs(nearest.deltaY)){
      directionX=nearest.deltaX===0?(group.status!==nearest.groupStatus?(group.status==='EMPTY'?-1:1):(group.key<nearest.groupKey?-1:1)):Math.sign(nearest.deltaX);
    }else directionY=Math.sign(nearest.deltaY)||1;
    return{...group,visualOffset:boundedOffset(group.visualOffset.x+directionX*MAX_VISUAL_OFFSET_PX,group.visualOffset.y+directionY*MAX_VISUAL_OFFSET_PX)};
  });
}

/**
 * Groups projected capacity markers in global pixel cells. The caller supplies
 * world-pixel coordinates (Leaflet `project`), so panning cannot change cell
 * membership. Geographic coordinates remain the authoritative marker anchor;
 * the small visual offset is only for separating status/overflow labels.
 *
 * @param {Array<{id:string,status:string,lat:number,lng:number,x:number,y:number}>} entries
 * @param {number} zoom
 */
export function buildCapacityMarkerGroups(entries,zoom){
  const cellSize=capacityClusterCellSize(zoom);
  const buckets=new Map();
  const statusesByCell=new Map();

  for(const candidate of entries){
    const values=[candidate.lat,candidate.lng,candidate.x,candidate.y];
    if(!candidate.id||values.some(value=>!Number.isFinite(value)))continue;
    const status=markerStatus(candidate.status);
    const cellX=Math.floor(candidate.x/cellSize);
    const cellY=Math.floor(candidate.y/cellSize);
    const cellKey=`${cellX}:${cellY}`;
    const bucketKey=`${status}:${cellKey}`;
    const entry={id:candidate.id,status,lat:candidate.lat,lng:candidate.lng,x:candidate.x,y:candidate.y,cellX,cellY,cellKey};
    const bucket=buckets.get(bucketKey);
    if(bucket)bucket.push(entry);else buckets.set(bucketKey,[entry]);
    const statuses=statusesByCell.get(cellKey);
    if(statuses)statuses.add(status);else statusesByCell.set(cellKey,new Set([status]));
  }

  const groups=[];
  for(const [bucketKey,bucket] of buckets){
    bucket.sort(stableEntryOrder);
    const partCount=Math.ceil(bucket.length/MAX_CLUSTER_MEMBERS);
    for(let part=0;part<partCount;part+=1){
      const members=bucket.slice(part*MAX_CLUSTER_MEMBERS,(part+1)*MAX_CLUSTER_MEMBERS);
      let lat=0,lng=0,x=0,y=0;
      const memberIds=[];
      for(const member of members){lat+=member.lat;lng+=member.lng;x+=member.x;y+=member.y;memberIds.push(member.id);}
      const anchor={lat:lat/members.length,lng:lng/members.length};
      const projectedAnchor={x:x/members.length,y:y/members.length};
      const baseOffset=PART_VISUAL_OFFSETS[part%PART_VISUAL_OFFSETS.length];
      const hasBothStatuses=statusesByCell.get(members[0].cellKey)?.size>1;
      // Keep unlike statuses individually readable when they occupy the same
      // market cell. This is a display-only offset: the geographic anchor and
      // cluster membership stay tied to the declared truck coordinates.
      const statusOffset=hasBothStatuses?(members[0].status==='EMPTY'?-32:32):0;
      const maximumX=Math.sqrt(Math.max(0,MAX_VISUAL_OFFSET_PX**2-baseOffset[1]**2));
      const offsetX=Math.max(-maximumX,Math.min(maximumX,baseOffset[0]+statusOffset));
      groups.push({
        key:`${bucketKey}:${part}:${memberIds.join(':')}`,
        cellKey:members[0].cellKey,
        status:members[0].status,
        memberIds,
        anchor,
        projectedAnchor,
        visualOffset:{x:offsetX,y:baseOffset[1]},
        part,
        partCount
      });
    }
  }

  groups.sort((first,second)=>first.projectedAnchor.y-second.projectedAnchor.y||first.projectedAnchor.x-second.projectedAnchor.x||(first.status<second.status?-1:first.status>second.status?1:0)||first.part-second.part||(first.key<second.key?-1:first.key>second.key?1:0));
  return separateNearbyGroups(groups);
}

export {MAX_CLUSTER_MEMBERS,MAX_VISUAL_OFFSET_PX};
