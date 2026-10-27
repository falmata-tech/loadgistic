import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {test,expect as baseExpect} from './browser-test';
import {auditFleetProvider,auditDeleteVehicles,checked,localAuditService} from './audit-helpers';
import {loadFeaturedTruckCandidates} from '../../src/lib/featured-truck-candidates.js';
import {FEATURED_PROVIDER_DAY} from '../../src/lib/featured-trucks.js';

test.use({trace:'off',screenshot:'off',video:'off',actionTimeout:20_000,navigationTimeout:30_000});
const expect=baseExpect.configure({timeout:30_000}),preview='http://localhost:8084';

test('an organization owner who drives qualifies without an employee row and appears truthfully on the native public profile',async({browser},info)=>{
 test.setTimeout(120_000);
 const service=localAuditService(),nonce=randomUUID().slice(0,8),date='2026-10-12',name=`Synthetic featured fleet ${nonce}`,plate=`FEATURED-${nonce}`;
 let apiStatus:number|null=null,apiCode='',publicChecks:Record<string,boolean|number|null>={};
 let owner:Awaited<ReturnType<typeof auditFleetProvider>>|null=null,truckId='',stage='SETUP',cleanupStage='NOT_STARTED',completed=false,cleaned=false,workflowFailed=false,cleanupFailed=false;
 const evidence=()=>{writeFileSync(info.outputPath('provider-featured-driving-owner-checks.json'),JSON.stringify({stage,completed,cleaned,workflowFailed,cleanupFailed,cleanupStage,baselineDemoModified:false,savedRosterModified:false,apiStatus,apiCode,publicChecks},null,2),{mode:0o600});writeFileSync(info.outputPath('provider-featured-driving-owner-owned.json'),JSON.stringify({ownerId:owner?.id||'',organizationId:owner?.organization_id||'',truckId},null,2),{mode:0o600});};
 const checkpoint=(value:string)=>{stage=value;evidence();};
 const context=await browser.newContext({baseURL:preview,viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.251'}});context.setDefaultTimeout(20_000);context.setDefaultNavigationTimeout(30_000);const page=await context.newPage();
 try{
  owner=await auditFleetProvider(service,'featured-driving-owner');evidence();const city=checked(await service.from('place_catalog').select('id,name').eq('normalized_name','addis ababa').order('population',{ascending:false}).limit(1).single());
  checked(await service.from('profiles').update({first_name:'Aster',last_name:'PrivateFatherFeatured',full_name:'Aster PrivateFatherFeatured',phone:'+251900000067',public_callback_phone:'+251900000066',public_callback_phone_configured:true}).eq('id',owner.id));checked(await service.rpc('set_provider_driving_mode',{actor_user_id:owner.id,requested_drives_truck:true}));
  checked(await service.from('organizations').update({name,city:city.name,city_place_ref:city.id,public_visibility:'PUBLIC'}).eq('id',owner.organization_id));checked(await service.from('company_pages').update({published:true,base_region_code:'ADDIS_ABABA',contact_phone:'+251900000066',show_contact_phone:true}).eq('organization_id',owner.organization_id));
  checkpoint('FIRST_UNREVIEWED_LIVE');truckId=checked(await service.rpc('create_provider_vehicle',{actor_user_id:owner.id,command:{use_basis:'OWNED',make:'Isuzu',model:'Featured owner',plate,cargo_configuration:'Mini Box Truck'}})).id;evidence();checked(await service.rpc('set_provider_vehicle_publication',{actor_user_id:owner.id,target_vehicle_id:truckId,requested_state:'LIVE'}));
  checkpoint('EXPLICIT_OWNER_ASSIGNMENT');checked(await service.rpc('update_fleet_driver_access',{actor_user_id:owner.id,command:{driver_user_id:owner.id,vehicle_id:truckId,can_manage_capacity:true,can_manage_tracking:true}}));expect(checked(await service.from('drivers').select('id').eq('user_id',owner.id))).toHaveLength(0);expect(checked(await service.from('verification_requests').select('id').eq('submitted_by',owner.id))).toHaveLength(0);
  checkpoint('ACTUAL_FEATURED_ELIGIBILITY');const projected=checked(await service.rpc('public_featured_provider_candidates',{requested_region_codes:['ADDIS_ABABA']})) as Array<{provider_organization_id:string;eligible:boolean;handle:string;name:string}>;const candidates=projected.filter(candidate=>candidate.provider_organization_id===owner!.organization_id);expect(candidates).toHaveLength(1);const candidate=candidates[0];expect(candidate.eligible).toBe(true);expect(FEATURED_PROVIDER_DAY.configurations).toContain('Mini Box Truck');
  const rows=await loadFeaturedTruckCandidates(service,date,[candidate]);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({vehicle_id:truckId,driver_user_id:owner.id,driver_first_name:'Aster',driver_kind_label:'Driver',eligible:true});
  checkpoint('ANONYMOUS_NATIVE_PROFILE');const response=await context.request.get(`http://127.0.0.1:3100/api/mobile/public/providers/${encodeURIComponent(candidate.handle)}`);apiStatus=response.status();evidence();expect(apiStatus).toBe(200);const profile=await response.json();apiCode=typeof profile.code==='string'&&/^[A-Z_]{3,100}$/.test(profile.code)?profile.code:'';publicChecks={truckCount:Array.isArray(profile.trucks)?profile.trucks.length:null,driverMatches:profile.trucks?.[0]?.driver==='Aster',labelMatches:profile.trucks?.[0]?.driverKind==='Driver',ownershipReviewed:profile.trucks?.[0]?.authority?.ownership?.verified===true,summaryValid:Boolean(profile.authoritySummary),privateNameAbsent:!JSON.stringify(profile).includes('PrivateFatherFeatured'),privatePhoneAbsent:!JSON.stringify(profile).includes('+251900000067')};evidence();expect(profile.trucks).toHaveLength(1);expect(profile.trucks[0].driver).toBe('Aster');expect(profile.trucks[0].driverKind).toBe('Driver');expect(profile.trucks[0].authority.ownership.verified).toBe(false);expect(profile.authoritySummary).toMatchObject({total:1,ownershipVerified:0,operatingLicenceVerified:0,permissionVerified:0,notYetVerified:1});expect(JSON.stringify(profile)).not.toContain('PrivateFatherFeatured');expect(JSON.stringify(profile)).not.toContain('+251900000067');
  await page.goto(`/transporter?handle=${encodeURIComponent(candidate.handle)}`,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.getByText('Aster · Driver',{exact:true})).toBeVisible();
  await expect(page.getByText('Vehicle documents',{exact:true})).toBeVisible();
  for(const name of ['Ownership','Permission','Operating licence'])await expect(page.getByRole('button',{name:`${name} · Not verified`,exact:true})).toBeVisible();
  await page.getByText('Aster · Driver',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('native-public-featured-owner-driver.png')});completed=true;checkpoint('COMPLETE');
 }catch(error){workflowFailed=true;evidence();throw error;
 }finally{
  try{
   cleanupStage='VERIFY_SYNTHETIC_SCOPE';
   if(owner){expect(checked(await service.auth.admin.getUserById(owner.id)).user.email).toBe(owner.email);expect(owner.email).toMatch(/^featured-driving-owner-[a-f0-9]{8}@loadgistic\.local$/);expect(checked(await service.from('organization_members').select('user_id').eq('organization_id',owner.organization_id))).toEqual([{user_id:owner.id}]);
    expect(checked(await service.from('verification_requests').select('id').eq('submitted_by',owner.id))).toHaveLength(0);expect(checked(await service.from('drivers').select('id').eq('organization_id',owner.organization_id))).toHaveLength(0);expect(checked(await service.from('provider_shipments').select('id').eq('provider_organization_id',owner.organization_id).limit(1))).toHaveLength(0);expect(checked(await service.from('shipments').select('id').eq('provider_organization_id',owner.organization_id).limit(1))).toHaveLength(0);expect(checked(await service.from('support_conversations').select('id').eq('customer_user_id',owner.id).limit(1))).toHaveLength(0);
    const trucks=checked(await service.from('vehicles').select('id,plate').eq('organization_id',owner.organization_id)) as Array<{id:string;plate:string}>;expect(trucks.length).toBeLessThanOrEqual(1);for(const truck of trucks){expect(truck.plate).toBe(plate);if(truckId)expect(truck.id).toBe(truckId);truckId=truck.id;}evidence();
    cleanupStage='DELETE_OWNED_TRUCK';if(truckId)checked(await service.from('driver_vehicle_assignments').delete().eq('vehicle_id',truckId).eq('driver_user_id',owner.id));checked(await service.from('capacities').delete().eq('provider_organization_id',owner.organization_id));checked(await auditDeleteVehicles(service,'organization_id',owner.organization_id));
    cleanupStage='DELETE_OWNED_AUDIT';checked(await service.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await service.from('audit_logs').delete().eq('organization_id',owner.organization_id));checked(await service.from('audit_logs').delete().in('entity_id',[owner.id,owner.organization_id,truckId].filter(Boolean)));
    cleanupStage='DELETE_OWNED_ORGANIZATION';checked(await service.from('company_pages').delete().eq('organization_id',owner.organization_id));checked(await service.from('organization_members').delete().eq('organization_id',owner.organization_id).eq('user_id',owner.id));checked(await service.from('organizations').delete().eq('id',owner.organization_id));checked(await service.from('provider_signup_intents').delete().eq('auth_user_id',owner.id));
    cleanupStage='DELETE_OWNED_AUTH';checked(await service.auth.admin.deleteUser(owner.id));cleanupStage='CONFIRM_EMPTY';expect(checked(await service.from('profiles').select('id').eq('id',owner.id))).toHaveLength(0);expect(checked(await service.from('organizations').select('id').eq('id',owner.organization_id))).toHaveLength(0);if(truckId)expect(checked(await service.from('vehicles').select('id').eq('id',truckId))).toHaveLength(0);
   }
   cleaned=true;cleanupStage='COMPLETE';
  }catch(error){cleanupFailed=true;if(!workflowFailed)throw error;
  }finally{evidence();await context.close();}
 }
});
