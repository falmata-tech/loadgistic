import fs from 'node:fs';
import path from 'node:path';

const outputPath=path.resolve(process.argv[2]||'data/osm/ethiopia-settlements.json');
const endpoint=process.env.OVERPASS_API_URL||'https://overpass-api.de/api/interpreter';
const query=`[out:json][timeout:180];
area["ISO3166-1"="ET"][admin_level=2]->.ethiopia;
nwr["place"~"^(city|town|village|hamlet)$"](area.ethiopia);
out tags center;`;

fs.mkdirSync(path.dirname(outputPath),{recursive:true});
const response=await fetch(endpoint,{
  method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'Loadgistic local place catalog setup'},
  body:new URLSearchParams({data:query}),
  signal:AbortSignal.timeout(240_000)
});
if(!response.ok)throw new Error(`Overpass download failed: ${response.status} ${response.statusText}`);
const body=await response.text();
JSON.parse(body);
fs.writeFileSync(outputPath,body);
console.log(`Downloaded Ethiopia settlement extract to ${outputPath} (${Buffer.byteLength(body).toLocaleString()} bytes).`);
