export const PROVIDER_REGIONS=Object.freeze([
  {code:'ADDIS_ABABA',label:'Addis Ababa'},
  {code:'AFAR',label:'Afar'},
  {code:'AMHARA',label:'Amhara'},
  {code:'BENISHANGUL_GUMUZ',label:'Benishangul-Gumuz'},
  {code:'CENTRAL_ETHIOPIA',label:'Central Ethiopia'},
  {code:'DIRE_DAWA',label:'Dire Dawa'},
  {code:'GAMBELLA',label:'Gambella'},
  {code:'HARARI',label:'Harari'},
  {code:'OROMIA',label:'Oromia'},
  {code:'SIDAMA',label:'Sidama'},
  {code:'SOMALI',label:'Somali'},
  {code:'SOUTH_ETHIOPIA',label:'South Ethiopia'},
  {code:'SOUTH_WEST_ETHIOPIA',label:'South West Ethiopia'},
  {code:'TIGRAY',label:'Tigray'}
]);

export const PROVIDER_REGION_CODES=new Set(PROVIDER_REGIONS.map(region=>region.code));

export const REGIONAL_EXPO_WEEK=Object.freeze([
  {weekday:1,day:'Monday',key:'addis-ababa',title:'Addis Ababa',shortTitle:'Addis Ababa',regionCodes:['ADDIS_ABABA']},
  {weekday:2,day:'Tuesday',key:'oromia',title:'Oromia',shortTitle:'Oromia',regionCodes:['OROMIA']},
  {weekday:3,day:'Wednesday',key:'amhara',title:'Amhara',shortTitle:'Amhara',regionCodes:['AMHARA']},
  {weekday:4,day:'Thursday',key:'north-northeast',title:'Tigray & Afar',shortTitle:'Tigray + Afar',regionCodes:['TIGRAY','AFAR']},
  {weekday:5,day:'Friday',key:'eastern-ethiopia',title:'Somali, Harari & Dire Dawa',shortTitle:'Eastern Ethiopia',regionCodes:['SOMALI','HARARI','DIRE_DAWA']},
  {weekday:6,day:'Saturday',key:'southern-ethiopia',title:'Sidama, Central Ethiopia & South Ethiopia',shortTitle:'Southern Ethiopia',regionCodes:['SIDAMA','CENTRAL_ETHIOPIA','SOUTH_ETHIOPIA']},
  {weekday:0,day:'Sunday',key:'western-ethiopia',title:'Benishangul-Gumuz, Gambella & South West Ethiopia',shortTitle:'Western Ethiopia',regionCodes:['BENISHANGUL_GUMUZ','GAMBELLA','SOUTH_WEST_ETHIOPIA']}
]);

export function providerRegionLabel(code){
  return PROVIDER_REGIONS.find(region=>region.code===String(code||''))?.label||null;
}

export function validateProviderRegionCode(value){
  const code=String(value||'').trim().toUpperCase();
  if(!PROVIDER_REGION_CODES.has(code))throw new Error('PROVIDER_BASE_REGION_REQUIRED');
  return code;
}

export function regionalExpoGroupForDate(value){
  const date=String(value||'');
  const parsed=new Date(`${date}T12:00:00.000Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime()))throw new Error('FEATURED_DATE_INVALID');
  return REGIONAL_EXPO_WEEK.find(group=>group.weekday===parsed.getUTCDay());
}

export function regionalExpoWeekForDate(value){
  const date=String(value||'');
  const parsed=new Date(`${date}T12:00:00.000Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime()))throw new Error('FEATURED_DATE_INVALID');
  const day=parsed.getUTCDay();
  const monday=new Date(parsed);monday.setUTCDate(parsed.getUTCDate()-(day===0?6:day-1));
  return REGIONAL_EXPO_WEEK.map((group,index)=>{const current=new Date(monday);current.setUTCDate(monday.getUTCDate()+index);return {...group,date:current.toISOString().slice(0,10),dateLabel:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(current)};});
}

export function inferProviderRegion(placeRef,label){
  const value=`${placeRef||''} ${label||''}`.toLowerCase();
  const matches=[
    ['addis ababa','ADDIS_ABABA'],['adama','OROMIA'],['jimma','OROMIA'],['shashamane','OROMIA'],
    ['bahir dar','AMHARA'],['gondar','AMHARA'],['dessie','AMHARA'],['kombolcha','AMHARA'],['debre birhan','AMHARA'],
    ['mekelle','TIGRAY'],['semara','AFAR'],['semera','AFAR'],['jigjiga','SOMALI'],['harar','HARARI'],
    ['dire dawa','DIRE_DAWA'],['hawassa','SIDAMA'],['wolkite','CENTRAL_ETHIOPIA'],['arba minch','SOUTH_ETHIOPIA'],
    ['assosa','BENISHANGUL_GUMUZ'],['gambella','GAMBELLA'],['mizan aman','SOUTH_WEST_ETHIOPIA'],['mizan-aman','SOUTH_WEST_ETHIOPIA']
  ];
  return matches.find(([name])=>value.includes(name))?.[1]||null;
}
