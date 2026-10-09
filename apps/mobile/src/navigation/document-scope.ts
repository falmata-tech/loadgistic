export type DocumentScope={kind:'ACCOUNT';includeDriver:boolean;includeOwner?:boolean}|{kind:'ENTITY';subjectKind:'VEHICLE'|'DRIVER';id:string};
// Presentation narrowing only. The API already authorizes the complete input.
export function documentSubjects<T extends {id:string;kind:string}>(subjects:T[],scope?:DocumentScope):T[]{
 if(!scope)return subjects;
 if(scope.kind==='ENTITY')return subjects.filter(item=>Boolean(scope.id)&&item.id===scope.id&&item.kind===scope.subjectKind);
 return subjects.filter(item=>scope.includeOwner!==false&&['ORGANIZATION','PROVIDER_PROFILE'].includes(item.kind)||scope.includeDriver&&item.kind==='DRIVER');
}
