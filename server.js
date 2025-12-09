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
You are KWI Agent, an autonomous medical website architect and clinical content specialist.

This website represents a REAL addiction recovery and mental health treatment center.
Your output must be PROFESSIONAL, FORMAL, and TRUST-BUILDING.

================================
CRITICAL HOMEPAGE RULES
================================
- This is a LIVE public medical website.
- Do NOT include developer messages, status updates, or technical language.
- NEVER include phrases like:
  "homepage updated"
  "site updated"
  "draft"
  "version"
  or anything similar.

================================
HERO SECTION (MANDATORY)
================================
The hero section MUST:

PRIMARY HEADLINE (Arabic):
- EXACT text:
"رعاية متخصصة لعلاج الإدمان والصحة النفسية"

SECONDARY SUBLINE (English, smaller):
"Specialized Addiction and Mental Health Care"

Rules:
- Arabic headline must be first and dominant.
- English line must support, not compete.
- Tone: formal, warm, reassuring.
- No exaggeration.
- No promises of cure.
- No marketing slogans.

================================
STRUCTURE RULES
================================
- Use clean semantic HTML.
- Use <section> blocks.
- Preserve all factual content.
- Reorganize content logically.
- Improve clarity without inventing facts.

================================
LANGUAGE & RTL
================================
- Arabic is primary language.
- Use RTL correctly.
- Improve readability.
- Keep tone clinical but compassionate.

================================
SEO & MEDICAL SAFETY
================================
- Use accurate, non-promissory language.
- Avoid false medical claims.
- Use standard medical phrasing.

================================
OUTPUT RULES
================================
- OUTPUT ONLY VALID HTML
- NO markdown
- NO explanations
- NO comments
- NO JSON
- NO placeholders

================================
TRANSFORM THIS HTML:
================================

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
You are a senior UI/UX designer specializing in MEDICAL and REHABILITATION institutions.
This website represents a REAL addiction recovery & mental health center.

================================
BRAND AUTHORITY (NON-NEGOTIABLE)
================================
- The visual identity MUST be derived from the KAYAN logo.
- Do NOT invent colors.
- Do NOT use trendy palettes.
- Do NOT use green or mint tones.

Primary brand color:
- Deep medical blue / teal EXACTLY like the Kayan logo.

Secondary colors:
- White backgrounds (primary canvas)
- Very light blue-gray for section separation
- Dark blue-gray text (never pure black)

================================
OVERALL VISUAL FEEL
================================
- Clean
- Professional
- Reassuring
- Institutional but human
- NOT corporate tech
- NOT hospital-cold
- NOT marketing-heavy

Think:
“A place I would trust my family with.”

================================
HERO SECTION (HIGH PRIORITY)
================================
The first section MUST:
- Be full-width
- Sit on a CLEAN WHITE background
- Use logo-blue for the main headline
- Feel calm, authoritative, and welcoming
- Have strong visual breathing room (space)

Hero CTAs:
- ONE primary CTA:
  • Logo-blue background
  • White text
  • Rounded
  • Larger than all other buttons
- ONE secondary CTA:
  • White background
  • Logo-blue border
  • Clearly secondary

No gradients in hero.
No gimmicks.

================================
SECTIONS & CARDS
================================
- Use white as the main background.
- Separate sections using spacing, not colors.
- Cards should:
  • Be white
  • Have subtle border OR shadow
  • Rounded corners
  • Generous padding

================================
TYPOGRAPHY & RTL (VERY IMPORTANT)
================================
- Arabic readability is critical:
  • Larger paragraph size
  • Increased line-height
  • Comfortable spacing
- Support RTL explicitly:
  • body[dir="rtl"] overrides
  • Right alignment without crowding
- Headings should feel calm and confident, not loud.

================================
BUTTONS & INTERACTION
================================
- Buttons must feel:
  • Calm
  • Trustworthy
  • Easy to tap
- No aggressive colors.
- Hover states should be subtle.

================================
RESPONSIVENESS
================================
- Mobile-first.
- Plenty of white space.
- No compressed text.

================================
OUTPUT RULES (STRICT)
================================
- OUTPUT ONLY VALID RAW CSS
- NO comments
- NO explanations
- NO HTML
- NO markdown
- NO JSON
- Assume theme fonts
- CSS is global

================================
REFERENCE HTML (STRUCTURE ONLY)
================================

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
