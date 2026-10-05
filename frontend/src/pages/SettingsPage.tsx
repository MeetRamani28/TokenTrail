import React, { useState } from 'react';
import { useCreatePrice, useDeletePrice, usePrices, useProjectKey } from '../api/queries';
import {
  Coins,
  Copy,
  Key,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  const { data: prices, isLoading } = usePrices();
  const createPriceMutation = useCreatePrice();
  const deletePriceMutation = useDeletePrice();
  const activeProjectId = localStorage.getItem('tokentrail_project_id');
  const { data: keyData } = useProjectKey(activeProjectId);

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
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Key className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">SDK Telemetry Key</h2>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4 text-xs">
          <p className="text-slate-300">
            Use your active project API key to send traces from the Python SDK or any live application:
          </p>

          <div className="space-y-2 font-mono">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-between">
              <code>export TOKENTRAIL_API_KEY="{keyData?.api_key || (keyData?.key_prefix ? `${keyData.key_prefix}...` : 'tt_live_dev_test_key')}"</code>
              <button
                onClick={() => {
                  const keyToCopy = keyData?.api_key || keyData?.key_prefix || 'tt_live_dev_test_key';
                  navigator.clipboard.writeText(`export TOKENTRAIL_API_KEY="${keyToCopy}"`);
                  toast.success('API key export copied');
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Copy API key command"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-between">
              <code>export TOKENTRAIL_ENDPOINT="{import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')}"</code>
              <button
                onClick={() => {
                  const endpoint = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');
                  navigator.clipboard.writeText(`export TOKENTRAIL_ENDPOINT="${endpoint}"`);
                  toast.success('Endpoint export copied');
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Copy endpoint command"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
