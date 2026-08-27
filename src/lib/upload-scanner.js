const CLOUDMERSIVE_ENDPOINT='https://api.cloudmersive.com/virus/scan/file/advanced';
const EICAR_MARKER='EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
const SCANNER_BACKENDS=new Set(['local','cloudmersive']);

function scannerBackend(environment=process.env){
  const backend=String(environment.UPLOAD_SCANNER_BACKEND||'local').trim().toLowerCase();
  if(!SCANNER_BACKENDS.has(backend))throw new Error('INVALID_UPLOAD_SCANNER_BACKEND');
  return backend;
}

export function uploadScannerStatus(environment=process.env){
  const backend=scannerBackend(environment);
  const production=environment.NODE_ENV==='production';
  const configured=backend==='local'
    ?!production
    :Boolean(String(environment.CLOUDMERSIVE_API_KEY||'').trim());
  return {backend,configured,productionSafe:backend==='cloudmersive'&&configured};
}

function neutralFileName(mimeType){
  return `upload${{
    'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf'
  }[mimeType]||'.bin'}`;
}

async function scanWithCloudmersive(bytes,mimeType,{environment,fetchImpl}){
  const apiKey=String(environment.CLOUDMERSIVE_API_KEY||'').trim();
  if(!apiKey)throw new Error('UPLOAD_SCANNER_NOT_CONFIGURED');
  const fileName=neutralFileName(mimeType);
  const form=new FormData();
  form.append('inputFile',new Blob([bytes],{type:mimeType}),fileName);
  const timeoutMs=Math.max(1000,Math.min(20_000,Number(environment.UPLOAD_SCANNER_TIMEOUT_MS)||8000));
  let response;
  try{
    response=await fetchImpl(CLOUDMERSIVE_ENDPOINT,{
      method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs),body:form,
      headers:{
        Apikey:apiKey,fileName,allowExecutables:'false',allowInvalidFiles:'false',
        allowScripts:'false',allowPasswordProtectedFiles:'false',allowMacros:'false',
        allowXmlExternalEntities:'false',allowInsecureDeserialization:'false',
        allowHtml:'false',allowUnsafeArchives:'false',allowOleEmbeddedObject:'false',
        allowUnwantedAction:'false',restrictFileTypes:'.jpg,.jpeg,.png,.webp,.pdf',
        options:'blockInvalidUris'
      }
    });
  }catch{throw new Error('UPLOAD_SCANNER_UNAVAILABLE');}
  if(!response?.ok)throw new Error('UPLOAD_SCANNER_UNAVAILABLE');
  let result;
  try{result=await response.json();}catch{throw new Error('UPLOAD_SCANNER_UNAVAILABLE');}
  if(typeof result?.CleanResult!=='boolean')throw new Error('UPLOAD_SCANNER_UNAVAILABLE');
  if(!result.CleanResult)throw new Error('UPLOAD_REJECTED');
  return {clean:true,provider:'cloudmersive'};
}

export async function scanPrivateUpload(bytes,mimeType,{environment=process.env,fetchImpl=fetch}={}){
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw new Error('UPLOAD_SCANNER_INVALID_INPUT');
  const backend=scannerBackend(environment);
  if(backend==='local'){
    if(environment.NODE_ENV==='production')throw new Error('UPLOAD_SCANNER_NOT_CONFIGURED');
    if(bytes.includes(Buffer.from(EICAR_MARKER,'ascii')))throw new Error('UPLOAD_REJECTED');
    return {clean:true,provider:'local-test'};
  }
  return scanWithCloudmersive(bytes,mimeType,{environment,fetchImpl});
}
