export const LOADGISTIC_PROJECT = 'tpwyyzoqijjmbvsmmvcm';
const origin = 'https://api.supabase.com/v1';

export function summarizeAdvisors(data) {
  if (!data || !Array.isArray(data.lints)) throw new Error('INVALID_ADVISOR_RESPONSE');
  const counts = {ERROR: 0, WARN: 0, INFO: 0};
  const findings = data.lints.map(item => {
    if (!item || typeof item.name !== 'string' || !Object.hasOwn(counts, item.level)) {
      throw new Error('INVALID_ADVISOR_FINDING');
    }
    counts[item.level]++;
    const metadata = {};
    for (const key of ['schema', 'name', 'type']) {
      if (typeof item.metadata?.[key] === 'string') metadata[key] = item.metadata[key];
    }
    return {name: item.name, level: item.level, metadata};
  });
  return {project: LOADGISTIC_PROJECT, counts, findings, passed: counts.ERROR === 0 && counts.WARN === 0};
}

export async function inspectProductionSecurity({token, fetchImpl = fetch}) {
  // Format checking cannot attest scopes. The owner must independently verify
  // project-only Project Settings Read + Advisors Read in the provider UI.
  if (typeof token !== 'string' || !/^sbp_fc[A-Za-z0-9_-]{8,}$/.test(token)) {
    throw new Error('PROJECT_SCOPED_READ_ONLY_ADVISOR_TOKEN_REQUIRED');
  }
  async function get(path) {
    const response = await fetchImpl(`${origin}/projects/${LOADGISTIC_PROJECT}${path}`, {
      method: 'GET', redirect: 'error', headers: {Authorization: `Bearer ${token}`},
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`ADVISOR_READ_HTTP_${response.status}`);
    try { return await response.json(); } catch { throw new Error('INVALID_ADVISOR_JSON'); }
  }
  const project = await get('');
  if (project?.id !== LOADGISTIC_PROJECT || project.name !== 'loadgistic') throw new Error('UNEXPECTED_PROJECT');
  return summarizeAdvisors(await get('/advisors/security'));
}
