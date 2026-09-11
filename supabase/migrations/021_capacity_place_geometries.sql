-- The application contract calls these durable current-capacity records
-- `capacities`. Earlier draft migrations used `capacity_updates`; normalize the
-- relation once before adding the current geometry contract.
do $$
begin
  if to_regclass('public.capacities') is null
     and to_regclass('public.capacity_updates') is not null then
    alter table public.capacity_updates rename to capacities;
  end if;
end $$;

alter table public.capacities add column if not exists current_route_points_json jsonb not null default '[]'::jsonb;
alter table public.capacities add column if not exists capacity_area_center_place_ref text;
alter table public.capacities add column if not exists capacity_area_center_label text;
alter table public.capacities add column if not exists capacity_area_center_lat double precision;
alter table public.capacities add column if not exists capacity_area_center_lng double precision;
alter table public.capacities add column if not exists capacity_area_boundary_json jsonb not null default '[]'::jsonb;
alter table public.profile_routes add column if not exists route_points_json jsonb not null default '[]'::jsonb;

-- Pre-customer fixture replacement. These records are synthetic, so old
-- endpoint pairs and circles are intentionally discarded rather than preserved
-- through a compatibility projection.
with route_templates(template_key,points) as (values
  (0,'[
    {"place_ref":"builtin:addis ababa","label":"Addis Ababa, Ethiopia","lat":9.03,"lng":38.74},
    {"place_ref":"builtin:bishoftu","label":"Bishoftu, Ethiopia","lat":8.75,"lng":38.99}
  ]'::jsonb),
  (1,'[
    {"place_ref":"builtin:hawassa","label":"Hawassa, Ethiopia","lat":7.05,"lng":38.47},
    {"place_ref":"builtin:shashamane","label":"Shashamane, Ethiopia","lat":7.20,"lng":38.60},
    {"place_ref":"builtin:hosanna","label":"Hosanna, Ethiopia","lat":7.55,"lng":37.85}
  ]'::jsonb),
  (2,'[
    {"place_ref":"builtin:mekelle","label":"Mekelle, Ethiopia","lat":13.50,"lng":39.47},
    {"place_ref":"builtin:woldiya","label":"Woldiya, Ethiopia","lat":11.83,"lng":39.60},
    {"place_ref":"builtin:dessie","label":"Dessie, Ethiopia","lat":11.13,"lng":39.63},
    {"place_ref":"builtin:kombolcha","label":"Kombolcha, Ethiopia","lat":11.08,"lng":39.74}
  ]'::jsonb),
  (3,'[
    {"place_ref":"builtin:dire dawa","label":"Dire Dawa, Ethiopia","lat":9.60,"lng":41.85},
    {"place_ref":"builtin:harar","label":"Harar, Ethiopia","lat":9.31,"lng":42.13},
    {"place_ref":"builtin:jijiga","label":"Jijiga, Ethiopia","lat":9.35,"lng":42.80},
    {"place_ref":"builtin:bale robe","label":"Bale Robe, Ethiopia","lat":7.12,"lng":40.00},
    {"place_ref":"builtin:adama","label":"Adama, Ethiopia","lat":8.54,"lng":39.27}
  ]'::jsonb)
), replacements as (
  select capacity.id,template.points
  from public.capacities capacity
  join route_templates template on template.template_key=(hashtextextended(capacity.id::text,0) & 3)::int
  where capacity.availability_geometry='ROUTE'
)
update public.capacities capacity
set current_route_points_json=replacements.points,
    current_route_origin=replacements.points->0->>'label',
    current_route_destination=replacements.points->(jsonb_array_length(replacements.points)-1)->>'label',
    current_origin_place_ref=replacements.points->0->>'place_ref',
    current_origin_lat=(replacements.points->0->>'lat')::double precision,
    current_origin_lng=(replacements.points->0->>'lng')::double precision,
    current_destination_place_ref=replacements.points->(jsonb_array_length(replacements.points)-1)->>'place_ref',
    current_destination_lat=(replacements.points->(jsonb_array_length(replacements.points)-1)->>'lat')::double precision,
    current_destination_lng=(replacements.points->(jsonb_array_length(replacements.points)-1)->>'lng')::double precision,
    capacity_area_boundary_json='[]'::jsonb
from replacements where capacity.id=replacements.id;

with area_templates(template_key,center_ref,center_label,center_lat,center_lng,boundary) as (values
  (0,'builtin:addis ababa','Addis Ababa, Ethiopia',9.03,38.74,'[
    {"place_ref":"builtin:debre birhan","label":"Debre Birhan, Ethiopia","lat":9.68,"lng":39.53},
    {"place_ref":"builtin:adama","label":"Adama, Ethiopia","lat":8.54,"lng":39.27},
    {"place_ref":"builtin:hosanna","label":"Hosanna, Ethiopia","lat":7.55,"lng":37.85},
    {"place_ref":"builtin:nekemte","label":"Nekemte, Ethiopia","lat":9.09,"lng":36.55}
  ]'::jsonb),
  (1,'builtin:hawassa','Hawassa, Ethiopia',7.05,38.47,'[
    {"place_ref":"builtin:shashamane","label":"Shashamane, Ethiopia","lat":7.20,"lng":38.60},
    {"place_ref":"builtin:dilla","label":"Dilla, Ethiopia","lat":6.41,"lng":38.31},
    {"place_ref":"builtin:arba minch","label":"Arba Minch, Ethiopia","lat":6.04,"lng":37.55},
    {"place_ref":"builtin:hosanna","label":"Hosanna, Ethiopia","lat":7.55,"lng":37.85}
  ]'::jsonb),
  (2,'builtin:bahir dar','Bahir Dar, Ethiopia',11.59,37.39,'[
    {"place_ref":"builtin:gondar","label":"Gondar, Ethiopia","lat":12.60,"lng":37.47},
    {"place_ref":"builtin:debre markos","label":"Debre Markos, Ethiopia","lat":10.34,"lng":37.73},
    {"place_ref":"builtin:nekemte","label":"Nekemte, Ethiopia","lat":9.09,"lng":36.55},
    {"place_ref":"builtin:metema","label":"Metema, Ethiopia","lat":12.95,"lng":36.15}
  ]'::jsonb),
  (3,'builtin:dire dawa','Dire Dawa, Ethiopia',9.60,41.85,'[
    {"place_ref":"builtin:jijiga","label":"Jijiga, Ethiopia","lat":9.35,"lng":42.80},
    {"place_ref":"builtin:harar","label":"Harar, Ethiopia","lat":9.31,"lng":42.13},
    {"place_ref":"builtin:bale robe","label":"Bale Robe, Ethiopia","lat":7.12,"lng":40.00},
    {"place_ref":"builtin:semera","label":"Semera, Ethiopia","lat":11.79,"lng":41.01}
  ]'::jsonb)
), replacements as (
  select capacity.id,template.*
  from public.capacities capacity
  join area_templates template on template.template_key=(hashtextextended(capacity.id::text,0) & 3)::int
  where capacity.availability_geometry='RADIUS'
)
update public.capacities capacity
set capacity_area_center_place_ref=replacements.center_ref,
    capacity_area_center_label=replacements.center_label,
    capacity_area_center_lat=replacements.center_lat,
    capacity_area_center_lng=replacements.center_lng,
    capacity_area_boundary_json=replacements.boundary,
    current_route_points_json='[]'::jsonb
from replacements where capacity.id=replacements.id;

with route_templates(template_key,points) as (values
  (0,'[
    {"place_ref":"builtin:addis ababa","label":"Addis Ababa, Ethiopia","lat":9.03,"lng":38.74},
    {"place_ref":"builtin:adama","label":"Adama, Ethiopia","lat":8.54,"lng":39.27},
    {"place_ref":"builtin:hawassa","label":"Hawassa, Ethiopia","lat":7.05,"lng":38.47}
  ]'::jsonb),
  (1,'[
    {"place_ref":"builtin:bahir dar","label":"Bahir Dar, Ethiopia","lat":11.59,"lng":37.39},
    {"place_ref":"builtin:debre markos","label":"Debre Markos, Ethiopia","lat":10.34,"lng":37.73},
    {"place_ref":"builtin:addis ababa","label":"Addis Ababa, Ethiopia","lat":9.03,"lng":38.74},
    {"place_ref":"builtin:adama","label":"Adama, Ethiopia","lat":8.54,"lng":39.27}
  ]'::jsonb),
  (2,'[
    {"place_ref":"builtin:mekelle","label":"Mekelle, Ethiopia","lat":13.50,"lng":39.47},
    {"place_ref":"builtin:woldiya","label":"Woldiya, Ethiopia","lat":11.83,"lng":39.60},
    {"place_ref":"builtin:dessie","label":"Dessie, Ethiopia","lat":11.13,"lng":39.63},
    {"place_ref":"builtin:kombolcha","label":"Kombolcha, Ethiopia","lat":11.08,"lng":39.74},
    {"place_ref":"builtin:addis ababa","label":"Addis Ababa, Ethiopia","lat":9.03,"lng":38.74}
  ]'::jsonb),
  (3,'[
    {"place_ref":"builtin:dire dawa","label":"Dire Dawa, Ethiopia","lat":9.60,"lng":41.85},
    {"place_ref":"builtin:harar","label":"Harar, Ethiopia","lat":9.31,"lng":42.13},
    {"place_ref":"builtin:jijiga","label":"Jijiga, Ethiopia","lat":9.35,"lng":42.80}
  ]'::jsonb)
), replacements as (
  select route.id,template.points
  from public.profile_routes route
  join route_templates template on template.template_key=(hashtextextended(route.id::text,0) & 3)::int
)
update public.profile_routes route
set route_points_json=replacements.points,
    origin=replacements.points->0->>'label',
    destination=replacements.points->(jsonb_array_length(replacements.points)-1)->>'label',
    origin_place_ref=replacements.points->0->>'place_ref',
    origin_lat=(replacements.points->0->>'lat')::double precision,
    origin_lng=(replacements.points->0->>'lng')::double precision,
    destination_place_ref=replacements.points->(jsonb_array_length(replacements.points)-1)->>'place_ref',
    destination_lat=(replacements.points->(jsonb_array_length(replacements.points)-1)->>'lat')::double precision,
    destination_lng=(replacements.points->(jsonb_array_length(replacements.points)-1)->>'lng')::double precision
from replacements where route.id=replacements.id;

create index if not exists capacities_current_route_points_gin on public.capacities using gin(current_route_points_json);
create index if not exists capacities_area_boundary_gin on public.capacities using gin(capacity_area_boundary_json);
create index if not exists profile_routes_points_gin on public.profile_routes using gin(route_points_json);
