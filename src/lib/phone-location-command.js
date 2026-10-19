import {createHash} from 'node:crypto';
/** Server-only serialization: the installation secret is never persisted. */
export function phoneLocationCommand(value){
 if(!value)return undefined;
 return {installation_id:value.installationId,secret_digest:createHash('sha256').update(value.secret).digest('hex'),binding_id:value.bindingId,revision:value.revision,report_id:value.reportId,observed_at:new Date(value.observedAt).toISOString(),accuracy_m:value.accuracyMeters??null,speed_kph:value.speedKph??null,heading_deg:value.headingDegrees??null};
}
