import {Pencil,Save} from 'lucide-react';
import {VEHICLE_CONFIGURATIONS} from '@/lib/vehicle-configurations';

interface EditableTruck {id:string;make:string|null;model:string|null;plate:string|null;cargo_configuration:string;trailer_interchangeable:boolean}
export function TruckDetailsEditor({vehicle}:{vehicle:EditableTruck}){
  return <details className="card fleet-truck-details-editor">
    <summary><Pencil aria-hidden="true"/>Edit truck details</summary>
    <form action={`/api/fleet/vehicles/${vehicle.id}/details`} method="post" className="form-grid">
      <div className="form-group"><label htmlFor="edit-truck-make">Make</label><input id="edit-truck-make" name="make" defaultValue={vehicle.make||''} required minLength={2} maxLength={60}/></div>
      <div className="form-group"><label htmlFor="edit-truck-model">Model</label><input id="edit-truck-model" name="model" defaultValue={vehicle.model||''} required minLength={1} maxLength={60}/></div>
      <div className="form-group"><label htmlFor="edit-truck-plate">Plate number</label><input id="edit-truck-plate" name="plate" defaultValue={vehicle.plate||''} required minLength={2} maxLength={32}/></div>
      {!vehicle.trailer_interchangeable?<div className="form-group"><label htmlFor="edit-truck-configuration">Cargo configuration</label><select id="edit-truck-configuration" name="cargoConfiguration" defaultValue={vehicle.cargo_configuration} required>
        {VEHICLE_CONFIGURATIONS.filter(item=>!item.name.startsWith('Tractor + ')).map(item=><option key={item.name} value={item.name}>{item.name}</option>)}
      </select></div>:null}
      <button className="button secondary"><Save aria-hidden="true"/>Save truck details</button>
    </form>
  </details>;
}
