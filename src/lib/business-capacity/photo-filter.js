// Private broker/shipper Capacity only. Never add these fields to the public
// Capacity filter parser or its query projection.
export const PHOTO_MAX_AGE_HOURS=Object.freeze([12,24,72,168]);

function invalid(){throw new Error('INVALID_PRIVATE_PHOTO_FILTER');}
function value(input){
 if(input===undefined||input===null||input==='')return '';
 if(typeof input!=='string')invalid();
 return input;
}
export function privatePhotoFilterValues(record={}){
 const present=value(record.photoPresent),age=value(record.photoMaxAgeHours);
 if(!['','true','false'].includes(present))invalid();
 if(age!==''&&!PHOTO_MAX_AGE_HOURS.some(hours=>String(hours)===age))invalid();
 return {photoPresent:age?'true':present==='true'?'true':'',photoMaxAgeHours:age};
}
export function privatePhotoFilterParams(params){
 if(params.getAll('photoPresent').length>1||params.getAll('photoMaxAgeHours').length>1)invalid();
 return privatePhotoFilterValues({photoPresent:params.get('photoPresent'),photoMaxAgeHours:params.get('photoMaxAgeHours')});
}
export function privatePhotoDatabaseFilters(record={}){
 const values=privatePhotoFilterValues(record);
 return {...(values.photoPresent?{photo_present:true}:{}),
  ...(values.photoMaxAgeHours?{photo_max_age_hours:Number(values.photoMaxAgeHours)}:{})};
}
