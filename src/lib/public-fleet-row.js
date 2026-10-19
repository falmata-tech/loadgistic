/** Presentation key only; never display it in place of a platform number.
 * @param {string|null|undefined} platformNumber
 * @param {number} position Stable ordinal within the provider's bounded fleet.
 */
export function publicFleetRowKey(platformNumber,position){
  return platformNumber?`number:${platformNumber}`:`row:${position}`;
}
