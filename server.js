import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// ---------- OpenAI client ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Express app ----------
const app = express();
app.use(cors());
app.use(express.json());

// ---------- WordPress config ----------
const WP_BASE_URL = process.env.WP_BASE_URL;          // e.g. https://kayanrecovery.com
const WP_USERNAME = process.env.WP_USERNAME;          // e.g. ajamiabdulrahman
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;  // WP application password

// Your important pages
const AUTO_PAGES = [
  { id: 195, name: "Homepage" },
  { id: 197, name: "Articles" },
  { id: 199, name: "Contact Us" },
  { id: 201, name: "Gallery" },
  { id: 203, name: "Who We Are" },
  { id: 243, name: "License" },
];

// ---------- Helpers ----------
function wpAuthHeaders() {
  const token = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

async function fetchPageHtml(pageId) {
  const resp = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`, {
    headers: {
      Authorization: wpAuthHeaders().Authorization,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WP READ FAILED for ${pageId}: ${text}`);
  }

  const json = await resp.json();
  return json.content?.rendered || "";
}

async function updatePageHtml(pageId, newHtml) {
  const resp = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`, {
    method: "POST",
    headers: wpAuthHeaders(),
    body: JSON.stringify({ content: newHtml }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WP WRITE FAILED for ${pageId}: ${text}`);
  }

  return await resp.json();
}

async function rewriteHtmlWithAI(originalHtml, pageName, language = "ar") {
  const systemPrompt = `
You are Kayan Website Intelligence (KWI), an extreme website optimizer for an addiction treatment center.

Rewrite this WordPress PAGE HTML in EXTREME MODE:

- Business: addiction treatment / recovery center.
- Audience: Egypt, Kuwait, Saudi Arabia.
- Tone: medically safe, empathetic, professional.
- Make layout modern, clean, mobile-first, high-conversion.
- Keep ALL phone numbers visible & clickable.
- Do NOT remove the clinic phone number.
- Keep the domain and critical links valid (no broken structure).
- Use semantic headings (H1, H2, H3) with SEO focus.
- Make clear CTAs for calling / WhatsApp / contacting.
- Return ONLY pure HTML (no JSON, no explanations, no comments).
`;

  const userPrompt = `
PAGE NAME: ${pageName}
LANGUAGE: ${language}

CURRENT HTML:
${originalHtml}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const newHtml = completion.choices[0].message.content || "";
  return newHtml;
}

// ---------- 1) KWI analysis endpoint (JSON output) ----------
app.post("/kwi", async (req, res) => {
  try {
    const { message, language = "en" } = req.body;

    const instructions = `
You are Kayan Website Intelligence (KWI).
Return ONLY valid JSON with this exact shape:

{
  "answer": "string",
  "language": "en or ar",
  "seo_suggestions": ["string"],
  "ux_suggestions": ["string"],
  "content_changes": [
    { "page": "string", "change": "string" }
  ]
}

Do not add extra fields, comments, or markdown.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: instructions },
        {
          role: "user",
          content: `Language: ${language}\n\nUser request:\n${message}`,
        },
      ],
    });

    const raw = completion.choices[0].message.content || "{}";

    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        error: "Model returned non-JSON",
        raw_output: raw,
      });
    }

    res.json(json);
  } catch (error) {
    console.error("KWI /kwi ERROR:", error);
    res.status(500).json({
      error: "KWI analysis failed",
      details: error.message,
    });
  }
});

// ---------- 2) Single-page EXTREME rewrite endpoint ----------
app.post("/kwi/rewrite/:id", async (req, res) => {
  try {
    const pageId = req.params.id;
    const { language = "ar" } = req.body;

    const pageMeta = AUTO_PAGES.find((p) => String(p.id) === String(pageId)) || {
      id: pageId,
      name: `Page ${pageId}`,
    };

    console.log(`🔥 EXTREME rewrite START for ${pageMeta.name} (ID ${pageId})`);

    const originalHtml = await fetchPageHtml(pageId);
    console.log(`📄 Loaded content for page ${pageId} (${originalHtml.length} chars)`);

    const newHtml = await rewriteHtmlWithAI(originalHtml, pageMeta.name, language);
    console.log(`🤖 New HTML generated for page ${pageId} (${newHtml.length} chars)`);

    const updated = await updatePageHtml(pageId, newHtml);
    console.log(`✅ WordPress updated for page ${pageId}`);

    res.json({
      success: true,
      pageId,
      pageName: pageMeta.name,
      link: updated.link,
    });
  } catch (error) {
    console.error("EXTREME /kwi/rewrite ERROR:", error);
    res.status(500).json({
      error: "KWI extreme rewrite failed",
      details: error.message,
    });
  }
});

// ---------- 3) FULL AUTO-PILOT: rewrite ALL pages in sequence ----------
async function autoRewriteAllPages(language = "ar") {
  console.log("🚀 AUTO-PILOT CYCLE STARTED");
  for (const page of AUTO_PAGES) {
    try {
      console.log(`🔁 Auto-rewriting ${page.name} (ID ${page.id})`);
      const originalHtml = await fetchPageHtml(page.id);
      const newHtml = await rewriteHtmlWithAI(originalHtml, page.name, language);
      await updatePageHtml(page.id, newHtml);
      console.log(`✅ Auto-rewrite DONE for ${page.name} (ID ${page.id})`);
    } catch (err) {
      console.error(`❌ Auto-rewrite FAILED for ${page.name} (ID ${page.id}):`, err.message);
    }
  }
  console.log("🏁 AUTO-PILOT CYCLE FINISHED");
}

// Manual trigger endpoint (if you want to call from dashboard later)
app.post("/kwi/auto-rewrite-all", async (req, res) => {
  const { language = "ar" } = req.body;
  autoRewriteAllPages(language)
    .then(() => console.log("✅ Manual auto-rewrite-all finished"))
    .catch((err) => console.error("❌ Manual auto-rewrite-all error:", err));
  res.json({ started: true, message: "Auto-rewrite-all started in background" });
});

// ---------- 4) Auto-pilot interval (every 30 minutes) ----------
const AUTO_INTERVAL_MINUTES = 30;

// run once on startup
autoRewriteAllPages("ar").catch((err) =>
  console.error("❌ Startup auto-rewrite error:", err.message)
);

// then run every 30 minutes
setInterval(() => {
  autoRewriteAllPages("ar").catch((err) =>
    console.error("❌ Scheduled auto-rewrite error:", err.message)
  );
}, AUTO_INTERVAL_MINUTES * 60 * 1000);

// ---------- Health check ----------
app.get("/", (_req, res) => {
  res.send("KWI backend is running. Auto-pilot is enabled.");
});

// ---------- Start server ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`KWI server running at http://localhost:${PORT}`);
});

