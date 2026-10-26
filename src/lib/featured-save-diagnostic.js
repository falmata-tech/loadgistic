const stages=new Set(['SAVE_RPC','READBACK']);
const businessCodes=new Set([
  'FEATURED_PROVIDER_INELIGIBLE','FEATURED_PROVIDER_DUPLICATE','FEATURED_TRUCK_INVALID',
  'FEATURED_TRUCK_INELIGIBLE','FEATURED_DRIVER_REQUIRED','FEATURED_TARGET_COUNT_INVALID',
  'FEATURED_TARGET_COUNT_MISMATCH','FEATURED_SCHEDULE_WINDOW_INVALID',
  'FEATURED_SCHEDULE_CAPACITY_EXCEEDED','FEATURED_MANUAL_SCHEDULE_TOO_SHORT',
  'FEATURED_MANUAL_SCHEDULE_INVALID','FEATURED_MANUAL_SCHEDULE_INCOMPLETE',
  'FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION','FEATURED_MANUAL_SCHEDULE_OVERLAP',
  'FEATURED_MANUAL_BREAK_INVALID'
]);
const categories=new Map([
  ['23502','INTEGRITY'],['23503','INTEGRITY'],['23505','INTEGRITY'],['23514','INTEGRITY'],
  ['42501','PERMISSION'],['57014','TIMEOUT'],['40P01','CONCURRENCY'],['40001','CONCURRENCY'],
  ['42P01','SCHEMA'],['42883','SCHEMA'],['42703','SCHEMA'],['P0001','BUSINESS_RULE']
]);

export async function withFeaturedSaveStage(stage,operation){
  if(!stages.has(stage))throw new Error('FEATURED_SAVE_STAGE_INVALID');
  try{return await operation();}
  catch(error){
    const failure=error instanceof Error?error:new Error('FEATURED_SAVE_FAILED',{cause:error});
    Object.defineProperty(failure,'featuredSaveStage',{value:stage});
    throw failure;
  }
}

/** This is the complete server-log payload. Never return a raw cause or message. */
export function featuredSaveDiagnostic(error){
  const stage=error?.featuredSaveStage;
  if(!stages.has(stage))return null;
  const causes=[error,error?.cause,error?.cause?.cause];
  let businessCode=null,category='UNKNOWN';
  for(const cause of causes){
    const message=typeof cause?.message==='string'?cause.message:'';
    const code=message.match(/\bFEATURED_[A-Z_]+\b/g)?.find(value=>businessCodes.has(value));
    if(code&&!businessCode)businessCode=code;
    const next=categories.get(cause?.code);
    if(next&&category==='UNKNOWN')category=next;
  }
  return {stage,category,businessCode};
}

export function featuredSaveDiagnosticLine(error){
  const diagnostic=featuredSaveDiagnostic(error);
  return diagnostic?`FEATURED_ADMIN_SAVE ${JSON.stringify(diagnostic)}`:null;
}
