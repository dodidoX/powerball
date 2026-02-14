// netlify/functions/get_numbers.js

let numbers;
try {
  numbers = require("./data/numbers.json");
} catch (e) {
  numbers = null;
}

function buildEmptyMatrix() {
  return Array.from({ length: 46 }, () => Array(46).fill(0));
}

function extractSixNumbers(item) {
  const nums = [];
  for (let k = 1; k <= 6; k++) {
    const v = parseInt(item[`number${k}`], 10);
    if (!Number.isFinite(v)) return null;
    nums.push(v);
  }
  return nums;
}

function computeCooccur(numbersJson) {
  const M = buildEmptyMatrix();

  for (const item of numbersJson) {
    const nums = extractSixNumbers(item);
    if (!nums) continue;

    // ✅ 대각선 포함(자기 자신도 출현횟수로 카운트)
    for (let a = 0; a < nums.length; a++) {
      const rowNum = nums[a];
      for (let b = 0; b < nums.length; b++) {
        const colNum = nums[b];
        M[rowNum][colNum] += 1;
      }
    }
  }
  return M;
}

function getRoundMinMax(arr) {
  let minR = Infinity;
  let maxR = -Infinity;
  for (const item of arr) {
    const r = parseInt(item.round, 10);
    if (!Number.isFinite(r)) continue;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }
  return {
    minRound: Number.isFinite(minR) ? minR : null,
    maxRound: Number.isFinite(maxR) ? maxR : null,
  };
}

function filterByRound(arr, start, end) {
  return arr.filter((item) => {
    const r = parseInt(item.round, 10);
    if (!Number.isFinite(r)) return false;
    return r >= start && r <= end;
  });
}

exports.handler = async (event) => {
  try {
    if (!numbers) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: "numbers.json load failed (require)",
          hint: "Ensure netlify/functions/data/numbers.json exists and is committed",
        }),
      };
    }

    const { minRound, maxRound } = getRoundMinMax(numbers);

    // 쿼리 파라미터
    const qs = event.queryStringParameters || {};
    let start = parseInt(qs.start, 10);
    let end = parseInt(qs.end, 10);

    // 기본값: 전체 범위
    if (!Number.isFinite(start)) start = minRound ?? 1;
    if (!Number.isFinite(end)) end = maxRound ?? start;

    // 안전장치
    if (minRound != null && start < minRound) start = minRound;
    if (maxRound != null && end > maxRound) end = maxRound;
    if (end < start) [start, end] = [end, start];

    const filtered = filterByRound(numbers, start, end);
    const matrix = computeCooccur(filtered);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // 버튼 조회가 잦으니 너무 길게 캐시 잡지 않는 편 추천
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({
        meta: {
          totalCount: numbers.length,
          filteredCount: filtered.length,
          minRound,
          maxRound,
          start,
          end,
        },
        matrix,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
