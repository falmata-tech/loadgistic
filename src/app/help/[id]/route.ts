export function GET() {
  return new Response('This support conversation is unavailable.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  });
}
