import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_PROVIDER_PROFILE_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_PROVIDER_PROFILE_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
process.env.PRIVATE_STORAGE_BACKEND='supabase';
process.env.UPLOAD_SCANNER_BACKEND='local';
process.env.NODE_ENV='development';

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const profilePort=await import('../src/lib/provider-profile/supabase.js');
const {readPrivateUpload}=await import('../src/lib/private-storage.js');

const {data:pages,error:pagesError}=await service.from('company_pages')
  .select('id,organization_id,provider_profile_id').is('profile_image_path',null).limit(50);
if(pagesError)throw new Error('SUPABASE_PROVIDER_PROFILE_PAGE_LOOKUP_FAILED');
let actorId=null;
for(const page of pages||[]){
  if(page.organization_id){
    const {data:member}=await service.from('organization_members').select('user_id')
      .eq('organization_id',page.organization_id).eq('membership_role','OWNER').limit(1).maybeSingle();
    if(member?.user_id){actorId=member.user_id;break;}
  }else if(page.provider_profile_id){
    const {data:provider}=await service.from('provider_profiles').select('user_id')
      .eq('id',page.provider_profile_id).maybeSingle();
    if(provider?.user_id){actorId=provider.user_id;break;}
  }
}
if(!actorId)throw new Error('SUPABASE_PROVIDER_PROFILE_ACTOR_NOT_FOUND');
const actor={id:actorId};
const original=await profilePort.getSupabaseOwnCompanyPage(actor);
if(!original?.id||!original.city_place_ref||!original.base_region_code)throw new Error('SUPABASE_PROVIDER_PROFILE_WORKSPACE_INVALID');

await profilePort.updateSupabaseCompanyPage(actor,{
  headline:original.headline||'',about:original.about||'',services:original.services||'',
  basePlaceRef:original.city_place_ref,baseRegionCode:original.base_region_code,
  contactPhone:original.contact_phone||'',contactWhatsapp:original.contact_whatsapp||'',
  contactEmail:original.contact_email||'',contactWebsite:original.contact_website||'',
  showContactPhone:Boolean(original.show_contact_phone),showContactWhatsapp:Boolean(original.show_contact_whatsapp),
  showContactEmail:Boolean(original.show_contact_email),showContactWebsite:Boolean(original.show_contact_website),
  published:Boolean(original.published)
});

const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);
const upload={name:'provider.png',type:'image/png',size:png.length,
  arrayBuffer:async()=>png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength)};
await profilePort.updateSupabaseProviderProfileImage(actor,upload);
const withImage=await profilePort.getSupabaseOwnCompanyPage(actor);
if(!withImage.profile_image_is_custom||!String(withImage.profile_image_url).startsWith('/api/public/providers/')){
  throw new Error('SUPABASE_PROVIDER_PROFILE_IMAGE_PROJECTION_FAILED');
}
const removed=await profilePort.removeSupabaseProviderProfileImage(actor);
if(!removed?.previous_reference)throw new Error('SUPABASE_PROVIDER_PROFILE_IMAGE_REMOVE_FAILED');
if(await readPrivateUpload(removed.previous_reference))throw new Error('SUPABASE_PROVIDER_PROFILE_IMAGE_OBJECT_RETAINED');

const {data:drivers,error:driversError}=await service.from('profiles').select('id').eq('role','DRIVER').limit(50);
if(driversError)throw new Error('SUPABASE_PROVIDER_PROFILE_DRIVER_LOOKUP_FAILED');
let companyDriverId=null;
for(const driver of drivers||[]){
  const {data:membership}=await service.from('organization_members').select('id').eq('user_id',driver.id).limit(1).maybeSingle();
  if(membership?.id){companyDriverId=driver.id;break;}
}
if(!companyDriverId)throw new Error('SUPABASE_PROVIDER_PROFILE_COMPANY_DRIVER_NOT_FOUND');
const {error:driverError}=await service.rpc('provider_profile_workspace',{actor_user_id:companyDriverId});
if(!driverError||!String(driverError.message).includes('FORBIDDEN'))throw new Error('SUPABASE_PROVIDER_PROFILE_DRIVER_ALLOWED');
const {error:anonymousError}=await anon.rpc('provider_profile_workspace',{actor_user_id:actorId});
if(!anonymousError)throw new Error('SUPABASE_PROVIDER_PROFILE_ANONYMOUS_RPC_ALLOWED');

const {data:audit,error:auditError}=await service.from('audit_logs').select('details')
  .eq('action','COMPANY_PAGE_UPDATED').eq('actor_user_id',actorId).order('created_at',{ascending:false}).limit(1).maybeSingle();
if(auditError||!audit)throw new Error('SUPABASE_PROVIDER_PROFILE_AUDIT_MISSING');
const auditText=JSON.stringify(audit.details||{});
for(const privateValue of [original.contact_phone,original.contact_whatsapp,original.contact_email,original.contact_website]){
  if(privateValue&&auditText.includes(privateValue))throw new Error('SUPABASE_PROVIDER_PROFILE_AUDIT_CONTACT_LEAK');
}

process.stdout.write('Supabase provider-profile ownership, update, image lifecycle, audit privacy, and browser-denial checks passed.\n');
