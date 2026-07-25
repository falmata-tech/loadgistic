import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd(),'src');
const required=['app/page.tsx','app/login/page.tsx','app/app/home/page.tsx','app/app/shipments/page.tsx','app/app/capacity/page.tsx','app/api/health/route.ts','lib/db.js','lib/repository.js'];
for(const item of required){if(!fs.existsSync(path.join(root,item)))throw new Error(`Missing ${item}`)}
const names=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else names.push(full)}}
walk(root);
for(const file of names.filter(f=>f.endsWith('.js'))){const source=fs.readFileSync(file,'utf8');if(source.includes('Deliverrex')||source.includes('MaliktBoard'))throw new Error(`Old product name in ${file}`)}
console.log(`Source check passed: ${names.length} files, all required routes present.`);
