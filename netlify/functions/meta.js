// netlify/functions/meta.js
const draws = require("./data/draws.json");

function findLast(drawsArr) {
  if (!Array.isArray(drawsArr) || drawsArr.length === 0) return null;
  return drawsArr.reduce((acc, cur) => {
    if (!acc) return cur;
    return Number(cur.round) > Number(acc.round) ? cur : acc;
  }, null);
}

exports.handler = async () => {
  try {
    const last = findLast(draws);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // 캐시가 필요하면 아래 조절(원하면)
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({
        meta: last ? { round: last.round, drawingdate: last.drawingdate } : null
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) })
    };
  }
};
