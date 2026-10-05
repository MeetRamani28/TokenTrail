import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCreatePrice,
  useDeletePrice,
  usePrices,
  useProjectKey,
  useProjects,
  useRollProjectKey,
  useUpdateProject,
  useDeleteProject,
} from '../api/queries';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedProjectId } from '../store/uiSlice';
import {
  AlertTriangle,
  CheckCheck,
  Coins,
  Copy,
  FolderKanban,
  Key,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
  Laptop,
  Shield,
} from 'lucide-react';
import { useUser, useSession } from '@clerk/clerk-react';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useUser();
  const { session } = useSession();
  const { data: prices, isLoading } = usePrices();
  const { data: projects = [] } = useProjects();
  const createPriceMutation = useCreatePrice();
  const deletePriceMutation = useDeletePrice();
  const rollKeyMutation = useRollProjectKey();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);
  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const effectiveProjectId = selectedProjectId || activeProject?.id;

  const { data: keyData } = useProjectKey(effectiveProjectId);
  const [rolledKey, setRolledKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isRollModalOpen, setIsRollModalOpen] = useState(false);

  // Project Rename and Delete modal states
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleConfirmRollKey = async () => {
    if (!effectiveProjectId) return;
    try {
      const res = await rollKeyMutation.mutateAsync(effectiveProjectId);
      setRolledKey(res.api_key);
      setIsRollModalOpen(false);
      toast.success('Fresh API key generated and activated!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate key');
    }
  };

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

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveProjectId || !renameValue.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }
    try {
      await updateProjectMutation.mutateAsync({
        projectId: effectiveProjectId,
        name: renameValue.trim(),
      });
      toast.success(`Project renamed to "${renameValue.trim()}"`);
      setIsRenameModalOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename project');
    }
  };

  const handleDeleteProject = async () => {
    if (!effectiveProjectId) return;
    try {
      await deleteProjectMutation.mutateAsync(effectiveProjectId);
      toast.success(`Project "${activeProject?.name}" deleted successfully`);
      const remaining = projects.filter((p) => p.id !== effectiveProjectId);
      if (remaining.length > 0) {
        dispatch(setSelectedProjectId(remaining[0].id));
      }
      setIsDeleteModalOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const setModelPreset = (prov: string, mod: string, inRate: number, outRate: number) => {
    setProvider(prov);
    setModel(mod);
    setInputPrice(inRate.toString());
    setOutputPrice(outRate.toString());
    toast.info(`Pre-filled rates for ${mod}`);
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
        <div className="space-y-2">
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
                list="suggested-models"
                value={model}
                onChange={(e) => {
                  const val = e.target.value;
                  setModel(val);
                  if (val.startsWith('openai/') || val.startsWith('gpt-')) {
                    setProvider('openai');
                  } else if (val.startsWith('llama') || val.startsWith('mixtral') || val.startsWith('gemma')) {
                    setProvider('groq');
                  } else if (val.startsWith('claude')) {
                    setProvider('anthropic');
                  }
                }}
                placeholder="e.g. openai/gpt-oss-20b"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                required
              />
              <datalist id="suggested-models">
                <option value="openai/gpt-oss-20b" />
                <option value="llama-3.3-70b-versatile" />
                <option value="llama-3.1-8b-instant" />
                <option value="gpt-4o" />
                <option value="gpt-4o-mini" />
                <option value="claude-3-5-sonnet-20241022" />
                <option value="mixtral-8x7b-32768" />
              </datalist>
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
                className="w-full py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Rate</span>
              </button>
            </div>
          </form>

          {/* Quick Pre-fill Pills */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 px-1">
            <span className="text-slate-500">Quick suggestions:</span>
            <button
              type="button"
              onClick={() => setModelPreset('openai', 'openai/gpt-oss-20b', 0.2, 0.4)}
              className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono transition-colors border border-slate-700/60 cursor-pointer"
            >
              openai/gpt-oss-20b ($0.20 / $0.40)
            </button>
            <button
              type="button"
              onClick={() => setModelPreset('groq', 'llama-3.3-70b-versatile', 0.59, 0.79)}
              className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono transition-colors border border-slate-700/60 cursor-pointer"
            >
              llama-3.3-70b ($0.59 / $0.79)
            </button>
            <button
              type="button"
              onClick={() => setModelPreset('openai', 'gpt-4o-mini', 0.15, 0.6)}
              className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono transition-colors border border-slate-700/60 cursor-pointer"
            >
              gpt-4o-mini ($0.15 / $0.60)
            </button>
            <button
              type="button"
              onClick={() => setModelPreset('groq', 'llama-3.1-8b-instant', 0.05, 0.08)}
              className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono transition-colors border border-slate-700/60 cursor-pointer"
            >
              llama-3.1-8b ($0.05 / $0.08)
            </button>
          </div>
        </div>

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
              onClick={() => {
                if (!effectiveProjectId) {
                  toast.error('No project selected');
                  return;
                }
                setIsRollModalOpen(true);
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
              <p className="text-slate-500"># In your live Python project (e.g. SQLGuard / Nexus RAG):</p>
              <p className="text-emerald-400">from tokentrail import TokenTrail</p>
              <p className="text-emerald-400 mt-1">tt = TokenTrail()  # Safe auto-fallback if TOKENTRAIL_API_KEY is not set</p>
              <p className="text-cyan-400 mt-1">client = tt.wrap_openai(openai_client)  # Auto-captures tokens & cost</p>
            </div>
          </div>
        </div>
      </section>

      {/* Project Administration Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Project Administration</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Active: {activeProject?.name || 'Default Project'}
          </span>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{activeProject?.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">
                  ID: {activeProject?.id ? `${activeProject.id.slice(0, 8)}...` : 'N/A'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Data retention: <strong className="text-slate-200">{activeProject?.retention_days || 30} days</strong> • Total projects: <span className="font-mono text-slate-300">{projects.length}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRenameValue(activeProject?.name || '');
                  setIsRenameModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rename Project</span>
              </button>

              <button
                type="button"
                disabled={projects.length <= 1}
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:text-rose-200 font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={projects.length <= 1 ? 'Cannot delete the only project' : 'Delete project'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Project</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Device Sessions & Security Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Laptop className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Multi-Device Sessions & Security</h2>
          </div>
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            5+ Simultaneous Devices Supported
          </span>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 text-[11px] block">Verified Clerk User ID (sub):</span>
              <span className="font-mono text-emerald-400 font-semibold truncate block select-all">
                {user?.id || 'user_dev_admin'}
              </span>
              <p className="text-[10px] text-slate-500">Shared consistently across all devices</p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 text-[11px] block">Active Device Session ID:</span>
              <span className="font-mono text-cyan-400 font-semibold truncate block select-all">
                {session?.id || 'sess_device_current'}
              </span>
              <p className="text-[10px] text-slate-500">Unique cryptographic token on this browser</p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 text-[11px] block">Account Email:</span>
              <span className="font-mono text-white font-semibold truncate block">
                {user?.primaryEmailAddress?.emailAddress || 'dev@tokentrail.io'}
              </span>
              <p className="text-[10px] text-emerald-400">Authenticated & verified</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start gap-3">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-slate-300 leading-relaxed text-[11px]">
              <span className="font-semibold text-white block">Seamless Multi-Device Architecture (ChatGPT/Gemini Style)</span>
              <p className="text-slate-400">
                You can remain logged in on multiple browsers and devices simultaneously (mobile, tablet, desktop, laptop) without any device being kicked out. Every API request transmits an individual RS256 JWT, which the TokenTrail backend validates against Clerk's live JWKS key to extract your unique user ID for 100% data consistency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rename Project Modal */}
      {isRenameModalOpen &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !updateProjectMutation.isPending && setIsRenameModalOpen(false)}
                className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="relative w-full max-w-md bg-[#0d131f] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5 z-10 text-xs"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Pencil className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Rename Project</h3>
                      <p className="text-xs text-slate-400">Update project display label</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRenameModalOpen(false)}
                    disabled={updateProjectMutation.isPending}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleRenameProject} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">New Project Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="e.g. SQLGuard Production"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsRenameModalOpen(false)}
                      disabled={updateProjectMutation.isPending}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateProjectMutation.isPending}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 shadow-md shadow-cyan-500/20 cursor-pointer"
                    >
                      {updateProjectMutation.isPending && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}

      {/* Delete Project Modal */}
      {isDeleteModalOpen &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !deleteProjectMutation.isPending && setIsDeleteModalOpen(false)}
                className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="relative w-full max-w-md bg-[#0d131f] border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-5 z-10 text-xs"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Delete Project</h3>
                      <p className="text-xs text-rose-400 font-medium">Irreversible Action</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={deleteProjectMutation.isPending}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Are you sure you want to permanently delete the project{' '}
                    <strong className="text-white font-semibold">"{activeProject?.name}"</strong>?
                  </p>
                  <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300/90 space-y-1">
                    <p>• All traces, spans, and telemetry associated with this project will be deleted.</p>
                    <p>• Any SDK client using this project's API key will be immediately deactivated.</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={deleteProjectMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteProject}
                    disabled={deleteProjectMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors disabled:opacity-50 shadow-md shadow-rose-600/30 cursor-pointer"
                  >
                    {deleteProjectMutation.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Yes, Delete Project</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}

      {/* Custom Roll API Key Modal */}
      {isRollModalOpen &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !rollKeyMutation.isPending && setIsRollModalOpen(false)}
                className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
              />

              {/* Modal Card */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="relative w-full max-w-md bg-[#0d131f] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5 z-10 text-xs"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Roll API Key</h3>
                      <p className="text-xs text-slate-400">
                        Project: <span className="text-emerald-400 font-mono font-medium">{keyData?.project_name || activeProject?.name || 'Selected Project'}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRollModalOpen(false)}
                    disabled={rollKeyMutation.isPending}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Warning Details */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-200/90 space-y-1.5 leading-relaxed">
                  <div className="flex items-center gap-2 font-semibold text-amber-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Existing keys will be revoked</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    Any existing ingestion key for <strong>"{keyData?.project_name || activeProject?.name}"</strong> will be safely retired. Live services using the old key will need the new key to continue recording traces.
                  </p>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed">
                  TokenTrail will generate a brand new <code className="text-emerald-400 font-mono">tt_live_...</code> key and reveal the full secret for you to copy into your environment variables.
                </p>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsRollModalOpen(false)}
                    disabled={rollKeyMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRollKey}
                    disabled={rollKeyMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <RefreshCw className={`w-4 h-4 ${rollKeyMutation.isPending ? 'animate-spin' : ''}`} />
                    <span>{rollKeyMutation.isPending ? 'Generating...' : 'Yes, Generate Fresh Key'}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

