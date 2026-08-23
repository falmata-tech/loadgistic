import {performance} from 'node:perf_hooks';

if(!process.env.DATABASE_PATH)process.env.DATABASE_PATH='/tmp/loadgistic-market-scale.db';
const {listPublicCapacityCursor}=await import('../src/lib/repository.js');

function measure(label,operation){
  const started=performance.now();
  const value=operation();
  return {label,elapsedMs:Number((performance.now()-started).toFixed(2)),value};
}

const warm=measure('warm-first-page',()=>listPublicCapacityCursor({},{pageSize:14}));
const first=measure('cached-first-page',()=>listPublicCapacityCursor({},{pageSize:14}));
let cursor=first.value.nextCursor;
let transferred=Buffer.byteLength(JSON.stringify(first.value));
let loaded=first.value.items.length;
const pages=[];
for(let index=0;index<9&&cursor;index+=1){
  const page=measure(`cursor-${index+2}`,()=>listPublicCapacityCursor({},{pageSize:14,cursor}));
  pages.push(page.elapsedMs);
  transferred+=Buffer.byteLength(JSON.stringify(page.value));
  loaded+=page.value.items.length;
  cursor=page.value.nextCursor;
}
const filtered=measure('filtered-local-page',()=>listPublicCapacityCursor({q:'Cargo van',status:'EMPTY'},{pageSize:14}));
const report={
  database:process.env.DATABASE_PATH,
  measuredAt:new Date().toISOString(),
  warmFirstPageMs:warm.elapsedMs,
  cachedFirstPageMs:first.elapsedMs,
  filteredPageMs:filtered.elapsedMs,
  firstPageBytes:Buffer.byteLength(JSON.stringify(first.value)),
  tenPageBytes:transferred,
  loadedRecords:loaded,
  cursorPageMs:pages,
  pageSize:first.value.pageSize,
  hasMore:first.value.hasMore
};
console.log(JSON.stringify(report,null,2));
if(first.value.items.length>16||filtered.value.items.length>16)throw new Error('PUBLIC_PAGE_BOUND_EXCEEDED');
if(report.firstPageBytes>300_000)throw new Error('PUBLIC_PAGE_PAYLOAD_TOO_LARGE');
if(report.cachedFirstPageMs>2_000||report.filteredPageMs>2_000)throw new Error('LOCAL_SCALE_QUERY_TOO_SLOW');
