import {z} from 'zod';

const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const fact=z.object({verified:z.boolean(),reviewedAt:z.string().nullable(),expiresOn:date});
export const truckAuthoritySchema=z.object({
  ownership:fact,permission:fact,
  operatingLicence:fact.extend({holderBasis:z.enum(['OWNED','FINANCED']).nullable()}),
  qualifiesProvider:z.boolean()
}).superRefine((value,context)=>{
  if(value.qualifiesProvider!==(value.ownership.verified||value.operatingLicence.verified)
    ||value.operatingLicence.verified&&!value.operatingLicence.holderBasis
    ||value.permission.verified&&!value.permission.expiresOn
    ||value.operatingLicence.verified&&!value.operatingLicence.expiresOn
    ||[value.ownership,value.permission,value.operatingLicence].some(item=>item.verified&&!item.reviewedAt))
    context.addIssue({code:z.ZodIssueCode.custom,message:'INVALID_AUTHORITY_FACTS'});
});
export const providerAuthoritySummarySchema=z.object({
  total:z.number().int().nonnegative(),ownershipVerified:z.number().int().nonnegative(),financedVerified:z.number().int().nonnegative(),
  permissionVerified:z.number().int().nonnegative(),notYetVerified:z.number().int().nonnegative(),
  operatingLicenceVerified:z.number().int().nonnegative()
}).superRefine((value,context)=>{
  if(value.ownershipVerified+value.operatingLicenceVerified+value.permissionVerified+value.notYetVerified!==value.total
    ||value.financedVerified>value.operatingLicenceVerified)context.addIssue({code:z.ZodIssueCode.custom,message:'INVALID_AUTHORITY_TOTALS'});
});
export const providerPublicationSchema=z.object({canPublish:z.boolean(),liveTruckCount:z.number().int().nonnegative(),qualifyingTruckCount:z.number().int().nonnegative(),
  qualifyingOwnershipCount:z.number().int().nonnegative(),qualifyingLicenceCount:z.number().int().nonnegative()
}).superRefine((value,context)=>{
  if(value.canPublish!==(value.qualifyingTruckCount>0||value.liveTruckCount<1)||value.qualifyingOwnershipCount>value.qualifyingTruckCount
    ||value.qualifyingLicenceCount>value.qualifyingTruckCount)context.addIssue({code:z.ZodIssueCode.custom,message:'INVALID_PUBLICATION_ELIGIBILITY'});
});
export const authorityConfirmationSchema=z.object({
  factKind:z.enum(['OWNERSHIP','PERMISSION','OPERATING_LICENCE']),
  contextRevision:z.string().regex(/^[a-f0-9]{64}$/),
  holderBasis:z.enum(['OWNED','FINANCED']).optional(),expiresOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reviewNote:z.string().trim().min(5).max(500)
}).strict().superRefine((value,context)=>{
  if(value.factKind==='OPERATING_LICENCE'&&!value.holderBasis)context.addIssue({code:z.ZodIssueCode.custom,message:'AUTHORITY_HOLDER_BASIS_REQUIRED'});
  if(value.factKind!=='OPERATING_LICENCE'&&value.holderBasis)context.addIssue({code:z.ZodIssueCode.custom,message:'INVALID_AUTHORITY_HOLDER_BASIS'});
  if(value.factKind!=='OWNERSHIP'&&!value.expiresOn)context.addIssue({code:z.ZodIssueCode.custom,message:'AUTHORITY_EXPIRY_REQUIRED'});
});
export const authorityVehicleIdsSchema=z.array(z.string().uuid()).max(100);
export const emptyTruckAuthority=()=>({ownership:{verified:false,reviewedAt:null,expiresOn:null},
  permission:{verified:false,reviewedAt:null,expiresOn:null},
  operatingLicence:{verified:false,reviewedAt:null,expiresOn:null,holderBasis:null},qualifiesProvider:false});
