// Search presentation only. Authentication and current record grants remain the
// authority for every private response. Never derive the public origin from Host.
export const PUBLIC_SITE_ORIGIN='https://loadgistic.com';
export const PUBLIC_SITEMAP_PATHS=Object.freeze(['/','/about','/featured','/privacy','/terms']);
const privatePaths=['app','admin','support','track','shared-capacity','login','apply','signup','join-fleet','workspaces','delete-account','help','brokerage','api'];

export function isPublicSearchEnvironment(environment=process.env){
 if(environment.NODE_ENV!=='production'||environment.VERCEL_ENV&&environment.VERCEL_ENV!=='production'
  ||environment.CONTEXT&&environment.CONTEXT!=='production')return false;
 try{
  const configured=new URL(String(environment.APP_URL||''));
  return configured.origin===PUBLIC_SITE_ORIGIN&&!configured.username&&!configured.password
   &&configured.pathname==='/'&&!configured.search&&!configured.hash;
 }catch{return false;}
}
export function searchRobots({privateView=false,filtered=false,environment=process.env}={}){
 const index=isPublicSearchEnvironment(environment)&&!privateView&&!filtered;
 return {index,follow:!privateView&&isPublicSearchEnvironment(environment),...(privateView||!isPublicSearchEnvironment(environment)?{nosnippet:true,noimageindex:true}:{})};
}
/** @returns {import('next').Metadata} */
export function publicPageMetadata({path,title,description,query={},privateView=false,environment=process.env}){
 const knownPath=PUBLIC_SITEMAP_PATHS.includes(path);
 const providerPath=/^\/@[a-z0-9][a-z0-9_-]{0,79}$/.test(path);
 if(!knownPath&&!providerPath)throw new Error('INVALID_PUBLIC_CANONICAL');
 const filtered=Object.keys(query).some(key=>query[key]!==undefined&&query[key]!==null&&query[key]!=='');
 const canonical=privateView?null:PUBLIC_SITE_ORIGIN+path;
 return {title,description,alternates:{canonical},robots:searchRobots({privateView,filtered,environment}),
  ...(canonical?{openGraph:{type:'website',siteName:'Loadgistic',title:typeof title==='string'?title:title.absolute,description,url:canonical,
   images:[{url:'/landing/capacity-map-wide.png',width:1440,height:1000,alt:'Loadgistic vehicle Capacity map'}]},
   twitter:{card:'summary_large_image',title:typeof title==='string'?title:title.absolute,description,images:['/landing/capacity-map-wide.png']}}:{})};
}
export function publicSitemap(environment=process.env){
 return isPublicSearchEnvironment(environment)?PUBLIC_SITEMAP_PATHS.map(path=>({url:PUBLIC_SITE_ORIGIN+path})):[];
}
export function publicRobots(environment=process.env){
 if(!isPublicSearchEnvironment(environment))return {rules:{userAgent:'*',disallow:'/'}};
 // Private HTML remains crawlable enough for noindex to be observed; its data
 // stays behind authentication. API crawling is unnecessary work, not privacy.
 return {rules:{userAgent:'*',allow:'/',disallow:'/api/'},sitemap:PUBLIC_SITE_ORIGIN+'/sitemap.xml'};
}
export function seoResponseHeaders(environment=process.env){
 const headers=[{key:'X-Robots-Tag',value:'noindex, nofollow, nosnippet, noimageindex'}];
 if(!isPublicSearchEnvironment(environment))return [{source:'/(.*)',headers}];
 return [...privatePaths.map(path=>({source:`/${path}/:path*`,headers})),
  {source:'/',has:[{type:'query',key:'view',value:'private'}],headers}];
}
