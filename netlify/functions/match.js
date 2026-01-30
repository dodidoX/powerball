const fs = require("fs");
const path = require("path");



function toInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : NaN;
}

function validateInputs(inputs6) {
  // inputs6: ["1","2","5","6","9","45"] or numbers
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

    // 1등 lookup
    if (!p1Lookup.has(prize1)) {
      p1Lookup.set(prize1, {
        round: `${row.round}회차`,
        date: (row.drawingdate || "").trim(),
        money: (row.money || "").trim()
      });
    }

    // 2등 6개
    if (Array.isArray(row.prize2)) {
      row.prize2.forEach(k => {
        k = (k || "").trim();
        if (k) inc(p2Count, k, 1);
      });
    }

    // 3등 6개
    if (Array.isArray(row.prize3)) {
      row.prize3.forEach(k => {
        k = (k || "").trim();
        if (k) inc(p3Count, k, 1);
      });
    }

    // 4등 15개
    if (Array.isArray(row.prize4)) {
      row.prize4.forEach(k => {
        k = (k || "").trim();
        if (k) inc(p4Count, k, 1);
      });
    }

    // 5등 20개
    if (Array.isArray(row.prize5)) {
      row.prize5.forEach(k => {
        k = (k || "").trim();
        if (k) inc(p5Count, k, 1);
      });
    }
  });

  return { p1Lookup, p2Count, p3Count, p4Count, p5Count };
}


exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { rows } = JSON.parse(event.body || "{}"); // rows: [[n,n,n,n,n,n], ...]
    if (!Array.isArray(rows)) {
      return { statusCode: 400, body: JSON.stringify({ error: "rows must be an array" }) };
    }

    // 원천 데이터 로드
    const jsonPath = path.join(__dirname, "data", "draws.json");

    console.log("jsonPath:", jsonPath);
    console.log("exists:", fs.existsSync(jsonPath));

    const raw = fs.readFileSync(jsonPath, "utf-8");
    console.log("raw length:", raw.length);

    const draws = JSON.parse(raw);
    console.log("draws loaded, count:", draws.length);

    // 최신 회차/날짜(제목 표시용)
    const last = draws.reduce((acc, cur) => {
      if (!acc) return cur;
      return (Number(cur.round) > Number(acc.round)) ? cur : acc;
    }, null);

    const { p1Lookup, p2Count, p3Count, p4Count, p5Count } = buildMaps(draws);

    // 입력 rows 계산
    const results = rows.map((row6) => {
      const v = validateInputs(Array.isArray(row6) ? row6 : []);
      if (!v.ok) return { ok:false, message: v.message };

      const nums = v.nums; // number[6] (오름차순 검증됨)
      const [C2,D2,E2,F2,G2,H2] = nums.map(String);
      const combo6 = `${C2}-${D2}-${E2}-${F2}-${G2}-${H2}`;

      // 2등(6개 완전일치)
      const count2 = p2Count.get(combo6) || 0;

      // 3등(6C5 6개 비교 합산)
      const combos5 = sixC5(C2,D2,E2,F2,G2,H2);
      let raw3 = 0;
      combos5.forEach(k => raw3 += (p3Count.get(k) || 0));

      // 보정: 1등이면 -6, 2등이면 -count2
      const has1 = p1Lookup.has(combo6);
      let adjusted3 = raw3;
      if (has1) adjusted3 -= 6;
      if (count2 > 0) adjusted3 -= count2;
      if (adjusted3 < 0) adjusted3 = 0;

      // 4등(6C4 15개 비교 합산)
      const combos4 = sixC4(C2,D2,E2,F2,G2,H2);
      let raw4 = 0;
      combos4.forEach(k => raw4 += (p4Count.get(k) || 0));

      const count1 = has1 ? 1 : 0;
      let adjusted4 = raw4 - (count1 * 15) - (count2 * 5) - (adjusted3 * 5);
      if (adjusted4 < 0) adjusted4 = 0;

      // 5등(6C3 20개 비교 합산)
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
