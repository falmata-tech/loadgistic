// Keep redirects inside Fleet and retain only known UI state, never arbitrary URLs.
export function fleetReturnPath(value,fallback='/app/fleet'){
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return fallback;
  const url=new URL(value,'https://fleet.invalid');
  if(!/^\/app\/fleet(?:\/[a-f0-9-]{36})?$/.test(url.pathname))return fallback;
  const params=new URLSearchParams();
  for(const key of ['truckPage','driverPage'])if(/^[1-9][0-9]{0,4}$/.test(url.searchParams.get(key)||''))params.set(key,url.searchParams.get(key));
  for(const key of ['vehicle','driver'])if(/^[a-f0-9-]{36}$/.test(url.searchParams.get(key)||''))params.set(key,url.searchParams.get(key));
  return url.pathname+(params.size?`?${params}`:'')+(url.hash==='#driver-access'?'#driver-access':'');
}
