// Serves the public R2 bucket `payhas-media` (curated video and posters) to the
// app, in place of the rate-limited r2.dev address. GET and HEAD only; Range
// requests get 206 so players can seek, and keys are immutable, so responses
// cache for a year.

const YEAR = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const key = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!key) return new Response('Not found', { status: 404 });

    if (request.method === 'HEAD') {
      const object = await env.MEDIA.head(key);
      if (!object) return new Response(null, { status: 404 });
      const headers = headersFor(object);
      headers.set('content-length', String(object.size));
      return new Response(null, { headers });
    }

    let object;
    try {
      object = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
    } catch (e) {
      // R2 throws on a range past the end of the file; answer 416 like r2.dev does.
      if (!/range/i.test(String(e))) throw e;
      const head = await env.MEDIA.head(key);
      if (!head) return new Response('Not found', { status: 404 });
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${head.size}` } });
    }
    if (!object) return new Response('Not found', { status: 404 });
    const headers = headersFor(object);

    // A failed precondition (If-None-Match etc.) comes back without a body.
    if (!('body' in object)) return new Response(null, { status: 304, headers });

    if (request.headers.has('range') && object.range) {
      // R2 can return { offset, length } or { suffix }, with the unused keys present but undefined.
      const r = object.range;
      const offset = r.suffix !== undefined ? object.size - r.suffix : (r.offset ?? 0);
      const length = r.suffix !== undefined ? r.suffix : (r.length ?? object.size - offset);
      headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
      return new Response(object.body, { status: 206, headers });
    }
    return new Response(object.body, { headers });
  },
};

function headersFor(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  if (!headers.has('cache-control')) headers.set('cache-control', YEAR);
  return headers;
}
