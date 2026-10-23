export interface FleetDriverBadge {
 type:string;verified:boolean;expired:boolean;reviewedAt:string|null;expiresOn:string|null;
 vehicleId?:string;vehicleLabel?:string;
}
/** Same private projection as a Fleet row; it never contains proof or Storage paths. */
export interface FleetDriverDetail {
 id:string;name:string;phone:string|null;email:string|null;is_owner:boolean;
 can_manage_capacity:boolean;can_manage_tracking:boolean;
 assigned_vehicle_id:string|null;assigned_vehicles:string|null;
 verification_badges:FleetDriverBadge[];truck_verification_badges:FleetDriverBadge[];
}
