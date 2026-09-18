export const TRIAL_DAYS = 7;
export const PAID_ACCESS_DAYS = 30;

export function accessPeriodEnd(startedAt, days) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(start.getTime())) throw new Error('INVALID_ACCESS_PERIOD_START');
  return new Date(start.getTime() + days * 86_400_000).toISOString();
}

export function subscriptionAccess(subscription, now = new Date(), policy = null) {
  if (!subscription) {
    return {
      granted:false,
      status:'NO_SUBSCRIPTION',
      ends_at:null,
      days_remaining:0
    };
  }
  if (policy?.mode === 'FREE') {
    return {granted:true,status:'FREE_ACCESS',ends_at:null,days_remaining:null};
  }
  if (subscription.status === 'SPONSORED') {
    return {
      granted:true,
      status:'SPONSORED',
      ends_at:null,
      days_remaining:null
    };
  }
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const activationEnd=policy?.mode==='TRIAL_PAYMENT'&&policy.activated_at
    ?new Date(policy.activated_at).getTime()+TRIAL_DAYS*86_400_000:Number.NaN;
  const storedEnd = subscription.ends_at ? new Date(subscription.ends_at).getTime() : Number.NaN;
  const endTime=subscription.status==='TRIAL'&&Number.isFinite(activationEnd)
    ?Math.max(Number.isFinite(storedEnd)?storedEnd:0,activationEnd):storedEnd;
  const unexpired = Number.isFinite(endTime) && endTime > currentTime;
  if (unexpired && ['TRIAL','ACTIVE'].includes(subscription.status)) {
    return {
      granted:true,
      status:subscription.status,
      ends_at:new Date(endTime).toISOString(),
      days_remaining:Math.max(1,Math.ceil((endTime-currentTime)/86_400_000))
    };
  }
  if(Number.isFinite(activationEnd)&&activationEnd>currentTime){
    return {granted:true,status:'TRIAL',ends_at:new Date(activationEnd).toISOString(),days_remaining:Math.ceil((activationEnd-currentTime)/86_400_000)};
  }
  if (subscription.status === 'PAYMENT_UNDER_REVIEW') {
    return {
      granted:false,
      status:'PAYMENT_UNDER_REVIEW',
      ends_at:subscription.ends_at || null,
      days_remaining:0
    };
  }
  return {
    granted:false,
    status:'EXPIRED_UNPAID',
    ends_at:subscription.ends_at || null,
    days_remaining:0
  };
}
