// FEAT-SEC-001: anonymous, metadata-free HTTP probe; no administrator credential.
const project = 'tpwyyzoqijjmbvsmmvcm';
export async function inspectDataApiGuard({ key, fetchImpl = fetch }) {
  let anonymous = typeof key === 'string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!anonymous && typeof key === 'string') {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      anonymous = key.split('.').length === 3 && payload.role === 'anon' && payload.ref === project;
    } catch { /* Only a publishable/anonymous key is accepted. */ }
  }
  if (!anonymous) throw Error('ANONYMOUS_MONITOR_KEY_REQUIRED');
  const paths = [
    '/rest/v1/spatial_ref_sys?select=srid&limit=0',
    '/rest/v1/profiles?select=id&limit=0',
    '/rest/v1/rpc/current_user_projection',
  ];
  for (const path of paths) {
    const response = await fetchImpl(`https://${project}.supabase.co${path}`, {
      method: 'GET', headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    let body; try { body = await response.json(); } catch { throw Error('DATA_API_GUARD_RESPONSE_INVALID'); }
    if (![401,403].includes(response.status) || body?.code !== '42501' || body?.message !== 'BROWSER_DATA_API_ACCESS_DENIED') {
      throw Error('DATA_API_GUARD_NOT_VERIFIED');
    }
  }
  return { project, passed: true, probes: paths.length };
}
