import {capacityLoadLabel} from './capacity-load-preferences.js';

/**
 * A Partial percentage is an estimate only when a report exists.
 * @param {string | null | undefined} status
 * @param {number | null | undefined} percent
 * @param {string | null | undefined} reportedAt
 */
export function reportedSpacePercent(status,percent,reportedAt){
 return status==='PARTIAL'&&reportedAt&&typeof percent==='number'&&Number.isInteger(percent)&&percent>=1&&percent<=99?percent:null;
}

/** @param {string | null | undefined} status
 * @param {number | null | undefined} percent
 * @param {string | null | undefined} reportedAt
 */
export function availableSpacePercent(status,percent,reportedAt){
 return status==='EMPTY'?100:reportedSpacePercent(status,percent,reportedAt);
}

/** @param {number | null} percent
 * @param {string | null | undefined} preference
 */
export function emptyShipmentPreferenceLabel(percent,preference){
 return percent===100?capacityLoadLabel(preference):null;
}
