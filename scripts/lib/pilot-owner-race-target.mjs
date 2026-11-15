// Resolve Docker's actual environment precedence, then pin a local Unix socket.
// Returned arguments/environment are copied once; changing the user's current
// context later cannot redirect a destructive disposable-database operation.
export async function pinnedLocalPilotDocker({environment,inspectContext}){
 const context=environment.DOCKER_CONTEXT||'';
 if(context&&!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(context))throw Error('PILOT_RACE_CONTEXT_NAME_DENIED');
 const endpoint=context?await inspectContext(context):environment.DOCKER_HOST||await inspectContext(null);
 if(typeof endpoint!=='string'||endpoint.length>4096||!/^unix:\/\/\/[^\r\n\0?#]+$/.test(endpoint))throw Error('PILOT_RACE_LOCAL_DOCKER_REQUIRED');
 const env={...environment};delete env.DOCKER_CONTEXT;delete env.DOCKER_HOST;
 return Object.freeze({endpoint,args:Object.freeze(['--host',endpoint]),environment:Object.freeze(env)});
}

// Only fixed vocabulary crosses into CI logs. Error messages can contain SQL,
// account identifiers, paths or connection data; even a PILOT_ prefix is not an
// authority to publish an arbitrary message.
const failureStages=new Set([
 'PREFLIGHT','BACKUP','COMMITTED_FIXTURE','PROVISION_FIRST','OWNER_FIRST_PROVISION','REPORT_FIRST','OWNER_FIRST_REPORT',
 'PREFLIGHT_DOCKER_CONTEXT','PREFLIGHT_CONTAINER_IDENTITY','PREFLIGHT_DATABASE_IDENTITY','PREFLIGHT_DUMP_CLIENT_VERSION',
 'PREFLIGHT_PG_MAJOR_CHECK','PREFLIGHT_RESTORE_ROLE','PREFLIGHT_LOCAL_BASELINE','PREFLIGHT_BASELINE_FINGERPRINT',
 'BACKUP_GRAPHQL_SNAPSHOT','BACKUP_ARCHIVE','BACKUP_ARCHIVE_TOC','BACKUP_ARCHIVE_VALIDATE',
 'COMMITTED_FIXTURE_GENERATE','COMMITTED_FIXTURE_INSTALL',
 'RESTORE_TARGET_CHECK','RESTORE_TARGET_DOCKER_CONTEXT','RESTORE_TARGET_CONTAINER_IDENTITY','RESTORE_TARGET_DATABASE_IDENTITY',
 'RESTORE_TARGET_DUMP_CLIENT_VERSION','RESTORE_TARGET_PG_MAJOR_CHECK','RESTORE_TARGET_RESTORE_ROLE',
 'RESTORE_DROP','RESTORE_CREATE','RESTORE_ARCHIVE','RESTORE_VERIFY',
]);
const failureCodes=new Set([
 'PILOT_RACE_CONTEXT_NAME_DENIED','PILOT_RACE_LOCAL_DOCKER_REQUIRED','PILOT_RACE_BACKUP_WRITE_FAILED',
 'PILOT_RACE_OUTPUT_BOUND','PILOT_RACE_SPAWN_FAILED','PILOT_RACE_PROCESS_TIMEOUT','PILOT_RACE_PROCESS_FAILED',
 'PILOT_RACE_UNPINNED_DOCKER','PILOT_RACE_CONTAINER_DRIFT','PILOT_RACE_DATABASE_DRIFT','PILOT_RACE_DENIAL_CHANGED_STATE',
 'PILOT_RACE_SESSION_SPAWN','PILOT_RACE_SESSION_FAILED','PILOT_RACE_SESSION_TIMEOUT','PILOT_RACE_EXPECTED_WAIT_MISSING',
 'PILOT_RACE_EXPECTED_BLOCKER_TIMEOUT','PILOT_RACE_RESULT_MISSING','PILOT_RACE_WRONG_DENIAL','PILOT_OWNER_RACE_FIXTURE_MISSING',
 'PILOT_PROVISION_FIRST_FAILED','PILOT_REPORT_FIRST_FAILED','PILOT_REPORT_SAVED_FACTS_WRONG','PILOT_RACE_STOP_FAILED',
 'PILOT_RACE_LOCAL_BASELINE_REQUIRED','PILOT_RACE_BASELINE_MISMATCH',
]);
const sharedFailureCodes=new Map([
 ['GPS CI PostgreSQL client/server major mismatch','PILOT_RACE_PG_MAJOR_MISMATCH'],
 ['GPS CI local restore role mismatch','PILOT_RACE_RESTORE_ROLE_MISMATCH'],
 ['GPS CI invalid pg_graphql restore snapshot','PILOT_RACE_GRAPHQL_SNAPSHOT_INVALID'],
 ['GPS CI expected one Supabase pg_graphql wrapper ACL','PILOT_RACE_GRAPHQL_ACL_REQUIRED'],
 ['GPS CI expected PostgreSQL15 GraphQL wrapper restore gap changed','PILOT_RACE_GRAPHQL_RESTORE_GAP_CHANGED'],
 ['GPS CI restored GraphQL wrapper definition or grants differ','PILOT_RACE_GRAPHQL_RESTORE_MISMATCH'],
]);
const failureCategories=new Set(['version-mismatch','authentication-failed','role-missing','permission-denied',
 'lock-contention','resource-exhausted','connection-failed','broken-pipe','restore-sql-error','dump-error','unclassified']);
export function publicPilotOwnerFailure(stage,error){
 const message=typeof error?.message==='string'?error.message:'';
 return {
  stage:failureStages.has(stage)?stage:'UNKNOWN',
  code:failureCodes.has(message)?message:sharedFailureCodes.get(message)||'PILOT_RACE_UNCLASSIFIED',
  category:failureCategories.has(error?.category)?error.category:'unclassified',
 };
}
