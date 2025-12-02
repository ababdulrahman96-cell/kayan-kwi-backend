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

// INSTRUCTIONS + STRICT JSON RULE
const KWI_INSTRUCTIONS = `
You are Kayan Website Intelligence (KWI), an SEO, UX, content, and web optimization agent.

ALWAYS respond ONLY in the following JSON format — NEVER break it:

{
  "answer": "string",
  "language": "en or ar",
  "seo_suggestions": ["string"],
  "ux_suggestions": ["string"],
  "content_changes": [
    { "page": "string", "change": "string" }
  ]
}

NEVER add comments, NEVER add extra fields, NEVER add explanation outside the JSON.
If you cannot complete a field, return an empty string or empty array.
`;

// ENDPOINT
app.post("/kwi", async (req, res) => {
  try {
    const { message, pageUrl, language = "en" } = req.body;

    const chat = await client.chat.completions.create({
      model: "gpt-5.1-chat-latest",
      messages: [
        { role: "system", content: KWI_INSTRUCTIONS },
        {
          role: "user",
          content: `
Language: ${language}
Page URL: ${pageUrl || "N/A"}
User message: ${message}
`
        }
      ],
   
    });

    // RAW text returned by model
    const raw = chat.choices[0].message.content;

    let json = {};

    try {
      json = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        error: "Model returned invalid JSON",
        raw_output: raw
      });
    }

    res.json(json);

  } catch (error) {
    console.error("KWI ERROR:", error);
    res.status(500).json({
      error: "KWI agent failed",
      details: error.message
    });
  }
});

// START SERVER
app.listen(4000, () => {
  console.log("KWI server running at http://localhost:4000");
});
