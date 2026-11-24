import {capacityUpdatePresentation} from '../domain.js';

/** Present the API's fixed freshness buckets without changing their meaning. */
export function localizedUpdateLabel(label, t, kind = 'capacity') {
  const subject = kind === 'location' ? 'Location' : 'Capacity';
  const value = typeof label === 'string' ? label : '';
  const days = value.match(new RegExp(`^${subject} updated ([1-3]) days? ago$`));
  const age = days ? t('{days}d ago', {days: Number(days[1])})
    : value === `${subject} updated today` ? t('Today')
    : value === `${subject} updated within the past week` ? t('Past week')
    : value === `${subject} updated within the past month` ? t('Past month')
    : value === `${subject} last updated over a month ago` ? t('Over a month')
    : t('Time unknown');
  return t(kind === 'location' ? 'Location updated: {age}' : 'Capacity updated: {age}', {age});
}

/** Format a timestamp that is already available in an authorized workspace. */
export function localizedSavedUpdate(updatedAt, t, kind = 'capacity', now = Date.now()) {
  return localizedUpdateLabel(capacityUpdatePresentation(updatedAt, {kind, now}).label, t, kind);
}
