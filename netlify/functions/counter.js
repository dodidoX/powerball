// netlify/functions/counter.js
const BASE = 'https://api.countapi.xyz';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

const SAFE = /^[\w\-:.]+$/;
const respond = (s, b) => ({ statusCode: s, headers, body: JSON.stringify(b) });
const ok = (b) => respond(200, b);

// 공통 fetch 유틸: 타임아웃 + 로깅
async function getJSONWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    if (!res.ok) {
      const detail = json?.error || text || res.statusText || 'CountAPI error';
      throw new Error(`UPSTREAM ${res.status}: ${detail}`);
    }
    return json ?? { value: Number(text) || 0 };
  } finally {
    clearTimeout(t);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    const qs  = event.queryStringParameters || {};
    const op  = (qs.op || 'get').toLowerCase();
    const key = qs.key;
    const ns  = process.env.COUNTAPI_NS || 'lottocreator-web';

    if (!key) return respond(400, { error: 'key required' });
    if (!SAFE.test(ns) || !SAFE.test(key)) return respond(400, { error: 'invalid key/ns' });

    const call = (path) => getJSONWithTimeout(`${BASE}${path}`, 5000);
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
    // Netlify 함수 로그에서 자세히 보려고 서버 로그로 남김
    console.error('[counter] error:', e); // ← Netlify Deploy → Functions 로그에서 확인
    // 클라이언트에는 원인 힌트도 함께 반환
    return respond(500, {
      error: String(e?.message || e),
      code: e?.code || e?.name,
    });
  }
};
