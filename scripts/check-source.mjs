import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd(),'src');
const required=['app/page.tsx','app/about/page.tsx','app/login/page.tsx','app/app/home/page.tsx','app/app/shipments/page.tsx','app/app/capacity/page.tsx','app/app/support/page.tsx','app/support/page.tsx','app/admin/support/page.tsx','app/api/health/route.ts','app/api/files/payment-proof/[id]/route.ts','lib/db.js','lib/repository.js','lib/private-storage.js','lib/launch-readiness.js'];
for(const item of required){if(!fs.existsSync(path.join(root,item)))throw new Error(`Missing ${item}`)}
if(fs.existsSync(path.join(root,'app/api/shipments/[id]/note/route.ts')))throw new Error('Retired internal-note route is still present');
const names=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else names.push(full)}}
walk(root);
for(const file of names.filter(f=>f.endsWith('.js'))){const source=fs.readFileSync(file,'utf8');if(source.includes('Deliverrex')||source.includes('MaliktBoard'))throw new Error(`Old product name in ${file}`)}
const repository=fs.readFileSync(path.join(root,'lib/repository.js'),'utf8');
if(repository.includes('addShipmentNote'))throw new Error('Retired internal-note service is still present');
for(const artifact of ['Dockerfile','compose.yaml','public/icon.svg','public/icon-192.png','public/icon-512.png','public/apple-touch-icon.png','supabase/migrations/009_launch_storage_places_and_capacity.sql','supabase/migrations/010_driver_capacity_authority.sql']){
  if(!fs.existsSync(path.resolve(process.cwd(),artifact)))throw new Error(`Missing ${artifact}`);
}
const capacityForm=fs.readFileSync(path.join(root,'components/capacity-form.tsx'),'utf8');
for(const retired of ['MANUAL_GENERAL_AREA','Current general area','City or town']){
  if(capacityForm.includes(retired))throw new Error(`Retired manual truck-location UI returned: ${retired}`);
}
console.log(`Source check passed: ${names.length} files, all required routes present.`);
