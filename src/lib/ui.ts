import { formatEtb, statusLabel } from './domain.js';

export function priceDisplay(shipment: any) {
  if (shipment.price_mode === 'QUOTE_REQUESTED') return 'Quote Requested';
  if (shipment.price_mode === 'TARGET_PRICE') return `Target: ${formatEtb(shipment.target_price_minor)}`;
  return formatEtb(shipment.price_minor) || 'Price not recorded';
}

export function displayStatus(status: string) {
  return statusLabel(status);
}

export function relativeTime(value: string, referenceTime: number = Date.now()) {
  const ms = referenceTime - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' });
}
