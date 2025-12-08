// ======================================================
//  KWI WEBSITE AI AGENT  (Chat Completions Version)
//  Fully aligned with your Render environment variables
// ======================================================

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(express.json());

// ---------------------------
//  OPENAI CLIENT
// ---------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------------------------
//  WORDPRESS CONFIG (MATCHES YOUR ENV VARS)
// ---------------------------
const WP_URL = process.env.WP_BASE_URL;             // https://kayanrecovery.com
const WP_USERNAME = process.env.WP_USERNAME;        // WP admin username
const WP_PASSWORD = process.env.WP_APP_PASSWORD;    // Application Password
const HOMEPAGE_ID = process.env.WP_HOMEPAGE_ID;     // Should be "195"

// Basic Auth token
const WP_AUTH = Buffer.from(`${WP_USERNAME}:${WP_PASSWORD}`).toString("base64");

// ---------------------------
//  AI INSTRUCTIONS
// ---------------------------
const KWI_INSTRUCTIONS = `
You are the Kayan Website Intelligence Agent.

Your job:
- Rewrite the homepage HTML in a modern, medical-professional design.
- Improve UI/UX, structure, readability, and flow.
- Add SEO keywords for addiction recovery, Egypt region, therapy, rehabilitation.
- Use only clean HTML (no CSS, no JS).
- Produce ONLY JSON in this structure:

{
  "html": "<full rewritten HTML>",
  "summary": "short explanation of improvements"
}
`;

// ---------------------------
//  WORDPRESS HELPERS
// ---------------------------
async function getPageContent(pageId) {
  const url = `${WP_URL}/wp-json/wp/v2/pages/${pageId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${WP_AUTH}`
    }
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Failed fetching WP page: ${t}`);
  }

  return await res.json();
}

async function updatePageContent(pageId, newHtml) {
  const url = `${WP_URL}/wp-json/wp/v2/pages/${pageId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${WP_AUTH}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: newHtml
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WP Update Error: ${t}`);
  }

  return await res.json();
}

// ---------------------------
//  AI REWRITE USING CHAT COMPLETIONS
// ---------------------------
async function runAIRewrite(htmlInput) {
  console.log("🤖 Sending rewrite request to OpenAI...");

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: 4096,
    messages: [
      { role: "system", content: KWI_INSTRUCTIONS },
      { role: "user", content: `Rewrite this page HTML:\n\n${htmlInput}` }
    ]
  });

  let raw = completion.choices[0].message.content;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("❌ JSON Parse Error:", raw);
    throw new Error("Model returned invalid JSON.");
  }

  return parsed.html;
}

// ---------------------------
//  AUTO-PILOT CYCLE
// ---------------------------
async function autoPilot() {
  console.log("🌍 AUTO-PILOT STARTED (Homepage Only)");
  console.log(`📄 Target Page ID: ${HOMEPAGE_ID}`);

  try {
    const page = await getPageContent(HOMEPAGE_ID);
    const currentHtml = page?.content?.rendered || "";

    console.log("✏️ Running AI rewrite...");
    const rewrittenHtml = await runAIRewrite(currentHtml);

    console.log("💾 Updating WordPress page...");
    await updatePageContent(HOMEPAGE_ID, rewrittenHtml);

    console.log("✅ Homepage rewrite completed successfully!");
  } catch (err) {
    console.error("❌ EXTREME ERROR:", err.message);
  }

  console.log("⏳ Waiting 10 minutes before next cycle...\n\n");
  setTimeout(autoPilot, 10 * 60 * 1000);
}

// Start in 5 seconds
setTimeout(autoPilot, 5000);

// ---------------------------
//  EXPRESS SERVER
// ---------------------------
app.get("/", (req, res) => {
  res.send("KWI Agent Running (Homepage Rewrite Mode)");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 KWI server running at http://localhost:${PORT}`);
});
