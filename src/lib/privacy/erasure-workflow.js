// Explicit administrator command. Every external effect is idempotent and checked.
// A failed file or Auth operation leaves ERASING, never a false COMPLETED receipt.
export async function runAccountErasure(port,actorId,requestId) {
 const prepared=await port.prepare(actorId,requestId);
 if(prepared.status!=='ERASING')return prepared;
 const deadline=port.now()+8000;
 for(const file of await port.files(requestId)){
  if(port.now()>=deadline)return {status:'ERASING'};
  await port.removeFile(file.storage_path);
  await port.markFileRemoved(requestId,file.storage_path);
 }
 if(await port.pendingFiles(requestId))return {status:'ERASING'};
 if(!prepared.authErased)await port.eraseAuth(prepared.subjectId);
 return port.finish(actorId,requestId);
}
