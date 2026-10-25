import test from 'node:test';
import assert from 'node:assert/strict';
import { nativePublicProvider,nativeFeatured,publicAsset,publicWebsite } from '../src/lib/mobile/public-contract.js';
test('native public profile exposes only explicitly public entity fields and preserves review scope',()=>{
 const secret={file_path:'private/proof',actor_id:'private-user',contact_private:'private-contact',lat:9.001,notes:'private-note'};
 const projected=nativePublicProvider({...secret,name:'Fleet',handle:'fleet',contact_phone:null,verification_badges:[{...secret,type:'IDENTITY',verified:true,expired:true,reviewedAt:'2026-01-01'}],trucks:[{...secret,platform_number:'LG-TRK-TEST',assigned_driver_first_name:'Driver',truck_verification_badges:[{...secret,type:'VEHICLE_AUTHORIZATION',verified:true}],capacity:{...secret,status:'PARTIAL',capacity_updated_label:'Updated today'}}],reviews:[{...secret,rating:4,note:'Good service',dispute_status:'OPEN'}],fleet_page:{page:2,pageCount:3,total:28}});
 for(const key of Object.keys(secret))assert.equal(JSON.stringify(projected).includes(key),false);
 assert.equal(projected.contacts.phone,'');assert.equal(projected.badges[0].reviewed,false);assert.equal(projected.badges[0].expired,true);assert.equal(projected.trucks[0].truckBadges[0].type,'VEHICLE_AUTHORIZATION');assert.equal(projected.reviews[0].disputed,true);assert.deepEqual(projected.fleet,{page:2,pages:3,total:28});assert.equal(nativePublicProvider(null),null);
});
test('native provider vehicle map actions select only their public capacity signals',()=>{
 const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';
 const profile=nativePublicProvider({handle:'fleet-one',trucks:[
  {platform_number:'One',capacity:{id:first,status:'EMPTY',vehicle_id:'private-vehicle-1'}},
  {platform_number:'Two',capacity:{id:second,status:'PARTIAL',vehicle_id:'private-vehicle-2'}},
  {platform_number:'Three',capacity:{id:'private-vehicle-3',status:'EMPTY'}},
  {platform_number:'Four',capacity:null}
 ]});
 assert.equal(profile.trucks[0].capacity.mapHref,`/?provider=fleet-one&truck=${first}`);
 assert.equal(profile.trucks[1].capacity.mapHref,`/?provider=fleet-one&truck=${second}`);
 assert.equal(profile.trucks[2].capacity.mapHref,'');
 assert.equal(profile.trucks[3].capacity,null);
 assert.equal(JSON.stringify(profile).includes('private-vehicle'),false);
 assert.equal(nativePublicProvider({handle:'fleet-one',trucks:[{capacity:{id:first,status:'FULL'}}]}).trucks[0].capacity.mapHref,'');
 assert.equal(nativePublicProvider({handle:'bad?handle',trucks:[{capacity:{id:first,status:'EMPTY'}}]}).trucks[0].capacity.mapHref,'');
 assert.equal(nativePublicProvider({trucks:[{capacity:{id:first,status:'EMPTY'}}]}).trucks[0].capacity.mapHref,'');
});
test('Featured preserves real schedule and TikTok Live state without database identifiers',()=>{
 const result=nativeFeatured({feature_date:'2026-10-05',published:true,tiktok_url:'https://www.tiktok.com/@loadgistic/live',tiktok_broadcast_status:'LIVE',broadcast_start_time:'08:30',providers:[{truck_key:'vehicle:private-id',driver_user_id:'private-user',name:'Fleet',handle:'fleet',driver_first_name:'Abebe',public_capacity_available:true}],schedule:{entries:[{type:'PROVIDER',provider_key:'vehicle:private-id',starts_at:'2026-10-05T05:30:00Z',ends_at:'2026-10-05T06:00:00Z'},{type:'PROGRAMME_BREAK',label:'Sponsor · Example'}]},sponsored_providers:[{sponsor_kind:'ADVERTISER',name:'Example',website_url:'javascript:alert(1)',phone:'+251900000000'}]});
 assert.equal(result.programme[0].slot,result.trucks[0].slot);assert.equal(result.programme[1].kind,'BREAK');assert.equal(result.sponsors[0].website,'');assert.equal(result.tiktokUrl,'https://www.tiktok.com/@loadgistic/live');assert.equal(result.tiktokStatus,'LIVE');assert.equal(result.start,'08:30');assert.equal(JSON.stringify(result).includes('private-'),false);assert.equal(nativeFeatured({published:false,providers:[]}).trucks.length,0);
});
test('public assets and contact destinations reject private paths and executable schemes',()=>{
 for(const value of ['//evil.test/a.jpg','/private/proof.jpg','/marketing/../private.jpg','https://evil.test/image','/api/mobile/files/a','/api/public/providers/fleet/image?token=private'])assert.equal(publicAsset(value),'');
 assert.equal(publicAsset('/api/public/providers/fleet/image?v=2026-10-05T00%3A00'),'/api/public/providers/fleet/image?v=2026-10-05T00%3A00');assert.equal(publicAsset('/vehicle-configurations/cargo-van.jpg'),'/vehicle-configurations/cargo-van.jpg');
 for(const value of ['javascript:alert(1)','file:///tmp/a','intent://app','https://user:pass@example.test'])assert.equal(publicWebsite(value),'');
 assert.equal(publicWebsite('https://example.test/'),'https://example.test/');
});
test('retired provider Services and Regular never reappear while truck regular exposes labels only',()=>{
 const projected=nativePublicProvider({services:'RETIRED-PRIVATE-SERVICE',regular_service:{geometry:'ROUTE',route_labels:['RETIRED-PROVIDER-ROUTE']},trucks:[{capacity:{status:'EMPTY',recurring_corridors:[{id:'private-route-id',driver_user_id:'private-driver',vehicle_id:'private-truck',geometry:'ROUTE',route_points:[{label:'City A',lat:9,lng:38},{label:'City B',lat:10,lng:39}]}]}}]});
 assert.equal(projected.services,'');assert.equal(projected.regular,null);assert.deepEqual(projected.trucks[0].regular,{kind:'ROUTE',places:['City A','City B']});
 for(const hidden of ['RETIRED-','private-route-id','private-driver','private-truck','"lat"','"lng"'])assert.equal(JSON.stringify(projected).includes(hidden),false);
});
