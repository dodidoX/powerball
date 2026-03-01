// /netlify/functions/generate.js

// ── Rate limit 설정 ─────────────────────────────────────
const SEC_LIMIT = 5;
const MIN_LIMIT = 250;
const WINDOW_SEC = 1000;
const WINDOW_MIN = 60000;

// 인스턴스가 warm 상태인 동안 유지되는 메모리 맵(IP별 타임스탬프 큐)
const rateStore = new Map();

/** 클라이언트 키(IP) 추출 */
function getClientKey(event) {
  const h = event.headers || {};
  const xff = (h["x-forwarded-for"] || h["X-Forwarded-For"] || "").split(",")[0].trim();
  const ip = xff || h["x-real-ip"] || h["client-ip"] || "anon";
  return ip;
}

/** 레이트 리밋 검사(슬라이딩 윈도우) */
function checkRateLimit(key) {
  const now = Date.now();
  let b = rateStore.get(key);
  if (!b) { b = { sec: [], min: [] }; rateStore.set(key, b); }

  const secCut = now - WINDOW_SEC;
  while (b.sec.length && b.sec[0] <= secCut) b.sec.shift();

  const minCut = now - WINDOW_MIN;
  while (b.min.length && b.min[0] <= minCut) b.min.shift();

  const secRemain = SEC_LIMIT - b.sec.length;
  const minRemain = MIN_LIMIT - b.min.length;

  if (secRemain <= 0 || minRemain <= 0) {
    const secRetry = b.sec.length ? WINDOW_SEC - (now - b.sec[0]) : 0;
    const minRetry = b.min.length ? WINDOW_MIN - (now - b.min[0]) : 0;
    const retryMs = Math.max(secRetry, minRetry, 0);
    return { limited: true, retryMs, secRemain: Math.max(0, secRemain), minRemain: Math.max(0, minRemain) };
  }

  b.sec.push(now);
  b.min.push(now);

  return {
    limited: false,
    secRemain: SEC_LIMIT - b.sec.length,
    minRemain: MIN_LIMIT - b.min.length
  };
}

// ── 공통 유틸 ───────────────────────────────────────────
const crypto = require("node:crypto");

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function parseIntListRange(arr, min, max) {
  const set = new Set();
  for (const x of arr || []) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= min && n <= max) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function rand01() {
  // 53-bit 정밀도 랜덤(crypto)
  const buf = crypto.randomBytes(7);
  const hex = buf.toString("hex");
  const int = (parseInt(hex, 16) >> 3); // 상위 53비트
  return int / (2 ** 53);
}

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// ── White Ball: 69C5 ────────────────────────────────────
const WB_MIN = 1;
const WB_MAX = 69;
const WB_NEED = 5;
const WB_MAX_EXCLUDE = 64; // 69 중 64 제외까지 허용(=최소 5개 남김)

// weightPercent: 0~1500% → factor: 0~15
function generateWhiteCombo(include, exclude, weighted, weightFactor) {
  const EXCLUDED = new Set(exclude);
  const WEIGHTED = new Set(weighted);
  const INC = include.filter(n => !EXCLUDED.has(n));

  const w = Number.isFinite(weightFactor) ? clamp(weightFactor, 0, 15) : 1;

  // include가 5개 이상이면 include 안에서만 5개 선택(가중치 반영)
  if (INC.length >= WB_NEED) {
    const pool = INC.map(n => ({
      number: n,
      score: rand01() * (WEIGHTED.has(n) ? w : 1),
    }));
    pool.sort((a, b) => b.score - a.score);
    return pool.slice(0, WB_NEED).map(x => x.number).sort((a, b) => a - b);
  }

  // include가 0~4면: include는 고정 + 나머지 후보에서 뽑기
  const result = [...INC];
  const remain = WB_NEED - result.length;

  const candidates = [];
  for (let i = WB_MIN; i <= WB_MAX; i++) {
    if (EXCLUDED.has(i)) continue;
    if (INC.includes(i)) continue;
    const score = rand01() * (WEIGHTED.has(i) ? w : 1);
    candidates.push({ number: i, score });
  }

  if (candidates.length < remain) {
    throw new Error("선택 가능한 White 숫자가 5개 미만입니다. 제외를 줄이세요.");
  }

  candidates.sort((a, b) => b.score - a.score);
  for (let i = 0; i < remain; i++) result.push(candidates[i].number);

  return result.sort((a, b) => a - b);
}

// ── Power Ball: 26C1 ───────────────────────────────────
const PB_MIN = 1;
const PB_MAX = 26;
const PB_MAX_EXCLUDE = 25;

function generatePowerballOne(pbInclude, pbExclude, pbWeighted, pbWeightFactor) {
  const EX = new Set(pbExclude);
  const WG = new Set(pbWeighted);

  // include가 있으면 include 풀에서 1개, 없으면 전체(1~26)에서 exclude 제외
  const inc = pbInclude.filter(n => !EX.has(n));
  const pool = (inc.length > 0)
    ? inc
    : Array.from({ length: PB_MAX - PB_MIN + 1 }, (_, i) => PB_MIN + i).filter(n => !EX.has(n));

  if (pool.length < 1) {
    throw new Error("선택 가능한 Power Ball 숫자가 없습니다. 제외를 줄이세요.");
  }

  const w = Number.isFinite(pbWeightFactor) ? clamp(pbWeightFactor, 0, 15) : 1;

  // “가중치가 있는 숫자”가 랜덤 점수에서 더 유리하도록 스코어링
  let best = pool[0];
  let bestScore = -1;

  for (const n of pool) {
    const score = rand01() * (WG.has(n) ? w : 1);
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

// ── Handler ─────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  // Rate limit 체크
  const key = getClientKey(event);
  const rl = checkRateLimit(key);

  if (rl.limited) {
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

    // White Ball 입력
    const include = parseIntListRange(body.include || [], WB_MIN, WB_MAX);
    const exclude = parseIntListRange(body.exclude || [], WB_MIN, WB_MAX);
    const weighted = parseIntListRange(body.weighted || [], WB_MIN, WB_MAX);

    // Power Ball 입력(프론트에 로직 노출 없이, 입력만 받음)
    const pbInclude = parseIntListRange(body.pbInclude || [], PB_MIN, PB_MAX);
    const pbExclude = parseIntListRange(body.pbExclude || [], PB_MIN, PB_MAX);
    const pbWeighted = parseIntListRange(body.pbWeighted || [], PB_MIN, PB_MAX);

    // weightPercent: 0~1500%
    let weightPercent = Number(body.weightPercent);
    if (!Number.isFinite(weightPercent)) weightPercent = 100;
    weightPercent = clamp(weightPercent, 0, 1500);
    const weightFactor = weightPercent / 100;

    let pbWeightPercent = Number(body.pbWeightPercent);
    if (!Number.isFinite(pbWeightPercent)) pbWeightPercent = 100;
    pbWeightPercent = clamp(pbWeightPercent, 0, 1500);
    const pbWeightFactor = pbWeightPercent / 100;

    const count = clamp(parseInt(body.count || 2, 10) || 2, 1, 50);

    // ── 검증(White) ───────────────────────────────
    if (exclude.length > WB_MAX_EXCLUDE) {
      return json(400, { error: `‘White 숫자 제외’는 최대 ${WB_MAX_EXCLUDE}개까지 가능합니다.` });
    }
    const wbAvailable = (WB_MAX - WB_MIN + 1) - new Set(exclude).size;
    if (wbAvailable < WB_NEED) {
      return json(400, { error: "White 제외가 너무 많아 5개를 뽑을 수 없습니다. ‘숫자 제외’를 줄여주세요." });
    }

    // ── 검증(Power) ───────────────────────────────
    if (pbExclude.length > PB_MAX_EXCLUDE) {
      return json(400, { error: `‘Power 숫자 제외’는 최대 ${PB_MAX_EXCLUDE}개까지 가능합니다.` });
    }
    const pbAvailable = (PB_MAX - PB_MIN + 1) - new Set(pbExclude).size;
    if (pbAvailable < 1) {
      return json(400, { error: "Power 제외가 너무 많아 1개를 뽑을 수 없습니다. ‘숫자 제외’를 줄여주세요." });
    }

    // ── 생성(White 5개 + Power 1개) ──────────────
    const results = [];
    for (let i = 0; i < count; i++) {
      const numbers = generateWhiteCombo(include, exclude, weighted, weightFactor);
      const power = generatePowerballOne(pbInclude, pbExclude, pbWeighted, pbWeightFactor);
      results.push({ numbers, power });
    }

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