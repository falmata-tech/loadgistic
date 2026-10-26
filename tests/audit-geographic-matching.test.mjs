import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityGeographicMatch as match} from '../src/lib/capacity-geographic-match.js';

const place=(lat,lng)=>({center_lat:lat,center_lng:lng,place_label:'Selected place'});
const a=place(9,38),b=place(9.1,38.1),far=place(14,43);
const route=[{lat:9,lng:38},{lat:9.1,lng:38.1}];
const area=[{lat:8.95,lng:37.95},{lat:9.15,lng:37.95},{lat:9.15,lng:38.15},{lat:8.95,lng:38.15}];
const truck={status:'PARTIAL',availability_geometry:'ROUTE',current_route_points:route,recurring_corridors:[]};
const filters={originRadiusKm:5,destinationRadiusKm:5,currentAreaRadiusKm:5,nearLat:'',nearLng:''};

test('private query cannot degrade a failed pair to one matching endpoint or blank proximity',()=>{
  for(const endpoints of [[a,far],[far,b],[far,far]])assert.deepEqual(match(truck,filters,...endpoints),{matched:false,label:null});
  assert.equal(match(truck,filters,a,b).matched,true);
  assert.equal(match(truck,filters,a).matched,true);
  assert.equal(match(truck,filters,null,b).matched,true);
  assert.deepEqual(match(truck,filters),{matched:true,label:null});
});

test('shipment endpoints and independent area filter are conjunctive',()=>{
  const empty={...truck,status:'EMPTY',recurring_corridors:[{geometry:'RADIUS',area_boundary:area}]};
  assert.equal(match(empty,filters,a,b,a).matched,true);
  assert.equal(match(empty,filters,a,b,far).matched,false);
  assert.equal(match(empty,filters,far,b,a).matched,false);
  assert.equal(match(truck,filters,a,b,a).matched,true);
  assert.equal(match(empty,{...filters,geometry:'ROUTE'},a,b,a).matched,true);
});

test('direction, every route segment, and Partial area evidence are retained',()=>{
  assert.equal(match(truck,filters,b,a).matched,false);
  assert.equal(match(truck,{...filters,directionMode:'EITHER'},b,a).matched,true);
  const regular={...truck,current_route_points:[],recurring_corridors:[{geometry:'ROUTE',route_points:route}]};
  assert.equal(match(regular,filters,b,a).matched,true);
  const multi={...truck,current_route_points:[{lat:8,lng:37},...route,{lat:10,lng:39}]};
  assert.equal(match(multi,filters,a,b).matched,true);
  const areaTruck={status:'EMPTY',availability_geometry:'RADIUS',capacity_area_boundary:area};
  assert.equal(match(areaTruck,filters,a,b).matched,true);
  assert.equal(match({...areaTruck,status:'PARTIAL'},filters,a,b).matched,true);
  assert.equal(match({...truck,recurring_corridors:[{geometry:'RADIUS',area_boundary:area}]},filters,a,b).matched,true);
  assert.equal(match({...truck,recurring_corridors:[{geometry:'RADIUS',area_boundary:area}]},filters,a,far).matched,false);
});

test('current and Preferred offers match independently without splitting two endpoints',()=>{
  const distantArea=[{lat:11.95,lng:40.95},{lat:12.15,lng:40.95},{lat:12.15,lng:41.15},{lat:11.95,lng:41.15}];
  const item={...truck,recurring_corridors:[{geometry:'RADIUS',area_boundary:distantArea}]};
  const nearPreferred=place(12,41);
  assert.equal(match(item,filters,a,b).matched,true);
  assert.equal(match(item,filters,nearPreferred,nearPreferred).matched,true);
  assert.equal(match(item,filters,a,nearPreferred).matched,false);
});

const areaQueryRoute=[{lat:9,lng:38},{lat:9,lng:39},{lat:10,lng:39}];
const distantArea=[{lat:11.95,lng:40.95},{lat:12.15,lng:40.95},{lat:12.15,lng:41.15},{lat:11.95,lng:41.15}];
const areaQueryItem=(status,source)=>source==='current'
  ? {status,availability_geometry:'ROUTE',current_signal_geometry_visible:true,current_route_points:areaQueryRoute,capacity_area_boundary:[],recurring_corridors:[]}
  : {status,availability_geometry:'RADIUS',current_signal_geometry_visible:true,current_route_points:[],capacity_area_boundary:distantArea,recurring_corridors:[{geometry:'ROUTE',route_points:areaQueryRoute}]};
const areaQueryPlaces=[
  ['endpoint',place(9,38)],
  ['near endpoint',place(8.97,37.98)],
  ['first segment interior',place(9,38.5)],
  ['later segment interior',place(9.5,39)],
  ['near segment',place(9.03,38.5)]
];

for(const status of ['EMPTY','PARTIAL'])for(const source of ['current','Preferred']){
  for(const [position,queryPlace] of areaQueryPlaces){
    test(`Area query matches ${status} ${source} Route ${position} using the single-endpoint radius`,()=>{
      const item=areaQueryItem(status,source);
      const result=match(item,filters,null,null,queryPlace);
      assert.equal(result.matched,true);
      assert.equal(result.label,match(item,filters,queryPlace).label);
      assert.match(result.label,source==='current'?/^Current capacity route passes within /:/^Preferred corridor passes within /);
    });
  }
  test(`Area query excludes ${status} ${source} Route outside the chosen radius`,()=>{
    const item=areaQueryItem(status,source),outside=place(9.06,38.5);
    assert.deepEqual(match(item,filters,null,null,outside),{matched:false,label:null});
    assert.equal(match(item,{...filters,currentAreaRadiusKm:10},null,null,outside).matched,true);
  });
}

test('Area query cannot expose hidden current Route but can match a visible Preferred Route',()=>{
  const hidden={...areaQueryItem('PARTIAL','current'),current_signal_geometry_visible:false};
  assert.deepEqual(match(hidden,filters,null,null,place(9,38)),{matched:false,label:null});
  const preferred={...hidden,recurring_corridors:[{geometry:'ROUTE',route_points:[{lat:12,lng:41},{lat:12,lng:42}]}]};
  assert.deepEqual(match(preferred,filters,null,null,place(9,38)),{matched:false,label:null});
  assert.equal(match(preferred,filters,null,null,place(12,41.5)).matched,true);
});

test('Area query retains explicit legacy geometry constraints on current and Preferred offers',()=>{
  for(const source of ['current','Preferred']){
    const item=areaQueryItem('PARTIAL',source);
    assert.equal(match(item,{...filters,geometry:'ROUTE'},null,null,place(9,38.5)).matched,true);
    assert.deepEqual(match(item,{...filters,geometry:'RADIUS'},null,null,place(9,38.5)),{matched:false,label:null});
  }
  const areaOnly={status:'PARTIAL',availability_geometry:'RADIUS',current_signal_geometry_visible:true,capacity_area_boundary:area,recurring_corridors:[]};
  assert.equal(match(areaOnly,{...filters,geometry:'RADIUS'},null,null,a).matched,true);
  assert.deepEqual(match(areaOnly,{...filters,geometry:'ROUTE'},null,null,a),{matched:false,label:null});
});

test('a matching Area query cannot rescue paired endpoints split across current and Preferred routes',()=>{
  const item={...areaQueryItem('EMPTY','current'),recurring_corridors:[{geometry:'ROUTE',route_points:[{lat:12,lng:41},{lat:12,lng:42}]}]};
  const nearCurrent=place(9,38),nearPreferred=place(12,41);
  assert.equal(match(item,filters,null,null,nearCurrent).matched,true);
  assert.equal(match(item,filters,null,null,nearPreferred).matched,true);
  assert.deepEqual(match(item,filters,nearCurrent,nearPreferred,nearCurrent),{matched:false,label:null});
  assert.deepEqual(match(item,filters,nearCurrent,nearPreferred,nearPreferred),{matched:false,label:null});
});
