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
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

export const RoadmapPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();
  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);
  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const effectiveProjectId = selectedProjectId || activeProject?.id;
  const { data: keyData } = useProjectKey(effectiveProjectId);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'auto' | 'multiagent' | 'fastapi' | 'dropin' | 'manual' | 'rest'>('auto');
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

      // Send 4 cascading spans to demonstrate the full multi-step execution waterfall
      const now = Date.now();
      const payload = {
        spans: [
          {
            trace_id: traceId,
            span_id: spanId1,
            parent_span_id: null,
            name: 'context_retrieval',
            type: 'retrieval',
            started_at: new Date(now - 820).toISOString(),
            ended_at: new Date(now - 700).toISOString(),
            duration_ms: 120,
            status: 'ok',
            model: null,
            prompt_tokens: 0,
            completion_tokens: 0,
            metadata: { step: 'rag_vector_search', top_k: 4 },
          },
          {
            trace_id: traceId,
            span_id: spanId2,
            parent_span_id: spanId1,
            name: 'agent_llm_inference',
            type: 'llm',
            started_at: new Date(now - 690).toISOString(),
            ended_at: new Date(now - 220).toISOString(),
            duration_ms: 470,
            status: 'ok',
            model: 'openai/gpt-oss-20b',
            provider: 'groq',
            prompt_tokens: 838,
            completion_tokens: 124,
            metadata: { framework: 'tokentrail_sdk', temperature: 0.1 },
          },
          {
            trace_id: traceId,
            span_id: spanId3,
            parent_span_id: spanId1,
            name: 'guardrail_validation',
            type: 'tool',
            started_at: new Date(now - 210).toISOString(),
            ended_at: new Date(now - 170).toISOString(),
            duration_ms: 40,
            status: 'ok',
            model: null,
            prompt_tokens: 0,
            completion_tokens: 0,
            metadata: { security_check: 'passed' },
          },
          {
            trace_id: traceId,
            span_id: spanId4,
            parent_span_id: spanId1,
            name: 'execute_tool_query',
            type: 'tool',
            started_at: new Date(now - 160).toISOString(),
            ended_at: new Date(now).toISOString(),
            duration_ms: 160,
            status: 'ok',
            model: null,
            prompt_tokens: 0,
            completion_tokens: 0,
            metadata: { execution: 'success', rows: 12 },
          },
        ],
        traces: [
          {
            trace_id: traceId,
            name: 'my_agent_pipeline',
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
      toast.success('4-step agent telemetry sent successfully! Check Traces for the Execution Waterfall.');

      // Refresh queries
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
    <div className="space-y-10 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 text-emerald-400 font-mono text-xs font-semibold mb-1">
          <Compass className="w-4 h-4" />
          <span>DEVELOPER ONBOARDING ROADMAP</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          How to Integrate TokenTrail Into Any Project
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Follow this 4-step roadmap to add zero-overhead LLM telemetry, multi-step execution waterfalls, and automated cost tracking to your Python application or agent.
        </p>
      </div>

      {/* Target Project Banner */}
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
          <span className="text-slate-400 text-[11px] hidden sm:inline">Active Key:</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400">
            {keyData?.key_prefix ? `${keyData.key_prefix}...` : 'Configure in Settings'}
          </span>
        </div>
      </div>

      {/* Interactive Step-by-Step Roadmap Cards */}
      <div className="space-y-8">
        {/* Step 1: Install SDK */}
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
              <h2 className="text-base font-bold text-white">Install the TokenTrail SDK</h2>
              <p className="text-xs text-slate-400">Run in your host project repository (e.g. FastAPI / Next.js / Python Agent)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex items-center justify-between text-emerald-400">
              <span className="select-all truncate pr-2">
                pip install "git+https://github.com/MeetRamani28/TokenTrail.git#subdirectory=backend/sdk"
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard('pip install "git+https://github.com/MeetRamani28/TokenTrail.git#subdirectory=backend/sdk"', 'install')}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Copy Command"
              >
                {copiedSection === 'install' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex items-center justify-between text-cyan-400">
              <span className="select-all truncate pr-2">
                # Or 1-File Drop-in (Zero pip needed): curl -O .../tokentrail_setup.py
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard('curl -O https://raw.githubusercontent.com/MeetRamani28/TokenTrail/main/backend/sdk/tokentrail_setup.py', 'curl-dropin')}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Copy Drop-in Command"
              >
                {copiedSection === 'curl-dropin' ? <CheckCheck className="w-4 h-4 text-cyan-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Choose either: Install the official Python SDK via pip, or download the single-file <code className="text-slate-300">tokentrail_setup.py</code> for 100% zero-dependency drop-in tracing.
          </p>
        </motion.div>

        {/* Step 2: Environment Variables */}
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
              <h2 className="text-base font-bold text-white">Configure Environment Variables</h2>
              <p className="text-xs text-slate-400">Add these 2 variables to your project's <code className="text-cyan-400 font-mono">.env</code> file or deployment host (Render / Vercel)</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
            <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-900 pb-2">
              <span className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Your Project's .env file</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `TOKENTRAIL_API_KEY="${apiKeyDisplay}"\nTOKENTRAIL_ENDPOINT="${endpointDisplay}"`,
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="font-semibold text-white block mb-1">📍 Local Development (.env)</span>
              <p className="text-[11px] text-slate-400">
                Inside your project's root <code className="text-slate-300 font-mono">.env</code> file, add both lines above.
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="font-semibold text-white block mb-1">🚀 Cloud Deployment (Render / Vercel)</span>
              <p className="text-[11px] text-slate-400">
                In your deployment dashboard &gt; Environment Variables &gt; Add these two keys.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Step 3: Exact Code Implementation (Tabbed by Pattern) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-5"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/20">
                3
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Add Telemetry to Your Application Pipeline</h2>
                <p className="text-xs text-slate-400">Choose the pattern that matches your project architecture</p>
              </div>
            </div>

            {/* Pattern Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('auto')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'auto'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>1. ⚡ 1-Line Auto-Patch</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('multiagent')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'multiagent'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                <span>2. 🤖 Multi-Agent Waterfall</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fastapi')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'fastapi'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. 🌐 FastAPI Middleware</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dropin')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'dropin'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>4. 📁 1-File Standalone</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'manual'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>5. Manual Spans</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rest')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'rest'
                    ? 'bg-slate-800 text-slate-200 border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>6. REST API</span>
              </button>
            </div>
          </div>

          {/* Tab 1: 1-Line Zero-Code Auto-Instrumentation */}
          {activeTab === 'auto' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 leading-relaxed">
                <strong>⚡ Zero Code Rewrite (Recommended):</strong> Add <code className="text-amber-300 font-mono font-bold">import tokentrail.auto</code> once at the top of your app. All OpenAI, Groq, Anthropic, and LiteLLM invocations across your entire codebase are automatically intercepted, recording token counts, model names, latency, and costs in real time!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`# 1. At the very top of your main entrypoint (e.g. app.py, main.py, server.py):
import tokentrail.auto  # ⚡ Global Zero-Code Auto-Instrumentation!

# 2. Use your favorite LLM client normally — zero wrapper code needed!
from groq import Groq

client = Groq()
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Explain vector databases in 1 sentence."}]
)

# TokenTrail automatically captured latency, model, tokens, and computed cost!
print(response.choices[0].message.content)`,
                      'code-auto'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-auto' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># In your app entrypoint (main.py, app.py, server.py):</p>
                <p className="text-amber-400 font-bold">import tokentrail.auto  <span className="text-slate-500 font-normal"># ⚡ 1-Line Zero-Code Auto-Instrumentation</span></p>
                <br />
                <p className="text-slate-500"># Use standard Groq, OpenAI, or Anthropic clients normally:</p>
                <p className="text-indigo-400">from groq import Groq</p>
                <p className="text-cyan-400">client = Groq()</p>
                <br />
                <p className="text-slate-500"># Telemetry, token counts, and micro-cent spend stream automatically:</p>
                <p className="text-emerald-400">response = client.chat.completions.create(</p>
                <p className="text-slate-300 pl-4">model="llama-3.3-70b-versatile",</p>
                <p className="text-slate-300 pl-4">messages=[&#123;"role": "user", "content": "Explain AI observability."&#125;]</p>
                <p className="text-emerald-400">)</p>
              </div>
            </div>
          )}

          {/* Tab 2: Multi-Agent Hierarchical Waterfall */}
          {activeTab === 'multiagent' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-200/90 leading-relaxed">
                <strong>🤖 Multi-Agent Execution Flamegraph:</strong> For agentic pipelines (Orchestrator ➔ Specialist ➔ Tools ➔ Database). Decorate your functions with <code className="text-cyan-300 font-mono font-bold">@agent</code> and <code className="text-cyan-300 font-mono font-bold">@tool</code>. TokenTrail uses <code className="text-cyan-300 font-mono">contextvars</code> to automatically nest all child tools and LLM completions into an execution waterfall!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`import tokentrail.auto  # Auto-captures LLM tokens & latency
from tokentrail import agent, tool
from groq import Groq

client = Groq()

# 1. Root Orchestrator Agent
@agent(name="DataAnalystAgent", role="orchestrator")
def run_analysis_pipeline(user_query: str):
    # Step 1: Tool execution
    schema = fetch_database_schema()
    
    # Step 2: Delegate to specialist agent (automatically nests as a child span!)
    sql = generate_sql_query(schema, user_query)
    
    return {"query": sql}

# 2. Tool Execution Span
@tool(name="DatabaseSchemaFetcher")
def fetch_database_schema():
    # Database logic here
    return ["users", "orders", "transactions"]

# 3. Specialist Sub-Agent
@agent(name="SQLSpecialistAgent", role="coder")
def generate_sql_query(schema: list, prompt: str):
    # Any LLM call made here automatically nests as a child of SQLSpecialistAgent!
    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"Schema: {schema}. Write SQL for: {prompt}"}]
    )
    return res.choices[0].message.content`,
                      'code-multiagent'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-multiagent' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># In your multi-agent architecture (e.g. agents.py, pipeline.py):</p>
                <p className="text-amber-400">import tokentrail.auto</p>
                <p className="text-cyan-400">from tokentrail import agent, tool</p>
                <br />
                <p className="text-slate-500"># 1. Orchestrator Agent (Root Waterfall Span):</p>
                <p className="text-indigo-400">@agent(name="DataAnalystAgent", role="orchestrator")</p>
                <p className="text-slate-300">def run_pipeline(query: str):</p>
                <p className="text-slate-400 pl-4">schema = fetch_schema()  <span className="text-slate-500"># Nests under DataAnalystAgent</span></p>
                <p className="text-slate-400 pl-4">return generate_sql(schema, query)</p>
                <br />
                <p className="text-slate-500"># 2. Tool Execution Span:</p>
                <p className="text-indigo-400">@tool(name="SchemaFetcher")</p>
                <p className="text-slate-300">def fetch_schema():</p>
                <p className="text-slate-400 pl-4">return db.get_tables()</p>
                <br />
                <p className="text-slate-500"># 3. Specialist Sub-Agent:</p>
                <p className="text-indigo-400">@agent(name="SQLSpecialistAgent", role="coder")</p>
                <p className="text-slate-300">def generate_sql(schema, query):</p>
                <p className="text-emerald-400 pl-4">return client.chat.completions.create(...)  <span className="text-slate-500"># LLM nests under specialist!</span></p>
              </div>
            </div>
          )}

          {/* Tab 3: FastAPI / ASGI Middleware */}
          {activeTab === 'fastapi' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-200/90 leading-relaxed">
                <strong>🌐 1-Line FastAPI / Web Middleware:</strong> Simply call <code className="text-emerald-300 font-mono font-bold">use_tokentrail(app)</code>. Every incoming HTTP request becomes a root trace, and all downstream agent runs or LLM calls executed during that request automatically attach as child waterfall spans!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`from fastapi import FastAPI
from tokentrail.middleware import use_tokentrail
from groq import Groq

app = FastAPI()

# ⚡ 1-Line Middleware Setup (attaches ASGI trace context & auto-patches LLMs)
use_tokentrail(app)

client = Groq()

@app.post("/api/ask")
async def chat_endpoint(query: str):
    # This LLM completion automatically binds to the HTTP POST /api/ask trace!
    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": query}]
    )
    return {"reply": res.choices[0].message.content}`,
                      'code-fastapi'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-fastapi' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># In your FastAPI server (e.g. main.py):</p>
                <p className="text-indigo-400">from fastapi import FastAPI</p>
                <p className="text-emerald-400">from tokentrail.middleware import use_tokentrail</p>
                <br />
                <p className="text-slate-300">app = FastAPI()</p>
                <p className="text-emerald-400 font-bold">use_tokentrail(app)  <span className="text-slate-500 font-normal"># ⚡ 1-Line Middleware & Context Propagation</span></p>
                <br />
                <p className="text-cyan-400">@app.post("/api/ask")</p>
                <p className="text-slate-300">async def chat(query: str):</p>
                <p className="text-slate-500 pl-4"># LLM call automatically binds to this HTTP request trace!</p>
                <p className="text-emerald-400 pl-4">res = client.chat.completions.create(model="llama-3.3-70b-versatile", ...)</p>
                <p className="text-slate-300 pl-4">return &#123;"reply": res.choices[0].message.content&#125;</p>
              </div>
            </div>
          )}

          {/* Tab 4: 1-File Standalone Drop-in */}
          {activeTab === 'dropin' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200/90 leading-relaxed">
                <strong>📁 Standalone 1-File Drop-in:</strong> Don't want to install packages via pip? Save <code className="text-indigo-300 font-mono font-bold">tokentrail_setup.py</code> directly into your project root. Works completely standalone with pure Python standard library and zero external dependencies!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`# In your project root, create tokentrail_setup.py.
# Then in app.py / main.py, simply write:
import tokentrail_setup  # ⚡ Standalone Zero-Dependency Telemetry!

# Use OpenAI, Groq, or Anthropic as usual:
from groq import Groq
client = Groq()
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Hello!"}]
)`,
                      'code-dropin'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Usage"
                >
                  {copiedSection === 'code-dropin' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># 1. Download or save `tokentrail_setup.py` in your project root.</p>
                <p className="text-slate-500"># 2. Add 1 line to your main entrypoint:</p>
                <p className="text-indigo-400 font-bold">import tokentrail_setup  <span className="text-slate-500 font-normal"># ⚡ Zero dependencies needed!</span></p>
                <br />
                <p className="text-slate-500"># 3. Supports @agent and @tool decorators out of the box:</p>
                <p className="text-cyan-400">from tokentrail_setup import agent, tool</p>
                <br />
                <p className="text-indigo-400">@agent("MyAgent")</p>
                <p className="text-slate-300">def run():</p>
                <p className="text-slate-400 pl-4">client.chat.completions.create(...)  <span className="text-slate-500"># Auto-tracked!</span></p>
              </div>
            </div>
          )}

          {/* Tab 5: Manual Context Spans */}
          {activeTab === 'manual' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-200/90 leading-relaxed">
                <strong>🛠️ Explicit Context Spans:</strong> Wrap specific blocks of code manually using <code className="text-purple-300 font-mono font-bold">with tt.span("name", type="llm"):</code>.
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`from tokentrail import TokenTrail

tt = TokenTrail()

with tt.trace("custom_pipeline"):
    with tt.span("db_search", type="tool"):
        data = db.search("query")
        
    with tt.span("llm_call", type="llm", model="openai/gpt-oss-20b") as s:
        res = call_llm(data)
        s.set_tokens(prompt=420, completion=85)`,
                      'code-manual'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-manual' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-purple-400">from tokentrail import TokenTrail</p>
                <p className="text-slate-300">tt = TokenTrail()</p>
                <br />
                <p className="text-cyan-400">with tt.trace("custom_pipeline"):</p>
                <p className="text-indigo-400 pl-4">with tt.span("db_search", type="tool"):</p>
                <p className="text-slate-300 pl-8">data = db.search("query")</p>
                <br />
                <p className="text-indigo-400 pl-4">with tt.span("llm_call", type="llm", model="openai/gpt-oss-20b") as s:</p>
                <p className="text-slate-300 pl-8">res = call_llm(data)</p>
                <p className="text-emerald-400 pl-8">s.set_tokens(prompt=420, completion=85)</p>
              </div>
            </div>
          )}

          {/* Tab 6: Direct REST Ingest API */}
          {activeTab === 'rest' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs text-slate-300 leading-relaxed">
                <strong>Language Agnostic:</strong> Send spans from Node.js, Next.js, Go, or cURL directly via REST API.
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
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
        "trace_id": "trace_1001",
        "span_id": "span_1001_1",
        "name": "context_retrieval",
        "span_type": "tool",
        "started_at": "2026-10-06T12:00:00Z",
        "ended_at": "2026-10-06T12:00:01Z",
        "duration_ms": 1000,
        "status": "ok"
      },
      {
        "trace_id": "trace_1001",
        "span_id": "span_1001_2",
        "parent_span_id": "span_1001_1",
        "name": "agent_llm_inference",
        "span_type": "llm",
        "model": "openai/gpt-oss-20b",
        "provider": "groq",
        "prompt_tokens": 838,
        "completion_tokens": 124,
        "started_at": "2026-10-06T12:00:01Z",
        "ended_at": "2026-10-06T12:00:03Z",
        "duration_ms": 2000,
        "status": "ok"
      }
    ]
  }'`,
                      'code-rest'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy cURL"
                >
                  {copiedSection === 'code-rest' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-emerald-400">curl -X POST "{endpointDisplay}/v1/ingest" \</p>
                <p className="text-emerald-400 pl-4">-H "X-API-Key: {apiKeyDisplay}" \</p>
                <p className="text-emerald-400 pl-4">-H "Content-Type: application/json" \</p>
                <p className="text-slate-400 pl-4">-d '&#123; "spans": [ ... ] &#125;'</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Step 4: Interactive Test Ping Verification */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/60 to-slate-950 border border-slate-800 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-amber-500/20">
              4
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Live Connection Verification</h2>
              <p className="text-xs text-slate-400">Test that telemetry can be recorded right now in "{activeProject?.name}"</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-200 block mb-1">Send a Live Test Telemetry Ping</span>
              <p className="text-[11px] text-slate-400">
                This will simulate a 2-step agent trace to verify ingest pipelines, cost calculations, and waterfall graphs.
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
                  <span>View Waterfall</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Zero-Raise Policy Assurance */}
      <div className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800 flex items-start gap-3.5 text-xs text-slate-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-slate-200">Zero-Crash / Zero-Raise Production Policy</span>
          <p className="leading-relaxed text-[11px]">
            TokenTrail uses an asynchronous, bounded worker thread. If the network drops, API key is rotated, or telemetry endpoint is unreachable, TokenTrail <strong>never throws exceptions</strong> or affects your host application or end users.
          </p>
        </div>
      </div>
    </div>
  );
};
