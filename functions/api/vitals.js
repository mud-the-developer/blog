const ALLOWED_VITALS = new Set(['CLS', 'INP', 'LCP', 'FCP', 'TTFB']);
const MAX_BODY_BYTES = 4096;

function response(status) {
  return new Response(null, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return response(413);

  let metric;
  try {
    metric = JSON.parse(body);
  } catch {
    return response(400);
  }

  if (
    !metric ||
    !ALLOWED_VITALS.has(metric.name) ||
    !Number.isFinite(metric.value) ||
    typeof metric.id !== 'string'
  ) {
    return response(400);
  }

  console.info(
    JSON.stringify({
      event: 'web-vital',
      name: metric.name,
      value: metric.value,
      rating: String(metric.rating || 'unknown'),
      id: metric.id.slice(0, 128),
      url: String(metric.url || '').slice(0, 512),
      ts: Number(metric.ts) || Date.now(),
    }),
  );
  return response(204);
}
