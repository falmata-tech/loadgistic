// Catalog coordinates describe a selected city, never a device position.
export function mobileCatalogPlace(value) {
  const row=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const coordinate=typeof row.lng==='number'&&Number.isFinite(row.lng)&&Math.abs(row.lng)<=180
    &&typeof row.lat==='number'&&Number.isFinite(row.lat)&&Math.abs(row.lat)<=90?[row.lng,row.lat]:null;
  return {placeRef:typeof row.place_ref==='string'?row.place_ref:'',label:typeof row.label==='string'?row.label:'',coordinate};
}
