export const VEHICLE_CONFIGURATIONS = [
  { name: 'Cargo van', image: '/vehicle-configurations/cargo-van.jpg' },
  { name: 'Pickup truck', image: '/vehicle-configurations/pickup-truck.jpg' },
  { name: 'Pickup stake body', image: '/vehicle-configurations/pickup-stake-body.jpg' },
  { name: 'Mini Open Body Truck', image: '/vehicle-configurations/mini-open-body-truck.jpg' },
  { name: 'Mini Stake Body Truck', image: '/vehicle-configurations/mini-stake-body-truck.jpg' },
  { name: 'Mini Box Truck', image: '/vehicle-configurations/mini-box-truck.jpg' },
  { name: 'Light Stake Body Truck', image: '/vehicle-configurations/light-stake-body-truck.jpg' },
  { name: 'Light Box Truck', image: '/vehicle-configurations/light-box-truck.jpg' },
  { name: 'Medium Stake Body Truck', image: '/vehicle-configurations/medium-stake-body-truck.jpg' },
  { name: 'Medium Box Truck', image: '/vehicle-configurations/medium-box-truck.jpg' },
  { name: 'Heavy Rigid Stake Body Truck', image: '/vehicle-configurations/heavy-rigid-stake-body-truck.jpg' },
  { name: 'Heavy Rigid Stake Body Truck + Trailer', image: '/vehicle-configurations/heavy-rigid-stake-body-truck-trailer.jpg' }
] as const;

export function vehicleConfigurationImage(name?: string | null) {
  return VEHICLE_CONFIGURATIONS.find((configuration) => configuration.name === name)?.image
    || '/vehicle-configurations/medium-box-truck.jpg';
}
