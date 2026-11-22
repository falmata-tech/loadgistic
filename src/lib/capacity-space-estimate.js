/**
 * A Partial percentage is an estimate only when a report exists.
 * @param {string | null | undefined} status
 * @param {number | null | undefined} percent
 * @param {string | null | undefined} reportedAt
 */
export function reportedSpacePercent(status,percent,reportedAt){
 return status==='PARTIAL'&&reportedAt&&typeof percent==='number'&&Number.isInteger(percent)&&percent>=1&&percent<=99?percent:null;
}
