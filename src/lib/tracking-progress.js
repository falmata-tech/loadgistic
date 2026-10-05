export const TRACKING_JOURNEY = Object.freeze(['TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING','COMPLETED']);

// Presentation of persisted history, never authorization for a transition.
export function trackingProgress(status, currentStatus, recordedStatuses, nextStatuses) {
  const recorded = recordedStatuses.includes(status);
  if (status === currentStatus) return currentStatus === 'COMPLETED' ? 'Completed' : 'Current';
  if (currentStatus === 'ISSUE') return nextStatuses.includes(status) ? (recorded ? 'Resume · previously recorded' : 'Resume here') : 'Remaining';
  if (currentStatus === 'CANCELLED') return recorded ? 'Previously recorded' : 'Not reached';
  const position = TRACKING_JOURNEY.indexOf(status);
  const current = TRACKING_JOURNEY.indexOf(currentStatus);
  if (position < current) return recorded ? 'Completed' : 'Not recorded';
  if (nextStatuses.includes(status)) return currentStatus === 'CREATED' && status === 'LOADING' ? 'Or start here' : 'Next';
  return 'Remaining';
}
