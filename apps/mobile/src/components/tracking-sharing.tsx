import {TrackingShipmentLinks} from './tracking-session-manager';
import {TrackingTeamAccess} from './tracking-team-access';
export function TrackingSharing({shipmentId,workspaceId}:{shipmentId:string;workspaceId?:string}){
 return <><TrackingShipmentLinks shipmentId={shipmentId} workspaceId={workspaceId}/>{workspaceId&&<TrackingTeamAccess shipmentId={shipmentId} workspaceId={workspaceId}/>}</>;
}
