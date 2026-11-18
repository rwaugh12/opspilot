import { NextResponse } from "next/server";
import { triageDemo, triageWithAI } from "@/lib/triage";

// POST /api/triage  { text: string }
// Runs on the server, so the API key is never exposed to the browser.
export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (text.length < 5) {
    return NextResponse.json({ error: "Please describe the request." }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Request is too long (2000 characters max)." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const result = await triageWithAI(text, apiKey);
      return NextResponse.json({ result, engine: "ai" });
    } catch (err) {
      // If the AI call fails, fall back so the user still gets an answer.
      console.error("AI triage failed, using demo engine:", err);
    }
  }

  return NextResponse.json({ result: triageDemo(text), engine: "demo" });
}

// GET /api/triage tells the UI which engine is active.
export async function GET() {
  return NextResponse.json({ engine: process.env.ANTHROPIC_API_KEY ? "ai" : "demo" });
}
