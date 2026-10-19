import {z} from 'zod';
import {authenticateGateway,loadGatewayConfigurations,GATEWAY_BODY_LIMIT} from '@/lib/telematics-gateway-auth.js';
import {authorizeGatewayRequest,ingestGatewayPosition,claimGatewayCommands,recordGatewayCommandResult,pruneGatewayHistory} from '@/lib/telematics.js';
import {normalizedTelemetrySchema} from '@/lib/telematics-contract.js';
export const runtime='nodejs';
const result=z.object({commandId:z.string().uuid(),leaseId:z.string().uuid(),state:z.enum(['DISPATCHED','ACKNOWLEDGED','FAILED','UNKNOWN']),
 correlated:z.boolean().optional(),eventKey:z.string().regex(/^[A-Za-z0-9:_-]{1,120}$/).optional()}).strict();
const envelope=z.discriminatedUnion('action',[
 z.object({action:z.literal('POSITION'),positions:z.array(normalizedTelemetrySchema).min(1).max(50)}).strict(),
 z.object({action:z.literal('CLAIM_COMMANDS')}).strict(),
 z.object({action:z.literal('RESULT'),results:z.array(result).min(1).max(20)}).strict(),
 z.object({action:z.literal('PRUNE')}).strict()
]);
async function boundedBody(request:Request){
 if(Number(request.headers.get('content-length')||0)>GATEWAY_BODY_LIMIT||!request.body)throw new Error('INVALID_TELEMATICS_INPUT');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
  if(size>GATEWAY_BODY_LIMIT)throw new Error('INVALID_TELEMATICS_INPUT');chunks.push(next.value);}
 }finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
export async function POST(request:Request){
 try{
  const body=await boundedBody(request),auth=authenticateGateway(request.headers,body,loadGatewayConfigurations());
  await authorizeGatewayRequest(auth);
  const parsed=envelope.parse(JSON.parse(body));let data:unknown;
  if(parsed.action==='POSITION'){
   const outcomes=[];for(const position of parsed.positions){
    try{outcomes.push({ok:true,result:await ingestGatewayPosition(auth.digest,position)});}
    catch(error){const code=error instanceof Error?error.message:'TELEMATICS_UNAVAILABLE';
     outcomes.push({ok:false,code:['TELEMETRY_BINDING_DENIED','TELEMETRY_TIME_INVALID','TELEMETRY_EVENT_CONFLICT','DEVICE_OWNER_INVALID','INVALID_TELEMATICS_INPUT'].includes(code)?code:'TELEMATICS_UNAVAILABLE'});}
   }data=outcomes;
  }else if(parsed.action==='CLAIM_COMMANDS')data=await claimGatewayCommands(auth.digest);
  else if(parsed.action==='PRUNE')data=await pruneGatewayHistory(auth.digest);
  else{const outcomes=[];for(const item of parsed.results)outcomes.push(await recordGatewayCommandResult(auth.digest,item));data=outcomes;}
  return Response.json({ok:true,data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const invalid=error instanceof z.ZodError||error instanceof SyntaxError||error instanceof Error&&error.message==='INVALID_TELEMATICS_INPUT';
  return Response.json({ok:false,code:invalid?'INVALID_TELEMATICS_INPUT':'GATEWAY_UNAVAILABLE'},{status:invalid?400:401,headers:{'Cache-Control':'no-store'}});
 }
}
