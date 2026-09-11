import { displayStatus } from '@/lib/ui';

export function StatusPill({ status }: { status: string }) {
  const key = String(status || '').toLowerCase();
  let tone = '';
  if (['completed','delivered','empty','fresh','approved','collected'].includes(key)) tone = 'green';
  else if (['partial','busy','ready_for_pickup','update_needed','pending','new'].includes(key)) tone = 'orange';
  else if (['to_pickup','in_route','in_transit','out_for_delivery','contacted','agreed'].includes(key)) tone = 'purple';
  else if (['full','expired','cancelled','rejected','issue'].includes(key)) tone = 'red';
  return <span className={`status ${tone} ${key}`}>{displayStatus(status)}</span>;
}
