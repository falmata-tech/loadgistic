
import {Text} from '@/components/localization';
import {Pencil,Save} from 'lucide-react';
import {VEHICLE_CONFIGURATIONS} from '@/lib/vehicle-configurations';
import {WorkspaceTaskDialog} from './workspace-task-dialog';

interface EditableTruck {id:string;make:string|null;model:string|null;plate:string|null;cargo_configuration:string;trailer_interchangeable:boolean;use_basis?:string|null}
export function TruckDetailsEditor({vehicle}:{vehicle:EditableTruck}){
  return <WorkspaceTaskDialog title="Edit vehicle details" triggerLabel="Edit vehicle details" icon={<Pencil aria-hidden="true"/>}>
    <form action={`/api/fleet/vehicles/${vehicle.id}/details`} method="post" className="form-grid">
      <div className="form-group"><label htmlFor="edit-truck-make"><Text message="Make"/></label><input id="edit-truck-make" name="make" defaultValue={vehicle.make||''} required minLength={2} maxLength={60}/></div>
      <div className="form-group"><label htmlFor="edit-truck-model"><Text message="Model"/></label><input id="edit-truck-model" name="model" defaultValue={vehicle.model||''} required minLength={1} maxLength={60}/></div>
      <div className="form-group"><label htmlFor="edit-truck-plate"><Text message="Plate number"/></label><input id="edit-truck-plate" name="plate" defaultValue={vehicle.plate||''} required minLength={2} maxLength={32}/></div>
      <div className="form-group full"><label htmlFor="edit-truck-use"><Text message="How do you use this vehicle?"/></label><select id="edit-truck-use" name="useBasis" defaultValue={vehicle.use_basis||''} required><option value="" disabled><Text message="Choose how you use this vehicle"/></option><option value="OWNED"><Text message="I own this vehicle"/></option><option value="FINANCED"><Text message="I am buying this vehicle through financing"/></option><option value="PERMISSION"><Text message="I rent it or have permission to use it"/></option></select><small><Text message="Document review is shown separately."/></small></div>
      {!vehicle.trailer_interchangeable?<div className="form-group"><label htmlFor="edit-truck-configuration"><Text message="Cargo configuration"/></label><select id="edit-truck-configuration" name="cargoConfiguration" defaultValue={vehicle.cargo_configuration} required>
        {VEHICLE_CONFIGURATIONS.filter(item=>!item.name.startsWith('Tractor + ')).map(item=><option key={item.name} value={item.name}><Text message={item.name}/></option>)}
      </select></div>:null}
      <button className="button secondary"><Save aria-hidden="true"/><Text message="Save vehicle details"/></button>
    </form>
  </WorkspaceTaskDialog>;
}
