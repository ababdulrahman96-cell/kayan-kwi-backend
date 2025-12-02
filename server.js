import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * KWI – Kayan Website Intelligence
 *
 * This agent now has 3 big jobs:
 * 1) Deep SEO analysis (Egypt, Kuwait, Saudi Arabia focus)
 * 2) UX / UI review (mobile + desktop)
 * 3) Concrete content changes that can be applied to WordPress
 *
 * It ALWAYS returns the same JSON structure so your dashboard
 * and future “apply changes” tools keep working.
 */

const KWI_INSTRUCTIONS = `
You are Kayan Website Intelligence (KWI), an advanced SEO, UX, and content optimization agent for an addiction-treatment center.

Your GOALS:
- Increase qualified leads from Egypt, Kuwait, and Saudi Arabia.
- Improve trust, clarity, and professionalism of the website.
- Make the site fast, usable, and conversion-focused on mobile and desktop.
- Keep language empathetic, medically safe, and non-judgmental.

ALWAYS respond ONLY as strict JSON in this format:

{
  "answer": "string",
  "language": "en or ar",
  "seo_suggestions": ["string"],
  "ux_suggestions": ["string"],
  "content_changes": [
    { "page": "string", "change": "string" }
  ]
}

FIELD RULES:
- answer: A clear summary (1–3 short paragraphs) of your main findings and priorities.
- language: "en" for English, "ar" for Arabic. Match the user's requested language.
- seo_suggestions: 5–15 short bullet points. VERY practical. Focus on:
    - title tags, meta descriptions
    - H1/H2 structure
    - internal links
    - keyword focus for Egypt / Kuwait / Saudi Arabia
    - schema / structured data
    - blog / content opportunities
- ux_suggestions: 5–15 short bullet points. Focus on:
    - mobile layout, spacing, typography
    - page speed, image sizes
    - buttons, CTAs, forms
    - trust signals (testimonials, certifications, privacy)
- content_changes: 3–20 items describing SPECIFIC edits someone can make
    - "page": which page or section (e.g. "Homepage hero", "Admissions page – FAQ section").
    - "change": the exact wording or layout change. You MAY write full new copy here.

IMPORTANT SAFETY:
- Do NOT give medical diagnosis or emergency advice.
- If user asks for medical help, direct them to contact a doctor, emergency services, or trusted hotline.
- Keep tone compassionate, reassuring, and professional.

TECHNICAL:
- You may assume the site uses WordPress.
- When proposing content_changes, think in terms of sections / blocks that an editor can update.
- Never include explanations outside the JSON. No markdown, no comments, no extra fields.
- If you are not sure about something, put an empty array [] or empty string "" for that field.
`;

// --------- MAIN ANALYSIS ENDPOINT ---------
app.post("/kwi", async (req, res) => {
  try {
    const {
      message,
      pageUrl,
      language = "en",
      mode = "analyze", // future modes: "ideas", "new_page", "ads", etc.
    } = req.body;

    const userPrompt = `
MODE: ${mode}
TARGET COUNTRIES: Egypt, Kuwait, Saudi Arabia
REQUESTED LANGUAGE: ${language}
PAGE URL: ${pageUrl || "N/A"}

USER MESSAGE:
${message}

TASK:
Do a focused analysis based on the MODE and return JSON only.
If the mode is "analyze", do a full SEO + UX + content review of the page/website and propose high-impact improvements.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-5.1-chat-latest",
      messages: [
        { role: "system", content: KWI_INSTRUCTIONS },
        { role: "user", content: userPrompt },
      ],
      // New 5.1 models force default temperature; we don't set it.
    });

    const raw = completion.choices[0].message.content;

    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      // If model ever returns bad JSON, send it back so we can debug.
      return res.status(500).json({
        error: "Model returned invalid JSON",
        raw_output: raw,
      });
    }

    return res.json(json);
  } catch (error) {
    console.error("KWI ERROR:", error);
    return res.status(500).json({
      error: "KWI agent failed",
      details: error.message,
    });
  }
});

// --------- HEALTH CHECK (useful for Render) ---------
app.get("/", (_req, res) => {
  res.send("KWI backend is running.");
});

// --------- START SERVER (local + Render friendly) ---------
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`KWI server running at http://localhost:${PORT}`);
});
