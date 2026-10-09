
import {Text} from '@/components/localization';
import {Pencil,Save} from 'lucide-react';
import {VEHICLE_CONFIGURATIONS} from '@/lib/vehicle-configurations';

interface EditableTruck {id:string;make:string|null;model:string|null;plate:string|null;cargo_configuration:string;trailer_interchangeable:boolean;use_basis?:string|null}
export function TruckDetailsEditor({vehicle,independent=false}:{vehicle:EditableTruck;independent?:boolean}){
  if(independent)return <details className="card"><summary><Text message="Ownership or permission"/></summary><form action={`/api/fleet/vehicles/${vehicle.id}/details`} method="post" className="stack">
    <input type="hidden" name="make" value={vehicle.make||''}/><input type="hidden" name="model" value={vehicle.model||''}/><input type="hidden" name="plate" value={vehicle.plate||''}/><input type="hidden" name="cargoConfiguration" value={vehicle.cargo_configuration}/>
    <label><Text message="How do you use this truck?"/><select name="useBasis" defaultValue={vehicle.use_basis||''} required><option value="" disabled><Text message="Choose how you use this truck"/></option><option value="OWNED"><Text message="I own this truck"/></option><option value="PERMISSION"><Text message="I rent it or have the owner's permission"/></option></select></label>
    <p className="meta"><Text message="Document review is shown separately."/></p><button className="button secondary"><Save aria-hidden="true"/><Text message="Save"/></button></form></details>;
  return <details className="card fleet-truck-details-editor">
    <summary><Pencil aria-hidden="true"/><Text message="Edit truck details"/></summary>
    <form action={`/api/fleet/vehicles/${vehicle.id}/details`} method="post" className="form-grid">
      <div className="form-group"><label htmlFor="edit-truck-make"><Text message="Make"/></label><input id="edit-truck-make" name="make" defaultValue={vehicle.make||''} required minLength={2} maxLength={60}/></div>
      <div className="form-group"><label htmlFor="edit-truck-model"><Text message="Model"/></label><input id="edit-truck-model" name="model" defaultValue={vehicle.model||''} required minLength={1} maxLength={60}/></div>
      <div className="form-group"><label htmlFor="edit-truck-plate"><Text message="Plate number"/></label><input id="edit-truck-plate" name="plate" defaultValue={vehicle.plate||''} required minLength={2} maxLength={32}/></div>
      {!vehicle.trailer_interchangeable?<div className="form-group"><label htmlFor="edit-truck-configuration"><Text message="Cargo configuration"/></label><select id="edit-truck-configuration" name="cargoConfiguration" defaultValue={vehicle.cargo_configuration} required>
        {VEHICLE_CONFIGURATIONS.filter(item=>!item.name.startsWith('Tractor + ')).map(item=><option key={item.name} value={item.name}>{item.name}</option>)}
      </select></div>:null}
      <button className="button secondary"><Save aria-hidden="true"/><Text message="Save truck details"/></button>
    </form>
  </details>;
}
