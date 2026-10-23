import crypto from 'node:crypto';

const source='loadgistic';
const adminKey='user-admin';
const localDomains=new Set(['loadgistic.local','providers.loadgistic.test']);
const reviewNote='Fictional local test evidence. No real ownership or operating authority is asserted.';
const preparedPlans=new WeakSet();
const verifiedFiles=new WeakMap();

// This adapter only prepares the named, disposable Loadgistic local dataset.
// It is not a legacy-data migration or a hosted authority backfill.
export function assertLocalAuthorityFixtureTarget(url,{nodeEnv=process.env.NODE_ENV}={}){
  if(nodeEnv==='production')throw new Error('PRODUCTION_FIXTURE_IMPORT_REFUSED');
  let endpoint;try{endpoint=new URL(url);}catch{throw new Error('LOCAL_AUTHORITY_FIXTURE_TARGET_INVALID');}
  if(!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname))throw new Error('REMOTE_FIXTURE_IMPORT_REFUSED');
  if(endpoint.protocol!=='http:'||endpoint.port!=='55321'||endpoint.username||endpoint.password
    ||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw new Error('LOCAL_AUTHORITY_FIXTURE_TARGET_INVALID');
  return endpoint.origin;
}

function unique(rows,key){
  const values=rows.map(row=>row[key]);
  if(values.some(value=>typeof value!=='string'||!value)||new Set(values).size!==values.length){
    throw new Error('LOCAL_AUTHORITY_FIXTURE_DUPLICATE_OR_MISSING_ID');
  }
  return new Map(rows.map(row=>[row[key],row]));
}

export function authorityFixtureStoragePath(requestId,vehicleId){
  const key=crypto.createHash('sha256').update(`${source}:${vehicleId}:${requestId}`).digest('hex');
  return `fixture-authority/${key}/fictional-ownership.pdf`;
}

export function prepareProviderAuthorityFixtures(document,manifest,{now=new Date().toISOString()}={}){
  if(document?.fixture_source!==source||document.schema_version!==1||manifest?.fixture_source!==source
    ||manifest.schema_version!==1||manifest.fixture_admin_id!==adminKey||!document.tables
    ||!Array.isArray(manifest.attestations)||!Array.isArray(manifest.live_vehicle_ids)){
    throw new Error('LOCAL_AUTHORITY_FIXTURE_MANIFEST_INVALID');
  }
  const tables=structuredClone(document.tables);
  const users=unique(tables.users||[],'id');
  for(const user of users.values()){
    const email=String(user.email||'').toLowerCase();
    if(!/^[^@\s]+@[^@\s]+$/.test(email)||!localDomains.has(email.split('@')[1]))throw new Error('LOCAL_AUTHORITY_FIXTURE_EMAIL_REFUSED');
  }
  const admin=users.get(adminKey);
  if(admin?.role!=='ADMIN'||Number(admin.active)!==1||admin.email!=='admin@loadgistic.local')throw new Error('LOCAL_AUTHORITY_FIXTURE_ADMIN_INVALID');
  const vehicles=unique(tables.vehicles||[],'id');
  const profiles=unique(tables.provider_profiles||[],'id');
  const requests=unique(tables.verification_requests||[],'id');
  const ownerByOrganization=new Map((tables.memberships||[]).filter(row=>row.membership_role==='OWNER').map(row=>[row.organization_id,row.user_id]));
  const ownerFor=vehicle=>vehicle.organization_id&&!vehicle.provider_profile_id?ownerByOrganization.get(vehicle.organization_id)
    :vehicle.provider_profile_id&&!vehicle.organization_id?profiles.get(vehicle.provider_profile_id)?.user_id:null;
  const liveIds=new Set(manifest.live_vehicle_ids);
  if(liveIds.size!==manifest.live_vehicle_ids.length||liveIds.size!==vehicles.size||[...vehicles.keys()].some(id=>!liveIds.has(id))){
    throw new Error('LOCAL_AUTHORITY_FIXTURE_VEHICLE_ALLOWLIST_MISMATCH');
  }
  const providerOwners=new Set([...vehicles.values()].map(ownerFor));
  if(providerOwners.has(undefined)||providerOwners.has(null))throw new Error('LOCAL_AUTHORITY_FIXTURE_OWNER_MISSING');
  if([...providerOwners].some(id=>!['DRIVER','TRANSPORTER'].includes(users.get(id)?.role)||Number(users.get(id)?.active)!==1)){
    throw new Error('LOCAL_AUTHORITY_FIXTURE_OWNER_INVALID');
  }
  const attestationOwners=new Set();
  const attestationRequests=new Set();
  for(const fact of manifest.attestations){
    const vehicle=vehicles.get(fact.vehicle_id);
    if(!vehicle||Number(vehicle.active)!==1||!users.has(fact.owner_user_id)||ownerFor(vehicle)!==fact.owner_user_id
      ||fact.fact_kind!=='OWNERSHIP'||!['EXISTING_OWNERSHIP','FICTIONAL_OWNERSHIP'].includes(fact.source_kind)
      ||typeof fact.source_request_id!=='string'||!fact.source_request_id||attestationOwners.has(fact.owner_user_id)
      ||attestationRequests.has(fact.source_request_id))throw new Error('LOCAL_AUTHORITY_FIXTURE_ATTESTATION_INVALID');
    attestationOwners.add(fact.owner_user_id);attestationRequests.add(fact.source_request_id);
    const existing=requests.get(fact.source_request_id);
    if(fact.source_kind==='EXISTING_OWNERSHIP'&&(!existing||existing.subject_type!=='VEHICLE'
      ||existing.subject_id!==vehicle.id||existing.verification_type!=='VEHICLE_OWNERSHIP'||existing.status!=='APPROVED'
      ||existing.submitted_by!==fact.owner_user_id||existing.reviewed_by!==adminKey))throw new Error('LOCAL_AUTHORITY_FIXTURE_SOURCE_MISMATCH');
    if(fact.source_kind==='FICTIONAL_OWNERSHIP'&&existing)throw new Error('LOCAL_AUTHORITY_FIXTURE_SOURCE_ALREADY_EXISTS');
    const request={...existing,id:fact.source_request_id,subject_type:'VEHICLE',subject_id:vehicle.id,
      related_vehicle_id:null,verification_type:'VEHICLE_OWNERSHIP',expires_on:null,
      document_name:'FICTIONAL local ownership test evidence',file_path:`supabase://verification/${authorityFixtureStoragePath(fact.source_request_id,vehicle.id)}`,
      original_name:'fictional-local-ownership.pdf',mime_type:'application/pdf',status:'APPROVED',
      submitted_by:fact.owner_user_id,reviewed_by:adminKey,review_note:reviewNote,
      submitted_at:existing?.submitted_at||now,reviewed_at:now};
    requests.set(request.id,request);
  }
  if(providerOwners.size!==attestationOwners.size||[...providerOwners].some(id=>!attestationOwners.has(id))){
    throw new Error('LOCAL_AUTHORITY_FIXTURE_PROVIDER_ALLOWLIST_MISMATCH');
  }
  const drivingOwners=new Set([...profiles.values()].map(profile=>profile.user_id));
  tables.users=tables.users.map(user=>({...user,drives_truck:drivingOwners.has(user.id)}));
  // The normal publication command moves only the explicitly listed fixture
  // trucks to LIVE after the files and exact relationship reviews exist.
  tables.vehicles=tables.vehicles.map(vehicle=>({...vehicle,publication_status:'DRAFT'}));
  tables.verification_requests=[...requests.values()];
  const plan={tables,adminId:adminKey,attestations:structuredClone(manifest.attestations),
    liveVehicles:manifest.live_vehicle_ids.map(id=>({vehicleId:id,ownerId:ownerFor(vehicles.get(id))}))};
  preparedPlans.add(plan);return plan;
}

export function fictionalOwnershipPdf({owner_user_id,vehicle_id}){
  const escape=value=>String(value).replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&');
  const lines=['FICTIONAL LOCAL TEST EVIDENCE','NOT LEGAL OWNERSHIP PROOF',
    `Synthetic provider: ${owner_user_id}`,`Synthetic truck: ${vehicle_id}`,
    'Only for disposable Loadgistic local workflow tests.'];
  const stream=`BT /F1 16 Tf 40 740 Td ${lines.map((line,index)=>`${index?'0 -28 Td ':''}(${escape(line)}) Tj`).join('\n')} ET\n`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];
  for(let index=0;index<objects.length;index++){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${objects[index]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function verifyClient(client,url){
  const expected=assertLocalAuthorityFixtureTarget(url);
  if(assertLocalAuthorityFixtureTarget(client.supabaseUrl)!==expected)throw new Error('LOCAL_AUTHORITY_FIXTURE_CLIENT_MISMATCH');
}
async function verifyAdmin(client,plan,mapUuid){
  if(!preparedPlans.has(plan))throw new Error('LOCAL_AUTHORITY_FIXTURE_MANIFEST_INVALID');
  const id=mapUuid(plan.adminId);
  const {data,error}=await client.auth.admin.getUserById(id);
  if(error||data?.user?.id!==id||data.user.app_metadata?.fixture_source!==source
    ||data.user.user_metadata?.fixture_key!==adminKey)throw new Error('LOCAL_AUTHORITY_FIXTURE_ADMIN_MISMATCH');
  const profile=await client.from('profiles').select('id,role,active').eq('id',id).maybeSingle();
  if(profile.error||profile.data?.id!==id||profile.data.role!=='ADMIN'||profile.data.active!==true)throw new Error('LOCAL_AUTHORITY_FIXTURE_ADMIN_MISMATCH');
  return id;
}

export async function uploadAuthorityFixtureDocuments(client,url,plan,mapUuid){
  verifyClient(client,url);await verifyAdmin(client,plan,mapUuid);
  for(const fact of plan.attestations){
    const storagePath=authorityFixtureStoragePath(fact.source_request_id,fact.vehicle_id);
    const bytes=fictionalOwnershipPdf(fact);
    const bucket=client.storage.from('verification');
    const upload=await bucket.upload(storagePath,bytes,{contentType:'application/pdf',upsert:true});
    if(upload.error)throw new Error('LOCAL_AUTHORITY_FIXTURE_FILE_UPLOAD_FAILED');
    const download=await bucket.download(storagePath);
    if(download.error||!download.data)throw new Error('LOCAL_AUTHORITY_FIXTURE_FILE_VERIFY_FAILED');
    const actual=Buffer.from(await download.data.arrayBuffer());
    if(!crypto.timingSafeEqual(crypto.createHash('sha256').update(bytes).digest(),crypto.createHash('sha256').update(actual).digest())){
      throw new Error('LOCAL_AUTHORITY_FIXTURE_FILE_VERIFY_FAILED');
    }
  }
  verifiedFiles.set(plan,client);
}

export async function confirmAuthorityFixtureReviews(client,url,plan,mapUuid){
  verifyClient(client,url);const actor=await verifyAdmin(client,plan,mapUuid);
  if(verifiedFiles.get(plan)!==client)throw new Error('LOCAL_AUTHORITY_FIXTURE_FILES_REQUIRED');
  for(const fact of plan.attestations){
    const requestId=mapUuid(fact.source_request_id),vehicleId=mapUuid(fact.vehicle_id);
    const context=await client.rpc('managed_provider_authority_review_context',{actor_user_id:actor,requested_request_ids:[requestId]});
    const row=context.data?.[0];const vehicle=plan.tables.vehicles.find(item=>item.id===fact.vehicle_id);
    if(context.error||context.data?.length!==1||row?.requestId!==requestId||row.vehicleId!==vehicleId
      ||row.providerId!==mapUuid(vehicle.organization_id||vehicle.provider_profile_id)
      ||row.providerKind!==(vehicle.organization_id?'ORGANIZATION':'PROVIDER_PROFILE')
      ||!row.supportedFacts?.includes('OWNERSHIP')||!/^[0-9a-f]{64}$/.test(row.contextRevision||''))throw new Error('LOCAL_AUTHORITY_FIXTURE_CONTEXT_MISMATCH');
    const review=await client.rpc('confirm_provider_vehicle_authority',{actor_user_id:actor,request_id:requestId,
      command:{fact_kind:'OWNERSHIP',holder_basis:null,expires_on:null,review_note:reviewNote,context_revision:row.contextRevision}});
    if(review.error||typeof review.data!=='string')throw new Error('LOCAL_AUTHORITY_FIXTURE_REVIEW_FAILED');
  }
  // Consent belongs to these synthetic existing-content cases only. Real and
  // freshly registered users retain the normal interactive consent workflow.
  for(const ownerId of new Set(plan.liveVehicles.map(vehicle=>vehicle.ownerId))){
    const accepted=await client.rpc('accept_content_policy',{actor_user_id:mapUuid(ownerId),policy_version:'2026-10-09'});
    if(accepted.error)throw new Error('LOCAL_AUTHORITY_FIXTURE_POLICY_FAILED');
  }
  for(const vehicle of plan.liveVehicles){
    const result=await client.rpc('set_provider_vehicle_publication',{actor_user_id:mapUuid(vehicle.ownerId),
      target_vehicle_id:mapUuid(vehicle.vehicleId),requested_state:'LIVE'});
    if(result.error||result.data?.vehicleId!==mapUuid(vehicle.vehicleId)||result.data?.state!=='LIVE')throw new Error('LOCAL_AUTHORITY_FIXTURE_PUBLICATION_FAILED');
  }
}
