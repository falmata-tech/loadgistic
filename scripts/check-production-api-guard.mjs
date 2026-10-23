import { inspectDataApiGuard } from './lib/data-api-monitor.mjs';
try {
  console.log(JSON.stringify(await inspectDataApiGuard({ key: process.env.LOADGISTIC_MONITOR_PUBLISHABLE_KEY })));
} catch (error) {
  const code = String(error?.message || '');
  console.error(/^(ANONYMOUS_MONITOR_KEY_REQUIRED|DATA_API_GUARD_RESPONSE_INVALID|DATA_API_GUARD_NOT_VERIFIED)$/.test(code)
    ? code : 'DATA_API_GUARD_READ_FAILED');
  process.exitCode = 1;
}
