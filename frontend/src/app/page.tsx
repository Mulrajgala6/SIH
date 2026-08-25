"use client";

import { useEffect, useState } from "react";
import { API_URL, getHealth, type HealthResponse } from "@/lib/api";

type State =
  | { kind: "checking" }
  | { kind: "ok"; data: HealthResponse }
  | { kind: "error"; message: string };

const PIPELINE = [
  "Create consignment",
  "Choose delivery slot",
  "Recipient confirms / changes",
  "AI recommends a slot",
  "Route optimized (OR-Tools)",
  "Postman delivers + OTP",
  "Analytics update",
];

export default function Home() {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let active = true;
    getHealth()
      .then((data) => active && setState({ kind: "ok", data }))
      .catch((e) => active && setState({ kind: "error", message: String(e) }));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          DS
        </span>
        <span className="text-sm font-medium tracking-wide text-brand-700">
          India Post · SIH 2026
        </span>
      </div>

      <h1 className="text-4xl font-semibold tracking-tight text-ink">DAKSYNC</h1>
      <p className="mt-2 max-w-xl text-lg text-slate-600">
        AI-assisted delivery scheduling &amp; route planning. Choose when you
        are available — India Post plans the delivery around it.
      </p>

      {/* Backend connectivity */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Backend connection
          </span>
          <StatusPill state={state} />
        </div>
        <p className="mt-2 break-all text-xs text-slate-500">{API_URL}</p>
        {state.kind === "ok" && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Meta label="Service" value={state.data.service} />
            <Meta label="Version" value={state.data.version} />
            <Meta
              label="Database"
              value={`${state.data.database.engine} · ${
                state.data.database.connected ? "connected" : "down"
              }`}
            />
            <Meta label="Status" value={state.data.status} />
          </dl>
        )}
        {state.kind === "error" && (
          <p className="mt-3 text-sm text-accent">
            Could not reach the backend. Start it with{" "}
            <code className="rounded bg-slate-100 px-1">uvicorn app.main:app --reload</code>{" "}
            in <code className="rounded bg-slate-100 px-1">backend/</code>.
          </p>
        )}
      </div>

      {/* Product pipeline (what we're building, phase by phase) */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-slate-500">The DAKSYNC journey</h2>
        <ol className="mt-3 flex flex-wrap gap-2">
          {PIPELINE.map((step, i) => (
            <li
              key={step}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-10 text-xs text-slate-400">
        Phase 0 — foundation. Frontend, backend and database are wired together.
      </p>
    </main>
  );
}

function StatusPill({ state }: { state: State }) {
  const map = {
    checking: { text: "Checking…", cls: "bg-slate-100 text-slate-600" },
    ok: { text: "Connected", cls: "bg-emerald-50 text-emerald-700" },
    error: { text: "Not reachable", cls: "bg-red-50 text-accent" },
  } as const;
  const s = map[state.kind];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      {s.text}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
