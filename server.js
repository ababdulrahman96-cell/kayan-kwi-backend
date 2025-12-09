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
const SERP_API_KEY = process.env.SERP_API_KEY;

// -------------------------------
// WORDPRESS AUTH
// -------------------------------
const auth = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString("base64");

// -------------------------------
// OPENAI CLIENT
// -------------------------------
const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// -------------------------------
// BRAND-LOCKED CSS (NO AI)
// -------------------------------
const KAYAN_BRAND_CSS = `
/* ---------------------------
GLOBAL RESET / BRAND SYSTEM
----------------------------*/
body {
  background: #ffffff !important;
  direction: rtl;
  font-family: "Tahoma", "Arial", sans-serif;
  color: #1d2d35;
  line-height: 1.8;
}

*, *:before, *:after {
  box-sizing: border-box;
}

/* Kayan Brand Colors */
:root {
  --kayan-blue: #004e62;
  --kayan-blue-light: #e7f2f4;
  --kayan-text: #1d2d35;
  --kayan-white: #ffffff;
}

/* ---------------------------
HEADINGS
----------------------------*/
h1, h2, h3, h4 {
  color: var(--kayan-blue);
  font-weight: 700;
  margin-bottom: 16px;
}

p {
  margin-bottom: 16px;
  color: var(--kayan-text);
  font-size: 1.1rem;
}

/* ---------------------------
HERO LAYOUT
----------------------------*/
.hero {
  background: var(--kayan-white) !important;
  padding: 80px 20px;
  text-align: center;
}

.hero h1 {
  font-size: 2.4rem;
  margin-bottom: 20px;
  color: var(--kayan-blue);
}

.hero .subline {
  font-size: 1.1rem;
  color: var(--kayan-text);
  margin-bottom: 30px;
}

/* ---------------------------
BUTTONS
----------------------------*/
.kwi-btn-primary {
  background: var(--kayan-blue);
  color: #ffffff !important;
  padding: 14px 28px;
  border-radius: 8px;
  border: none;
  font-size: 1.1rem;
  display: inline-block;
  margin: 10px;
}

.kwi-btn-primary:hover {
  background: #003947;
}

.kwi-btn-secondary {
  background: var(--kayan-white);
  color: var(--kayan-blue) !important;
  border: 2px solid var(--kayan-blue);
  padding: 14px 28px;
  border-radius: 8px;
  font-size: 1.1rem;
  display: inline-block;
  margin: 10px;
}

.kwi-btn-secondary:hover {
  background: var(--kayan-blue-light);
}

/* ---------------------------
SECTIONS
----------------------------*/
section {
  padding: 60px 20px;
  background: var(--kayan-white) !important;
}

section:nth-of-type(even) {
  background: var(--kayan-blue-light) !important;
}

.kwi-card {
  background: #ffffff;
  padding: 30px;
  border-radius: 16px;
  border: 1px solid #d8e4e6;
  margin-bottom: 30px;
}

/* ---------------------------
RTL CLEANUPS
----------------------------*/
ul, ol {
  padding-right: 20px;
}

.hero * {
  text-align: center !important;
}
`;

// -------------------------------
// WORDPRESS HELPERS
// -------------------------------
async function fetchPageHTML(pageId) {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error("Failed to fetch WP page");
  const data = await res.json();
  return data.content.rendered;
}

async function fetchAllPages() {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages?per_page=100`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error("Failed to fetch pages");
  return res.json();
}

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
    throw new Error(`Failed WP update: ${res.status} ${text}`);
  }
  return res.json();
}

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
    throw new Error(`Failed CSS update: ${res.status} ${text}`);
  }
  return res.json();
}

async function createWPPost(title, html) {
  const url = `${WP_BASE_URL}/wp-json/wp/v2/posts`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      content: html,
      status: "publish",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to publish WP post: ${res.status} ${text}`);
  }
  return res.json();
}

// -------------------------------
// AI HELPERS
// -------------------------------
async function rewriteHTML(originalHTML) {
  const prompt = `
You are KWI Agent, an autonomous medical website architect and clinical content specialist
for Kayan Recovery Center in Egypt.

This is a REAL addiction recovery and mental health website.
Your output must be PROFESSIONAL, FORMAL, TRUST-BUILDING, and medically ethical.

================================
HERO SECTION (VERSION C – LOCKED)
================================
Arabic headline (H1):
"رعاية طبية متخصصة لعلاج الإدمان والصحة النفسية"

English subline (smaller text):
"Specialized, evidence-based addiction & mental health care."

Two CTAs (buttons/links):
- "ابدأ رحلتك العلاجية"
- "تحدث مع مستشار متخصص"

================================
SEO TARGETING (IMPORTANT)
================================
Naturally and safely integrate:
- علاج الإدمان
- علاج الادمان
- علاج المخدرات

Do NOT keyword-stuff. Keep language natural and respectful.

================================
STRUCTURE
================================
- Arabic-first, RTL-friendly content.
- Clear sections using <section> with logical headings.
- Clinical but compassionate tone.
- No fake statistics, no made-up names.
- No developer text, no placeholders.

================================
OUTPUT RULES (STRICT)
================================
- OUTPUT PURE HTML ONLY.
- Do NOT wrap in backticks.
- Do NOT start or end with the word "html" or "```".
- No markdown, no JSON, no comments.
- Do NOT touch global header or footer.

Rewrite the following HTML accordingly:

${originalHTML}
`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return response.output[0].content[0].text;
}

async function seoBrief(keyword) {
  const prompt = `
أنشئ مخطط سيو عربي كامل للكلمة المفتاحية: "${keyword}"
يتضمن:
- عنوان H1 مقترح
- عناوين H2 و H3
- الكلمات والعبارات المرتبطة
- أفكار لأسئلة شائعة (FAQ)
اللغة عربية فقط وبأسلوب طبي مهني وطمأنة.
`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return response.output[0].content[0].text;
}

async function generateArticle(title, keyword) {
  const prompt = `
اكتب مقالة عربية كاملة بصيغة HTML عن موضوع:
العنوان: "${title}"
الكلمة المستهدفة: "${keyword}"

القواعد:
- أسلوب طبي مهني وبلغة سهلة.
- لا وعود شفاء نهائية، لا مبالغة.
- استخدم عناوين H2 و H3 داخل المقال.
- أضف فقرة ختامية تشجع على طلب المساعدة من مركز كيان.
- المخرج HTML فقط بدون أي شيفرات أخرى.
`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return response.output[0].content[0].text;
}

// SERPER competitor analysis
async function analyzeCompetitors(keyword) {
  const url = "https://google.serper.dev/search";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": SERP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: keyword,
      gl: "eg",
      hl: "ar",
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Serper error: ${res.status} ${t}`);
  }

  return res.json();
}

async function seoAutopilot() {
  try {
    console.log("🚀 SEO AUTOPILOT STARTED");

    const keywords = ["علاج الادمان", "علاج إدمان", "علاج المخدرات"];
    let reports = {};

    for (const k of keywords) {
      const serp = await analyzeCompetitors(k);

      const prompt = `
حلل بيانات نتائج البحث التالية للكلمة: "${k}"
واقترح تحسينات واضحة لمحتوى موقع "مركز كيان" حتى ينافس أفضل الصفحات.

بيانات SERP:
${JSON.stringify(serp)}

اكتب التوصيات بالعربية فقط على شكل نقاط وعناوين.
`;

      const response = await client.responses.create({
        model: OPENAI_MODEL,
        input: prompt,
      });

      reports[k] = response.output[0].content[0].text;
    }

    console.log("✅ SEO AUTOPILOT COMPLETE");
    return reports;
  } catch (err) {
    console.error("❌ SEO AUTOPILOT ERROR:", err.message);
  }
}

// Homepage rewrite autopilot
async function homepageAutopilot() {
  try {
    console.log("🚀 HOMEPAGE AUTOPILOT STARTED");
    const html = await fetchPageHTML(WP_HOMEPAGE_ID);
    const rewritten = await rewriteHTML(html);
    await updatePageHTML(WP_HOMEPAGE_ID, rewritten);
    console.log("✅ HOMEPAGE AUTOPILOT DONE");
  } catch (err) {
    console.error("❌ HOMEPAGE AUTOPILOT ERROR:", err.message);
  }
}

// -------------------------------
// ROUTES
// -------------------------------

// Rewrite homepage
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

// Rewrite all pages
app.get("/rewrite-all", async (req, res) => {
  try {
    const pages = await fetchAllPages();
    let updated = [];

    for (const p of pages) {
      try {
        const html = await fetchPageHTML(p.id);
        const rewritten = await rewriteHTML(html);
        await updatePageHTML(p.id, rewritten);
        updated.push({ id: p.id, title: p.title.rendered });
      } catch (err) {
        console.log("Page failed:", p.id, err.message);
      }
    }

    res.json({ updated });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Push brand CSS (no AI)
app.get("/design-css-now", async (req, res) => {
  try {
    const css = KAYAN_BRAND_CSS.trim();
    const bridge = await updateThemeCSS(css);
    res.json({ cssLength: css.length, bridge });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SEO brief
app.post("/seo-brief", async (req, res) => {
  try {
    const { keyword } = req.body;
    const brief = await seoBrief(keyword);
    res.json({ brief });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Generate & publish article
app.post("/publish-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    const html = await generateArticle(title, keyword);
    const post = await createWPPost(title, html);
    res.json({ publishedId: post.id });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Competitor analyzer
app.post("/competitor-analyze", async (req, res) => {
  try {
    const { keyword } = req.body;
    const data = await analyzeCompetitors(keyword);
    res.json(data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Manual SEO autopilot trigger
app.get("/seo-autopilot", async (req, res) => {
  try {
    const report = await seoAutopilot();
    res.json(report);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("KWI Backend Running ✓");
});

// -------------------------------
// START SERVER
// -------------------------------
app.listen(4000, () => {
  console.log("🌐 Server live on 4000");

  // Every 2 days: homepage rewrite + SEO analysis
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  setInterval(() => {
    homepageAutopilot();
    seoAutopilot();
  }, TWO_DAYS);
});
