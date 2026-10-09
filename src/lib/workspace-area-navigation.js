// Presentation-only return targets. Never accept credential-bearing query keys,
// external URLs, administrative routes or arbitrary paths from browser storage.
const marketPaths=new Set(['/','/shared-capacity','/featured','/track','/about']);
const workspacePaths=/^\/app\/(?:home|fleet(?:\/[a-zA-Z0-9-]+)?|provider-shipments(?:\/[a-zA-Z0-9-]+)?|network|more|support(?:\/[a-zA-Z0-9-]+)?)$/;
const marketQuery=new Set(['q','status','loadType','vehicleCategory','vehicleConfigurations','provider','truck','truckCity','truckCityPlaceRef','truckCityRadiusKm','nearLat','nearLng','nearRadiusKm','origin','originPlaceRef','destination','destinationPlaceRef','routeToleranceKm','pickupDate','documents','verifiedDocuments','sharing','view','stopOption','freshness','directionMode','ownerDocs','driverDocs','truckDocs','truckLocationRadiusKm','originRadiusKm','destinationRadiusKm']);
const workspaceQuery=new Set(['page','driverPage','retiredPage','paymentPage','vehicleId','tab']);
export function areaReturnPath(value,area){
 if(!['marketplace','workspace'].includes(area)||typeof value!=='string'||value.length>2500||!value.startsWith('/')||value.startsWith('//')||/[\u0000-\u0020\u007f\\]/.test(value))return null;
 let url;try{url=new URL(value,'https://loadgistic.invalid');}catch{return null;}
 if(url.origin!=='https://loadgistic.invalid'||url.hash||!(area==='marketplace'?marketPaths.has(url.pathname):workspacePaths.test(url.pathname)))return null;
 const allowed=area==='marketplace'?marketQuery:workspaceQuery;
 // Reject a URL containing an unknown key rather than silently retaining only
 // its path: tracking/access tokens must never reach persistent presentation state.
 if([...url.searchParams].some(([key,item])=>!allowed.has(key)||item.length>500))return null;
 return url.pathname+url.search;
}
export function areaCamera(value){
 if(!value||typeof value!=='object'||typeof value.lat!=='number'||typeof value.lng!=='number'||typeof value.zoom!=='number'||!Number.isFinite(value.lat)||!Number.isFinite(value.lng)||!Number.isFinite(value.zoom)||Math.abs(value.lat)>85.1||Math.abs(value.lng)>180||value.zoom<2||value.zoom>15)return null;
 return {lat:value.lat,lng:value.lng,zoom:value.zoom};
}
