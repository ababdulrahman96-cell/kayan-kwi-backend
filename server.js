import express from "express";
import fetch from "node-fetch";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// -------------------------------
// ENVIRONMENT VARIABLES
// -------------------------------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const WP_BASE_URL = process.env.WP_BASE_URL;
const WP_USERNAME = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const WP_HOMEPAGE_ID = process.env.WP_HOMEPAGE_ID;

// -------------------------------
// WORDPRESS AUTH
// -------------------------------
const auth = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString("base64");

// -------------------------------
// OPENAI CLIENT
// -------------------------------
const client = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// -------------------------------
// FUNCTIONS
// -------------------------------

// Fetch a WordPress page
async function fetchPageHTML(pageId) {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` }
  });

  if (!res.ok) throw new Error("Failed to fetch WP page");
  const data = await res.json();
  return data.content.rendered;
}

// Update a WordPress page
async function updatePageHTML(pageId, newHTML) {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: newHTML })
  });

  if (!res.ok) throw new Error("Failed to update WP page");
  return await res.json();
}

async function rewriteHTML(originalHTML) {
 const prompt = `
You are KWI Agent, an autonomous medical UI/UX designer, content strategist,
and SEO specialist. You redesign HTML pages into high-quality, professional,
modern medical treatment website layouts.

==============================
G–LEVEL MODERATE POWER RULESET
==============================

Your goal: Transform the input HTML into a well-structured, modern, clean design
using professional medical aesthetic principles—while staying safe, factual, and
avoiding hallucination.

==============================
1. LAYOUT & STRUCTURE
==============================
- Break content into clear <section> blocks.
- Use professional medical web patterns:
    • Hero section with headline + subheadline + CTA
    • About the Center
    • Programs & Services overview
    • Treatment Approach
    • Advantages / Benefits
    • Articles or Knowledge section
    • Contact / CTA block
- Preserve existing info but restructure for clarity.

==============================
2. UI/UX RULES
==============================
- Soft medical color palette (white, teal, mint, blue, grey).
- Add consistent spacing: 40–80px vertical padding.
- Improve typography hierarchy.
- Add semantic HTML.
- Use <div class="container"> for width control.
- Always apply RTL direction & right alignment.

==============================
3. SEO RULES
==============================
- Use correct heading hierarchy (H1 > H2 > H3).
- Add medically accurate SEO keywords for addiction treatment.
- Add alt attributes to images.
- Improve meta sections if encountered.
- Enhance scannability and readability.

==============================
4. CONTENT RULES
==============================
- Do NOT hallucinate medical facts.
- You MAY add generalized, safe sections (evidence-based methods,
  holistic support, recovery planning).
- Tone: professional, compassionate, clinical-grade.
- You may rewrite unclear text into clearer Arabic.
- You may introduce CTA blocks with safe language.

==============================
5. OUTPUT RULES
==============================
- Output ONLY valid HTML.
- No explanations.
- No markdown or code fences.
- No JSON.
- No quoting or escaping.
- Ensure structure is complete & clean.

==============================
TRANSFORM THE FOLLOWING HTML:
==============================

${originalHTML}

`;


  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt
  });

  return response.output[0].content[0].text;
}


// -------------------------------
// AUTOPILOT LOOP
// -------------------------------
async function autopilot() {
  try {
    console.log("🚀 AUTOPILOT STARTED");
    console.log(`🎯 Target Page ID: ${WP_HOMEPAGE_ID}`);

    const originalHTML = await fetchPageHTML(WP_HOMEPAGE_ID);
    console.log("📥 Fetched WP HTML");

    const rewritten = await rewriteHTML(originalHTML);
    console.log("✏️ AI rewrite complete");

    await updatePageHTML(WP_HOMEPAGE_ID, rewritten);
    console.log("✅ WP page updated");
  } catch (err) {
    console.error("❌ AUTOPILOT ERROR:", err.message);
  }
}


// -------------------------------
// MANUAL TRIGGER ENDPOINT
// -------------------------------
app.get("/rewrite-now", async (req, res) => {
  try {
    console.log("⚡ MANUAL REWRITE TRIGGERED");

    const originalHTML = await fetchPageHTML(WP_HOMEPAGE_ID);
    const rewritten = await rewriteHTML(originalHTML);

    await updatePageHTML(WP_HOMEPAGE_ID, rewritten);

    res.send("Rewrite completed successfully.");
  } catch (err) {
    console.error("Manual rewrite failed:", err.message);
    res.status(500).send("Rewrite failed: " + err.message);
  }
});

// -------------------------------
// HOME ROUTE
// -------------------------------
app.get("/", (req, res) => {
  res.send("KWI Backend Running ✓");
});

// -------------------------------
app.listen(4000, () => {
  console.log("🌐 Server live on 4000");

  // Start autopilot safely AFTER server is ready
  console.log("⏳ Autopilot timer initialized");
  setInterval(autopilot, 10 * 60 * 1000); 
});

