import test from 'node:test';
import assert from 'node:assert/strict';
import { nativePublicProvider,nativeFeatured,publicAsset,publicWebsite } from '../src/lib/mobile/public-contract.js';
test('native public profile exposes only explicitly public entity fields and preserves review scope',()=>{
 const secret={file_path:'private/proof',actor_id:'private-user',contact_private:'private-contact',lat:9.001,notes:'private-note'};
 const projected=nativePublicProvider({...secret,name:'Fleet',handle:'fleet',contact_phone:null,verification_badges:[{...secret,type:'IDENTITY',verified:true,expired:true,reviewedAt:'2026-01-01'}],trucks:[{...secret,platform_number:'LG-TRK-TEST',assigned_driver_first_name:'Driver',truck_verification_badges:[{...secret,type:'VEHICLE_AUTHORIZATION',verified:true}],capacity:{...secret,status:'PARTIAL',capacity_updated_label:'Updated today'}}],reviews:[{...secret,rating:4,note:'Good service',dispute_status:'OPEN'}],fleet_page:{page:2,pageCount:3,total:28}});
 for(const key of Object.keys(secret))assert.equal(JSON.stringify(projected).includes(key),false);
 assert.equal(projected.contacts.phone,'');assert.equal(projected.badges[0].reviewed,false);assert.equal(projected.badges[0].expired,true);assert.equal(projected.trucks[0].truckBadges[0].type,'VEHICLE_AUTHORIZATION');assert.equal(projected.reviews[0].disputed,true);assert.deepEqual(projected.fleet,{page:2,pages:3,total:28});assert.equal(nativePublicProvider(null),null);
});
test('Featured preserves real schedule association without database identifiers',()=>{
 const result=nativeFeatured({feature_date:'2026-10-05',published:true,providers:[{truck_key:'vehicle:private-id',driver_user_id:'private-user',name:'Fleet',handle:'fleet',driver_first_name:'Abebe',public_capacity_available:true}],schedule:{entries:[{type:'PROVIDER',provider_key:'vehicle:private-id',starts_at:'2026-10-05T05:30:00Z',ends_at:'2026-10-05T06:00:00Z'},{type:'PROGRAMME_BREAK',label:'Sponsor · Example'}]},sponsored_providers:[{sponsor_kind:'ADVERTISER',name:'Example',website_url:'javascript:alert(1)',phone:'+251900000000'}]});
 assert.equal(result.programme[0].slot,result.trucks[0].slot);assert.equal(result.programme[1].kind,'BREAK');assert.equal(result.sponsors[0].website,'');assert.equal(JSON.stringify(result).includes('private-'),false);assert.equal(nativeFeatured({published:false,providers:[]}).trucks.length,0);
});
test('public assets and contact destinations reject private paths and executable schemes',()=>{
 for(const value of ['//evil.test/a.jpg','/private/proof.jpg','/marketing/../private.jpg','https://evil.test/image','/api/mobile/files/a','/api/public/providers/fleet/image?token=private'])assert.equal(publicAsset(value),'');
 assert.equal(publicAsset('/api/public/providers/fleet/image?v=2026-10-05T00%3A00'),'/api/public/providers/fleet/image?v=2026-10-05T00%3A00');assert.equal(publicAsset('/vehicle-configurations/cargo-van.jpg'),'/vehicle-configurations/cargo-van.jpg');
 for(const value of ['javascript:alert(1)','file:///tmp/a','intent://app','https://user:pass@example.test'])assert.equal(publicWebsite(value),'');
 assert.equal(publicWebsite('https://example.test/'),'https://example.test/');
});
