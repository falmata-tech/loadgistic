const FEATURED_TRUCK_DAYS=Object.freeze([
  {key:'mini-trucks',label:'Mini trucks',shortLabel:'Mini',configurations:['Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck']},
  {key:'cargo-vans',label:'Cargo vans',shortLabel:'Vans',configurations:['Cargo van']},
  {key:'pickups',label:'Pickup trucks',shortLabel:'Pickups',configurations:['Pickup truck','Pickup stake body']},
  {key:'light-duty',label:'Light-duty trucks',shortLabel:'Light duty',configurations:['Light Box Truck','Light Stake Body Truck']},
  {key:'medium-duty',label:'Medium-duty trucks',shortLabel:'Medium duty',configurations:['Medium Box Truck','Medium Stake Body Truck']},
  {key:'heavy-trucks',label:'Heavy trucks',shortLabel:'Heavy',configurations:[
    'Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer',
    'Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
  ]},
  {key:'courier-cars',label:'Courier cars',shortLabel:'Courier',configurations:['Courier car']}
]);

function validDate(date){
  const text=String(date||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw new Error('FEATURED_DATE_INVALID');
  return text;
}

export function featuredTruckTypeForDate(date){
  const value=validDate(date);
  const day=new Date(`${value}T12:00:00Z`).getUTCDay();
  const mondayIndex=day===0?6:day-1;
  return FEATURED_TRUCK_DAYS[mondayIndex];
}

export function featuredTruckWeekForDate(date){
  const value=validDate(date);const anchor=new Date(`${value}T12:00:00Z`);const day=anchor.getUTCDay();
  anchor.setUTCDate(anchor.getUTCDate()-(day===0?6:day-1));
  return FEATURED_TRUCK_DAYS.map((entry,index)=>{const current=new Date(anchor);current.setUTCDate(anchor.getUTCDate()+index);const iso=current.toISOString().slice(0,10);return {...entry,date:iso,dateLabel:new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(current),day:new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long'}).format(current)};});
}

export function selectBalancedFeaturedTruckRows(rows,configurations,limit=8){
  const buckets=configurations.map(configuration=>rows.filter(row=>row?.vehicle?.cargo_configuration===configuration));
  const selected=[];
  while(selected.length<limit&&buckets.some(bucket=>bucket.length)){
    for(const bucket of buckets){
      const next=bucket.shift();
      if(next)selected.push(next);
      if(selected.length===limit)break;
    }
  }
  return selected;
}

export {FEATURED_TRUCK_DAYS};
