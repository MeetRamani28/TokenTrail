import React from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { Activity, Zap, Layers, DollarSign, ShieldCheck, ArrowRight } from 'lucide-react';

interface AuthPageProps {
  mode: 'sign-in' | 'sign-up';
}

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-slate-900">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              TokenTrail
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              v0.1
            </span>
          </div>
        </Link>

        <Link
          to="/"
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <span>Back to Landing</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: TokenTrail Value Proposition & Features */}
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Production-Grade LLM Observability</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Monitor, trace, and optimize your{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                AI agents in real-time
              </span>
              .
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-lg">
              TokenTrail instruments your multi-step RAG pipelines and LLM applications with sub-millisecond overhead, hierarchical span inspection, and token cost attribution.
            </p>
          </div>

          {/* Features Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">0.013ms Overhead</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Async background workers never block your LLM responses or agent execution.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Waterfall Traces</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track TTFT, tool execution, and hierarchical multi-agent spans in real-time.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Cost Attribution</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time dynamic pricing per 1M tokens across all models and providers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Multi-Project Isolation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dedicated API keys and isolated telemetry pipelines for each of your AI apps.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Custom Styled Clerk Authentication */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-md">
            {CLERK_KEY ? (
              mode === 'sign-in' ? (
                <SignIn
                  routing="path"
                  path="/sign-in"
                  signUpUrl="/sign-up"
                  fallbackRedirectUrl="/overview"
                  appearance={{
                    variables: {
                      colorPrimary: '#10b981',
                      colorBackground: '#090d16',
                      colorInputBackground: '#020617',
                      colorInputText: '#f8fafc',
                      colorText: '#f8fafc',
                      colorTextSecondary: '#94a3b8',
                      borderRadius: '0.75rem',
                    },
                    elements: {
                      rootBox: 'w-full shadow-2xl',
                      card: 'bg-slate-900/90 border border-slate-800/90 shadow-2xl rounded-2xl backdrop-blur-xl',
                      formButtonPrimary: 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-500/20 transition-all text-xs py-2.5',
                      footerActionLink: 'text-emerald-400 hover:text-emerald-300 font-semibold',
                      headerTitle: 'text-xl font-bold text-white',
                      headerSubtitle: 'text-xs text-slate-400',
                      socialButtonsBlockButton: 'bg-slate-950/80 hover:bg-slate-800 text-white border-slate-800',
                      dividerLine: 'bg-slate-800',
                      dividerText: 'text-slate-500 text-xs font-mono',
                      formFieldLabel: 'text-xs text-slate-300 font-medium',
                      formFieldInput: 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30',
                    },
                  }}
                />
              ) : (
                <SignUp
                  routing="path"
                  path="/sign-up"
                  signInUrl="/sign-in"
                  fallbackRedirectUrl="/overview"
                  appearance={{
                    variables: {
                      colorPrimary: '#10b981',
                      colorBackground: '#090d16',
                      colorInputBackground: '#020617',
                      colorInputText: '#f8fafc',
                      colorText: '#f8fafc',
                      colorTextSecondary: '#94a3b8',
                      borderRadius: '0.75rem',
                    },
                    elements: {
                      rootBox: 'w-full shadow-2xl',
                      card: 'bg-slate-900/90 border border-slate-800/90 shadow-2xl rounded-2xl backdrop-blur-xl',
                      formButtonPrimary: 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-500/20 transition-all text-xs py-2.5',
                      footerActionLink: 'text-emerald-400 hover:text-emerald-300 font-semibold',
                      headerTitle: 'text-xl font-bold text-white',
                      headerSubtitle: 'text-xs text-slate-400',
                      socialButtonsBlockButton: 'bg-slate-950/80 hover:bg-slate-800 text-white border-slate-800',
                      dividerLine: 'bg-slate-800',
                      dividerText: 'text-slate-500 text-xs font-mono',
                      formFieldLabel: 'text-xs text-slate-300 font-medium',
                      formFieldInput: 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30',
                    },
                  }}
                />
              )
            ) : (
              /* Fallback when Clerk key is unconfigured */
              <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl space-y-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-white">TokenTrail Demo Access</h2>
                  <p className="text-xs text-slate-400">
                    Live telemetry dashboard access with pre-configured demo user and active ingestion pipeline.
                  </p>
                </div>
                <Link
                  to="/overview"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <span>Launch Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 text-center text-xs text-slate-600 border-t border-slate-900">
        TokenTrail &copy; {new Date().getFullYear()} &mdash; Zero-overhead LLM observability.
      </footer>
    </div>
  );
};
