import test from 'node:test';
import assert from 'node:assert/strict';
import {
 activeSiteDestination,accountHref,memberDestinations,phonePrimaryDestinations,publicDestinations,visitorDestinations
} from '../src/components/site-navigation.ts';

const provider={id:'owner',role:'TRANSPORTER',name:'Provider',canManageFleet:true,drivesTruck:true};
const driver={id:'driver',role:'DRIVER',name:'Driver',canManageFleet:false,drivesTruck:true};

test('one public shell gains account destinations after sign-in',()=>{
 assert.deepEqual(visitorDestinations.map(item=>[item.label,item.href]),[
  ['Capacity','/'],['Track','/track'],['Featured','/featured'],['About','/about']
 ]);
 assert.deepEqual(publicDestinations.map(item=>item.href),['/','/featured']);
 assert.deepEqual(memberDestinations(null),[]);
 assert.deepEqual(memberDestinations(provider).map(item=>item.href),[
  '/app/home','/app/network','/app/provider-shipments','/app/support','/app/more'
 ]);
 assert.deepEqual(memberDestinations(provider).map(item=>item.label),['Home','Network','Tracking','Support','Account']);
 assert.deepEqual(phonePrimaryDestinations(provider).map(item=>item.label),['Home','Network','Tracking']);
 assert.deepEqual(phonePrimaryDestinations(null).map(item=>item.label),['Capacity','Track','Featured','About']);
 assert.equal(memberDestinations(driver).some(item=>item.href==='/app/fleet'),false);
 assert.equal(memberDestinations(driver).some(item=>item.href==='/app/home'),true);
 assert.equal(accountHref(null),'/login');
 assert.equal(accountHref(provider),'/app/more');
});

test('shipper and broker teams reach their network and permitted tracking',()=>{
 const user={id:'shipper',role:'CUSTOMER',name:'Shipper',trackingAllowed:true};
 assert.deepEqual(phonePrimaryDestinations(user).map(item=>item.href),['/','/app/network','/app/business/tracking']);
 assert.deepEqual(memberDestinations(user).map(item=>item.href),[
  '/app/network','/app/business/tracking','/app/business/account'
 ]);
 assert.deepEqual(publicDestinations.map(item=>item.href),['/','/featured']);
 assert.equal(activeSiteDestination('/app/shared-capacity',user),'capacity');
 assert.equal(activeSiteDestination('/app/business/tracking',user),'my-tracking');
 assert.equal(accountHref(user),'/app/business/account');
});

test('platform navigation follows actual grants without retired brokerage routes',()=>{
 const admin={id:'admin',role:'ADMIN',name:'Administrator'};
 const support={id:'support',role:'SUPPORT',name:'Support',canManageSupport:true,canManageOperations:true};
 const denied={id:'support-denied',role:'SUPPORT',name:'Support'};
 assert.equal(activeSiteDestination('/admin/support',admin),'support');
 assert.equal(activeSiteDestination('/support',support),'support');
 assert.equal(memberDestinations(support).some(item=>item.href==='/admin/operations'),true);
 assert.equal(memberDestinations(denied).some(item=>item.href==='/admin/operations'),false);
 for(const user of [admin,support,denied]){
  const hrefs=memberDestinations(user).map(item=>item.href);
  assert.equal(hrefs.some(href=>href.startsWith('/brokerage')||href.startsWith('/admin/capacity-network')),false);
 }
});

test('capacity and provider details keep predictable return destinations',()=>{
 assert.equal(activeSiteDestination('/',provider),'capacity');
 assert.equal(activeSiteDestination('/providers/example',provider),'capacity');
 assert.equal(activeSiteDestination('/@example',null),'capacity');
 assert.equal(activeSiteDestination('/featured',null),'featured');
 assert.equal(activeSiteDestination('/app/network',provider),'directory');
 assert.equal(activeSiteDestination('/app/home/market',provider),'my-work');
 assert.equal(activeSiteDestination('/app/home/vehicles',provider),'my-work');
});
