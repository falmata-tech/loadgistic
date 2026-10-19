export type BusinessDocumentType='IDENTITY'|'BUSINESS_LICENSE'|'BUSINESS_ADDRESS';
export type BusinessDocumentBadge={type:BusinessDocumentType;verified:boolean;expired:boolean;reviewedAt:string|null;expiresOn:string|null};
export type DirectoryBusiness={id:string;name:string;handle:string;kind:'BROKER'|'SHIPPER'|'RECEIVER';city:string|null;managerName:string|null;documents:BusinessDocumentBadge[]};
export type BusinessDirectoryPage={items:DirectoryBusiness[];total:number;page:number;pageSize:number;pageCount:number};
export type BusinessDocumentRequest={id:string;subjectId:string;subjectKind:'BUSINESS_WORKSPACE';name:string;type:BusinessDocumentType;status:'PENDING'|'APPROVED'|'MORE_INFO'|'REJECTED';submittedAt:string;reviewedAt:string|null;expiresOn:string|null;note:string;stale:boolean;hasFile:boolean};
export type BusinessDocumentSubject={id:string;kind:'BUSINESS_WORKSPACE';name:string;allowedTypes:BusinessDocumentType[];pending:number;badges:BusinessDocumentBadge[];vehicles:[]};
export type BusinessDocumentsView=Omit<DirectoryBusiness,'kind'|'city'>&{workspaceId:string;canManage:boolean;subjects:BusinessDocumentSubject[];requests:BusinessDocumentRequest[]};
export interface BusinessDirectoryPort {
 search(actorId:string,query:string,page:number):Promise<BusinessDirectoryPage>;
 documents(actorId:string,workspaceId:string):Promise<BusinessDocumentsView>;
}
