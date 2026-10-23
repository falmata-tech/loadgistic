export type MobileOtpDelivery = 'SENT' | 'WAIT' | 'UNAVAILABLE';

type OtpResponse = { error?: { status?: number } | null } | null | undefined;

function rejectedStatus(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !('status' in value)) return null;
  return typeof value.status === 'number' ? value.status : null;
}

/** Never report a code handoff unless Auth explicitly accepts the request. */
export async function requestMobileOtp(send: () => Promise<OtpResponse>): Promise<MobileOtpDelivery> {
  try {
    const result = await send();
    if (result?.error === null) return 'SENT';
    return rejectedStatus(result?.error) === 429 ? 'WAIT' : 'UNAVAILABLE';
  } catch (error) {
    return rejectedStatus(error) === 429 ? 'WAIT' : 'UNAVAILABLE';
  }
}
