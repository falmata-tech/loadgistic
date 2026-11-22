// Shared app-owned copy. Do not translate transporter records or recipient names.
export const capacityIntroduction = Object.freeze({
  title: 'Work better with transporters to serve your customers',
  webDescription: 'Transporters manage their vehicles and drivers. Their updates show which vehicles have room and where they plan to go, so you can plan more cost-effective shipments.',
});

export const signupBenefits = Object.freeze({
  business: [
    'See the capacity your transporters share in your Private Network.',
    'Follow agreed shipments with your team.',
    'Find other transporters in the Open Market.',
  ],
  provider: [
    'Start with one vehicle you own or have permission to operate.',
    'Share available space and routes with customers you choose.',
    'Manage vehicles and drivers. Use phone location or compatible GPS.',
  ],
});

export const platformAbout = Object.freeze({
  title: 'How Loadgistic works',
  body: 'Transporters manage their vehicles and drivers on Loadgistic and choose who can see their capacity. Brokers and shipping teams use those updates to plan freight, then follow shipments once the work is agreed.',
  audiences: [
    {id:'shipping',label:'Brokers & shippers',heading:'Work with your transporters',facts:[
      ['See what partners share', 'When a provider shares a vehicle with your business, authorized teammates can see its available space and approximate location in your Private Network.'],
      ['Follow shipments and share updates', 'Follow shipment progress and any proof shared with your team. Brokers can give customers an expiring tracking link and code.'],
      ['Find available vehicles', 'Search the Open Market by route, vehicle type, or available space. Confirm availability and terms with the provider.'],
    ],action:'Find capacity',href:'/'},
    {id:'individual',label:'Drivers & owners',heading:'Share your vehicle’s availability',facts:[
      ['Publish available space', 'List available space and preferred routes for a vehicle you own or have permission to operate.'],
      ['Choose who can see it', 'Share with your Private Network, publish to the Open Market, or do both.'],
      ['Submit documents for review', 'Document review is optional. Customers can see which checks were completed.'],
    ],action:'Create a provider account',href:'/signup?audience=PROVIDER'},
    {id:'company',label:'Fleet operators',heading:'Manage your fleet and customer access',facts:[
      ['Manage vehicles and drivers', 'Assign drivers, publish vehicle availability, and manage preferred routes from one workspace.'],
      ['Choose a location source', 'Use phone location or ask Loadgistic to help connect a compatible GPS tracker.'],
      ['Share with each customer', 'Choose which vehicles each business sees. Share private tracking once the work is agreed.'],
    ],action:'Create a provider account',href:'/signup?audience=PROVIDER'},
  ],
});
