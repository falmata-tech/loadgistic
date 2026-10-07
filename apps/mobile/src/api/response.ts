export class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export async function readApiResponse(response: Response): Promise<unknown> {
  const unavailable = () => new ApiError(503, 'INVALID_RESPONSE', 'The service could not respond. Please try again.');
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw unavailable();
  let value: unknown;
  try { value = await response.json(); } catch { throw unavailable(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable();
  if (!response.ok) {
    const failure = (value as { error?: unknown }).error;
    const details = failure && typeof failure === 'object' ? failure as { code?: unknown; message?: unknown } : {};
    throw new ApiError(response.status, typeof details.code === 'string' ? details.code : 'UNAVAILABLE', typeof details.message === 'string' && details.message.length <= 500 ? details.message : 'Please try again.');
  }
  return value;
}
