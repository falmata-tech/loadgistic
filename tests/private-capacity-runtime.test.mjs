import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root=process.cwd();
const activeFiles=[
  'src/app/api/capacity-network/route.ts',
  'src/app/app/network/page.tsx',
  'src/app/shared-capacity/page.tsx',
  'src/app/admin/capacity-network/page.tsx',
  'src/app/api/shared-capacity/route.ts',
  'src/app/api/shared-capacity/otp/route.ts',
  'src/app/api/shared-capacity/access/route.ts',
  'src/app/api/admin/capacity-network/route.ts'
];

test('active private-capacity routes use the dedicated managed port',()=>{
  for(const relativePath of activeFiles){
    const source=fs.readFileSync(path.join(root,relativePath),'utf8');
    assert.doesNotMatch(source,/lib\/repository\.js/);
    assert.match(source,/lib\/private-capacity\.js/);
  }
  const port=fs.readFileSync(path.join(root,'src/lib/private-capacity.js'),'utf8');
  assert.match(port,/repository\/supabase\.js/);
  assert.doesNotMatch(port,/DATA_BACKEND|repository\.js/);
});
