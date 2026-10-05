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
  const [activeTab, setActiveTab] = useState<'openai' | 'agent' | 'rest'>('openai');
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

      const endpoint = import.meta.env.VITE_API_URL || '';
      const ingestUrl = endpoint ? `${endpoint}/api/ingest/spans` : '/api/ingest/spans';

      // Send 2 spans so waterfall has a multi-step cascading demo
      const payload = {
        spans: [
          {
            trace_id: traceId,
            span_id: spanId1,
            parent_span_id: null,
            name: 'agent_input_validation',
            start_time: new Date(Date.now() - 350).toISOString(),
            end_time: new Date(Date.now() - 250).toISOString(),
            status: 'ok',
            model: null,
            input_tokens: 0,
            output_tokens: 0,
            metadata: { step: 'validation', status: 'valid' },
          },
          {
            trace_id: traceId,
            span_id: spanId2,
            parent_span_id: spanId1,
            name: 'llm_inference',
            start_time: new Date(Date.now() - 240).toISOString(),
            end_time: new Date().toISOString(),
            status: 'ok',
            model: 'openai/gpt-oss-20b',
            input_tokens: 85,
            output_tokens: 42,
            metadata: { framework: 'tokentrail_sdk', environment: 'production' },
          },
        ],
      };

      await apiFetch(ingestUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, effectiveProjectId);

      setPingSuccess(true);
      setLastTraceId(traceId);
      toast.success('Test telemetry sent successfully! Check Overview or Traces.');

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
                <h2 className="text-base font-bold text-white">Add 2 Lines of Code in Your Application</h2>
                <p className="text-xs text-slate-400">Choose the pattern that matches your project architecture</p>
              </div>
            </div>

            {/* Pattern Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('openai')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'openai'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. OpenAI / Groq Wrapper
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('agent')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'agent'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Multi-Step Spans (Waterfall)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rest')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'rest'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3. Direct cURL / HTTP
              </button>
            </div>
          </div>

          {/* Tab 1: OpenAI / Groq Client Wrapper */}
          {activeTab === 'openai' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-200/90 leading-relaxed">
                <strong>Zero Code Rewrite:</strong> Simply wrap your existing OpenAI or Groq client. All token usage, streaming latency, model parameters, and spend are captured automatically in the background!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`from tokentrail import TokenTrail
from openai import OpenAI

# 1. Initialize TokenTrail (safely auto-detects env variables)
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

                <p className="text-slate-500"># In your app (e.g. main.py, agent.py, chat_service.py):</p>
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

          {/* Tab 2: Multi-Step Execution Waterfall Spans */}
          {activeTab === 'agent' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-200/90 leading-relaxed">
                <strong>Why was the Waterfall showing only 1 span before?</strong> Because only 1 step was recorded. By wrapping your pipeline steps in <code className="text-cyan-300 font-mono font-bold">with tt.start_span("name"):</code>, each step appears as its own cascading timeline bar in TokenTrail!
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 relative">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
`from tokentrail import TokenTrail

tt = TokenTrail()

# Full multi-step workflow in SQLGuard / Nexus RAG:
def run_user_query(query: str):
    # Step 1: Retrieve Database Schema
    with tt.start_span("retrieve_schema"):
        schema = db.get_schema()

    # Step 2: LLM SQL Generation
    with tt.start_span("generate_sql_llm", model="openai/gpt-oss-20b"):
        sql = client.chat.completions.create(...)

    # Step 3: AST Validation
    with tt.start_span("validate_ast"):
        is_safe = sql_parser.validate(sql)

    # Step 4: Execute query
    with tt.start_span("execute_query"):
        result = db.execute(sql)

    return result`,
                      'code-agent'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedSection === 'code-agent' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <p className="text-slate-500"># Multi-step agent workflow (e.g. in SQLGuard query pipeline):</p>
                <p className="text-indigo-400">from tokentrail import TokenTrail</p>
                <p className="text-emerald-400">tt = TokenTrail()</p>
                <br />
                <p className="text-slate-500"># Step 1: Schema Retrieval Span</p>
                <p className="text-cyan-400">with tt.start_span("retrieve_schema"):</p>
                <p className="text-slate-300 pl-4">schema = db.get_schema()</p>
                <br />
                <p className="text-slate-500"># Step 2: LLM SQL Generation Span</p>
                <p className="text-cyan-400">with tt.start_span("generate_sql_llm", model="openai/gpt-oss-20b"):</p>
                <p className="text-slate-300 pl-4">sql = client.chat.completions.create(...)</p>
                <br />
                <p className="text-slate-500"># Step 3: AST Validation Span</p>
                <p className="text-cyan-400">with tt.start_span("validate_ast"):</p>
                <p className="text-slate-300 pl-4">is_safe = ast_parser.validate(sql)</p>
              </div>
            </div>
          )}

          {/* Tab 3: Direct HTTP Ingestion */}
          {activeTab === 'rest' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200/90 leading-relaxed">
                <strong>Language Agnostic:</strong> Send telemetry from Node.js, Next.js, Go, or cURL directly via REST API.
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
        "name": "chat_completion",
        "start_time": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "end_time": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "status": "ok",
        "model": "openai/gpt-oss-20b",
        "input_tokens": 120,
        "output_tokens": 45
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
