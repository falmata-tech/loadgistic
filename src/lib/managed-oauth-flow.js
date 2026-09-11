import {createSessionToken,verifySessionToken} from './security.js';

export const MANAGED_OAUTH_COOKIE='lg_managed_oauth';
export const MANAGED_OAUTH_MAX_AGE_SECONDS=15*60;

const INTENTS=new Set(['LOGIN','ACCESS']);
const FLOW_ID_PATTERN=/^[A-Za-z0-9_-]{8,64}$/;

function normalizedFlowId(value){
  const flowId=String(value||'');
  return FLOW_ID_PATTERN.test(flowId)?flowId:null;
}

export function createManagedOAuthHandoff(intent,flowId){
  const normalizedIntent=String(intent||'').toUpperCase();
  const normalizedFlowIdValue=normalizedFlowId(flowId);
  if(!INTENTS.has(normalizedIntent)||!normalizedFlowIdValue)throw new Error('INVALID_MANAGED_OAUTH_FLOW');
  return createSessionToken(
    `managed-oauth:${normalizedIntent}:${normalizedFlowIdValue}`,
    MANAGED_OAUTH_MAX_AGE_SECONDS
  );
}

export function readManagedOAuthHandoff(token){
  const payload=verifySessionToken(token);
  const match=String(payload?.sub||'').match(/^managed-oauth:(LOGIN|ACCESS):([A-Za-z0-9_-]{8,64})$/);
  if(!match)return null;
  return {intent:match[1],flowId:match[2],expiresAt:Number(payload.exp)*1000};
}

export function managedOAuthCallbackHandoff(token,returnedFlowId=''){
  const handoff=readManagedOAuthHandoff(token);
  if(!handoff)return null;
  if(!returnedFlowId)return handoff;
  const normalizedFlowIdValue=normalizedFlowId(returnedFlowId);
  return normalizedFlowIdValue===handoff.flowId?handoff:null;
}

export function managedOAuthCallbackIntent(token,returnedFlowId=''){
  return managedOAuthCallbackHandoff(token,returnedFlowId)?.intent||null;
}
