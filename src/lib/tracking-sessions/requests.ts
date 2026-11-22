import {z} from 'zod';
import {trackingSessionId as id} from './contracts';

const revision=z.number().int().nonnegative();
export const requestCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('INBOX')}).strict(),
 z.object({action:z.literal('SEARCH'),sessionId:id,query:z.string().trim().max(100)}).strict(),
 z.object({action:z.literal('SELECT'),sessionId:id,revision,vehicleId:id,driverId:id}).strict(),
 z.object({action:z.enum(['WITHDRAW','DECLINE']),sessionId:id,revision}).strict(),
 z.object({action:z.literal('ACCEPT'),sessionId:id,revision,trackingMode:z.enum(['STATUS_ONLY','LOCATION_AND_STATUS'])}).strict()
]);
export type RequestCommand=z.infer<typeof requestCommand>;
export const targetResult=z.object({revision,selected:z.string().nullable(),status:z.enum(['NOT_REQUESTED','REQUESTED','DECLINED','WITHDRAWN','EXPIRED']).optional(),items:z.array(z.object({
 vehicleId:id,driverId:id,label:z.string(),connected:z.boolean()
})).max(25)});
export const incomingResult=z.array(z.object({
 id,revision,reference:z.string(),cargo:z.string(),broker:z.string(),vehicle:z.string(),
 route:z.array(z.object({label:z.string()})).min(2).max(3),pickupDate:z.string().nullable(),deliveryDate:z.string().nullable()
})).max(50);
export const acceptedResult=z.object({shipmentId:id});

export const requestStatusMessages={
 NOT_REQUESTED:'',
 REQUESTED:'',
 DECLINED:'The provider declined the request.',
 WITHDRAWN:'You withdrew the request.',
 EXPIRED:'This tracking request has expired.',
} as const;
