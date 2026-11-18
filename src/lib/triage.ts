import type { Category, Priority, Team, TriageResult } from "./types";

// ---------------------------------------------------------------------------
// 1. The AI engine (used when ANTHROPIC_API_KEY is set)
// ---------------------------------------------------------------------------

const CATEGORIES: Category[] = [
  "Equipment",
  "Customer Complaint",
  "Staffing",
  "Inventory",
  "Facilities",
  "IT",
  "Other",
];
const PRIORITIES: Priority[] = ["Urgent", "High", "Normal", "Low"];
const TEAMS: Team[] = [
  "Maintenance",
  "Guest Services",
  "HR / Scheduling",
  "Supply Chain",
  "Facilities",
  "IT Help Desk",
  "Store Manager",
];

// The instructions the model gets. Asking for strict JSON lets the code
// read the answer reliably instead of parsing free-form text.
const SYSTEM_PROMPT = `You are an operations triage assistant for a multi-location retail food company.
Read an incoming request from a store employee or customer and return ONLY a JSON object with these keys:
- "category": one of ${JSON.stringify(CATEGORIES)}
- "priority": one of ${JSON.stringify(PRIORITIES)}. Urgent = safety risk, store can't operate, or money/food being lost right now.
- "team": one of ${JSON.stringify(TEAMS)}
- "summary": one short sentence (max 15 words)
- "location": the store number or site mentioned, or null
- "suggestedReply": a short, friendly reply to the person who submitted it (2-3 sentences)
- "nextSteps": an array of 2-4 short action items for the receiving team
No markdown, no extra text. JSON only.`;

export async function triageWithAI(text: string, apiKey: string): Promise<TriageResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    throw new Error(`AI request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const raw: string = data?.content?.[0]?.text ?? "";
  return validate(JSON.parse(extractJson(raw)));
}

// Models sometimes wrap JSON in extra text; grab the {...} block.
function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON");
  return raw.slice(start, end + 1);
}

// Never trust model output blindly: check every field and fall back to safe values.
function validate(obj: Record<string, unknown>): TriageResult {
  const pick = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

  return {
    category: pick(obj.category, CATEGORIES, "Other"),
    priority: pick(obj.priority, PRIORITIES, "Normal"),
    team: pick(obj.team, TEAMS, "Store Manager"),
    summary: String(obj.summary ?? "New request").slice(0, 140),
    location: obj.location ? String(obj.location) : null,
    suggestedReply: String(obj.suggestedReply ?? "Thanks, we received your request."),
    nextSteps: Array.isArray(obj.nextSteps)
      ? obj.nextSteps.map(String).slice(0, 4)
      : ["Review request"],
  };
}

// ---------------------------------------------------------------------------
// 2. The demo engine (no API key needed, so the live site always works)
// ---------------------------------------------------------------------------

type Rule = { category: Category; team: Team; words: string[]; steps: string[] };

const RULES: Rule[] = [
  {
    category: "Equipment",
    team: "Maintenance",
    words: ["machine", "freezer", "cooler", "leak", "broken", "not working", "dispenser", "compressor", "pos", "register"],
    steps: ["Dispatch technician", "Tag equipment out of service", "Log repair cost"],
  },
  {
    category: "Customer Complaint",
    team: "Guest Services",
    words: ["customer", "complaint", "rude", "refund", "sick", "wrong order", "review", "unhappy"],
    steps: ["Contact the guest within 24 hours", "Offer a make-good", "Review with store manager"],
  },
  {
    category: "Staffing",
    team: "HR / Scheduling",
    words: ["shift", "schedule", "call out", "called out", "short staffed", "hire", "employee", "coverage", "quit"],
    steps: ["Find shift coverage", "Update schedule", "Notify store manager"],
  },
  {
    category: "Inventory",
    team: "Supply Chain",
    words: ["out of", "ran out", "running low", "order", "delivery", "shipment", "toppings", "cups", "supply"],
    steps: ["Check nearby store stock", "Place rush order", "Confirm delivery window"],
  },
  {
    category: "Facilities",
    team: "Facilities",
    words: ["ac", "air conditioning", "plumbing", "toilet", "roof", "light", "door", "parking", "floor"],
    steps: ["Schedule vendor visit", "Post signage if unsafe", "Confirm repair completed"],
  },
  {
    category: "IT",
    team: "IT Help Desk",
    words: ["wifi", "internet", "password", "login", "computer", "printer", "email", "app", "tablet"],
    steps: ["Remote troubleshoot", "Reset credentials if needed", "Escalate to vendor"],
  },
];

const URGENT_WORDS = ["fire", "flood", "injury", "injured", "smoke", "gas", "unsafe", "closed", "can't open", "can't serve", "cannot serve", "melting", "sick", "emergency", "asap", "right now"];
const HIGH_WORDS = ["today", "tonight", "leak", "not working", "broken", "out of", "ran out", "short staffed", "refund"];
const LOW_WORDS = ["whenever", "no rush", "suggestion", "idea", "next week", "eventually"];

export function triageDemo(text: string): TriageResult {
  const t = ` ${text.toLowerCase()} `;

  // Score each rule by how many of its keywords appear.
  let best: Rule | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = rule.words.filter((w) => t.includes(w)).length;
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }

  const priority: Priority = URGENT_WORDS.some((w) => t.includes(w))
    ? "Urgent"
    : HIGH_WORDS.some((w) => t.includes(w))
      ? "High"
      : LOW_WORDS.some((w) => t.includes(w))
        ? "Low"
        : "Normal";

  const storeMatch = text.match(/store\s*#?\s*(\d+)/i) || text.match(/#(\d+)/);
  const location = storeMatch ? `Store #${storeMatch[1]}` : null;

  const category = best?.category ?? "Other";
  const team = best?.team ?? "Store Manager";
  const firstSentence = text.split(/[.!?\n]/)[0].trim();
  const summary = firstSentence.length > 90 ? firstSentence.slice(0, 87) + "..." : firstSentence;

  return {
    category,
    priority,
    team,
    summary: summary || "New request",
    location,
    suggestedReply:
      priority === "Urgent"
        ? `Thanks for flagging this right away. ${team} has been alerted and is treating it as urgent. Someone will reach out shortly.`
        : `Thanks for letting us know. This has been sent to ${team}, and they'll follow up with you soon.`,
    nextSteps: best?.steps ?? ["Review request", "Assign owner"],
  };
}
