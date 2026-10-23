/** UI request bounds; server authorization, ranking and page limits remain authoritative. */
export const TRANSPORTER_SEARCH_DELAY_MS = 500;
export const TRANSPORTER_SEARCH_TIMEOUT_MS = 15000;
export function transporterSearchQuery(value) {
  if (typeof value !== 'string') return null;
  const query = value.trim();
  return query.length <= 120 && Array.from(query).length >= 2 ? query : null;
}
