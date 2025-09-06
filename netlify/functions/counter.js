// netlify/functions/counter.js
// CountAPI 프록시: /get /hit /ensure
const BASE = 'https://api.countapi.xyz';

function respond(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
const ok = (b) => respond(200, b);

exports.handler = async (event) => {
  try {
    const url = new URL(event.rawUrl);
    const op  = url.searchParams.get('op') || 'get';
    const key = url.searchParams.get('key');
    const ns  = process.env.COUNTAPI_NS || 'lottocreator-web'; // 네임스페이스 고정

    if (!key) return respond(400, { error: 'key required' });

    const call = async (path) => {
      const res = await fetch(BASE + path, { method: 'GET', headers: { accept: 'application/json' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText || 'CountAPI error');
      return json;
    };

    if (op === 'ensure') {
      try { return ok(await call(`/get/${ns}/${key}`)); }
      catch { return ok(await call(`/create?namespace=${encodeURIComponent(ns)}&key=${encodeURIComponent(key)}&value=0`)); }
    }
    if (op === 'hit')  return ok(await call(`/hit/${ns}/${key}`));
    if (op === 'get')  return ok(await call(`/get/${ns}/${key}`));

    return respond(400, { error: 'bad op' });
  } catch (e) {
    return respond(500, { error: String(e.message || e) });
  }
};
