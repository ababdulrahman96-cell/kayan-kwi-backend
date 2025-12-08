// ======================================================
//  KWI WEBSITE AI AGENT - CHAT COMPLETIONS VERSION
// ======================================================

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ===============================================
//  WORDPRESS CONFIG
// ===============================================
const WP_URL = process.env.WP_URL;              // Example: https://kayanrecovery.com
const WP_USERNAME = process.env.WP_USERNAME;
const WP_PASSWORD = process.env.WP_PASSWORD;

// Encode WordPress Basic Auth
const WP_AUTH = Buffer.from(`${WP_USERNAME}:${WP_PASSWORD}`).toString("base64");

// ===============================================
//  WHICH PAGE TO EDIT? (HOMEPAGE ONLY - Guided Mode B)
// ===============================================
const TARGET_PAGE_ID = 195;   // homepage

// ===============================================
//  MAIN AI INSTRUCTIONS (system role)
// ===============================================
const KWI_INSTRUCTIONS = `
You are the autonomous Kayan Website Intelligence (KWI) agent.

Your job:
- Rewrite the page HTML in a clean, modern, medical-professional design.
- Improve UI/UX.
- Improve clarity, structure, headings, sections, CTAs.
- Improve SEO for addiction recovery, therapy, rehabilitation, and Egypt market.
- Use clean HTML only. No scripts, no CSS inside the HTML.
- Produce ONLY valid JSON in this format:

{
  "html": "<the full rewritten HTML>",
  "summary": "What you improved"
}

`;

// ===============================================
//  WORDPRESS HELPERS
// ===============================================
async function getPageContent(pageId) {
  const url = `${WP_URL}/wp-json/wp/v2/pages/${pageId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${WP_AUTH}`
    }
  });

  if (!res.ok) throw new Error(`Failed to fetch page ${pageId}`);
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
    const error = await res.text();
    throw new Error(`WordPress update error: ${error}`);
  }

  return await res.json();
}

// ===============================================
//  MAIN AI CALL — Chat Completions API
// ===============================================
async function runAIRewrite(htmlInput) {
  console.log("🧠 Sending rewrite request to OpenAI...");

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 4096,
    messages: [
      { role: "system", content: KWI_INSTRUCTIONS },
      { role: "user", content: `Rewrite this page:\n\n${htmlInput}` }
    ]
  });

  let raw = completion.choices[0].message.content;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("❌ JSON Parse Error:", err);
    console.error("RAW MODEL OUTPUT:\n", raw);
    throw new Error("Model returned invalid JSON.");
  }

  return parsed.html;
}

// ===============================================
//  AUTO-PILOT LOOP (Guided Mode: Homepage Only)
// ===============================================
async function autoPilot() {
  console.log("🌍 AUTO-PILOT CYCLE STARTED (Homepage Only)");

  try {
    console.log(`📄 Fetching Page ID ${TARGET_PAGE_ID}...`);
    const page = await getPageContent(TARGET_PAGE_ID);

    const currentHtml = page?.content?.rendered || "";
    console.log("📥 Current page HTML fetched.");

    console.log("🤖 Running AI rewrite...");
    const rewrittenHtml = await runAIRewrite(currentHtml);

    console.log("💾 Updating WordPress...");
    await updatePageContent(TARGET_PAGE_ID, rewrittenHtml);

    console.log(`✅ Finished Homepage (ID ${TARGET_PAGE_ID})`);
  } catch (err) {
    console.error("❌ EXTREME ERROR:", err.message);
  }

  console.log("⏳ Waiting 10 minutes before next cycle...\n\n");
  setTimeout(autoPilot, 10 * 60 * 1000);
}

// Start agent loop
setTimeout(autoPilot, 5000);

// ===============================================
//  EXPRESS SERVER
// ===============================================
app.get("/", (req, res) => {
  res.send("KWI Agent Running (Chat Completions Mode)");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 KWI server running at http://localhost:${PORT}`);
});
