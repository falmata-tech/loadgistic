const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class BusinessDirectoryError extends Error {constructor(code){super(code);this.code=code;}}
export function directoryIdentity(value){if(typeof value!=='string'||!uuid.test(value))throw new BusinessDirectoryError('INVALID_BUSINESS_INPUT');return value;}
export function directorySearch(query='',page='1'){
 if(typeof query!=='string'||query.length>120||/[\u0000-\u001f\u007f]/.test(query)||!/^\d{1,4}$/.test(String(page))||Number(page)<1)throw new BusinessDirectoryError('INVALID_BUSINESS_INPUT');
 return {query:query.normalize('NFKC').trim(),page:Number(page)};
}
