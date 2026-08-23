update plans
set name = case code
  when 'BUSINESS_CAPACITY' then 'Business access'
  when 'FLEET_DEMAND' then 'Fleet transporter'
  when 'SELF_MANAGED_DRIVER' then 'Independent Driver'
  else name
end
where code in ('BUSINESS_CAPACITY', 'FLEET_DEMAND', 'SELF_MANAGED_DRIVER');
