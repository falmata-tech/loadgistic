import crypto from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {scanPrivateUpload,uploadScannerStatus} from './upload-scanner.js';

const MIME_CONFIG={
  'image/jpeg':{extension:'.jpg',matches:(bytes)=>bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff},
  'image/png':{extension:'.png',matches:(bytes)=>bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))},
  'image/webp':{extension:'.webp',matches:(bytes)=>bytes.length>=12&&bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP'},
  'application/pdf':{extension:'.pdf',matches:(bytes)=>bytes.length>=5&&bytes.subarray(0,5).toString('ascii')==='%PDF-'}
};

const PURPOSE_BUCKET={
  capacity:'capacity-photo',
  verification:'verification',
  payment:'payment-proof',
  proof:'shipment-proof',
  'tracking-proof':'shipment-proof',
  'load-proof':'shipment-proof',
  'provider-profile':'provider-profile',
  'guest-support':'support-attachment',
  file:'shipment-proof'
};
const QUARANTINE_BUCKET='private-upload-quarantine';

function supabaseClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey)throw new Error('SUPABASE_NOT_CONFIGURED');
  return createClient(url,serviceKey,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{'X-Client-Info':'loadgistic-private-storage'}}
  });
}

function validatePurpose(purpose){
  if(!PURPOSE_BUCKET[purpose])throw new Error('INVALID_UPLOAD_PURPOSE');
  return purpose;
}

function cleanOriginalName(value){
  const cleaned=path.basename(String(value||'upload')).replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,160);
  return cleaned||'upload';
}

function supabaseParts(reference){
  const match=/^supabase:\/\/([^/]+)\/(.+)$/.exec(reference);
  if(!match)throw new Error('INVALID_PRIVATE_STORAGE_REFERENCE');
  return {bucket:match[1],objectPath:match[2]};
}

async function removeSupabaseObject(client,bucket,objectPath){
  const {error}=await client.storage.from(bucket).remove([objectPath]);
  if(error)throw new Error('PRIVATE_STORAGE_DELETE_FAILED');
}

export function privateStorageStatus(environment=process.env){
  const scanner=uploadScannerStatus(environment);
  return {
    backend:'supabase',
    durable:true,
    configured:Boolean(environment.NEXT_PUBLIC_SUPABASE_URL&&environment.SUPABASE_SERVICE_ROLE_KEY),
    scannerBackend:scanner.backend,
    scannerConfigured:scanner.configured,
    scannerProductionSafe:scanner.productionSafe
  };
}

export async function storePrivateUpload(file,purpose='file'){
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)return null;
  validatePurpose(purpose);
  const maxMb=Math.max(1,Number(process.env.FILE_MAX_MB||10));
  if(file.size>maxMb*1024*1024)throw new Error('FILE_TOO_LARGE');
  const mimeType=String(file.type||'').toLowerCase();
  const config=MIME_CONFIG[mimeType];
  if(!config)throw new Error('UNSUPPORTED_FILE_TYPE');
  const bytes=Buffer.from(await file.arrayBuffer());
  if(bytes.length!==file.size||!config.matches(bytes))throw new Error('FILE_CONTENT_MISMATCH');

  const date=new Date().toISOString().slice(0,10);
  const objectPath=`${purpose}/${date}/${crypto.randomUUID()}${config.extension}`;
  const quarantinePath=`incoming/${date}/${crypto.randomUUID()}${config.extension}`;
  const bucket=PURPOSE_BUCKET[purpose];
  const client=supabaseClient();
  let quarantined=false;let released=false;let reference;
  try{
    const {error:quarantineError}=await client.storage.from(QUARANTINE_BUCKET).upload(quarantinePath,bytes,{
      contentType:mimeType,cacheControl:'0',upsert:false
    });
    if(quarantineError)throw new Error('PRIVATE_STORAGE_QUARANTINE_FAILED');
    quarantined=true;
    await scanPrivateUpload(bytes,mimeType);
    const {error:releaseError}=await client.storage.from(bucket).upload(objectPath,bytes,{
      contentType:mimeType,cacheControl:'0',upsert:false
    });
    if(releaseError)throw new Error('PRIVATE_STORAGE_WRITE_FAILED');
    released=true;
    await removeSupabaseObject(client,QUARANTINE_BUCKET,quarantinePath);
    quarantined=false;
    reference=`supabase://${bucket}/${objectPath}`;
  }catch(error){
    if(released)await removeSupabaseObject(client,bucket,objectPath).catch(()=>undefined);
    if(quarantined)await removeSupabaseObject(client,QUARANTINE_BUCKET,quarantinePath).catch(()=>undefined);
    throw error;
  }
  return {path:reference,name:path.basename(objectPath),originalName:cleanOriginalName(file.name),mimeType,size:bytes.length};
}

export async function readPrivateUpload(reference){
  if(!reference)return null;
  const {bucket,objectPath}=supabaseParts(String(reference));
  if(bucket===QUARANTINE_BUCKET)throw new Error('INVALID_PRIVATE_STORAGE_REFERENCE');
  const {data,error}=await supabaseClient().storage.from(bucket).download(objectPath);
  if(error){
    if(String(error.statusCode||'')==='404')return null;
    throw new Error('PRIVATE_STORAGE_READ_FAILED');
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function removePrivateUpload(reference){
  if(!reference)return;
  const {bucket,objectPath}=supabaseParts(String(reference));
  if(bucket===QUARANTINE_BUCKET)throw new Error('INVALID_PRIVATE_STORAGE_REFERENCE');
  await removeSupabaseObject(supabaseClient(),bucket,objectPath);
}
