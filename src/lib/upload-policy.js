export const PRIVATE_UPLOAD_MAX_MEBIBYTES=4;
export const PRIVATE_UPLOAD_MAX_BYTES=PRIVATE_UPLOAD_MAX_MEBIBYTES*1024*1024;

export function privateUploadMaxBytes(environment=process.env){
  const configuredMebibytes=Number(environment.FILE_MAX_MB);
  if(!Number.isFinite(configuredMebibytes)||configuredMebibytes<=0)return PRIVATE_UPLOAD_MAX_BYTES;
  return Math.min(PRIVATE_UPLOAD_MAX_BYTES,Math.floor(configuredMebibytes*1024*1024));
}

export function privateUploadMaxMebibytes(environment=process.env){
  return privateUploadMaxBytes(environment)/(1024*1024);
}
