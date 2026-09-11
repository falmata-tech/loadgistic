import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_UPLOAD_SCAN_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_UPLOAD_SCAN_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
process.env.UPLOAD_SCANNER_BACKEND='local';
process.env.NODE_ENV='development';

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const {readPrivateUpload,removePrivateUpload,storePrivateUpload}=await import('../src/lib/private-storage.js');
const date=new Date().toISOString().slice(0,10);
const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);
const upload=(name,type,bytes)=>({name,type,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
let stored=null;
const sentinelPath=`verify/${randomUUID()}.png`;
let sentinelStored=false;

try{
  stored=await storePrivateUpload(upload('private-original-name.png','image/png',png),'verification');
  if(!stored?.path.startsWith('supabase://verification/'))throw new Error('SUPABASE_UPLOAD_SCAN_RELEASE_FAILED');
  if(!Buffer.from(await readPrivateUpload(stored.path)).equals(png))throw new Error('SUPABASE_UPLOAD_SCAN_READ_FAILED');

  const {data:quarantine,error:quarantineError}=await service.storage.from('private-upload-quarantine')
    .list(`incoming/${date}`,{limit:100});
  if(quarantineError||quarantine?.length)throw new Error('SUPABASE_UPLOAD_SCAN_QUARANTINE_NOT_EMPTY');

  const eicarPdf=Buffer.from(`%PDF-1.4\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`,'ascii');
  await storePrivateUpload(upload('unsafe.pdf','application/pdf',eicarPdf),'verification').then(
    ()=>{throw new Error('SUPABASE_UPLOAD_SCAN_DIRTY_RELEASED');},
    error=>{if(!String(error?.message).includes('UPLOAD_REJECTED'))throw error;}
  );
  const {data:afterDirty,error:afterDirtyError}=await service.storage.from('private-upload-quarantine')
    .list(`incoming/${date}`,{limit:100});
  if(afterDirtyError||afterDirty?.length)throw new Error('SUPABASE_UPLOAD_SCAN_DIRTY_QUARANTINE_RETAINED');

  const {error:sentinelError}=await service.storage.from('private-upload-quarantine').upload(sentinelPath,png,{
    contentType:'image/png',cacheControl:'0',upsert:false
  });
  if(sentinelError)throw new Error('SUPABASE_UPLOAD_SCAN_SENTINEL_FAILED');
  sentinelStored=true;
  const {data:anonymousList,error:anonymousListError}=await anon.storage.from('private-upload-quarantine')
    .list('verify',{search:sentinelPath.split('/').at(-1),limit:10});
  if(!anonymousListError&&anonymousList?.some(object=>object.name===sentinelPath.split('/').at(-1))){
    throw new Error('SUPABASE_UPLOAD_SCAN_ANONYMOUS_LIST_ALLOWED');
  }
  const {data:anonymousDownload,error:anonymousDownloadError}=await anon.storage.from('private-upload-quarantine').download(sentinelPath);
  if(!anonymousDownloadError||anonymousDownload)throw new Error('SUPABASE_UPLOAD_SCAN_ANONYMOUS_DOWNLOAD_ALLOWED');
}finally{
  if(stored?.path)await removePrivateUpload(stored.path);
  if(sentinelStored)await service.storage.from('private-upload-quarantine').remove([sentinelPath]);
}

process.stdout.write('Supabase private-upload quarantine, clean release, dirty rejection, cleanup, and browser denial checks passed.\n');
