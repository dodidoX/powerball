// 서버리스 함수: 번호 "생성만" 담당
const NUM_MIN = 1;
const NUM_MAX = 45;
const MAX_EXCLUDE = 39;
const crypto = require("node:crypto");

// 유틸
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function parseIntList(arr) {
  const set = new Set();
  for (const x of arr || []) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= NUM_MIN && n <= NUM_MAX) set.add(n);
  }
  return Array.from(set).sort((a,b)=>a-b);
}
function rand() {
  const buf = crypto.randomBytes(7);
  const int = (parseInt(buf.toString("hex"), 16) >> 3);
  return int / (2 ** 53);
}

// 포함≤6: 모두 확정 + 나머지 채우기 / 포함≥7: 포함 집합에서만 6개 추출
function generateOneCombo(include, exclude, weighted, weightFactor) {
  const EXCLUDED = new Set(exclude);
  const WEIGHTED = new Set(weighted);
  const INC = include.filter(n => !EXCLUDED.has(n));

  const w = Number.isFinite(weightFactor) ? clamp(weightFactor, 0, 7) : 1;
  const NEED = 6;

  if (INC.length >= NEED + 1) {
    const pool = INC.map(n => ({
      number: n,
      score: rand() * (WEIGHTED.has(n) ? w : 1),
    }));
    pool.sort((a,b)=>b.score - a.score);
    return pool.slice(0, NEED).map(x=>x.number).sort((a,b)=>a-b);
  }

  const result = [...INC];
  const remain = NEED - result.length;

  const candidates = [];
  for (let i = NUM_MIN; i <= NUM_MAX; i++) {
    if (EXCLUDED.has(i)) continue;
    if (INC.includes(i)) continue;
    candidates.push({ number: i, score: rand() * (WEIGHTED.has(i) ? w : 1) });
  }
  if (candidates.length < remain) {
    throw new Error("선택 가능한 숫자가 6개 미만입니다. 제외를 줄이세요.");
  }
  candidates.sort((a,b)=>b.score - a.score);
  for (let i = 0; i < remain; i++) result.push(candidates[i].number);

  return result.sort((a,b)=>a-b);
}

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      // 같은 도메인이면 아래 2줄은 생략 가능
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}



exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true }); // 필요 없으면 제거
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const body = JSON.parse(event.body || "{}");

    const include = parseIntList(body.include || []);
    const exclude = parseIntList(body.exclude || []);
    const weighted = parseIntList(body.weighted || []);
    let weightPercent = Number(body.weightPercent);
    if (!Number.isFinite(weightPercent)) weightPercent = 100;
    const weightFactor = clamp(weightPercent, 0, 700) / 100;

    const count = clamp(parseInt(body.count || 2, 10) || 2, 1, 50);

    // 검증 유지
    if (exclude.length > MAX_EXCLUDE) {
      return json(400, { error: `‘숫자 제외’는 최대 ${MAX_EXCLUDE}개까지 가능합니다.` });
    }
    const availableCount = (NUM_MAX - NUM_MIN + 1) - new Set(exclude).size;
    if (availableCount < 6) {
      return json(400, { error: "제외가 너무 많아 6개를 뽑을 수 없습니다. ‘숫자 제외’를 줄여주세요." });
    }

    // 숫자만 생성
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push({ numbers: generateOneCombo(include, exclude, weighted, weightFactor) });
    }

    return json(200, { ok: true, results });
  } catch (e) {
    return json(500, { error: "Internal Server Error", detail: String(e?.message || e) });
  }
};
