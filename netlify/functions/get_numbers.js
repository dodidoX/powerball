// netlify/functions/get_numbers.js

// 핵심: 번들러가 numbers.json을 같이 포함하도록 직접 require
let numbers;
try {
  numbers = require("./data/numbers.json");
} catch (e) {
  // 혹시 번들러/환경 차이 대비 (거의 안 탐)
  numbers = null;
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

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify(numbers),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
