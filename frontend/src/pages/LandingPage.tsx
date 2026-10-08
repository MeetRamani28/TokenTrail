import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  DollarSign,
  Layers,
} from 'lucide-react';

const TokenTrailCanvas = React.lazy(() =>
  import('../components/three/TokenTrailCanvas').then((m) => ({ default: m.TokenTrailCanvas }))
);

export const LandingPage: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* 3D Canvas Background */}
      <Suspense fallback={<div className="absolute inset-0 bg-slate-950" />}>
        <TokenTrailCanvas />
      </Suspense>

      {/* Navigation Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <img src="/icon.png" alt="TokenTrail Logo" className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.45)] hover:scale-105 transition-transform" />
          <span className="font-bold text-lg tracking-tight text-white">TokenTrail</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/sign-in"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-2 py-1"
          >
            Sign In
          </Link>
          <Link
            to="/overview"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 font-semibold"
          >
            <span>Launch Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Zero-Overhead Python SDK + Dynamic Cost Engine
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-tight">
          Track LLM Latency, Costs & Spans with{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400">
            Zero Latency Penalty
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed">
          TokenTrail captures streaming Time-to-First-Token (TTFT), token consumption,
          dynamic model pricing, and execution waterfalls via a non-blocking background queue.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/overview"
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center gap-2 group"
          >
            <span>Open Demo Dashboard</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="https://github.com/MeetRamani28/TokenTrail"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 font-medium text-base transition-all"
          >
            View GitHub Source
          </a>
        </div>

        {/* Feature Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Streaming TTFT Tracking</h3>
            <p className="mt-2 text-sm text-slate-400">
              Measures exact millisecond Time to First Token for OpenAI and Groq streaming responses.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition-all">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Dynamic Cost Engine</h3>
            <p className="mt-2 text-sm text-slate-400">
              Enriches telemetry with sub-cent precision based on user-editable model price rates.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition-all">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Trace Waterfall Tree</h3>
            <p className="mt-2 text-sm text-slate-400">
              Inspect multi-step agent chains, nested tool calls, and retrieval steps in a single timeline.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        TokenTrail &bull; Free & Open-Source LLM Observability
      </footer>
    </div>
  );
};
