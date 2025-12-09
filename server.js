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
  apiKey: OPENAI_API_KEY,
});

// -------------------------------
// WORDPRESS HELPERS
// -------------------------------

// Fetch a WordPress page
async function fetchPageHTML(pageId) {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: newHTML }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update WP page: ${res.status} ${text}`);
  }
  return await res.json();
}

// Bridge: Update theme CSS via KWI Agent Bridge
async function updateThemeCSS(css) {
  const url = `${WP_BASE_URL}/wp-json/kwi-agent/v1/css`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ css }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update theme CSS: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log("✅ [Bridge] CSS updated:", data);
  return data;
}

// Helper: call plugin bridge (activate/deactivate)
async function callPluginBridge(action, slug) {
  const url = `${WP_BASE_URL}/wp-json/kwi-agent/v1/plugins/${action}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slug }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to ${action} plugin "${slug}": ${res.status} ${text}`
    );
  }

  const data = await res.json();
  console.log(`✅ [Bridge] Plugin ${action} OK:`, data);
  return data;
}

// -------------------------------
// AI HELPERS
// -------------------------------

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
    input: prompt,
  });

  return response.output[0].content[0].text;
}

// Design CSS from sample HTML
async function designCSSFromHTML(sampleHTML) {
  const prompt = `
You are a senior UI/UX designer and frontend engineer.
You design modern, medical-grade, conversion-focused layouts using ONLY CSS.

Context:
- Website: Kayan Recovery (addiction recovery & mental health, Egypt).
- Audience: Arabic + English users; site must look trustworthy, calm, and professional.
- Theme: Twenty Twenty-Five (block theme), minimal default styling.
- CSS will be saved as /wp-content/themes/<active-theme>/kwi-agent.css and enqueued globally.

Design requirements:
- Use a soft, medical palette:
  - Whites, off-whites
  - Teal, turquoise, and mint accents
  - Soft medical blues
  - Subtle greys for text and borders
- Make the homepage feel like a serious, modern medical rehab center:
  - Clean hero section with big headline, subhead, and primary CTA button.
  - Secondary CTA for WhatsApp / phone.
  - Card-based sections for services, programs, testimonials, team, and FAQs.
  - Good spacing, strong visual hierarchy, rounded cards, and subtle shadows.
- Typography & RTL:
  - Support both LTR and RTL.
  - Use body[dir="rtl"] and .rtl helpers for RTL adjustments.
  - Ensure headings, paragraphs, lists, and buttons look good in Arabic and English.
- Layout:
  - Responsive (mobile-first, then tablet and desktop breakpoints).
  - Max-width container for content (e.g. .kwi-container).
  - Utility classes for spacing (e.g. .kwi-section, .kwi-grid, .kwi-card).
- Accessibility:
  - Good contrast ratios.
  - Focus styles for buttons and links.
  - Avoid tiny text.

IMPORTANT:
- OUTPUT ONLY VALID CSS. NO explanations, NO comments, NO HTML, NO JSON.
- Do not reference external fonts; assume theme fonts.
- Prefer utility/helper classes that can be reused across different blocks.

You will receive a sample of the current homepage HTML.
Analyse common patterns, class names, and structure, then output a complete CSS file 
that transforms the site into a modern, medical-grade layout as described.

Again: output ONLY raw CSS, with no prose or explanations.

Here is the sample HTML (truncated if needed):

${sampleHTML}
`;

  console.log("🧠 [AI] Designing CSS from HTML…");

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  const css = response.output?.[0]?.content?.[0]?.text?.trim() || "";

  console.log("✅ [AI] CSS generated, length:", css.length);

  if (!css) {
    throw new Error("AI returned empty CSS");
  }

  return css;
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
// ROUTES
// -------------------------------

// Manual trigger: HTML rewrite
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

// Manual trigger: design CSS now
app.get("/design-css-now", async (req, res) => {
  console.log("🔁 /design-css-now triggered");

  try {
    const pageId = WP_HOMEPAGE_ID;
    const url = `${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;

    console.log("📥 Fetching homepage HTML from:", url);

    const wpResponse = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!wpResponse.ok) {
      const text = await wpResponse.text();
      throw new Error(
        `Failed to fetch homepage HTML: ${wpResponse.status} ${text}`
      );
    }

    const wpData = await wpResponse.json();
    const html = wpData?.content?.rendered || "";

    if (!html) {
      throw new Error("Homepage HTML is empty or missing");
    }

    console.log("📄 Homepage HTML length:", html.length);

    // 1) Ask AI to design CSS
    const css = await designCSSFromHTML(html);

    // 2) Push CSS to WP via bridge plugin
    const bridgeResult = await updateThemeCSS(css);

    console.log("🎉 /design-css-now completed successfully");

    res.json({
      success: true,
      pageId,
      cssLength: css.length,
      bridge: bridgeResult,
    });
  } catch (error) {
    console.error("❌ /design-css-now failed:", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Plugin activation route
app.post("/plugin/activate/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const result = await callPluginBridge("activate", slug);
    res.json({
      success: true,
      action: "activate",
      slug,
      result,
    });
  } catch (error) {
    console.error("❌ Plugin activate failed:", error.message);
    res.status(500).json({
      success: false,
      action: "activate",
      slug,
      error: error.message,
    });
  }
});

// Plugin deactivation route
app.post("/plugin/deactivate/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const result = await callPluginBridge("deactivate", slug);
    res.json({
      success: true,
      action: "deactivate",
      slug,
      result,
    });
  } catch (error) {
    console.error("❌ Plugin deactivate failed:", error.message);
    res.status(500).json({
      success: false,
      action: "deactivate",
      slug,
      error: error.message,
    });
  }
});

// Home route
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
