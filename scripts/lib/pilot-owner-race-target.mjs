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
