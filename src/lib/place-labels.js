export const DEFAULT_PLACE_COUNTRY = 'Ethiopia';
export const DEFAULT_PLACE_COUNTRY_CODE = 'ET';

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalized(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitPlaceLabel(value, defaultCountry = DEFAULT_PLACE_COUNTRY) {
  const label = clean(value);
  if (!label) return { name: '', country: '' };
  const separator = label.lastIndexOf(',');
  if (separator < 0) return { name: label, country: defaultCountry };
  const name = clean(label.slice(0,separator));
  const country = clean(label.slice(separator+1));
  return { name: name || label, country: country || defaultCountry };
}

export function placeLabel(value, defaultCountry = DEFAULT_PLACE_COUNTRY) {
  const { name, country } = splitPlaceLabel(value,defaultCountry);
  return name ? `${name}, ${country}` : '';
}

export function placeLocalName(value) {
  return splitPlaceLabel(value).name;
}

export function placeIdentity(value, defaultCountry = DEFAULT_PLACE_COUNTRY) {
  const { name, country } = splitPlaceLabel(value,defaultCountry);
  return normalized(`${name} ${country}`);
}

export function qualifyAreaLabel(value, defaultCountry = DEFAULT_PLACE_COUNTRY) {
  const area = clean(value);
  if (!area) return '';
  if (area.includes(',')) return area;
  return `${area}, ${defaultCountry}`;
}

export function qualifyPlaceList(value, defaultCountry = DEFAULT_PLACE_COUNTRY) {
  return String(value || '')
    .split(/[;\n]/)
    .map(item=>placeLabel(item,defaultCountry))
    .filter(Boolean)
    .join('; ');
}

export function qualifyCorridorList(value, defaultCountry = DEFAULT_PLACE_COUNTRY) {
  return String(value || '')
    .split(/[;\n]/)
    .map(item=>{
      const endpoints=item.split(/\s*(↔|→)\s*/);
      if(endpoints.length<3)return placeLabel(item,defaultCountry);
      return `${placeLabel(endpoints[0],defaultCountry)} ${endpoints[1]} ${placeLabel(endpoints[2],defaultCountry)}`;
    })
    .filter(Boolean)
    .join('; ');
}
