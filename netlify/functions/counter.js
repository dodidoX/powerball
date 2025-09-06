// netlify/functions/counter.js
// netlify/functions/counter.js
const BASE = 'https://api.countapi.xyz';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

function respond(status, body) {
  return { statusCode: status, headers, body: JSON.stringify(body) };
}
const ok = (b) => respond(200, b);

exports.handler = async (event) => {
  // CORS preflight (혹시 모를 사전요청)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const qs = event.queryStringParameters || {};
    const op  = (qs.op || 'get').toLowerCase();
    const key = qs.key;
    const ns  = process.env.COUNTAPI_NS || 'lottocreator-web';

    if (!key) return respond(400, { error: 'key required' });

    // 안전한 key/ns만 허용
    const safe = /^[\w\-:.]+$/;
    if (!safe.test(ns) || !safe.test(key)) {
      return respond(400, { error: 'invalid key' });
    }

    const call = async (path) => {
      const res = await fetch(`${BASE}${path}`, {
        headers: { accept: 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || res.statusText || 'CountAPI error');
      return json;
    };

    const unwrap = (r) => r?.value ?? r?.count ?? r ?? 0;

    if (op === 'ensure') {
      try {
        const r = await call(`/get/${ns}/${key}`);
        return ok({ value: unwrap(r) });
      } catch {
        const r = await call(`/create?namespace=${encodeURIComponent(ns)}&key=${encodeURIComponent(key)}&value=0`);
        return ok({ value: unwrap(r) });
      }
    }

    if (op === 'hit') {
      const r = await call(`/hit/${ns}/${key}`);
      return ok({ value: unwrap(r) });
    }

    if (op === 'get') {
      const r = await call(`/get/${ns}/${key}`);
      return ok({ value: unwrap(r) });
    }

    return respond(400, { error: 'bad op' });
  } catch (e) {
    return respond(500, { error: String(e.message || e) });
  }
};
