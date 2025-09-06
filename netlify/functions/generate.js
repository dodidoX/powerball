// ── Rate limit 설정 ─────────────────────────────────────
const SEC_LIMIT = 5;       // 1초당 3회
const MIN_LIMIT = 250;     // 1분당 150회
const WINDOW_SEC = 1000;   // 1초
const WINDOW_MIN = 60000;  // 1분

// 인스턴스가 warm 상태인 동안 유지되는 메모리 맵(IP별 타임스탬프 큐)
const rateStore = new Map();

/** 클라이언트 키(IP) 추출 */
function getClientKey(event) {
  const h = event.headers || {};
  const xff = (h['x-forwarded-for'] || h['X-Forwarded-For'] || '').split(',')[0].trim();
  const ip  = xff || h['x-real-ip'] || h['client-ip'] || 'anon';
  return ip;
}

/** 레이트 리밋 검사(슬라이딩 윈도우) */
function checkRateLimit(key) {
  const now = Date.now();
  let b = rateStore.get(key);
  if (!b) { b = { sec: [], min: [] }; rateStore.set(key, b); }

  // 윈도우 밖 이벤트 정리
  const secCut = now - WINDOW_SEC;
  while (b.sec.length && b.sec[0] <= secCut) b.sec.shift();

  const minCut = now - WINDOW_MIN;
  while (b.min.length && b.min[0] <= minCut) b.min.shift();

  const secRemain = SEC_LIMIT - b.sec.length;
  const minRemain = MIN_LIMIT - b.min.length;

  if (secRemain <= 0 || minRemain <= 0) {
    const secRetry = b.sec.length ? WINDOW_SEC - (now - b.sec[0]) : 0;
    const minRetry = b.min.length ? WINDOW_MIN - (now - b.min[0]) : 0;
    const retryMs  = Math.max(secRetry, minRetry, 0);
    return { limited: true, retryMs, secRemain: Math.max(0, secRemain), minRemain: Math.max(0, minRemain) };
  }

  // 토큰 소비(현재 요청 기록 push)
  b.sec.push(now);
  b.min.push(now);

  return {
    limited: false,
    secRemain: SEC_LIMIT - b.sec.length,
    minRemain: MIN_LIMIT - b.min.length
  };
}



// 서버리스 함수: 번호 생성 (통계/라벨/추천은 프론트 계산)
// Node 18+ 실행. 외부 라이브러리 불필요.

const NUM_MIN = 1;
const NUM_MAX = 45;
const MAX_EXCLUDE = 39;
const crypto = require("node:crypto");

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function parseIntList(arr) {
  const set = new Set();
  for (const x of arr || []) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= NUM_MIN && n <= NUM_MAX) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}
function rand() {
  const buf = crypto.randomBytes(7);
  const hex = buf.toString("hex");
  const int = parseInt(hex, 16) >> 3; // 상위 53비트
  return int / (2 ** 53);
}
function generateOneCombo(include, exclude, weighted, weightFactor) {
  const EXCLUDED = new Set(exclude);
  const WEIGHTED = new Set(weighted);
  const INC = include.filter(n => !EXCLUDED.has(n));

  const w = Number.isFinite(weightFactor) ? clamp(weightFactor, 0, 7) : 1;
  const NEED = 6;

  if (INC.length >= NEED + 1) {
    if (INC.length < NEED) throw new Error("포함 숫자가 부족합니다.");
    const pool = INC.map(n => ({
      number: n,
      score: rand() * (WEIGHTED.has(n) ? w : 1),
    }));
    pool.sort((a, b) => b.score - a.score);
    return pool.slice(0, NEED).map(x => x.number).sort((a, b) => a - b);
  }

  const result = [...INC];
  const remain = NEED - result.length;

  const candidates = [];
  for (let i = NUM_MIN; i <= NUM_MAX; i++) {
    if (EXCLUDED.has(i)) continue;
    if (INC.includes(i)) continue;
    const score = rand() * (WEIGHTED.has(i) ? w : 1);
    candidates.push({ number: i, score });
  }
  if (candidates.length < remain) {
    throw new Error("선택 가능한 숫자가 6개 미만입니다. 제외를 줄이세요.");
  }
  candidates.sort((a, b) => b.score - a.score);
  for (let i = 0; i < remain; i++) result.push(candidates[i].number);

  return result.sort((a, b) => a - b);
}

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders,                      // ← 추가
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  // ── Rate limit 체크 (요청 초반에) ───────────────
  const key = getClientKey(event);
  const rl  = checkRateLimit(key);
  if (rl.limited) {
    // 429 응답 + Retry-After 및 상태 헤더
    return json(
      429,
      { error: "과도한 번호 생성은 제한됩니다.", retryAfterMs: rl.retryMs },
      {
        "Retry-After": String(Math.ceil(rl.retryMs / 1000)),
        "X-RateLimit-Limit-Second": String(SEC_LIMIT),
        "X-RateLimit-Limit-Minute": String(MIN_LIMIT),
        "X-RateLimit-Remaining-Second": String(rl.secRemain),
        "X-RateLimit-Remaining-Minute": String(rl.minRemain),
      }
    );
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const include = parseIntList(body.include || []);
    const exclude = parseIntList(body.exclude || []);
    const weighted = parseIntList(body.weighted || []);
    let weightPercent = Number(body.weightPercent);
    if (!Number.isFinite(weightPercent)) weightPercent = 100;
    weightPercent = clamp(weightPercent, 0, 700);
    const weightFactor = weightPercent / 100;

    const count = clamp(parseInt(body.count || 2, 10) || 2, 1, 50);

    // 검증
    if (exclude.length > MAX_EXCLUDE) {
      return json(400, { error: `‘숫자 제외’는 최대 ${MAX_EXCLUDE}개까지 가능합니다.` });
    }
    const availableCount = (NUM_MAX - NUM_MIN + 1) - new Set(exclude).size;
    if (availableCount < 6) {
      return json(400, { error: "제외가 너무 많아 6개를 뽑을 수 없습니다. ‘숫자 제외’를 줄여주세요." });
    }

    // 생성
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push({ numbers: generateOneCombo(include, exclude, weighted, weightFactor) });
    }


    // 성공 응답에도 레이트 리밋 잔여치 헤더를 달아주면 클라이언트에서 참고하기 좋음
    return json(
      200,
      { ok: true, results },
      {
        "X-RateLimit-Limit-Second": String(SEC_LIMIT),
        "X-RateLimit-Limit-Minute": String(MIN_LIMIT),
        "X-RateLimit-Remaining-Second": String(rl.secRemain),
        "X-RateLimit-Remaining-Minute": String(rl.minRemain),
      }
    );
  } catch (e) {
    return json(500, { error: "Internal Server Error", detail: String(e?.message || e) });
  }
};