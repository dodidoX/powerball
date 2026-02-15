// netlify/functions/count_numbers.js

let numbers;

try {
  numbers = require("./data/numbers.json");
} catch (e) {
  numbers = null;
}


// 회차 최소/최대 계산
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
    minRound: Number.isFinite(minR) ? minR : 1,
    maxRound: Number.isFinite(maxR) ? maxR : 1,
  };

}


// 회차 필터
function filterByRound(arr, start, end) {

  return arr.filter(item => {

    const r = parseInt(item.round, 10);

    if (!Number.isFinite(r)) return false;

    return r >= start && r <= end;

  });

}


// handler
exports.handler = async (event) => {

  try {

    if (!numbers) {

      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "numbers.json load failed"
        })
      };

    }

    const { minRound, maxRound } = getRoundMinMax(numbers);

    const qs = event.queryStringParameters || {};

    let start = parseInt(qs.start, 10);
    let end = parseInt(qs.end, 10);

    if (!Number.isFinite(start)) start = minRound;
    if (!Number.isFinite(end)) end = maxRound;

    if (start < minRound) start = minRound;
    if (end > maxRound) end = maxRound;

    if (end < start) [start, end] = [end, start];

    const filtered = filterByRound(numbers, start, end);

    // ✅ 핵심 수정: matrix 대신 numbers 반환
    return {

      statusCode: 200,

      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60"
      },

      body: JSON.stringify({

        meta: {
          totalCount: numbers.length,
          filteredCount: filtered.length,
          minRound,
          maxRound,
          start,
          end
        },

        numbers: filtered   

      })

    };

  }

  catch (err) {

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: String(err)
      })
    };

  }

};
