type Translate = (message:string,values?:Record<string,string|number>)=>string;
// The database generates this prefix from the nearest place to the obscured fix.
// Translate its application wording; preserve the catalog city label itself.
export function locationAreaLabel(area:string,t:Translate) {
 const place=area.match(/^Around (.+)$/)?.[1];
 return place?t('Around {place}',{place}):area;
}
