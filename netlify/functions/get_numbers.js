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

    // ✅ 같은 회차에서 (자기 자신 포함) 함께출현 카운트
    for (let a = 0; a < nums.length; a++) {
      const rowNum = nums[a];
      for (let b = 0; b < nums.length; b++) {
        const colNum = nums[b];
        M[rowNum][colNum] += 1; // 대각선 포함
      }
    }
  }
  return M;
}

function getMeta(numbersJson) {
  // round 최대/최소 정도만 간단히
  let minRound = Infinity;
  let maxRound = -Infinity;

  for (const item of numbersJson) {
    const r = parseInt(item.round, 10);
    if (!Number.isFinite(r)) continue;
    if (r < minRound) minRound = r;
    if (r > maxRound) maxRound = r;
  }

  return {
    count: numbersJson.length,
    minRound: Number.isFinite(minRound) ? minRound : null,
    maxRound: Number.isFinite(maxRound) ? maxRound : null,
  };
}

exports.handler = async () => {
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

    const matrix = computeCooccur(numbers);
    const meta = getMeta(numbers);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify({
        meta,
        // 0행/0열은 미사용이지만 그대로 주는 게 렌더가 단순함
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
