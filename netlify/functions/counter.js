// netlify/functions/counter.js
// 방문자 카운터 (Netlify Blobs 저장소 사용)
const { getStore } = require('@netlify/blobs');

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
    if (!key) return respond(400, { error: 'key required' });

    // 프로젝트 내에서 고유하게 쓸 스토어 이름
    const store = getStore('lottocreator-visitors');

    // 값 조회 → { value: number }
    const getVal = async () => {
      const v = await store.get(key);                 // string | null
      const n = Number(v);
      return { value: Number.isFinite(n) ? n : 0 };
    };

    // 없으면 0으로 생성하고 반환
    if (op === 'ensure') {
      const v = await store.get(key);
      if (v === null) await store.set(key, '0');
      return ok(await getVal());
    }

    // 1 증가 (낙관적 업데이트: 트래픽이 아주 크지 않으면 충분)
    if (op === 'hit') {
      const cur = await store.get(key);
      const n = Number(cur);
      const next = (Number.isFinite(n) ? n : 0) + 1;
      await store.set(key, String(next));
      return ok({ value: next });
    }

    if (op === 'get') return ok(await getVal());

    return respond(400, { error: 'bad op' });
  } catch (e) {
    return respond(500, { error: String(e?.message || e) });
  }
};
