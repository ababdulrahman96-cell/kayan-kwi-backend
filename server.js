import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------------------------
// Fetch WordPress Page
// ---------------------------
async function fetchPageContent(pageId) {
  const url = `${process.env.WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString("base64");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed WP Fetch (${res.status})`);
  }

  const data = await res.json();
  return data.content.rendered;
}

// ---------------------------
// Update WordPress Page
// ---------------------------
async function updatePageContent(pageId, newHtml) {
  const url = `${process.env.WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: newHtml
    })
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Failed WP Update: ${e}`);
  }

  return await res.json();
}

// ---------------------------
// Rewrite With OpenAI
// ---------------------------
Log in to your Hostinger account
In the left menu, click Domains
Click on the domain horryea1.com
Scroll down until you find:
“Transfer domain to another Hostinger user”
Click it
Enter my Hostinger email:
👉 amre0111@gmail.com
Confirm the transfer when Hostinger asks you
Once done, please tell me “Transfer completed”

// ---------------------------
// Auto Pilot
// ---------------------------
async function autoPilot() {
  try {
    console.log("🚀 AUTO-PILOT STARTED");

    const pageId = process.env.WP_HOMEPAGE_ID;
    console.log("➡️ Target Page ID:", pageId);

    const original = await fetchPageContent(pageId);
    console.log("📥 Fetched WP HTML");

    const rewritten = await rewriteContent(original);
    console.log("✍️ AI Rewrite Completed");

    await updatePageContent(pageId, rewritten);
    console.log("✅ WordPress Page Updated");

  } catch (err) {
    console.error("❌ AUTO-PILOT ERROR:", err.message);
  }

  console.log("⏳ Waiting 10 minutes before next cycle...");
  setTimeout(autoPilot, 10 * 60 * 1000);
}

// Start server & autopilot
app.listen(process.env.PORT || 4000, () => {
  console.log("Server running...");
  autoPilot();
});
