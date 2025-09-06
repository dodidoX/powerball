const BASE = 'https://api.countapi.xyz';

const respond = (status, body) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});
const ok = (b) => respond(200, b);

exports.handler = async (event) => {
  // CORS preflight가 오면 통과시켜 주기 (브라우저에 따라 필요할 수 있음)
  if (event.httpMethod === 'OPTIONS') {
    return respond(204, {});
  }

  try {
    const qs = event.queryStringParameters || {};
    const op  = qs.op || 'get';
    const key = qs.key;
    const ns  = process.env.COUNTAPI_NS || 'lottocreator-web';

    if (!key) return respond(400, { error: 'key required' });

    const call = async (path) => {
      const res = await fetch(BASE + path, {
        method: 'GET',
        headers: { accept: 'application/json' }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error || res.statusText || 'CountAPI error';
        throw new Error(msg);
      }
      return json;
    };

    if (op === 'ensure') {
      try {
        return ok(await call(`/get/${ns}/${key}`));
      } catch {
        return ok(await call(`/create?namespace=${encodeURIComponent(ns)}&key=${encodeURIComponent(key)}&value=0`));
      }
    }
    if (op === 'hit') return ok(await call(`/hit/${ns}/${key}`));
    if (op === 'get') return ok(await call(`/get/${ns}/${key}`));

    return respond(400, { error: 'bad op' });
  } catch (e) {
    // Netlify Functions 로그에서 바로 보이도록
    console.error('counter error:', e);
    return respond(500, { error: String(e?.message || e) });
  }
};