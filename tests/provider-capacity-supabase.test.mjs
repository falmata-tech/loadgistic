import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {projectSupabaseProviderCapacityWorkspace} from '../src/lib/provider-capacity/supabase.js';

const root=path.resolve(import.meta.dirname,'..');

test('provider Capacity workspace projection keeps only canonical current geometry',()=>{
  const workspace=projectSupabaseProviderCapacityWorkspace({
    vehicles:[{id:'vehicle-1',label:'Courier van'}],
    capacities:[{
      id:'capacity-1',vehicle_id:'vehicle-1',status:'PARTIAL',availability_geometry:'ROUTE',
      current_route_points:[
        {place_ref:'place:addis',label:'Addis Ababa, Ethiopia',lat:9.03,lng:38.74},
        {place_ref:'place:adama',label:'Adama, Ethiopia',lat:8.54,lng:39.27}
      ],
      capacity_area_boundary:[{place_ref:'ignored',label:'Ignored',lat:8,lng:39}],
      photo_storage_path:'capacity/private-proof.jpg',updated_at:new Date().toISOString()
    }],
    corridors:[{
      id:'route-1',geometry:'RADIUS',route_points:[{place_ref:'ignored',label:'Ignored',lat:8,lng:39}],
      area_boundary:[
        {place_ref:'place:a',label:'A',lat:9,lng:38},
        {place_ref:'place:b',label:'B',lat:9.1,lng:38.2},
        {place_ref:'place:c',label:'C',lat:8.9,lng:38.1}
      ]
    }],
    access:{kind:'SELF_MANAGED',can_manage_capacity:true}
  });

  assert.equal(workspace.vehicles.length,1);
  assert.equal(workspace.capacities[0].status,'PARTIAL');
  assert.equal(workspace.capacities[0].current_route_points.length,2);
  assert.deepEqual(workspace.capacities[0].capacity_area_boundary,[]);
  assert.equal(workspace.capacities[0].proof_available,true);
  assert.equal(workspace.capacities[0].expiry_state,'CURRENT');
  assert.equal(workspace.capacities[0].isOwn,true);
  assert.equal(workspace.corridors[0].geometry,'RADIUS');
  assert.deepEqual(workspace.corridors[0].route_points,[]);
  assert.equal(workspace.corridors[0].area_boundary.length,3);
  assert.deepEqual(workspace.access,{kind:'SELF_MANAGED',can_manage_capacity:true});
});

test('provider Capacity runtime repeats scope, assignment, subscription, and permission authorization',()=>{
  const migration=fs.readFileSync(path.join(root,'supabase','migrations','043_provider_capacity_runtime.sql'),'utf8');
  assert.match(migration,/profile\.active[\s\S]*profile\.role in \('TRANSPORTER','DRIVER'\)/i);
  assert.match(migration,/subscription\.status='SPONSORED'[\s\S]*subscription\.status in \('TRIAL','ACTIVE'\)/i);
  assert.match(migration,/assignment\.driver_user_id=actor_user_id[\s\S]*assignment\.active/i);
  assert.match(migration,/actor\.is_company_driver and not actor\.can_manage_capacity/i);
  assert.match(migration,/provider_capacity_place_points\(command->'current_route_places',2,5/i);
  assert.match(migration,/provider_capacity_place_points\(command->'capacity_area_boundary_places',3,5/i);
  assert.match(migration,/update public\.capacities set expires_at=timestamp_value[\s\S]*insert into public\.capacities[\s\S]*insert into public\.audit_logs/i);
  assert.match(migration,/revoke all on function public\.provider_capacity_workspace\(uuid\) from public,anon,authenticated/i);
  assert.match(migration,/revoke all on function public\.publish_provider_capacity\(uuid,jsonb\) from public,anon,authenticated/i);
  assert.match(migration,/grant execute on function public\.provider_capacity_workspace\(uuid\) to service_role/i);
  assert.match(migration,/grant execute on function public\.publish_provider_capacity\(uuid,jsonb\) to service_role/i);
});

test('active provider Capacity pages and routes use the application port, not SQLite',()=>{
  const pages=[
    'src/app/app/home/page.tsx',
    'src/app/app/fleet/page.tsx',
    'src/app/app/fleet/[id]/page.tsx'
  ];
  for(const relative of pages){
    const source=fs.readFileSync(path.join(root,relative),'utf8');
    assert.match(source,/getProviderCapacityWorkspace/);
  }

  const routes=[
    'src/app/api/capacity/route.ts',
    'src/app/api/capacity/location/route.ts',
    'src/app/api/capacity/duty/route.ts',
    'src/app/api/capacity/corridors/route.ts'
  ];
  for(const relative of routes){
    const source=fs.readFileSync(path.join(root,relative),'utf8');
    assert.match(source,/lib\/provider-capacity\.js/);
    assert.doesNotMatch(source,/lib\/repository\.js/);
  }
  const publishRoute=fs.readFileSync(path.join(root,'src','app','api','capacity','route.ts'),'utf8');
  assert.match(publishRoute,/removePrivateUpload\(upload\.path\)/);

  const application=fs.readFileSync(path.join(root,'src','lib','provider-capacity.js'),'utf8');
  assert.match(application,/process\.env\.DATA_BACKEND==='supabase'/);
  assert.doesNotMatch(application,/catch\s*\(/);
});
