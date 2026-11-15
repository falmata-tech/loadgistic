const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve identity only. The caller must still run its normal authorized,
 * filtered projection; neither of these private rows may be serialized.
 */
export async function currentCapacityLinkFilters(client,filters){
 const id=filters.capacityId||filters.truck;
 if(typeof id!=='string'||!uuid.test(id))return filters;
 const source=await client.from('capacities').select('vehicle_id').eq('id',id).maybeSingle();
 if(source.error)throw new Error('CAPACITY_LINK_UNAVAILABLE');
 if(!source.data?.vehicle_id)return filters;
 const latest=await client.from('capacities').select('id').eq('vehicle_id',source.data.vehicle_id)
  .order('updated_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(latest.error)throw new Error('CAPACITY_LINK_UNAVAILABLE');
 return latest.data?{...filters,capacityId:latest.data.id}:filters;
}
