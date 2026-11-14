/**
 * Retired direct simulator writer.
 *
 * Capacity simulation must use the unified database episode controller, which
 * checks the exact cohort, current Capacity receipt, source consent and REAL
 * takeover in the same write boundary. Ordinary human product commands retain
 * their existing permissions; this export grants no alternate simulator path.
 * Keep the explicit refusal for older local callers instead of falling back to
 * a normal publish command without the controller's takeover checks.
 */
export async function executeDemoCapacityPlan(){
 throw Error('DEMO_WORLD_DIRECT_APPLY_RETIRED');
}
