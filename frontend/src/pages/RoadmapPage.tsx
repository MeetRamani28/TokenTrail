import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useProjects, useProjectKey } from '../api/queries';
import { useAppSelector } from '../store';
import {
  Compass,
  Copy,
  CheckCheck,
  FolderKanban,
  Send,
  Loader2,
  CheckCircle2,
  FileCode,
  ShieldCheck,
  ArrowRight,
  Layers,
  Zap,
  Bot,
  Globe,
  FileText,
  Terminal,
  Laptop,
  Cloud,
  Sparkles,
  Cpu,
  Activity,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

type IntegrationMode = 'auto' | 'multiagent' | 'fastapi' | 'dropin' | 'rest';

export const RoadmapPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();
  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);
  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const effectiveProjectId = selectedProjectId || activeProject?.id;
  const { data: keyData } = useProjectKey(effectiveProjectId);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [mode, setMode] = useState<IntegrationMode>('auto');
  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);
  const [lastTraceId, setLastTraceId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const handleSendTestPing = async () => {
    setIsPinging(true);
    setPingSuccess(false);

    try {
      const traceId = `trace_${Date.now()}`;
      const spanId1 = `span_${Date.now()}_1`;
      const spanId2 = `span_${Date.now()}_2`;
      const spanId3 = `span_${Date.now()}_3`;
      const spanId4 = `span_${Date.now()}_4`;

      const now = Date.now();
      const payload = {
        spans: [
          {
            trace_id: traceId,
            span_id: spanId1,
            parent_span_id: null,
            name: 'orchestrator_planning',
            span_type: 'chain',
            started_at: new Date(now - 850).toISOString(),
            ended_at: new Date(now - 710).toISOString(),
            duration_ms: 140,
            status: 'ok',
            model: null,
            prompt_tokens: 0,
            completion_tokens: 0,
            metadata: { step: 'plan_decomposition', agent: 'OrchestratorAgent' },
          },
          {
            trace_id: traceId,
            span_id: spanId2,
            parent_span_id: spanId1,
            name: 'database_schema_fetcher',
            span_type: 'tool',
            started_at: new Date(now - 700).toISOString(),
            ended_at: new Date(now - 550).toISOString(),
            duration_ms: 150,
            status: 'ok',
            model: null,
            prompt_tokens: 0,
            completion_tokens: 0,
            metadata: { tables: ['users', 'orders', 'transactions'] },
          },
          {
            trace_id: traceId,
            span_id: spanId3,
            parent_span_id: spanId1,
            name: 'sql_generator_agent',
            span_type: 'llm',
            started_at: new Date(now - 540).toISOString(),
            ended_at: new Date(now - 90).toISOString(),
            duration_ms: 450,
            status: 'ok',
            model: 'openai/gpt-oss-20b',
            provider: 'groq',
            prompt_tokens: 838,
            completion_tokens: 124,
            metadata: { temperature: 0.1, framework: 'tokentrail_auto' },
          },
          {
            trace_id: traceId,
            span_id: spanId4,
            parent_span_id: spanId1,
            name: 'ast_guard_validation',
            span_type: 'tool',
            started_at: new Date(now - 80).toISOString(),
            ended_at: new Date(now).toISOString(),
            duration_ms: 80,
            status: 'ok',
            model: null,
            prompt_tokens: 0,
            completion_tokens: 0,
            metadata: { ast_check: 'passed', read_only: true },
          },
        ],
        traces: [
          {
            trace_id: traceId,
            name: 'orchestrator_pipeline',
            status: 'ok',
          },
        ],
      };

      await apiFetch(
        '/api/ingest/spans',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        effectiveProjectId
      );

      setPingSuccess(true);
      setLastTraceId(traceId);
      toast.success('4-step cascading agent telemetry sent! Check Traces for the Execution Waterfall.');

      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['timeseries'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ping failed to send');
    } finally {
      setIsPinging(false);
    }
  };

  const apiKeyDisplay = keyData?.api_key || keyData?.key_prefix
    ? `${keyData?.key_prefix || 'tt_live'}...`
    : 'tt_live_your_project_key';

  const endpointDisplay = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://tokentrail-backend.onrender.com');

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2.5 text-emerald-400 font-mono text-xs font-semibold mb-1">
          <Compass className="w-4 h-4" />
          <span>PRODUCTION INTEGRATION BLUEPRINT</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          How to Integrate TokenTrail Into Any Project
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Zero-overhead LLM telemetry, micro-cent cost tracking, and cascading execution waterfalls. Select your integration mode below for a step-by-step, fully runnable implementation.
        </p>
      </div>

      {/* Target Project Status Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Target Project:</span>
              <span className="text-sm font-bold text-white">{keyData?.project_name || activeProject?.name || 'Default Project'}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Partition ID: {effectiveProjectId || 'default'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400 text-[11px] hidden sm:inline">Active Project Key:</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-semibold">
            {keyData?.key_prefix ? `${keyData.key_prefix}...` : 'Configure in Settings'}
          </span>
        </div>
      </div>

      {/* Architecture Mode Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Select Your Integration Architecture</span>
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">Choose the exact pattern matching your tech stack</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Mode 1: 1-Line Auto-Patch */}
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === 'auto'
                ? 'bg-amber-500/15 border-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${mode === 'auto' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Zap className="w-4 h-4" />
                </div>
                {mode === 'auto' && <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">ACTIVE</span>}
              </div>
              <h3 className="text-xs font-bold text-white mb-0.5">1-Line Auto-Patch</h3>
              <p className="text-[11px] text-slate-400 leading-snug">Zero code rewrite. Intercepts Groq, OpenAI & Anthropic globally.</p>
            </div>
            <span className="text-[10px] text-amber-400/90 font-medium mt-3 block">⚡ Fastest Setup (1 min)</span>
          </button>

          {/* Mode 2: Multi-Agent Waterfall */}
          <button
            type="button"
            onClick={() => setMode('multiagent')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === 'multiagent'
                ? 'bg-cyan-500/15 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${mode === 'multiagent' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Bot className="w-4 h-4" />
                </div>
                {mode === 'multiagent' && <span className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">ACTIVE</span>}
              </div>
              <h3 className="text-xs font-bold text-white mb-0.5">Multi-Agent Systems</h3>
              <p className="text-[11px] text-slate-400 leading-snug">Hierarchical flamegraph via @agent and @tool decorators.</p>
            </div>
            <span className="text-[10px] text-cyan-400/90 font-medium mt-3 block">🤖 Deep Cascading Tree</span>
          </button>

          {/* Mode 3: FastAPI Middleware */}
          <button
            type="button"
            onClick={() => setMode('fastapi')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === 'fastapi'
                ? 'bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${mode === 'fastapi' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                {mode === 'fastapi' && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">ACTIVE</span>}
              </div>
              <h3 className="text-xs font-bold text-white mb-0.5">FastAPI Middleware</h3>
              <p className="text-[11px] text-slate-400 leading-snug">Binds all HTTP routes & child LLMs into 1 unified trace.</p>
            </div>
            <span className="text-[10px] text-emerald-400/90 font-medium mt-3 block">🌐 1-Line use_tokentrail(app)</span>
          </button>

          {/* Mode 4: Standalone 1-File */}
          <button
            type="button"
            onClick={() => setMode('dropin')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === 'dropin'
                ? 'bg-indigo-500/15 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${mode === 'dropin' ? 'bg-indigo-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                {mode === 'dropin' && <span className="text-[10px] font-bold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full">ACTIVE</span>}
              </div>
              <h3 className="text-xs font-bold text-white mb-0.5">1-File Drop-in</h3>
              <p className="text-[11px] text-slate-400 leading-snug">Zero pip installation. Standalone file using Python stdlib.</p>
            </div>
            <span className="text-[10px] text-indigo-400/90 font-medium mt-3 block">📁 Zero External Deps</span>
          </button>

          {/* Mode 5: REST / cURL */}
          <button
            type="button"
            onClick={() => setMode('rest')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              mode === 'rest'
                ? 'bg-purple-500/15 border-purple-500/40 shadow-lg shadow-purple-500/10'
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${mode === 'rest' ? 'bg-purple-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Terminal className="w-4 h-4" />
                </div>
                {mode === 'rest' && <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">ACTIVE</span>}
              </div>
              <h3 className="text-xs font-bold text-white mb-0.5">REST API / cURL</h3>
              <p className="text-[11px] text-slate-400 leading-snug">Language-agnostic JSON ingest for Node.js, Next.js or Go.</p>
            </div>
            <span className="text-[10px] text-purple-400/90 font-medium mt-3 block">🔌 Universal HTTP</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC COMPLETE STEP-BY-STEP BLUEPRINT BASED ON SELECTED MODE */}
      <div className="space-y-8">
        {/* ========================================================================= */}
        {/* STEP 1: INSTALLATION & PREREQUISITES */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-emerald-500/20">
              1
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Step 1: Install Dependencies</h2>
              <p className="text-xs text-slate-400">Run this in your project terminal or add to your requirements.txt</p>
            </div>
          </div>

          {mode === 'dropin' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Download the standalone <code className="text-indigo-400 font-mono">tokentrail_setup.py</code> file directly into your project root. <strong>No pip dependencies required!</strong>
              </p>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex items-center justify-between text-indigo-400">
                <span className="select-all truncate pr-2">
                  curl -O https://raw.githubusercontent.com/MeetRamani28/TokenTrail/main/backend/sdk/tokentrail_setup.py
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('curl -O https://raw.githubusercontent.com/MeetRamani28/TokenTrail/main/backend/sdk/tokentrail_setup.py', 'curl-dropin')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Copy Command"
                >
                  {copiedSection === 'curl-dropin' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : mode === 'fastapi' ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex items-center justify-between text-emerald-400">
                <span className="select-all truncate pr-2">
                  pip install "git+https://github.com/MeetRamani28/TokenTrail.git#subdirectory=backend/sdk" fastapi uvicorn groq python-dotenv
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('pip install "git+https://github.com/MeetRamani28/TokenTrail.git#subdirectory=backend/sdk" fastapi uvicorn groq python-dotenv', 'install-fastapi')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Copy Command"
                >
                  {copiedSection === 'install-fastapi' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : mode === 'rest' ? (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-200">
              Zero SDK installation required. You can send spans directly from any programming language via HTTP POST.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex items-center justify-between text-emerald-400">
                <span className="select-all truncate pr-2">
                  pip install "git+https://github.com/MeetRamani28/TokenTrail.git#subdirectory=backend/sdk" groq python-dotenv
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('pip install "git+https://github.com/MeetRamani28/TokenTrail.git#subdirectory=backend/sdk" groq python-dotenv', 'install-std')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Copy Command"
                >
                  {copiedSection === 'install-std' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ========================================================================= */}
        {/* STEP 2: ENVIRONMENT CONFIGURATION (.env) */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-cyan-500/20">
              2
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Step 2: Configure Environment Variables (.env)</h2>
              <p className="text-xs text-slate-400">Save in your project root <code className="text-cyan-400 font-mono">.env</code> or cloud environment (Vercel / Render)</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
            <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-900 pb-2">
              <span className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>.env configuration for "{keyData?.project_name || activeProject?.name}"</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `TOKENTRAIL_API_KEY="${apiKeyDisplay}"\nTOKENTRAIL_ENDPOINT="${endpointDisplay}"\nGROQ_API_KEY="your_groq_api_key_here"`,
                    'env'
                  )
                }
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {copiedSection === 'env' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy .env</span>
              </button>
            </div>

            <p className="text-emerald-400">TOKENTRAIL_API_KEY="{apiKeyDisplay}"</p>
            <p className="text-emerald-400">TOKENTRAIL_ENDPOINT="{endpointDisplay}"</p>
            <p className="text-slate-500"># Your model provider key (Groq / OpenAI / Anthropic):</p>
            <p className="text-cyan-400">GROQ_API_KEY="gsk_your_groq_key_here"</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="font-semibold text-white flex items-center gap-1.5 mb-1">
                <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                <span>Local Development (.env)</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Inside your project's root <code className="text-slate-300 font-mono">.env</code> file, add the keys above.
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="font-semibold text-white flex items-center gap-1.5 mb-1">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cloud Deployment (Render / Vercel)</span>
              </span>
              <p className="text-[11px] text-slate-400">
                In your deployment dashboard &gt; Environment Variables &gt; Add these two keys.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* STEP 3: COMPLETE RUNNABLE APPLICATION FILE */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/20">
              3
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Step 3: Complete Runnable Application Code</h2>
              <p className="text-xs text-slate-400">
                {mode === 'auto' && 'Create main.py — notice how standard Groq/OpenAI calls are auto-intercepted!'}
                {mode === 'multiagent' && 'Create multi_agent_pipeline.py — notice the nested execution tree created by @agent & @tool!'}
                {mode === 'fastapi' && 'Create server.py — notice how the HTTP route and child LLMs bind to 1 trace!'}
                {mode === 'dropin' && 'Create run_standalone.py — using the standalone tokentrail_setup.py file!'}
                {mode === 'rest' && 'Run this cURL command from any terminal or script!'}
              </p>
            </div>
          </div>

          {/* CODE BLOCK BY MODE */}
          {mode === 'auto' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 leading-relaxed">
                <strong>⚡ How this works:</strong> Simply importing <code className="text-amber-300 font-mono font-bold">tokentrail.auto</code> monkey-patches the underlying completion methods globally. You do not touch your business logic or write custom span wrappers!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-900 pb-2 mb-2">
                  <span className="text-slate-300 font-bold">main.py (Complete 100% Runnable File)</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
`import os
from dotenv import load_dotenv

# 1. Load environment variables (.env)
load_dotenv()

# 2. ⚡ Add this ONE line at the very top of your application!
# It automatically intercepts Groq, OpenAI, Anthropic, and LiteLLM clients globally.
import tokentrail.auto

from groq import Groq

def run_chat():
    # 3. Use your standard LLM client normally — zero wrapper code needed!
    client = Groq()

    print("🤖 Calling LLM via standard Groq client...")
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "user", "content": "Explain LLM observability and latency tracking in 2 sentences."}
        ]
    )

    print("\\n✅ LLM Output:")
    print(response.choices[0].message.content)
    print("\\n⚡ Telemetry (duration, tokens, cost) sent automatically to TokenTrail!")

if __name__ == "__main__":
    run_chat()`,
                        'code-auto'
                      )
                    }
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedSection === 'code-auto' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Full File</span>
                  </button>
                </div>

                <p className="text-slate-500">import os</p>
                <p className="text-slate-500">from dotenv import load_dotenv</p>
                <p className="text-slate-500">load_dotenv()</p>
                <br />
                <p className="text-amber-400 font-bold">import tokentrail.auto  <span className="text-slate-500 font-normal"># ⚡ Global Zero-Code Auto-Instrumentation</span></p>
                <br />
                <p className="text-indigo-400">from groq import Groq</p>
                <br />
                <p className="text-slate-300">def run_chat():</p>
                <p className="text-cyan-400 pl-4">client = Groq()</p>
                <p className="text-slate-400 pl-4">print("Calling model...")</p>
                <br />
                <p className="text-emerald-400 pl-4">response = client.chat.completions.create(</p>
                <p className="text-slate-300 pl-8">model="llama-3.3-70b-versatile",</p>
                <p className="text-slate-300 pl-8">messages=[&#123;"role": "user", "content": "Explain LLM observability."&#125;]</p>
                <p className="text-emerald-400 pl-4">)</p>
                <br />
                <p className="text-slate-300 pl-4">print(response.choices[0].message.content)</p>
                <br />
                <p className="text-slate-300">if __name__ == "__main__":</p>
                <p className="text-slate-300 pl-4">run_chat()</p>
              </div>
            </div>
          )}

          {mode === 'multiagent' && (
            <div className="space-y-3">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-200 leading-relaxed">
                <strong>🤖 How this works:</strong> Multi-agent pipelines execute in hierarchical chains (Lead Agent ➔ Tools ➔ Sub-Agents ➔ LLM). Using <code className="text-cyan-300 font-mono font-bold">@agent</code> and <code className="text-cyan-300 font-mono font-bold">@tool</code> decorators automatically nests child spans under the parent agent via Python <code className="text-cyan-300 font-mono">contextvars</code>!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-900 pb-2 mb-2">
                  <span className="text-slate-300 font-bold">multi_agent_pipeline.py (Complete 100% Runnable File)</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
`import os
import time
from dotenv import load_dotenv

load_dotenv()

# 1. Enable global auto-patching for LLMs
import tokentrail.auto
from tokentrail import agent, tool
from groq import Groq

client = Groq()

# 2. Tool Function: Automatically nests under whichever agent calls it
@tool(name="database_schema_fetcher")
def fetch_database_schema(db_name: str) -> list[str]:
    print(f"  [Tool] Querying schema for: {db_name}...")
    time.sleep(0.1)  # Simulate DB latency
    return ["users (id, email)", "orders (id, user_id, amount, status)"]

# 3. Sub-Agent: Specialist agent that nests under the Orchestrator
@agent(name="sql_generator_agent", role="database_specialist")
def generate_sql(schema: list[str], prompt: str) -> str:
    print("  [Agent] SQL Specialist generating SQL query...")
    # Any LLM call made here automatically nests as a child of sql_generator_agent!
    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "user", "content": f"Schema: {schema}. Write SQL for: {prompt}"}
        ]
    )
    return res.choices[0].message.content or "SELECT 1;"

# 4. Root Orchestrator Agent: Top-level root waterfall span
@agent(name="orchestrator_pipeline", role="lead_planner")
def run_orchestrator(user_question: str):
    print(f"🚀 [Orchestrator] Starting workflow for: '{user_question}'")
    
    # Step A: Tool execution (child of Orchestrator)
    schema = fetch_database_schema("analytics_db")
    
    # Step B: Sub-agent execution (child of Orchestrator, parent of LLM)
    sql_query = generate_sql(schema, user_question)
    
    print("\\n✅ Generated SQL Query:")
    print(sql_query)
    return sql_query

if __name__ == "__main__":
    run_orchestrator("Find top 5 customers with completed orders above $500")`,
                        'code-multiagent'
                      )
                    }
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedSection === 'code-multiagent' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Full File</span>
                  </button>
                </div>

                <p className="text-slate-500"># 1. Imports and context configuration:</p>
                <p className="text-amber-400">import tokentrail.auto</p>
                <p className="text-cyan-400">from tokentrail import agent, tool</p>
                <p className="text-indigo-400">from groq import Groq</p>
                <br />
                <p className="text-slate-500"># 2. Tool Function:</p>
                <p className="text-indigo-400">@tool(name="database_schema_fetcher")</p>
                <p className="text-slate-300">def fetch_database_schema(db_name: str) -&gt; list[str]:</p>
                <p className="text-slate-400 pl-4">return ["users", "orders"]</p>
                <br />
                <p className="text-slate-500"># 3. Specialist Sub-Agent:</p>
                <p className="text-indigo-400">@agent(name="sql_generator_agent", role="database_specialist")</p>
                <p className="text-slate-300">def generate_sql(schema, prompt):</p>
                <p className="text-emerald-400 pl-4">return client.chat.completions.create(...)  <span className="text-slate-500"># Nests under SQL Specialist!</span></p>
                <br />
                <p className="text-slate-500"># 4. Root Orchestrator Agent (Root Waterfall Span):</p>
                <p className="text-indigo-400">@agent(name="orchestrator_pipeline", role="lead_planner")</p>
                <p className="text-slate-300">def run_orchestrator(question: str):</p>
                <p className="text-slate-400 pl-4">schema = fetch_database_schema("analytics_db")</p>
                <p className="text-slate-400 pl-4">return generate_sql(schema, question)</p>
              </div>
            </div>
          )}

          {mode === 'fastapi' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-200 leading-relaxed">
                <strong>🌐 How this works:</strong> Calling <code className="text-emerald-300 font-mono font-bold">use_tokentrail(app)</code> wraps the ASGI application. Every incoming HTTP request creates a root trace, and all LLM or agent calls executed within that request automatically attach as child waterfall spans!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-900 pb-2 mb-2">
                  <span className="text-slate-300 font-bold">server.py (Complete 100% Runnable FastAPI Server)</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
`import os
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from groq import Groq
from tokentrail.middleware import use_tokentrail

load_dotenv()

app = FastAPI(title="AI Agent API with TokenTrail Telemetry")

# ⚡ 1-Line Middleware Setup (attaches ASGI trace context & auto-patches LLMs)
use_tokentrail(app)

client = Groq()

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    # This LLM call automatically binds to the HTTP POST /api/chat root trace!
    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": req.message}]
    )
    return {
        "reply": res.choices[0].message.content,
        "model": "llama-3.3-70b-versatile",
        "status": "success"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)`,
                        'code-fastapi'
                      )
                    }
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedSection === 'code-fastapi' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Full File</span>
                  </button>
                </div>

                <p className="text-slate-500">from fastapi import FastAPI</p>
                <p className="text-slate-500">from pydantic import BaseModel</p>
                <p className="text-emerald-400">from tokentrail.middleware import use_tokentrail</p>
                <br />
                <p className="text-slate-300">app = FastAPI()</p>
                <p className="text-emerald-400 font-bold">use_tokentrail(app)  <span className="text-slate-500 font-normal"># ⚡ 1-Line Middleware & Context Propagation</span></p>
                <br />
                <p className="text-cyan-400">@app.post("/api/chat")</p>
                <p className="text-slate-300">async def chat(req: ChatRequest):</p>
                <p className="text-slate-500 pl-4"># LLM call automatically binds to this HTTP request trace!</p>
                <p className="text-emerald-400 pl-4">res = client.chat.completions.create(model="llama-3.3-70b-versatile", ...)</p>
                <p className="text-slate-300 pl-4">return &#123;"reply": res.choices[0].message.content&#125;</p>
              </div>
            </div>
          )}

          {mode === 'dropin' && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 leading-relaxed">
                <strong>📁 How this works:</strong> The file <code className="text-indigo-300 font-mono font-bold">tokentrail_setup.py</code> is a completely self-contained Python module written using standard library modules (<code className="text-indigo-300 font-mono">urllib</code>, <code className="text-indigo-300 font-mono">threading</code>, <code className="text-indigo-300 font-mono">contextvars</code>). You can drop it into any server, script, or notebook!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-900 pb-2 mb-2">
                  <span className="text-slate-300 font-bold">run_standalone.py (Complete 100% Runnable File)</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
`import os

# 1. Configure environment variables (or load from .env)
os.environ["TOKENTRAIL_API_KEY"] = "${apiKeyDisplay}"
os.environ["TOKENTRAIL_ENDPOINT"] = "${endpointDisplay}"

# 2. ⚡ Import the drop-in file!
import tokentrail_setup

# 3. Use your LLM client as normal:
from groq import Groq
client = Groq()

print("🤖 Calling LLM with zero-dependency standalone telemetry...")
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Explain zero-overhead observability."}]
)

print("\\n✅ LLM Output:")
print(response.choices[0].message.content)`,
                        'code-dropin'
                      )
                    }
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedSection === 'code-dropin' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Full File</span>
                  </button>
                </div>

                <p className="text-slate-500"># In your script (run_standalone.py):</p>
                <p className="text-indigo-400 font-bold">import tokentrail_setup  <span className="text-slate-500 font-normal"># ⚡ Standalone Zero-Dependency Telemetry!</span></p>
                <br />
                <p className="text-indigo-400">from groq import Groq</p>
                <p className="text-cyan-400">client = Groq()</p>
                <br />
                <p className="text-emerald-400">response = client.chat.completions.create(</p>
                <p className="text-slate-300 pl-4">model="llama-3.3-70b-versatile",</p>
                <p className="text-slate-300 pl-4">messages=[&#123;"role": "user", "content": "Explain zero-overhead observability."&#125;]</p>
                <p className="text-emerald-400">)</p>
              </div>
            </div>
          )}

          {mode === 'rest' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-200 leading-relaxed">
                <strong>🔌 How this works:</strong> TokenTrail exposes a high-throughput, idempotent ingestion endpoint at <code className="text-purple-300 font-mono font-bold">/v1/ingest</code>. Spans sent with the same <code className="text-purple-300 font-mono">trace_id</code> and <code className="text-purple-300 font-mono">parent_span_id</code> automatically form a cascading waterfall!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-900 pb-2 mb-2">
                  <span className="text-slate-300 font-bold">cURL Ingest Command (Multi-Span Trace)</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
`curl -X POST "${endpointDisplay}/v1/ingest" \\
  -H "X-API-Key: ${apiKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "spans": [
      {
        "trace_id": "trace_test_101",
        "span_id": "span_root",
        "name": "orchestrator_pipeline",
        "span_type": "chain",
        "duration_ms": 650,
        "status": "ok",
        "started_at": "2026-10-07T00:00:00Z",
        "ended_at": "2026-10-07T00:00:00.650Z"
      },
      {
        "trace_id": "trace_test_101",
        "span_id": "span_child_llm",
        "parent_span_id": "span_root",
        "name": "agent_llm_inference",
        "span_type": "llm",
        "model": "openai/gpt-oss-20b",
        "provider": "groq",
        "prompt_tokens": 838,
        "completion_tokens": 124,
        "duration_ms": 480,
        "status": "ok",
        "started_at": "2026-10-07T00:00:00.100Z",
        "ended_at": "2026-10-07T00:00:00.580Z"
      }
    ]
  }'`,
                        'code-rest'
                      )
                    }
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedSection === 'code-rest' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy cURL Command</span>
                  </button>
                </div>

                <p className="text-emerald-400">curl -X POST "{endpointDisplay}/v1/ingest" \</p>
                <p className="text-emerald-400 pl-4">-H "X-API-Key: {apiKeyDisplay}" \</p>
                <p className="text-emerald-400 pl-4">-H "Content-Type: application/json" \</p>
                <p className="text-slate-400 pl-4">-d '&#123; "spans": [ ... ] &#125;'</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* ========================================================================= */}
        {/* STEP 4: EXECUTE & TERMINAL VERIFICATION */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-amber-500/20">
              4
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Step 4: Execute & Terminal Verification</h2>
              <p className="text-xs text-slate-400">Run your application from your terminal</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
              <span className="text-slate-400 text-[11px] block border-b border-slate-900 pb-1">Terminal Command:</span>
              <p className="text-emerald-400 font-bold">
                {mode === 'auto' && 'python main.py'}
                {mode === 'multiagent' && 'python multi_agent_pipeline.py'}
                {mode === 'fastapi' && 'python server.py  # Or: uvicorn server:app --reload'}
                {mode === 'dropin' && 'python run_standalone.py'}
                {mode === 'rest' && 'Run the cURL command above'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5 text-slate-400">
              <span className="text-slate-400 text-[11px] block border-b border-slate-900 pb-1">Expected Console Output:</span>
              <p className="text-slate-300">🤖 Calling LLM...</p>
              <p className="text-emerald-400">✅ LLM Output: [Model Completion Text]</p>
              <p className="text-slate-500">⚡ Telemetry sent automatically in background thread.</p>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* STEP 5: LIVE CONNECTION VERIFICATION PING */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/60 to-slate-950 border border-slate-800 space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-emerald-500/20">
              5
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Step 5: Live Ingestion Verification (1-Click Test Ping)</h2>
              <p className="text-xs text-slate-400">Test that telemetry can be recorded right now in "{activeProject?.name}"</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-200 block mb-1">Simulate a Live 4-Step Agent Waterfall Trace</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Sends a cascading multi-span trace (Orchestrator ➔ Schema Tool ➔ Groq LLM ➔ AST Guard) to test your ingest pipeline and waterfall graphs right now.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSendTestPing}
              disabled={isPinging}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isPinging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isPinging ? 'Sending Telemetry...' : 'Send Live Test Ping'}</span>
            </button>
          </div>

          {pingSuccess && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Telemetry successfully received and recorded in <strong>{activeProject?.name}</strong>!
                </span>
              </div>
              {lastTraceId && (
                <a
                  href={`/traces/${lastTraceId}`}
                  className="flex items-center gap-1 text-emerald-300 font-bold hover:underline ml-2 shrink-0"
                >
                  <span>View Waterfall Execution</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ========================================================================= */}
      {/* 🎓 12 LPA INTERVIEW MASTERCLASS: ARCHITECTURE & ZERO-OVERHEAD GUARANTEES */}
      {/* ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">System Architecture & Engineering Guarantees</h2>
            <p className="text-xs text-slate-400">How TokenTrail guarantees sub-millisecond overhead and 100% fail-safe production resilience</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">13.6 µs SDK Overhead</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Spans are buffered into an in-memory lock-free bounded queue (<code className="text-slate-300">BoundedSpanQueue</code>). Network requests run entirely in background daemon threads.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">Strict Zero-Raise Policy</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If the telemetry backend goes down, network drops, or queue overflows, TokenTrail never raises exceptions. Telemetry will never crash your host application.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-1">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">Async Contextvars Propagation</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Traces and parent-child span IDs propagate automatically across async event loops and threads via Python's native <code className="text-slate-300">contextvars</code> without manual ID passing.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-1">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">Dynamic Cost Enrichment</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Model pricing is decoupled from code. Ingestion-time database lookups enrich token counts with exact micro-cent spend calculations on the fly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
