-- Replace synthetic route geometry with concise, location-aligned Ethiopian
-- road examples. All affected provider/capacity rows are pre-customer fixtures.

create temp table _demo_places(
  code text primary key,place_ref text not null,name text not null,lat double precision not null,lng double precision not null,is_base boolean not null default false
) on commit drop;

insert into _demo_places(code,place_ref,name,lat,lng,is_base) values
  ('addis','builtin:addis ababa','Addis Ababa',9.03,38.74,true),('bishoftu','builtin:bishoftu','Bishoftu',8.75,38.99,false),('mojo','builtin:mojo','Mojo',8.59,39.12,false),('adama','builtin:adama','Adama',8.54,39.27,true),
  ('awash','builtin:awash','Awash',8.98,40.17,false),('mieso','builtin:mieso','Mieso',9.24,40.75,false),('dire_dawa','builtin:dire dawa','Dire Dawa',9.60,41.85,true),('harar','builtin:harar','Harar',9.31,42.13,true),('jigjiga','builtin:jigjiga','Jigjiga',9.35,42.80,true),
  ('debre_birhan','builtin:debre birhan','Debre Birhan',9.68,39.53,false),('kombolcha','builtin:kombolcha','Kombolcha',11.08,39.74,false),('dessie','builtin:dessie','Dessie',11.13,39.63,false),('woldiya','builtin:woldiya','Woldiya',11.83,39.60,false),
  ('bati','builtin:bati','Bati',11.18,40.02,false),('mille','builtin:mille','Mille',11.42,40.77,false),('semera','builtin:semera','Semera',11.79,41.01,true),('alamata','builtin:alamata','Alamata',12.42,39.56,false),('mekelle','builtin:mekelle','Mekelle',13.50,39.47,true),('adigrat','builtin:adigrat','Adigrat',14.28,39.46,false),
  ('batu','builtin:batu','Batu',7.93,38.72,false),('shashamane','builtin:shashamane','Shashamane',7.20,38.60,false),('hawassa','builtin:hawassa','Hawassa',7.05,38.47,true),('sodo','builtin:sodo','Sodo',6.86,37.76,false),('arba_minch','builtin:arba minch','Arba Minch',6.04,37.55,true),
  ('wolkite','builtin:wolkite','Wolkite',8.28,37.78,true),('hosanna','builtin:hosanna','Hosanna',7.55,37.85,false),('jimma','builtin:jimma','Jimma',7.67,36.83,false),('mizan_aman','builtin:mizan aman','Mizan Aman',7.00,35.58,true),
  ('ambo','builtin:ambo','Ambo',8.98,37.85,false),('nekemte','builtin:nekemte','Nekemte',9.09,36.55,false),('gimbi','builtin:gimbi','Gimbi',9.17,35.83,false),('assosa','builtin:assosa','Assosa',10.07,34.53,true),
  ('bedele','builtin:bedele','Bedele',8.46,36.35,false),('metu','builtin:metu','Metu',8.30,35.58,false),('gambella','builtin:gambella','Gambella',8.25,34.59,true),
  ('debre_markos','builtin:debre markos','Debre Markos',10.34,37.73,false),('bahir_dar','builtin:bahir dar','Bahir Dar',11.59,37.39,true),('gondar','builtin:gondar','Gondar',12.60,37.47,false),('debre_tabor','builtin:debre tabor','Debre Tabor',11.86,38.00,false),
  ('degehabur','builtin:degehabur','Degehabur',8.22,43.56,false),('kebri_dehar','builtin:kebri dehar','Kebri Dehar',6.74,44.27,false),('konso','builtin:konso','Konso',5.34,37.44,false),('yabelo','builtin:yabelo','Yabelo',4.88,38.08,false),('tepi','builtin:tepi','Tepi',7.20,35.42,false),('bonga','builtin:bonga','Bonga',7.27,36.23,false),
  ('holeta','builtin:holeta','Holeta',9.06,38.50,false),('sululta','builtin:sululta','Sululta',9.18,38.75,false),('sebeta','builtin:sebeta','Sebeta',8.91,38.62,false),('welenchiti','builtin:welenchiti','Welenchiti',8.67,39.43,false),('asella','builtin:asella','Asella',7.95,39.13,false),
  ('dangila','builtin:dangila','Dangila',11.27,36.83,false),('bure','builtin:bure','Bure',10.70,37.07,false),('wukro','builtin:wukro','Wukro',13.79,39.60,false),('agula','builtin:agula','Agula',13.70,39.58,false),('abi_adi','builtin:abi adi','Abi Adi',13.18,38.93,false),('adwa','builtin:adwa','Adwa',14.17,38.90,false),
  ('chifra','builtin:chifra','Chifra',11.60,40.02,false),('eli_dar','builtin:eli dar','Eli Dar',12.28,42.12,false),('asayita','builtin:asayita','Asayita',11.57,41.44,false),('gewaane','builtin:gewaane','Gewane',10.17,40.65,false),
  ('tog_wajale','builtin:tog wajale','Tog Wajale',9.60,43.34,false),('babile','builtin:babile','Babile',9.21,42.33,false),('bedeno','builtin:bedeno','Bedeno',8.92,41.87,false),('shinile','builtin:shinile','Shinile',9.68,41.84,false),
  ('arsi_negele','builtin:arsi negele','Arsi Negele',7.35,38.70,false),('dilla','builtin:dilla','Dilla',6.41,38.31,false),('butajira','builtin:butajira','Butajira',8.12,38.37,false),('jinka','builtin:jinka','Jinka',5.79,36.57,false),
  ('menge','builtin:menge','Menge',10.39,34.78,false),('bambasi','builtin:bambasi','Bambasi',9.75,34.73,false),('tongo','builtin:tongo','Tongo',10.00,34.20,false),('kurmuk','builtin:kurmuk','Kurmuk',10.55,34.28,false),
  ('itang','builtin:itang','Itang',8.20,34.27,false),('abobo','builtin:abobo','Abobo',7.85,34.55,false),('dembi_dolo','builtin:dembi dolo','Dembi Dolo',8.53,34.80,false),('maji','builtin:maji','Maji',6.21,35.58,false),('dima','builtin:dima','Dima',6.54,35.30,false);

insert into public.place_catalog(id,name,normalized_name,place_type,latitude,longitude,source,country_name,country_code)
select place_ref,name,lower(name),'CITY',lat,lng,'LOADGISTIC_DEMO_ROAD_CATALOG','Ethiopia','ET' from _demo_places
on conflict(id) do nothing;

create temp table _demo_routes(base_ref text not null,variant integer not null,point_codes text[] not null,primary key(base_ref,variant)) on commit drop;
insert into _demo_routes values
  ('builtin:addis ababa',0,array['addis','bishoftu','mojo','adama']),('builtin:addis ababa',1,array['addis','debre_markos','bahir_dar','gondar']),
  ('builtin:adama',0,array['adama','mojo','bishoftu','addis']),('builtin:adama',1,array['adama','awash','mieso','dire_dawa']),
  ('builtin:bahir dar',0,array['bahir_dar','debre_markos','addis']),('builtin:bahir dar',1,array['bahir_dar','debre_tabor','dessie']),
  ('builtin:mekelle',0,array['mekelle','alamata','woldiya']),('builtin:mekelle',1,array['mekelle','alamata','woldiya','dessie','kombolcha']),
  ('builtin:semera',0,array['semera','mille','bati','kombolcha']),('builtin:semera',1,array['semera','mille','awash','adama']),
  ('builtin:jigjiga',0,array['jigjiga','harar','dire_dawa']),('builtin:jigjiga',1,array['jigjiga','degehabur','kebri_dehar']),
  ('builtin:harar',0,array['harar','jigjiga']),('builtin:harar',1,array['harar','dire_dawa','mieso','awash','adama']),
  ('builtin:dire dawa',0,array['dire_dawa','mieso','awash','adama']),('builtin:dire dawa',1,array['dire_dawa','harar','jigjiga']),
  ('builtin:hawassa',0,array['hawassa','shashamane','batu','mojo']),('builtin:hawassa',1,array['hawassa','sodo','arba_minch']),
  ('builtin:wolkite',0,array['wolkite','jimma','mizan_aman']),('builtin:wolkite',1,array['wolkite','hosanna','shashamane','hawassa']),
  ('builtin:arba minch',0,array['arba_minch','sodo','hawassa']),('builtin:arba minch',1,array['arba_minch','konso','yabelo']),
  ('builtin:assosa',0,array['assosa','gimbi','nekemte','ambo','addis']),('builtin:assosa',1,array['assosa','gimbi','nekemte']),
  ('builtin:gambella',0,array['gambella','metu','bedele','jimma']),('builtin:gambella',1,array['gambella','dembi_dolo','gimbi','assosa']),
  ('builtin:mizan aman',0,array['mizan_aman','jimma','wolkite','addis']),('builtin:mizan aman',1,array['mizan_aman','tepi','bonga','jimma']);

create temp table _demo_areas(base_ref text primary key,boundary_codes text[] not null) on commit drop;
insert into _demo_areas values
  ('builtin:addis ababa',array['sebeta','bishoftu','debre_birhan','sululta','holeta']),('builtin:adama',array['asella','welenchiti','bishoftu','mojo']),
  ('builtin:bahir dar',array['dangila','bure','debre_markos','debre_tabor','gondar']),('builtin:mekelle',array['abi_adi','alamata','agula','wukro','adwa']),
  ('builtin:semera',array['chifra','mille','gewaane','asayita','eli_dar']),('builtin:jigjiga',array['harar','babile','degehabur','tog_wajale']),
  ('builtin:harar',array['mieso','bedeno','babile','dire_dawa']),('builtin:dire dawa',array['mieso','harar','jigjiga','shinile']),
  ('builtin:hawassa',array['sodo','dilla','shashamane','arsi_negele']),('builtin:wolkite',array['jimma','hosanna','butajira','ambo']),
  ('builtin:arba minch',array['jinka','konso','dilla','sodo']),('builtin:assosa',array['tongo','bambasi','menge','kurmuk']),
  ('builtin:gambella',array['itang','abobo','metu','dembi_dolo']),('builtin:mizan aman',array['dima','maji','bonga','tepi']);

with capacity_base as (
  select capacity.id,base.place_ref as base_ref
  from public.capacities capacity
  join lateral (
    select place.place_ref from _demo_places place where place.is_base
    order by case when replace(lower(coalesce(capacity.location_place_ref,'')),'builtin:jijiga','builtin:jigjiga')=place.place_ref then 0 else 1 end,
      power(coalesce(capacity.location_lat,9.03)-place.lat,2)+power(coalesce(capacity.location_lng,38.74)-place.lng,2)
    limit 1
  ) base on true
), route_replacement as (
  select capacity_base.id,jsonb_agg(jsonb_build_object('place_ref',place.place_ref,'label',place.name||', Ethiopia','lat',place.lat,'lng',place.lng) order by point.ordinality) as points
  from capacity_base join _demo_routes route on route.base_ref=capacity_base.base_ref and route.variant=(hashtextextended(capacity_base.id::text,0)&1)::integer
  cross join lateral unnest(route.point_codes) with ordinality point(code,ordinality) join _demo_places place on place.code=point.code
  group by capacity_base.id
)
update public.capacities capacity set
  current_route_points_json=replacement.points,capacity_area_boundary_json='[]'::jsonb,
  current_route_origin=replacement.points->0->>'label',current_route_destination=replacement.points->(jsonb_array_length(replacement.points)-1)->>'label',
  current_origin_place_ref=replacement.points->0->>'place_ref',current_origin_lat=(replacement.points->0->>'lat')::double precision,current_origin_lng=(replacement.points->0->>'lng')::double precision,
  current_destination_place_ref=replacement.points->(jsonb_array_length(replacement.points)-1)->>'place_ref',current_destination_lat=(replacement.points->(jsonb_array_length(replacement.points)-1)->>'lat')::double precision,current_destination_lng=(replacement.points->(jsonb_array_length(replacement.points)-1)->>'lng')::double precision
from route_replacement replacement where capacity.id=replacement.id and capacity.availability_geometry='ROUTE';

with capacity_base as (
  select capacity.id,base.place_ref as base_ref,base.name,base.lat,base.lng
  from public.capacities capacity join lateral (
    select place.* from _demo_places place where place.is_base
    order by case when replace(lower(coalesce(capacity.location_place_ref,'')),'builtin:jijiga','builtin:jigjiga')=place.place_ref then 0 else 1 end,
      power(coalesce(capacity.location_lat,9.03)-place.lat,2)+power(coalesce(capacity.location_lng,38.74)-place.lng,2) limit 1
  ) base on true
), area_replacement as (
  select capacity_base.*,jsonb_agg(jsonb_build_object('place_ref',place.place_ref,'label',place.name||', Ethiopia','lat',place.lat,'lng',place.lng) order by point.ordinality) as boundary,
    ceil(max(st_distance(st_setsrid(st_makepoint(capacity_base.lng,capacity_base.lat),4326)::geography,st_setsrid(st_makepoint(place.lng,place.lat),4326)::geography))/1000)::integer as radius_km
  from capacity_base join _demo_areas area on area.base_ref=capacity_base.base_ref
  cross join lateral unnest(area.boundary_codes) with ordinality point(code,ordinality) join _demo_places place on place.code=point.code
  group by capacity_base.id,capacity_base.base_ref,capacity_base.name,capacity_base.lat,capacity_base.lng
)
update public.capacities capacity set
  capacity_area_center_place_ref=replacement.base_ref,capacity_area_center_label=replacement.name||', Ethiopia',capacity_area_center_lat=replacement.lat,capacity_area_center_lng=replacement.lng,
  capacity_area_boundary_json=replacement.boundary,current_route_points_json='[]'::jsonb,work_radius_km=greatest(5,least(500,replacement.radius_km))
from area_replacement replacement where capacity.id=replacement.id and capacity.availability_geometry='RADIUS';

with ranked_routes as (
  select route.id,row_number() over(partition by coalesce(route.organization_id::text,route.provider_profile_id::text) order by route.id)-1 as variant,
    coalesce(organization.city_place_ref,profile.city_place_ref) as city_place_ref,coalesce(organization.city_lat,profile.city_lat) as city_lat,coalesce(organization.city_lng,profile.city_lng) as city_lng
  from public.profile_routes route left join public.organizations organization on organization.id=route.organization_id left join public.provider_profiles profile on profile.id=route.provider_profile_id
  where route.organization_id in (select id from public.organizations where type='TRANSPORT_COMPANY') or route.provider_profile_id is not null
), route_base as (
  select ranked_routes.*,base.place_ref as base_ref from ranked_routes join lateral (
    select place.place_ref from _demo_places place where place.is_base order by
      case when replace(lower(coalesce(ranked_routes.city_place_ref,'')),'builtin:jijiga','builtin:jigjiga')=place.place_ref then 0 else 1 end,
      power(coalesce(ranked_routes.city_lat,9.03)-place.lat,2)+power(coalesce(ranked_routes.city_lng,38.74)-place.lng,2) limit 1
  ) base on true
), replacement as (
  select route_base.id,jsonb_agg(jsonb_build_object('place_ref',place.place_ref,'label',place.name||', Ethiopia','lat',place.lat,'lng',place.lng) order by point.ordinality) as points
  from route_base join _demo_routes route on route.base_ref=route_base.base_ref and route.variant=(route_base.variant%2)::integer
  cross join lateral unnest(route.point_codes) with ordinality point(code,ordinality) join _demo_places place on place.code=point.code group by route_base.id
)
update public.profile_routes route set
  route_points_json=replacement.points,origin=replacement.points->0->>'label',destination=replacement.points->(jsonb_array_length(replacement.points)-1)->>'label',
  origin_place_ref=replacement.points->0->>'place_ref',origin_lat=(replacement.points->0->>'lat')::double precision,origin_lng=(replacement.points->0->>'lng')::double precision,
  destination_place_ref=replacement.points->(jsonb_array_length(replacement.points)-1)->>'place_ref',destination_lat=(replacement.points->(jsonb_array_length(replacement.points)-1)->>'lat')::double precision,destination_lng=(replacement.points->(jsonb_array_length(replacement.points)-1)->>'lng')::double precision
from replacement where route.id=replacement.id;
