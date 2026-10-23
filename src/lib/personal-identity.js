// Historical names are never split into inferred private last/father names.
export function normalizePersonalName(value){
  return typeof value==='string'?value.replace(/[\p{White_Space}\uFEFF]+/gu,' ').trim():'';
}
export function historicalPublicFirstName(value){
  return normalizePersonalName(value).split(' ')[0]||'';
}
