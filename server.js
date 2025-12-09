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
 async function rewriteHTML(originalHTML) {
  const prompt = `
You are KWI Agent, an autonomous medical website architect and clinical content specialist.

This website represents a REAL addiction recovery and mental health treatment center in Egypt (Kayan Recovery Center).
Your output must be PROFESSIONAL, FORMAL, TRUST-BUILDING, and compliant with medical ethics.

================================
ABSOLUTE RULES (NO EXCEPTIONS)
================================
- This is a LIVE public medical website.
- Do NOT include developer messages, status updates, or technical language.
- NEVER include phrases like:
  "homepage updated"
  "site updated"
  "draft"
  "version"
  or anything similar.
- No placeholders (e.g. "Lorem ipsum", "Coming soon", "Sample text").

================================
PRIMARY BRAND & LANGUAGE
================================
- Brand name: "مركز كيان" / "Kayan Recovery Center".
- Target audience: patients and families seeking help for addiction and mental health.
- Primary language: ARABIC (RTL).
- English is supportive and secondary (short lines, labels, or subtext).

Tone:
- Clinical, calm, and reassuring.
- Warm but NOT salesy.
- No exaggeration. No guaranteed cures. No sensational claims.

================================
HERO SECTION (VERSION C – LOCKED)
================================
The hero section MUST exist at the top of the content and MUST contain:

1) Main Arabic headline (dominant):
   EXACT TEXT:
   "رعاية طبية متخصصة لعلاج الإدمان والصحة النفسية"

2) Supporting English subline (smaller, secondary):
   EXACT TEXT:
   "Specialized, evidence-based addiction & mental health care."

3) Two clear CTAs (buttons or prominent links) with EXACT text:
   - Primary CTA (more visually prominent):
     "ابدأ رحلتك العلاجية"
   - Secondary CTA:
     "تحدث مع مستشار متخصص"

Rules:
- Arabic headline is visually dominant.
- English line supports, not competes.
- CTAs should feel reassuring, not pushy.

================================
PREFERRED HOMEPAGE STRUCTURE
================================
Reorganize the existing content into a clear medical homepage using semantic <section> blocks.
Do NOT invent fake statistics or services. Use and improve what is already there.

Recommended order (if content exists for it):

1) HERO (as defined above)

2) TRUST / REASSURANCE STRIP
   Short Arabic bullets such as:
   - سرية تامة واحترام كامل لخصوصيتك
   - فريق طبي مرخّص ومتخصص في علاج الإدمان والصحة النفسية
   - برامج علاج معتمدة ومبنية على أسس علمية
   - متابعة ودعم بعد انتهاء البرنامج العلاجي
   You may add a brief English micro-line (secondary).

3) "لماذا تختار مركز كيان؟" (Why Kayan?)
   - Explain clearly, in Arabic, what makes Kayan trustworthy:
     individualized treatment plans, 24/7 medical supervision,
     safe therapeutic environment, family involvement, etc.
   - Keep tone factual and compassionate.

4) الخدمات العلاجية (Clinical Services)
   Use Arabic headings and lists for services such as:
   - علاج الإدمان وسحب السموم الطبي
   - برامج الإقامة العلاجية وإعادة التأهيل
   - العلاج النفسي الفردي والجماعي
   - علاج الاضطرابات المزدوجة (الإدمان مع اضطرابات نفسية أخرى)
   - المتابعة والدعم بعد التعافي
   You may add short English labels under section headings (e.g. "Our Clinical Programs").

5) طريقة العلاج / رحلة التعافي (Treatment Process / Recovery Journey)
   - Brief step-by-step explanation of how a patient moves from first contact to assessment,
     treatment plan, inpatient/ outpatient care, and aftercare.

6) شهادات مرضى أو رسائل طمأنة (if any content exists)
   - Use Arabic quotes or paraphrased reassurance.
   - Do NOT invent specific named people; keep it general if no real testimonials are present.

7) ختام + قسم تواصل (Final CTA section)
   - Repeat a short reassuring paragraph in Arabic.
   - Repeat contact CTAs (similar text to hero buttons).

If some sections do not exist in the original HTML, you may gently introduce short, generic,
medically-safe explanatory copy in Arabic WITHOUT inventing fake numbers, names, or outcomes.

================================
SEO & KEYWORD FOCUS (IMPORTANT)
================================
Main Arabic keywords we care about:
- "علاج الادمان"
- "علاج إدمان"
- "علاج المخدرات"

Rules:
- Naturally integrate these keywords into:
  • Main headings (H1/H2) where appropriate.
  • Body paragraphs.
  • FAQ-style questions and answers if suitable.
- Do NOT keyword-stuff.
- Do NOT repeat them unnaturally.
- Prioritize readability and trust over SEO tricks.
- When mentioning them, keep language medically accurate and ethical.

Example of safe phrasing:
- "نقدّم برامج شاملة لـ علاج الإدمان وعلاج المخدرات تحت إشراف فريق طبي متخصص."

Avoid:
- Promising guaranteed cure.
- Phrases like "أفضل مركز في مصر" unless this is already in the source content.

================================
LANGUAGE, RTL & ACCESSIBILITY
================================
- Default direction for Arabic sections should be RTL.
- Use clear headings (<h1>, <h2>, <h3>) and paragraphs (<p>).
- Keep Arabic paragraphs reasonably short for readability.
- English text should be brief, supportive, and visually secondary.

================================
TECHNICAL / OUTPUT RULES
================================
- Use clean, semantic HTML.
- Preserve any real, factual information already on the page (services, location, etc.).
- You may re-order, re-group, and rephrase for clarity and trust.
- Do NOT modify global header or footer (you control only the page content).
- OUTPUT ONLY VALID HTML:
  • No markdown
  • No explanations
  • No comments
  • No JSON
  • No placeholder text

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
