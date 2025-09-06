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

// 네임스페이스/키 안전성 검사 (영문/숫자/언더바/대시/콜론/점만)
const SAFE = /^[\w\-:.]+$/;

exports.handler = async (event) => {
  // CORS 프리플라이트
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    // ✅ 쿼리 파싱은 rawUrl 대신 표준 필드 사용
    const qs = event.queryStringParameters || {};
    const op  = (qs.op || 'get').toLowerCase();
    const key = qs.key;
    const ns  = process.env.COUNTAPI_NS || 'lottocreator-web';

    if (!key) return respond(400, { error: 'key required' });
    if (!SAFE.test(ns) || !SAFE.test(key)) {
      return respond(400, { error: 'invalid key/ns' });
    }

    // CountAPI 호출 유틸 (JSON 파싱 실패/오류 응답 모두 핸들)
    const call = async (path) => {
      const url = `${BASE}${path}`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      let json = {};
      try { json = await res.json(); } catch { /* non-JSON 방어 */ }
      if (!res.ok) {
        // 외부 4xx/5xx는 그대로 200으로 내려주고 클라이언트에서 표기만 하려면 여기서 처리 가능
        throw new Error(json?.error || res.statusText || `CountAPI error: ${url}`);
      }
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
      // 참고: CountAPI는 없는 키에 hit하면 자동 생성되기도 합니다(환경에 따라 다를 수 있어 ensure 유지 권장)
      const r = await call(`/hit/${ns}/${key}`);
      return ok({ value: unwrap(r) });
    }

    if (op === 'get') {
      const r = await call(`/get/${ns}/${key}`);
      return ok({ value: unwrap(r) });
    }

    return respond(400, { error: 'bad op' });
  } catch (e) {
    // ✅ 에러 내용 그대로 내려주어 브라우저 네트워크 탭에서 원인 확인 가능
    return respond(500, { error: String(e?.message || e) });
  }
};
