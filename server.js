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

// Push CSS to WP
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

// Create blog post
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
// AI: HTML Rewriter
// -------------------------------
async function rewriteHTML(originalHTML) {
  const prompt = `
You are KWI Agent, an autonomous medical website architect for Kayan Recovery Center in Egypt.

Rewrite the homepage content using:
- Formal Arabic (RTL)
- Clinical credibility
- SEO keywords: علاج الإدمان، علاج الادمان، علاج المخدرات
- Hero Version C (locked)

Arabic headline:
"رعاية طبية متخصصة لعلاج الإدمان والصحة النفسية"
English subline:
"Specialized, evidence-based addiction & mental health care."
CTAs:
"ابدأ رحلتك العلاجية"
"تحدث مع مستشار متخصص"

Rules:
- Clean semantic HTML
- No dev text
- No placeholders
- No editing header/footer

Rewrite this HTML:\n${originalHTML}
`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return response.output[0].content[0].text;
}

// -------------------------------
// AI: CSS Generator
// -------------------------------
async function designCSSFromHTML(sampleHTML) {
  const prompt = `
You are a senior medical UI/UX designer. Generate global CSS only.

${sampleHTML}
`;

  const res = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return res.output[0].content[0].text.trim();
}

// -------------------------------
// AI: SEO Brief Generator
// -------------------------------
async function seoBrief(keyword) {
  const prompt = `
Create a full Arabic SEO brief for: ${keyword}
Include: H1, H2, H3, keyphrases, and FAQ ideas.
Arabic only.
`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return response.output[0].content[0].text;
}

// -------------------------------
// AI Article Creator
// -------------------------------
async function generateArticle(title, keyword) {
  const prompt = `
Write a medically-safe Arabic HTML article.
Title: ${title}
Keyword: ${keyword}
Output: HTML only.
`;
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });
  return response.output[0].content[0].text;
}

// -------------------------------
// SERPER Competitor Analyzer
// -------------------------------
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

  const data = await res.json();
  return data;
}

// -------------------------------
// SEO AUTOPILOT (every 2 days)
// -------------------------------
async function seoAutopilot() {
  try {
    console.log("🚀 SEO AUTOPILOT STARTED");

    const keywords = ["علاج الادمان", "علاج إدمان", "علاج المخدرات"];
    let reports = {};

    for (const k of keywords) {
      const serp = await analyzeCompetitors(k);

      const prompt = `
Analyze this SERP for "${k}" and produce recommendations to outrank top competitors.

SERP DATA:
${JSON.stringify(serp)}

Arabic SEO recommendations only.
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

// -------------------------------
// ROUTES
// -------------------------------

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

app.get("/rewrite-all", async (req, res) => {
  try {
    const pages = await fetchAllPages();
    let updated = [];

    for (const p of pages) {
      try {
        const html = await fetchPageHTML(p.id);
        const rewritten = await rewriteHTML(html);
        await updatePageHTML(p.id, rewritten);
        updated.push(p.title.rendered);
      } catch (err) {
        console.log("Page failed:", p.id, err.message);
      }
    }

    res.json({ updated });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

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
    const brief = await seoBrief(req.body.keyword);
    res.json({ brief });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Generate & Publish Article
app.post("/publish-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;

    const html = await generateArticle(title, keyword);
    const post = await createWPPost(title, html);

    res.json({ published: post.id });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Competitor Analyzer
app.post("/competitor-analyze", async (req, res) => {
  try {
    const data = await analyzeCompetitors(req.body.keyword);
    res.json(data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// SEO autopilot route
app.get("/seo-autopilot", async (req, res) => {
  try {
    const report = await seoAutopilot();
    res.json(report);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/", (req, res) => res.send("KWI Backend Running ✓"));

// -------------------------------
// START SERVER
// -------------------------------
app.listen(4000, () => {
  console.log("🌐 Server live on 4000");

  // Run autopilot every 2 days
  setInterval(seoAutopilot, 2 * 24 * 60 * 60 * 1000);
});
