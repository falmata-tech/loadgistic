/** Shipment acceptance is separate from the vehicle's Empty or Partial status. */
export function capacityLoadPreference(status, acceptsFull, acceptsPartial) {
  const full = acceptsFull === true || acceptsFull === 1;
  const partial = acceptsPartial === true || acceptsPartial === 1;
  if (status === 'PARTIAL') return partial ? 'PTL' : null;
  if (status !== 'EMPTY') return null;
  return full ? partial ? 'BOTH' : 'FTL' : partial ? 'PTL' : null;
}

export const CAPACITY_LOAD_CHOICES = [
  ['FTL', 'Full vehicle shipments only'], ['PTL', 'Partial Shipments Only'], ['BOTH', 'Partial or full vehicle shipments'],
];

export function capacityLoadLabel(preference) {
  return CAPACITY_LOAD_CHOICES.find(([value]) => value === preference)?.[1] ?? null;
}

export function capacityLoadExplanation(preference) {
  const explanations = {
    FTL: 'Accept shipments that need the whole vehicle.',
    PTL: 'Accept shipments that need only part of the vehicle.',
    BOTH: 'Accept shipments that need part or all of the vehicle.',
  };
  return Object.hasOwn(explanations,preference) ? explanations[preference] : 'Choose which shipments you accept.';
}
