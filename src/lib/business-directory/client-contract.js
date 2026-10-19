// Public/client projection only. Never reuse the private review-center payload here.
export const businessDocumentTypes=['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'];
export const businessDocumentLabel=type=>({IDENTITY:'Account manager National ID',BUSINESS_LICENSE:'Business license',BUSINESS_ADDRESS:'Business address'})[type]||'Document';
export const businessDocumentState=badge=>badge.verified?'Loadgistic reviewed':badge.expired?'Expired':'Not reviewed';
const invalid=()=>new Error('Could not load business details. Please try again.');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const optionalText=(value,max)=>value===null||text(value,max);
const note=value=>typeof value==='string'&&value.length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const date=value=>value===null||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(value)&&Number.isFinite(Date.parse(value));
const handle=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{1,63}$/.test(value);
function badges(value){
 if(!Array.isArray(value)||value.length!==3||new Set(value.map(row=>row?.type)).size!==3||value.some(row=>!exact(row,['type','verified','expired','reviewedAt','expiresOn'])||!businessDocumentTypes.includes(row.type)||typeof row.verified!=='boolean'||typeof row.expired!=='boolean'||row.verified&&row.expired||!date(row.reviewedAt)||!date(row.expiresOn)))throw invalid();
 return value;
}
function identity(value){return uuid(value.id)&&text(value.name,140)&&!!value.name.trim()&&handle(value.handle)&&optionalText(value.managerName,100);}
export function parseBusinessDirectoryPage(value){
 if(!exact(value,['items','total','page','pageSize','pageCount'])||!Array.isArray(value.items)||value.items.length>12||value.pageSize!==12||!Number.isSafeInteger(value.total)||value.total<0||!Number.isSafeInteger(value.page)||value.page<1||!Number.isSafeInteger(value.pageCount)||value.pageCount<1)throw invalid();
 for(const item of value.items){if(!exact(item,['id','name','handle','kind','city','managerName','documents'])||!identity(item)||!['BROKER','SHIPPER','RECEIVER'].includes(item.kind)||!optionalText(item.city,100))throw invalid();badges(item.documents);}
 if(new Set(value.items.map(item=>item.id)).size!==value.items.length)throw invalid();
 return value;
}
export function parseBusinessDocuments(value,workspaceId,canManage){
 if(!exact(value,['id','workspaceId','name','handle','managerName','canManage','documents','subjects','requests'])||!identity(value)||value.id!==workspaceId||value.workspaceId!==workspaceId||value.canManage!==canManage||!Array.isArray(value.subjects)||value.subjects.length>1||!Array.isArray(value.requests)||value.requests.length>500||!canManage&&(value.subjects.length||value.requests.length))throw invalid();
 badges(value.documents);
 for(const subject of value.subjects){if(!exact(subject,['id','kind','name','allowedTypes','pending','badges','vehicles'])||subject.id!==workspaceId||subject.kind!=='BUSINESS_WORKSPACE'||subject.name!==value.name||!Array.isArray(subject.allowedTypes)||subject.allowedTypes.some(type=>!businessDocumentTypes.includes(type))||new Set(subject.allowedTypes).size!==subject.allowedTypes.length||!Number.isSafeInteger(subject.pending)||subject.pending<0||!Array.isArray(subject.vehicles)||subject.vehicles.length)throw invalid();badges(subject.badges);}
 for(const item of value.requests){if(!exact(item,['id','subjectId','subjectKind','name','type','status','submittedAt','reviewedAt','expiresOn','note','stale','hasFile'])||!uuid(item.id)||item.subjectId!==workspaceId||item.subjectKind!=='BUSINESS_WORKSPACE'||!text(item.name,150)||!businessDocumentTypes.includes(item.type)||!['PENDING','APPROVED','MORE_INFO','REJECTED'].includes(item.status)||!item.submittedAt||!date(item.submittedAt)||!date(item.reviewedAt)||!date(item.expiresOn)||!note(item.note)||typeof item.stale!=='boolean'||typeof item.hasFile!=='boolean')throw invalid();}
 if(new Set(value.requests.map(item=>item.id)).size!==value.requests.length)throw invalid();
 return value;
}
