import React, { useState } from 'react';
import { useCreatePrice, useDeletePrice, usePrices, useProjectKey, useProjects, useRollProjectKey } from '../api/queries';
import { useAppSelector } from '../store';
import {
  CheckCheck,
  Coins,
  Copy,
  FolderKanban,
  Key,
  Plus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  const { data: prices, isLoading } = usePrices();
  const { data: projects = [] } = useProjects();
  const createPriceMutation = useCreatePrice();
  const deletePriceMutation = useDeletePrice();
  const rollKeyMutation = useRollProjectKey();

  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);
  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const effectiveProjectId = selectedProjectId || activeProject?.id;

  const { data: keyData } = useProjectKey(effectiveProjectId);
  const [rolledKey, setRolledKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('');
  const [inputPrice, setInputPrice] = useState('0.59');
  const [outputPrice, setOutputPrice] = useState('0.79');

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim()) {
      toast.error('Model name is required');
      return;
    }
    const inRate = parseFloat(inputPrice);
    const outRate = parseFloat(outputPrice);
    if (isNaN(inRate) || isNaN(outRate)) {
      toast.error('Prices must be valid numbers');
      return;
    }

    try {
      await createPriceMutation.mutateAsync({
        provider: provider.trim().toLowerCase(),
        model: model.trim(),
        input_price_per_1m: inRate,
        output_price_per_1m: outRate,
      });
      toast.success(`Price rate added for ${model}`);
      setModel('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save price');
    }
  };

  const handleDelete = async (id: string, modelName: string) => {
    try {
      await deletePriceMutation.mutateAsync(id);
      toast.success(`Deleted price for ${modelName}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete price');
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Project Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage dynamic pricing rates, SDK authentication keys, and retention rules.
        </p>
      </div>

      {/* Model Pricing Engine Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Dynamic Model Pricing Table</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Rates per 1 Million Tokens</span>
        </div>

        <p className="text-xs text-slate-400">
          TokenTrail never hardcodes prices in application code. All costs are dynamically enriched
          from this table during span ingestion.
        </p>

        {/* Add Price Form */}
        <form
          onSubmit={handleAddPrice}
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs"
        >
          <div>
            <label className="block text-slate-400 font-medium mb-1">Provider</label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. groq, openai"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Model Name</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. llama-3.3-70b-versatile"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Input $/1M Tokens</label>
            <input
              type="number"
              step="any"
              value={inputPrice}
              onChange={(e) => setInputPrice(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Output $/1M Tokens</label>
            <input
              type="number"
              step="any"
              value={outputPrice}
              onChange={(e) => setOutputPrice(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={createPriceMutation.isPending}
              className="w-full py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Save Rate</span>
            </button>
          </div>
        </form>

        {/* Existing Prices Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4 text-right">Input / 1M</th>
                <th className="py-3 px-4 text-right">Output / 1M</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading pricing rates...
                  </td>
                </tr>
              ) : prices && prices.length > 0 ? (
                prices.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{p.provider}</td>
                    <td className="py-2.5 px-4 font-mono text-white font-medium">{p.model}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-400">
                      ${p.input_price_per_1m.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-cyan-400">
                      ${p.output_price_per_1m.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(p.id, p.model)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete price rate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No prices found. Add your first rate above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* API Key Instructions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">SDK Telemetry & Project API Keys</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Target Project:</span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5" />
              {keyData?.project_name || activeProject?.name || 'Loading...'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="text-slate-200 font-semibold flex items-center gap-2">
                <span>Active Project Ingestion Key</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                  Isolated
                </span>
              </div>
              <p className="text-slate-400 mt-1 text-[11px]">
                Each project has its own unique API key. Traces sent with this key are strictly partitioned into <strong>{keyData?.project_name || activeProject?.name || 'this project'}</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!effectiveProjectId) return;
                const ok = window.confirm(
                  `Generate a fresh API key for "${keyData?.project_name || activeProject?.name}"?\nPrevious keys for this project will be safely retired.`
                );
                if (!ok) return;

                try {
                  const res = await rollKeyMutation.mutateAsync(effectiveProjectId);
                  setRolledKey(res.api_key);
                  toast.success('Fresh API key generated and activated!');
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : 'Failed to generate key');
                }
              }}
              disabled={rollKeyMutation.isPending || !effectiveProjectId}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rollKeyMutation.isPending ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{rollKeyMutation.isPending ? 'Generating...' : 'Roll New API Key'}</span>
            </button>
          </div>

          {/* Newly Generated Full Key Alert */}
          {(rolledKey || keyData?.api_key) && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Fresh Secret API Key Generated (Copy now):
                </span>
                <span className="text-[10px] text-emerald-400/80 font-mono">Ready to use</span>
              </div>
              <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-lg flex items-center justify-between font-mono text-emerald-400">
                <span className="truncate pr-2 font-semibold select-all">
                  {rolledKey || keyData?.api_key}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const k = rolledKey || keyData?.api_key || '';
                    navigator.clipboard.writeText(k);
                    setCopiedKey(true);
                    toast.success('Full API Key copied to clipboard!');
                    setTimeout(() => setCopiedKey(false), 2500);
                  }}
                  className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer shrink-0"
                  title="Copy full key"
                >
                  {copiedKey ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Environment Variables */}
          <div className="space-y-2 font-mono">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Terminal / .env Exports for "{keyData?.project_name || activeProject?.name || 'Selected Project'}":</span>
              {keyData?.key_prefix && (
                <span className="text-slate-500">Active Prefix: <strong className="text-slate-400">{keyData.key_prefix}</strong></span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-between">
              <code>export TOKENTRAIL_API_KEY="{rolledKey || keyData?.api_key || (keyData?.key_prefix ? `${keyData.key_prefix}...` : 'tt_live_dev_test_key')}"</code>
              <button
                type="button"
                onClick={() => {
                  const keyToCopy = rolledKey || keyData?.api_key || keyData?.key_prefix || 'tt_live_dev_test_key';
                  navigator.clipboard.writeText(`export TOKENTRAIL_API_KEY="${keyToCopy}"`);
                  toast.success('API key export copied');
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title="Copy API key command"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-between">
              <code>export TOKENTRAIL_ENDPOINT="{import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://tokentrail-backend.onrender.com')}"</code>
              <button
                type="button"
                onClick={() => {
                  const endpoint = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://tokentrail-backend.onrender.com');
                  navigator.clipboard.writeText(`export TOKENTRAIL_ENDPOINT="${endpoint}"`);
                  toast.success('Endpoint export copied');
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title="Copy endpoint command"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Safe Integration Instructions for Live Projects */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Safe Live Integration (Zero Downtime / Zero-Raise Policy)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              TokenTrail uses an asynchronous, bounded background queue. Even if the network drops or the telemetry endpoint is temporarily down, the SDK <strong>never throws exceptions</strong> or interrupts your live users or LLM streams in production.
            </p>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
              <p className="text-slate-500"># In your live Python project (e.g. Nexus RAG):</p>
              <p className="text-emerald-400">from tokentrail import TokenTrail</p>
              <p className="text-emerald-400 mt-1">tt = TokenTrail()  # Safe auto-fallback if TOKENTRAIL_API_KEY is not set</p>
              <p className="text-cyan-400 mt-1">client = tt.wrap_openai(openai_client)  # Auto-captures tokens & cost</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

