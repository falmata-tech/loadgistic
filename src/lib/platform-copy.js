// Shared app-owned copy. Do not translate transporter records or recipient names.
export const capacityIntroduction = Object.freeze({
  title: 'Find space for your next load',
  body: 'Keep your transporters close. See the space and routes they report, or find new options in the public market.',
});

export const signupBenefits = Object.freeze({
  business: [
    'Search space for today’s load by route and vehicle type.',
    'Build a private map from transporters who share with your team.',
    'Keep staff in step on shared capacity and agreed shipments.',
  ],
  provider: [
    'One vehicle is enough—even one you drive with the owner’s permission.',
    'Show available space and routes to the customers you choose.',
    'Manage vehicles and drivers; add compatible GPS with our help.',
  ],
});

export const platformAbout = Object.freeze({
  title: 'Put your transport network to work.',
  body: 'One vehicle or a growing fleet, make your available space easier to find. Brokers and shippers can bring the transporters they trust into one working network.',
  audiences: [
    {id:'shipping',label:'Brokers & shippers',heading:'Find room for the next load.',facts:[
      ['Search the market', 'Filter public Capacity by vehicle type, route and current load. Contact the provider to confirm the job.'],
      ['Keep trusted transporters close', 'When a provider shares with your business, your team sees its available space and approximate location on one private map.'],
      ['Follow agreed work', 'Once Tracking is shared, authorized staff can follow shipment steps and view loading and unloading proof.'],
    ],action:'Find capacity',href:'/'},
    {id:'individual',label:'Drivers & owners',heading:'Make one vehicle count.',facts:[
      ['Start with the vehicle you run', 'Own it or manage it with the owner’s permission: post its open space, preferred routes and approximate location.'],
      ['Choose who sees it', 'Share with selected customers, show it on the public map, or do both.'],
      ['Show what is verified', 'Submit documents for review so customers can distinguish checked facts from information you entered yourself.'],
    ],action:'Transporter login',href:'/login'},
    {id:'company',label:'Transport companies',heading:'Keep the whole fleet in view.',facts:[
      ['Run the fleet in one place', 'Manage vehicle and driver assignments, capacity and location sources in one workspace.'],
      ['Add GPS on your terms', 'Ask us to connect a compatible tracker, then assign it to a vehicle. Manual and phone locations remain available.'],
      ['Give customers a clear view', 'Choose which vehicles each connected customer can see, and share Tracking after the work is agreed.'],
    ],action:'Transporter login',href:'/login'},
  ],
});
