"use client";

import { useEffect, useMemo, useState } from "react";
import type { Priority, Ticket, TriageResult } from "@/lib/types";

const STORAGE_KEY = "opspilot-tickets";

const SAMPLES = [
  "The froyo machine at store 12 is leaking all over the floor and we can't serve vanilla. Need someone today!",
  "Customer at store #4 says she got sick after visiting yesterday and wants a refund.",
  "Two people called out for tonight's close at store 7, we're short staffed.",
  "We ran out of waffle cones and the strawberry topping at store 21, delivery isn't until Friday.",
  "The tablet we use for online orders won't log in. Password reset isn't working.",
];

const PRIORITY_STYLE: Record<Priority, string> = {
  Urgent: "bg-red-100 text-red-800 ring-red-200",
  High: "bg-orange-100 text-orange-800 ring-orange-200",
  Normal: "bg-sky-100 text-sky-800 ring-sky-200",
  Low: "bg-slate-100 text-slate-700 ring-slate-200",
};
const PRIORITY_ORDER: Priority[] = ["Urgent", "High", "Normal", "Low"];

// Reading/writing browser storage can fail (private mode, etc.), so wrap it.
function loadTickets(): Ticket[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveTickets(tickets: Ticket[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    /* ignore */
  }
}

function Badge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${PRIORITY_STYLE[priority]}`}>
      {priority}
    </span>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [engine, setEngine] = useState<"ai" | "demo" | null>(null);
  const [filter, setFilter] = useState<"All" | Priority>("All");
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    // Browser storage only exists on the client, so load it after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTickets(loadTickets());
    fetch("/api/triage")
      .then((r) => r.json())
      .then((d) => setEngine(d.engine))
      .catch(() => setEngine("demo"));
  }, []);

  function update(next: Ticket[]) {
    setTickets(next);
    saveTickets(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      const result: TriageResult = data.result;
      const ticket: Ticket = {
        ...result,
        id: crypto.randomUUID(),
        text,
        submittedBy: name.trim() || "Anonymous",
        createdAt: new Date().toISOString(),
        status: "Open",
        engine: data.engine,
      };
      setLatest(ticket);
      update([ticket, ...tickets]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const visible = useMemo(
    () =>
      tickets
        .filter((t) => (showDone ? true : t.status === "Open"))
        .filter((t) => filter === "All" || t.priority === filter)
        .sort(
          (a, b) =>
            PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [tickets, filter, showDone],
  );

  const open = tickets.filter((t) => t.status === "Open");
  const stats = [
    { label: "Open requests", value: open.length },
    { label: "Urgent", value: open.filter((t) => t.priority === "Urgent").length },
    { label: "Resolved", value: tickets.filter((t) => t.status === "Done").length },
    { label: "Est. minutes saved", value: tickets.length * 4 },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            O
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">OpsPilot</h1>
            <p className="text-sm text-slate-500">AI request triage for multi-location operations</p>
          </div>
        </div>
        {engine && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              engine === "ai"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-700 ring-amber-200"
            }`}
          >
            {engine === "ai" ? "● Live AI (Claude)" : "● Demo mode (rule-based)"}
          </span>
        )}
      </header>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Intake form */}
        <section className="lg:col-span-2">
          <form onSubmit={submit} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold">Submit a request</h2>
            <p className="mb-4 text-sm text-slate-500">Describe the issue in plain English. AI does the rest.</p>

            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria, Store 12"
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            <label className="mb-1 block text-sm font-medium" htmlFor="text">
              What&apos;s going on?
            </label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="The yogurt machine at store 12 is leaking..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              {SAMPLES.map((s, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setText(s)}
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Example {i + 1}
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || text.trim().length < 5}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Triaging..." : "Triage with AI"}
            </button>
          </form>

          {/* Latest result */}
          {latest && (
            <div className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-indigo-200">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Triage result</h3>
                <Badge priority={latest.priority} />
              </div>
              <p className="text-sm font-medium">{latest.summary}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500">Category</dt>
                <dd>{latest.category}</dd>
                <dt className="text-slate-500">Routed to</dt>
                <dd>{latest.team}</dd>
                <dt className="text-slate-500">Location</dt>
                <dd>{latest.location ?? "Not specified"}</dd>
              </dl>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Next steps</p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {latest.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Draft reply</p>
              <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{latest.suggestedReply}</p>
            </div>
          )}
        </section>

        {/* Dashboard */}
        <section className="lg:col-span-3">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Request queue</h2>
              <div className="flex flex-wrap items-center gap-2">
                {(["All", ...PRIORITY_ORDER] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilter(p)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      filter === p ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <label className="ml-1 flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
                  Show resolved
                </label>
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                No requests yet. Try one of the examples to see the AI in action.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge priority={t.priority} />
                        <span className="text-xs text-slate-500">
                          {t.category} → <span className="font-medium text-slate-700">{t.team}</span>
                        </span>
                        {t.location && <span className="text-xs text-slate-400">· {t.location}</span>}
                      </div>
                      <p className={`mt-1 text-sm ${t.status === "Done" ? "text-slate-400 line-through" : ""}`}>
                        {t.summary}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {t.submittedBy} · {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        update(
                          tickets.map((x) =>
                            x.id === t.id ? { ...x, status: x.status === "Open" ? "Done" : "Open" } : x,
                          ),
                        )
                      }
                      className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      {t.status === "Open" ? "Resolve" : "Reopen"}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tickets.length > 0 && (
              <button onClick={() => update([])} className="mt-4 text-xs text-slate-400 hover:text-red-600">
                Clear all
              </button>
            )}
          </div>
        </section>
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Built with Next.js, TypeScript, Tailwind CSS and Claude · Deployed on Vercel
      </footer>
    </main>
  );
}
