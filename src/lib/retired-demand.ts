import { NextResponse } from 'next/server.js';

export function retiredDemandResponse(){
  return NextResponse.json({
    ok:false,
    error:{
      code:'DEMAND_WORKFLOW_RETIRED',
      message:'Shipment demand posting is no longer available.'
    }
  },{
    status:410,
    headers:{'Cache-Control':'no-store'}
  });
}
