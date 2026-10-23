/** Attribution of the published position, never the requested future source. */
export function locationSourceKind(value){
  if(value==='TELEMATICS'||value==='GPS')return 'GPS';
  if(value==='DEVICE_OBSCURED'||value==='MOBILE')return 'MOBILE';
  if(value==='MANUAL_ADMIN'||value==='MANUAL')return 'MANUAL';
  return null;
}
export function locationSourceLabel(value){
  return {GPS:'GPS device',MOBILE:'Driver’s phone',MANUAL:'Manually entered'}[locationSourceKind(value)]||'';
}
export function locationSourceColor(value){
  return {GPS:'#7257c8',MOBILE:'#1976ed',MANUAL:'#925212'}[locationSourceKind(value)]||'#526875';
}
// Only static paths are emitted. No submitted field enters this markup.
export function locationSourceSvg(value){
  const kind=locationSourceKind(value);
  if(!kind)return '';
  const paths={
    GPS:'<path d="m5 3 4 4-3 3-4-4zM15 14l4 4-3 3-4-4zM8 9l7 7M13 4a7 7 0 0 1 7 7M13 8a3 3 0 0 1 3 3"/>',
    MOBILE:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    MANUAL:'<path d="m15 4 5 5-11 11-6 1 1-6zM12 7l5 5"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}
