
import {Text,Localized} from '@/components/localization';
import {EthiopiaPlaceInput} from './ethiopia-place-input';
export function VehicleLifecycleControl({id,retired=false}:{id:string;retired?:boolean}){
 const action=retired?'RESTORE':'RETIRE';const label=retired?'Restore truck':'Retire truck';
 return <details className="card"><summary>{label}</summary><form className="stack" action={`/api/fleet/vehicles/${id}/lifecycle`} method="post">
  <input type="hidden" name="action" value={action}/>
  <p>{retired?<Text message="The truck returns Off Duty. Assign its Driver again before publishing new capacity."/>:<Text message="Retirement removes this truck from discovery and ends its current Driver assignment. Resolve active Tracking first; history stays available."/>}</p>
  <label><Text message="Reason"/><textarea name="reason" minLength={5} maxLength={500} required/></label>
  <label><input type="checkbox" name="confirm" value={action} required/><Text message="I confirm this truck should be "/>{retired?<Text message="restored"/>:<Text message="retired"/>}.</label>
  <button className={`button ${retired?'secondary':'danger'}`}>{label}</button>
 </form></details>;
}
export function TrackingRecoveryControls({context}:{context:any}){
 if(!context?.actions?.length)return null;
 const shared=<><input type="hidden" name="revision" value={context.revision}/><label><Text message="Reason"/><textarea name="reason" minLength={5} maxLength={500} required/></label></>;
 const action=`/api/provider-shipments/${context.id}/recovery`;const routeEditable=['CREATED','TO_PICKUP'].includes(context.status);
 return <Localized as="section" copy={["aria-label"]} className="stack" aria-label="Tracking recovery">
 <details className="card"><summary><Text message="Correct Tracking details"/></summary><form className="stack" action={action} method="post"><input type="hidden" name="action" value="CORRECT"/>
  <label><Text message="Cargo summary"/><textarea name="cargo_summary" defaultValue={context.cargo_summary} minLength={3} maxLength={500} required/></label>
  {routeEditable?<><label htmlFor="recovery-origin"><Text message="Pickup place"/></label><EthiopiaPlaceInput id="recovery-origin" defaultValue={context.origin} defaultPlaceRef={context.origin_place_ref} placeRefName="origin_place_ref" required/>
   <label htmlFor="recovery-destination"><Text message="Destination"/></label><EthiopiaPlaceInput id="recovery-destination" defaultValue={context.destination} defaultPlaceRef={context.destination_place_ref} placeRefName="destination_place_ref" required/></>:<><input type="hidden" name="origin_place_ref" value={context.origin_place_ref}/><input type="hidden" name="destination_place_ref" value={context.destination_place_ref}/><p className="meta"><Text message="The route is retained after Loading begins."/></p></>}
  <label><Text message="Expected pickup"/><input type="date" name="expected_pickup_date" defaultValue={context.expected_pickup_date||''}/></label>
  <label><Text message="Expected delivery"/><input type="date" name="expected_delivery_date" defaultValue={context.expected_delivery_date||''}/></label>
  {shared}<button className="button secondary"><Text message="Save correction"/></button></form></details>
 <details className="card"><summary><Text message="Reassign Tracking"/></summary><form className="stack" action={action} method="post"><input type="hidden" name="action" value="REASSIGN"/>
  <p><Text message="The selected truck's currently assigned Driver takes over. Earlier events remain; a new location update is required."/></p>
  <label><Text message="Replacement truck number"/><input name="vehicle_id" list={`recovery-trucks-${context.id}`} defaultValue={context.assigned_vehicle_number} maxLength={50} required/></label><datalist id={`recovery-trucks-${context.id}`}>{context.vehicles.map((vehicle:any)=><option key={vehicle.id} value={vehicle.platform_number}>{vehicle.make} {vehicle.model}</option>)}</datalist><p className="meta"><Text message="Choose a suggestion or enter the truck number from My Fleet. Only an active truck with an eligible Driver can take over."/></p>
  {shared}<button className="button secondary"><Text message="Save reassignment"/></button></form></details>
 <details className="card"><summary><Text message="Cancel Tracking"/></summary><form className="stack" action={action} method="post"><input type="hidden" name="action" value="CANCEL"/>
  <p><Text message="Cancellation ends guest access and keeps provider history. This action cannot be undone here."/></p>{shared}
  <label><input type="checkbox" name="confirm" value="CANCEL" required/><Text message="I confirm this Tracking should be cancelled."/></label>
  <button className="button danger"><Text message="Cancel Tracking"/></button></form></details>
 </Localized>;
}
