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

// 허용 문자: 영숫자/언더바/대시/콜론/점
const SAFE = /^[\w\-:.]+$/;

exports.handler = async (event) => {
  // CORS 프리플라이트
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    // ✅ rawUrl 대신 표준 필드 사용
    const qs = event.queryStringParameters || {};
    const op   = (qs.op || 'get').toLowerCase();
    const key  = qs.key;
    const ns   = process.env.COUNTAPI_NS || 'lottocreator-web';
    const dbg  = qs.debug === '1';

    if (!key) return respond(400, { error: 'key required' });
    if (!SAFE.test(ns) || !SAFE.test(key)) {
      return respond(400, { error: 'invalid key/ns' });
    }

    // CountAPI 호출 유틸
    const call = async (path) => {
      const url = `${BASE}${path}`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      const text = await res.text();                // 본문을 일단 문자열로 받음
      let json; try { json = JSON.parse(text); } catch { json = null; }

      if (!res.ok) {
        // ❗ 4xx/5xx면 500으로 던지되, 원문을 메시지에 실어 디버깅이 쉬움
        const detail = json?.error || text || res.statusText || 'CountAPI error';
        throw new Error(`UPSTREAM ${res.status}: ${detail}`);
      }
      return json ?? { value: Number(text) || 0 };
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
    // ✅ 500일 때도 에러 내용을 본문에 내려줌(네트워크 탭 Response에서 바로 확인 가능)
    return respond(500, { error: String(e?.message || e) });
  }
};
