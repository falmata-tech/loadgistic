export type ErasurePreparation={status:'ERASING';subjectId:string;authErased?:boolean}|{status:'HELD'|'COMPLETED'};
export interface AccountErasurePort<T extends {status:string}> {
 now:()=>number;
 prepare:(actorId:string,requestId:string)=>Promise<ErasurePreparation>;
 files:(requestId:string)=>Promise<{storage_path:string}[]>;
 removeFile:(path:string)=>Promise<void>;
 markFileRemoved:(requestId:string,path:string)=>Promise<void>;
 pendingFiles:(requestId:string)=>Promise<boolean>;
 eraseAuth:(subjectId:string)=>Promise<void>;
 finish:(actorId:string,requestId:string)=>Promise<T>;
}
export function runAccountErasure<T extends {status:string}>(port:AccountErasurePort<T>,actorId:string,requestId:string):Promise<T|{status:'ERASING'|'HELD'|'COMPLETED'}>;
