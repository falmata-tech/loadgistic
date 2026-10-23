// Shared app-owned copy. Do not translate transporter records or recipient names.
export const capacityIntroduction = Object.freeze({
  title: 'Find space for your next load',
  body: 'Keep your transporters close. See the space and routes they report, or find new options in the public market.',
});

export const platformAbout = Object.freeze({
  title: 'Put your transport network to work.',
  body: 'See the vehicles you work with and find space for your next load.',
  audiences: [
    {id:'shipping',label:'Brokers & shippers',heading:'Your regular vehicles, in one view.',facts:[
      ['The vehicles you know', 'Ask transporters to share with your email. Verify it to see their space, routes and approximate locations together.'],
      ['More options for your load', 'Need another vehicle? Filter public capacity, then contact the transporter to confirm the job.'],
      ['Stay informed', 'For agreed shipments, follow private progress updates and loading and unloading photos.'],
    ],action:'Find capacity',href:'/'},
    {id:'individual',label:'Drivers & owners',heading:'Make your next load easier to find.',facts:[
      ['Show your available space', 'Keep your current vehicle, routes and approximate location up to date.'],
      ['Choose who sees it', 'Share with your contacts, open to the public, do both or choose one recipient.'],
      ['Build confidence', 'Submit your documents for review so customers can see what Loadgistic has checked.'],
    ],action:'Transporter login',href:'/login'},
    {id:'company',label:'Transport companies',heading:'Keep your fleet visible to your customers.',facts:[
      ['Manage vehicles and drivers', 'Keep assignments and available space together in your workspace.'],
      ['Work with your regular contacts', 'Choose which vehicles each broker or customer can see on their private map.'],
      ['Keep customers informed', 'Share private shipment updates, approximate location and proof photos once the work is agreed.'],
    ],action:'Transporter login',href:'/login'},
  ],
});
