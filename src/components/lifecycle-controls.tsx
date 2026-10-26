import {DatePicker} from '@/components/date-picker';

import {Text,Localized} from '@/components/localization';
import {EthiopiaPlaceInput} from './ethiopia-place-input';
import {WorkspaceTaskDialog} from './workspace-task-dialog';
import {ArrowLeftRight, Pencil, XCircle} from 'lucide-react';
import trackingStyles from './tracking-record.module.css';
export function VehicleLifecycleControl({id,retired=false}:{id:string;retired?:boolean}){
 const action=retired?'RESTORE':'RETIRE';const label=retired?'Restore vehicle':'Retire vehicle';
 return <WorkspaceTaskDialog title={label} triggerLabel={label} variant={retired?'default':'danger'}><form className="stack" action={`/api/fleet/vehicles/${id}/lifecycle`} method="post">
  <input type="hidden" name="action" value={action}/>
  <p>{retired?<Text message="Restored vehicles return to Draft. Assign a driver, then choose Go live."/>:<Text message="Retirement removes this vehicle from discovery and ends its current Driver assignment. Resolve active Tracking first; history stays available."/>}</p>
  <label><Text message="Reason"/><textarea name="reason" minLength={5} maxLength={500} required/></label>
  <label className="checkbox-control"><input type="checkbox" name="confirm" value={action} required/><Text message="I confirm this vehicle should be "/>{retired?<Text message="restored"/>:<Text message="retired"/>}.</label>
  <button className={`button ${retired?'secondary':'danger'}`}><Text message={label}/></button>
 </form></WorkspaceTaskDialog>;
}
export function TrackingRecoveryControls({context,returnTo,allowOperationsDateEdit=false}:{context:any;returnTo?:string;allowOperationsDateEdit?:boolean}){
 if(!context?.actions?.length)return null;
 const shared=<>{returnTo?<input type="hidden" name="returnTo" value={returnTo}/>:null}<input type="hidden" name="revision" value={context.revision}/><label><Text message="Reason"/><textarea name="reason" minLength={5} maxLength={500} required/></label></>;
 const action=`/api/provider-shipments/${context.id}/recovery`;const routeEditable=['CREATED','TO_PICKUP'].includes(context.status);
 const candidates=(Array.isArray(context.vehicles)?context.vehicles:[]).filter((vehicle:{id:string})=>vehicle.id!==context.assigned_vehicle_id);
 // The context is capped at 100 vehicles. A full page may have another eligible
 // vehicle beyond it, so keep the typed-number fallback in that case.
 const canReassign=candidates.length>0||(Array.isArray(context.vehicles)&&context.vehicles.length>=100);
 if(!context.actions.some((name:string)=>name==='CORRECT'||name==='CANCEL'||name==='REASSIGN'&&canReassign))return null;
 return <Localized as="section" copy={["aria-label"]} className={`tracking-management-actions ${trackingStyles.actions}`} aria-label="Tracking recovery">
 {context.actions.includes('CORRECT')?<WorkspaceTaskDialog title="Correct Tracking details" triggerLabel="Edit details" icon={<Pencil aria-hidden="true"/>}><form className="stack" action={action} method="post"><input type="hidden" name="action" value="CORRECT"/>
  <label><Text message="Cargo summary"/><textarea name="cargo_summary" defaultValue={context.cargo_summary} minLength={3} maxLength={500} required/></label>
  {routeEditable?<><label htmlFor="recovery-origin"><Text message="Pickup place"/></label><EthiopiaPlaceInput id="recovery-origin" defaultValue={context.origin} defaultPlaceRef={context.origin_place_ref} placeRefName="origin_place_ref" required/>
   <label htmlFor="recovery-passing"><Text message="Passing through city"/></label><EthiopiaPlaceInput id="recovery-passing" defaultValue={context.passing||''} defaultPlaceRef={context.passing_place_ref||''} placeRefName="passing_place_ref" required={Boolean(context.passing_place_ref)}/>
   <label htmlFor="recovery-destination"><Text message="Destination"/></label><EthiopiaPlaceInput id="recovery-destination" defaultValue={context.destination} defaultPlaceRef={context.destination_place_ref} placeRefName="destination_place_ref" required/></>:<><input type="hidden" name="origin_place_ref" value={context.origin_place_ref}/><input type="hidden" name="passing_place_ref" value={context.passing_place_ref||''}/><input type="hidden" name="destination_place_ref" value={context.destination_place_ref}/><p className="meta"><strong><Text message="Route"/>:</strong> {[context.origin,context.passing,context.destination].filter(Boolean).join(' → ')}</p></>}
  <label><Text message="Expected pickup"/><DatePicker  name="expected_pickup_date" defaultValue={context.expected_pickup_date||''}/></label>
  {routeEditable||allowOperationsDateEdit?<label><Text message="Expected delivery"/><DatePicker name="expected_delivery_date" defaultValue={context.expected_delivery_date||''}/></label>:<><input type="hidden" name="expected_delivery_date" value={context.expected_delivery_date||''}/><p className="meta"><strong><Text message="Expected delivery"/>:</strong> {context.expected_delivery_date?new Date(`${context.expected_delivery_date}T12:00:00`).toLocaleDateString():<Text message="Not set"/>}</p></>}
  {shared}<button className="button"><Text message="Save correction"/></button></form></WorkspaceTaskDialog>:null}
 {context.actions.includes('REASSIGN')&&canReassign?<WorkspaceTaskDialog title="Reassign Tracking" triggerLabel="Change vehicle" icon={<ArrowLeftRight aria-hidden="true"/>}><form className="stack" action={action} method="post"><input type="hidden" name="action" value="REASSIGN"/>
  <p><Text message="The new Driver takes over. A fresh location update is needed."/></p>
  <label><Text message="Replacement vehicle number"/><input name="vehicle_id" list={`recovery-trucks-${context.id}`} maxLength={50} required/></label><datalist id={`recovery-trucks-${context.id}`}>{candidates.map((vehicle:any)=><option key={vehicle.id} value={vehicle.platform_number}>{vehicle.make} {vehicle.model}</option>)}</datalist>
  {shared}<button className="button"><Text message="Save reassignment"/></button></form></WorkspaceTaskDialog>:null}
 {context.actions.includes('CANCEL')?<WorkspaceTaskDialog title="Cancel Tracking" triggerLabel="Cancel Tracking" variant="danger" icon={<XCircle aria-hidden="true"/>}><form className="stack" action={action} method="post"><input type="hidden" name="action" value="CANCEL"/>
  <p><Text message="Cancellation ends guest access and keeps provider history. This action cannot be undone here."/></p>{shared}
  <label className="checkbox-control"><input type="checkbox" name="confirm" value="CANCEL" required/><Text message="I confirm this Tracking should be cancelled."/></label>
  <button className="button danger"><Text message="Cancel Tracking"/></button></form></WorkspaceTaskDialog>:null}
 </Localized>;
}
