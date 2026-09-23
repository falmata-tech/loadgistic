import {z} from 'zod';

export function publicFleetPage(value){
  const raw=String(value??'1');
  if(!/^[1-9]\d{0,9}$/.test(raw))return 1;
  const number=Number(raw);return number<=2147483647?number:1;
}

const document=z.object({verification_type:z.string(),reviewed_at:z.string().nullable(),expires_on:z.string().nullable(),related_vehicle_id:z.string().uuid().nullable()});
const fleetPage=z.object({
  items:z.array(z.object({id:z.string().uuid(),platform_number:z.string(),make:z.string().nullable(),model:z.string().nullable(),category:z.string(),cargo_configuration:z.string().nullable()})).max(12),
  total:z.number().int().nonnegative(),page:z.number().int().positive(),page_size:z.literal(12),page_count:z.number().int().positive(),
  owner_operator:z.boolean(),evidence:z.object({vehicle_id:z.string().uuid(),platform_number:z.string(),document:document.nullable()}).nullable()
});
export async function loadPublicProviderFleet(client,scope,page){
  const {data,error}=await client.rpc('public_provider_fleet_page',{
    requested_organization_id:scope.kind==='ORGANIZATION'?scope.id:null,
    requested_provider_profile_id:scope.kind==='PROVIDER_PROFILE'?scope.id:null,
    requested_page:publicFleetPage(page)
  });
  if(error)throw new Error('SUPABASE_PUBLIC_PROVIDER_FLEET_FAILED',{cause:error});
  return data===null?null:fleetPage.parse(data);
}

// Internal scope only; callers cannot turn an empty/malformed page into a broad query.
export function publicFleetVehicleIds(values){
  return z.array(z.string().uuid()).max(12).parse(values);
}

/** Regular service is provider information, independent of its current fleet page.
 * Public presentation needs place labels only, never raw private record fields. */
export function publicProviderRegularService(record){
  if(!record)return null;
  const labels=points=>Array.isArray(points)?points.slice(0,5).map(point=>String(point?.label||'')).filter(Boolean):[];
  const route=labels(record.route_points_json);
  return {geometry:record.geometry==='RADIUS'?'RADIUS':'ROUTE',
    route_labels:route.length>=2?route:[record.origin,record.destination].filter(Boolean).map(String),
    area_center_label:String(record.area_center_label||''),area_labels:labels(record.area_boundary_json)};
}
