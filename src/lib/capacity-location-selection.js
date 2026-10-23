// Capacity screens consume an already-authorized workspace. A phone report is
// historical data unless MOBILE is selected and it follows that selection.
/** @param {{source?:unknown}|null|undefined} selection */
export function capacityLocationSource(selection) {
  return ['GPS','MANUAL'].includes(selection?.source) ? selection.source : 'MOBILE';
}

/**
 * @template {{updatedAt:string}} T
 * @param {{selection?:{source?:unknown,selectedAt?:unknown}|null,published?:T|null,phone?:T|null,captured?:T|null}} input
 * @returns {T|null}
 */
export function selectedCapacityLocation({selection=null,published=null,phone=null,captured=null}) {
  if (capacityLocationSource(selection)!=='MOBILE') return published || null;
  const selectedAt=Date.parse(typeof selection?.selectedAt==='string' ? selection.selectedAt : '1970-01-01T00:00:00Z');
  const eligible=[phone,captured].filter(point=>point && Number.isFinite(Date.parse(point.updatedAt)) && Date.parse(point.updatedAt)>=selectedAt);
  return [published,...eligible].filter(Boolean).reduce((latest,point)=>
    !latest || Date.parse(point.updatedAt)>(Date.parse(latest.updatedAt)||0) ? point : latest,null);
}
