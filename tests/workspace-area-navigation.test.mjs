import test from 'node:test';
import assert from 'node:assert/strict';
import {areaReturnPath,areaCamera} from '../src/lib/workspace-area-navigation.js';
test('area returns preserve eligible destinations and combined discovery filters',()=>{
 for(const url of ['/?q=Adama&status=EMPTY&loadType=FTL&ownerDocs=IDENTITY&originRadiusKm=25','/featured','/track','/shared-capacity?view=private'])assert.equal(areaReturnPath(url,'marketplace'),url);
 for(const url of ['/app/home','/app/fleet/uuid-example','/app/provider-shipments/uuid-example','/app/more?paymentPage=2','/app/network'])assert.equal(areaReturnPath(url,'workspace'),url);
});
test('current capacity filters survive area returns together, including multiple location sources',()=>{
 const filters=new URLSearchParams({
  status:'EMPTY,PARTIAL',vehicleCategory:'Courier car,Cargo van',locationSource:'GPS,MOBILE',
  stopOption:'MULTI_PICK,MULTI_DROP',freshness:'FRESH',ownerDocs:'IDENTITY',
  driverDocs:'DRIVER_IDENTITY',truckDocs:'VEHICLE_OWNERSHIP',
  origin:'Adama',originPlaceRef:'place:origin',originRadiusKm:'25',
  destination:'Awash',destinationPlaceRef:'place:destination',destinationRadiusKm:'50',
  directionMode:'EITHER',truckCity:'Addis Ababa',truckCityPlaceRef:'place:city',
  truckLocationRadiusKm:'50',provider:'chosen-provider',truck:'selected-capacity'
 });
 for(const [area,path]of [['marketplace','/'],['marketplace','/shared-capacity'],['workspace','/app/business/capacity']]){
  const target=`${path}?${filters}`;
  assert.equal(areaReturnPath(target,area),target);
  for(const key of ['token','email','unknownFilter'])assert.equal(areaReturnPath(`${target}&${key}=private`,area),null);
  const oversized=new URLSearchParams(filters);oversized.set('locationSource','a'.repeat(501));
  assert.equal(areaReturnPath(`${path}?${oversized}`,area),null);
 }
});
test('return bookmarks cannot become open redirects or carry private credentials',()=>{
 for(const area of ['marketplace','workspace'])for(const url of ['https://evil.test','//evil.test','/\\evil.test','/app/home\n','/admin','/api/capacity','/track?token=secret','/?email=person@example.test','/?code=123456','/?returnTo=https://evil.test','/app/home?error=private-note','/app/home#secret','/%2f%2fevil.test'])assert.equal(areaReturnPath(url,area),null,url);
 assert.equal(areaReturnPath('/app/home','marketplace'),null);assert.equal(areaReturnPath('/','workspace'),null);
 assert.equal(areaReturnPath('/?q='+ 'a'.repeat(501),'marketplace'),null);
});
test('public camera stores only validated bounded presentation numbers',()=>{
 assert.deepEqual(areaCamera({lat:41,lng:-87,zoom:10,payload:['private']}),{lat:41,lng:-87,zoom:10});
 assert.deepEqual(areaCamera({lat:0,lng:0,zoom:2}),{lat:0,lng:0,zoom:2});
 for(const value of [null,{}, {lat:NaN,lng:0,zoom:4},{lat:86,lng:0,zoom:4},{lat:0,lng:181,zoom:4},{lat:0,lng:0,zoom:16},{lat:'0',lng:0,zoom:4}])assert.equal(areaCamera(value),null);
});
