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
//  STRICT JSON INSTRUCTIONS
// ==========================
const KWI_INSTRUCTIONS = `
You are Kayan Website Intelligence (KWI), an autonomous SEO, UX, content, and web optimization agent.

ALWAYS respond ONLY as JSON (never text outside JSON). Format:

{
  "answer": "string",
  "language": "en or ar",
  "seo_suggestions": ["string"],
  "ux_suggestions": ["string"],
  "content_changes": [
      { "page": "string", "change": "string" }
  ]
}

No explanations. No extra fields. No comments. If unknown, return empty strings or empty arrays.
`;

// ==========================
//  WORDPRESS FETCH HELPERS
// ==========================

const wpBase = process.env.WP_BASE_URL;
const wpUser = process.env.WP_USERNAME;
const wpPass = process.env.WP_APP_PASSWORD;

async function fetchWPPage(id) {
  const url = `${wpBase}/wp-json/wp/v2/pages/${id}`;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  const r = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
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

  return r.json();
}

// ==========================
//   EXTREME REWRITE ENDPOINT
// ==========================

app.post("/kwi/rewrite/:id", async (req, res) => {
  try {
    const pageId = req.params.id;
    const language = req.body.language || "en";

    console.log(`\n⚡ EXTREME REWRITE TRIGGERED for Page ID ${pageId}`);

    const page = await fetchWPPage(pageId);

    const content = page.content?.rendered || "";
    const title = page.title?.rendered || "Untitled Page";

    const prompt = `
Rewrite the following WordPress page content in EXTREME MODE.
Improve SEO, UX, quality, clarity, and rewrite aggressively.

Return ONLY JSON as instructed.

Page Title: ${title}
Language: ${language}
Content: """${content}"""
`;

const completion = await openai.responses.create({
  model: "gpt-4.1",
  input: extremePrompt,
  text: { format: "json" }   // ⭐ FIXED
});

    const raw = completion.output_text;
    const json = JSON.parse(raw);

    const newContent = `
<h1>${json.answer}</h1>
<p><strong>SEO:</strong></p>
<ul>${json.seo_suggestions.map(s => `<li>${s}</li>`).join("")}</ul>

<p><strong>UX:</strong></p>
<ul>${json.ux_suggestions.map(s => `<li>${s}</li>`).join("")}</ul>
    `;

    const updated = await updateWPPage(pageId, newContent);

    console.log(`✔ EXTREME REWRITE COMPLETE for Page ${pageId}`);

    res.json({
      status: "success",
      updated_page: updated,
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

const PAGES = [
  process.env.WP_HOMEPAGE_ID,
  "197",
  "199",
  "201",
  "203",
  "243"
];

async function autoPilot() {
  console.log("\n🤖 AUTO-PILOT CYCLE STARTED");

  for (const id of PAGES) {
    try {
      console.log(`\n🔄 Auto-rewriting Page (ID ${id})...`);
      await fetch(`http://localhost:${process.env.PORT}/kwi/rewrite/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "ar" }),
      });
      console.log(`✔ Finished Page ${id}`);
    } catch (err) {
      console.log(`❌ Failed on Page ${id}:`, err.message);
    }
  }

  console.log("\n⏳ Waiting 10 minutes before next cycle...");
  setTimeout(autoPilot, 10 * 60 * 1000);
}

// Start loop
setTimeout(autoPilot, 5000);

// ==========================
//       START SERVER
// ==========================

app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log(`KWI server running at http://localhost:${process.env.PORT}`);
});
