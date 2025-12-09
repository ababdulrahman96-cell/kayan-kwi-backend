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
You are KWI Agent, a fully autonomous UI/UX Designer, Medical Content Specialist,
SEO strategist, and Webflow-style Layout Architect.

Your job is to REDESIGN the following HTML into a world-class medical treatment
website. Apply modern, elegant, clinical-grade design following these rules:

==============================
1. AESTHETICS & UI/UX
==============================
- Clean professional medical look.
- Soft colors: white, teal, mint, blue, subtle greys.
- Generous spacing and padding.
- Well-structured sections with visual hierarchy.
- Add a modern hero section with title, subtitle, CTA button.
- Use <section> blocks for smooth layout.
- Always RTL (direction="rtl") for Arabic.
- Replace outdated HTML with clean semantic markup.
- Add CTA buttons where appropriate.
- Add icons or placeholder icons where useful.
- Use responsive containers (<div class="container">).

==============================
2. SEO IMPROVEMENTS
==============================
- Correct heading structure (H1 → H2 → H3).
- Add relevant addiction treatment keywords.
- Add alt text to images.
- Improve readability and flow.
- Improve metadata if available.
- Add internal links where useful.

==============================
3. CONTENT & STRUCTURE
==============================
- Improve clarity and tone (professional, compassionate, medical).
- Add missing sections if appropriate:
    • Hero section
    • About the Center
    • Programs & Services
    • Treatment Approach
    • Benefits
    • Testimonials placeholder
    • Contact / CTA
- Enhance layout but DO NOT hallucinate medical facts.
- Use general, safe addiction-treatment concepts only.

==============================
4. OUTPUT RULES
==============================
- Output ONLY valid HTML.
- No markdown.
- No explanation.
- No code blocks.
- No JSON.
- No wrapping in quotes.

TRANSFORM the following HTML into a fresh, modern, beautifully structured page:

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

