// Disposable browser fixtures only. Validate the complete plan before deleting
// any private object; a failed check leaves shipment/event rows for diagnosis.
export function fixtureProofPaths({actor,vehicleId,shipment,events,references}){
  if(!actor?.id||!actor.provider_profile_id||!/@loadgistic\.local$/.test(actor.email||'')
    ||!shipment?.id||shipment.created_by!==actor.id||shipment.provider_profile_id!==actor.provider_profile_id
    ||shipment.provider_organization_id!==null||shipment.assigned_vehicle_id!==vehicleId
    ||shipment.assigned_driver_user_id!==actor.id)throw Error('PROOF_CLEANUP_FIXTURE_SCOPE_REQUIRED');
  const ids=new Set(),paths=new Set();
  for(const event of events){
    if(!event.id||ids.has(event.id)||event.shipment_id!==shipment.id||event.created_by!==actor.id
      ||!['LOADING','UNLOADING'].includes(event.status)||event.proof_mime_type!=='image/png'
      ||!/^supabase:\/\/shipment-proof\/tracking-proof\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/.test(event.proof_storage_path||'')
      ||paths.has(event.proof_storage_path))throw Error('PROOF_CLEANUP_EVENT_SCOPE_REQUIRED');
    ids.add(event.id);paths.add(event.proof_storage_path);
  }
  if(references.length!==events.length||references.some(row=>!ids.has(row.id)||row.shipment_id!==shipment.id
    ||!paths.has(row.proof_storage_path)))throw Error('PROOF_CLEANUP_SHARED_REFERENCE');
  return [...paths].map(reference=>reference.slice('supabase://shipment-proof/'.length));
}

export async function cleanupFixtureProofs(service,{actor,vehicleId,shipmentId}){
  const endpoint=new URL(service.supabaseUrl);
  if(!['127.0.0.1','localhost'].includes(endpoint.hostname)||endpoint.port!=='55321')throw Error('LOCAL_LOADGISTIC_REQUIRED');
  async function checked(query){const result=await query;if(result.error)throw Error('PROOF_CLEANUP_READ_FAILED');return result.data;}
  const shipment=await checked(service.from('provider_shipments')
    .select('id,created_by,provider_profile_id,provider_organization_id,assigned_vehicle_id,assigned_driver_user_id').eq('id',shipmentId).single());
  const events=await checked(service.from('provider_shipment_events')
    .select('id,shipment_id,created_by,status,proof_storage_path,proof_mime_type').eq('shipment_id',shipmentId).not('proof_storage_path','is',null));
  const references=events.length?await checked(service.from('provider_shipment_events')
    .select('id,shipment_id,proof_storage_path').in('proof_storage_path',events.map(event=>event.proof_storage_path))):[];
  const paths=fixtureProofPaths({actor,vehicleId,shipment,events,references});
  if(paths.length){const result=await service.storage.from('shipment-proof').remove(paths);if(result.error)throw Error('PROOF_CLEANUP_REMOVE_FAILED');}
  return paths.length;
}
