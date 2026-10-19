import {
  NEW_DRIVER_PORTRAIT_PRESETS
} from '../src/lib/driver-portraits.js';

const ICON_FALLBACK_FIRST_NAMES=new Set([
  'Bethlehem','Eden','Genet','Iman','Kalkidan','Liya','Rahel','Saron','Tigist'
]);

export function assignFixtureDriverPortraits(users){
  const photographedDriverIds=new Set(users
    .filter(user=>user.role==='DRIVER')
    .filter(user=>!ICON_FALLBACK_FIRST_NAMES.has(String(user.name||'').trim().split(/\s+/)[0]))
    .filter((_,index)=>index%3===0)
    .slice(0,NEW_DRIVER_PORTRAIT_PRESETS.length)
    .map(user=>user.id));
  let photographedDriverIndex=0;

  return users.map(user=>{
    if(user.role!=='DRIVER')return {...user,driver_portrait_preset:null};
    if(!photographedDriverIds.has(user.id)){
      return {...user,driver_portrait_preset:null};
    }

    const portraitPreset=NEW_DRIVER_PORTRAIT_PRESETS[photographedDriverIndex]||null;
    photographedDriverIndex+=1;

    return {...user,driver_portrait_preset:portraitPreset};
  });
}
