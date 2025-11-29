import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { howItWorksData } from "@/data/landing";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="container mx-auto px-4 py-16 space-y-16">
        <section className="text-center space-y-6">
          <p className="text-sm tracking-[0.3em] uppercase text-emerald-300">
            Try the Automation Demo
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold">
            See how RythmIQ runs on its own
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Trigger the agent console, watch the shortfall forecast, and follow the
            same Sense → Decide → Act → Explain loop that powers the live product.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-in"
              className="bg-white text-slate-900 px-6 py-3 rounded-full font-semibold inline-flex items-center gap-2"
            >
              Launch live dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="text-emerald-300 underline decoration-dotted underline-offset-8"
            >
              Skip to agent console
            </Link>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-200 mb-3">
              Agent loop
            </p>
            <h2 className="text-3xl font-semibold">How the system thinks and acts</h2>
            <p className="text-slate-300 max-w-3xl mx-auto mt-3">
              Each agent subscribes to the flow below. Forecasts raise events,
              guardrails decide, micro-saves execute, and digest emails narrate the
              counterfactual so judges and users can trust the automation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {howItWorksData.map((step) => (
              <div
                key={step.title}
                className="bg-slate-900/70 border border-white/10 rounded-2xl p-6 flex gap-4"
              >
                <div className="bg-white/10 w-14 h-14 rounded-xl flex items-center justify-center text-emerald-300 text-2xl">
                  {step.icon}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="text-slate-300 text-sm mt-2">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-300">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-emerald-300 uppercase tracking-[0.2em] text-xs mb-2">
              Trigger
            </p>
            <p>
              Use the Agent Console buttons to fire shortfall forecasts, spending guardrails, goal backstops, and nightly digests on demand.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-emerald-300 uppercase tracking-[0.2em] text-xs mb-2">
              Observe
            </p>
            <p>
              Flip to <code>http://127.0.0.1:8288</code> to see the Inngest logs that prove each function ran, what data it used, and whether it auto-executed.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-emerald-300 uppercase tracking-[0.2em] text-xs mb-2">
              Explain
            </p>
            <p>
              Open any nudge in the dashboard, tap “Why?”, and show the counterfactual cached by the explainability service plus the nightly digest email.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
