// Display capabilities consume an authenticated identity projection. Database
// commands repeat ownership checks; a client flag is never mutation authority.
export function providerWorkspaceCapabilities(user) {
  const active = user?.active === true;
  const providerRole = ['TRANSPORTER', 'DRIVER'].includes(user?.role);
  const legacyOwner = user?.role === 'TRANSPORTER' && Boolean(user.organization_id)
    || user?.role === 'DRIVER' && user?.driver_kind !== 'COMPANY' && Boolean(user?.provider_profile_id);
  const ownsProviderAccount = active && providerRole && (typeof user.owns_provider_account === 'boolean'
    ? user.owns_provider_account : legacyOwner);
  const canManageFleet = ownsProviderAccount && (typeof user.can_manage_fleet === 'boolean' ? user.can_manage_fleet : true);
  const currentDriverId = active && providerRole && typeof user?.current_driver_id === 'string' ? user.current_driver_id : null;
  const currentDrivenVehicleId = currentDriverId && typeof user?.current_driven_vehicle_id === 'string' ? user.current_driven_vehicle_id : null;
  const drivesTruck = active && providerRole && (typeof user?.drives_truck === 'boolean'
    ? user.drives_truck : user?.role === 'DRIVER');
  return { ownsProviderAccount, canManageFleet, currentDriverId, currentDrivenVehicleId, drivesTruck };
}

export function providerHomeTabs({drivesTruck,canManageFleet}) {
  return [
    ...(drivesTruck ? [{id:'capacity',label:'My capacity'}] : []),
    ...(canManageFleet ? [{id:'vehicles',label:'Manage vehicles'}] : []),
    {id:'market',label:'Public capacity'}
  ];
}

export function providerHomeTab(capabilities,requested) {
  const tabs=providerHomeTabs(capabilities);
  return tabs.find(tab=>tab.id===requested)?.id||tabs[0].id;
}
