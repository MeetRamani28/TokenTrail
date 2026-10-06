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
  AlertTriangle,
  Layers,
  Workflow,
  Sparkles,
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
  const [activeTab, setActiveTab] = useState<'agent' | 'langgraph' | 'openai' | 'rest'>('agent');
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

      const endpoint = import.meta.env.VITE_API_URL || '';
      const ingestUrl = endpoint ? `${endpoint}/api/ingest/spans` : '/api/ingest/spans';

      // Send 4 cascading spans to demonstrate the full multi-step execution waterfall
      const now = Date.now();
      const payload = {
        spans: [
          {
            trace_id: traceId,
            span_id: spanId1,
            parent_span_id: null,
            name: 'schema_retrieval',
            type: 'retrieval',
            start_time: new Date(now - 820).toISOString(),
            end_time: new Date(now - 700).toISOString(),
            status: 'ok',
            model: null,
            input_tokens: 0,
            output_tokens: 0,
            metadata: { step: 'schema_rag', top_k: 3 },
          },
          {
            trace_id: traceId,
            span_id: spanId2,
            parent_span_id: spanId1,
            name: 'sqlguard_generate_sql',
            type: 'llm',
            start_time: new Date(now - 690).toISOString(),
            end_time: new Date(now - 220).toISOString(),
            status: 'ok',
            model: 'openai/gpt-oss-20b',
            provider: 'groq',
            input_tokens: 838,
            output_tokens: 124,
            metadata: { framework: 'tokentrail_sdk', temperature: 0.0 },
          },
          {
            trace_id: traceId,
            span_id: spanId3,
            parent_span_id: spanId1,
            name: 'ast_guard_validation',
            type: 'tool',
            start_time: new Date(now - 210).toISOString(),
            end_time: new Date(now - 170).toISOString(),
            status: 'ok',
            model: null,
            input_tokens: 0,
            output_tokens: 0,
            metadata: { parser: 'sqlglot', read_only: true },
          },
          {
            trace_id: traceId,
            span_id: spanId4,
            parent_span_id: spanId1,
            name: 'execute_db_query',
            type: 'tool',
            start_time: new Date(now - 160).toISOString(),
            end_time: new Date(now).toISOString(),
            status: 'ok',
            model: null,
            input_tokens: 0,
            output_tokens: 0,
            metadata: { dialect: 'postgres', rows_returned: 14 },
          },
        ],
      };

      await apiFetch(ingestUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, effectiveProjectId);

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
              <p className="text-xs text-slate-400">Run in your host project repository (e.g. SQLGuard / Nexus-RAG / Chatbot)</p>
            </div>
          </div>

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
          <p className="text-[11px] text-slate-500">
            Tip: You can also add this line directly to your project's <code className="text-slate-400">requirements.txt</code>.
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
              <span className="font-semibold text-white block mb-1">📍 Where does this go in SQLGuard?</span>
              <p className="text-[11px] text-slate-400">
                Inside <code className="text-slate-300 font-mono">SQLGuard/Backend/.env</code>, add both lines above.
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="font-semibold text-white block mb-1">🚀 Where does this go on Render?</span>
              <p className="text-[11px] text-slate-400">
                In Render Dashboard &gt; Service &gt; Environment &gt; Add Environment Variable.
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
                onClick={() => setActiveTab('agent')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'agent'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>1. Multi-Step Agent (Waterfall)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('langgraph')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'langgraph'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>2. LangGraph State Node</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('openai')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'openai'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>3. 1-Line Client Wrapper</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rest')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'rest'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                4. REST / HTTP
              </button>
            </div>
          </div>

          {/* Root Architectural Notice */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-200/95 leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-semibold mb-0.5">
                Why was only 1 span showing in the Execution Waterfall before?
              </strong>
              <span>
                If you only instrument your single LLM call, TokenTrail will only receive 1 span. To display a full cascading Execution Waterfall (e.g., Schema Retrieval ➔ LLM Inference ➔ Security AST Guard ➔ Database Query ➔ Chart Summary), envelop your pipeline in <code className="text-amber-300 font-mono font-bold">with tt.trace(...)</code> or pass a shared <code className="text-amber-300 font-mono font-bold">trace_id</code> to each step below!
              </span>
            </div>
          </div>

          {/* Tab 1: Multi-Step Agent & RAG Pipeline (Recommended) */}
          {activeTab === 'agent' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-200/90 leading-relaxed">
                <strong>Recommended for Multi-Step AI Agents & RAG:</strong> Wrapping your pipeline inside <code className="text-cyan-300 font-mono font-bold">with tt.trace("name"):</code> automatically binds a unified <code className="text-cyan-300 font-mono">trace_id</code> across all child spans. Every single step renders as a cascading bar in the Execution Waterfall!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`from tokentrail import TokenTrail

# 1. Initialize TokenTrail (auto-detects TOKENTRAIL_API_KEY from environment)
tt = TokenTrail()

def handle_user_request(user_question: str):
    # Envelop the entire request in a trace. All child spans inherit the same trace_id!
    with tt.trace("sqlguard_agent_pipeline"):
        
        # Step 1: Schema / RAG Retrieval Span
        with tt.span("schema_retrieval", type="retrieval") as s1:
            schema = db.get_relevant_schema(user_question)

        # Step 2: LLM SQL Synthesis Span (records model, token counts & calculated cost)
        with tt.span("generate_sql_llm", type="llm", model="openai/gpt-oss-20b", provider="groq") as s2:
            response = llm_client.chat.completions.create(...)
            # Tokens are auto-tracked or can be explicitly recorded:
            s2.set_tokens(prompt=838, completion=124)

        # Step 3: AST Security Guardrail Span
        with tt.span("ast_guard_validation", type="tool") as s3:
            is_safe = ast_parser.validate(response.sql)

        # Step 4: Actual Database Query Execution Span
        with tt.span("execute_db_query", type="tool") as s4:
            records = db.execute(response.sql)

        # Step 5: Heuristic Chart & Summary Mapping
        with tt.span("chart_mapping_summary", type="tool") as s5:
            chart = select_chart_type(records)

    return {"records": records, "chart": chart}`,
                      'code-agent'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-agent' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># In your agent pipeline (e.g., query_service.py, agent.py):</p>
                <p className="text-indigo-400">from tokentrail import TokenTrail</p>
                <p className="text-emerald-400">tt = TokenTrail()</p>
                <br />
                <p className="text-slate-500"># Wrap your overall workflow to create a unified trace:</p>
                <p className="text-cyan-400">with tt.trace("sqlguard_agent_pipeline"):</p>
                <br />
                <p className="text-slate-500 pl-4"># 1. Retrieval Span</p>
                <p className="text-indigo-400 pl-4">with tt.span("schema_retrieval", type="retrieval"):</p>
                <p className="text-slate-300 pl-8">schema = db.get_schema(question)</p>
                <br />
                <p className="text-slate-500 pl-4"># 2. LLM Inference Span</p>
                <p className="text-indigo-400 pl-4">with tt.span("generate_sql_llm", type="llm", model="openai/gpt-oss-20b") as s:</p>
                <p className="text-slate-300 pl-8">sql = llm.invoke(...)</p>
                <p className="text-emerald-400 pl-8">s.set_tokens(prompt=838, completion=124)</p>
                <br />
                <p className="text-slate-500 pl-4"># 3. Security Guard Span</p>
                <p className="text-indigo-400 pl-4">with tt.span("ast_guard_validation", type="tool"):</p>
                <p className="text-slate-300 pl-8">is_safe = ast_parser.validate(sql)</p>
                <br />
                <p className="text-slate-500 pl-4"># 4. Database Query Span</p>
                <p className="text-indigo-400 pl-4">with tt.span("execute_db_query", type="tool"):</p>
                <p className="text-slate-300 pl-8">records = db.execute(sql)</p>
              </div>
            </div>
          )}

          {/* Tab 2: LangGraph / Distributed State Nodes */}
          {activeTab === 'langgraph' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200/90 leading-relaxed">
                <strong>For Graph-Based Agent Frameworks (LangGraph, CrewAI, AutoGen):</strong> When nodes run as standalone functions across different modules, pass a shared <code className="text-indigo-300 font-mono font-bold">trace_id</code> inside the state dictionary.
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`import uuid
from tokentrail import TokenTrail

tt = TokenTrail()

# 1. At the API endpoint, initialize state with a unique trace_id:
trace_id = f"trace_{uuid.uuid4().hex}"
initial_state = {
    "question": user_question,
    "trace_id": trace_id,
}

# 2. Inside LangGraph nodes, pass trace_id to tt.span:
def schema_retrieval_node(state):
    trace_id = state.get("trace_id")
    with tt.span("schema_retrieval", type="retrieval", trace_id=trace_id):
        schema = fetch_schema(state["question"])
    return {"schema": schema}

def generate_sql_node(state):
    trace_id = state.get("trace_id")
    with tt.span("sqlguard_generate_sql", type="llm", trace_id=trace_id, model="openai/gpt-oss-20b", provider="groq") as s:
        response = call_llm(state["schema"], state["question"])
        s.set_tokens(prompt=838, completion=124)
    return {"sql_query": response}

def execute_sql_node(state):
    trace_id = state.get("trace_id")
    with tt.span("execute_db_query", type="tool", trace_id=trace_id):
        rows = execute_database_query(state["sql_query"])
    return {"results": rows}`,
                      'code-langgraph'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-langgraph' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># In main API endpoint (entrypoint):</p>
                <p className="text-indigo-400">import uuid</p>
                <p className="text-emerald-400">trace_id = f"trace_&#123;uuid.uuid4().hex&#125;"</p>
                <p className="text-slate-300">initial_state = &#123; "question": q, "trace_id": trace_id &#125;</p>
                <br />
                <p className="text-slate-500"># In each node (nodes.py):</p>
                <p className="text-cyan-400">def generate_sql_node(state):</p>
                <p className="text-indigo-400 pl-4">with tt.span("sqlguard_generate_sql", type="llm", trace_id=state["trace_id"], model="openai/gpt-oss-20b"):</p>
                <p className="text-slate-300 pl-8">res = call_llm(state["question"])</p>
                <p className="text-slate-300 pl-4">return &#123; "sql": res &#125;</p>
              </div>
            </div>
          )}

          {/* Tab 3: OpenAI / Groq Client Wrapper */}
          {activeTab === 'openai' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-200/90 leading-relaxed">
                <strong>Zero Code Rewrite for Direct Chats:</strong> Wrap your existing OpenAI or Groq client in 1 line. All token counts, streaming latency, model parameters, and spend are captured automatically!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`from tokentrail import TokenTrail
from openai import OpenAI

# 1. Initialize TokenTrail
tt = TokenTrail()

# 2. Wrap your OpenAI or Groq client in 1 line
client = OpenAI()
client = tt.wrap_openai(client)

# 3. Call your model as normal — telemetry streams automatically!
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Explain vector databases in 2 sentences."}]
)
print(response.choices[0].message.content)`,
                      'code-openai'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-openai' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># In your app (e.g. main.py, chat_service.py):</p>
                <p className="text-indigo-400">from tokentrail import TokenTrail</p>
                <p className="text-indigo-400">from openai import OpenAI</p>
                <br />
                <p className="text-slate-500"># 1. Initialize TokenTrail (zero latency overhead):</p>
                <p className="text-emerald-400">tt = TokenTrail()</p>
                <br />
                <p className="text-slate-500"># 2. Wrap your existing client:</p>
                <p className="text-cyan-400">client = tt.wrap_openai(OpenAI())</p>
                <br />
                <p className="text-slate-500"># 3. Execute normal requests — costs & traces are auto-recorded:</p>
                <p className="text-white">response = client.chat.completions.create(</p>
                <p className="text-white pl-4">model="llama-3.3-70b-versatile",</p>
                <p className="text-white pl-4">messages=[&#123;"role": "user", "content": "Hello!"&#125;]</p>
                <p className="text-white">)</p>
              </div>
            </div>
          )}

          {/* Tab 4: Direct HTTP Ingestion */}
          {activeTab === 'rest' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-200/90 leading-relaxed">
                <strong>Language Agnostic:</strong> Send multi-span batches from Node.js, Next.js, Go, or cURL directly via REST API.
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`curl -X POST "${endpointDisplay}/api/ingest/spans" \\
  -H "Authorization: Bearer ${apiKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "spans": [
      {
        "trace_id": "trace_1001",
        "span_id": "span_1001_1",
        "name": "schema_retrieval",
        "type": "retrieval",
        "start_time": "2026-10-06T12:00:00Z",
        "end_time": "2026-10-06T12:00:01Z",
        "status": "ok"
      },
      {
        "trace_id": "trace_1001",
        "span_id": "span_1001_2",
        "parent_span_id": "span_1001_1",
        "name": "sqlguard_generate_sql",
        "type": "llm",
        "start_time": "2026-10-06T12:00:01Z",
        "end_time": "2026-10-06T12:00:03Z",
        "status": "ok",
        "model": "openai/gpt-oss-20b",
        "provider": "groq",
        "input_tokens": 838,
        "output_tokens": 124
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

                <p className="text-emerald-400">curl -X POST "{endpointDisplay}/api/ingest/spans" \</p>
                <p className="text-emerald-400 pl-4">-H "Authorization: Bearer {apiKeyDisplay}" \</p>
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
