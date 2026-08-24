import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd(),'src');
const required=['app/page.tsx','app/featured/page.tsx','app/shared-capacity/page.tsx','app/about/page.tsx','app/login/page.tsx','app/app/home/page.tsx','app/app/provider-shipments/page.tsx','app/app/network/page.tsx','app/app/support/page.tsx','app/support/page.tsx','app/admin/support/page.tsx','app/admin/capacity-network/page.tsx','app/api/health/route.ts','app/api/auth/google/route.ts','app/api/auth/email-otp/request/route.ts','app/api/auth/email-otp/verify/route.ts','app/api/auth/callback/route.ts','app/api/files/payment-proof/[id]/route.ts','middleware.ts','lib/auth-flow.js','lib/db.js','lib/repository.js','lib/private-storage.js','lib/launch-readiness.js'];
for(const item of required){if(!fs.existsSync(path.join(root,item)))throw new Error(`Missing ${item}`)}
if(fs.existsSync(path.join(root,'app/api/shipments/[id]/note/route.ts')))throw new Error('Retired internal-note route is still present');
if(!fs.readFileSync(path.join(root,'middleware.ts'),'utf8').includes('retiredDemandResponse'))throw new Error('Retired demand mutations are not centrally denied');
const retiredDemandApiRoutes=[
  'app/api/shipments/route.ts',
  'app/api/shipments/[id]/accept/route.ts',
  'app/api/shipments/[id]/business-review/route.ts',
  'app/api/shipments/[id]/interest/route.ts',
  'app/api/shipments/[id]/load-proof/request/route.ts',
  'app/api/shipments/[id]/load-proof/share/route.ts',
  'app/api/shipments/[id]/proof/route.ts',
  'app/api/shipments/[id]/receiver-contact/route.ts',
  'app/api/shipments/[id]/status/route.ts',
  'app/api/shipments/[id]/tracking-mode/route.ts',
  'app/api/shipments/[id]/tracking-update/route.ts',
  'app/api/shipments/[id]/vehicle/route.ts',
  'app/api/files/load-proof/[id]/route.ts',
  'app/api/files/proof/[id]/route.ts'
];
for(const route of retiredDemandApiRoutes){
  const source=fs.readFileSync(path.join(root,route),'utf8').trim();
  if(!/^export \{ retiredDemandResponse as (GET|POST) \} from '@\/lib\/retired-demand';$/.test(source)){
    throw new Error(`Retired demand route can still reach application code: ${route}`);
  }
}
const names=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else names.push(full)}}
walk(root);
for(const file of names.filter(f=>f.endsWith('.js'))){const source=fs.readFileSync(file,'utf8');if(source.includes('Deliverrex')||source.includes('MaliktBoard'))throw new Error(`Old product name in ${file}`)}
const repository=fs.readFileSync(path.join(root,'lib/repository.js'),'utf8');
if(repository.includes('addShipmentNote'))throw new Error('Retired internal-note service is still present');
for(const artifact of ['Dockerfile','compose.yaml','netlify.toml','public/icon.svg','public/icon-192.png','public/icon-512.png','public/apple-touch-icon.png','supabase/migrations/009_launch_storage_places_and_capacity.sql','supabase/migrations/010_driver_capacity_authority.sql','supabase/migrations/030_shared_capacity_email_otp.sql','supabase/migrations/031_unified_sponsor_catalog.sql','supabase/migrations/032_provider_profile_storage.sql']){
  if(!fs.existsSync(path.resolve(process.cwd(),artifact)))throw new Error(`Missing ${artifact}`);
}
const capacityForm=fs.readFileSync(path.join(root,'components/capacity-form.tsx'),'utf8');
for(const retired of ['MANUAL_GENERAL_AREA','Current general area','City or town']){
  if(capacityForm.includes(retired))throw new Error(`Retired manual truck-location UI returned: ${retired}`);
}
console.log(`Source check passed: ${names.length} files, all required routes present.`);
