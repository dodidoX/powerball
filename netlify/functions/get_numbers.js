// netlify/functions/get_numbers.js
const fs = require("fs");
const path = require("path");

exports.handler = async () => {
  try {
    // netlify/functions/get_numbers.js 기준으로
    // netlify/functions/data/numbers.json 읽기
    const filePath = path.join(__dirname, "data", "numbers.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300" // 필요 없으면 제거
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
