import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================
//  KWI CORE INSTRUCTIONS
// ==========================
const KWI_INSTRUCTIONS = `
You are Kayan Website Intelligence (KWI), an autonomous agent that manages a WordPress site
for a medical drug-addiction recovery center (Kayan Recovery Center in Egypt).

You specialize in:
- Modern, professional medical UI/UX
- SEO for addiction treatment & rehab keywords
- Conversion-focused content (trust, safety, contact/WhatsApp/call)
- Arabic and English content

You ONLY control the HTML content of individual WordPress pages for now (no theme PHP editing yet).
Focus on layout, hierarchy, sections, clarity, and conversion.

You MUST always return ONE JSON object in EXACTLY this shape:

{
  "page_html": "string, full HTML for the WordPress page content",
  "seo": {
    "title": "string",
    "description": "string",
    "keywords": ["string"]
  },
  "language": "ar or en"
}

Hard rules:
- No extra top-level fields.
- No comments.
- No Markdown.
- If unsure about a value, use "" or [].
- "page_html" must be valid HTML that can be stored into WordPress page.content.
`;

const wpBase = process.env.WP_BASE_URL;
const wpUser = process.env.WP_USERNAME;
const wpPass = process.env.WP_APP_PASSWORD;

if (!wpBase || !wpUser || !wpPass) {
  console.warn("⚠ Missing WP_BASE_URL / WP_USERNAME / WP_APP_PASSWORD env vars.");
}

// ==========================
//  WORDPRESS HELPERS
// ==========================

async function fetchWPPage(id) {
  const url = `${wpBase}/wp-json/wp/v2/pages/${id}`;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  const r = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`WP fetch failed (${r.status}): ${body}`);
  }

  return r.json();
}

async function updateWPPage(id, newContent) {
  const url = `${wpBase}/wp-json/wp/v2/pages/${id}`;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: newContent }),
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`WP update failed (${r.status}): ${body}`);
  }

  return r.json();
}

// ==========================
//   EXTREME REWRITE ROUTE
// ==========================

app.post("/kwi/rewrite/:id", async (req, res) => {
  try {
    const pageId = req.params.id;
    const language = req.body.language || "en";

    console.log(`\n⚡ EXTREME REWRITE TRIGGERED for Page ID ${pageId}`);

    // 1) Fetch current page
    const page = await fetchWPPage(pageId);
    const content = page.content?.rendered || "";
    const title = page.title?.rendered || "Untitled Page";
    const slug = page.slug || "";

    // 2) Build prompt with context
    const extremePrompt = `
Site niche: medical drug addiction and rehab center in Egypt (Kayan Recovery Center).
Target: people and families searching online for help.

Page ID: ${pageId}
Page slug: ${slug}
Page title: ${title}
Preferred language: ${language}

Current HTML content:
"""${content}"""
`;

// 3) Call OpenAI with JSON output (fully compatible with older SDK version)
const completion = await openai.responses.create({
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  instructions: KWI_INSTRUCTIONS,
  input: extremePrompt,
  response: { format: "json" }, // <-- COMPATIBLE FORMAT
  max_output_tokens: 4096
});

// Extract JSON from old-style API shape:
let raw;
try {
  raw = completion.output_text;
} catch (e) {
  console.error("❌ Could not extract JSON:", e);
  throw new Error("OpenAI response format not recognized.");
}

console.log("🔎 Raw model JSON:", raw);

let json;
try {
  json = JSON.parse(raw);
} catch (parseErr) {
  console.error("❌ Failed to parse JSON:", parseErr);
  throw new Error("Model did not return valid JSON string.");
}

    // 4) Update page content in WP
    const newContent =
      json.page_html && json.page_html.trim().length > 0
        ? json.page_html
        : content;

    const updatedPage = await updateWPPage(pageId, newContent);
    console.log(`✔ EXTREME REWRITE COMPLETE for Page ${pageId}`);

    res.json({
      status: "success",
      updated_page: updatedPage,
      model_output: json,
    });
  } catch (error) {
    console.error("EXTREME ERROR:", error);
    res.status(500).json({
      error: "KWI extreme rewrite failed",
      details: error.message,
    });
  }
});

// ==========================
//     AUTO-PILOT LOOP
// ==========================

// Guided mode: only homepage for now
const HOMEPAGE_ID = process.env.WP_HOMEPAGE_ID || "195";

async function autoPilot() {
  console.log("\n🤖 AUTO-PILOT CYCLE STARTED (GUIDED MODE: HOMEPAGE ONLY)");

  try {
    console.log(`\n🔄 Auto-rewriting Homepage (ID ${HOMEPAGE_ID})...`);
    await fetch(`http://localhost:${process.env.PORT}/kwi/rewrite/${HOMEPAGE_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ar" }), // change to "en" if you prefer English
    });
    console.log(`✔ Finished Homepage ${HOMEPAGE_ID}`);
  } catch (err) {
    console.log(`❌ Failed on Homepage ${HOMEPAGE_ID}:`, err.message);
  }

  console.log("\n⏳ Waiting 10 minutes before next cycle...");
  setTimeout(autoPilot, 10 * 60 * 1000);
}

// Start loop a few seconds after boot
setTimeout(autoPilot, 5000);

// ==========================
//       START SERVER
// ==========================

app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log(`KWI server running at http://localhost:${process.env.PORT}`);
});
