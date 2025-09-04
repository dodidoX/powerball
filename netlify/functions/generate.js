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

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

const NUMBERS_N = 45;
const NEED = 6;
const MAX_EXCLUDE = 39;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

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
      const nums = generateOneCombo(include, exclude, weighted, weightFactor);
      results.push({ numbers: nums });
    }

    return json(200, { ok: true, results });
  } catch (e) {
    return json(500, { error: "Internal Server Error", detail: String(e?.message || e) });
  }
};
