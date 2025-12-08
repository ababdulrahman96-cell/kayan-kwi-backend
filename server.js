import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const WP_BASE_URL = process.env.WP_BASE_URL;
const WP_USERNAME = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const WP_HOMEPAGE_ID = process.env.WP_HOMEPAGE_ID;

if (!OPENAI_API_KEY || !WP_BASE_URL) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

console.log("🚀 KWI server running...");

async function runCycle() {
  console.log("🔄 AUTO-PILOT STARTED (Homepage Only)");
  console.log("🎯 Target Page ID:", WP_HOMEPAGE_ID);

  // --- Fetch WordPress HTML ---
  console.log("📥 Fetching WP HTML...");
  const wpRes = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/pages/${WP_HOMEPAGE_ID}`);
  const wpJson = await wpRes.json();

  const originalHTML = wpJson.content.rendered;

  // --- Rewrite using OpenAI ---
  console.log("✏️ Running AI rewrite...");

  const aiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "Rewrite the WordPress HTML to be modern, professional, medical-grade UI/UX. Keep ALL structure valid HTML.",
        },
        {
          role: "user",
          content: originalHTML,
        },
      ],
      text_format: "html",
    }),
  });

  const aiJson = await aiRes.json();

  if (aiJson.error) {
    console.error("❌ AI ERROR:", aiJson.error);
    return;
  }

  const newHTML = aiJson.output[0].content[0].text;

  // --- Send Update to WordPress ---
  console.log("💾 Updating WordPress...");

  await fetch(`${WP_BASE_URL}/wp-json/wp/v2/pages/${WP_HOMEPAGE_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString("base64"),
    },
    body: JSON.stringify({
      content: newHTML,
    }),
  });

  console.log("✅ Homepage updated successfully!");
}

// Run every 10 min
setInterval(runCycle, 10 * 60 * 1000);

app.get("/", (req, res) => {
  res.send("KWI Agent backend running.");
});

app.listen(4000, () => console.log("🌍 Server live on 4000"));
