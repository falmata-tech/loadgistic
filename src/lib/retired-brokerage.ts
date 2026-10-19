import {NextResponse} from 'next/server.js';
export function retiredBrokerageResponse(){
 const response=NextResponse.json({ok:false,error:{code:'PLATFORM_BROKERAGE_RETIRED',message:'This service is no longer available.'}},
  {status:410,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 response.cookies.set('lg_transport_chat','',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
 return response;
}
export function retiredPlatformCapacityResponse(){
 return NextResponse.json({ok:false,error:{code:'PLATFORM_CAPACITY_RETIRED',message:'This capacity feed is no longer available.'}},
  {status:410,headers:{'Cache-Control':'private, no-store'}});
}
