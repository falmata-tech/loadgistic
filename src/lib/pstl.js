function radians(value) {
  return value * Math.PI / 180;
}

export function distanceKm(first,second) {
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(second.lat-first.lat);
  const longitudeDelta = radians(second.lng-first.lng);
  const a = Math.sin(latitudeDelta/2) ** 2
    + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(longitudeDelta/2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function stableGroupId(prefix,ids) {
  let hash = 2166136261;
  for (const character of ids.slice().sort().join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash,16777619);
  }
  return `${prefix}-${(hash>>>0).toString(16).padStart(8,'0')}`;
}

function dateDay(value) {
  if (!value) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp/86_400_000) : null;
}

function deadlineDistanceDays(first,second) {
  const left=dateDay(first);
  const right=dateDay(second);
  return left==null||right==null ? 0 : Math.abs(left-right);
}

function sharedLoadEligible(load) {
  return load.operational_status === 'POSTED'
    && load.movement_scope !== 'LOCAL'
    && load.origin_coordinate
    && load.destination_coordinate
    && dateDay(load.pickup_date)!=null
    && dateDay(load.delivery_date)!=null;
}

function poolPairCompatible(first,second,{originRadiusKm,destinationRadiusKm,deadlineWindowDays}) {
  return distanceKm(first.origin_coordinate,second.origin_coordinate)<=originRadiusKm
    && distanceKm(first.destination_coordinate,second.destination_coordinate)<=destinationRadiusKm
    && deadlineDistanceDays(first.pickup_date,second.pickup_date)<=deadlineWindowDays
    && deadlineDistanceDays(first.delivery_date,second.delivery_date)<=deadlineWindowDays;
}

export function poolCompatibleLoads(loads,{originRadiusKm=40,destinationRadiusKm=40,deadlineWindowDays=3}={}) {
  const eligible = loads.filter(load => load.load_type === 'PTL'
    && load.operational_status === 'POSTED'
    && load.origin_coordinate
    && load.destination_coordinate)
    .sort((a,b)=>a.id.localeCompare(b.id));
  const assigned = new Set();
  const groups = [];
  for (const seed of eligible) {
    if (assigned.has(seed.id)) continue;
    const members=[seed];
    for (const candidate of eligible) {
      if (candidate.id===seed.id||assigned.has(candidate.id)) continue;
      if (members.every(member=>poolPairCompatible(member,candidate,{originRadiusKm,destinationRadiusKm,deadlineWindowDays}))) {
        members.push(candidate);
      }
    }
    if(members.length<2) continue;
    members.forEach(member=>assigned.add(member.id));
    groups.push({
      id:stableGroupId('pstl',members.map(member=>member.id)),
      strategy:'POOL',
      member_count:members.length,
      origin:members[0].origin,
      destination:members[0].destination,
      earliest_pickup:members.map(member=>member.pickup_date).filter(Boolean).sort()[0] || null,
      latest_delivery:members.map(member=>member.delivery_date).filter(Boolean).sort().at(-1) || null,
      origin_spread_km:Math.round(Math.max(...members.map(member=>distanceKm(members[0].origin_coordinate,member.origin_coordinate)))),
      destination_spread_km:Math.round(Math.max(...members.map(member=>distanceKm(members[0].destination_coordinate,member.destination_coordinate)))),
      members
    });
  }
  return groups.sort((a,b)=>b.member_count-a.member_count || a.id.localeCompare(b.id));
}

function bearing(first,second) {
  const firstLatitude=radians(first.lat);
  const secondLatitude=radians(second.lat);
  const longitudeDelta=radians(second.lng-first.lng);
  const y=Math.sin(longitudeDelta)*Math.cos(secondLatitude);
  const x=Math.cos(firstLatitude)*Math.sin(secondLatitude)
    - Math.sin(firstLatitude)*Math.cos(secondLatitude)*Math.cos(longitudeDelta);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}

function bearingDifference(first,second) {
  const difference=Math.abs(first-second)%360;
  return Math.min(difference,360-difference);
}

function canFollow(first,second,{handoffRadiusKm,maxBearingDifferenceDegrees}) {
  if(first.id===second.id) return false;
  const connectorKm=distanceKm(first.destination_coordinate,second.origin_coordinate);
  if(connectorKm>handoffRadiusKm) return false;
  const firstBearing=bearing(first.origin_coordinate,first.destination_coordinate);
  const secondBearing=bearing(second.origin_coordinate,second.destination_coordinate);
  if(bearingDifference(firstBearing,secondBearing)>maxBearingDifferenceDegrees) return false;
  const continuationBearing=bearing(first.destination_coordinate,second.destination_coordinate);
  if(bearingDifference(firstBearing,continuationBearing)>maxBearingDifferenceDegrees) return false;
  const firstDrop=dateDay(first.delivery_date);
  const nextPickup=dateDay(second.pickup_date);
  return firstDrop<=nextPickup&&dateDay(second.pickup_date)>dateDay(first.pickup_date);
}

export function buildAlongRouteChains(loads,{
  handoffRadiusKm=60,
  maxBearingDifferenceDegrees=90,
  maxLegs=8
}={}) {
  const eligible=loads.filter(sharedLoadEligible).sort((a,b)=>
    (dateDay(a.pickup_date)??Number.MAX_SAFE_INTEGER)-(dateDay(b.pickup_date)??Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id));
  const options={handoffRadiusKm,maxBearingDifferenceDegrees};
  const adjacency=new Map(eligible.map(load=>[
    load.id,
    eligible.filter(candidate=>canFollow(load,candidate,options)).sort((a,b)=>
      distanceKm(load.destination_coordinate,a.origin_coordinate)-distanceKm(load.destination_coordinate,b.origin_coordinate)
      || (dateDay(a.pickup_date)??Number.MAX_SAFE_INTEGER)-(dateDay(b.pickup_date)??Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id))
  ]));
  const bestPathMemo=new Map();
  const bestPathFrom=(load)=>{
    if(bestPathMemo.has(load.id)) return bestPathMemo.get(load.id);
    let best=[load];
    let bestConnectorDistance=0;
    for(const candidate of adjacency.get(load.id)||[]) {
      const tail=bestPathFrom(candidate).slice(0,Math.max(0,maxLegs-1));
      const path=[load,...tail];
      const connectorDistance=distanceKm(load.destination_coordinate,candidate.origin_coordinate)
        + tail.slice(1).reduce((total,member,index)=>
          total+distanceKm(tail[index].destination_coordinate,member.origin_coordinate),0);
      if(path.length>best.length||(path.length===best.length&&connectorDistance<bestConnectorDistance)) {
        best=path;
        bestConnectorDistance=connectorDistance;
      }
    }
    bestPathMemo.set(load.id,best);
    return best;
  };
  const paths=eligible.map(bestPathFrom)
    .filter(path=>path.length>=2)
    .sort((a,b)=>b.length-a.length
      || a.slice(1).reduce((total,member,index)=>total+distanceKm(a[index].destination_coordinate,member.origin_coordinate),0)
        - b.slice(1).reduce((total,member,index)=>total+distanceKm(b[index].destination_coordinate,member.origin_coordinate),0)
      || a[0].id.localeCompare(b[0].id));
  const used=new Set();
  const chains=[];
  for(const path of paths) {
    const members=path.filter(member=>!used.has(member.id)).slice(0,maxLegs);
    if(members.length<2||members.some((member,index)=>index>0&&!canFollow(members[index-1],member,options))) continue;
    members.forEach(member=>used.add(member.id));
    const connectors=members.slice(1).map((member,index)=>({
      from_load_id:members[index].id,
      to_load_id:member.id,
      distance_km:Math.round(distanceKm(members[index].destination_coordinate,member.origin_coordinate))
    }));
    chains.push({
      id:stableGroupId('route',members.map(member=>member.id)),
      strategy:'ALONG_ROUTE',
      member_count:members.length,
      origin:members[0].origin,
      destination:members.at(-1).destination,
      earliest_pickup:members[0].pickup_date||null,
      latest_delivery:members.at(-1).delivery_date||null,
      loaded_distance_km:Math.round(members.reduce((total,member)=>
        total+distanceKm(member.origin_coordinate,member.destination_coordinate),0)),
      connector_distance_km:connectors.reduce((total,connector)=>total+connector.distance_km,0),
      connectors,
      members
    });
  }
  return chains.sort((a,b)=>b.member_count-a.member_count
    || a.connector_distance_km-b.connector_distance_km
    || a.id.localeCompare(b.id));
}
