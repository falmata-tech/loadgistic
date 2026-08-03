import { hashTrackingAccessCode, trackingAccessCode } from '../../src/lib/security.js';

const SCENARIOS=Object.freeze([
  {id:'shp-scenario-assigned',code:'LGX-T3001',title:'Coffee cartons ready for loading',status:'ASSIGNED',origin:'Addis Ababa',destination:'Adama',vehicleId:'veh-trans-1',driverId:'user-company-driver',providerOrganizationId:'org-transporter',providerProfileId:null,ownerId:'org-shipper',shipperId:'org-shipper',receiverId:'org-receiver',loadType:'FTL',trackingMode:'STATUS_ONLY'},
  {id:'shp-scenario-transit',code:'LGX-T3002',title:'Furniture moving to Hawassa',status:'IN_TRANSIT',origin:'Addis Ababa',destination:'Hawassa',vehicleId:'veh-trans-1',driverId:'user-company-driver',providerOrganizationId:'org-transporter',providerProfileId:null,ownerId:'org-shipper',shipperId:'org-shipper',receiverId:'org-receiver',loadType:'PTL',trackingMode:'LOCATION_AND_STATUS'},
  {id:'shp-scenario-issue',code:'LGX-T3003',title:'Grain shipment with a delay',status:'ISSUE',origin:'Adama',destination:'Shashamane',vehicleId:'veh-trans-2',driverId:'user-company-driver-2',providerOrganizationId:'org-transporter',providerProfileId:null,ownerId:'org-receiver',shipperId:'org-receiver',receiverId:'org-shipper',loadType:'FTL',trackingMode:'LOCATION_AND_STATUS'},
  {id:'shp-scenario-unloading',code:'LGX-T3004',title:'Artisan goods unloading in Bishoftu',status:'DELIVERED',origin:'Addis Ababa',destination:'Bishoftu',vehicleId:'veh-driver-1',driverId:'user-driver',providerOrganizationId:null,providerProfileId:'provider-driver',ownerId:'org-shipper',shipperId:'org-shipper',receiverId:'org-receiver',loadType:'PTL',trackingMode:'STATUS_ONLY'},
  {id:'shp-scenario-completed',code:'LGX-T3005',title:'Farm inputs delivered to Dire Dawa',status:'COMPLETED',origin:'Addis Ababa',destination:'Dire Dawa',vehicleId:'veh-trans-2',driverId:'user-company-driver-2',providerOrganizationId:'org-transporter',providerProfileId:null,ownerId:'org-receiver',shipperId:'org-receiver',receiverId:'org-shipper',loadType:'FTL',trackingMode:'STATUS_ONLY'}
]);

const HISTORY=Object.freeze({
  ASSIGNED:['SENT','AGREED','ASSIGNED'],
  IN_TRANSIT:['SENT','AGREED','ASSIGNED','IN_TRANSIT'],
  ISSUE:['SENT','AGREED','ASSIGNED','IN_TRANSIT','ISSUE'],
  DELIVERED:['SENT','AGREED','ASSIGNED','IN_TRANSIT','DELIVERED'],
  COMPLETED:['SENT','AGREED','ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED']
});

const PLACE=Object.freeze({
  'Addis Ababa':{ref:'builtin:addis ababa',lat:9.03,lng:38.74},
  Adama:{ref:'builtin:adama',lat:8.54,lng:39.27},
  Hawassa:{ref:'builtin:hawassa',lat:7.06,lng:38.48},
  Shashamane:{ref:'builtin:shashamane',lat:7.20,lng:38.60},
  Bishoftu:{ref:'builtin:bishoftu',lat:8.75,lng:38.99},
  'Dire Dawa':{ref:'builtin:dire dawa',lat:9.60,lng:41.87}
});

function dateOffset(days){
  const value=new Date();
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

export function addTrackingScenarios(db){
  const required=['user-shipper','user-receiver','user-transporter','user-company-driver','user-company-driver-2','user-driver'];
  const found=db.prepare(`SELECT id FROM users WHERE id IN (${required.map(()=>'?').join(',')})`).all(...required);
  if(found.length!==required.length)throw new Error('Documented demo accounts are missing. Run npm run db:reset before adding tracking scenarios.');

  const insertShipment=db.prepare(`INSERT INTO shipments (
    id,code,title,service_mode,distribution_mode,price_mode,shipper_organization_id,receiver_organization_id,
    provider_organization_id,provider_profile_id,load_owner_organization_id,load_owner_party_role,
    origin,destination,origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,
    cargo_description,package_count,vehicle_category,load_type,receiver_first_name,receiver_phone,pickup_date,delivery_date,
    commercial_status,operational_status,tracking_mode,tracking_code_hash,assigned_vehicle_id,assigned_driver_user_id,
    created_by,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertEvent=db.prepare(`INSERT INTO shipment_events
    (id,shipment_id,status,event_type,note,created_by,public,created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  const insertLocation=db.prepare(`INSERT INTO shipment_events
    (id,shipment_id,status,event_type,note,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,public,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now=Date.now();
  let added=0;
  let skipped=0;

  db.exec('BEGIN IMMEDIATE');
  try{
    for(const scenario of SCENARIOS){
      if(db.prepare('SELECT 1 FROM shipments WHERE id=? OR code=?').get(scenario.id,scenario.code)){skipped+=1;continue;}
      const origin=PLACE[scenario.origin];
      const destination=PLACE[scenario.destination];
      const createdAt=new Date(now-8*60*60*1000).toISOString();
      insertShipment.run(
        scenario.id,scenario.code,scenario.title,'FREIGHT','DIRECT_TO_PROVIDER','QUOTE_REQUESTED',scenario.shipperId,scenario.receiverId,
        scenario.providerOrganizationId,scenario.providerProfileId,scenario.ownerId,'SHIPPER',
        `${scenario.origin}, Ethiopia`,`${scenario.destination}, Ethiopia`,origin.ref,origin.lat,origin.lng,destination.ref,destination.lat,destination.lng,
        'Deterministic cross-user tracking scenario',24,scenario.loadType==='FTL'?'Medium Box Truck':'Light Box Truck',scenario.loadType,'Marta','+251 911 222 222',dateOffset(1),dateOffset(2),
        'AGREED',scenario.status,scenario.trackingMode,hashTrackingAccessCode(trackingAccessCode(scenario.id)),scenario.vehicleId,scenario.driverId,
        scenario.ownerId==='org-shipper'?'user-shipper':'user-receiver',createdAt,new Date(now-5*60*1000).toISOString()
      );
      const history=HISTORY[scenario.status];
      history.forEach((status,index)=>insertEvent.run(
        `${scenario.id}-event-${index+1}`,scenario.id,status,status==='SENT'?'CREATED':'STATUS',
        status==='SENT'?'Direct shipment created':status.replaceAll('_',' ').toLowerCase(),
        index===0?(scenario.ownerId==='org-shipper'?'user-shipper':'user-receiver'):scenario.driverId,1,
        new Date(now-(history.length-index)*55*60*1000).toISOString()
      ));
      if(scenario.trackingMode==='LOCATION_AND_STATUS')insertLocation.run(
        `${scenario.id}-location`,scenario.id,scenario.status,'LOCATION','Automatic device area',
        `Around ${scenario.origin}, Ethiopia`,origin.lat,origin.lng,scenario.loadType==='FTL'?20:40,'DEVICE_OBSCURED',scenario.driverId,1,
        new Date(now-20*60*1000).toISOString()
      );
      added+=1;
    }
    db.exec('COMMIT');
  }catch(error){
    db.exec('ROLLBACK');
    throw error;
  }
  return {added,skipped,total:SCENARIOS.length,codes:SCENARIOS.map(item=>item.code)};
}
