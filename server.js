import express from "express";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ------------------------------
// WordPress Settings
// ------------------------------
const WP_BASE_URL = process.env.WP_BASE_URL;           // Example: https://kayanrecovery.com
const WP_USERNAME = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const WP_HOMEPAGE_ID = process.env.WP_HOMEPAGE_ID;

// ------------------------------
// Helper: WordPress Auth
// ------------------------------
const wpHeaders = {
  "Authorization": "Basic " + Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString("base64"),
  "Content-Type": "application/json"
};

// ------------------------------
// Fetch WP page
// ------------------------------
async function fetchPage(id) {
  const res = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/pages/${id}`, {
    method: "GET",
    headers: wpHeaders
  });
  return res.json();
}

// ------------------------------
// Update WP page
// ------------------------------
async function updatePage(id, newHtml) {
  return fetch(`${WP_BASE_URL}/wp-json/wp/v2/pages/${id}`, {
    method: "POST",
    headers: wpHeaders,
    body: JSON.stringify({ content: newHtml })
  });
}

// ------------------------------
// The AUTOPILOT rewrite logic
// ------------------------------
async function rewritePageContent(originalHTML) {
  const prompt = `
You are a professional web designer + SEO strategist.
Rewrite the following homepage into a **modern medical-professional layout**, clean UI/UX, fully responsive, better structure, improved readability.

IMPORTANT:
- Output **ONLY valid JSON**
- Structure MUST be exactly:
{
  "html": "THE_NEW_REWRITTEN_HTML_HERE"
}

DO NOT include any extra text. Do not escape quotes artificially. Do not add explanations.

Here is the HTML to rewrite:
${originalHTML}
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL,
    input: prompt,
    response: {
      type: "json"
    }
  });

  const jsonOutput = response.output[0].content[0].json;

  return jsonOutput.html;
}

// ------------------------------
// AUTOPILOT LOOP
// ------------------------------
async function autopilot() {
  console.log("🚀 AUTO-PILOT STARTED (Homepage Only)");
  console.log(`📌 Target Page ID: ${WP_HOMEPAGE_ID}`);

  try {
    // Fetch page
    const page = await fetchPage(WP_HOMEPAGE_ID);

    // Rewrite via OpenAI
    const newHTML = await rewritePageContent(page.content.rendered);

    // Update WordPress
    await updatePage(WP_HOMEPAGE_ID, newHTML);

    console.log("✅ Rewritten successfully.");
  } catch (err) {
    console.log("❌ EXTREME ERROR:", err.message);
  }

  console.log("⏳ Waiting 10 minutes before next cycle...\n");
}

// Run every 10 minutes
setInterval(autopilot, 10 * 60 * 1000);

// Start server
app.listen(process.env.PORT || 4000, () => {
  console.log(`KWI server running at http://localhost:${process.env.PORT || 4000}`);
});
