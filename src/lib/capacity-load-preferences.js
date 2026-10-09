/** Accepted work is separate from the truck's physical Empty/Partial status. */
export function capacityLoadPreference(status, acceptsFull, acceptsShared) {
  const full = acceptsFull === true || acceptsFull === 1;
  const shared = acceptsShared === true || acceptsShared === 1;
  if (status === 'PARTIAL') return shared ? 'PTL' : null;
  if (status !== 'EMPTY') return null;
  return full ? shared ? 'BOTH' : 'FTL' : shared ? 'PTL' : null;
}

export const CAPACITY_LOAD_CHOICES = [
  ['FTL', 'Full loads only'], ['PTL', 'Shared loads only'], ['BOTH', 'Full or shared'],
];

export function capacityLoadLabel(preference, compact = false) {
  const labels = compact
    ? {FTL: 'Full only', PTL: 'Shared only', BOTH: 'Full or shared'}
    : {FTL: 'Full loads only', PTL: 'Shared loads only', BOTH: 'Full or shared'};
  return Object.hasOwn(labels,preference) ? labels[preference] : 'Load preference not set';
}

export function capacityLoadExplanation(preference) {
  const explanations = {
    FTL: 'Accept one load for the whole truck.',
    PTL: 'Accept smaller loads that share the truck.',
    BOTH: 'Accept a full-truck load or smaller shared loads.',
  };
  return Object.hasOwn(explanations,preference) ? explanations[preference] : 'Choose which loads you will accept.';
}
