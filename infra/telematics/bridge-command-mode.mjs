/** Device commands are an explicit capability, never inferred from a token. */
export function commandsEnabled(value) {
  if (value === 'true') return true;
  if (value === 'false' || value === undefined) return false;
  throw new Error('GATEWAY_COMMAND_MODE_INVALID');
}
