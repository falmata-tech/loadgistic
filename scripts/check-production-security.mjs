import {inspectProductionSecurity} from './lib/security-advisor.mjs';
try {
  const result = await inspectProductionSecurity({token: process.env.LOADGISTIC_ADVISOR_READ_TOKEN});
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.passed ? 0 : 1;
} catch (error) {
  // Neither response bodies nor credentials belong in monitoring logs.
  const code = String(error?.message || '');
  console.error(/^(PROJECT_SCOPED_READ_ONLY_ADVISOR_TOKEN_REQUIRED|UNEXPECTED_PROJECT|INVALID_ADVISOR_(RESPONSE|FINDING|JSON)|ADVISOR_READ_HTTP_\d{3})$/.test(code) ? code : 'ADVISOR_READ_FAILED');
  process.exitCode = 1;
}
