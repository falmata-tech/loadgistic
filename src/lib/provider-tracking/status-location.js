// Status forms omit location fields unless the assigned Driver has captured a fix.
// A partial location still reaches the database so its authorization and
// coordinate checks reject it instead of silently treating it as no location.
export function statusLocationOrNull(input){
  if(!input)return null;
  return Object.values(input).some(value=>String(value??'').trim()!=='')?input:null;
}
