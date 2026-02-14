// netlify/functions/get_numbers.js
const fs = require("fs");
const path = require("path");

function readJsonFileWithFallback(paths) {
  const tried = [];
  for (const p of paths) {
    try {
      tried.push(p);
      const raw = fs.readFileSync(p, "utf-8");
      return { raw, usedPath: p, tried };
    } catch (e) {
      // continue
    }
  }
  const err = new Error("ENOENT: numbers.json not found in any candidate paths");
  err.tried = tried;
  throw err;
}

exports.handler = async () => {
  try {
    // ✅ 너의 repo 구조 기준 (netlify/functions/data/numbers.json)
    // Netlify 번들에서는 included_files 설정에 의해 아래 경로가 생김
    const candidates = [
      path.join(__dirname, "data", "numbers.json"),                           // (일부 환경에서 이렇게 들어올 수 있음)
      path.join(__dirname, "netlify", "functions", "data", "numbers.json"),   // included_files가 repo 경로 그대로 복사될 때
      path.join(process.cwd(), "netlify", "functions", "data", "numbers.json")// 안전망
    ];

    const { raw } = readJsonFileWithFallback(candidates);

    // raw 자체가 JSON 문자열이므로 그대로 반환
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
      body: raw,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        error: String(err),
        tried: err.tried || [],
        hint: "Check netlify.toml [functions].included_files includes netlify/functions/data/*.json",
      }),
    };
  }
};
