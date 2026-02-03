const fs = require("fs");
const path = require("path");

// =========================
// 1) 데이터 로드: handler 밖(전역)
//    - require는 Netlify에서 번들에 포함되며, 웜 상태면 캐시됨
// =========================
const draws = require("./data/draws.json");

// =========================
// 2) 캐시(웜 인스턴스에서 재사용)
// =========================
let cached = null;
// cached = { last, maps: { p1Lookup, p2Count, p3Count, p4Count, p5Count } }

function toInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : NaN;
}

function validateInputs(inputs6) {
  const raw = inputs6.map(v => (v === "" || v == null ? "" : String(v).trim()));
  if (raw.some(v => v === "")) return { ok: false, message: "숫자를 더 입력하세요" };

  const nums = raw.map(v => toInt(v));
  if (nums.some(n => !Number.isFinite(n))) return { ok: false, message: "숫자를 더 입력하세요" };

  const uniq = new Set(nums);
  if (uniq.size !== nums.length) return { ok: false, message: "중복 입력된 숫자를 확인하세요" };

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] <= nums[i - 1]) return { ok: false, message: "작은 순서대로 입력하세요" };
  }

  return { ok: true, nums, raw };
}

function sixC5(a,b,c,d,e,f){
  return [
    `${a}-${b}-${c}-${d}-${e}`,
    `${a}-${b}-${c}-${d}-${f}`,
    `${a}-${b}-${c}-${e}-${f}`,
    `${a}-${b}-${d}-${e}-${f}`,
    `${a}-${c}-${d}-${e}-${f}`,
    `${b}-${c}-${d}-${e}-${f}`,
  ];
}

function sixC4(a,b,c,d,e,f){
  return [
    `${a}-${b}-${c}-${d}`,`${a}-${b}-${c}-${e}`,`${a}-${b}-${c}-${f}`,
    `${a}-${b}-${d}-${e}`,`${a}-${b}-${d}-${f}`,`${a}-${b}-${e}-${f}`,
    `${a}-${c}-${d}-${e}`,`${a}-${c}-${d}-${f}`,`${a}-${c}-${e}-${f}`,
    `${a}-${d}-${e}-${f}`,
    `${b}-${c}-${d}-${e}`,`${b}-${c}-${d}-${f}`,`${b}-${c}-${e}-${f}`,
    `${b}-${d}-${e}-${f}`,
    `${c}-${d}-${e}-${f}`,
  ];
}

function sixC3(a,b,c,d,e,f){
  return [
    `${a}-${b}-${c}`,`${a}-${b}-${d}`,`${a}-${b}-${e}`,`${a}-${b}-${f}`,
    `${a}-${c}-${d}`,`${a}-${c}-${e}`,`${a}-${c}-${f}`,
    `${a}-${d}-${e}`,`${a}-${d}-${f}`,`${a}-${e}-${f}`,
    `${b}-${c}-${d}`,`${b}-${c}-${e}`,`${b}-${c}-${f}`,
    `${b}-${d}-${e}`,`${b}-${d}-${f}`,`${b}-${e}-${f}`,
    `${c}-${d}-${e}`,`${c}-${d}-${f}`,`${c}-${e}-${f}`,
    `${d}-${e}-${f}`,
  ];
}

function inc(map, key, delta=1){
  map.set(key, (map.get(key) || 0) + delta);
}

function buildMaps(draws) {
  const p1Lookup = new Map();
  const p2Count  = new Map();
  const p3Count  = new Map();
  const p4Count  = new Map();
  const p5Count  = new Map();

  draws.forEach(row => {
    const prize1 = (row.prize1 || "").trim();
    if (!prize1) return;

    if (!p1Lookup.has(prize1)) {
      p1Lookup.set(prize1, {
        round: `${row.round}회차`,
        date: (row.drawingdate || "").trim(),
        money: (row.money || "").trim()
      });
    }

    if (Array.isArray(row.prize2)) row.prize2.forEach(k => { k=(k||"").trim(); if (k) inc(p2Count, k, 1); });
    if (Array.isArray(row.prize3)) row.prize3.forEach(k => { k=(k||"").trim(); if (k) inc(p3Count, k, 1); });
    if (Array.isArray(row.prize4)) row.prize4.forEach(k => { k=(k||"").trim(); if (k) inc(p4Count, k, 1); });
    if (Array.isArray(row.prize5)) row.prize5.forEach(k => { k=(k||"").trim(); if (k) inc(p5Count, k, 1); });
  });

  return { p1Lookup, p2Count, p3Count, p4Count, p5Count };
}

// =========================
// 3) 캐시 생성 함수 (처음 한 번만 buildMaps)
// =========================
function getCached() {
  if (cached) return cached;

  const last = draws.reduce((acc, cur) => {
    if (!acc) return cur;
    return (Number(cur.round) > Number(acc.round)) ? cur : acc;
  }, null);

  const maps = buildMaps(draws);

  cached = { last, maps };
  return cached;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { rows } = JSON.parse(event.body || "{}");
    if (!Array.isArray(rows)) {
      return { statusCode: 400, body: JSON.stringify({ error: "rows must be an array" }) };
    }

    // ✅ 여기서 캐시 꺼내쓰기
    const { last, maps } = getCached();
    const { p1Lookup, p2Count, p3Count, p4Count, p5Count } = maps;

    const results = rows.map((row6) => {
      const v = validateInputs(Array.isArray(row6) ? row6 : []);
      if (!v.ok) return { ok:false, message: v.message };

      const nums = v.nums;
      const [C2,D2,E2,F2,G2,H2] = nums.map(String);
      const combo6 = `${C2}-${D2}-${E2}-${F2}-${G2}-${H2}`;

      const count2 = p2Count.get(combo6) || 0;

      const combos5 = sixC5(C2,D2,E2,F2,G2,H2);
      let raw3 = 0;
      combos5.forEach(k => raw3 += (p3Count.get(k) || 0));

      const has1 = p1Lookup.has(combo6);
      let adjusted3 = raw3;
      if (has1) adjusted3 -= 6;
      if (count2 > 0) adjusted3 -= count2;
      if (adjusted3 < 0) adjusted3 = 0;

      const combos4 = sixC4(C2,D2,E2,F2,G2,H2);
      let raw4 = 0;
      combos4.forEach(k => raw4 += (p4Count.get(k) || 0));

      const count1 = has1 ? 1 : 0;
      let adjusted4 = raw4 - (count1 * 15) - (count2 * 5) - (adjusted3 * 5);
      if (adjusted4 < 0) adjusted4 = 0;

      const combos3 = sixC3(C2,D2,E2,F2,G2,H2);
      let raw5 = 0;
      combos3.forEach(k => raw5 += (p5Count.get(k) || 0));

      let adjusted5 = raw5 - (count1 * 20) - (count2 * 10) - (adjusted3 * 10) - (adjusted4 * 4);
      if (adjusted5 < 0) adjusted5 = 0;

      const found1 = p1Lookup.get(combo6);

      return {
        ok: true,
        turn: found1 ? found1.round : "-",
        date: found1 ? found1.date : "-",
        money: found1 ? found1.money : "-",
        r2: count2,
        r3: adjusted3,
        r4: adjusted4,
        r5: adjusted5
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meta: last ? { round: last.round, drawingdate: last.drawingdate } : null,
        results
      })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};

