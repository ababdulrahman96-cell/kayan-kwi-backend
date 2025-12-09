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
You are a senior UI/UX designer and frontend engineer specializing in
rehabilitation, mental health, and medical recovery websites.

Your task:
Generate a COMPLETE, modern CSS design system that transforms the site into
a WARM, SUPPORTIVE, HOPE-ORIENTED rehabilitation center website.
This is NOT a corporate hospital. This is a place of healing and recovery.

================================================
DESIGN TONE (VERY IMPORTANT)
================================================
- Emotional tone: warm, calm, supportive, reassuring.
- The site must feel SAFE, HUMAN, and COMPASSIONATE.
- Avoid harsh contrasts or aggressive marketing visuals.
- Think: trust, care, recovery, dignity, professionalism.

================================================
COLOR & VISUAL LANGUAGE
================================================
- Primary palette:
  • Soft medical teal
  • Muted blues
  • Gentle mint accents
  • Warm off-white backgrounds
- Avoid black-heavy or cold corporate looks.
- Use subtle gradients (very soft) where appropriate.
- Borders, cards, and sections should feel light and breathable.

================================================
HERO SECTION (CRITICAL — MUST DOMINATE VISUALLY)
================================================
Force the FIRST major section / page intro / hero to:
- Have noticeably larger vertical spacing.
- Use larger heading sizes than the rest of the site.
- Use a calming background (soft gradient or light solid).
- Feel emotionally welcoming, not technical.
- Center or right-align content depending on RTL.

CTAs in hero:
- One PRIMARY CTA (e.g. Contact / WhatsApp / Get Help Now)
  • Largest button on the page
  • Warm accent color
  • Rounded
  • Clear hover/focus state
- One SECONDARY CTA:
  • Outlined or muted style
  • Visible but less dominant

================================================
CONTENT SECTIONS
================================================
- All sections should feel like “safe spaces”.
- Use card-based layouts generously.
- Cards:
  • Rounded corners
  • Soft shadow
  • Plenty of padding
- Avoid cluttered layouts.

================================================
TYPOGRAPHY & RTL
================================================
- Ensure Arabic text is COMFORTABLE to read:
  • Increased line-height
  • Slightly larger paragraph text
- Support both LTR and RTL explicitly:
  • Use body[dir="rtl"] overrides
  • Do not mirror spacing incorrectly
- Headings must feel reassuring, not loud.

================================================
BUTTONS & INTERACTION
================================================
- Buttons should feel touch-friendly:
  • Large padding
  • Smooth hover transitions
- Primary buttons must stand out without feeling aggressive.

================================================
RESPONSIVENESS
================================================
- Mobile-first approach.
- Generous spacing on mobile.
- No cramped text.

================================================
IMPORTANT OUTPUT RULES
================================================
- OUTPUT ONLY RAW, VALID CSS
- NO comments
- NO explanations
- NO HTML
- NO markdown
- NO JSON
- Assume theme fonts
- CSS is global and loaded on every page

================================================
INPUT HTML (REFERENCE STRUCTURE ONLY)
================================================

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
