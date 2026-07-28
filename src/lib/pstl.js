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

function stableGroupId(ids) {
  let hash = 2166136261;
  for (const character of ids.slice().sort().join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash,16777619);
  }
  return `pstl-${(hash>>>0).toString(16).padStart(8,'0')}`;
}

export function poolCompatibleLoads(loads,{originRadiusKm=40,destinationRadiusKm=40}={}) {
  const eligible = loads.filter(load => load.load_type === 'PTL'
    && load.operational_status === 'POSTED'
    && load.origin_coordinate
    && load.destination_coordinate);
  const adjacent = new Map(eligible.map(load => [load.id,new Set()]));
  for (let left=0;left<eligible.length;left+=1) {
    for (let right=left+1;right<eligible.length;right+=1) {
      const first=eligible[left];
      const second=eligible[right];
      if (distanceKm(first.origin_coordinate,second.origin_coordinate)<=originRadiusKm
        && distanceKm(first.destination_coordinate,second.destination_coordinate)<=destinationRadiusKm) {
        adjacent.get(first.id).add(second.id);
        adjacent.get(second.id).add(first.id);
      }
    }
  }
  const byId = new Map(eligible.map(load=>[load.id,load]));
  const visited = new Set();
  const groups = [];
  for (const load of eligible) {
    if (visited.has(load.id)) continue;
    const queue=[load.id];
    const members=[];
    visited.add(load.id);
    while(queue.length) {
      const id=queue.shift();
      members.push(byId.get(id));
      for(const neighbor of adjacent.get(id)) {
        if(!visited.has(neighbor)){visited.add(neighbor);queue.push(neighbor);}
      }
    }
    if(members.length<2)continue;
    members.sort((a,b)=>a.id.localeCompare(b.id));
    groups.push({
      id:stableGroupId(members.map(member=>member.id)),
      member_count:members.length,
      origin:members[0].origin,
      destination:members[0].destination,
      earliest_pickup:members.map(member=>member.pickup_date).filter(Boolean).sort()[0] || null,
      latest_delivery:members.map(member=>member.delivery_date).filter(Boolean).sort().at(-1) || null,
      members
    });
  }
  return groups.sort((a,b)=>b.member_count-a.member_count || a.id.localeCompare(b.id));
}
