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

// Fetch a WordPress page’s HTML
async function fetchPageHTML(pageId) {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) throw new Error("Failed to fetch WP page");
  const data = await res.json();
  return data.content.rendered;
}

// Fetch ALL WordPress pages
async function fetchAllPages() {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages?per_page=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) throw new Error("Failed to fetch pages");
  return await res.json();
}

// Update page content
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

// Push CSS through KWI Bridge
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

// Plugin activation/deactivation
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
// AI: HTML REWRITER
// -------------------------------
async function rewriteHTML(originalHTML) {
  const prompt = `
You are KWI Agent, an autonomous medical website architect and clinical content specialist.

This website represents a REAL addiction recovery and mental health treatment center in Egypt (Kayan Recovery Center).
Your output must be PROFESSIONAL, FORMAL, TRUST-BUILDING, and medically ethical.

================================
HERO SECTION (VERSION C – LOCKED)
================================
Arabic headline:
"رعاية طبية متخصصة لعلاج الإدمان والصحة النفسية"

English subline:
"Specialized, evidence-based addiction & mental health care."

Primary CTA:
"ابدأ رحلتك العلاجية"

Secondary CTA:
"تحدث مع مستشار متخصص"

================================
SEO TARGETING (IMPORTANT)
================================
Naturally integrate:
- علاج الادمان
- علاج إدمان
- علاج المخدرات

Do NOT keyword-stuff.

================================
OUTPUT RULES
================================
- Arabic-first (RTL)
- Formal Arabic medical tone
- Clean semantic HTML only
- No dev text, no placeholders
- No markdown, no JSON
- No modifying header/footer
- No fake statistics

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

// -------------------------------
// AI: CSS DESIGN
// -------------------------------
async function designCSSFromHTML(sampleHTML) {
  const prompt = `
You are a senior medical UI/UX designer. Generate CSS only.
(… SAME CSS PROMPT AS BEFORE …)

${sampleHTML}
`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return response.output[0].content[0].text.trim();
}

// -------------------------------
// AUTOPILOT (Homepage Only)
// -------------------------------
async function autopilot() {
  try {
    console.log("🚀 AUTOPILOT STARTED");
    const originalHTML = await fetchPageHTML(WP_HOMEPAGE_ID);
    const rewritten = await rewriteHTML(originalHTML);
    await updatePageHTML(WP_HOMEPAGE_ID, rewritten);
    console.log("✅ Autopilot update done");
  } catch (err) {
    console.error("❌ AUTOPILOT ERROR:", err);
  }
}

// -------------------------------
// ROUTES
// -------------------------------

// Rewrite HOMEPAGE
app.get("/rewrite-now", async (req, res) => {
  try {
    const html = await fetchPageHTML(WP_HOMEPAGE_ID);
    const rewritten = await rewriteHTML(html);
    await updatePageHTML(WP_HOMEPAGE_ID, rewritten);
    res.send("Homepage rewrite complete.");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Rewrite ALL pages
app.get("/rewrite-all", async (req, res) => {
  try {
    const pages = await fetchAllPages();
    let updated = [];

    for (const page of pages) {
      try {
        const html = await fetchPageHTML(page.id);
        const rewritten = await rewriteHTML(html);
        await updatePageHTML(page.id, rewritten);
        updated.push({ id: page.id, title: page.title.rendered });
      } catch (err) {
        console.error(`❌ Failed page ${page.id}:`, err.message);
      }
    }

    res.json({ updated });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// CSS generation
app.get("/design-css-now", async (req, res) => {
  try {
    const html = await fetchPageHTML(WP_HOMEPAGE_ID);
    const css = await designCSSFromHTML(html);
    const bridge = await updateThemeCSS(css);
    res.json({ cssLength: css.length, bridge });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SEO BRIEF
app.post("/seo-brief", async (req, res) => {
  try {
    const { keyword } = req.body;

    const prompt = `
Generate an Arabic SEO brief for keyword: "${keyword}"
Include H1/H2/H3 structure, keyphrases, FAQ ideas.
Arabic only.
`;

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
    });

    res.json({ brief: response.output[0].content[0].text });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Create ARTICLE
app.post("/create-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;

    const prompt = `
Write a full Arabic medically-safe article:
Title: "${title}"
Keyword: "${keyword}"
Output HTML only.
`;

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
    });

    res.json({ html: response.output[0].content[0].text });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Home route
app.get("/", (req, res) => {
  res.send("KWI Backend Running ✓");
});

// -------------------------------
// START SERVER
// -------------------------------
app.listen(4000, () => {
  console.log("🌐 Server live on 4000");
  setInterval(autopilot, 10 * 60 * 1000);
});
