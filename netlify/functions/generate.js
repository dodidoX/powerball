// 서버리스 함수: 번호 생성 + 통계 + 추천 판정
// Node 18+ 실행. 외부 라이브러리 불필요.

const NUM_MIN = 1;
const NUM_MAX = 45;
const BIG_W = 1e9; // 포함 숫자에 큰 가중치
const MAX_EXCLUDE = 39;
const crypto = require("node:crypto"); // 더 안전한 난수(선택)

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function parseIntList(arr) {
  // [1, " 2", 3] 같은 것도 정수로 정리, 범위 필터, 중복 제거
  const set = new Set();
  for (const x of arr || []) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= NUM_MIN && n <= NUM_MAX) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function rand() {
  // Math.random() 대신 crypto 기반 난수 (0<=x<1)
  // 53비트 무작위 → 부동소수로 변환
  const buf = crypto.randomBytes(7);
  const hex = buf.toString("hex");
  // 7바이트 = 56비트 중 상위 53비트 사용
  const int = parseInt(hex, 16) >> 3;
  return int / (2 ** 53);
}

function generateOneCombo(include, exclude, weighted, weightFactor) {
  const EXCLUDED = new Set(exclude);
  const WEIGHTED = new Set(weighted);

  // exclude에 걸린 포함 숫자는 방어적으로 제외
  const INC = include.filter(n => !EXCLUDED.has(n));

  const w = Number.isFinite(weightFactor) ? clamp(weightFactor, 0, 7) : 1;
  const NEED = 6;

  // ── 케이스 1) 포함이 7개 이상: 포함 집합에서만 6개 추출(가중치 교차 적용)
  if (INC.length >= NEED + 1) {
    if (INC.length < NEED) throw new Error("포함 숫자가 부족합니다.");
    const pool = INC.map(n => ({
      number: n,
      score: rand() * (WEIGHTED.has(n) ? w : 1), // 포함 집합 내부에서도 '가중치'로 편향 허용
    }));
    pool.sort((a, b) => b.score - a.score);
    return pool.slice(0, NEED).map(x => x.number).sort((a, b) => a - b);
  }

  // ── 케이스 2) 포함이 0~6개: 포함 숫자는 전부 '확정' + 나머지 뽑기
  const result = [...INC]; // 전부 반드시 포함
  const remain = NEED - result.length;

  // 후보: 제외되지 않았고, 이미 포함에 들어가지 않은 수들
  const candidates = [];
  for (let i = NUM_MIN; i <= NUM_MAX; i++) {
    if (EXCLUDED.has(i)) continue;
    if (INC.includes(i)) continue; // 이미 확정된 포함 숫자 제외
    let score = rand() * (WEIGHTED.has(i) ? w : 1);
    candidates.push({ number: i, score });
  }
  if (candidates.length < remain) {
    throw new Error("선택 가능한 숫자가 6개 미만입니다. 제외를 줄이세요.");
  }

  // 상위 remain개만 추가
  candidates.sort((a, b) => b.score - a.score);
  for (let i = 0; i < remain; i++) result.push(candidates[i].number);

  return result.sort((a, b) => a - b);
}

function consecutiveLabel(nums) {
  let maxRun = 1, run = 1;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] + 1 === nums[i + 1]) { run++; maxRun = Math.max(maxRun, run); }
    else run = 1;
  }
  return maxRun >= 3 ? `${maxRun}연번` : "";
}

function statsOf(nums) {
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / nums.length;
  const variance = nums.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / nums.length;
  const std = Math.sqrt(variance);
  const odd = nums.filter(n => n % 2 === 1).length;
  const even = nums.length - odd;
  return { sum, std: Number(std.toFixed(2)), odd, even };
}

function inRange(val, lo, hi) {
  if (!Number.isFinite(val) || !Number.isFinite(lo) || !Number.isFinite(hi)) return "";
  return (val >= lo && val <= hi) ? "추천" : "";
}

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // 같은 도메인이면 실제로 필요 없음
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const body = JSON.parse(event.body || "{}");

    // --- 입력 파싱 ---
    const include = parseIntList(body.include || []);
    const exclude = parseIntList(body.exclude || []);
    const weighted = parseIntList(body.weighted || []);
    let weightPercent = Number(body.weightPercent); // % 기준(0~700)
    if (!Number.isFinite(weightPercent)) weightPercent = 100;
    weightPercent = clamp(weightPercent, 0, 700);
    const weightFactor = weightPercent / 100;

    const count = clamp(parseInt(body.count || 2, 10) || 2, 1, 50);

    // 총합/표준편차 추천 범위(없으면 추천 공란)
    const sumMin = Number(body.sumMin);
    const sumMax = Number(body.sumMax);
    const stdMin = Number(body.stdMin);
    const stdMax = Number(body.stdMax);

    // --- 검증 ---
    if (exclude.length > MAX_EXCLUDE) {
      return json(400, { error: `‘숫자 제외’는 최대 ${MAX_EXCLUDE}개까지 가능합니다.` });
    }
    const availableCount = (NUM_MAX - NUM_MIN + 1) - new Set(exclude).size;
    if (availableCount < 6) {
      return json(400, { error: "제외가 너무 많아 6개를 뽑을 수 없습니다. ‘숫자 제외’를 줄여주세요." });
    }

    // --- 생성 ---
    const results = [];
    for (let i = 0; i < count; i++) {
      const nums = generateOneCombo(include, exclude, weighted, weightFactor);
      const cons = consecutiveLabel(nums);
      const st = statsOf(nums);
      results.push({
        numbers: nums,
        consecutive: cons,
        sum: st.sum,
        stddev: st.std,
        oddCount: st.odd,
        evenCount: st.even,
        sumRec: inRange(st.sum, sumMin, sumMax),
        stddevRec: inRange(st.std, stdMin, stdMax),
      });
    }

    return json(200, { ok: true, results });
  } catch (e) {
    return json(500, { error: "Internal Server Error", detail: String(e?.message || e) });
  }
};