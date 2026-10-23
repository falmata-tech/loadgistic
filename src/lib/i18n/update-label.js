/** Translate only the fixed freshness labels produced by capacityUpdatePresentation. */
export function localizedUpdateLabel(label, t, kind = 'capacity') {
  const subject = kind === 'location' ? 'Location' : 'Capacity';
  const value = typeof label === 'string' ? label : '';
  const days = value.match(new RegExp(`^${subject} updated ([1-3]) (day|days) ago$`));
  if (days) return t(`${subject} updated {days} ${days[2]} ago`, {days: Number(days[1])});
  const fixed = [
    `${subject} updated today`,
    `${subject} updated within the past week`,
    `${subject} updated within the past month`,
    `${subject} last updated over a month ago`,
    `${subject} update unavailable`
  ];
  return t(fixed.includes(value) ? value : `${subject} update unavailable`);
}
